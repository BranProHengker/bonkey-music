import { useState, useEffect } from 'react'
import { House, Heart, Gear, Plus, Disc, Equalizer } from '@phosphor-icons/react'
import iconApp from '../assets/iconapp.png'
import { TrackMeta } from '../hooks/useAudioEngine'

interface SidebarProps {
  currentView: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio'
  setCurrentView: (view: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio') => void
  libraryFolder?: string | null
  playlists?: string[]
  activePlaylist?: string | null
  setActivePlaylist?: (name: string | null) => void
  onCreatePlaylist: () => void
  onAddFolder: () => void
  onImportAudio: () => void
  albums?: { name: string; artist: string; coverArt: string | null }[]
  activeAlbum?: string | null
  setActiveAlbum?: (name: string | null) => void
  playlistTracks?: Record<string, string[]>
  playlistCovers?: Record<string, string>
  tracks?: TrackMeta[]
  onPlayTrack?: (track: TrackMeta, tracksContext?: TrackMeta[]) => void
  currentTrack?: TrackMeta | null
}

export default function Sidebar({
  currentView,
  setCurrentView,
  activePlaylist,
  setActivePlaylist,
  onCreatePlaylist,
  onAddFolder,
  onImportAudio,
  activeAlbum,
  setActiveAlbum
}: SidebarProps) {
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

  const handleNavClick = (view: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio') => {
    setCurrentView(view)
    if (setActivePlaylist) setActivePlaylist(null)
    if (setActiveAlbum) setActiveAlbum(null)
  }

  return (
    <aside className="sidebar">
      {/* 1. App Logo / Home button */}
      <div
        className="sidebar-logo"
        onClick={() => handleNavClick('home')}
        style={{ cursor: 'pointer' }}
        title="Bonkey Music - Home"
      >
        <img src={iconApp} alt="App Icon" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
      </div>

      {/* 2. Middle Navigation Buttons */}
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'home' && !activePlaylist && !activeAlbum ? 'active' : ''}`}
          onClick={() => handleNavClick('home')}
          title="Home"
        >
          <House size={22} weight={currentView === 'home' && !activePlaylist && !activeAlbum ? 'fill' : 'light'} />
        </button>

        <button
          className={`nav-item ${currentView === 'library' && !activePlaylist && !activeAlbum ? 'active' : ''}`}
          onClick={() => handleNavClick('library')}
          title="My Library"
        >
          <Disc size={22} weight={currentView === 'library' && !activePlaylist && !activeAlbum ? 'fill' : 'light'} />
        </button>

        <button
          className={`nav-item ${currentView === 'favorites' ? 'active' : ''}`}
          onClick={() => handleNavClick('favorites')}
          title="Liked Songs"
        >
          <Heart size={22} weight={currentView === 'favorites' ? 'fill' : 'light'} />
        </button>

        <button
          className={`nav-item ${currentView === 'studio' ? 'active' : ''}`}
          onClick={() => handleNavClick('studio')}
          title="Music Studio"
        >
          <Equalizer size={22} weight={currentView === 'studio' ? 'fill' : 'light'} />
        </button>

        {/* Quick Add Content Action */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button
            className={`nav-item ${isPlusMenuOpen ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsPlusMenuOpen((prev) => !prev)
            }}
            title="Add Music / Create Playlist"
          >
            <Plus size={20} weight="bold" />
          </button>

          {isPlusMenuOpen && (
            <div
              className="track-dropdown-menu sidebar-plus-menu"
              style={{
                position: 'absolute',
                left: '64px',
                top: '0',
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
      </nav>

      {/* 3. Bottom Settings Button */}
      <div className="sidebar-footer">
        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavClick('settings')}
          title="Settings"
        >
          <Gear size={22} weight={currentView === 'settings' ? 'fill' : 'light'} />
        </button>
      </div>
    </aside>
  )
}
