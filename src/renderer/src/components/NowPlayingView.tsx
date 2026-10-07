import { useEffect, useState, useMemo, memo } from 'react'
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
  ArrowClockwise
} from '@phosphor-icons/react'
import { TrackMeta, useAudioTime } from '../hooks/useAudioEngine'

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
  onToggleQueue,
  sourceTitle = 'Playing from Queue'
}: NowPlayingViewProps): React.JSX.Element {
  const currentTime = useAudioTime()
  const [rawLyrics, setRawLyrics] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [isSearchingOnline, setIsSearchingOnline] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close dropdown on click outside
  useEffect(() => {
    if (!isMenuOpen) return
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.now-playing-options-wrapper')) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [isMenuOpen])

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
    <div className="now-playing-overlay">
      {/* Blurred background cover art */}
      <div
        className="lyrics-bg-blur"
        style={{ backgroundImage: coverArtSrc ? `url(${coverArtSrc})` : 'none' }}
      />
      <div className="lyrics-darkener" />

      {/* Top Header Bar */}
      <div className="now-playing-header">
        <div className="now-playing-source-pill">
          <span>{sourceTitle}</span>
        </div>

        <button
          type="button"
          className="now-playing-close-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Main Center Stage */}
      <div className="now-playing-center-stage">
        {/* Big Album Artwork */}
        <div className="now-playing-cover-box">
          {coverArtSrc ? (
            <img src={coverArtSrc} alt={currentTrack?.title} className="now-playing-cover-img" />
          ) : (
            <div className="now-playing-cover-placeholder">
              <MusicNotes size={80} weight="thin" color="rgba(255,255,255,0.25)" />
            </div>
          )}
        </div>

        {/* Track Metadata & Options */}
        <div className="now-playing-meta-row">
          <div className="now-playing-text-group">
            <h1 className="now-playing-title" title={currentTrack?.title}>
              {currentTrack?.title || 'Unknown Title'}
            </h1>
            <p className="now-playing-artist" title={currentTrack?.artist}>
              {currentTrack?.artist || 'Unknown Artist'}
            </p>
          </div>

          <div className="now-playing-options-wrapper">
            <button
              type="button"
              className={`now-playing-option-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="More Options"
              aria-label="More Options"
            >
              <DotsThree size={22} weight="bold" />
            </button>

            {isMenuOpen && (
              <div className="lyrics-dropdown-menu">
                <button
                  type="button"
                  className="lyrics-menu-item"
                  onClick={onSwitchToLyrics}
                >
                  <ChatTeardropText size={16} weight="bold" />
                  <span>Full Synced Lyrics</span>
                </button>

                <button
                  type="button"
                  className="lyrics-menu-item"
                  onClick={handleSearchOnline}
                  disabled={isSearchingOnline}
                >
                  {isSearchingOnline ? (
                    <ArrowClockwise size={16} className="animate-spin" />
                  ) : (
                    <CloudArrowDown size={16} weight="bold" />
                  )}
                  <span>Search Lyrics Online (LRCLIB)</span>
                </button>

                {(currentTrack?.lossless || currentTrack?.container) && (
                  <div className="lyrics-menu-info">
                    <span>Quality: {currentTrack.lossless ? 'Lossless' : currentTrack.container?.toUpperCase()}</span>
                    {currentTrack.bitsPerSample && currentTrack.sampleRate ? (
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>
                        {currentTrack.bitsPerSample}-bit / {(currentTrack.sampleRate / 1000).toFixed(1)} kHz
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Active Lyric Snippet Pill (Clickable -> Switches to Full Lyrics) */}
        <div
          className="now-playing-lyric-pill"
          onClick={onSwitchToLyrics}
          title="Click to view full lyrics"
        >
          <span className="now-playing-lyric-text">
            {activeLyricSnippet || (rawLyrics ? 'View Synced Lyrics' : 'Lyrics')}
          </span>
          <CaretRight size={14} weight="bold" className="now-playing-lyric-arrow" />
        </div>

        {/* Timeline Scrubber */}
        <div className="now-playing-scrubber-box">
          <div className="now-playing-progress-track" onMouseDown={handleProgressMouseDown}>
            <div
              className="now-playing-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="now-playing-time-row">
            <span>{formatTime(displayTime)}</span>
            <span>{formatRemainingTime(displayTime, duration)}</span>
          </div>
        </div>

        {/* Playback Controls (Previous, Play/Pause, Next) */}
        <div className="now-playing-controls-row">
          <button
            type="button"
            className="now-playing-btn-ctrl"
            onClick={onPrevious}
            title="Previous (Ctrl+Left)"
            aria-label="Previous"
          >
            <SkipBack size={32} weight="fill" />
          </button>

          <button
            type="button"
            className="now-playing-btn-play"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={28} weight="fill" />
            ) : (
              <Play size={28} weight="fill" style={{ marginLeft: '3px' }} />
            )}
          </button>

          <button
            type="button"
            className="now-playing-btn-ctrl"
            onClick={onNext}
            title="Next (Ctrl+Right)"
            aria-label="Next"
          >
            <SkipForward size={32} weight="fill" />
          </button>
        </div>

        {/* Volume Slider Bar */}
        <div className="now-playing-volume-row">
          <button
            type="button"
            className="now-playing-vol-btn"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || effectiveVol === 0 ? (
              <SpeakerX size={18} weight="bold" />
            ) : (
              <SpeakerLow size={18} weight="bold" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectiveVol}
            onChange={handleVolumeChange}
            className="now-playing-vol-slider"
            title={`Volume: ${Math.round(effectiveVol * 100)}%`}
          />

          <button
            type="button"
            className="now-playing-vol-btn"
            onClick={() => onVolumeChange(1)}
            title="Max Volume"
          >
            <SpeakerHigh size={18} weight="bold" />
          </button>
        </div>

        {/* Bottom Toolbar: Lyrics & Queue */}
        <div className="now-playing-bottom-toolbar">
          <button
            type="button"
            className="now-playing-tool-btn"
            onClick={onSwitchToLyrics}
            title="Open Full Lyrics"
          >
            <ChatTeardropText size={22} weight="bold" />
          </button>

          {onToggleQueue && (
            <button
              type="button"
              className="now-playing-tool-btn"
              onClick={onToggleQueue}
              title="Playing Queue"
            >
              <ListBullets size={22} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(NowPlayingView)
