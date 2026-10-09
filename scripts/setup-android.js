const fs = require('fs')
const path = require('path')

console.log('[setup-android] Starting Android project configuration...')

// 1. Copy custom icons to Android res directory
const iconSrcDir = path.resolve(__dirname, '../src-tauri/icons/android')
const iconDestDir = path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/res')

if (fs.existsSync(iconSrcDir) && fs.existsSync(iconDestDir)) {
  fs.cpSync(iconSrcDir, iconDestDir, { recursive: true, force: true })
  console.log('[setup-android] Successfully copied custom icons to:', iconDestDir)
} else {
  console.warn('[setup-android] Icons or target res directory not found, skipping icon copy')
}

// 2. Inject permissions into AndroidManifest.xml
const manifestPath = path.resolve(__dirname, '../src-tauri/gen/android/app/src/main/AndroidManifest.xml')
if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, 'utf8')
  if (!content.includes('android.permission.READ_MEDIA_AUDIO')) {
    const permissions = `    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />\n`
    content = content.replace('<application', `${permissions}    <application`)
  }
  if (!content.includes('android:requestLegacyExternalStorage="true"')) {
    content = content.replace('<application', '<application android:requestLegacyExternalStorage="true"')
  }
  fs.writeFileSync(manifestPath, content, 'utf8')
  console.log('[setup-android] Successfully injected permissions into AndroidManifest.xml')
} else {
  console.warn('[setup-android] AndroidManifest.xml not found at:', manifestPath)
}

// 3. Find and inject runtime permissions request and MediaStore scan into MainActivity.kt
function findFile(dir, fileName) {
  if (!fs.existsSync(dir)) return null
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findFile(fullPath, fileName)
      if (found) return found
    } else if (entry.name === fileName) {
      return fullPath
    }
  }
  return null
}

const genAndroidDir = path.resolve(__dirname, '../src-tauri/gen/android')
const mainActivityPath = findFile(genAndroidDir, 'MainActivity.kt')

if (mainActivityPath) {
  const original = fs.readFileSync(mainActivityPath, 'utf8')
  const packageMatch = original.match(/^package\s+([^\s;]+)/m)
  const pkg = packageMatch ? packageMatch[1] : 'com.bonkeymusic.app'

  const kotlinCode = `package ${pkg}

import android.os.Build
import android.os.Bundle
import android.content.pm.PackageManager
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestAudioPermissions()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun scanAudio(): String {
        return scanMediaStoreJson()
      }
    }, "AndroidBridge")
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == 1001 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
      Thread {
        scanMediaStoreJson()
      }.start()
    }
  }

  private fun requestAudioPermissions() {
    val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      arrayOf(android.Manifest.permission.READ_MEDIA_AUDIO)
    } else {
      arrayOf(android.Manifest.permission.READ_EXTERNAL_STORAGE)
    }
    val missing = permissions.filter {
      checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) {
      requestPermissions(missing.toTypedArray(), 1001)
    } else {
      Thread {
        scanMediaStoreJson()
      }.start()
    }
  }

  private fun scanMediaStoreJson(): String {
    val jsonArray = JSONArray()
    try {
      val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.DATA,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.SIZE
      )
      val selection = "\${MediaStore.Audio.Media.IS_MUSIC} != 0 OR \${MediaStore.Audio.Media.DURATION} >= 15000"
      contentResolver.query(uri, projection, selection, null, "\${MediaStore.Audio.Media.TITLE} ASC")?.use { cursor ->
        val idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID)
        val dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)
        val titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE)
        val artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST)
        val albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM)
        val durCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION)
        val sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE)

        while (cursor.moveToNext()) {
          val path = if (dataCol >= 0) cursor.getString(dataCol) else null
          if (path.isNullOrEmpty()) continue

          val id = if (idCol >= 0) cursor.getString(idCol) else path.hashCode().toString()
          val title = if (titleCol >= 0) cursor.getString(titleCol) ?: File(path).nameWithoutExtension else File(path).nameWithoutExtension
          val artist = if (artistCol >= 0) cursor.getString(artistCol) ?: "Unknown Artist" else "Unknown Artist"
          val album = if (albumCol >= 0) cursor.getString(albumCol) ?: "Unknown Album" else "Unknown Album"
          val durationMs = if (durCol >= 0) cursor.getLong(durCol) else 0L
          val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L

          val ext = path.substringAfterLast('.', "mp3").lowercase()

          val obj = JSONObject()
          obj.put("id", id)
          obj.put("title", title)
          obj.put("artist", if (artist == "<unknown>") "Unknown Artist" else artist)
          obj.put("album", if (album == "<unknown>") "Unknown Album" else album)
          obj.put("duration", durationMs / 1000.0)
          obj.put("filePath", path)
          obj.put("fileSize", size)
          obj.put("format", ext)
          jsonArray.put(obj)
        }
      }

      val result = jsonArray.toString()
      try {
        val destFile = File(filesDir, "mediastore_tracks.json")
        destFile.writeText(result)
        
        val altDir = File("/data/data/com.bonkeymusic.app/files")
        if (altDir.exists() && altDir != filesDir) {
          File(altDir, "mediastore_tracks.json").writeText(result)
        }
      } catch (_: Exception) {}

      return result
    } catch (e: Exception) {
      e.printStackTrace()
      return "[]"
    }
  }
}
`
  fs.writeFileSync(mainActivityPath, kotlinCode, 'utf8')
  console.log('[setup-android] Successfully injected runtime permissions into:', mainActivityPath)
} else {
  console.warn('[setup-android] MainActivity.kt not found in:', genAndroidDir)
}

console.log('[setup-android] Configuration completed.')
