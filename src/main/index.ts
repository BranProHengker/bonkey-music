import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  globalShortcut,
  Tray,
  Menu
} from 'electron'
import { join, basename } from 'path'
import { readFile, writeFile, readdir, copyFile, mkdir } from 'fs/promises'
import { existsSync, createReadStream, statSync } from 'fs'
import { electronApp, is } from '@electron-toolkit/utils'
import DiscordRPC from 'discord-rpc'

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

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// ─── Window Creation ─────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
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
    icon: join(__dirname, '../../resources/iconapp.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle custom keyboard shortcuts (DevTools, Reload, Zoom) manually
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isControlOrMeta = input.control || input.meta

      // 1. Toggle Developer Tools (F12 or Ctrl+Shift+I) in both dev and prod
      const isF12 = input.code === 'F12'
      const isCtrlShiftI = isControlOrMeta && input.shift && input.code === 'KeyI'
      if (isF12 || isCtrlShiftI) {
        event.preventDefault()
        if (mainWindow?.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools()
        } else {
          mainWindow?.webContents.openDevTools({ mode: 'undocked' })
        }
        return
      }

      // 2. Prevent default Ctrl+R or F5 reload and trigger Shuffle instead
      const isCtrlR = isControlOrMeta && input.code === 'KeyR'
      const isF5 = input.code === 'F5'
      if (isCtrlR || isF5) {
        // Devs can still hard reload using Ctrl+Shift+R in development mode
        if (is.dev && input.shift && isCtrlR) {
          return // Allow default reload
        }
        event.preventDefault()
        // Trigger shuffle event
        mainWindow?.webContents.send('media-control', 'shuffle')
        return
      }

      // 3. Disable default Zoom shortcuts (Ctrl+Plus, Ctrl+Minus, etc.)
      const isZoomOut = isControlOrMeta && input.code === 'Minus'
      const isZoomIn = isControlOrMeta && input.code === 'Equal' && input.shift
      if (isZoomOut || isZoomIn) {
        event.preventDefault()
      }
    }
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/iconapp.png')
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Bonkey Music',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Play / Pause',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('media-control', 'play-pause')
      }
    },
    {
      label: 'Next Track',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('media-control', 'next')
      }
    },
    {
      label: 'Previous Track',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('media-control', 'prev')
      }
    },
    { type: 'separator' },
    {
      label: 'Volume Up (+5%)',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('volume-control', 'up')
      }
    },
    {
      label: 'Volume Down (-5%)',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('volume-control', 'down')
      }
    },
    {
      label: 'Toggle Mute',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('volume-control', 'mute')
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('Bonkey Music')
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// Disable hardware video decoding features to suppress GPU VAAPI warnings in terminal
app.commandLine.appendSwitch('disable-accelerated-video-decode')
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames')

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.bonkeymusic.app')

  // We handle shortcuts manually inside createWindow to prevent reload conflicts and allow F12 in production
  app.on('browser-window-created', (_, _window) => {
    // Custom handling inside createWindow instead of optimizer.watchWindowShortcuts
  })

  // ─── Register media:// protocol handler ──────────────────────────
  protocol.handle('media', (request) => {
    try {
      // Decode the URL directly after stripping the protocol prefix
      // This prevents ERR_INVALID_URL when parsing Windows paths like media://C:\Users\...
      let filePath = request.url
      if (filePath.startsWith('media:///')) {
        filePath = filePath.slice('media:///'.length)
      } else if (filePath.startsWith('media://')) {
        filePath = filePath.slice('media://'.length)
      }
      filePath = decodeURIComponent(filePath)

      // Strip leading slash on Windows if present (e.g., /c:/Users... -> c:/Users... or /c/Users... -> c/Users...)
      if (filePath.startsWith('/') && /^\/[a-zA-Z](:?)\//.test(filePath)) {
        filePath = filePath.slice(1)
      }

      // Restore colon for Windows drive letters if it was stripped by URL normalization (e.g., c/Users/... -> c:/Users/...)
      if (/^[a-zA-Z]\//.test(filePath)) {
        filePath = filePath[0] + ':' + filePath.slice(1)
      }

      // On Unix, ensure the path has a leading slash
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
        const chunkSize = end - start + 1

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
      const relativePaths = await readdir(folderPath, { recursive: true })
      const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.wma']
      const files: string[] = []

      for (const p of relativePaths) {
        const absPath = join(folderPath, p)
        try {
          const stat = statSync(absPath)
          if (stat.isFile() && audioExtensions.some((ext) => p.toLowerCase().endsWith(ext))) {
            files.push(absPath)
          }
        } catch {}
      }

      const scannedTracks: TrackMeta[] = []
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

          scannedTracks.push({
            filePath: file,
            title:
              common.title ||
              file
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, '') ||
              'Unknown',
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

      // Merge new scanned tracks with the current library
      const currentLibrary = await loadLibrary()
      const newTracks: TrackMeta[] = []

      for (const track of scannedTracks) {
        if (!currentLibrary.some((t) => t.filePath === track.filePath)) {
          newTracks.push(track)
        }
      }

      const updatedTracks = [...currentLibrary, ...newTracks]

      // Sort by artist, then album, then track number
      updatedTracks.sort((a, b) => {
        const artistCmp = a.artist.localeCompare(b.artist)
        if (artistCmp !== 0) return artistCmp
        const albumCmp = a.album.localeCompare(b.album)
        if (albumCmp !== 0) return albumCmp
        return (a.trackNumber || 0) - (b.trackNumber || 0)
      })

      await saveLibrary(updatedTracks)

      // Save folder paths in settings
      const settings = await loadSettings()
      let folders: string[] = Array.isArray(settings.libraryFolders)
        ? (settings.libraryFolders as string[])
        : []

      // Fallback transition
      if (settings.libraryFolder && typeof settings.libraryFolder === 'string' && !folders.includes(settings.libraryFolder)) {
        folders.push(settings.libraryFolder)
      }

      if (!folders.includes(folderPath)) {
        folders.push(folderPath)
      }

      settings.libraryFolders = folders
      settings.libraryFolder = folderPath // last scanned
      await saveSettings(settings)

      return updatedTracks
    } catch (error) {
      console.error('Scan error:', error)
      return []
    }
  })

  // ─── IPC: Remove Library Folder ──────────────────────────────────
  ipcMain.handle('remove-library-folder', async (_event, folderPath: string) => {
    try {
      const settings = await loadSettings()
      let folders: string[] = Array.isArray(settings.libraryFolders)
        ? (settings.libraryFolders as string[])
        : []
      folders = folders.filter((f) => f !== folderPath)
      settings.libraryFolders = folders
      if (settings.libraryFolder === folderPath) {
        settings.libraryFolder = folders[0] || null
      }
      await saveSettings(settings)

      const currentLibrary = await loadLibrary()
      const path = await import('path')
      const normFolder = path.normalize(folderPath).toLowerCase()

      const updatedTracks = currentLibrary.filter((track) => {
        const normTrack = path.normalize(track.filePath).toLowerCase()
        return !normTrack.startsWith(normFolder)
      })

      await saveLibrary(updatedTracks)
      return updatedTracks
    } catch (error) {
      console.error('Remove folder error:', error)
      return []
    }
  })

  // ─── IPC: Load Library ───────────────────────────────────────────
  ipcMain.handle('load-library', async () => {
    return await loadLibrary()
  })

  // ─── IPC: Reset Library ──────────────────────────────────────────
  ipcMain.handle('reset-library', async () => {
    try {
      await saveLibrary([])
      const settings = await loadSettings()
      delete settings.lastPlayedTrack
      delete settings.lastPlayedTime
      delete settings.libraryFolder
      delete settings.libraryFolders
      await saveSettings(settings)
      return []
    } catch (error) {
      console.error('Reset library error:', error)
      return []
    }
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
  // ─── IPC: Get Lyrics ─────────────────────────────────────────────
  ipcMain.handle('get-lyrics', async (_event, audioFilePath: string) => {
    console.log('[Main IPC] get-lyrics requested for:', audioFilePath)
    try {
      // Replace audio extension with .lrc or .txt (check multiple extension casings)
      const baseName = audioFilePath.replace(/\.[^.]+$/, '')
      const possibleExtensions = ['.lrc', '.txt', '.LRC', '.TXT', '.lyrics']

      for (const ext of possibleExtensions) {
        const lyricPath = baseName + ext
        if (existsSync(lyricPath)) {
          return await readFile(lyricPath, 'utf-8')
        }
      }

      // Fallback: Check for embedded lyrics in audio metadata
      try {
        const { parseFile } = await import('music-metadata')
        const metadata = await parseFile(audioFilePath)
        if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
          const lyricItem = metadata.common.lyrics[0]
          if (typeof lyricItem === 'string') {
            return lyricItem
          } else if (lyricItem && typeof lyricItem === 'object' && 'text' in lyricItem) {
            return (lyricItem as { text: string }).text
          }
        }
      } catch {
        // Fallback failed silently, return null
      }

      return null
    } catch (err) {
      console.warn('Failed to load lyrics file:', err)
      return null
    }
  })
  // ─── IPC: Select Files ───────────────────────────────────────────
  ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'wma'] }
      ],
      title: 'Select Audio Files to Import'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths
  })

  // ─── IPC: Select Image ───────────────────────────────────────────
  ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }
      ],
      title: 'Select Playlist Cover Image'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    
    const filePath = result.filePaths[0]
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    }
    
    const ext = path.extname(filePath).toLowerCase()
    const mime = mimeTypes[ext] || 'image/jpeg'
    const buffer = await fs.readFile(filePath)
    const base64 = buffer.toString('base64')
    return `data:${mime};base64,${base64}`
  })

  // ─── IPC: Import Files ───────────────────────────────────────────
  ipcMain.handle('import-files', async (_event, filePaths: string[]) => {
    try {
      const { parseFile } = await import('music-metadata')
      const currentTracks = await loadLibrary()

      const newTracks: TrackMeta[] = []
      for (const file of filePaths) {
        if (currentTracks.some((t) => t.filePath === file)) continue
        try {
          const metadata = await parseFile(file)
          const common = metadata.common
          const format = metadata.format

          let coverArt: string | null = null
          if (common.picture && common.picture.length > 0) {
            const pic = common.picture[0]
            const base64 = Buffer.from(pic.data).toString('base64')
            coverArt = `data:${pic.format};base64,${base64}`
          }

          newTracks.push({
            filePath: file,
            title:
              common.title ||
              file
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, '') ||
              'Unknown',
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
        } catch (err) {
          console.warn(`Could not parse metadata for: ${file}`, err)
        }
      }

      if (newTracks.length > 0) {
        const updatedTracks = [...currentTracks, ...newTracks]
        updatedTracks.sort((a, b) => {
          const artistCmp = a.artist.localeCompare(b.artist)
          if (artistCmp !== 0) return artistCmp
          const albumCmp = a.album.localeCompare(b.album)
          if (albumCmp !== 0) return albumCmp
          return (a.trackNumber || 0) - (b.trackNumber || 0)
        })
        await saveLibrary(updatedTracks)
        return updatedTracks
      }
      return currentTracks
    } catch (error) {
      console.error('Import error:', error)
      return []
    }
  })

  // ─── IPC: Export Playlist ──────────────────────────────────────────
  ipcMain.handle('export-playlist', async (_event, playlistName: string, filePaths: string[]) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Destination Folder to Export Playlist'
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, reason: 'canceled' }
      }
      
      const targetDir = result.filePaths[0]
      // Replace unsafe characters in playlist name for directory safety
      const safePlaylistName = playlistName.replace(/[\\/:*?"<>|]/g, '_')
      const exportFolder = join(targetDir, safePlaylistName)
      
      if (!existsSync(exportFolder)) {
        await mkdir(exportFolder, { recursive: true })
      }
      
      let copiedCount = 0
      for (const file of filePaths) {
        if (existsSync(file)) {
          const destFile = join(exportFolder, basename(file))
          await copyFile(file, destFile)
          copiedCount++
        }
      }
      
      return { success: true, count: copiedCount, destination: exportFolder }
    } catch (err: any) {
      console.error('Export playlist error:', err)
      return { success: false, reason: err.message || 'Unknown error' }
    }
  })

  createWindow()
  createTray()

  // Register global media shortcuts for IEM/TWS headset controls and media keyboards
  const registerShortcut = (keys: string[], action: string) => {
    keys.forEach((key) => {
      try {
        globalShortcut.register(key, () => {
          if (mainWindow) mainWindow.webContents.send('media-control', action)
        })
      } catch (e) {
        // Silently catch registration errors if OS has blocked/hijacked a specific key
      }
    })
  }

  registerShortcut(['MediaPlayPause', 'XF86AudioPlay'], 'play-pause')
  registerShortcut(['MediaNextTrack', 'XF86AudioNext'], 'next')
  registerShortcut(['MediaPreviousTrack', 'XF86AudioPrev'], 'prev')

  // ─── Discord Rich Presence ──────────────────────────────────────────
  const clientId = '1519697840094580757' // Reverted to the exact ID copied by the user
  let isRpcConnected = false
  let lastConnectAttempt = 0

  function connectDiscord() {
    if (isRpcConnected) return
    const now = Date.now()
    // Throttle connection attempts to once every 15 seconds to avoid spamming the console
    if (now - lastConnectAttempt < 15000) return
    lastConnectAttempt = now

    try {
      rpcClient = new DiscordRPC.Client({ transport: 'ipc' })
      
      rpcClient.on('ready', () => {
        console.log('[Discord RPC] Connected to Discord successfully!')
        isRpcConnected = true
      })

      // Support Linux Snap and Flatpak Discord installations by temporarily overriding XDG_RUNTIME_DIR
      const oldXdg = process.env.XDG_RUNTIME_DIR
      const uid = process.getuid ? process.getuid() : 1000
      const snapDir = `/run/user/${uid}/snap.discord`
      const flatpakDir = `/run/user/${uid}/.flatpak/com.discordapp.Discord/xdg-run`

      if (process.platform === 'linux') {
        if (existsSync(join(snapDir, 'discord-ipc-0'))) {
          process.env.XDG_RUNTIME_DIR = snapDir
        } else if (existsSync(join(flatpakDir, 'discord-ipc-0'))) {
          process.env.XDG_RUNTIME_DIR = flatpakDir
        }
      }

      rpcClient.login({ clientId }).catch((err) => {
        console.warn('[Discord RPC] Connection failed:', err.message)
        isRpcConnected = false
      }).finally(() => {
        // Restore original environment variable
        if (process.platform === 'linux') {
          if (oldXdg) {
            process.env.XDG_RUNTIME_DIR = oldXdg
          } else {
            delete process.env.XDG_RUNTIME_DIR
          }
        }
      })
    } catch (e) {
      console.warn('[Discord RPC] Library initialization failed:', e)
    }
  }

  // Attempt initial connection
  connectDiscord()

  ipcMain.on('update-discord-status', (_event, songData: any) => {
    console.log('[Discord RPC] update-discord-status triggered. isRpcConnected:', isRpcConnected, 'songData:', songData)
    if (!rpcClient) {
      console.log('[Discord RPC] No rpcClient initialized')
      return
    }

    if (!isRpcConnected) {
      console.log('[Discord RPC] Client not connected. Attempting connection...')
      connectDiscord()
      return
    }

    try {
      // Only clear activity when there's truly nothing to show
      if (!songData || !songData.title) {
        console.log('[Discord RPC] Clearing activity (no track)')
        rpcClient.clearActivity().catch(() => {})
        return
      }

      if (songData.isPlaying) {
        // Playing: show track with elapsed timestamp
        const startTimestamp = Date.now() - (songData.currentTime * 1000)

        const activityPayload = {
          details: songData.title,
          state: `by ${songData.artist}`,
          startTimestamp: Math.floor(startTimestamp / 1000),
          largeImageKey: 'logo_app',
          largeImageText: 'Bonkey Music',
          smallImageKey: 'play_icon',
          smallImageText: 'Playing',
          instance: false
        }

        console.log('[Discord RPC] Setting activity (playing):', activityPayload)
        rpcClient.setActivity(activityPayload)
          .then(() => {
            console.log('[Discord RPC] setActivity resolved successfully')
          })
          .catch((err) => {
            console.warn('[Discord RPC] Failed to set activity:', err)
          })
      } else {
        // Paused: show track info with "Paused" state, no timestamp
        const activityPayload = {
          details: songData.title,
          state: `by ${songData.artist} • Paused`,
          largeImageKey: 'logo_app',
          largeImageText: 'Bonkey Music',
          smallImageKey: 'pause_icon',
          smallImageText: 'Paused',
          instance: false
        }

        console.log('[Discord RPC] Setting activity (paused):', activityPayload)
        rpcClient.setActivity(activityPayload)
          .then(() => {
            console.log('[Discord RPC] setActivity (paused) resolved successfully')
          })
          .catch((err) => {
            console.warn('[Discord RPC] Failed to set paused activity:', err)
          })
      }
    } catch (err) {
      console.error('[Discord RPC] Error in activity update:', err)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

let rpcClient: any = null

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (rpcClient) {
    try {
      rpcClient.destroy().catch(() => {})
    } catch {}
  }
})
