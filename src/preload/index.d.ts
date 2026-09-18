import { ElectronAPI } from '@electron-toolkit/preload'

interface MusicAPI {
  selectFolder: () => Promise<string | null>
  scanFolder: (path: string) => Promise<TrackMeta[]>
  loadLibrary: () => Promise<TrackMeta[]>
  loadSettings: () => Promise<Record<string, unknown>>
  saveSettings: (settings: Record<string, unknown>) => Promise<boolean>
  getCoverArt: (filePath: string) => Promise<string | null>
  getLyrics: (audioFilePath: string) => Promise<string | null>
  selectFiles: () => Promise<string[] | null>
  importFiles: (filePaths: string[]) => Promise<TrackMeta[]>
  updateDiscordStatus: (songData: any) => void
  resetLibrary: () => Promise<TrackMeta[]>
  exportPlaylist: (name: string, filePaths: string[]) => Promise<{ success: boolean; destination?: string; reason?: string }>
  removeLibraryFolder: (path: string) => Promise<TrackMeta[]>
  selectImage: () => Promise<string | null>
  openFileLocation: (filePath: string) => Promise<boolean>
}

interface TrackMeta {
  filePath: string
  title: string
  artist: string
  album: string
  duration: number
  trackNumber: number | null
  year: number | null
  genre: string | null
  coverArt: string | null
  bitrate?: number
  sampleRate?: number
  bitsPerSample?: number
  lossless?: boolean
  container?: string
  addedAt?: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MusicAPI
  }
}
