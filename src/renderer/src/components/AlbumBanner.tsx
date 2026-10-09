import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Play,
  Shuffle,
  MagnifyingGlass,
  DotsThree,
  MusicNotes,
  Queue,
  X
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface AlbumBannerProps {
  albumName: string
  tracks: TrackMeta[]
  onPlayAlbum: (shuffle?: boolean) => void
  onAddToQueue?: (tracks: TrackMeta[]) => void
  onSelectArtist?: (artist: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export default function AlbumBanner({
  albumName,
  tracks,
  onPlayAlbum,
  onAddToQueue,
  onSelectArtist,
  searchQuery = '',
  onSearchChange
}: AlbumBannerProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Handle click outside menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  // Focus search input when toggled open
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  // Derived metadata
  const coverArt = useMemo(() => {
    const found = tracks.find((t) => t.coverArt)
    return found ? found.coverArt : null
  }, [tracks])

  const artistName = useMemo(() => {
    if (!tracks.length) return 'Unknown Artist'
    const firstArtist = tracks[0].artist
    const isUniform = tracks.every((t) => t.artist === firstArtist)
    return isUniform ? firstArtist : 'Various Artists'
  }, [tracks])

  const releaseYear = useMemo(() => {
    const found = tracks.find((t) => t.year)
    return found ? found.year : null
  }, [tracks])

  const durationStr = useMemo(() => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration || 0), 0)
    const totalMins = Math.round(totalSecs / 60)
    if (totalMins >= 60) {
      const hrs = Math.floor(totalMins / 60)
      const mins = totalMins % 60
      return `${hrs} HR ${mins} MIN`
    }
    return `${Math.max(1, totalMins)} MIN`
  }, [tracks])

  return (
    <div className="album-view-container">
      {/* Main Spotify-style Album Banner matching Foto 2 */}
      <div className="album-banner">
        {/* Cover Art */}
        <div className="album-banner-cover">
          {coverArt ? (
            <img src={coverArt} alt={albumName} />
          ) : (
            <div className="album-banner-cover-placeholder">
              <MusicNotes size={64} weight="light" />
            </div>
          )}
        </div>

        {/* Album Details */}
        <div className="album-banner-details">
          <span className="album-banner-badge">ALBUM</span>

          <h1 className="album-banner-title" title={albumName}>
            {albumName}
          </h1>

          <div className="album-banner-artist-row">
            <span
              className="album-banner-artist"
              onClick={() => {
                if (onSelectArtist && artistName !== 'Various Artists') {
                  onSelectArtist(artistName)
                }
              }}
              style={{ cursor: onSelectArtist ? 'pointer' : 'default' }}
              title={onSelectArtist ? `View artist ${artistName}` : artistName}
            >
              {artistName}
            </span>
          </div>

          {/* Meta line: ALBUM • YEAR • X SONGS • X MIN */}
          <div className="album-banner-meta">
            <span className="meta-tag">ALBUM</span>
            {releaseYear && (
              <>
                <span className="meta-bullet">•</span>
                <span className="meta-year">{releaseYear}</span>
              </>
            )}
            <span className="meta-bullet">•</span>
            <span className="meta-count">
              {tracks.length} {tracks.length === 1 ? 'SONG' : 'SONGS'}
            </span>
            <span className="meta-bullet">•</span>
            <span className="meta-duration">{durationStr}</span>
          </div>

          {/* Action Row matching Foto 2: Shuffle, Play, Search, More Options */}
          <div className="album-actions-row">
            <button
              type="button"
              className="btn-album-action btn-album-shuffle"
              onClick={() => onPlayAlbum(true)}
              title="Shuffle Album"
              aria-label="Shuffle Album"
              disabled={tracks.length === 0}
            >
              <Shuffle size={20} weight="bold" />
            </button>

            <button
              type="button"
              className="btn-album-action btn-album-play"
              onClick={() => onPlayAlbum(false)}
              title="Play Album"
              aria-label="Play Album"
              disabled={tracks.length === 0}
            >
              <Play size={24} weight="fill" />
            </button>

            <button
              type="button"
              className={`btn-album-action btn-album-search ${isSearchOpen ? 'active' : ''}`}
              onClick={() => {
                setIsSearchOpen((prev) => !prev)
                if (isSearchOpen && onSearchChange) {
                  onSearchChange('')
                }
              }}
              title="Filter tracks in album"
              aria-label="Filter tracks"
            >
              <MagnifyingGlass size={20} weight="bold" />
            </button>

            <div className="album-options-wrapper" ref={menuRef}>
              <button
                type="button"
                className={`btn-album-action btn-album-more ${isMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                title="More Album Options"
                aria-label="More Options"
              >
                <DotsThree size={24} weight="bold" />
              </button>

              {isMenuOpen && (
                <div className="album-dropdown-menu">
                  {onAddToQueue && (
                    <button
                      type="button"
                      className="album-menu-item"
                      onClick={() => {
                        onAddToQueue(tracks)
                        setIsMenuOpen(false)
                      }}
                    >
                      <Queue size={16} weight="bold" />
                      <span>Add Album to Queue</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* In-album Search Input Box (Slide in when Search button is active) */}
            {isSearchOpen && onSearchChange && (
              <div className="album-inline-search-box">
                <MagnifyingGlass size={15} weight="bold" className="search-box-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter in album..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="search-box-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-box-clear"
                    onClick={() => onSearchChange('')}
                  >
                    <X size={13} weight="bold" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
