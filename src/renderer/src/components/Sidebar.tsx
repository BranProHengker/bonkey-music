import { useState, useMemo, useEffect } from 'react'
import { House, Heart, Gear, Plus, Disc, MusicNotes, ClockCounterClockwise } from '@phosphor-icons/react'
import iconApp from '../assets/iconapp.png'
import { TrackMeta } from '../hooks/useAudioEngine'

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  const d = new Date(timestamp)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

interface SidebarProps {
  currentView: 'library' | 'favorites' | 'settings' | 'latest'
  setCurrentView: (view: 'library' | 'favorites' | 'settings' | 'latest') => void
  libraryFolder: string | null
  playlists: string[]
  activePlaylist: string | null
  setActivePlaylist: (name: string | null) => void
  onCreatePlaylist: () => void
  onAddFolder: () => void
  onImportAudio: () => void
  albums: { name: string; artist: string; coverArt: string | null }[]
  activeAlbum: string | null
  setActiveAlbum: (name: string | null) => void
  playlistTracks: Record<string, string[]>
  playlistCovers: Record<string, string>
  tracks: TrackMeta[]
  onPlayTrack?: (track: TrackMeta, tracksContext?: TrackMeta[]) => void
  currentTrack?: TrackMeta | null
}

export default function Sidebar({
  currentView,
  setCurrentView,
  libraryFolder,
  playlists,
  activePlaylist,
  setActivePlaylist,
  onCreatePlaylist,
  onAddFolder,
  onImportAudio,
  albums,
  activeAlbum,
  setActiveAlbum,
  playlistTracks,
  playlistCovers,
  tracks,
  onPlayTrack,
  currentTrack
}: SidebarProps) {
  const [filter, setFilter] = useState<'all' | 'playlists' | 'albums' | 'latest'>('all')
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false)

  useEffect(() => {
    function handleClickOutside() {
      setIsPlusMenuOpen(false)
    }
    if (isPlusMenuOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isPlusMenuOpen])

  useEffect(() => {
    if (currentView === 'latest' && filter !== 'latest') {
      setFilter('latest')
    } else if (currentView !== 'latest' && filter === 'latest') {
      setFilter('all')
    }
  }, [currentView, filter])

  const handleNavClick = (view: 'library' | 'favorites' | 'settings' | 'latest') => {
    setCurrentView(view)
    setActivePlaylist(null)
    setActiveAlbum(null)
  }

  // Combine playlists and albums into a unified list, or show latest tracks
  const libraryItems = useMemo(() => {
    if (filter === 'latest') {
      const sortedTracks = [...tracks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      const allLatestItem = {
        type: 'latest-header' as const,
        id: 'latest-all-header',
        name: 'All Recently Added',
        subtitle: `${sortedTracks.length} tracks • Newest first`,
        coverArt: null,
        isActive: currentView === 'latest' && !activePlaylist && !activeAlbum,
        onClick: () => {
          setCurrentView('latest')
          setActivePlaylist(null)
          setActiveAlbum(null)
        }
      }

      const trackItems = sortedTracks.map((track) => {
        const timeStr = formatRelativeTime(track.addedAt)
        return {
          type: 'track' as const,
          id: `track-${track.filePath}`,
          name: track.title,
          subtitle: timeStr ? `${track.artist} • ${timeStr}` : track.artist,
          coverArt: track.coverArt,
          isActive: currentTrack?.filePath === track.filePath,
          onClick: () => {
            setCurrentView('latest')
            setActivePlaylist(null)
            setActiveAlbum(null)
            onPlayTrack?.(track, sortedTracks)
          }
        }
      })

      return [allLatestItem, ...trackItems]
    }

    const playlistItems = playlists.map((name) => {
      const customCover = playlistCovers[name]
      let coverArt: string | null = customCover || null

      if (!coverArt) {
        const filePaths = playlistTracks[name] || []
        const firstSongWithCover = tracks.find((t) => filePaths.includes(t.filePath) && t.coverArt)
        if (firstSongWithCover) {
          coverArt = firstSongWithCover.coverArt
        }
      }

      return {
        type: 'playlist' as const,
        id: `playlist-${name}`,
        name,
        subtitle: `Playlist • ${playlistTracks[name]?.length || 0} songs`,
        coverArt,
        isActive: activePlaylist === name,
        onClick: () => {
          setCurrentView('library')
          setActivePlaylist(name)
        }
      }
    })

    const albumItems = albums.map((album) => ({
      type: 'album' as const,
      id: `album-${album.name}`,
      name: album.name,
      subtitle: `Album • ${album.artist}`,
      coverArt: album.coverArt,
      isActive: activeAlbum === album.name,
      onClick: () => {
        setCurrentView('library')
        setActiveAlbum(album.name)
      }
    }))

    const combined = [...playlistItems, ...albumItems]
    
    // Sort alphabetically by name
    combined.sort((a, b) => a.name.localeCompare(b.name))

    // Filter based on active filter pill
    if (filter === 'playlists') {
      return combined.filter((item) => item.type === 'playlist')
    }
    if (filter === 'albums') {
      return combined.filter((item) => item.type === 'album')
    }
    return combined
  }, [playlists, albums, playlistTracks, playlistCovers, tracks, activePlaylist, activeAlbum, filter, currentView, currentTrack, onPlayTrack, setCurrentView, setActivePlaylist, setActiveAlbum])

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={iconApp} alt="App Icon" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
        <span>Bonkey Music</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'library' && !activePlaylist && !activeAlbum ? 'active' : ''}`}
          onClick={() => handleNavClick('library')}
        >
          <House size={20} weight="light" />
          <span>My Library</span>
        </button>

        <button
          className={`nav-item ${currentView === 'favorites' ? 'active' : ''}`}
          onClick={() => handleNavClick('favorites')}
        >
          <Heart size={20} weight="light" />
          <span>Liked Songs</span>
        </button>
      </nav>

      <div className="sidebar-divider" />

      <div className="sidebar-playlists-header" style={{ position: 'relative' }}>
        <span>Your Library</span>
        <button
          className={`btn-add-playlist ${isPlusMenuOpen ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            setIsPlusMenuOpen(!isPlusMenuOpen)
          }}
          title="Add Content"
        >
          <Plus size={16} weight="light" />
        </button>

        {isPlusMenuOpen && (
          <div
            className="track-dropdown-menu sidebar-plus-menu"
            style={{
              position: 'absolute',
              right: '12px',
              top: '32px',
              width: '180px',
              zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="dropdown-item"
              onClick={() => {
                onCreatePlaylist()
                setIsPlusMenuOpen(false)
              }}
            >
              ＋ Create Playlist
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                onAddFolder()
                setIsPlusMenuOpen(false)
              }}
            >
              📁 Add Music Folder
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                onImportAudio()
                setIsPlusMenuOpen(false)
              }}
            >
              🎵 Import Audio Files
            </button>
          </div>
        )}
      </div>

      {/* Segmented Filter Control */}
      <div className="sidebar-filters" role="tablist" aria-label="Library filter">
        <button
          role="tab"
          aria-selected={filter === 'all'}
          className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => {
            setFilter('all')
            if (currentView === 'latest') {
              setCurrentView('library')
            }
          }}
        >
          All
        </button>
        <button
          role="tab"
          aria-selected={filter === 'playlists'}
          className={`filter-pill ${filter === 'playlists' ? 'active' : ''}`}
          onClick={() => {
            setFilter('playlists')
            if (currentView === 'latest') {
              setCurrentView('library')
            }
          }}
        >
          Playlists
        </button>
        <button
          role="tab"
          aria-selected={filter === 'albums'}
          className={`filter-pill ${filter === 'albums' ? 'active' : ''}`}
          onClick={() => {
            setFilter('albums')
            if (currentView === 'latest') {
              setCurrentView('library')
            }
          }}
        >
          Albums
        </button>
        <button
          role="tab"
          aria-selected={filter === 'latest'}
          className={`filter-pill ${filter === 'latest' ? 'active' : ''}`}
          onClick={() => {
            setFilter('latest')
            setCurrentView('latest')
            setActivePlaylist(null)
            setActiveAlbum(null)
          }}
        >
          Latest
        </button>
      </div>

      <div className="sidebar-library-list">
        {libraryItems.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center' }}>
            No items yet
          </div>
        ) : (
          libraryItems.map((item) => (
            <button
              key={item.id}
              className={`library-item-nav ${item.isActive ? 'active' : ''}`}
              onClick={item.onClick}
            >
              <div className="library-item-cover">
                {item.type === 'album' ? (
                  item.coverArt ? (
                    <img src={item.coverArt} alt={item.name} className="item-cover-img" />
                  ) : (
                    <div className="item-cover-placeholder album-placeholder">
                      <Disc size={20} weight="light" />
                    </div>
                  )
                ) : item.type === 'latest-header' ? (
                  <div className="item-cover-placeholder" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)' }}>
                    <ClockCounterClockwise size={18} weight="bold" />
                  </div>
                ) : (
                  item.coverArt ? (
                    <img src={item.coverArt} alt={item.name} className="item-cover-img" />
                  ) : (
                    <div className="item-cover-placeholder playlist-placeholder">
                      <MusicNotes size={20} weight="light" />
                    </div>
                  )
                )}
              </div>
              <div className="library-item-info">
                <span className="library-item-name">{item.name}</span>
                <span className="library-item-subtitle">{item.subtitle}</span>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-divider" />
        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <Gear size={20} weight="light" />
          <span>Settings</span>
        </button>

        {libraryFolder && (
          <div style={{ padding: '4px 12px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {libraryFolder.split('/').pop()}
          </div>
        )}
      </div>
    </aside>
  )
}
