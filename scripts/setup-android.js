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
import android.os.Environment
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import android.provider.Settings
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : TauriActivity() {
  private var webViewRef: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestAudioPermissions()
  }

  override fun onResume() {
    super.onResume()
    Thread {
      scanAudioFull()
      webViewRef?.post {
        webViewRef?.evaluateJavascript("if (window.__refreshAndroidLibrary) { window.__refreshAndroidLibrary(); }", null)
      }
    }.start()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webViewRef = webView
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun scanAudio(): String {
        return scanAudioFull()
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
        scanAudioFull()
        webViewRef?.post {
          webViewRef?.evaluateJavascript("if (window.__refreshAndroidLibrary) { window.__refreshAndroidLibrary(); }", null)
        }
      }.start()
    }
  }

  private fun requestAudioPermissions() {
    // 1. Android 11+ All Files Access (MANAGE_EXTERNAL_STORAGE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      if (!Environment.isExternalStorageManager()) {
        try {
          val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:$packageName")
          }
          startActivity(intent)
        } catch (_: Exception) {
          try {
            val fallback = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
            startActivity(fallback)
          } catch (_: Exception) {}
        }
      }
    }

    // 2. Standard runtime permissions
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
        scanAudioFull()
      }.start()
    }
  }

  private fun isJunkPath(path: String): Boolean {
    val lower = path.lowercase()
    val junkKeywords = arrayOf(
      "/ringtones", "/notifications", "/alarms", "/system/media", "/product/media",
      "/android/data", "/whatsapp voice notes", "/sent", "/call_recordings",
      "/.nomedia"
    )
    for (k in junkKeywords) {
      if (lower.contains(k)) return true
    }
    return false
  }

  private fun scanAudioFull(): String {
    val tracksMap = LinkedHashMap<String, JSONObject>()
    val audioExts = setOf("mp3", "flac", "wav", "m4a", "ogg", "aac", "wma", "alac", "aiff", "opus")

    // --- 1. Query Android MediaStore (Cleaned & Filtered) ---
    try {
      val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      val projection = arrayOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.DATA,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.SIZE,
        MediaStore.Audio.Media.IS_MUSIC,
        MediaStore.Audio.Media.IS_RINGTONE,
        MediaStore.Audio.Media.IS_NOTIFICATION,
        MediaStore.Audio.Media.IS_ALARM
      )
      // Exclude ringtones, notifications, and alarms at the query level
      val selection = "(is_music != 0) AND (is_ringtone == 0) AND (is_notification == 0) AND (is_alarm == 0)"
      contentResolver.query(uri, projection, selection, null, "title ASC")?.use { cursor ->
        val idCol = cursor.getColumnIndex(MediaStore.Audio.Media._ID)
        val dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)
        val titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE)
        val artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST)
        val albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM)
        val durCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION)
        val sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE)

        while (cursor.moveToNext()) {
          val path = if (dataCol >= 0) cursor.getString(dataCol) else null
          if (path.isNullOrEmpty() || isJunkPath(path)) continue

          val durationMs = if (durCol >= 0) cursor.getLong(durCol) else 0L
          if (durationMs in 1..14999) continue

          val id = if (idCol >= 0) cursor.getString(idCol) else path.hashCode().toString()
          val title = if (titleCol >= 0) cursor.getString(titleCol) ?: File(path).nameWithoutExtension else File(path).nameWithoutExtension
          val artist = if (artistCol >= 0) cursor.getString(artistCol) ?: "Unknown Artist" else "Unknown Artist"
          val album = if (albumCol >= 0) cursor.getString(albumCol) ?: "Unknown Album" else "Unknown Album"
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
          tracksMap[path] = obj
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
    }

    // --- 2. Direct Storage Crawler (VLC style) ---
    val candidateRoots = mutableListOf<File>()
    try {
      val musicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)
      if (musicDir != null && musicDir.exists()) candidateRoots.add(musicDir)

      val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
      if (downloadDir != null && downloadDir.exists()) candidateRoots.add(downloadDir)

      val docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
      if (docDir != null && docDir.exists()) candidateRoots.add(docDir)

      val emulatedBase = File("/storage/emulated/0")
      if (emulatedBase.exists()) {
        val subDirs = arrayOf("Music", "Download", "Audio", "Podcasts", "Recordings", "Snaptube", "Telegram")
        for (sub in subDirs) {
          val f = File(emulatedBase, sub)
          if (f.exists() && !candidateRoots.contains(f)) candidateRoots.add(f)
        }
      }

      val sdcardBase = File("/sdcard")
      if (sdcardBase.exists()) {
        val subDirs = arrayOf("Music", "Download")
        for (sub in subDirs) {
          val f = File(sdcardBase, sub)
          if (f.exists() && !candidateRoots.contains(f)) candidateRoots.add(f)
        }
      }

      val storageRoot = File("/storage")
      if (storageRoot.exists() && storageRoot.isDirectory) {
        storageRoot.listFiles()?.forEach { dev ->
          if (dev.isDirectory && dev.name != "emulated" && dev.name != "self") {
            val sdMusic = File(dev, "Music")
            if (sdMusic.exists()) candidateRoots.add(sdMusic)
            val sdDl = File(dev, "Download")
            if (sdDl.exists()) candidateRoots.add(sdDl)
          }
        }
      }
    } catch (_: Exception) {}

    var mmr: MediaMetadataRetriever? = null
    try {
      mmr = MediaMetadataRetriever()
    } catch (_: Exception) {}

    val filesToRegister = mutableListOf<String>()

    for (rootDir in candidateRoots) {
      if (!rootDir.exists() || !rootDir.canRead()) continue
      try {
        rootDir.walkTopDown()
          .onEnter { dir ->
            val name = dir.name
            val path = dir.absolutePath.lowercase()
            !name.startsWith(".")
              && name != "Android"
              && name != "node_modules"
              && !path.contains("/ringtones")
              && !path.contains("/notifications")
              && !path.contains("/alarms")
              && !File(dir, ".nomedia").exists()
          }
          .forEach { file ->
            if (file.isFile) {
              val ext = file.extension.lowercase()
              if (audioExts.contains(ext)) {
                val absPath = file.absolutePath
                if (!isJunkPath(absPath) && !tracksMap.containsKey(absPath)) {
                  var title = file.nameWithoutExtension
                  var artist = "Unknown Artist"
                  var album = "Unknown Album"
                  var durationSec = 0.0

                  try {
                    if (mmr != null) {
                      mmr.setDataSource(absPath)
                      val t = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
                      val a = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
                      val al = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)
                      val d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L

                      if (!t.isNullOrBlank()) title = t
                      if (!a.isNullOrBlank()) artist = a
                      if (!al.isNullOrBlank()) album = al
                      if (d > 0) durationSec = d / 1000.0
                    }
                  } catch (_: Exception) {}

                  if (durationSec in 0.001..14.999 && file.length() < 1024 * 1024) {
                    // skip tiny sounds
                  } else {
                    val obj = JSONObject()
                    obj.put("id", absPath.hashCode().toString())
                    obj.put("title", title)
                    obj.put("artist", artist)
                    obj.put("album", album)
                    obj.put("duration", durationSec)
                    obj.put("filePath", absPath)
                    obj.put("fileSize", file.length())
                    obj.put("format", ext)
                    tracksMap[absPath] = obj
                    filesToRegister.add(absPath)
                  }
                }
              }
            }
          }
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }

    try {
      mmr?.release()
    } catch (_: Exception) {}

    // Force Android MediaScanner to register any unindexed files!
    if (filesToRegister.isNotEmpty()) {
      try {
        MediaScannerConnection.scanFile(
          this,
          filesToRegister.take(200).toTypedArray(),
          null,
          null
        )
      } catch (_: Exception) {}
    }

    val jsonArray = JSONArray()
    for (track in tracksMap.values) {
      jsonArray.put(track)
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
  }
}
`
  fs.writeFileSync(mainActivityPath, kotlinCode, 'utf8')
  console.log('[setup-android] Successfully injected runtime permissions into:', mainActivityPath)
} else {
  console.warn('[setup-android] MainActivity.kt not found in:', genAndroidDir)
}

console.log('[setup-android] Configuration completed.')
