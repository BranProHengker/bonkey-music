import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync, createReadStream, statSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/iconapp.png?asset'

// ─── Types ───────────────────────────────────────────────────────────
export interface TrackMeta {
  filePath: string
  title: string
  artist: string
  album: string
  duration: number
  trackNumber: number | null
  year: number | null
  genre: string | null
  coverArt: string | null // base64 data URI
  bitrate?: number
  sampleRate?: number
  bitsPerSample?: number
  lossless?: boolean
  container?: string
}

// ─── Custom Protocol ─────────────────────────────────────────────────
// Register before app ready so the scheme is treated as standard/secure
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

// ─── Library Cache Helpers ───────────────────────────────────────────
const LIBRARY_PATH = (): string => join(app.getPath('userData'), 'library.json')
const SETTINGS_PATH = (): string => join(app.getPath('userData'), 'settings.json')

async function saveLibrary(tracks: TrackMeta[]): Promise<void> {
  await writeFile(LIBRARY_PATH(), JSON.stringify(tracks, null, 2), 'utf-8')
}

async function loadLibrary(): Promise<TrackMeta[]> {
  try {
    if (!existsSync(LIBRARY_PATH())) return []
    const data = await readFile(LIBRARY_PATH(), 'utf-8')
    return JSON.parse(data) as TrackMeta[]
  } catch {
    return []
  }
}

async function saveSettings(settings: Record<string, unknown>): Promise<void> {
  await writeFile(SETTINGS_PATH(), JSON.stringify(settings, null, 2), 'utf-8')
}

async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    if (!existsSync(SETTINGS_PATH())) return {}
    const data = await readFile(SETTINGS_PATH(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

// ─── Window Creation ─────────────────────────────────────────────────
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#a0a0a0',
      height: 36
    },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.music-app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── Register media:// protocol handler ──────────────────────────
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url)
      // Combine host and pathname to handle URLs normalized with 2 slashes (where 'home' becomes host)
      let filePath = decodeURIComponent(url.host + url.pathname)
      if (!filePath.startsWith('/') && !/^[a-zA-Z]:/.test(filePath)) {
        filePath = '/' + filePath
      }

      if (!existsSync(filePath)) {
        console.warn('File not found:', filePath)
        return new Response('File not found', { status: 404 })
      }

      const stat = statSync(filePath)
      const fileSize = stat.size
      const range = request.headers.get('Range')

      // Get MIME type dynamically based on file extension
      const ext = filePath.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        flac: 'audio/flac',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        ogg: 'audio/ogg',
        aac: 'audio/aac',
        wma: 'audio/x-ms-wma'
      }
      const contentType = mimeTypes[ext] || 'audio/mpeg'

      if (range) {
        // Parse Range header: e.g., "bytes=10000-" or "bytes=1000-2000"
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = (end - start) + 1

        const stream = createReadStream(filePath, { start, end })
        // @ts-ignore: Response body accepts Node.js readable streams in Electron
        return new Response(stream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType
          }
        })
      } else {
        const stream = createReadStream(filePath)
        // @ts-ignore: Response body accepts Node.js readable streams in Electron
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Length': String(fileSize),
            'Content-Type': contentType
          }
        })
      }
    } catch (err) {
      console.error('Media protocol error:', err)
      return new Response('Internal error', { status: 500 })
    }
  })

  // ─── IPC: Select Folder ──────────────────────────────────────────
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Music Library Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ─── IPC: Scan Folder ────────────────────────────────────────────
  ipcMain.handle('scan-folder', async (_event, folderPath: string) => {
    try {
      const fg = await import('fast-glob')
      const files = await fg.default(
        ['**/*.mp3', '**/*.flac', '**/*.wav', '**/*.m4a', '**/*.ogg', '**/*.aac', '**/*.wma'],
        {
          cwd: folderPath,
          absolute: true,
          onlyFiles: true,
          followSymbolicLinks: true
        }
      )

      const tracks: TrackMeta[] = []
      const { parseFile } = await import('music-metadata')

      for (const file of files) {
        try {
          const metadata = await parseFile(file)
          const common = metadata.common
          const format = metadata.format

          // Extract cover art as base64
          let coverArt: string | null = null
          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0]
            const base64 = Buffer.from(pic.data).toString('base64')
            coverArt = `data:${pic.format};base64,${base64}`
          }

          tracks.push({
            filePath: file,
            title: common.title || file.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown',
            artist: common.artist || 'Unknown Artist',
            album: common.album || 'Unknown Album',
            duration: format.duration || 0,
            trackNumber: common.track?.no || null,
            year: common.year || null,
            genre: common.genre?.[0] || null,
            coverArt,
            bitrate: format.bitrate,
            sampleRate: format.sampleRate,
            bitsPerSample: format.bitsPerSample,
            lossless: format.lossless,
            container: format.container
          })
        } catch {
          // Skip files that can't be parsed
          console.warn(`Could not parse metadata for: ${file}`)
        }
      }

      // Sort by artist, then album, then track number
      tracks.sort((a, b) => {
        const artistCmp = a.artist.localeCompare(b.artist)
        if (artistCmp !== 0) return artistCmp
        const albumCmp = a.album.localeCompare(b.album)
        if (albumCmp !== 0) return albumCmp
        return (a.trackNumber || 0) - (b.trackNumber || 0)
      })

      await saveLibrary(tracks)

      // Save folder path in settings
      const settings = await loadSettings()
      settings.libraryFolder = folderPath
      await saveSettings(settings)

      return tracks
    } catch (error) {
      console.error('Scan error:', error)
      return []
    }
  })

  // ─── IPC: Load Library ───────────────────────────────────────────
  ipcMain.handle('load-library', async () => {
    return await loadLibrary()
  })

  // ─── IPC: Load Settings ──────────────────────────────────────────
  ipcMain.handle('load-settings', async () => {
    return await loadSettings()
  })

  // ─── IPC: Save Settings ──────────────────────────────────────────
  ipcMain.handle('save-settings', async (_event, settings: Record<string, unknown>) => {
    try {
      await saveSettings(settings)
      return true
    } catch {
      return false
    }
  })

  // ─── IPC: Get Cover Art ──────────────────────────────────────────
  ipcMain.handle('get-cover-art', async (_event, filePath: string) => {
    try {
      const { parseFile } = await import('music-metadata')
      const metadata = await parseFile(filePath)
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0]
        const base64 = Buffer.from(pic.data).toString('base64')
        return `data:${pic.format};base64,${base64}`
      }
      return null
    } catch {
      return null
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
