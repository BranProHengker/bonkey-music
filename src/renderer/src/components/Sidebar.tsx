import { useState, useMemo, useEffect } from 'react'
import { House, Heart, Gear, Plus, Disc, MusicNotes } from '@phosphor-icons/react'
import iconApp from '../assets/iconapp.png'
import { TrackMeta } from '../hooks/useAudioEngine'

interface SidebarProps {
  currentView: 'library' | 'favorites' | 'settings'
  setCurrentView: (view: 'library' | 'favorites' | 'settings') => void
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
  tracks
}: SidebarProps) {
  const [filter, setFilter] = useState<'all' | 'playlists' | 'albums'>('all')
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

  const handleNavClick = (view: 'library' | 'favorites' | 'settings') => {
    setCurrentView(view)
    setActivePlaylist(null)
    setActiveAlbum(null)
  }

  // Combine playlists and albums into a unified list, then filter & sort them
  const libraryItems = useMemo(() => {
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
  }, [playlists, albums, playlistTracks, playlistCovers, tracks, activePlaylist, activeAlbum, filter, setCurrentView, setActivePlaylist, setActiveAlbum])

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
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          role="tab"
          aria-selected={filter === 'playlists'}
          className={`filter-pill ${filter === 'playlists' ? 'active' : ''}`}
          onClick={() => setFilter('playlists')}
        >
          Playlists
        </button>
        <button
          role="tab"
          aria-selected={filter === 'albums'}
          className={`filter-pill ${filter === 'albums' ? 'active' : ''}`}
          onClick={() => setFilter('albums')}
        >
          Albums
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
