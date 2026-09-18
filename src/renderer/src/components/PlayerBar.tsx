import { useState, useEffect, useRef } from 'react'
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
  List,
  ChatTeardropText,
  PlusCircle
} from '@phosphor-icons/react'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { TrackMeta } from '../context/AudioContext'

interface PlayerBarProps {
  onToggleQueue?: () => void
  isQueueOpen?: boolean
  onToggleLyrics?: () => void
  isLyricsOpen?: boolean
  displayedTracks?: TrackMeta[]
  playlists?: string[]
  favorites?: string[]
  onAddToQueue?: (track: TrackMeta) => void
  onToggleFavorite?: (filePath: string) => void
  onAddToPlaylist?: (playlistName: string, track: TrackMeta) => void
  onAddToNewPlaylist?: (track: TrackMeta) => void
}

export default function PlayerBar({
  onToggleQueue,
  isQueueOpen,
  onToggleLyrics,
  isLyricsOpen,
  displayedTracks,
  playlists,
  favorites,
  onAddToQueue,
  onToggleFavorite,
  onAddToPlaylist,
  onAddToNewPlaylist
}: PlayerBarProps) {
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
    playTrack,
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

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false)
  const plusMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setIsPlusMenuOpen(false)
      }
    }
    if (isPlusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPlusMenuOpen])

  const handlePlayClick = () => {
    if (currentTrack) {
      togglePlay()
    } else if (displayedTracks && displayedTracks.length > 0) {
      if (isShuffle) {
        const randomIndex = Math.floor(Math.random() * displayedTracks.length)
        playTrack(displayedTracks[randomIndex], displayedTracks)
      } else {
        playTrack(displayedTracks[0], displayedTracks)
      }
    }
  }

  // Format time (e.g. 182s -> 3:02)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  // Get short format badge (e.g. "FLAC", "MP3")
  const getAudioFormatBadge = (track: TrackMeta) => {
    const ext = track.filePath.split('.').pop()?.toLowerCase() || ''
    return track.container ? track.container.toUpperCase() : (ext === 'm4a' ? 'M4A' : ext.toUpperCase())
  }

  // Get tech details (e.g. "Lossless • 16-bit / 44.1 kHz" or "320 kbps")
  const getAudioTechDetailsString = (track: TrackMeta) => {
    const ext = track.filePath.split('.').pop()?.toLowerCase() || ''
    
    // 1. Classify quality
    const isLosslessExt = ['flac', 'wav', 'alac', 'ape'].includes(ext)
    const isLossless = track.lossless !== undefined ? track.lossless : isLosslessExt

    const parts: string[] = []
    
    if (isLossless) {
      const isHiRes = (track.sampleRate && track.sampleRate > 44100) || (track.bitsPerSample && track.bitsPerSample > 16)
      parts.push(isHiRes ? 'Hi-Res Lossless' : 'Lossless')
      
      const bitDepth = track.bitsPerSample ? `${track.bitsPerSample}-bit` : ''
      const sampleRateKhz = track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 === 0 ? 0 : 1)} kHz` : ''
      const tech = [bitDepth, sampleRateKhz].filter(Boolean).join(' / ')
      if (tech) parts.push(tech)
    } else {
      parts.push('Lossy')
      if (track.bitrate) {
        parts.push(`${Math.round(track.bitrate / 1000)} kbps`)
      }
    }

    return parts.join(' • ')
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
      {/* Paling Kiri: Kontrol Playback */}
      <div className="player-controls-left">
        <button className="btn-control" onClick={prevTrack} title="Previous">
          <SkipBack size={20} weight="light" />
        </button>

        <button className="btn-play-pause" onClick={handlePlayClick} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
        </button>

        <button className="btn-control" onClick={nextTrack} title="Next">
          <SkipForward size={20} weight="light" />
        </button>
      </div>

      {/* Kiri-Tengah: Informasi Lagu */}
      <div className="player-track-info">
        <div className="player-art">
          {currentTrack?.coverArt ? (
            <img src={currentTrack.coverArt} alt="Cover Art" />
          ) : (
            <MusicNotes size={22} weight="light" />
          )}
        </div>
        <div className="player-details">
          <div className="player-title-row">
            <span className="player-title" title={currentTrack?.title}>
              {currentTrack?.title || 'Not Playing'}
            </span>
            {currentTrack && (
              <span className="audio-quality-badge">
                {getAudioFormatBadge(currentTrack)}
              </span>
            )}
          </div>
          <span className="player-artist" title={currentTrack ? `${currentTrack.artist}${currentTrack.album ? ` • ${currentTrack.album}` : ''}` : ''}>
            {currentTrack ? (
              <>
                {currentTrack.artist}
                {currentTrack.album && <span style={{ opacity: 0.6 }}> • {currentTrack.album}</span>}
              </>
            ) : (
              'Select a song'
            )}
          </span>
        </div>

        {currentTrack && (
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-player-action" 
              onClick={() => setIsPlusMenuOpen((prev) => !prev)}
              title="Add / Actions"
            >
              <PlusCircle size={22} weight="light" />
            </button>

            {isPlusMenuOpen && (
              <div 
                className="track-dropdown-menu" 
                ref={plusMenuRef} 
                style={{ 
                  position: 'absolute', 
                  bottom: '36px', 
                  left: '0', 
                  zIndex: 1000, 
                  width: '200px' 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {onAddToQueue && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      onAddToQueue(currentTrack)
                      setIsPlusMenuOpen(false)
                    }}
                  >
                    Add to Queue
                  </button>
                )}
                
                {onToggleFavorite && (
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      onToggleFavorite(currentTrack.filePath)
                      setIsPlusMenuOpen(false)
                    }}
                  >
                    {favorites?.includes(currentTrack.filePath) ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                  </button>
                )}

                {onAddToPlaylist && playlists && (
                  <div className="dropdown-submenu-trigger">
                    <span>Add to Playlist</span>
                    <span className="submenu-arrow">▶</span>
                    <div className="dropdown-submenu" style={{ bottom: '0', top: 'auto' }}>
                      {onAddToNewPlaylist && (
                        <>
                          <button
                            className="dropdown-item"
                            style={{ color: 'var(--accent)', fontWeight: 'bold' }}
                            onClick={() => {
                              onAddToNewPlaylist(currentTrack)
                              setIsPlusMenuOpen(false)
                            }}
                          >
                            ＋ New Playlist
                          </button>
                          {playlists.length > 0 && (
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                          )}
                        </>
                      )}
                      {playlists.map((playlist) => (
                        <button
                          key={playlist}
                          className="dropdown-item"
                          onClick={() => {
                            onAddToPlaylist(playlist, currentTrack)
                            setIsPlusMenuOpen(false)
                          }}
                        >
                          {playlist}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="dropdown-item"
                  onClick={() => {
                    window.api.openFileLocation(currentTrack.filePath)
                    setIsPlusMenuOpen(false)
                  }}
                >
                  Open File Location
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tengah: Progress Bar Inline */}
      <div className="player-progress-middle">
        <span className="progress-time">{formatTime(displayTime)}</span>
        <div className="progress-container" onMouseDown={handleProgressMouseDown}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
              <div className="progress-thumb" />
            </div>
          </div>
        </div>
        <span className="progress-time">{formatTime(duration)}</span>
      </div>

      {/* Kanan: Utilitas & Kontrol Volume */}
      <div className="player-utilities-right">
        {currentTrack && (
          <div className="player-audio-tech-details" title="Audio Quality Spec">
            {getAudioTechDetailsString(currentTrack)}
          </div>
        )}

        <button
          className={`btn-control ${isShuffle ? 'active' : ''}`}
          onClick={toggleShuffle}
          title="Shuffle"
        >
          <Shuffle size={18} weight="light" />
        </button>

        <button
          className={`btn-control ${isRepeat !== 'off' ? 'active' : ''}`}
          onClick={toggleRepeat}
          title={`Repeat: ${isRepeat}`}
        >
          <Repeat size={18} weight="light" />
        </button>

        {onToggleLyrics && (
          <button
            className={`btn-control ${isLyricsOpen ? 'active' : ''}`}
            onClick={onToggleLyrics}
            title="Lyrics"
          >
            <ChatTeardropText size={20} weight="light" />
          </button>
        )}

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

