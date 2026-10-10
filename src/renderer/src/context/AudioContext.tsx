import { createContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ─── Shuffle Helpers ──────────────────────────────────────────────────
function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function genreClusterShuffle(tracks: TrackMeta[], anchorGenre: string | null): TrackMeta[] {
  const genreMap = new Map<string, TrackMeta[]>()
  for (const track of tracks) {
    const g = track.genre || 'Unknown'
    if (!genreMap.has(g)) genreMap.set(g, [])
    genreMap.get(g)!.push(track)
  }

  const anchorKey = anchorGenre || 'Unknown'
  const otherKeys = fisherYates(Array.from(genreMap.keys()).filter((k) => k !== anchorKey))
  const orderedKeys = genreMap.has(anchorKey) ? [anchorKey, ...otherKeys] : otherKeys

  const result: TrackMeta[] = []
  for (const key of orderedKeys) {
    result.push(...fisherYates(genreMap.get(key)!))
  }
  return result
}

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
  seekOffset: (delta: number) => void
  getCurrentTime: () => number
  changeVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  addToQueue: (track: TrackMeta) => void
  removeFromQueue: (filePath: string) => void
  clearQueue: () => void
  shuffleQueue: () => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined)
export const AudioTimeContext = createContext<number>(0)

const getAudioUrl = (filePath: string): string => {
  const w = typeof window !== 'undefined' ? (window as any) : null
  if (w?.api?.getAudioUrl) {
    return w.api.getAudioUrl(filePath)
  }
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
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0)
    const onEnded = () => {
      handleSongEndedRef.current()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('timeupdate', onTimeUpdate)
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
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  // Throttled progress timer (100ms interval for fluid 10Hz updates without CPU spikes)
  // When in background or phone screen locked (document.hidden), throttle to 1000ms to save CPU & battery
  useEffect(() => {
    if (!isPlaying) return

    let intervalId: NodeJS.Timeout | null = null

    const startTimer = (ms: number) => {
      if (intervalId) clearInterval(intervalId)
      intervalId = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
      }, ms)
    }

    startTimer(typeof document !== 'undefined' && document.hidden ? 1000 : 100)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        startTimer(1000)
      } else {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime)
        }
        startTimer(100)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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

  // Discord status trigger helper
  const triggerDiscordUpdate = useCallback(
    (seekTime?: number) => {
      const w = window as any
      if (w.api && w.api.updateDiscordStatus) {
        const curTime = seekTime !== undefined ? seekTime : (audioRef.current?.currentTime || 0)
        w.api.updateDiscordStatus({
          title: currentTrack?.title || null,
          artist: currentTrack?.artist || null,
          album: currentTrack?.album || null,
          coverArt: currentTrack?.coverArt || null,
          duration: duration,
          currentTime: curTime,
          isPlaying: isPlaying && currentTrack !== null
        })
      }
    },
    [currentTrack, duration, isPlaying]
  )

  useEffect(() => {
    triggerDiscordUpdate()
  }, [triggerDiscordUpdate])

  // Play a track and optionally update the queue context
  const playTrack = useCallback(
    (track: TrackMeta, tracksContext?: TrackMeta[]) => {
      if (!audioRef.current) return

      setManualQueuePaths([])
      const mediaUrl = getAudioUrl(track.filePath)

      // Set the track meta first
      setCurrentTrack(track)
      audioRef.current.src = mediaUrl
      audioRef.current
        .play()
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
          const remaining = tracksContext.filter((t) => t.filePath !== track.filePath)
          const shuffled = genreClusterShuffle(remaining, track.genre)
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
    },
    [isShuffle]
  )

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentTrack) return
    if (isPlaying) {
      audioRef.current.pause()
      persistAudioSettings({ lastPlayedTime: audioRef.current.currentTime })
    } else {
      audioRef.current.play().catch((err) => console.error('Audio play failed:', err))
    }
  }, [currentTrack, isPlaying])

  // Play helper for skip operations
  const playNextTrack = useCallback((track: TrackMeta) => {
    if (!audioRef.current) return
    setCurrentTrack(track)
    audioRef.current.src = getAudioUrl(track.filePath)
    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Audio play failed:', err))

    persistAudioSettings({
      lastPlayedTrack: track.filePath,
      lastPlayedTime: 0
    })
  }, [])

  // Handle next track
  const nextTrack = useCallback(() => {
    if (!audioRef.current || queue.length === 0) return

    const currentIndex = queue.findIndex((t) => t.filePath === currentTrack?.filePath)

    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      const nextT = queue[currentIndex + 1]
      playNextTrack(nextT)
    } else if (isRepeat === 'all' && queue.length > 0) {
      playNextTrack(queue[0])
    } else {
      setIsPlaying(false)
      if (audioRef.current) audioRef.current.currentTime = 0
    }
  }, [currentTrack, isRepeat, playNextTrack, queue])

  // Handle previous track
  const prevTrack = useCallback(() => {
    if (!audioRef.current || !currentTrack) return

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
      playNextTrack(queue[queue.length - 1])
    } else {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      persistAudioSettings({ lastPlayedTime: 0 })
    }
  }, [currentTrack, isRepeat, playNextTrack, queue])

  // Handle auto-advance when ended
  const handleSongEnded = useCallback(() => {
    if (!audioRef.current) return

    if (isRepeat === 'one') {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch((err) => console.error('Audio replay failed:', err))
      setIsPlaying(true)
    } else {
      nextTrack()
    }
  }, [isRepeat, nextTrack])

  // Seek to specific time
  const seek = useCallback(
    (time: number) => {
      if (!audioRef.current) return
      audioRef.current.currentTime = time
      setCurrentTime(time)
      persistAudioSettings({ lastPlayedTime: time })
      triggerDiscordUpdate(time)
    },
    [triggerDiscordUpdate]
  )

  const seekOffset = useCallback(
    (delta: number) => {
      if (!audioRef.current) return
      const maxDur = audioRef.current.duration || duration || 0
      const target = Math.max(0, Math.min(maxDur, audioRef.current.currentTime + delta))
      seek(target)
    },
    [duration, seek]
  )

  const getCurrentTime = useCallback(() => {
    return audioRef.current?.currentTime || 0
  }, [])

  // Change volume (0 to 1)
  const changeVolume = useCallback((vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol))
    if (audioRef.current) {
      audioRef.current.volume = safeVol
    }
    setVolume(safeVol)
    persistAudioSettings({ volume: safeVol })
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    setIsMuted((prev) => {
      const newMuted = !prev
      if (audioRef.current) audioRef.current.muted = newMuted
      persistAudioSettings({ isMuted: newMuted })
      return newMuted
    })
  }, [])

  // Toggle Shuffle
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const newShuffle = !prev
      if (newShuffle && currentTrack) {
        const remaining = originalQueue.filter((t) => t.filePath !== currentTrack.filePath)
        const shuffled = genreClusterShuffle(remaining, currentTrack.genre)
        setQueue([currentTrack, ...shuffled])
      } else if (currentTrack) {
        const index = originalQueue.findIndex((t) => t.filePath === currentTrack.filePath)
        if (index !== -1) {
          setQueue(originalQueue.slice(index))
        } else {
          setQueue([currentTrack])
        }
      }
      return newShuffle
    })
  }, [currentTrack, originalQueue])

  // Toggle Repeat Mode
  const toggleRepeat = useCallback(() => {
    setIsRepeat((prev) => {
      if (prev === 'off') return 'all'
      if (prev === 'all') return 'one'
      return 'off'
    })
  }, [])

  // Add to Queue (insert to be the next played track)
  const addToQueue = useCallback(
    (track: TrackMeta) => {
      setManualQueuePaths((prev) => {
        if (prev.includes(track.filePath)) return prev
        return [...prev, track.filePath]
      })

      setQueue((prev) => {
        const filtered = prev.filter((t) => t.filePath !== track.filePath)

        if (!currentTrack) {
          return [...filtered, track]
        }

        const currentTrackIndex = filtered.findIndex((t) => t.filePath === currentTrack.filePath)
        if (currentTrackIndex === -1) {
          return [...filtered, track]
        }

        const activePaths = manualQueuePaths.includes(track.filePath)
          ? manualQueuePaths
          : [...manualQueuePaths, track.filePath]

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
    },
    [currentTrack, manualQueuePaths]
  )

  // Remove from Queue
  const removeFromQueue = useCallback(
    (filePath: string) => {
      setQueue((prev) => prev.filter((t) => t.filePath !== filePath))
      setOriginalQueue((prev) => prev.filter((t) => t.filePath !== filePath))
      setManualQueuePaths((prev) => prev.filter((p) => p !== filePath))
      if (currentTrack?.filePath === filePath) {
        nextTrack()
      }
    },
    [currentTrack?.filePath, nextTrack]
  )

  // Clear Queue
  const clearQueue = useCallback(() => {
    setQueue([])
    setOriginalQueue([])
    setManualQueuePaths([])
    setCurrentTrack(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [])

  // Shuffle Queue
  const shuffleQueue = useCallback(() => {
    setQueue((prev) => {
      if (prev.length <= 1) return prev
      const currentTrackIndex = prev.findIndex((t) => t.filePath === currentTrack?.filePath)
      if (currentTrackIndex !== -1) {
        const current = prev[currentTrackIndex]
        const rest = prev.filter((_, i) => i !== currentTrackIndex)
        const shuffled = genreClusterShuffle(rest, current.genre)
        return [current, ...shuffled]
      } else {
        return genreClusterShuffle(prev, currentTrack?.genre ?? null)
      }
    })
  }, [currentTrack])

  // Reorder Queue (Drag-and-Drop)
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev
      }
      const updated = [...prev]
      const [movedItem] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, movedItem)
      return updated
    })
  }, [])

  // Stable refs for media session action handlers to prevent unnecessary re-binding
  const togglePlayRef = useRef(togglePlay)
  const prevTrackRef = useRef(prevTrack)
  const nextTrackRef = useRef(nextTrack)
  const toggleShuffleRef = useRef(toggleShuffle)
  const seekRef = useRef(seek)
  const seekOffsetRef = useRef(seekOffset)

  useEffect(() => {
    togglePlayRef.current = togglePlay
    prevTrackRef.current = prevTrack
    nextTrackRef.current = nextTrack
    toggleShuffleRef.current = toggleShuffle
    seekRef.current = seek
    seekOffsetRef.current = seekOffset
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
            ? [
                { src: currentTrack.coverArt, sizes: '96x96' },
                { src: currentTrack.coverArt, sizes: '128x128' },
                { src: currentTrack.coverArt, sizes: '256x256' },
                { src: currentTrack.coverArt, sizes: '512x512' }
              ]
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

  // Sync MediaSession position state for system seekbar & lockscreen timeline
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (duration > 0 && !isNaN(duration) && isFinite(duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, duration),
            playbackRate: 1,
            position: Math.min(Math.max(0, currentTime), duration)
          })
        } catch (_) {}
      }
    }
  }, [currentTime, duration])

  // Bind MediaSession Action Handlers (for TWS/headset buttons & OS widgets)
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current())
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current())
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current())
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current())
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seekRef.current(details.seekTime)
        }
      })
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        seekOffsetRef.current(-(details.seekOffset || 10))
      })
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        seekOffsetRef.current(details.seekOffset || 10)
      })
    }
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
        navigator.mediaSession.setActionHandler('seekto', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
      }
    }
  }, [])

  // Synchronize playback state to native Android Media Notification
  useEffect(() => {
    const bridge = (window as any).AndroidBridge
    if (bridge && typeof bridge.updatePlayback === 'function' && currentTrack) {
      try {
        bridge.updatePlayback(
          currentTrack.title || 'Unknown Title',
          currentTrack.artist || 'Unknown Artist',
          currentTrack.album || 'Unknown Album',
          isPlaying,
          Math.round((duration || 0) * 1000),
          Math.round((audioRef.current?.currentTime || 0) * 1000)
        )
      } catch (_) {}
    }
  }, [currentTrack, isPlaying, duration])

  // Native Android Media Notification action bridge
  useEffect(() => {
    ;(window as any).__androidMediaAction = (action: string, param?: number) => {
      if (action === 'toggle' || action === 'play' || action === 'pause') {
        togglePlayRef.current()
      } else if (action === 'next') {
        nextTrackRef.current()
      } else if (action === 'prev') {
        prevTrackRef.current()
      } else if (action === 'seek' && typeof param === 'number') {
        seekRef.current(param)
      }
    }
    return () => {
      delete (window as any).__androidMediaAction
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

  const audioContextValue = useMemo<AudioContextType>(
    () => ({
      currentTrack,
      isPlaying,
      get currentTime() {
        return audioRef.current?.currentTime || 0
      },
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
      seekOffset,
      getCurrentTime,
      changeVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      addToQueue,
      removeFromQueue,
      clearQueue,
      shuffleQueue,
      reorderQueue
    }),
    [
      currentTrack,
      isPlaying,
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
      seekOffset,
      getCurrentTime,
      changeVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      addToQueue,
      removeFromQueue,
      clearQueue,
      shuffleQueue,
      reorderQueue
    ]
  )

  return (
    <AudioContext.Provider value={audioContextValue}>
      <AudioTimeContext.Provider value={currentTime}>
        {children}
      </AudioTimeContext.Provider>
    </AudioContext.Provider>
  )
}
