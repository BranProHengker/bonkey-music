import { ElectronAPI } from '@electron-toolkit/preload'

interface MusicAPI {
  selectFolder: () => Promise<string | null>
  scanFolder: (path: string) => Promise<TrackMeta[]>
  loadLibrary: () => Promise<TrackMeta[]>
  loadSettings: () => Promise<Record<string, unknown>>
  saveSettings: (settings: Record<string, unknown>) => Promise<boolean>
  getCoverArt: (filePath: string) => Promise<string | null>
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MusicAPI
  }
}
