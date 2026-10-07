import { TrackMeta } from '../hooks/useAudioEngine'

export interface SongPlayRecord {
  filePath: string
  title: string
  artist: string
  album?: string
  coverArt?: string | null
  count: number
  lastPlayed: number
}

export interface AlbumPlayRecord {
  album: string
  artist: string
  coverArt?: string | null
  count: number
}

export interface DailyActivityPoint {
  day: string // e.g. 'Mon', 'Tue'
  dateStr: string // 'YYYY-MM-DD'
  minutes: number
}

export interface ListeningStats {
  totalPlayTimeSeconds: number
  totalSongsPlayed: number
  songPlayCounts: Record<string, SongPlayRecord>
  albumPlayCounts: Record<string, AlbumPlayRecord>
  dailyListeningMinutes: Record<string, number>
}

const STORAGE_KEY = 'bonkey_listening_stats'

export function getTodayDateStr(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

export function getPast7Days(): DailyActivityPoint[] {
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const result: DailyActivityPoint[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const day = daysOfWeek[d.getDay()]
    result.push({
      day,
      dateStr,
      minutes: 0
    })
  }

  return result
}

export function loadListeningStats(): ListeningStats {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (err) {
    console.error('Failed to parse listening stats:', err)
  }

  return {
    totalPlayTimeSeconds: 0,
    totalSongsPlayed: 0,
    songPlayCounts: {},
    albumPlayCounts: {},
    dailyListeningMinutes: {}
  }
}

export function saveListeningStats(stats: ListeningStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch (err) {
    console.error('Failed to save listening stats:', err)
  }
}

export function recordTrackPlay(track: TrackMeta): void {
  const stats = loadListeningStats()
  const today = getTodayDateStr()

  stats.totalSongsPlayed += 1

  // Update track count
  const existingSong = stats.songPlayCounts[track.filePath]
  if (existingSong) {
    existingSong.count += 1
    existingSong.lastPlayed = Date.now()
    if (!existingSong.coverArt && track.coverArt) existingSong.coverArt = track.coverArt
  } else {
    stats.songPlayCounts[track.filePath] = {
      filePath: track.filePath,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      album: track.album || undefined,
      coverArt: track.coverArt || null,
      count: 1,
      lastPlayed: Date.now()
    }
  }

  // Update album count
  if (track.album) {
    const existingAlbum = stats.albumPlayCounts[track.album]
    if (existingAlbum) {
      existingAlbum.count += 1
      if (!existingAlbum.coverArt && track.coverArt) existingAlbum.coverArt = track.coverArt
    } else {
      stats.albumPlayCounts[track.album] = {
        album: track.album,
        artist: track.artist || 'Unknown Artist',
        coverArt: track.coverArt || null,
        count: 1
      }
    }
  }

  // Update daily activity (add 1 minute base)
  stats.dailyListeningMinutes[today] = (stats.dailyListeningMinutes[today] || 0) + 1

  saveListeningStats(stats)
}

export function recordListeningDuration(seconds: number): void {
  if (seconds <= 0) return
  const stats = loadListeningStats()
  const today = getTodayDateStr()

  stats.totalPlayTimeSeconds += Math.round(seconds)
  const additionalMins = Math.round(seconds / 60)
  if (additionalMins > 0) {
    stats.dailyListeningMinutes[today] = (stats.dailyListeningMinutes[today] || 0) + additionalMins
  }

  saveListeningStats(stats)
}

export function formatListeningTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))}s`
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/**
 * Initializes realistic initial listening metrics from library if user has no listening history yet
 */
export function getHydratedStats(
  _tracks?: TrackMeta[],
  _albums?: { name: string; artist: string; coverArt: string | null }[]
): {
  totalTimeDisplay: string
  totalSongsPlayed: number
  topTracks: SongPlayRecord[]
  topAlbums: AlbumPlayRecord[]
  weeklyActivity: DailyActivityPoint[]
} {
  const stats = loadListeningStats()
  const past7Days = getPast7Days()

  // Fill weekly activity strictly from actual recorded minutes
  past7Days.forEach((p) => {
    p.minutes = stats.dailyListeningMinutes[p.dateStr] || 0
  })

  const topTracks = Object.values(stats.songPlayCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const topAlbums = Object.values(stats.albumPlayCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  return {
    totalTimeDisplay: formatListeningTime(stats.totalPlayTimeSeconds),
    totalSongsPlayed: stats.totalSongsPlayed,
    topTracks,
    topAlbums,
    weeklyActivity: past7Days
  }
}

export function clearListeningStats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('Failed to clear listening stats:', err)
  }
}

