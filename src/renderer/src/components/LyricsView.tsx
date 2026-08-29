import { useEffect, useRef, useState, useMemo, memo, forwardRef } from 'react'
import { MusicNotes, X, Copy, Check, TextAlignLeft, MicrophoneStage } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface LyricLine {
  time: number // in seconds (-1 for plain unsynced lines)
  text: string
  isSpacer?: boolean
}

interface LyricsViewProps {
  currentTrack: TrackMeta | null
  currentTime: number
  seek: (time: number) => void
  onClose: () => void
}

interface LyricLineItemProps { 
  text: string
  time: number
  isActive: boolean
  isPast: boolean
  onClick: () => void
}

const LyricLineItem = forwardRef<HTMLDivElement, LyricLineItemProps>(
  ({ text, time, isActive, isPast, onClick }, ref) => {
    return (
      <div
        ref={ref}
        className={`lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${time === -1 ? 'no-sync' : ''}`}
        onClick={onClick}
      >
        {text}
      </div>
    )
  }
)

LyricLineItem.displayName = 'LyricLineItem'
const MemoizedLyricLineItem = memo(LyricLineItem)

export default function LyricsView({
  currentTrack,
  currentTime,
  seek,
  onClose
}: LyricsViewProps): React.JSX.Element {
  const [rawLyrics, setRawLyrics] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'synced' | 'plain'>('synced')
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const plainContainerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)

  // Fetch lyrics when track changes
  useEffect(() => {
    async function fetchLyrics() {
      if (!currentTrack) {
        setRawLyrics(null)
        return
      }
      try {
        const lyrics = await window.api.getLyrics(currentTrack.filePath)
        setRawLyrics(lyrics)
      } catch (err) {
        console.warn('Error loading lyrics:', err)
        setRawLyrics(null)
      }
    }
    fetchLyrics()
  }, [currentTrack])

  // Parse raw LRC / TXT lyrics
  const { lines: lyricsList, hasTimestamps } = useMemo(() => {
    if (!rawLyrics || !rawLyrics.trim()) {
      return { lines: [], hasTimestamps: false }
    }

    const rawLines = rawLyrics.split(/\r?\n/)
    const timedLines: LyricLine[] = []
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

          timedLines.push({
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

    if (foundAnyTimestamp && timedLines.length > 0) {
      // Sort parsed timed lyrics chronologically
      timedLines.sort((a, b) => a.time - b.time)
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
  }, [currentTrack, hasTimestamps, viewMode])

  // Is active view mode synced?
  const isSyncedActive = hasTimestamps && viewMode === 'synced'

  // Determine current active lyric line for synced lyrics
  const activeIndex = useMemo(() => {
    if (!isSyncedActive || lyricsList.length === 0) return -1
    const firstTimedLine = lyricsList.find((l) => l.time >= 0)
    if (!firstTimedLine || currentTime < firstTimedLine.time) return -1

    for (let i = lyricsList.length - 1; i >= 0; i--) {
      if (lyricsList[i].time >= 0 && currentTime >= lyricsList[i].time) {
        return i
      }
    }
    return -1
  }, [isSyncedActive, lyricsList, currentTime])

  // Smooth scroll active lyric line into center of container
  useEffect(() => {
    if (!isSyncedActive) return

    if (activeIndex === -1) {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      }
    } else if (activeLineRef.current && containerRef.current) {
      const activeLine = activeLineRef.current
      const container = containerRef.current

      const activeTop = activeLine.offsetTop
      const activeHeight = activeLine.offsetHeight
      const containerHeight = container.offsetHeight

      const targetScrollTop = activeTop - containerHeight / 2 + activeHeight / 2

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      })
    }
  }, [isSyncedActive, activeIndex])

  const handleLineClick = (time: number) => {
    if (time >= 0) {
      seek(time)
    }
  }

  const coverArtSrc = currentTrack?.coverArt || ''

  return (
    <div className="lyrics-view-overlay">
      {/* Blurred background cover art */}
      <div
        className="lyrics-bg-blur"
        style={{ backgroundImage: coverArtSrc ? `url(${coverArtSrc})` : 'none' }}
      />
      <div className="lyrics-darkener" />

      {/* Close button */}
      <button className="lyrics-close-btn" onClick={onClose} title="Close Lyrics">
        <X size={20} weight="bold" />
      </button>

      <div className="lyrics-content-container">
        {/* Left column: Big cover art and info */}
        <div className="lyrics-left-info">
          <div className="lyrics-cover-wrapper">
            {coverArtSrc ? (
              <img src={coverArtSrc} alt={currentTrack?.title} className="lyrics-big-cover" />
            ) : (
              <div className="lyrics-big-cover-placeholder">
                <MusicNotes size={64} weight="thin" color="rgba(255,255,255,0.2)" />
              </div>
            )}
          </div>
          <div className="lyrics-track-meta">
            <h1 className="lyrics-track-title">{currentTrack?.title || 'Unknown Title'}</h1>
            <p className="lyrics-track-artist">{currentTrack?.artist || 'Unknown Artist'}</p>
            <p className="lyrics-track-album">{currentTrack?.album || 'Unknown Album'}</p>
          </div>
        </div>

        {/* Right column: Lyrics view */}
        <div
          className={`lyrics-right-list ${!isSyncedActive ? 'plain-mode' : ''}`}
          ref={isSyncedActive ? containerRef : plainContainerRef}
        >
          {lyricsList.length === 0 ? (
            <div className="lyrics-empty-state">
              <MusicNotes size={32} weight="light" style={{ marginBottom: '12px', opacity: 0.4 }} />
              <p>No lyrics found for this track</p>
              <span className="lyrics-empty-subtitle">
                Put a `.lrc` or `.txt` file with the same name next to the audio file to load lyrics automatically.
              </span>
            </div>
          ) : (
            <>

              {/* Mode 1: Synced karaoke style lyrics */}
              {isSyncedActive ? (
                <div className="lyrics-scroller">
                  {lyricsList.map((line, idx) => {
                    const isActive = idx === activeIndex
                    const isPast = idx < activeIndex

                    return (
                      <MemoizedLyricLineItem
                        key={idx}
                        ref={isActive ? activeLineRef : null}
                        text={line.text}
                        time={line.time}
                        isActive={isActive}
                        isPast={isPast}
                        onClick={() => handleLineClick(line.time)}
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
                        {line.text}
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
