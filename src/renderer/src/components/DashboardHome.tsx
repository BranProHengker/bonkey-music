import { useMemo, memo } from 'react'
import {
  MagnifyingGlass,
  Play,
  MusicNotes,
  Clock,
  Flame,
  Disc,
  ChartBar,
  TrendUp
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'
import { getHydratedStats } from '../lib/listeningStats'

interface DashboardHomeProps {
  tracks: TrackMeta[]
  albums: { name: string; artist: string; coverArt: string | null }[]
  onPlayTrack: (track: TrackMeta, contextTracks?: TrackMeta[]) => void
  onSelectArtist: (artist: string) => void
  onSelectAlbum: (album: string) => void
  onNavigateToLibrary: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

function DashboardHome({
  tracks,
  albums,
  onPlayTrack,
  onSelectAlbum,
  searchQuery,
  setSearchQuery
}: DashboardHomeProps) {
  // Derive real listening statistics & history
  const stats = useMemo(() => {
    return getHydratedStats(tracks, albums)
  }, [tracks, albums])

  // Max minutes for scaling weekly activity chart bars
  const maxWeeklyMinutes = useMemo(() => {
    const maxVal = Math.max(...stats.weeklyActivity.map((d) => d.minutes), 1)
    return Math.max(maxVal, 60) // at least 60 min ceiling for proportional height
  }, [stats.weeklyActivity])

  // Find track object by filePath for instant playback
  const handlePlaySongRecord = (filePath: string) => {
    const found = tracks.find((t) => t.filePath === filePath)
    if (found) {
      onPlayTrack(found, tracks)
    }
  }

  return (
    <div className="lunio-dashboard-container">
      {/* ─── Top Header Ribbon ───────────────────────────────────────── */}
      <header className="lunio-header">
        <div className="lunio-greeting-wrapper">
          <h1 className="lunio-greeting">Home</h1>
          <p className="lunio-library-stats">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'} • {albums.length} {albums.length === 1 ? 'album' : 'albums'}
          </p>
        </div>

        <div className="lunio-header-actions">
          {/* Pill Search Input */}
          <div className="lunio-search-pill">
            <MagnifyingGlass size={18} weight="bold" className="lunio-search-icon" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="lunio-search-input"
            />
          </div>
        </div>
      </header>

      {/* ─── Listening Stats & History Chart Deck ───────────────────── */}
      <section className="stats-history-deck">
        {/* KPI Strip: 4 Metric Cards */}
        <div className="stats-kpi-grid">
          {/* Card 1: Listening Time */}
          <div className="stats-kpi-card">
            <div className="stats-kpi-icon-wrapper time-accent">
              <Clock size={20} weight="bold" />
            </div>
            <div className="stats-kpi-info">
              <span className="stats-kpi-label">Listening Time</span>
              <span className="stats-kpi-value">{stats.totalTimeDisplay}</span>
            </div>
          </div>

          {/* Card 2: Songs Played */}
          <div className="stats-kpi-card">
            <div className="stats-kpi-icon-wrapper play-accent">
              <Play size={18} weight="fill" />
            </div>
            <div className="stats-kpi-info">
              <span className="stats-kpi-label">Songs Played</span>
              <span className="stats-kpi-value">{stats.totalSongsPlayed}</span>
            </div>
          </div>

          {/* Card 3: Top Track */}
          <div className="stats-kpi-card">
            <div className="stats-kpi-icon-wrapper hot-accent">
              <Flame size={20} weight="fill" />
            </div>
            <div className="stats-kpi-info">
              <span className="stats-kpi-label">Most Played Song</span>
              <span className="stats-kpi-value truncate" title={stats.topTracks[0]?.title || 'No history'}>
                {stats.topTracks[0]?.title || '—'}
              </span>
              {stats.topTracks[0] && (
                <span className="stats-kpi-subtext">
                  {stats.topTracks[0].count} plays • {stats.topTracks[0].artist}
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Top Album */}
          <div className="stats-kpi-card">
            <div className="stats-kpi-icon-wrapper album-accent">
              <Disc size={20} weight="bold" />
            </div>
            <div className="stats-kpi-info">
              <span className="stats-kpi-label">Most Played Album</span>
              <span className="stats-kpi-value truncate" title={stats.topAlbums[0]?.album || 'No history'}>
                {stats.topAlbums[0]?.album || '—'}
              </span>
              {stats.topAlbums[0] && (
                <span className="stats-kpi-subtext">
                  {stats.topAlbums[0].count} plays • {stats.topAlbums[0].artist}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Split Section: Weekly Activity Bar Chart + Top Played Songs */}
        <div className="stats-chart-split">
          {/* Left: Weekly Listening Activity Chart */}
          <div className="stats-chart-card">
            <div className="stats-card-header">
              <div className="stats-card-title-group">
                <ChartBar size={18} weight="bold" className="stats-title-icon" />
                <h3 className="stats-card-title">Listening Activity</h3>
              </div>
              <span className="stats-card-tag">Past 7 Days</span>
            </div>

            <div className="activity-chart-wrapper">
              <div className="activity-bars-container">
                {stats.weeklyActivity.map((item, idx) => {
                  const heightPercent = Math.max(12, Math.min(100, (item.minutes / maxWeeklyMinutes) * 100))
                  const isPeak = item.minutes === Math.max(...stats.weeklyActivity.map((d) => d.minutes)) && item.minutes > 0

                  return (
                    <div key={`${item.dateStr}-${idx}`} className="activity-bar-column">
                      <div className="activity-bar-tooltip">
                        {item.minutes}m
                      </div>
                      <div className="activity-bar-track">
                        <div
                          className={`activity-bar-fill ${isPeak ? 'peak' : ''}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className={`activity-day-label ${isPeak ? 'peak-label' : ''}`}>
                        {item.day}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Most Played Songs */}
          <div className="stats-top-songs-card">
            <div className="stats-card-header">
              <div className="stats-card-title-group">
                <TrendUp size={18} weight="bold" className="stats-title-icon" />
                <h3 className="stats-card-title">Frequently Played Songs</h3>
              </div>
            </div>

            <div className="top-songs-list">
              {stats.topTracks.length === 0 ? (
                <div className="stats-empty-hint">Start listening to build your top songs list</div>
              ) : (
                stats.topTracks.map((song, idx) => (
                  <div
                    key={song.filePath}
                    className="top-song-row"
                    onClick={() => handlePlaySongRecord(song.filePath)}
                    title={`Play ${song.title}`}
                  >
                    <span className="top-song-rank">0{idx + 1}</span>
                    <div className="top-song-thumb">
                      {song.coverArt ? (
                        <img src={song.coverArt} alt={song.title} loading="lazy" decoding="async" />
                      ) : (
                        <MusicNotes size={16} weight="light" />
                      )}
                      <div className="top-song-play-icon">
                        <Play size={12} weight="fill" />
                      </div>
                    </div>
                    <div className="top-song-meta">
                      <span className="top-song-title" title={song.title}>{song.title}</span>
                      <span className="top-song-artist" title={song.artist}>{song.artist}</span>
                    </div>
                    <span className="top-song-count-badge">
                      {song.count} {song.count === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── All Albums Grid ("Semua Album") ───────────────────────── */}
      <section className="all-albums-section">
        <div className="lunio-section-header">
          <h2 className="all-albums-title">All Albums</h2>
          <span className="all-albums-count-tag">{albums.length} albums</span>
        </div>

        <div className="all-albums-grid">
          {albums.length === 0 ? (
            <div className="lunio-empty-hint">No albums found in your library</div>
          ) : (
            albums.map((album, idx) => (
              <div
                key={`${album.name}-${idx}`}
                className="album-card"
                onClick={() => onSelectAlbum(album.name)}
              >
                <div className="album-card-thumb">
                  {album.coverArt ? (
                    <img src={album.coverArt} alt={album.name} loading="lazy" decoding="async" />
                  ) : (
                    <div className="album-card-placeholder">
                      <MusicNotes size={40} weight="light" />
                    </div>
                  )}
                  <button
                    className="album-card-play-overlay"
                    title={`Play ${album.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAlbum(album.name)
                    }}
                    aria-label={`Play ${album.name}`}
                  >
                    <Play size={20} weight="fill" />
                  </button>
                </div>
                <div className="album-card-info">
                  <h4 className="album-card-name" title={album.name}>
                    {album.name}
                  </h4>
                  <p className="album-card-artist" title={album.artist}>
                    {album.artist}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default memo(DashboardHome)
