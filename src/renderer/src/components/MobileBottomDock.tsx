import { memo } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  Shuffle,
  Wrench,
  Disc,
  MusicNotes,
  House
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface MobileBottomDockProps {
  currentTrack: TrackMeta | null
  isPlaying: boolean
  isShuffle?: boolean
  onToggleShuffle?: () => void
  onPlayPause: () => void
  onNext: () => void
  onOpenNowPlaying: () => void
  currentView: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio'
  setCurrentView: (view: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio') => void
  activePlaylist?: string | null
  activeAlbum?: string | null
  onClearActiveFilters?: () => void
}

function MobileBottomDock({
  currentTrack,
  isPlaying,
  isShuffle = false,
  onToggleShuffle,
  onPlayPause,
  onNext,
  onOpenNowPlaying,
  currentView,
  setCurrentView,
  activePlaylist,
  activeAlbum,
  onClearActiveFilters
}: MobileBottomDockProps) {
  const isHomeActive = currentView === 'home' && !activePlaylist && !activeAlbum
  const isLibraryActive = currentView === 'library' || Boolean(activePlaylist) || Boolean(activeAlbum)
  const isToolsActive = currentView === 'studio' || currentView === 'latest'

  const handleNavClick = (view: 'home' | 'library' | 'studio') => {
    setCurrentView(view)
    if (onClearActiveFilters) {
      onClearActiveFilters()
    }
  }

  return (
    <div className="mobile-bottom-dock">
      {/* 1. Upper Pill: Mini Player Capsule */}
      <div
        className={`mobile-mini-player ${currentTrack ? 'has-track' : 'no-track'}`}
        onClick={currentTrack ? onOpenNowPlaying : undefined}
        title={currentTrack ? `${currentTrack.title} - ${currentTrack.artist} (Tap to expand)` : undefined}
      >
        <div className="mobile-mini-player-left">
          <div className="mobile-mini-player-thumb">
            {currentTrack?.coverArt ? (
              <img
                src={currentTrack.coverArt}
                alt={currentTrack.title}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = e.currentTarget.nextElementSibling as HTMLElement
                  if (fb) fb.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="mini-fallback-icon"
              style={{
                display: currentTrack?.coverArt ? 'none' : 'flex',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MusicNotes size={18} weight="light" />
            </div>
          </div>
          <div className="mobile-mini-player-info">
            <span className="mobile-mini-title">
              {currentTrack ? currentTrack.title : 'No song playing'}
            </span>
            <span className="mobile-mini-artist">
              {currentTrack ? currentTrack.artist : 'Bonkey Music'}
            </span>
          </div>
        </div>

        {/* Action icons on the right: Shuffle, Play/Pause, Next */}
        <div className="mobile-mini-player-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="mobile-mini-action-btn"
            onClick={onToggleShuffle}
            title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
            aria-label="Toggle Shuffle"
            style={{ color: isShuffle ? '#f43f5e' : '#ffffff' }}
          >
            <Shuffle size={18} weight={isShuffle ? 'bold' : 'regular'} />
          </button>

          <button
            type="button"
            className="mobile-mini-action-btn"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={!currentTrack}
          >
            {isPlaying ? (
              <Pause size={18} weight="fill" />
            ) : (
              <Play size={18} weight="fill" />
            )}
          </button>

          <button
            type="button"
            className="mobile-mini-action-btn"
            onClick={onNext}
            title="Next Track"
            aria-label="Next Track"
            disabled={!currentTrack}
          >
            <SkipForward size={18} weight="fill" />
          </button>
        </div>
      </div>

      {/* 2. Lower Pill: Navigation Bar Capsule with Home, Library, Tools */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-tab ${isHomeActive ? 'active' : ''}`}
          onClick={() => handleNavClick('home')}
          title="Home"
        >
          <House size={17} weight={isHomeActive ? 'fill' : 'bold'} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isLibraryActive ? 'active' : ''}`}
          onClick={() => handleNavClick('library')}
          title="Library"
        >
          <Disc size={17} weight={isLibraryActive ? 'fill' : 'bold'} />
          <span>Library</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isToolsActive ? 'active' : ''}`}
          onClick={() => handleNavClick('studio')}
          title="Tools"
        >
          <Wrench size={17} weight={isToolsActive ? 'fill' : 'bold'} />
          <span>Tools</span>
        </button>
      </nav>
    </div>
  )
}

export default memo(MobileBottomDock)
