import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import {
  Play,
  SpeakerHigh,
  Heart,
  MusicNotes,
  Plus,
  DotsThree,
  Queue,
  ListPlus,
  FolderPlus,
  FolderOpen,
  Info,
  Link,
  Trash,
  CaretRight,
  X,
  ListBullets,
  List,
  GridFour
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

function formatDuration(secs: number): string {
  if (isNaN(secs) || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

type TrackViewMode = 'detailed' | 'compact' | 'grid'

interface TrackListProps {
  tracks: TrackMeta[]
  onPlayTrack: (track: TrackMeta) => void
  currentTrack: TrackMeta | null
  isPlaying: boolean
  favorites: string[]
  onToggleFavorite: (filePath: string) => void
  onAddToQueue?: (track: TrackMeta) => void
  sortField?: 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt' | null
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt') => void
  playlists?: string[]
  onAddToPlaylist?: (playlistName: string, track: TrackMeta) => void
  onAddToNewPlaylist?: (track: TrackMeta) => void
  onRemoveFromPlaylist?: (track: TrackMeta) => void
  currentPlaylistName?: string | null
  onReorderTracks?: (startIndex: number, endIndex: number) => void
}

interface TrackRowProps {
  track: TrackMeta
  index: number
  isCurrent: boolean
  isPlaying: boolean
  isLiked: boolean
  canReorder: boolean
  viewMode: 'detailed' | 'compact'
  onPlayTrack: (track: TrackMeta) => void
  onToggleFavorite: (filePath: string) => void
  onAddToQueue?: (track: TrackMeta) => void
  onReorderTracks?: (startIndex: number, endIndex: number) => void
  onOpenMenu: (rect: DOMRect, track: TrackMeta) => void
  onContextMenu: (e: React.MouseEvent, track: TrackMeta) => void
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  isLiked,
  canReorder,
  viewMode,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onReorderTracks,
  onOpenMenu,
  onContextMenu
}: TrackRowProps) {
  return (
    <div
      className={`track-row ${viewMode === 'detailed' ? 'detailed-row' : 'compact-row'} ${isCurrent ? 'playing' : ''}`}
      draggable={canReorder}
      onDragStart={(e) => {
        if (canReorder) {
          e.dataTransfer.setData('text/plain', index.toString())
          e.currentTarget.classList.add('dragging')
        }
      }}
      onDragEnd={(e) => {
        if (canReorder) {
          e.currentTarget.classList.remove('dragging')
        }
      }}
      onDragOver={(e) => {
        if (canReorder) {
          e.preventDefault()
          e.currentTarget.classList.add('drag-over')
        }
      }}
      onDragLeave={(e) => {
        if (canReorder) {
          e.currentTarget.classList.remove('drag-over')
        }
      }}
      onDrop={(e) => {
        if (canReorder && onReorderTracks) {
          e.preventDefault()
          e.currentTarget.classList.remove('drag-over')
          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
          if (!isNaN(fromIndex) && fromIndex !== index) {
            onReorderTracks(fromIndex, index)
          }
        }
      }}
      onDoubleClick={() => onPlayTrack(track)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="track-number" style={{ display: 'flex', alignItems: 'center' }}>
        {isCurrent ? (
          isPlaying ? (
            <SpeakerHigh size={16} weight="light" color="var(--accent)" />
          ) : (
            <Play size={16} weight="light" color="var(--accent)" />
          )
        ) : (
          <>
            <span className="track-number-value">{track.trackNumber || index + 1}</span>
            <button className="track-row-play-icon" onClick={() => onPlayTrack(track)}>
              <Play size={14} weight="fill" />
            </button>
          </>
        )}
      </div>

      <div className="track-info-col">
        {viewMode === 'detailed' ? (
          <div className="detailed-art-box">
            {track.coverArt ? (
              <img src={track.coverArt} alt="Cover Art" />
            ) : (
              <MusicNotes size={20} weight="light" />
            )}
            {isCurrent && isPlaying && (
              <div className="track-equalizer-overlay">
                <span className="equalizer-bar bar-1" />
                <span className="equalizer-bar bar-2" />
                <span className="equalizer-bar bar-3" />
              </div>
            )}
          </div>
        ) : (
          <div className="track-thumbnail">
            {track.coverArt ? (
              <img src={track.coverArt} alt="Cover Art" />
            ) : (
              <MusicNotes size={16} weight="light" />
            )}
          </div>
        )}
        <div className="track-title-container">
          <span className="track-title">{track.title}</span>
          {viewMode === 'detailed' && track.lossless && (
            <span className="spec-badge-inline">LOSSLESS</span>
          )}
        </div>
      </div>

      <div className="track-artist-col">{track.artist}</div>

      <div className="track-album">{track.album}</div>

      <div className="track-genre">{track.genre || '-'}</div>

      <div className="track-duration" style={{ textAlign: 'right' }}>
        {formatDuration(track.duration)}
      </div>

      <div style={{ justifySelf: 'center', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {onAddToQueue && (
          <button
            className="btn-track-add-queue"
            title="Add to Queue"
            onClick={(e) => {
              e.stopPropagation()
              onAddToQueue(track)
            }}
          >
            <Plus size={16} weight="light" />
          </button>
        )}
        <button
          className={`btn-track-favorite ${isLiked ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(track.filePath)
          }}
        >
          <Heart size={16} weight={isLiked ? 'fill' : 'light'} />
        </button>

        <div className="track-options-container" style={{ position: 'relative' }}>
          <button
            className="btn-track-options"
            title="More Options"
            onClick={(e) => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              onOpenMenu(rect, track)
            }}
          >
            <DotsThree size={18} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
})

interface TrackGridCardProps {
  track: TrackMeta
  isCurrent: boolean
  isPlaying: boolean
  isLiked: boolean
  onPlayTrack: (track: TrackMeta) => void
  onToggleFavorite: (filePath: string) => void
  onOpenMenu: (rect: DOMRect, track: TrackMeta) => void
  onContextMenu: (e: React.MouseEvent, track: TrackMeta) => void
}

const TrackGridCard = memo(function TrackGridCard({
  track,
  isCurrent,
  isPlaying,
  isLiked,
  onPlayTrack,
  onToggleFavorite,
  onOpenMenu,
  onContextMenu
}: TrackGridCardProps) {
  return (
    <div
      className={`track-grid-card ${isCurrent ? 'playing' : ''}`}
      onDoubleClick={() => onPlayTrack(track)}
      onContextMenu={(e) => onContextMenu(e, track)}
    >
      <div className="grid-card-art">
        {track.coverArt ? (
          <img src={track.coverArt} alt={track.title} />
        ) : (
          <div className="grid-card-placeholder">
            <MusicNotes size={42} weight="light" />
          </div>
        )}

        <button
          type="button"
          className="grid-card-play-btn"
          onClick={(e) => {
            e.stopPropagation()
            onPlayTrack(track)
          }}
          title={isCurrent && isPlaying ? 'Pause' : 'Play'}
        >
          {isCurrent && isPlaying ? (
            <SpeakerHigh size={20} weight="bold" />
          ) : (
            <Play size={20} weight="fill" style={{ marginLeft: '2px' }} />
          )}
        </button>

        <button
          type="button"
          className={`grid-card-heart-btn ${isLiked ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(track.filePath)
          }}
          title={isLiked ? 'Remove Favorite' : 'Favorite'}
        >
          <Heart size={15} weight={isLiked ? 'fill' : 'bold'} />
        </button>

        <button
          type="button"
          className="grid-card-options-btn"
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            onOpenMenu(rect, track)
          }}
          title="More Options"
        >
          <DotsThree size={18} weight="bold" />
        </button>

        {isCurrent && isPlaying ? (
          <div className="grid-card-eq-pill">
            <span className="equalizer-bar bar-1" />
            <span className="equalizer-bar bar-2" />
            <span className="equalizer-bar bar-3" />
          </div>
        ) : (
          <span className="grid-card-duration-badge">
            {formatDuration(track.duration)}
          </span>
        )}
      </div>

      <div className="grid-card-meta">
        <div className="grid-card-title-row">
          <span className="grid-card-title" title={track.title}>{track.title}</span>
          {track.lossless && <span className="spec-badge-inline mini">FLAC</span>}
        </div>
        <span className="grid-card-artist" title={track.artist}>{track.artist || 'Unknown Artist'}</span>
      </div>
    </div>
  )
})

function TrackList({
  tracks,
  onPlayTrack,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  onAddToQueue,
  sortField = null,
  sortOrder = 'asc',
  onSort,
  playlists = [],
  onAddToPlaylist,
  onAddToNewPlaylist,
  onRemoveFromPlaylist,
  currentPlaylistName = null,
  onReorderTracks
}: TrackListProps) {
  const [viewMode, setViewMode] = useState<TrackViewMode>(() => {
    try {
      return (localStorage.getItem('bonkey_track_view') as TrackViewMode) || 'detailed'
    } catch {
      return 'detailed'
    }
  })

  const handleChangeView = (mode: TrackViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('bonkey_track_view', mode)
    } catch {}
  }

  const [activeMenu, setActiveMenu] = useState<{
    x: number
    y: number
    track: TrackMeta
  } | null>(null)
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null)
  const [detailsTrack, setDetailsTrack] = useState<TrackMeta | null>(null)

  // Close floating menu on click outside or escape
  useEffect(() => {
    if (!activeMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.track-dropdown-menu')) {
        setActiveMenu(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenu])

  const handleOpenMenu = useCallback((rect: DOMRect, track: TrackMeta) => {
    const menuWidth = 230
    const menuHeight = 310

    let x = rect.right - menuWidth
    if (x < 12) x = 12
    if (x + menuWidth > window.innerWidth - 12) x = window.innerWidth - menuWidth - 12

    let y = rect.bottom + 6
    if (y + menuHeight > window.innerHeight - 16) {
      y = Math.max(12, rect.top - menuHeight - 6)
    }

    setActiveMenu({ x, y, track })
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, track: TrackMeta) => {
    e.preventDefault()
    e.stopPropagation()
    const menuWidth = 230
    const menuHeight = 310

    let x = e.clientX
    if (x + menuWidth > window.innerWidth - 12) {
      x = Math.max(12, window.innerWidth - menuWidth - 12)
    }

    let y = e.clientY
    if (y + menuHeight > window.innerHeight - 16) {
      y = Math.max(12, e.clientY - menuHeight)
    }

    setActiveMenu({ x, y, track })
  }, [])

  const favoritesSet = useMemo(() => new Set(favorites), [favorites])

  const renderSortIndicator = (field: 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt') => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? ' ▲' : ' ▼'
  }

  if (tracks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
        No tracks found in this view.
      </div>
    )
  }

  return (
    <div className="track-list-container">
      {/* Top Toolbar: Track Count Badge & Segmented View Switcher */}
      <div className="track-list-toolbar">
        <div className="track-list-count-badge">
          {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
        </div>

        <div className="track-view-switcher">
          <button
            type="button"
            className={`view-switcher-btn ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => handleChangeView('detailed')}
            title="Detailed List"
          >
            <ListBullets size={15} weight={viewMode === 'detailed' ? 'bold' : 'regular'} />
            <span className="view-btn-label">Detailed</span>
          </button>
          <button
            type="button"
            className={`view-switcher-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => handleChangeView('compact')}
            title="Compact Table"
          >
            <List size={15} weight={viewMode === 'compact' ? 'bold' : 'regular'} />
            <span className="view-btn-label">Compact</span>
          </button>
          <button
            type="button"
            className={`view-switcher-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => handleChangeView('grid')}
            title="Album Grid"
          >
            <GridFour size={15} weight={viewMode === 'grid' ? 'bold' : 'regular'} />
            <span className="view-btn-label">Grid</span>
          </button>
        </div>
      </div>

      {/* Grid Mode */}
      {viewMode === 'grid' ? (
        <div className="track-grid-container">
          {tracks.map((track) => {
            const isCurrent = currentTrack?.filePath === track.filePath
            const isLiked = favoritesSet.has(track.filePath)
            return (
              <TrackGridCard
                key={track.filePath}
                track={track}
                isCurrent={isCurrent}
                isPlaying={isCurrent ? isPlaying : false}
                isLiked={isLiked}
                onPlayTrack={onPlayTrack}
                onToggleFavorite={onToggleFavorite}
                onOpenMenu={handleOpenMenu}
                onContextMenu={handleContextMenu}
              />
            )
          })}
        </div>
      ) : (
        <>
          {/* Table Headers for Detailed & Compact Modes */}
          <div className={`track-list-header ${viewMode === 'detailed' ? 'detailed-header' : 'compact-header'}`}>
            <div>#</div>
            <div role="button" onClick={() => onSort?.('title')}>
              Title{renderSortIndicator('title')}
            </div>
            <div role="button" onClick={() => onSort?.('artist')}>
              Artist{renderSortIndicator('artist')}
            </div>
            <div role="button" onClick={() => onSort?.('album')}>
              Album{renderSortIndicator('album')}
            </div>
            <div role="button" onClick={() => onSort?.('genre')}>
              Genre{renderSortIndicator('genre')}
            </div>
            <div role="button" style={{ textAlign: 'right', justifyContent: 'flex-end' }} onClick={() => onSort?.('duration')}>
              Time{renderSortIndicator('duration')}
            </div>
            <div style={{ justifySelf: 'center' }}>Actions</div>
          </div>

          {tracks.map((track, index) => {
            const isCurrent = currentTrack?.filePath === track.filePath
            const isLiked = favoritesSet.has(track.filePath)

            return (
              <TrackRow
                key={track.filePath}
                track={track}
                index={index}
                isCurrent={isCurrent}
                isPlaying={isCurrent ? isPlaying : false}
                isLiked={isLiked}
                canReorder={!!onReorderTracks}
                viewMode={viewMode}
                onPlayTrack={onPlayTrack}
                onToggleFavorite={onToggleFavorite}
                onAddToQueue={onAddToQueue}
                onReorderTracks={onReorderTracks}
                onOpenMenu={handleOpenMenu}
                onContextMenu={handleContextMenu}
              />
            )
          })}
        </>
      )}

      {/* Apple Music Style Floating Popover (Fixed, Never Clipped) */}
      {activeMenu && (
        <div
          className="track-dropdown-menu track-floating-popover"
          style={{
            position: 'fixed',
            left: `${activeMenu.x}px`,
            top: `${activeMenu.y}px`,
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Section 1: Playback Actions */}
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              onPlayTrack(activeMenu.track)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">Play</span>
            <Play size={16} weight="bold" className="dropdown-item-icon" />
          </button>

          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              if (onAddToQueue) onAddToQueue(activeMenu.track)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">Play Next</span>
            <Queue size={16} weight="bold" className="dropdown-item-icon" />
          </button>

          {onAddToQueue && (
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                onAddToQueue(activeMenu.track)
                setActiveMenu(null)
              }}
            >
              <span className="dropdown-item-label">Add to Queue</span>
              <ListPlus size={16} weight="bold" className="dropdown-item-icon" />
            </button>
          )}

          <div className="dropdown-divider" />

          {/* Section 2: Library & Playlists */}
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              onToggleFavorite(activeMenu.track.filePath)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">
              {favoritesSet.has(activeMenu.track.filePath) ? 'Remove Favorite' : 'Favorite'}
            </span>
            <Heart
              size={16}
              weight={favoritesSet.has(activeMenu.track.filePath) ? 'fill' : 'bold'}
              className={`dropdown-item-icon ${favoritesSet.has(activeMenu.track.filePath) ? 'heart-filled' : ''}`}
            />
          </button>

          {onAddToPlaylist && (
            <div className="dropdown-submenu-trigger">
              <span className="dropdown-item-label">Add to Playlist</span>
              <CaretRight size={14} weight="bold" className="dropdown-item-icon" />
              <div className="dropdown-submenu">
                {onAddToNewPlaylist && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item create-new"
                      onClick={() => {
                        onAddToNewPlaylist(activeMenu.track)
                        setActiveMenu(null)
                      }}
                    >
                      <span className="dropdown-item-label">+ New Playlist</span>
                      <FolderPlus size={15} weight="bold" className="dropdown-item-icon" />
                    </button>
                    {playlists.length > 0 && <div className="dropdown-divider" />}
                  </>
                )}
                {playlists.map((playlist) => (
                  <button
                    key={playlist}
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      onAddToPlaylist(playlist, activeMenu.track)
                      setActiveMenu(null)
                    }}
                  >
                    <span className="dropdown-item-label">{playlist}</span>
                    <FolderPlus size={15} weight="bold" className="dropdown-item-icon" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dropdown-divider" />

          {/* Section 3: Credits & Utility Actions */}
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setDetailsTrack(activeMenu.track)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">View Credits</span>
            <Info size={16} weight="bold" className="dropdown-item-icon" />
          </button>

          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              const info = `${activeMenu.track.title} - ${activeMenu.track.artist || 'Unknown'}`
              navigator.clipboard?.writeText(info)
              setCopiedTrackId(activeMenu.track.filePath)
              setTimeout(() => setCopiedTrackId(null), 2000)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">
              {copiedTrackId === activeMenu.track.filePath ? 'Copied!' : 'Copy Track Info'}
            </span>
            <Link size={16} weight="bold" className="dropdown-item-icon" />
          </button>

          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              window.api.openFileLocation(activeMenu.track.filePath)
              setActiveMenu(null)
            }}
          >
            <span className="dropdown-item-label">Show in File Manager</span>
            <FolderOpen size={16} weight="bold" className="dropdown-item-icon" />
          </button>

          {/* Section 4: Playlist Specific Action */}
          {currentPlaylistName && onRemoveFromPlaylist && (
            <>
              <div className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-item danger"
                onClick={() => {
                  onRemoveFromPlaylist(activeMenu.track)
                  setActiveMenu(null)
                }}
              >
                <span className="dropdown-item-label">Remove from Playlist</span>
                <Trash size={16} weight="bold" className="dropdown-item-icon" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Sleek Track Credits / Audio Details Modal */}
      {detailsTrack && (
        <div className="track-details-backdrop" onClick={() => setDetailsTrack(null)}>
          <div className="track-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="track-details-header">
              <h3>Track Credits & Info</h3>
              <button type="button" className="track-details-close" onClick={() => setDetailsTrack(null)}>
                <X size={16} weight="bold" />
              </button>
            </div>
            <div className="track-details-body">
              <div className="detail-item">
                <span className="detail-label">Title</span>
                <span className="detail-val">{detailsTrack.title}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Artist</span>
                <span className="detail-val">{detailsTrack.artist || 'Unknown Artist'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Album</span>
                <span className="detail-val">{detailsTrack.album || 'Unknown Album'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-val">{formatDuration(detailsTrack.duration)}</span>
              </div>
              {detailsTrack.genre && (
                <div className="detail-item">
                  <span className="detail-label">Genre</span>
                  <span className="detail-val">{detailsTrack.genre}</span>
                </div>
              )}
              {(detailsTrack.lossless || detailsTrack.container || detailsTrack.sampleRate) && (
                <div className="detail-item">
                  <span className="detail-label">Audio Quality</span>
                  <span className="detail-val">
                    {detailsTrack.lossless ? 'Lossless' : detailsTrack.container?.toUpperCase()}
                    {detailsTrack.bitsPerSample && detailsTrack.sampleRate
                      ? ` • ${detailsTrack.bitsPerSample}-bit / ${(detailsTrack.sampleRate / 1000).toFixed(1)} kHz`
                      : ''}
                  </span>
                </div>
              )}
              <div className="detail-item full-path">
                <span className="detail-label">Location</span>
                <span className="detail-val path">{detailsTrack.filePath}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(TrackList)
