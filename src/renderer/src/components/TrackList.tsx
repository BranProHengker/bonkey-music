import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { Play, SpeakerHigh, Heart, MusicNotes, Plus, DotsThree } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

function formatDuration(secs: number): string {
  if (isNaN(secs) || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

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
  isMenuOpen: boolean
  playlists?: string[]
  currentPlaylistName?: string | null
  canReorder: boolean
  menuRef: React.RefObject<HTMLDivElement | null>
  onPlayTrack: (track: TrackMeta) => void
  onToggleFavorite: (filePath: string) => void
  onAddToQueue?: (track: TrackMeta) => void
  onAddToPlaylist?: (playlistName: string, track: TrackMeta) => void
  onAddToNewPlaylist?: (track: TrackMeta) => void
  onRemoveFromPlaylist?: (track: TrackMeta) => void
  onReorderTracks?: (startIndex: number, endIndex: number) => void
  onToggleMenu: (trackPath: string) => void
  onCloseMenu: () => void
  onContextMenu: (e: React.MouseEvent, trackPath: string) => void
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  isLiked,
  isMenuOpen,
  playlists = [],
  currentPlaylistName,
  canReorder,
  menuRef,
  onPlayTrack,
  onToggleFavorite,
  onAddToQueue,
  onAddToPlaylist,
  onAddToNewPlaylist,
  onRemoveFromPlaylist,
  onReorderTracks,
  onToggleMenu,
  onCloseMenu,
  onContextMenu
}: TrackRowProps) {
  return (
    <div
      className={`track-row ${isCurrent ? 'playing' : ''}`}
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
      onContextMenu={(e) => onContextMenu(e, track.filePath)}
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
        <div className="track-thumbnail">
          {track.coverArt ? (
            <img src={track.coverArt} alt="Cover Art" />
          ) : (
            <MusicNotes size={16} weight="light" />
          )}
        </div>
        <span className="track-title">{track.title}</span>
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
            className={`btn-track-options ${isMenuOpen ? 'active' : ''}`}
            title="More Options"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu(track.filePath)
            }}
          >
            <DotsThree size={18} weight="bold" />
          </button>

          {isMenuOpen && (
            <div className="track-dropdown-menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              {onAddToQueue && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    onAddToQueue(track)
                    onCloseMenu()
                  }}
                >
                  Add to Queue
                </button>
              )}

              <button
                className="dropdown-item"
                onClick={() => {
                  onToggleFavorite(track.filePath)
                  onCloseMenu()
                }}
              >
                {isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
              </button>

              {onAddToPlaylist && (
                <div className="dropdown-submenu-trigger">
                  <span>Add to Playlist</span>
                  <span className="submenu-arrow">▶</span>
                  <div className="dropdown-submenu">
                    {onAddToNewPlaylist && (
                      <>
                        <button
                          className="dropdown-item"
                          style={{ color: 'var(--accent)', fontWeight: 'bold' }}
                          onClick={() => {
                            onAddToNewPlaylist(track)
                            onCloseMenu()
                          }}
                        >
                          ＋ New Playlist
                        </button>
                        {playlists.length > 0 && (
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                        )}
                      </>
                    )}
                    {playlists.map((playlist) => (
                      <button
                        key={playlist}
                        className="dropdown-item"
                        onClick={() => {
                          onAddToPlaylist(playlist, track)
                          onCloseMenu()
                        }}
                      >
                        {playlist}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="dropdown-item"
                onClick={() => {
                  window.api.openFileLocation(track.filePath)
                  onCloseMenu()
                }}
              >
                Open File Location
              </button>

              {currentPlaylistName && onRemoveFromPlaylist && (
                <button
                  className="dropdown-item danger"
                  onClick={() => {
                    onRemoveFromPlaylist(track)
                    onCloseMenu()
                  }}
                >
                  Remove from Playlist
                </button>
              )}
            </div>
          )}
        </div>
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
  const [activeMenuTrack, setActiveMenuTrack] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuTrack(null)
      }
    }
    if (activeMenuTrack) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeMenuTrack])

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; trackPath: string } | null>(null)

  useEffect(() => {
    function handleClickOutside() {
      setContextMenu(null)
    }
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('contextmenu', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('contextmenu', handleClickOutside)
    }
  }, [contextMenu])

  const handleToggleMenu = useCallback((trackPath: string) => {
    setActiveMenuTrack((prev) => (prev === trackPath ? null : trackPath))
  }, [])

  const handleCloseMenu = useCallback(() => {
    setActiveMenuTrack(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, trackPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      trackPath
    })
    setActiveMenuTrack(null)
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
      <div className="track-list-header">
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
            isMenuOpen={activeMenuTrack === track.filePath}
            playlists={playlists}
            currentPlaylistName={currentPlaylistName}
            canReorder={!!onReorderTracks}
            menuRef={menuRef}
            onPlayTrack={onPlayTrack}
            onToggleFavorite={onToggleFavorite}
            onAddToQueue={onAddToQueue}
            onAddToPlaylist={onAddToPlaylist}
            onAddToNewPlaylist={onAddToNewPlaylist}
            onRemoveFromPlaylist={onRemoveFromPlaylist}
            onReorderTracks={onReorderTracks}
            onToggleMenu={handleToggleMenu}
            onCloseMenu={handleCloseMenu}
            onContextMenu={handleContextMenu}
          />
        )
      })}

      {contextMenu && (() => {
        const track = tracks.find((t) => t.filePath === contextMenu.trackPath)
        if (!track) return null
        const isLiked = favorites.includes(track.filePath)
        return (
          <div
            className="track-dropdown-menu context-menu"
            style={{
              position: 'fixed',
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              right: 'auto',
              zIndex: 1000,
              margin: 0
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {onAddToQueue && (
              <button
                className="dropdown-item"
                onClick={() => {
                  onAddToQueue(track)
                  setContextMenu(null)
                }}
              >
                Add to Queue
              </button>
            )}
            
            <button
              className="dropdown-item"
              onClick={() => {
                onToggleFavorite(track.filePath)
                setContextMenu(null)
              }}
            >
              {isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            </button>

            {onAddToPlaylist && (
              <div className="dropdown-submenu-trigger">
                <span>Add to Playlist</span>
                <span className="submenu-arrow">▶</span>
                <div className="dropdown-submenu">
                  {onAddToNewPlaylist && (
                    <>
                      <button
                        className="dropdown-item"
                        style={{ color: 'var(--accent)', fontWeight: 'bold' }}
                        onClick={() => {
                          onAddToNewPlaylist(track)
                          setContextMenu(null)
                        }}
                      >
                        ＋ New Playlist
                      </button>
                      {playlists.length > 0 && (
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                      )}
                    </>
                  )}
                  {playlists.map((playlist) => (
                    <button
                      key={playlist}
                      className="dropdown-item"
                      onClick={() => {
                        onAddToPlaylist(playlist, track)
                        setContextMenu(null)
                      }}
                    >
                      {playlist}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="dropdown-item"
              onClick={() => {
                window.api.openFileLocation(track.filePath)
                setContextMenu(null)
              }}
            >
              Open File Location
            </button>

            {currentPlaylistName && onRemoveFromPlaylist && (
              <button
                className="dropdown-item danger"
                onClick={() => {
                  onRemoveFromPlaylist(track)
                  setContextMenu(null)
                }}
              >
                Remove from Playlist
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default memo(TrackList)
