import { useState } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  SpeakerHigh,
  SpeakerLow,
  SpeakerX,
  MusicNotes,
  List
} from '@phosphor-icons/react'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { TrackMeta } from '../context/AudioContext'

interface PlayerBarProps {
  onToggleQueue?: () => void
  isQueueOpen?: boolean
}

export default function PlayerBar({ onToggleQueue, isQueueOpen }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    isRepeat,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat
  } = useAudioEngine()

  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)

  // Format time (e.g. 182s -> 3:02)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Generate audio quality details badge text with extension fallbacks if metadata is not yet scanned
  const getAudioQualityString = (track: TrackMeta) => {
    const ext = track.filePath.split('.').pop()?.toLowerCase() || ''
    
    // 1. Container / Format name (e.g. FLAC, MP3, etc.)
    const container = track.container 
      ? track.container.toUpperCase() 
      : (ext === 'm4a' ? 'M4A' : ext.toUpperCase())
    
    // 2. Classify quality (Hi-Res Lossless, Lossless, Lossy)
    const isLosslessExt = ['flac', 'wav', 'alac', 'ape'].includes(ext)
    const isLossless = track.lossless !== undefined ? track.lossless : isLosslessExt

    let qualityLabel = ''
    if (isLossless) {
      const isHiRes = (track.sampleRate && track.sampleRate > 44100) || (track.bitsPerSample && track.bitsPerSample > 16)
      qualityLabel = isHiRes ? 'Hi-Res' : 'Lossless'
    }
    
    // 3. Technical details (e.g. 24-bit / 96 kHz or 320 kbps)
    let techDetails = ''
    if (isLossless) {
      const bitDepth = track.bitsPerSample ? `${track.bitsPerSample}-bit` : ''
      const sampleRateKhz = track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)} kHz` : ''
      techDetails = [bitDepth, sampleRateKhz].filter(Boolean).join(' / ')
    } else if (track.bitrate) {
      techDetails = `${Math.round(track.bitrate / 1000)} kbps`
    }

    // Combine them into a clean string, e.g.: "FLAC • Hi-Res • 24-bit / 96 kHz"
    return [container, qualityLabel, techDetails].filter(Boolean).join(' • ')
  }

  // Calculate percentages
  const displayTime = isDragging ? dragTime : currentTime
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0
  const volumePercent = isMuted ? 0 : volume * 100

  // Interactive progress dragging
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return
    const container = e.currentTarget
    setIsDragging(true)
    
    const getCalculatedTime = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const clickX = clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      return percentage * duration
    }

    const initialTime = getCalculatedTime(e.clientX)
    setDragTime(initialTime)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newTime = getCalculatedTime(moveEvent.clientX)
      setDragTime(newTime)
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalTime = getCalculatedTime(upEvent.clientX)
      seek(finalTime)
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Interactive volume dragging
  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    
    const updateVolume = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const clickX = clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      changeVolume(percentage)
    }

    updateVolume(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateVolume(moveEvent.clientX)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Choose correct speaker icon based on volume & mute state
  const getSpeakerIcon = () => {
    if (isMuted || volume === 0) return <SpeakerX size={20} weight="light" />
    if (volume < 0.5) return <SpeakerLow size={20} weight="light" />
    return <SpeakerHigh size={20} weight="light" />
  }

  return (
    <div className="player-bar">
      {/* Playback progress bar edge */}
      <div className="progress-container" onMouseDown={handleProgressMouseDown}>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
            <div className="progress-thumb" />
          </div>
        </div>
      </div>

      {/* Left side: Song details */}
      <div className="player-track-info">
        <div className="player-art">
          {currentTrack?.coverArt ? (
            <img src={currentTrack.coverArt} alt="Cover Art" />
          ) : (
            <MusicNotes size={22} weight="light" />
          )}
        </div>
        <div className="player-details">
          <span className="player-title">{currentTrack?.title || 'Not Playing'}</span>
          <div className="player-artist-row">
            <span className="player-artist">{currentTrack?.artist || 'Select a song'}</span>
            {currentTrack && (
              <span className="audio-quality-badge">
                {getAudioQualityString(currentTrack)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center side: Controls */}
      <div className="player-controls-container">
        <div className="player-buttons">
          <button
            className={`btn-control ${isShuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <Shuffle size={18} weight="light" />
          </button>

          <button className="btn-control" onClick={prevTrack} title="Previous">
            <SkipBack size={20} weight="light" />
          </button>

          <button className="btn-play-pause" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
          </button>

          <button className="btn-control" onClick={nextTrack} title="Next">
            <SkipForward size={20} weight="light" />
          </button>

          <button
            className={`btn-control ${isRepeat !== 'off' ? 'active' : ''}`}
            onClick={toggleRepeat}
            title={`Repeat: ${isRepeat}`}
          >
            <Repeat size={18} weight="light" />
          </button>
        </div>

        <div className="player-time-display">
          <span>{formatTime(displayTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right side: Volume & Extra options */}
      <div className="player-utilities">
        {onToggleQueue && (
          <button
            className={`btn-control ${isQueueOpen ? 'active' : ''}`}
            onClick={onToggleQueue}
            title="Queue"
          >
            <List size={20} weight="light" />
          </button>
        )}

        <div className="volume-control">
          <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} className="btn-control">
            {getSpeakerIcon()}
          </button>
          <div className="volume-slider-wrapper" onMouseDown={handleVolumeMouseDown}>
            <div className="volume-track">
              <div className="volume-fill" style={{ width: `${volumePercent}%` }}>
                <div className="volume-thumb" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

