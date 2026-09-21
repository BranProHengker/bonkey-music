import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ─── Music App API exposed to renderer ───────────────────────────────
const musicAPI = {
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  scanFolder: (path: string): Promise<unknown[]> => ipcRenderer.invoke('scan-folder', path),
  loadLibrary: (): Promise<unknown[]> => ipcRenderer.invoke('load-library'),
  loadSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: Record<string, unknown>): Promise<boolean> =>
    ipcRenderer.invoke('save-settings', settings),
  getCoverArt: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-cover-art', filePath),
  getLyrics: (audioFilePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-lyrics', audioFilePath),
  selectFiles: (): Promise<string[] | null> => ipcRenderer.invoke('select-files'),
  importFiles: (filePaths: string[]): Promise<unknown[]> => ipcRenderer.invoke('import-files', filePaths),
  updateDiscordStatus: (songData: unknown): void => ipcRenderer.send('update-discord-status', songData),
  resetLibrary: (): Promise<unknown[]> => ipcRenderer.invoke('reset-library'),
  exportPlaylist: (name: string, filePaths: string[]): Promise<any> =>
    ipcRenderer.invoke('export-playlist', name, filePaths),
  removeLibraryFolder: (path: string): Promise<unknown[]> =>
    ipcRenderer.invoke('remove-library-folder', path),
  selectImage: (): Promise<string | null> =>
    ipcRenderer.invoke('select-image'),
  openFileLocation: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('open-file-location', filePath),
  studio: {
    searchTracks: (query: string, source?: string): Promise<any[]> =>
      ipcRenderer.invoke('studio:search-tracks', query, source),
    searchLrc: (query: string): Promise<any[]> =>
      ipcRenderer.invoke('studio:search-lrc', query),
    romajiTransliterate: (lyrics: string): Promise<any> =>
      ipcRenderer.invoke('studio:romaji-transliterate', lyrics),
    saveLrc: (data: { audioFilePath?: string; title: string; artist: string; lrcContent: string }): Promise<any> =>
      ipcRenderer.invoke('studio:save-lrc', data),
    downloadTrack: (track: any, customDir?: string): Promise<any> =>
      ipcRenderer.invoke('studio:download-track', track, customDir),
    inspectLossless: (filePath: string): Promise<any> =>
      ipcRenderer.invoke('studio:inspect-lossless', filePath),
    inspectMultiple: (filePaths: string[]): Promise<any[]> =>
      ipcRenderer.invoke('studio:inspect-multiple', filePaths),
    selectFile: (): Promise<string | null> =>
      ipcRenderer.invoke('studio:select-file'),
    selectMultipleFiles: (): Promise<string[]> =>
      ipcRenderer.invoke('studio:select-multiple-files'),
    selectFolderToInspect: (): Promise<string[]> =>
      ipcRenderer.invoke('studio:select-folder-to-inspect'),
    onDownloadProgress: (callback: (progress: any) => void): (() => void) => {
      const handler = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('studio:download-progress', handler)
      return () => {
        ipcRenderer.removeListener('studio:download-progress', handler)
      }
    }
  }
}

// Use contextBridge to expose APIs securely
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', musicAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = musicAPI
}
