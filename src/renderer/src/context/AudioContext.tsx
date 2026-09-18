import { createContext, useState, useEffect, useRef } from 'react'

export interface TrackMeta {
  filePath: string
  title: string
  artist: string
  album: string
  duration: number
  trackNumber: number | null
  year: number | null
  genre: string | null
  coverArt: string | null // base64 data URI
  bitrate?: number
  sampleRate?: number
  bitsPerSample?: number
  lossless?: boolean
  container?: string
  addedAt?: number
}

export interface AudioContextType {
  currentTrack: TrackMeta | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffle: boolean
  isRepeat: 'off' | 'one' | 'all'
  queue: TrackMeta[]
  playTrack: (track: TrackMeta, tracksContext?: TrackMeta[]) => void
  togglePlay: () => void
  nextTrack: () => void
  prevTrack: () => void
  seek: (time: number) => void
  changeVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  addToQueue: (track: TrackMeta) => void
  removeFromQueue: (filePath: string) => void
  clearQueue: () => void
  shuffleQueue: () => void
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined)

const getAudioUrl = (filePath: string): string => {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  // Replace backslashes with forward slashes for URL compatibility (important for Windows)
  const normalizedPath = filePath.replace(/\\/g, '/')
  // Use 3 slashes (media:///) so the file path starts in the pathname portion, 
  // keeping the drive letter (e.g. C:) from being treated as an invalid hostname.
  return `media:///${encodeURI(normalizedPath).replace(/\?/g, '%3F').replace(/#/g, '%23')}`
}

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentTrack, setCurrentTrack] = useState<TrackMeta | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState<'off' | 'one' | 'all'>('off')
  const [queue, setQueue] = useState<TrackMeta[]>([])
  const [originalQueue, setOriginalQueue] = useState<TrackMeta[]>([])
  const [manualQueuePaths, setManualQueuePaths] = useState<string[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const handleSongEndedRef = useRef<() => void>(() => {})

  // Keep handleSongEndedRef updated with the latest handler on every render
  useEffect(() => {
    handleSongEndedRef.current = handleSongEnded
  })

  // Helper to persist audio settings to settings.json
  const persistAudioSettings = async (updates: Record<string, unknown>) => {
    try {
      const settings = await window.api.loadSettings()
      const updatedSettings = {
        ...settings,
        ...updates
      }
      await window.api.saveSettings(updatedSettings)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.volume = volume

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      handleSongEndedRef.current()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    // Load saved volume/mute and last played settings from electron settings file
    window.api.loadSettings().then(async (settings) => {
      if (settings) {
        if (typeof settings.volume === 'number') {
          audio.volume = settings.volume
          setVolume(settings.volume)
        }
        if (typeof settings.isMuted === 'boolean') {
          audio.muted = settings.isMuted
          setIsMuted(settings.isMuted)
        }

        const lastTrackPath = settings.lastPlayedTrack as string | undefined
        const lastTime = settings.lastPlayedTime as number | undefined

        if (lastTrackPath) {
          try {
            const lib = (await window.api.loadLibrary()) as TrackMeta[]
            if (lib && lib.length > 0) {
              const track = lib.find((t) => t.filePath === lastTrackPath)
              if (track) {
                setCurrentTrack(track)
                audio.src = getAudioUrl(track.filePath)
                
                const onMetadataLoaded = () => {
                  if (typeof lastTime === 'number') {
                    audio.currentTime = lastTime
                    setCurrentTime(lastTime)
                  }
                  audio.removeEventListener('loadedmetadata', onMetadataLoaded)
                }
                audio.addEventListener('loadedmetadata', onMetadataLoaded)
                audio.load()

                // Restore originalQueue and queue
                setOriginalQueue(lib)
                const index = lib.findIndex((t) => t.filePath === track.filePath)
                if (index !== -1) {
                  setQueue(lib.slice(index))
                } else {
                  setQueue([track])
                }
              }
            }
          } catch (err) {
            console.error('Failed to restore last played track on startup:', err)
          }
        }
      }
    })

    return () => {
      audio.pause()
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Smooth progress updates with RequestAnimationFrame
  useEffect(() => {
    const updateProgress = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime)
      }
      if (isPlaying) {
        rafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying])

  // Periodically save play position
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isPlaying && currentTrack) {
      intervalId = setInterval(() => {
        if (audioRef.current) {
          const time = audioRef.current.currentTime
          persistAudioSettings({ lastPlayedTime: time })
        }
      }, 5000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isPlaying, currentTrack])

  // Play a track and optionally update the queue context
  const playTrack = (track: TrackMeta, tracksContext?: TrackMeta[]) => {
    if (!audioRef.current) return

    setManualQueuePaths([])
    const mediaUrl = getAudioUrl(track.filePath)
    
    // Set the track meta first
    setCurrentTrack(track)
    audioRef.current.src = mediaUrl
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Audio play failed:', err))

    // Persist last played track and reset position
    persistAudioSettings({
      lastPlayedTrack: track.filePath,
      lastPlayedTime: 0
    })

    // Set the queue context if provided
    if (tracksContext && tracksContext.length > 0) {
      setOriginalQueue(tracksContext)
      if (isShuffle) {
        // Create shuffled queue excluding current track
        const remaining = tracksContext.filter((t) => t.filePath !== track.filePath)
        const shuffled = [...remaining].sort(() => Math.random() - 0.5)
        setQueue([track, ...shuffled])
      } else {
        const index = tracksContext.findIndex((t) => t.filePath === track.filePath)
        if (index !== -1) {
          setQueue(tracksContext.slice(index))
        } else {
          setQueue([track])
        }
      }
    } else {
      setOriginalQueue([track])
      setQueue([track])
    }
  }

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return
    if (isPlaying) {
      audioRef.current.pause()
      persistAudioSettings({ lastPlayedTime: audioRef.current.currentTime })
    } else {
      audioRef.current.play().catch((err) => console.error('Audio play failed:', err))
    }
  }

  // Handle next track
  const nextTrack = () => {
    if (!audioRef.current || queue.length === 0) return

    const currentIndex = queue.findIndex((t) => t.filePath === currentTrack?.filePath)
    
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      // Play next in current queue
      const nextT = queue[currentIndex + 1]
      playNextTrack(nextT)
    } else if (isRepeat === 'all' && queue.length > 0) {
      // Wrap around to start
      playNextTrack(queue[0])
    } else {
      // Stop playback at end of queue
      setIsPlaying(false)
      if (audioRef.current) audioRef.current.currentTime = 0
    }
  }

  // Play helper for skip operations
  const playNextTrack = (track: TrackMeta) => {
    if (!audioRef.current) return
    setCurrentTrack(track)
    audioRef.current.src = getAudioUrl(track.filePath)
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Audio play failed:', err))

    persistAudioSettings({
      lastPlayedTrack: track.filePath,
      lastPlayedTime: 0
    })
  }

  // Handle previous track
  const prevTrack = () => {
    if (!audioRef.current || !currentTrack) return

    // If song is more than 3 seconds in, restart it
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      persistAudioSettings({ lastPlayedTime: 0 })
      return
    }

    const currentIndex = queue.findIndex((t) => t.filePath === currentTrack.filePath)
    if (currentIndex > 0) {
      const prevT = queue[currentIndex - 1]
      playNextTrack(prevT)
    } else if (isRepeat === 'all' && queue.length > 0) {
      // Wrap around to the last track
      playNextTrack(queue[queue.length - 1])
    } else {
      // Just restart current track
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      persistAudioSettings({ lastPlayedTime: 0 })
    }
  }

  // Handle auto-advance when ended
  const handleSongEnded = () => {
    if (!audioRef.current) return
    
    if (isRepeat === 'one') {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch((err) => console.error('Audio replay failed:', err))
      setIsPlaying(true)
    } else {
      nextTrack()
    }
  }

  // Seek to specific time
  const seek = (time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
    persistAudioSettings({ lastPlayedTime: time })
  }

  // Change volume (0 to 1)
  const changeVolume = (vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol))
    if (audioRef.current) {
      audioRef.current.volume = safeVol
    }
    setVolume(safeVol)
    persistAudioSettings({ volume: safeVol })
  }

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    audioRef.current.muted = newMuted
    setIsMuted(newMuted)
    persistAudioSettings({ isMuted: newMuted })
  }

  // Toggle Shuffle
  const toggleShuffle = () => {
    const newShuffle = !isShuffle
    setIsShuffle(newShuffle)

    if (newShuffle && currentTrack) {
      // Shuffle remaining tracks
      const remaining = originalQueue.filter((t) => t.filePath !== currentTrack.filePath)
      const shuffled = [...remaining].sort(() => Math.random() - 0.5)
      setQueue([currentTrack, ...shuffled])
    } else if (currentTrack) {
      // Restore sequential queue from current track onwards
      const index = originalQueue.findIndex((t) => t.filePath === currentTrack.filePath)
      if (index !== -1) {
        setQueue(originalQueue.slice(index))
      } else {
        setQueue([currentTrack])
      }
    }
  }

  // Toggle Repeat Mode
  const toggleRepeat = () => {
    setIsRepeat((prev) => {
      if (prev === 'off') return 'all'
      if (prev === 'all') return 'one'
      return 'off'
    })
  }

  // Add to Queue (insert to be the next played track)
  const addToQueue = (track: TrackMeta) => {
    setManualQueuePaths((prev) => {
      if (prev.includes(track.filePath)) return prev
      return [...prev, track.filePath]
    })

    setQueue((prev) => {
      // Remove it from the queue if it's already there to re-inject at the next position
      const filtered = prev.filter((t) => t.filePath !== track.filePath)

      if (!currentTrack) {
        return [...filtered, track]
      }

      const currentTrackIndex = filtered.findIndex((t) => t.filePath === currentTrack.filePath)
      if (currentTrackIndex === -1) {
        return [...filtered, track]
      }

      // Check which tracks are manually queued. We construct the active manual list.
      const activePaths = manualQueuePaths.includes(track.filePath)
        ? manualQueuePaths
        : [...manualQueuePaths, track.filePath]

      // Find the index to insert after all manually queued tracks
      let insertIndex = currentTrackIndex + 1
      while (
        insertIndex < filtered.length &&
        activePaths.includes(filtered[insertIndex].filePath)
      ) {
        insertIndex++
      }

      const nextQueue = [...filtered]
      nextQueue.splice(insertIndex, 0, track)
      return nextQueue
    })

    setOriginalQueue((prev) => {
      if (prev.some((t) => t.filePath === track.filePath)) return prev
      return [...prev, track]
    })
  }

  // Remove from Queue
  const removeFromQueue = (filePath: string) => {
    setQueue((prev) => prev.filter((t) => t.filePath !== filePath))
    setOriginalQueue((prev) => prev.filter((t) => t.filePath !== filePath))
    setManualQueuePaths((prev) => prev.filter((p) => p !== filePath))
    if (currentTrack?.filePath === filePath) {
      nextTrack()
    }
  }

  // Clear Queue
  const clearQueue = () => {
    setQueue([])
    setOriginalQueue([])
    setManualQueuePaths([])
    setCurrentTrack(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }

  // Shuffle Queue (shuffles everything except the current playing track, keeping it first)
  const shuffleQueue = () => {
    setQueue((prev) => {
      if (prev.length <= 1) return prev
      const currentTrackIndex = prev.findIndex((t) => t.filePath === currentTrack?.filePath)
      if (currentTrackIndex !== -1) {
        const current = prev[currentTrackIndex]
        const rest = prev.filter((_, i) => i !== currentTrackIndex)
        const shuffled = [...rest].sort(() => Math.random() - 0.5)
        return [current, ...shuffled]
      } else {
        return [...prev].sort(() => Math.random() - 0.5)
      }
    })
  }

  // Stable refs for media session action handlers to prevent unnecessary re-binding
  const togglePlayRef = useRef(togglePlay)
  const prevTrackRef = useRef(prevTrack)
  const nextTrackRef = useRef(nextTrack)
  const toggleShuffleRef = useRef(toggleShuffle)

  useEffect(() => {
    togglePlayRef.current = togglePlay
    prevTrackRef.current = prevTrack
    nextTrackRef.current = nextTrack
    toggleShuffleRef.current = toggleShuffle
  })

  // Update MediaSession Metadata when track changes
  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: currentTrack.coverArt
            ? [{ src: currentTrack.coverArt, sizes: '512x512', type: 'image/png' }]
            : []
        })
      } else {
        navigator.mediaSession.metadata = null
      }
    }
  }, [currentTrack])

  // Sync MediaSession playbackState with player state
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [isPlaying])

  // Bind MediaSession Action Handlers (for TWS/headset buttons & OS widgets)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current())
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current())
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current())
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current())
    }
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
      }
    }
  }, [])

  // Stable refs for volume controls
  const volumeRef = useRef(volume)
  const changeVolumeRef = useRef(changeVolume)
  const toggleMuteRef = useRef(toggleMute)

  useEffect(() => {
    volumeRef.current = volume
    changeVolumeRef.current = changeVolume
    toggleMuteRef.current = toggleMute
  })

  // Listen for media key shortcuts sent from Electron Main process (TWS, Headsets, IEMs)
  useEffect(() => {
    const w = window as any
    if (w.electron && w.electron.ipcRenderer) {
      const handleMediaControl = (_event: any, action: string) => {
        if (action === 'play-pause') {
          togglePlayRef.current()
        } else if (action === 'next') {
          nextTrackRef.current()
        } else if (action === 'prev') {
          prevTrackRef.current()
        } else if (action === 'shuffle') {
          toggleShuffleRef.current()
        }
      }

      w.electron.ipcRenderer.on('media-control', handleMediaControl)
      return () => {
        w.electron.ipcRenderer.removeAllListeners('media-control')
      }
    }
    return
  }, [])

  // Listen for volume controls sent from System Tray
  useEffect(() => {
    const w = window as any
    if (w.electron && w.electron.ipcRenderer) {
      const handleVolumeControl = (_event: any, action: string) => {
        if (action === 'up') {
          changeVolumeRef.current(Math.min(1, volumeRef.current + 0.05))
        } else if (action === 'down') {
          changeVolumeRef.current(Math.max(0, volumeRef.current - 0.05))
        } else if (action === 'mute') {
          toggleMuteRef.current()
        }
      }

      w.electron.ipcRenderer.on('volume-control', handleVolumeControl)
      return () => {
        w.electron.ipcRenderer.removeAllListeners('volume-control')
      }
    }
    return
  }, [])

  // Synchronize playback state with Discord RPC (throttled to avoid rate-limiting)
  const lastSentTimeRef = useRef(0)
  const lastSentRealTimeRef = useRef(0)
  const lastIsPlayingRef = useRef(false)
  const lastTrackPathRef = useRef<string | null>(null)

  useEffect(() => {
    const w = window as any
    if (w.api && w.api.updateDiscordStatus) {
      const now = Date.now()
      const realTimeElapsed = lastSentRealTimeRef.current ? (now - lastSentRealTimeRef.current) / 1000 : 0
      const progressDelta = currentTime - lastSentTimeRef.current
      const drift = Math.abs(progressDelta - realTimeElapsed)

      const isPlayingChanged = isPlaying !== lastIsPlayingRef.current
      const trackChanged = (currentTrack?.filePath || null) !== lastTrackPathRef.current
      
      // A manual seek is detected if the playback position jumps by more than 2 seconds relative to actual clock time
      const seeked = lastSentRealTimeRef.current && isPlaying && drift > 2.0

      if (isPlayingChanged || trackChanged || seeked || currentTime === 0) {
        lastSentTimeRef.current = currentTime
        lastSentRealTimeRef.current = now
        lastIsPlayingRef.current = isPlaying
        lastTrackPathRef.current = currentTrack?.filePath || null

        w.api.updateDiscordStatus({
          title: currentTrack?.title || null,
          artist: currentTrack?.artist || null,
          duration: duration,
          currentTime: currentTime,
          isPlaying: isPlaying && currentTrack !== null
        })
      }
    }
  }, [currentTrack, isPlaying, currentTime, duration])

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        isRepeat,
        queue,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        changeVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        removeFromQueue,
        clearQueue,
        shuffleQueue
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}
