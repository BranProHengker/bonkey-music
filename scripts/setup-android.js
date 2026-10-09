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
    const permissions = `    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n`
    content = content.replace('<application', `${permissions}    <application`)
    fs.writeFileSync(manifestPath, content, 'utf8')
    console.log('[setup-android] Successfully injected permissions into AndroidManifest.xml')
  } else {
    console.log('[setup-android] Permissions already present in AndroidManifest.xml')
  }
} else {
  console.warn('[setup-android] AndroidManifest.xml not found at:', manifestPath)
}

// 3. Find and inject runtime permissions request into MainActivity.kt
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
  const kotlinCode = `package com.bonkeymusic.app

import android.os.Build
import android.os.Bundle
import android.content.pm.PackageManager
import app.tauri.plugin.TauriActivity

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestAudioPermissions()
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
