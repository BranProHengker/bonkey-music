import { useEffect, useRef, useState, useMemo, useCallback, memo, forwardRef } from 'react'
import { MusicNotes, X, CloudArrowDown, ArrowClockwise, DotsThree } from '@phosphor-icons/react'
import { TrackMeta, useAudioTime } from '../hooks/useAudioEngine'

interface LyricLine {
  time: number // in seconds (-1 for plain unsynced lines)
  text: string
  subText?: string // Romaji / secondary translation line for dual-line lyrics
  isSpacer?: boolean
}

interface LyricsViewProps {
  currentTrack: TrackMeta | null
  currentTime?: number
  seek: (time: number) => void
  onClose: () => void
  isQueueOpen?: boolean
  onCloseQueue?: () => void
  onSwitchToNowPlaying?: () => void
}

interface LyricLineItemProps {
  text: string
  subText?: string
  time: number
  isActive: boolean
  isPast: boolean
  distance: number
  onLineClick: (time: number) => void
}

const LyricLineItem = forwardRef<HTMLDivElement, LyricLineItemProps>(
  ({ text, subText, time, isActive, isPast, distance, onLineClick }, ref) => {
    const clampedDistance = time === -1 ? -1 : Math.min(3, Math.max(0, distance))
    return (
      <div
        ref={ref}
        className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${time === -1 ? 'no-sync' : ''} ${subText ? 'dual-line' : ''}`}
        data-distance={clampedDistance}
        onClick={() => onLineClick(time)}
      >
        <div className="lyric-main-text">{text}</div>
        {subText && <div className="lyric-sub-text">{subText}</div>}
      </div>
    )
  }
)

LyricLineItem.displayName = 'LyricLineItem'
const MemoizedLyricLineItem = memo(LyricLineItem)

function LyricsView({
  currentTrack,
  currentTime: propCurrentTime,
  seek,
  onClose,
  isQueueOpen = false,
  onCloseQueue,
  onSwitchToNowPlaying
}: LyricsViewProps): React.JSX.Element {
  const hookTime = useAudioTime()
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : hookTime
  const [rawLyrics, setRawLyrics] = useState<string | null>(null)
  const [isSearchingOnline, setIsSearchingOnline] = useState(false)
  const [onlineSearchNotice, setOnlineSearchNotice] = useState<string | null>(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Close dropdown on click outside
  useEffect(() => {
    if (!isMenuOpen) return
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.lyrics-options-wrapper')) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [isMenuOpen])

  const containerRef = useRef<HTMLDivElement>(null)
  const plainContainerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)

  // Close with ESC key: closes Queue first if open, else closes Lyrics overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isQueueOpen && onCloseQueue) {
          onCloseQueue()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isQueueOpen, onCloseQueue])

  // Fetch lyrics when track changes (Strictly Offline-First from local files or embedded tags)
  useEffect(() => {
    let isCancelled = false
    setOnlineSearchNotice(null)

    async function fetchLyrics() {
      if (!currentTrack) {
        setRawLyrics(null)
        return
      }
      try {
        const localLyrics = await window.api.getLyrics(currentTrack.filePath)
        if (!isCancelled) {
          setRawLyrics(localLyrics)
        }
      } catch (err) {
        console.warn('Error loading lyrics:', err)
        if (!isCancelled) {
          setRawLyrics(null)
        }
      }
    }
    fetchLyrics()

    return () => {
      isCancelled = true
    }
  }, [currentTrack])

  // On-demand manual online search button (optional, keeps app strictly offline by default)
  const handleSearchOnlineLyrics = async () => {
    if (!currentTrack || !currentTrack.title || isSearchingOnline) return

    setIsSearchingOnline(true)
    setOnlineSearchNotice(null)

    try {
      const query = `${currentTrack.title} ${currentTrack.artist || ''}`.trim()
      const searchResults = await window.api.studio.searchLrc(query)
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const best = searchResults.find((r) => r.syncedLyrics) || searchResults[0]
        const lyricText = best.syncedLyrics || best.plainLyrics || null
        if (lyricText) {
          setRawLyrics(lyricText)
          // If local file, save alongside automatically so it's cached offline
          if (currentTrack.filePath && !currentTrack.filePath.startsWith('http')) {
            try {
              await window.api.studio.saveLrc({
                audioFilePath: currentTrack.filePath,
                title: currentTrack.title,
                artist: currentTrack.artist,
                lrcContent: lyricText
              })
            } catch {}
          }
          return
        }
      }
      setOnlineSearchNotice('No lyrics found online on LRCLIB')
    } catch (err) {
      console.warn('Failed to search online lyrics:', err)
      setOnlineSearchNotice('Failed to connect to LRCLIB')
    } finally {
      setIsSearchingOnline(false)
    }
  }

  // Parse raw LRC / TXT lyrics
  const { lines: lyricsList, hasTimestamps } = useMemo(() => {
    if (!rawLyrics || !rawLyrics.trim()) {
      return { lines: [], hasTimestamps: false }
    }

    const rawLines = rawLyrics.split(/\r?\n/)
    const rawTimedLines: { time: number; text: string }[] = []
    const plainLines: LyricLine[] = []
    let foundAnyTimestamp = false

    for (const rawLine of rawLines) {
      const line = rawLine.trimEnd()

      // Match timestamps like [00:12.34], [0:12.34], [00:12:34], [00:12], [00:12.345]
      const timestampRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g
      const matches = Array.from(line.matchAll(timestampRegex))

      if (matches.length > 0) {
        foundAnyTimestamp = true
        const textOnly = line.replace(timestampRegex, '').trim()
        const displayText = textOnly || '♩'

        for (const match of matches) {
          const minutes = parseInt(match[1], 10)
          const seconds = parseInt(match[2], 10)
          const msStr = match[3] || ''
          const ms = msStr ? parseInt(msStr, 10) : 0
          const time = minutes * 60 + seconds + (msStr ? ms / (msStr.length === 3 ? 1000 : 100) : 0)

          rawTimedLines.push({
            time,
            text: displayText
          })
        }
      } else {
        const trimmed = line.trim()
        // Skip metadata tags like [ti:Title], [ar:Artist], [al:Album], [by:...], [offset:...], [length:...]
        if (/^\[[a-zA-Z]{2,6}:.*\]$/.test(trimmed)) {
          continue
        }

        if (trimmed === '') {
          plainLines.push({
            time: -1,
            text: '',
            isSpacer: true
          })
        } else {
          plainLines.push({
            time: -1,
            text: trimmed
          })
        }
      }
    }

    if (foundAnyTimestamp && rawTimedLines.length > 0) {
      // Sort parsed timed lyrics chronologically (stable sort preserves original order for identical timestamps)
      const sortedTimed = rawTimedLines.slice().sort((a, b) => a.time - b.time)

      // Group identical timestamps together as dual-line lyrics (e.g. Original + Romaji/Translation)
      const timedLines: LyricLine[] = []
      for (const item of sortedTimed) {
        if (
          timedLines.length > 0 &&
          Math.abs(timedLines[timedLines.length - 1].time - item.time) < 0.05
        ) {
          const lastLine = timedLines[timedLines.length - 1]
          if (lastLine.subText) {
            lastLine.subText += '\n' + item.text
          } else {
            lastLine.subText = item.text
          }
        } else {
          timedLines.push({
            time: item.time,
            text: item.text
          })
        }
      }

      return { lines: timedLines, hasTimestamps: true }
    } else {
      // Clean up leading and trailing spacers for plain text
      let start = 0
      while (start < plainLines.length && plainLines[start].isSpacer) {
        start++
      }
      let end = plainLines.length - 1
      while (end >= 0 && plainLines[end].isSpacer) {
        end--
      }
      const cleaned = start <= end ? plainLines.slice(start, end + 1) : []
      return { lines: cleaned, hasTimestamps: false }
    }
  }, [rawLyrics])

  // Reset scroll when plain mode or track changes
  useEffect(() => {
    if (plainContainerRef.current) {
      plainContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentTrack, hasTimestamps])

  // Is active view mode synced?
  const isSyncedActive = hasTimestamps

  // Karaoke lead time: triggers active line ~220ms earlier so lyrics are ready ahead of vocals
  const LYRIC_LEAD_TIME = 0.22

  // Determine current active lyric line for synced lyrics
  const activeIndex = useMemo(() => {
    if (!isSyncedActive || lyricsList.length === 0) return -1
    const targetTime = currentTime + LYRIC_LEAD_TIME
    const firstTimedLine = lyricsList.find((l) => l.time >= 0)
    if (!firstTimedLine || targetTime < firstTimedLine.time) return -1

    for (let i = lyricsList.length - 1; i >= 0; i--) {
      if (lyricsList[i].time >= 0 && targetTime >= lyricsList[i].time) {
        return i
      }
    }
    return -1
  }, [isSyncedActive, lyricsList, currentTime])

  // Hardware-accelerated compositor transform positioning
  const [targetTranslateY, setTargetTranslateY] = useState(0)
  const [userOffset, setUserOffset] = useState(0)
  const [isUserInteracting, setIsUserInteracting] = useState(false)
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recalculate target translate position when activeIndex changes
  useEffect(() => {
    if (!isSyncedActive || !containerRef.current) return

    if (activeIndex === -1) {
      setTargetTranslateY(containerRef.current.clientHeight * 0.25)
      return
    }

    if (activeLineRef.current && containerRef.current) {
      const activeLine = activeLineRef.current
      const container = containerRef.current

      const activeTop = activeLine.offsetTop
      const activeHeight = activeLine.offsetHeight
      const containerHeight = container.clientHeight

      // Eye-level karaoke reading: active line at ~32% from top of container
      const targetCenter = containerHeight * 0.32 - (activeTop + activeHeight / 2)
      setTargetTranslateY(targetCenter)
    }
  }, [isSyncedActive, activeIndex, isQueueOpen])

  // Keep center aligned during window resize
  useEffect(() => {
    function handleResize() {
      if (!isSyncedActive || !containerRef.current || !activeLineRef.current) return
      const activeLine = activeLineRef.current
      const container = containerRef.current
      const targetCenter = container.clientHeight * 0.32 - (activeLine.offsetTop + activeLine.offsetHeight / 2)
      setTargetTranslateY(targetCenter)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isSyncedActive])

  // Reset scroll offset on track change
  useEffect(() => {
    setUserOffset(0)
    setIsUserInteracting(false)
  }, [currentTrack])

  // User manual wheel scroll handling
  const handleWheel = (e: React.WheelEvent) => {
    if (!isSyncedActive) return
    setIsUserInteracting(true)
    setUserOffset((prev) => prev - e.deltaY * 0.85)

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false)
      setUserOffset(0) // Smoothly glides back to center
    }, 2500)
  }

  const handleLineClick = useCallback(
    (time: number) => {
      if (time >= 0) {
        setIsUserInteracting(false)
        setUserOffset(0)
        if (userScrollTimeoutRef.current) {
          clearTimeout(userScrollTimeoutRef.current)
        }
        seek(time)
      }
    },
    [seek]
  )

  const coverArtSrc = currentTrack?.coverArt || ''

  return (
    <div className={`lyrics-view-overlay ${isQueueOpen ? 'queue-open' : ''}`}>
      {/* Blurred background cover art */}
      <div
        className="lyrics-bg-blur"
        style={{ backgroundImage: coverArtSrc ? `url(${coverArtSrc})` : 'none' }}
      />
      <div className="lyrics-darkener" />

      {/* Top Navigation & Track Bar */}
      <div className="lyrics-top-bar">
        {/* Action Icons in Top-Left Corner: Close (X) & More Options (...) */}
        <div className="lyrics-top-actions">
          <button
            type="button"
            className="lyrics-action-btn-circle"
            onClick={onClose}
            title="Close Lyrics (Esc)"
            aria-label="Close Lyrics (Esc)"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="lyrics-options-wrapper">
            <button
              type="button"
              className={`lyrics-action-btn-circle ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Lyrics Options"
              aria-label="Lyrics Options"
            >
              <DotsThree size={22} weight="bold" />
            </button>

            {isMenuOpen && (
              <div className="lyrics-dropdown-menu">
                {onSwitchToNowPlaying && (
                  <button
                    type="button"
                    className="lyrics-menu-item"
                    onClick={() => {
                      setIsMenuOpen(false)
                      onSwitchToNowPlaying()
                    }}
                  >
                    <MusicNotes size={16} weight="bold" />
                    <span>Now Playing (Cover View)</span>
                  </button>
                )}

                <button
                  type="button"
                  className="lyrics-menu-item"
                  onClick={() => {
                    handleSearchOnlineLyrics()
                    setIsMenuOpen(false)
                  }}
                  disabled={isSearchingOnline}
                >
                  {isSearchingOnline ? (
                    <ArrowClockwise size={16} className="animate-spin" />
                  ) : (
                    <CloudArrowDown size={16} weight="bold" />
                  )}
                  <span>{isSearchingOnline ? 'Searching LRCLIB...' : 'Search Lyrics Online (LRCLIB)'}</span>
                </button>

                {(currentTrack?.lossless || currentTrack?.container) && (
                  <div className="lyrics-menu-info">
                    <span>Format: {currentTrack.lossless ? 'Lossless' : currentTrack.container?.toUpperCase()}</span>
                    {currentTrack.bitsPerSample && currentTrack.sampleRate ? (
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>
                        {currentTrack.bitsPerSample}-bit / {(currentTrack.sampleRate / 1000).toFixed(1)} kHz
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="lyrics-menu-info">
                  <span>Mode: {isSyncedActive ? 'Synced Karaoke (LRC)' : 'Plain Text Lyrics'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="lyrics-track-pill"
          onClick={onSwitchToNowPlaying}
          style={{ cursor: onSwitchToNowPlaying ? 'pointer' : 'default' }}
          title={onSwitchToNowPlaying ? 'Switch to Now Playing (Cover View)' : undefined}
        >
          {coverArtSrc ? (
            <img src={coverArtSrc} alt={currentTrack?.title} className="lyrics-pill-thumb" />
          ) : (
            <div className="lyrics-pill-thumb-placeholder">
              <MusicNotes size={18} weight="bold" />
            </div>
          )}
          <div className="lyrics-pill-info">
            <span className="lyrics-pill-title" title={currentTrack?.title}>
              {currentTrack?.title || 'Unknown Title'}
            </span>
            <span className="lyrics-pill-artist" title={currentTrack?.artist}>
              {currentTrack?.artist || 'Unknown Artist'}
            </span>
          </div>
        </div>
      </div>

      <div className={`lyrics-content-container ${isQueueOpen ? 'with-queue' : ''}`}>
        <div
          className={`lyrics-right-list ${!isSyncedActive ? 'plain-mode' : ''}`}
          ref={isSyncedActive ? containerRef : plainContainerRef}
          onWheel={handleWheel}
        >
          {lyricsList.length === 0 ? (
            <div className="lyrics-empty-state">
              <MusicNotes size={32} weight="light" style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p>No lyrics found for this track</p>
              <span className="lyrics-empty-subtitle" style={{ marginBottom: '16px' }}>
                Put a `.lrc` or `.txt` file with the same name next to the audio file to load lyrics automatically.
              </span>

              {/* Manual On-Demand Online Search Button */}
              {window.api?.studio && currentTrack && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="studio-btn-secondary"
                    onClick={handleSearchOnlineLyrics}
                    disabled={isSearchingOnline}
                    style={{
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    {isSearchingOnline ? (
                      <ArrowClockwise size={15} className="animate-spin" />
                    ) : (
                      <CloudArrowDown size={15} weight="bold" />
                    )}
                    <span>{isSearchingOnline ? 'Searching LRCLIB...' : 'Search Lyrics Online'}</span>
                  </button>

                  {onlineSearchNotice && (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {onlineSearchNotice}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Mode 1: Synced karaoke style lyrics */}
              {isSyncedActive ? (
                <div
                  className="lyrics-scroller"
                  style={{
                    transform: `translate3d(0, ${Math.round(targetTranslateY + userOffset)}px, 0)`,
                    transition: isUserInteracting
                      ? 'transform 0.1s ease-out'
                      : 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {lyricsList.map((line, idx) => {
                    const isActive = idx === activeIndex
                    const isPast = idx < activeIndex
                    const distance = activeIndex === -1 ? 999 : Math.abs(idx - activeIndex)

                    return (
                      <MemoizedLyricLineItem
                        key={idx}
                        ref={isActive ? activeLineRef : null}
                        text={line.text}
                        subText={line.subText}
                        time={line.time}
                        isActive={isActive}
                        isPast={isPast}
                        distance={distance}
                        onLineClick={handleLineClick}
                      />
                    )
                  })}
                </div>
              ) : (
                /* Mode 2: Plain full text lyrics (directly readable, whole text from top to bottom) */
                <div className="lyrics-plain-scroller">
                  {lyricsList.map((line, idx) => {
                    if (line.isSpacer) {
                      return <div key={`spacer-${idx}`} className="lyrics-plain-spacer" />
                    }
                    return (
                      <div key={idx} className="lyrics-plain-line">
                        <div className="lyrics-plain-main">{line.text}</div>
                        {line.subText && <div className="lyrics-plain-sub">{line.subText}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(LyricsView)
