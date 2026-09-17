import { useState, useEffect } from 'react'
import { Heart, MusicNotes, Disc, Play, Pause, CaretRight, Headphones } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'
import { useAudioEngine } from '../hooks/useAudioEngine'

interface AlbumGroup {
  name: string
  artist: string
  coverArt: string | null
  tracks: TrackMeta[]
}

interface PlaylistGridProps {
  albums: AlbumGroup[]
  favoritesCount: number
  totalTracksCount: number
  totalArtistsCount: number
  onSelectAlbum: (albumName: string | null) => void
  onSelectFavorites: () => void
  onSelectAllSongs: () => void
}

export default function PlaylistGrid({
  albums,
  favoritesCount,
  totalTracksCount,
  totalArtistsCount,
  onSelectAlbum,
  onSelectFavorites,
  onSelectAllSongs
}: PlaylistGridProps) {
  const { currentTrack, isPlaying, togglePlay, playTrack } = useAudioEngine()
  const [featuredAlbum, setFeaturedAlbum] = useState<AlbumGroup | null>(null)

  // Pick a stable featured album once when albums load
  useEffect(() => {
    if (albums.length > 0 && !featuredAlbum) {
      const randomIndex = Math.floor(Math.random() * albums.length)
      setFeaturedAlbum(albums[randomIndex])
    }
  }, [albums, featuredAlbum])

  // Active spotlight item: currently playing track or featured album
  const spotlightItem = currentTrack
    ? {
        type: 'playing' as const,
        title: currentTrack.title,
        subtitle: currentTrack.artist,
        extra: currentTrack.album || 'Single',
        coverArt: currentTrack.coverArt,
        onAction: togglePlay
      }
    : featuredAlbum
      ? {
          type: 'featured' as const,
          title: featuredAlbum.name,
          subtitle: featuredAlbum.artist,
          extra: `${featuredAlbum.tracks.length} tracks`,
          coverArt: featuredAlbum.coverArt,
          onAction: () => {
            if (featuredAlbum.tracks.length > 0) {
              playTrack(featuredAlbum.tracks[0], featuredAlbum.tracks)
            }
          }
        }
      : null

  return (
    <div className="library-explorer-container">
      {/* ─── Hero Spotlight Section ─── */}
      {spotlightItem && (
        <div className="library-spotlight-card">
          <div className="spotlight-cover-container">
            {spotlightItem.coverArt ? (
              <img src={spotlightItem.coverArt} alt={spotlightItem.title} className="spotlight-cover" />
            ) : (
              <div className="spotlight-cover-placeholder">
                <Disc size={44} weight="light" />
              </div>
            )}
            <button
              className="spotlight-play-btn"
              onClick={spotlightItem.onAction}
              title={isPlaying && spotlightItem.type === 'playing' ? 'Pause' : 'Play'}
            >
              {isPlaying && spotlightItem.type === 'playing' ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </button>
          </div>

          <div className="spotlight-info">
            <span className="spotlight-badge">
              {spotlightItem.type === 'playing' ? 'Now Playing' : 'Spotlight Album'}
            </span>
            <h1 className="spotlight-title">{spotlightItem.title}</h1>
            <p className="spotlight-subtitle">{spotlightItem.subtitle}</p>
            <p className="spotlight-extra">{spotlightItem.extra}</p>

            <div className="spotlight-actions">
              <button
                className="btn-spotlight-primary"
                onClick={
                  spotlightItem.type === 'featured' && featuredAlbum
                    ? () => onSelectAlbum(featuredAlbum.name)
                    : spotlightItem.onAction
                }
              >
                <span>
                  {spotlightItem.type === 'featured' ? 'View Album' : isPlaying ? 'Pause' : 'Resume'}
                </span>
                <CaretRight size={14} weight="bold" />
              </button>

              <button className="btn-spotlight-secondary" onClick={onSelectFavorites}>
                <Heart size={16} weight={favoritesCount > 0 ? 'fill' : 'regular'} color={favoritesCount > 0 ? 'var(--color-favorite)' : 'var(--text-tertiary)'} />
                <span>Liked Songs ({favoritesCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Hardware-Inspired Audio Metrics Bar ─── */}
      <div className="library-metrics-bar">
        <div className="metrics-group">
          <div className="metric-item">
            <Headphones size={15} weight="light" className="metric-icon" />
            <span className="metric-label">Tracks</span>
            <span className="metric-val">{totalTracksCount}</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-label">Artists</span>
            <span className="metric-val">{totalArtistsCount}</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <Disc size={15} weight="light" className="metric-icon" />
            <span className="metric-label">Albums</span>
            <span className="metric-val">{albums.length}</span>
          </div>
        </div>

        <button className="metrics-browse-btn" onClick={onSelectAllSongs}>
          <span>View All Tracks</span>
          <CaretRight size={13} weight="bold" />
        </button>
      </div>

      {/* ─── Albums Showcase Grid ─── */}
      <div className="albums-section">
        <div className="section-header-row">
          <h2 className="section-heading">Albums</h2>
          <span className="section-count">{albums.length} collections</span>
        </div>

        {albums.length === 0 ? (
          <div className="albums-empty">
            <Disc size={32} weight="light" />
            <p>No albums indexed yet</p>
          </div>
        ) : (
          <div className="albums-grid">
            {albums.map((album) => (
              <div
                key={album.name}
                className="album-card"
                onClick={() => onSelectAlbum(album.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectAlbum(album.name)
                  }
                }}
              >
                <div className="album-artwork-wrap">
                  {album.coverArt ? (
                    <img src={album.coverArt} alt={album.name} className="album-artwork" loading="lazy" />
                  ) : (
                    <div className="album-artwork-placeholder">
                      <MusicNotes size={32} weight="light" />
                    </div>
                  )}
                  <button
                    className="album-hover-play"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (album.tracks.length > 0) {
                        playTrack(album.tracks[0], album.tracks)
                      }
                    }}
                    title={`Play ${album.name}`}
                  >
                    <Play size={18} weight="fill" />
                  </button>
                </div>

                <div className="album-meta">
                  <h3 className="album-title" title={album.name}>
                    {album.name}
                  </h3>
                  <p className="album-artist" title={album.artist}>
                    {album.artist}
                  </p>
                  <span className="album-tracks-count">
                    {album.tracks.length} {album.tracks.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
