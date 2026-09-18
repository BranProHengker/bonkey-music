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
    ipcRenderer.invoke('open-file-location', filePath)
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
