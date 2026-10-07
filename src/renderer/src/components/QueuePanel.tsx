import { useState, useRef, useEffect } from 'react'
import { Trash, X, Shuffle, MagnifyingGlass, MusicNotes, Play } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface QueuePanelProps {
  isOpen: boolean
  isLyricsOpen?: boolean
  onClose: () => void
  allTracks: TrackMeta[]
  onAddToQueue: (track: TrackMeta) => void
  onRemoveFromQueue: (filePath: string) => void
  onClearQueue: () => void
  onShuffleQueue: () => void
  onPlayTrack: (track: TrackMeta) => void
  currentTrack: TrackMeta | null
  isPlaying: boolean
  queue: TrackMeta[]
}

export default function QueuePanel({
  isOpen,
  isLyricsOpen = false,
  onClose,
  allTracks,
  onAddToQueue,
  onRemoveFromQueue,
  onClearQueue,
  onShuffleQueue,
  onPlayTrack,
  currentTrack,
  isPlaying,
  queue
}: QueuePanelProps) {
  const [searchVal, setSearchVal] = useState('')
  const [searchResults, setSearchResults] = useState<TrackMeta[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  // Format time (e.g. 182s -> 3:02)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Handle click outside search results to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle search typing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchVal(val)
    if (val.trim().length > 0) {
      const query = val.toLowerCase()
      const filtered = allTracks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.artist.toLowerCase().includes(query) ||
            t.album?.toLowerCase().includes(query)
        )
        .slice(0, 5) // limit to 5 results
      setSearchResults(filtered)
      setShowResults(true)
    } else {
      setSearchResults([])
      setShowResults(false)
    }
  }

  const handleSelectSearchResult = (track: TrackMeta) => {
    onAddToQueue(track)
    setSearchVal('')
    setShowResults(false)
  }

  return (
    <div className={`queue-panel ${isOpen ? 'open' : 'closed'} ${isLyricsOpen ? 'on-lyrics' : ''}`}>
      {/* Header */}
      <div className="queue-header">
        <div className="queue-header-left">
          <span className="queue-title">Play Queue</span>
          <span className="queue-count-badge">{queue.length}</span>
        </div>
        <div className="queue-actions">
          {queue.length > 0 && (
            <>
              <button
                type="button"
                className="btn-queue-action"
                onClick={onShuffleQueue}
                title="Shuffle Queue"
                aria-label="Shuffle Queue"
              >
                <Shuffle size={16} weight="bold" />
              </button>
              <button
                type="button"
                className="btn-queue-action"
                onClick={onClearQueue}
                title="Clear Queue"
                aria-label="Clear Queue"
              >
                <Trash size={16} weight="bold" />
              </button>
            </>
          )}
          <button
            type="button"
            className="btn-queue-action btn-queue-close"
            onClick={onClose}
            title="Close Panel"
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Queue list */}
      <div className="queue-list-container">
        {queue.length === 0 ? (
          <div className="queue-empty-state">
            <div className="queue-empty-icon-box">
              <MusicNotes size={28} weight="light" />
            </div>
            <span className="queue-empty-title">Queue is empty</span>
            <span className="queue-empty-desc">
              Search below or select songs from your library to queue them up.
            </span>
          </div>
        ) : (
          queue.map((track) => {
            const isActive = currentTrack?.filePath === track.filePath
            return (
              <div
                key={track.filePath}
                className={`queue-item-row ${isActive ? 'active' : ''}`}
                onClick={() => onPlayTrack(track)}
                title={`Play ${track.title}`}
              >
                <div className="queue-item-thumb">
                  {track.coverArt ? (
                    <img src={track.coverArt} alt={track.title} loading="lazy" />
                  ) : (
                    <MusicNotes size={16} weight="light" />
                  )}
                  {isActive && isPlaying ? (
                    <div className="queue-equalizer-overlay">
                      <span className="eq-bar eq-1" />
                      <span className="eq-bar eq-2" />
                      <span className="eq-bar eq-3" />
                    </div>
                  ) : (
                    <div className="queue-item-play-overlay">
                      <Play size={12} weight="fill" />
                    </div>
                  )}
                </div>
                <div className="queue-item-details">
                  <span className="queue-item-title" title={track.title}>
                    {track.title}
                  </span>
                  <span className="queue-item-artist" title={track.artist}>
                    {track.artist}
                  </span>
                </div>
                <span className="queue-item-time">{formatTime(track.duration)}</span>
                <button
                  type="button"
                  className="btn-queue-remove"
                  title="Remove from queue"
                  aria-label="Remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFromQueue(track.filePath)
                  }}
                >
                  <X size={13} weight="bold" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Search & Add Track Section */}
      <div className="queue-add-container" ref={searchWrapperRef}>
        {showResults && searchResults.length > 0 && (
          <div className="queue-search-results">
            {searchResults.map((track) => (
              <div
                key={track.filePath}
                className="queue-search-result-row"
                onClick={() => handleSelectSearchResult(track)}
              >
                <div className="queue-item-thumb" style={{ width: '28px', height: '28px' }}>
                  {track.coverArt ? (
                    <img src={track.coverArt} alt="Cover Art" />
                  ) : (
                    <MusicNotes size={12} weight="light" />
                  )}
                </div>
                <div className="queue-item-details">
                  <span className="queue-item-title" style={{ fontSize: '12px' }}>
                    {track.title}
                  </span>
                  <span className="queue-item-artist" style={{ fontSize: '10px' }}>
                    {track.artist}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="queue-search-input-wrapper">
          <MagnifyingGlass size={16} weight="light" />
          <input
            type="text"
            placeholder="Search & add track..."
            value={searchVal}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchVal.trim().length > 0) setShowResults(true)
            }}
          />
        </div>
      </div>
    </div>
  )
}
