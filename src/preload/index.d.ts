import { ElectronAPI } from '@electron-toolkit/preload'

export interface OnlineTrack {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  coverArt: string | null
  releaseYear: number | null
  previewUrl: string | null
}

export interface LrcSearchResult {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental: boolean
  plainLyrics?: string
  syncedLyrics?: string
}

export interface RomajiLineItem {
  time: string
  seconds: number
  original: string
  romaji: string
}

export interface RomajiResponse {
  success: boolean
  isJapanese?: boolean
  message?: string
  romajiLrc?: string
  dualLrc?: string
  lines?: RomajiLineItem[]
}

export interface LosslessInspectionResult {
  filePath: string
  fileName: string
  format: string
  lossless: boolean
  sampleRate: number
  bitsPerSample: number
  bitrate: number
  channels: number
  estimatedCutoffKhz: number
  verdict: 'lossless' | 'good_transcode' | 'low_upscale'
  verdictLabel: string
  spectrumBins: number[]
}

export interface DownloadProgress {
  id: string
  percent: number
  receivedBytes: number
  totalBytes: number
}

export interface StudioAPI {
  searchTracks: (query: string) => Promise<OnlineTrack[]>
  searchLrc: (query: string) => Promise<LrcSearchResult[]>
  romajiTransliterate: (lyrics: string) => Promise<RomajiResponse>
  saveLrc: (data: { audioFilePath?: string; title: string; artist: string; lrcContent: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  downloadTrack: (track: OnlineTrack, customDir?: string) => Promise<{ success: boolean; filePath?: string; lrcPath?: string; error?: string }>
  inspectLossless: (filePath: string) => Promise<LosslessInspectionResult | null>
  selectFile: () => Promise<string | null>
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
}

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
  studio: StudioAPI
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
