import { useState, useRef, useEffect } from 'react'
import { Trash, X, Shuffle, MagnifyingGlass, MusicNotes } from '@phosphor-icons/react'
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
        <span className="queue-title">Play Queue</span>
        <div className="queue-actions">
          {queue.length > 0 && (
            <>
              <button onClick={onShuffleQueue} title="Shuffle Queue">
                <Shuffle size={16} weight="light" />
              </button>
              <button onClick={onClearQueue} title="Clear Queue">
                <Trash size={16} weight="light" />
              </button>
            </>
          )}
          <button onClick={onClose} title="Close Panel">
            <X size={18} weight="light" />
          </button>
        </div>
      </div>

      {/* Queue list */}
      <div className="queue-list-container">
        {queue.length === 0 ? (
          <div className="queue-empty-state">
            <MusicNotes size={32} weight="light" style={{ opacity: 0.3, marginBottom: '4px' }} />
            <span>Queue is empty.</span>
            <span style={{ fontSize: '11px', opacity: 0.5 }}>Search below to add tracks manually or double click a track from your library.</span>
          </div>
        ) : (
          queue.map((track) => {
            const isActive = currentTrack?.filePath === track.filePath
            return (
              <div
                key={track.filePath}
                className={`queue-item-row ${isActive ? 'active' : ''}`}
                onDoubleClick={() => onPlayTrack(track)}
              >
                <div className="queue-item-thumb">
                  {track.coverArt ? (
                    <img src={track.coverArt} alt="Cover Art" />
                  ) : (
                    <MusicNotes size={14} weight="light" />
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
                  className="btn-queue-remove"
                  title="Remove from queue"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFromQueue(track.filePath)
                  }}
                >
                  <X size={12} weight="light" />
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
