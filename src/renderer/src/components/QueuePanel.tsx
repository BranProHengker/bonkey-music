import { useState, useRef, useEffect } from 'react'
import { Trash, X, Shuffle, MagnifyingGlass, MusicNotes } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'
import QueueItemRow from './QueueItemRow'

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
  onReorderQueue?: (fromIndex: number, toIndex: number) => void
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
  queue,
  onReorderQueue
}: QueuePanelProps) {
  const [searchVal, setSearchVal] = useState('')
  const [searchResults, setSearchResults] = useState<TrackMeta[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchWrapperRef = useRef<HTMLDivElement>(null)

  // Drag-and-drop state for reordering queue items
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${index}`)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = (_e: React.DragEvent, index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null)
    }
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index && onReorderQueue) {
      onReorderQueue(draggedIndex, index)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

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
          queue.map((track, idx) => (
            <QueueItemRow
              key={`${track.filePath}-${idx}`}
              track={track}
              index={idx}
              isCurrent={currentTrack?.filePath === track.filePath}
              isPlaying={isPlaying}
              isDragging={draggedIndex === idx}
              isDragOver={dragOverIndex === idx}
              onDragStart={onReorderQueue ? handleDragStart : undefined}
              onDragOver={onReorderQueue ? handleDragOver : undefined}
              onDragLeave={onReorderQueue ? handleDragLeave : undefined}
              onDrop={onReorderQueue ? handleDrop : undefined}
              onDragEnd={onReorderQueue ? handleDragEnd : undefined}
              onPlay={onPlayTrack}
              onRemove={onRemoveFromQueue}
              formatTime={formatTime}
            />
          ))
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
