import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function setupTauriBridge() {
  if (typeof window === 'undefined') return

  // If already in electron preload, do nothing
  if (window.api && !('__isTauri' in window.api)) return

  const api: any = {
    __isTauri: true,

    // Library & Settings
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

    // Studio & Scraper
    studio: {
      searchTracks: (query: string, source?: string) =>
        invoke('studio_search_tracks', { query, source }),

      searchLrc: (query: string) =>
        invoke('studio_search_lrc', { query }),

      romajiTransliterate: (lyrics: string) =>
        invoke('studio_romaji_transliterate', { lyrics }),

      saveLrc: (data: { audioFilePath?: string; title: string; artist: string; lrcContent: string }) =>
        invoke('studio_save_lrc', { data }),

      getTrackFormats: (track: any) =>
        invoke('studio_get_track_formats', { track }),

      downloadTrack: (track: any, customDir?: string, formatOption?: any) =>
        invoke('studio_download_track', { track, customDir, formatOption }),

      inspectLossless: (filePath: string) =>
        invoke('studio_inspect_lossless', { filePath }),

      inspectMultiple: (filePaths: string[]) =>
        invoke('studio_inspect_multiple', { filePaths }),

      selectFile: () =>
        invoke('studio_select_file'),

      selectMultipleFiles: () =>
        invoke('studio_select_multiple_files'),

      selectFolderToInspect: () =>
        invoke('studio_select_folder_to_inspect'),

      onDownloadProgress: (callback: (progress: any) => void) => {
        let active = true
        let unlistenFn: (() => void) | null = null

        listen('studio:download-progress', (event) => {
          if (active) {
            callback(event.payload)
          }
        }).then((unlisten) => {
          if (active) {
            unlistenFn = unlisten
          } else {
            unlisten()
          }
        })

        return () => {
          active = false
          if (unlistenFn) {
            unlistenFn()
          }
        }
      }
    }
  }

  window.api = api
}
