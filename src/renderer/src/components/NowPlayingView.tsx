import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react'
import {
  MusicNotes,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  SpeakerLow,
  SpeakerHigh,
  SpeakerX,
  ChatTeardropText,
  ListBullets,
  DotsThree,
  CaretRight,
  CloudArrowDown,
  ArrowClockwise,
  Heart,
  Shuffle,
  Repeat,
  RepeatOnce,
  PlusCircle,
  FolderOpen,
  Link,
  Equals
} from '@phosphor-icons/react'
import { TrackMeta, useAudioEngine, useAudioTime } from '../hooks/useAudioEngine'

interface NowPlayingViewProps {
  currentTrack: TrackMeta | null
  isPlaying: boolean
  duration: number
  volume: number
  isMuted: boolean
  onPlayPause: () => void
  onNext: () => void
  onPrevious: () => void
  seek: (time: number) => void
  onVolumeChange: (vol: number) => void
  onToggleMute: () => void
  onClose: () => void
  onSwitchToLyrics: () => void
  onToggleQueue?: () => void
  isQueueOpen?: boolean
  sourceTitle?: string
  isShuffle?: boolean
  onToggleShuffle?: () => void
  isRepeat?: 'off' | 'one' | 'all'
  onToggleRepeat?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onAddToPlaylist?: (playlistName: string, track: TrackMeta) => void
  onAddToNewPlaylist?: (track: TrackMeta) => void
  playlists?: string[]
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

function formatRemainingTime(current: number, duration: number): string {
  if (isNaN(duration) || duration <= 0) return '-0:00'
  const remaining = Math.max(0, duration - current)
  return `-${formatTime(remaining)}`
}

function NowPlayingView({
  currentTrack,
  isPlaying,
  duration,
  volume,
  isMuted,
  onPlayPause,
  onNext,
  onPrevious,
  seek,
  onVolumeChange,
  onToggleMute,
  onClose,
  onSwitchToLyrics,
  sourceTitle = 'Playing from Queue',
  isShuffle: propShuffle,
  onToggleShuffle: propToggleShuffle,
  isRepeat: propRepeat,
  onToggleRepeat: propToggleRepeat,
  isFavorite = false,
  onToggleFavorite,
  onAddToPlaylist,
  onAddToNewPlaylist,
  playlists = []
}: NowPlayingViewProps): React.JSX.Element {
  const currentTime = useAudioTime()
  const {
    queue,
    playTrack,
    removeFromQueue,
    reorderQueue,
    isShuffle: engineShuffle,
    toggleShuffle: engineToggleShuffle,
    isRepeat: engineRepeat,
    toggleRepeat: engineToggleRepeat
  } = useAudioEngine()

  const isShuffle = propShuffle ?? engineShuffle
  const onToggleShuffle = propToggleShuffle || engineToggleShuffle
  const isRepeat = propRepeat ?? engineRepeat
  const onToggleRepeat = propToggleRepeat || engineToggleRepeat

  const [rawLyrics, setRawLyrics] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState<boolean>(false)
  const [isSearchingOnline, setIsSearchingOnline] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  const [isClosing, setIsClosing] = useState(false)
  const [isBodyQueueOpen, setIsBodyQueueOpen] = useState(false)
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null)
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState<number | null>(null)

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const isDraggingSheetRef = useRef(false)
  const dragStartYRef = useRef(0)
  const currentDragYRef = useRef(0)

  // Smooth slide-down trigger for close action (nutup laci)
  const triggerClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    if (overlayRef.current) {
      overlayRef.current.style.transition = 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease'
      overlayRef.current.style.transform = 'translateY(100%)'
      overlayRef.current.style.opacity = '0'
    }
    setTimeout(() => {
      onClose()
    }, 350)
  }, [isClosing, onClose])

  // Drag down sheet gesture handlers (pull down like a curtain)
  const handleDragStart = useCallback((clientY: number) => {
    isDraggingSheetRef.current = true
    dragStartYRef.current = clientY
    currentDragYRef.current = 0
    if (overlayRef.current) {
      overlayRef.current.style.transition = 'none'
    }
  }, [])

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingSheetRef.current || !overlayRef.current) return
    const deltaY = clientY - dragStartYRef.current
    currentDragYRef.current = deltaY

    if (deltaY > 0) {
      overlayRef.current.style.transform = `translateY(${deltaY}px)`
      const progress = Math.min(1, deltaY / (window.innerHeight * 0.75))
      overlayRef.current.style.opacity = `${Math.max(0.35, 1 - progress * 0.65)}`
    } else {
      overlayRef.current.style.transform = `translateY(${deltaY * 0.15}px)`
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!isDraggingSheetRef.current || !overlayRef.current) return
    isDraggingSheetRef.current = false
    const deltaY = currentDragYRef.current

    if (deltaY > 50) {
      // Ditarik sedikit ke bawah -> langsung meluncur mulus ke bawah seperti menutup laci
      setIsClosing(true)
      overlayRef.current.style.transition = 'transform 0.36s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease'
      overlayRef.current.style.transform = 'translateY(100%)'
      overlayRef.current.style.opacity = '0'
      setTimeout(() => {
        onClose()
      }, 350)
    } else {
      // Spring back jika dilepas sebelum batas
      overlayRef.current.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease'
      overlayRef.current.style.transform = 'translateY(0)'
      overlayRef.current.style.opacity = '1'
    }
  }, [onClose])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingSheetRef.current) handleDragMove(e.clientY)
    }
    const onMouseUp = () => {
      if (isDraggingSheetRef.current) handleDragEnd()
    }
    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingSheetRef.current && e.touches[0]) handleDragMove(e.touches[0].clientY)
    }
    const onTouchEnd = () => {
      if (isDraggingSheetRef.current) handleDragEnd()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleDragMove, handleDragEnd])

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isMenuOpen) {
          setIsMenuOpen(false)
          return
        }
        if (isPlaylistMenuOpen) {
          setIsPlaylistMenuOpen(false)
          return
        }
        triggerClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [triggerClose, isMenuOpen, isPlaylistMenuOpen])

  // Close dropdown on click outside
  useEffect(() => {
    if (!isMenuOpen && !isPlaylistMenuOpen) return
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (isMenuOpen && !target.closest('.now-playing-options-wrapper')) {
        setIsMenuOpen(false)
      }
      if (isPlaylistMenuOpen && !target.closest('.now-playing-playlist-wrapper')) {
        setIsPlaylistMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => document.removeEventListener('mousedown', handleDocClick)
  }, [isMenuOpen, isPlaylistMenuOpen])

  // Fetch lyrics when track changes to show active lyric snippet
  useEffect(() => {
    let isCancelled = false
    async function loadLyrics() {
      if (!currentTrack) {
        setRawLyrics(null)
        return
      }
      try {
        const local = await window.api.getLyrics(currentTrack.filePath)
        if (!isCancelled) setRawLyrics(local)
      } catch {
        if (!isCancelled) setRawLyrics(null)
      }
    }
    loadLyrics()
    return () => {
      isCancelled = true
    }
  }, [currentTrack])

  // Parse timed lyrics lines
  const timedLines = useMemo(() => {
    if (!rawLyrics) return []
    const lines = rawLyrics.split(/\r?\n/)
    const parsed: { time: number; text: string }[] = []
    const regex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      const matches = Array.from(line.matchAll(regex))
      if (matches.length > 0) {
        const textOnly = line.replace(regex, '').trim()
        if (!textOnly) continue
        for (const match of matches) {
          const m = parseInt(match[1], 10)
          const s = parseInt(match[2], 10)
          const msStr = match[3] || ''
          const ms = msStr ? parseInt(msStr, 10) : 0
          const time = m * 60 + s + (msStr ? ms / (msStr.length === 3 ? 1000 : 100) : 0)
          parsed.push({ time, text: textOnly })
        }
      }
    }
    return parsed.sort((a, b) => a.time - b.time)
  }, [rawLyrics])

  // Compute current active lyric snippet
  const activeLyricSnippet = useMemo(() => {
    if (timedLines.length === 0) return null
    const target = currentTime + 0.22
    for (let i = timedLines.length - 1; i >= 0; i--) {
      if (target >= timedLines[i].time) {
        return timedLines[i].text
      }
    }
    return timedLines[0]?.text || null
  }, [timedLines, currentTime])

  // Scrubber drag handler
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return
    const container = e.currentTarget
    setIsDragging(true)

    const calcTime = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const clickX = clientX - rect.left
      const pct = Math.max(0, Math.min(1, clickX / rect.width))
      return pct * duration
    }

    const startVal = calcTime(e.clientX)
    setDragTime(startVal)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setDragTime(calcTime(moveEvent.clientX))
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalVal = calcTime(upEvent.clientX)
      setIsDragging(false)
      seek(finalVal)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Volume slider drag handler
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(parseFloat(e.target.value))
  }

  const handleSearchOnline = async () => {
    if (!currentTrack || isSearchingOnline) return
    setIsSearchingOnline(true)
    try {
      const q = `${currentTrack.title} ${currentTrack.artist || ''}`.trim()
      const results = await window.api.studio.searchLrc(q)
      if (Array.isArray(results) && results.length > 0) {
        const best = results.find((r) => r.syncedLyrics) || results[0]
        const text = best.syncedLyrics || best.plainLyrics
        if (text) {
          setRawLyrics(text)
          if (currentTrack.filePath && !currentTrack.filePath.startsWith('http')) {
            await window.api.studio.saveLrc({
              audioFilePath: currentTrack.filePath,
              title: currentTrack.title,
              artist: currentTrack.artist,
              lrcContent: text
            })
          }
        }
      }
    } catch {}
    setIsSearchingOnline(false)
    setIsMenuOpen(false)
  }

  const coverArtSrc = currentTrack?.coverArt || ''
  const displayTime = isDragging ? dragTime : currentTime
  const progressPct = duration > 0 ? (displayTime / duration) * 100 : 0
  const effectiveVol = isMuted ? 0 : volume

  return (
    <div
      ref={overlayRef}
      className={`now-playing-overlay ${isClosing ? 'closing' : ''}`}
    >
      {/* Blurred background cover art */}
      <div
        className="lyrics-bg-blur"
        style={{ backgroundImage: coverArtSrc ? `url(${coverArtSrc})` : 'none' }}
      />
      <div className="lyrics-darkener" />

      {/* Top Drag & Dismiss Zone */}
      <div
        className="now-playing-top-drag-zone"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.now-playing-top-actions')) return
          handleDragStart(e.clientY)
        }}
        onTouchStart={(e) => {
          if ((e.target as HTMLElement).closest('.now-playing-top-actions')) return
          handleDragStart(e.touches[0].clientY)
        }}
        onWheel={(e) => {
          if (e.deltaY > 20) triggerClose()
        }}
        title="Klik tahan dan tarik ke bawah atau tekan Esc untuk menutup"
      >
        <div className="now-playing-drag-handle-pill" />

        <div className="now-playing-header">
          {/* Action Icons: Close (X) & More Options (...) placed in Top-Left Corner */}
          <div className="now-playing-top-actions">
            <button
              type="button"
              className="now-playing-action-icon-circle"
              onClick={triggerClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} weight="bold" />
            </button>

            <div className="now-playing-options-wrapper" style={{ position: 'relative' }}>
              <button
                type="button"
                className={`now-playing-action-icon-circle ${isMenuOpen ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMenuOpen((prev) => !prev)
                  setIsPlaylistMenuOpen(false)
                }}
                title="More Options"
                aria-label="More Options"
              >
                <DotsThree size={22} weight="bold" />
              </button>

              {isMenuOpen && (
                <div className="track-dropdown-menu lyrics-dropdown-menu">
                  {onAddToPlaylist && currentTrack && (
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setIsPlaylistMenuOpen((p) => !p)
                      }}
                    >
                      <span className="dropdown-item-label">Add to Playlist</span>
                      <PlusCircle size={16} weight="bold" className="dropdown-item-icon" />
                    </button>
                  )}

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      onSwitchToLyrics()
                      setIsMenuOpen(false)
                    }}
                  >
                    <span className="dropdown-item-label">Full Synced Lyrics</span>
                    <ChatTeardropText size={16} weight="bold" className="dropdown-item-icon" />
                  </button>

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={handleSearchOnline}
                    disabled={isSearchingOnline}
                  >
                    <span className="dropdown-item-label">Search Lyrics Online</span>
                    {isSearchingOnline ? (
                      <ArrowClockwise size={16} className="animate-spin dropdown-item-icon" />
                    ) : (
                      <CloudArrowDown size={16} weight="bold" className="dropdown-item-icon" />
                    )}
                  </button>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      if (currentTrack) {
                        const info = `${currentTrack.title} - ${currentTrack.artist || 'Unknown'}`
                        navigator.clipboard?.writeText(info)
                      }
                      setIsMenuOpen(false)
                    }}
                  >
                    <span className="dropdown-item-label">Copy Track Info</span>
                    <Link size={16} weight="bold" className="dropdown-item-icon" />
                  </button>

                  {currentTrack?.filePath && !currentTrack.filePath.startsWith('http') && (
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        window.api.openFileLocation(currentTrack.filePath)
                        setIsMenuOpen(false)
                      }}
                    >
                      <span className="dropdown-item-label">Show in File Manager</span>
                      <FolderOpen size={16} weight="bold" className="dropdown-item-icon" />
                    </button>
                  )}

                  {(currentTrack?.lossless || currentTrack?.container) && (
                    <>
                      <div className="dropdown-divider" />
                      <div className="dropdown-spec-info">
                        <span className="spec-title">Quality: {currentTrack.lossless ? 'Lossless' : currentTrack.container?.toUpperCase()}</span>
                        {currentTrack.bitsPerSample && currentTrack.sampleRate ? (
                          <span className="spec-sub">
                            {currentTrack.bitsPerSample}-bit / {(currentTrack.sampleRate / 1000).toFixed(1)} kHz
                          </span>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Nested Playlist Sub-Popup */}
              {isPlaylistMenuOpen && (
                <div className="now-playing-playlist-popup">
                  <div className="now-playing-popup-header">Add to Playlist</div>
                  {playlists.length === 0 ? (
                    <div className="now-playing-popup-empty">No playlists yet</div>
                  ) : (
                    playlists.map((pl) => (
                      <button
                        key={pl}
                        className="now-playing-popup-item"
                        onClick={() => {
                          if (currentTrack) onAddToPlaylist?.(pl, currentTrack)
                          setIsPlaylistMenuOpen(false)
                          setIsMenuOpen(false)
                        }}
                      >
                        {pl}
                      </button>
                    ))
                  )}
                  {onAddToNewPlaylist && (
                    <button
                      className="now-playing-popup-item create-new"
                      onClick={() => {
                        if (currentTrack) onAddToNewPlaylist(currentTrack)
                        setIsPlaylistMenuOpen(false)
                        setIsMenuOpen(false)
                      }}
                    >
                      + New Playlist
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="now-playing-source-pill">
            <span>{sourceTitle}</span>
          </div>
        </div>
      </div>

      {/* Main Stage: Two-Column Split on Desktop, Adaptive on Narrow Screens */}
      <div className={`now-playing-center-stage ${isBodyQueueOpen ? 'queue-mode-active' : ''}`}>
        
        {/* Responsive Mini Top Card (Visible only when Queue is active on narrow screens) */}
        {isBodyQueueOpen && currentTrack && (
          <div className="now-playing-responsive-mini-card">
            <div className="mini-card-thumb">
              {coverArtSrc ? (
                <img src={coverArtSrc} alt={currentTrack.title} />
              ) : (
                <MusicNotes size={18} weight="light" />
              )}
            </div>
            <div className="mini-card-info">
              <span className="mini-card-title">{currentTrack.title}</span>
              <span className="mini-card-artist">{currentTrack.artist || 'Unknown Artist'}</span>
            </div>
            <div className="mini-card-eq">
              <span className="equalizer-bar bar-1" />
              <span className="equalizer-bar bar-2" />
              <span className="equalizer-bar bar-3" />
            </div>
          </div>
        )}

        <div className="now-playing-split-stage">
          {/* Left Column: Big Album Artwork (Hidden in narrow mode when queue is open) */}
          <div className="now-playing-art-col">
            <div className="now-playing-art-wrapper">
              {coverArtSrc ? (
                <img src={coverArtSrc} alt={currentTrack?.title} className="now-playing-main-art" />
              ) : (
                <div className="now-playing-art-placeholder">
                  <MusicNotes size={90} weight="thin" />
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Queue Mode vs Normal Controls Mode */}
          {isBodyQueueOpen ? (
            /* Queue Column (Image 1 Style) */
            <div className="now-playing-queue-col">
              <div className="now-playing-queue-header">
                <h2 className="now-playing-queue-title">Queue</h2>
              </div>

              <div className="now-playing-queue-scrollable">
                {/* Now Playing Section */}
                <div className="now-playing-queue-section">
                  <span className="now-playing-queue-section-label">Now playing</span>
                  {currentTrack && (
                    <div className="now-playing-queue-card active-card">
                      <div className="queue-card-thumb">
                        {coverArtSrc ? (
                          <img src={coverArtSrc} alt={currentTrack.title} />
                        ) : (
                          <MusicNotes size={18} weight="light" />
                        )}
                      </div>
                      <div className="queue-card-info">
                        <span className="queue-card-title">{currentTrack.title}</span>
                        <span className="queue-card-artist">{currentTrack.artist || 'Unknown Artist'}</span>
                      </div>
                      <div className="queue-card-eq-indicator">
                        <span className="equalizer-bar bar-1" />
                        <span className="equalizer-bar bar-2" />
                        <span className="equalizer-bar bar-3" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Upcoming Queue Section */}
                <div className="now-playing-queue-section">
                  <div className="now-playing-queue-section-header">
                    <span className="now-playing-queue-section-label">Next Up</span>
                    <span className="now-playing-queue-count">{queue.length} songs</span>
                  </div>

                  {queue.length === 0 ? (
                    <div className="now-playing-queue-empty">
                      <span>Queue is empty</span>
                      <p>Add songs from your library to keep the music playing</p>
                    </div>
                  ) : (
                    <div className="now-playing-queue-list">
                      {queue.map((item, qIdx) => (
                        <div
                          key={`${item.filePath}-${qIdx}`}
                          className={`now-playing-queue-row ${draggedQueueIndex === qIdx ? 'is-dragging' : ''} ${dragOverQueueIndex === qIdx ? 'drag-over' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            setDraggedQueueIndex(qIdx)
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', `${qIdx}`)
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            if (dragOverQueueIndex !== qIdx) {
                              setDragOverQueueIndex(qIdx)
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverQueueIndex === qIdx) {
                              setDragOverQueueIndex(null)
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (draggedQueueIndex !== null && draggedQueueIndex !== qIdx) {
                              reorderQueue(draggedQueueIndex, qIdx)
                            }
                            setDraggedQueueIndex(null)
                            setDragOverQueueIndex(null)
                          }}
                          onDragEnd={() => {
                            setDraggedQueueIndex(null)
                            setDragOverQueueIndex(null)
                          }}
                          onClick={() => playTrack(item, queue)}
                          title="Click to play, drag handle to reorder"
                        >
                          <div className="queue-row-drag-handle" title="Drag to reorder">
                            <Equals size={16} weight="bold" />
                          </div>
                          <div className="queue-row-thumb">
                            {item.coverArt ? (
                              <img src={item.coverArt} alt={item.title} />
                            ) : (
                              <MusicNotes size={16} weight="light" />
                            )}
                          </div>
                          <div className="queue-row-info">
                            <span className="queue-row-title">{item.title}</span>
                            <span className="queue-row-artist">{item.artist || 'Unknown Artist'}</span>
                          </div>
                          <button
                            type="button"
                            className="queue-row-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromQueue(item.filePath)
                            }}
                            title="Remove from queue"
                          >
                            <X size={15} weight="bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Normal Controls Column (Image 2 Style) */
            <div className="now-playing-info-col">
              <div className="now-playing-source-tag">
                <span>{sourceTitle}</span>
              </div>

              <div className="now-playing-track-headline">
                <div className="headline-text">
                  <h1 className="now-playing-headline-title" title={currentTrack?.title}>
                    {currentTrack?.title || 'Unknown Title'}
                  </h1>
                  <p className="now-playing-headline-artist" title={currentTrack?.artist}>
                    {currentTrack?.artist || 'Unknown Artist'}
                    {currentTrack?.album ? ` • ${currentTrack.album}` : ''}
                  </p>
                </div>

                {onToggleFavorite && (
                  <button
                    type="button"
                    className={`now-playing-heart-btn ${isFavorite ? 'active' : ''}`}
                    onClick={onToggleFavorite}
                    title={isFavorite ? 'Remove from Liked' : 'Like'}
                  >
                    <Heart size={24} weight={isFavorite ? 'fill' : 'bold'} />
                  </button>
                )}
              </div>

              {/* Live Active Lyric Snippet Line (Clickable -> Switches to Full Lyrics) */}
              <div
                className="now-playing-lyric-snippet-bar"
                onClick={onSwitchToLyrics}
                title="Click to view full synced lyrics"
              >
                <MusicNotes size={15} weight="fill" className="lyric-snippet-note" />
                <span className="lyric-snippet-text">
                  {activeLyricSnippet || (rawLyrics ? 'View Synced Lyrics' : 'Lyrics')}
                </span>
                <CaretRight size={14} weight="bold" className="lyric-snippet-caret" />
              </div>

              {/* Scrubber Timeline */}
              <div className="now-playing-scrubber-deck">
                <div className="now-playing-progress-track" onMouseDown={handleProgressMouseDown}>
                  <div
                    className="now-playing-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="now-playing-time-deck">
                  <span>{formatTime(displayTime)}</span>
                  <span>{formatRemainingTime(displayTime, duration)}</span>
                </div>
              </div>

              {/* Playback Controls Deck: Skip Back, Play/Pause, Skip Forward */}
              <div className="now-playing-deck-controls">
                <button
                  type="button"
                  className="now-playing-ctrl-btn"
                  onClick={onPrevious}
                  title="Previous (Ctrl+Left)"
                >
                  <SkipBack size={32} weight="fill" />
                </button>

                <button
                  type="button"
                  className="now-playing-play-large-btn"
                  onClick={onPlayPause}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause size={28} weight="fill" />
                  ) : (
                    <Play size={28} weight="fill" style={{ marginLeft: '3px' }} />
                  )}
                </button>

                <button
                  type="button"
                  className="now-playing-ctrl-btn"
                  onClick={onNext}
                  title="Next (Ctrl+Right)"
                >
                  <SkipForward size={32} weight="fill" />
                </button>
              </div>

              {/* Volume Slider Deck */}
              <div className="now-playing-volume-deck">
                <button
                  type="button"
                  className="now-playing-deck-vol-btn"
                  onClick={onToggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || effectiveVol === 0 ? (
                    <SpeakerX size={16} weight="bold" />
                  ) : (
                    <SpeakerLow size={16} weight="bold" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effectiveVol}
                  onChange={handleVolumeChange}
                  className="now-playing-deck-slider"
                  title={`Volume: ${Math.round(effectiveVol * 100)}%`}
                />

                <button
                  type="button"
                  className="now-playing-deck-vol-btn"
                  onClick={() => onVolumeChange(1)}
                  title="Max Volume"
                >
                  <SpeakerHigh size={16} weight="bold" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Responsive Compact Controls (Only on Narrow Screens when Queue is active) */}
        {isBodyQueueOpen && (
          <div className="now-playing-responsive-bottom-controls">
            {/* Live Lyric Snippet Bar in Compact Mode */}
            <div
              className="now-playing-lyric-snippet-bar compact"
              onClick={onSwitchToLyrics}
              title="Click to view full synced lyrics"
            >
              <MusicNotes size={14} weight="fill" className="lyric-snippet-note" />
              <span className="lyric-snippet-text">
                {activeLyricSnippet || (rawLyrics ? 'View Synced Lyrics' : 'Lyrics')}
              </span>
              <CaretRight size={13} weight="bold" className="lyric-snippet-caret" />
            </div>

            <div className="now-playing-scrubber-deck compact">
              <div className="now-playing-progress-track" onMouseDown={handleProgressMouseDown}>
                <div
                  className="now-playing-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="now-playing-time-deck">
                <span>{formatTime(displayTime)}</span>
                <span>{formatRemainingTime(displayTime, duration)}</span>
              </div>
            </div>

            <div className="now-playing-deck-controls compact">
              <button
                type="button"
                className="now-playing-ctrl-btn"
                onClick={onPrevious}
                title="Previous"
              >
                <SkipBack size={26} weight="fill" />
              </button>

              <button
                type="button"
                className="now-playing-play-large-btn compact"
                onClick={onPlayPause}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={24} weight="fill" />
                ) : (
                  <Play size={24} weight="fill" style={{ marginLeft: '2px' }} />
                )}
              </button>

              <button
                type="button"
                className="now-playing-ctrl-btn"
                onClick={onNext}
                title="Next"
              >
                <SkipForward size={26} weight="fill" />
              </button>
            </div>

            <div className="now-playing-volume-deck compact">
              <button
                type="button"
                className="now-playing-deck-vol-btn"
                onClick={onToggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || effectiveVol === 0 ? (
                  <SpeakerX size={15} weight="bold" />
                ) : (
                  <SpeakerLow size={15} weight="bold" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effectiveVol}
                onChange={handleVolumeChange}
                className="now-playing-deck-slider"
                title={`Volume: ${Math.round(effectiveVol * 100)}%`}
              />

              <button
                type="button"
                className="now-playing-deck-vol-btn"
                onClick={() => onVolumeChange(1)}
                title="Max Volume"
              >
                <SpeakerHigh size={15} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Floating Pill Dock (Image 1 & 2 Style) */}
        <div className="now-playing-dock-container">
          <div className="now-playing-dock">
            {/* Lyrics Button */}
            <button
              type="button"
              className="now-playing-dock-btn"
              onClick={onSwitchToLyrics}
              title="View Full Synced Lyrics"
            >
              <ChatTeardropText size={19} weight="bold" />
            </button>

            {/* Center Segmented Group: Shuffle & Repeat */}
            <div className="now-playing-dock-segmented">
              <button
                type="button"
                className={`dock-seg-btn ${isShuffle ? 'active' : ''}`}
                onClick={onToggleShuffle}
                title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
              >
                <Shuffle size={16} weight={isShuffle ? 'bold' : 'regular'} />
              </button>

              <button
                type="button"
                className={`dock-seg-btn ${isRepeat !== 'off' ? 'active' : ''}`}
                onClick={onToggleRepeat}
                title={`Repeat: ${isRepeat}`}
              >
                {isRepeat === 'one' ? (
                  <RepeatOnce size={16} weight="bold" />
                ) : (
                  <Repeat size={16} weight={isRepeat === 'all' ? 'bold' : 'regular'} />
                )}
              </button>
            </div>

            {/* Queue Toggle Button */}
            <button
              type="button"
              className={`now-playing-dock-btn ${isBodyQueueOpen ? 'active' : ''}`}
              onClick={() => setIsBodyQueueOpen((prev) => !prev)}
              title={isBodyQueueOpen ? 'Close Queue' : 'Open Queue'}
            >
              <ListBullets size={19} weight="bold" />
            </button>
          </div>

          <div className="now-playing-dock-caption">
            {currentTrack?.lossless ? 'Lossless Hi-Fi • System default' : 'System default'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(NowPlayingView)
