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
}

export const AudioContext = createContext<AudioContextType | undefined>(undefined)

// Helper to determine the audio source URL (local protocol vs HTTP streaming)
const getAudioUrl = (filePath: string): string => {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }
  return `media://${encodeURI(filePath)}`
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

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.volume = volume

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      handleSongEnded()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    // Load saved volume/mute settings from electron settings file
    window.api.loadSettings().then((settings) => {
      if (settings && typeof settings.volume === 'number') {
        audio.volume = settings.volume
        setVolume(settings.volume)
      }
      if (settings && typeof settings.isMuted === 'boolean') {
        audio.muted = settings.isMuted
        setIsMuted(settings.isMuted)
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

  // Play a track and optionally update the queue context
  const playTrack = (track: TrackMeta, tracksContext?: TrackMeta[]) => {
    if (!audioRef.current) return

    const mediaUrl = getAudioUrl(track.filePath)
    
    // Set the track meta first
    setCurrentTrack(track)
    audioRef.current.src = mediaUrl
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => console.error('Audio play failed:', err))

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
  }

  // Handle previous track
  const prevTrack = () => {
    if (!audioRef.current || !currentTrack) return

    // If song is more than 3 seconds in, restart it
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      setCurrentTime(0)
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
  }

  // Change volume (0 to 1)
  const changeVolume = (vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol))
    if (audioRef.current) {
      audioRef.current.volume = safeVol
    }
    setVolume(safeVol)
  }

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return
    const newMuted = !isMuted
    audioRef.current.muted = newMuted
    setIsMuted(newMuted)
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

  // Add to Queue (push to end of current queue)
  const addToQueue = (track: TrackMeta) => {
    setQueue((prev) => {
      if (prev.some((t) => t.filePath === track.filePath)) return prev
      return [...prev, track]
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
    if (currentTrack?.filePath === filePath) {
      nextTrack()
    }
  }

  // Clear Queue
  const clearQueue = () => {
    setQueue([])
    setOriginalQueue([])
    setCurrentTrack(null)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }

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
        clearQueue
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}
