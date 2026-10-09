import { invoke } from '@tauri-apps/api/core'

export function setupTauriBridge() {
  if (typeof window === 'undefined') return

  let cachedAudioPort = 0
  const fetchAudioPort = () => {
    invoke<number>('get_audio_port')
      .then((port) => {
        if (port && port > 0) {
          cachedAudioPort = port
        }
      })
      .catch((err) => {
        console.warn('[TauriBridge] Failed to get audio port:', err)
      })
  }
  fetchAudioPort()

  const api: any = {
    __isTauri: true,

    getAudioPort: () => invoke('get_audio_port'),
    getAudioUrl: (filePath: string) => {
      if (!filePath) return ''
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath
      }
      if (cachedAudioPort > 0) {
        return `http://127.0.0.1:${cachedAudioPort}/stream?path=${encodeURIComponent(filePath)}`
      }
      fetchAudioPort()
      const normalizedPath = filePath.replace(/\\/g, '/')
      return `media:///${encodeURI(normalizedPath).replace(/\?/g, '%3F').replace(/#/g, '%23')}`
    },

    // Library & Settings
    autoScanAudio: () => invoke('auto_scan_audio'),
    selectFolder: () => invoke('select_folder'),
    scanFolder: (path: string) => invoke('scan_folder', { path }),
    loadLibrary: () => invoke('load_library'),
    loadSettings: () => invoke('load_settings'),
    saveSettings: (settings: Record<string, unknown>) => invoke('save_settings', { settings }),
    getCoverArt: (filePath: string) => invoke('get_cover_art', { filePath }),
    getLyrics: (audioFilePath: string) => invoke('get_lyrics', { audioFilePath }),
    selectFiles: () => invoke('select_files'),
    importFiles: (filePaths: string[]) => invoke('import_files', { filePaths }),
    updateDiscordStatus: (songData: any) => invoke('update_discord_status', { songData }),
    resetLibrary: () => invoke('reset_library'),
    exportPlaylist: (name: string, filePaths: string[]) => invoke('export_playlist', { name, filePaths }),
    removeLibraryFolder: (path: string) => invoke('remove_library_folder', { path }),
    selectImage: () => invoke('select_image'),
    openFileLocation: (filePath: string) => invoke('open_file_location', { filePath }),

    // Studio: Lyrics & Lossless Inspector
    studio: {
      searchLrc: (query: string) =>
        invoke('studio_search_lrc', { query }),

      romajiTransliterate: (lyrics: string) =>
        invoke('studio_romaji_transliterate', { lyrics }),

      saveLrc: (data: { audioFilePath?: string; title: string; artist: string; lrcContent: string }) =>
        invoke('studio_save_lrc', { data }),

      inspectLossless: (filePath: string) =>
        invoke('studio_inspect_lossless', { filePath }),

      inspectMultiple: (filePaths: string[]) =>
        invoke('studio_inspect_multiple', { filePaths }),

      selectFile: () =>
        invoke('studio_select_file'),

      selectMultipleFiles: () =>
        invoke('studio_select_multiple_files'),

      selectFolderToInspect: () =>
        invoke('studio_select_folder_to_inspect')
    }
  }

  window.api = api
}
