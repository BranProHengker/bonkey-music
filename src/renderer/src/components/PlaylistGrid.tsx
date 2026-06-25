import { useState, useEffect } from 'react'
import { Heart, MusicNotes, Sparkle, Disc, Users, Clock, Play, Pause, ArrowClockwise } from '@phosphor-icons/react'
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
  libraryFolder: string | null
  onScanFolder: () => void
  isScanning: boolean
}

export default function PlaylistGrid({
  albums,
  favoritesCount,
  totalTracksCount,
  totalArtistsCount,
  onSelectAlbum,
  onSelectFavorites,
  onSelectAllSongs,
  libraryFolder,
  onScanFolder,
  isScanning
}: PlaylistGridProps) {
  const { currentTrack, isPlaying, togglePlay } = useAudioEngine()
  const [featuredAlbum, setFeaturedAlbum] = useState<AlbumGroup | null>(null)

  // Select a random featured album once when the albums list is loaded
  useEffect(() => {
    if (albums.length > 0 && !featuredAlbum) {
      const randomIndex = Math.floor(Math.random() * albums.length)
      setFeaturedAlbum(albums[randomIndex])
    }
  }, [albums, featuredAlbum])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 className="section-title">Explore Bonkey Music</h2>
      
      <div className="bento-grid">
        {/* Card 1: Favorites (Large Bento: 2 cols) */}
        <div className="double-bezel-card bento-card-large bento-card-liked" onClick={onSelectFavorites}>
          <div className="card-inner">
            <Heart size={140} weight="fill" className="liked-card-bg-icon" />
            <div className="card-gradient-overlay" />
            <div className="card-overlay-content">
              <span className="card-tag">Smart Playlist</span>
              <h3 className="card-title">Liked Songs</h3>
              <p className="card-desc">
                Your curated soundtrack. {favoritesCount} tracks saved to favorites.
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Recently Played / Current Track (Standard Bento) */}
        <div className="double-bezel-card bento-card-recent">
          <div className="card-inner">
            {currentTrack ? (
              <>
                {currentTrack.coverArt && (
                  <img src={currentTrack.coverArt} className="recent-blur-bg" alt="" />
                )}
                <div className="recent-overlay" />
                <div className="recent-content">
                  <span className="card-tag">{isPlaying ? 'Now Playing' : 'Last Played'}</span>
                  
                  <div className="recent-track-info">
                    <div className="recent-cover-wrapper">
                      {currentTrack.coverArt ? (
                        <img src={currentTrack.coverArt} alt={currentTrack.title} className="recent-cover" />
                      ) : (
                        <div className="recent-cover-placeholder">
                          <Disc size={20} weight="light" />
                        </div>
                      )}
                    </div>
                    <div className="recent-details">
                      <span className="recent-title">{currentTrack.title}</span>
                      <span className="recent-artist">{currentTrack.artist}</span>
                    </div>
                  </div>

                  <button className="btn-recent-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="recent-empty" onClick={onSelectAllSongs}>
                <Clock size={28} weight="light" color="var(--text-tertiary)" />
                <span className="recent-empty-title">Ready to Listen</span>
                <span className="recent-empty-desc">Choose any song to start playing</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Library Summary (Tall Bento: 1 col, 2 rows) */}
        <div className="double-bezel-card bento-card-tall bento-card-stats" onClick={onSelectAllSongs}>
          <div className="card-inner" style={{ padding: '24px', justifyContent: 'space-between' }}>
            <div>
              <span className="card-tag">Library Stats</span>
              <h3 className="card-title" style={{ marginTop: '8px', fontSize: '20px' }}>Bonkey Library</h3>
            </div>
            
            <div className="stats-metrik-list">
              <div className="stats-metrik-item">
                <div className="stats-metrik-icon"><MusicNotes size={16} weight="light" /></div>
                <div className="stats-metrik-details">
                  <div className="stats-metrik-value">{totalTracksCount}</div>
                  <div className="stats-metrik-label">Total Tracks</div>
                </div>
              </div>
              <div className="stats-metrik-item">
                <div className="stats-metrik-icon"><Users size={16} weight="light" /></div>
                <div className="stats-metrik-details">
                  <div className="stats-metrik-value">{totalArtistsCount}</div>
                  <div className="stats-metrik-label">Artists Indexed</div>
                </div>
              </div>
              <div className="stats-metrik-item">
                <div className="stats-metrik-icon"><Disc size={16} weight="light" /></div>
                <div className="stats-metrik-details">
                  <div className="stats-metrik-value">{albums.length}</div>
                  <div className="stats-metrik-label">Albums Compiled</div>
                </div>
              </div>
            </div>

            <div className="stats-browse-action">
              <Sparkle size={14} weight="light" />
              <span>Browse All Songs</span>
            </div>
          </div>
        </div>

        {/* Card 4: Featured Album / Random Album (Standard Bento) */}
        {featuredAlbum ? (
          <div className="double-bezel-card bento-card-featured" onClick={() => onSelectAlbum(featuredAlbum.name)}>
            <div className="card-inner">
              {featuredAlbum.coverArt ? (
                <img className="card-hero-image" src={featuredAlbum.coverArt} alt={featuredAlbum.name} />
              ) : (
                <div className="card-hero-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)' }}>
                  <MusicNotes size={48} weight="light" color="var(--text-tertiary)" />
                </div>
              )}
              <div className="card-gradient-overlay" />
              <div className="card-overlay-content">
                <span className="card-tag">Featured Album</span>
                <h3 className="card-title">{featuredAlbum.name}</h3>
                <p className="card-desc">{featuredAlbum.artist}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="double-bezel-card">
            <div className="card-inner" style={{ padding: '20px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
              <MusicNotes size={32} weight="light" color="var(--text-tertiary)" />
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Scan a folder to compile albums</p>
            </div>
          </div>
        )}

        {/* Card 5: Welcome & Quick Sync (Large Bento: 2 cols) */}
        <div className="double-bezel-card bento-card-large bento-card-welcome">
          <div className="card-inner" style={{ padding: '24px', justifyContent: 'space-between' }}>
            <div className="welcome-header">
              <span className="card-tag">System Console</span>
              <h3 className="welcome-title">Bonkey Engine</h3>
              <p className="welcome-desc">
                {libraryFolder ? (
                  <>
                    Connected to library: <code className="folder-code">{libraryFolder.split('/').pop()}</code>
                  </>
                ) : (
                  'No local library folder configured. Head to Settings to set it up.'
                )}
              </p>
            </div>

            <div className="welcome-actions">
              {libraryFolder && (
                <button className="btn-sync-quick" onClick={onScanFolder} disabled={isScanning}>
                  <ArrowClockwise size={14} className={isScanning ? 'animate-spin' : ''} />
                  <span>{isScanning ? 'Syncing...' : 'Sync Folder'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Album row grid (standard card grids) */}
      {albums.length > 1 && (
        <div style={{ marginTop: '20px' }}>
          <h3 className="section-title" style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Albums
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
            {albums.slice(1).map((album) => (
              <div
                key={album.name}
                className="double-bezel-card playlist-card-standard"
                onClick={() => onSelectAlbum(album.name)}
              >
                <div className="art-wrapper">
                  {album.coverArt ? (
                    <img src={album.coverArt} alt={album.name} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)' }}>
                      <MusicNotes size={32} weight="light" color="var(--text-tertiary)" />
                    </div>
                  )}
                </div>
                <div className="playlist-info">
                  <span className="playlist-name">{album.name}</span>
                  <span className="playlist-meta">{album.artist}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
