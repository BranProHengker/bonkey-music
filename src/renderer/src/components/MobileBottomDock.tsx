import { memo } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  Compass,
  Books,
  MagnifyingGlass,
  MusicNotes
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface MobileBottomDockProps {
  currentTrack: TrackMeta | null
  isPlaying: boolean
  onPlayPause: () => void
  onNext: () => void
  onOpenNowPlaying: () => void
  currentView: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio'
  setCurrentView: (view: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio') => void
  onSearchClick: () => void
  activePlaylist?: string | null
  activeAlbum?: string | null
  onClearActiveFilters?: () => void
}

function MobileBottomDock({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onOpenNowPlaying,
  currentView,
  setCurrentView,
  onSearchClick,
  activePlaylist,
  activeAlbum,
  onClearActiveFilters
}: MobileBottomDockProps) {
  const isHomeActive = currentView === 'home' && !activePlaylist && !activeAlbum
  const isExploreActive = currentView === 'studio' || currentView === 'latest'
  const isLibraryActive = currentView === 'library' || Boolean(activePlaylist) || Boolean(activeAlbum)

  const handleNavClick = (view: 'home' | 'library' | 'studio') => {
    setCurrentView(view)
    if (onClearActiveFilters) {
      onClearActiveFilters()
    }
  }

  return (
    <div className="mobile-bottom-dock">
      {/* 1. Upper Pill: Mini Player Capsule (matching Foto 4) */}
      <div
        className={`mobile-mini-player ${currentTrack ? 'has-track' : 'no-track'}`}
        onClick={currentTrack ? onOpenNowPlaying : undefined}
        title={currentTrack ? `${currentTrack.title} - ${currentTrack.artist} (Tap to expand)` : undefined}
      >
        <div className="mobile-mini-player-left">
          <div className="mobile-mini-player-thumb">
            {currentTrack?.coverArt ? (
              <img src={currentTrack.coverArt} alt={currentTrack.title} />
            ) : (
              <MusicNotes size={18} weight="light" />
            )}
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

        {/* Action icons on the right matching Foto 4: Play/Pause and Next */}
        <div className="mobile-mini-player-actions" onClick={(e) => e.stopPropagation()}>
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

      {/* 2. Lower Pill: Navigation Bar Capsule (matching Foto 4) */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-tab ${isHomeActive ? 'active' : ''}`}
          onClick={() => handleNavClick('home')}
          title="Play / Home"
        >
          <Play size={17} weight={isHomeActive ? 'fill' : 'bold'} />
          <span>Play</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isExploreActive ? 'active' : ''}`}
          onClick={() => handleNavClick('studio')}
          title="Explore Studio"
        >
          <Compass size={17} weight={isExploreActive ? 'fill' : 'bold'} />
          <span>Explore</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isLibraryActive ? 'active' : ''}`}
          onClick={() => handleNavClick('library')}
          title="Library"
        >
          <Books size={17} weight={isLibraryActive ? 'fill' : 'bold'} />
          <span>Library</span>
        </button>

        <button
          type="button"
          className="mobile-nav-tab"
          onClick={onSearchClick}
          title="Search"
        >
          <MagnifyingGlass size={17} weight="bold" />
          <span>Search</span>
        </button>
      </nav>
    </div>
  )
}

export default memo(MobileBottomDock)
