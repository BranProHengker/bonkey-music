import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  MagnifyingGlass,
  FolderOpen,
  ArrowLeft,
  ArrowClockwise,
  Heart,
  Info,
  PencilSimple,
  Trash,
  DownloadSimple,
  MusicNotes,
  Play,
  X,
  ClockCounterClockwise,
  CheckSquare,
  Square
} from '@phosphor-icons/react'

import Sidebar from './components/Sidebar'
import TrackList from './components/TrackList'
import PlaylistGrid from './components/PlaylistGrid'
import PlayerBar from './components/PlayerBar'
import QueuePanel from './components/QueuePanel'
import LyricsView from './components/LyricsView'
import NowPlayingView from './components/NowPlayingView'
import StudioHub from './components/studio/StudioHub'
import DashboardHome from './components/DashboardHome'
import AlbumBanner from './components/AlbumBanner'
import { useAudioEngine, TrackMeta } from './hooks/useAudioEngine'
import { recordTrackPlay, recordListeningDuration } from './lib/listeningStats'

interface AlbumGroup {
  name: string
  artist: string
  coverArt: string | null
  tracks: TrackMeta[]
}

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default function App(): React.JSX.Element {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
    playTrack,
    currentTrack,
    isPlaying,
    duration,
    volume,
    isMuted,
    changeVolume,
    nextTrack,
    prevTrack,
    toggleShuffle,
    togglePlay,
    toggleRepeat,
    isShuffle,
    isRepeat,
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    shuffleQueue,
    seek,
    seekOffset,
    toggleMute,
    reorderQueue
  } = useAudioEngine()

  // ─── Design System Enforcement (Modern Lunio) ────────────────────────
  useEffect(() => {
    document.body.classList.add('theme-lunio')
    document.body.classList.remove('theme-studio')
    try {
      localStorage.removeItem('bonkey_theme')
    } catch {}
  }, [])

  // ─── Platform Detection ─────────────────────────────────────────────
  const isMobilePlatform = typeof window !== 'undefined' && (/android|iphone|ipad|ipod/i.test(navigator.userAgent) || !!(window as any).AndroidBridge || window.innerWidth <= 768)

  // ─── State ──────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio'>('home')
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isLyricsOpen, setIsLyricsOpen] = useState(false)
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false)
  const [libraryFolder, setLibraryFolder] = useState<string | null>(null)
  const [libraryFolders, setLibraryFolders] = useState<string[]>([])
  const [tracks, setTracks] = useState<TrackMeta[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [playlists, setPlaylists] = useState<string[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, string[]>>({})
  
  const [searchQuery, setSearchQuery] = useState('')
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null)
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null)
  const [albumSearch, setAlbumSearch] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [sortField, setSortField] = useState<'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [playlistSearch, setPlaylistSearch] = useState('')
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [playlistModalSelectedTracks, setPlaylistModalSelectedTracks] = useState<Set<string>>(new Set())
  const [playlistModalSearch, setPlaylistModalSearch] = useState('')
  const [playlistCovers, setPlaylistCovers] = useState<Record<string, string>>({})

  // ─── Navigation History ──────────────────────────────────────────────
  const [history, setHistory] = useState<Array<{
    currentView: 'home' | 'library' | 'favorites' | 'settings' | 'latest' | 'studio'
    activePlaylist: string | null
    activeAlbum: string | null
  }>>([{ currentView: 'home', activePlaylist: null, activeAlbum: null }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false)

  // Record history when view state changes
  useEffect(() => {
    if (isNavigatingHistory) {
      setIsNavigatingHistory(false)
      return
    }

    const lastState = history[historyIndex]
    if (
      lastState &&
      lastState.currentView === currentView &&
      lastState.activePlaylist === activePlaylist &&
      lastState.activeAlbum === activeAlbum
    ) {
      return
    }

    const nextHistory = history.slice(0, historyIndex + 1)
    nextHistory.push({ currentView, activePlaylist, activeAlbum })
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
  }, [currentView, activePlaylist, activeAlbum])

  const currentTrackRef = useRef(currentTrack)
  const displayedTracksRef = useRef<TrackMeta[]>([])
  const isShuffleRef = useRef(isShuffle)
  const volumeRef = useRef(volume)
  const historyRef = useRef(history)
  const historyIndexRef = useRef(historyIndex)

  useEffect(() => {
    currentTrackRef.current = currentTrack
    displayedTracksRef.current = displayedTracks
    isShuffleRef.current = isShuffle
    volumeRef.current = volume
    historyRef.current = history
    historyIndexRef.current = historyIndex
  })

  const goBack = useCallback(() => {
    if (historyIndexRef.current > 0) {
      setIsNavigatingHistory(true)
      const nextIndex = historyIndexRef.current - 1
      setHistoryIndex(nextIndex)
      const state = historyRef.current[nextIndex]
      if (state) {
        setCurrentView(state.currentView)
        setActivePlaylist(state.activePlaylist)
        setActiveAlbum(state.activeAlbum)
      }
    }
  }, [])

  const goForward = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      setIsNavigatingHistory(true)
      const nextIndex = historyIndexRef.current + 1
      setHistoryIndex(nextIndex)
      const state = historyRef.current[nextIndex]
      if (state) {
        setCurrentView(state.currentView)
        setActivePlaylist(state.activePlaylist)
        setActiveAlbum(state.activeAlbum)
      }
    }
  }, [])

  const handleRefreshLibraryRef = useRef<() => void>(() => {})

  // ─── Global Keyboard & Mouse Event Listeners ──────────────────────────
  useEffect(() => {
    // 1. Mouse thumb buttons (Back/Forward)
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault()
        goBack()
      } else if (e.button === 4) {
        e.preventDefault()
        goForward()
      }
    }

    // 2. Keyboard shortcuts (Ctrl+Arrow for Next/Prev, Ctrl+R for Shuffle, Space for Play/Pause)
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (e.key === ' ' || e.key === 'Spacebar') {
        if (!isInput) {
          e.preventDefault()
          if (currentTrackRef.current) {
            togglePlay()
          } else if (displayedTracksRef.current && displayedTracksRef.current.length > 0) {
            if (isShuffleRef.current) {
              const randomIndex = Math.floor(Math.random() * displayedTracksRef.current.length)
              playTrack(displayedTracksRef.current[randomIndex], displayedTracksRef.current)
            } else {
              playTrack(displayedTracksRef.current[0], displayedTracksRef.current)
            }
          }
        }
      }

      // Handle Hardware Media Keys directly from Headset/IEM/TWS or Keyboard
      const mediaKey = e.key.toLowerCase()

      if (
        mediaKey === 'mediaplaypause' ||
        mediaKey === 'audioplay' ||
        mediaKey === 'audiopause'
      ) {
        e.preventDefault()
        togglePlay()
      } else if (
        mediaKey === 'mediatracknext' ||
        mediaKey === 'audionext' ||
        mediaKey === 'next'
      ) {
        e.preventDefault()
        nextTrack()
      } else if (
        mediaKey === 'mediatrackprevious' ||
        mediaKey === 'audioprev' ||
        mediaKey === 'prev'
      ) {
        e.preventDefault()
        prevTrack()
      }

      if (e.ctrlKey) {
        if (e.shiftKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault()
          handleRefreshLibraryRef.current()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          nextTrack()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          prevTrack()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          changeVolume(Math.min(1, volumeRef.current + 0.05))
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          changeVolume(Math.max(0, volumeRef.current - 0.05))
        } else if (!e.shiftKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault()
          toggleShuffle()
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault()
          setIsLyricsOpen((prev) => !prev)
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault()
          toggleRepeat()
        } else if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault()
          setIsQueueOpen((prev) => !prev)
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault()
          toggleMute()
        }
      }

      // Skip timeline by 5 seconds (Shift + Arrow Left/Right)
      if (e.shiftKey && !e.ctrlKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          seekOffset(5)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          seekOffset(-5)
        }
      }
    }

    // 3. Ctrl + Wheel Scroll for Volume Control
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          changeVolume(Math.min(1, volumeRef.current + 0.05))
        } else if (e.deltaY > 0) {
          changeVolume(Math.max(0, volumeRef.current - 0.05))
        }
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [goBack, goForward, togglePlay, playTrack, nextTrack, prevTrack, toggleShuffle, toggleRepeat, toggleMute, seekOffset, changeVolume])

function isJunkTrack(track: TrackMeta): boolean {
  const p = (track.filePath || '').toLowerCase()
  return (
    p.includes('/ringtones') ||
    p.includes('\\ringtones') ||
    p.includes('/notifications') ||
    p.includes('\\notifications') ||
    p.includes('/alarms') ||
    p.includes('\\alarms') ||
    p.includes('/system/media') ||
    p.includes('/product/media') ||
    p.includes('/android/data') ||
    p.includes('whatsapp voice notes')
  )
}

  // ─── Save Settings Helper ───────────────────────────────────────────
  const persistSettings = async (updates: Record<string, unknown>) => {
    const settings = await window.api.loadSettings()
    const updatedSettings = {
      ...settings,
      ...updates
    }
    await window.api.saveSettings(updatedSettings)
  }

  // ─── Auto Scan Audio ────────────────────────────────────────────────
  const handleAutoScan = async () => {
    if (isScanning) return
    setIsScanning(true)
    try {
      // 1. Android MediaStore Bridge (Direct native query on Android)
      const bridge = (window as any).AndroidBridge
      if (bridge && typeof bridge.scanAudio === 'function') {
        const jsonStr = bridge.scanAudio()
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr)
            if (Array.isArray(parsed)) {
              const clean = (parsed as TrackMeta[]).filter(t => !isJunkTrack(t))
              if (clean.length > 0) {
                let port = 0
                if (window.api.getAudioPort) {
                  try {
                    port = await window.api.getAudioPort()
                  } catch (_) {}
                }
                const cleanWithCovers = clean.map(t => ({
                  ...t,
                  coverArt: (port && port > 0) ? `http://127.0.0.1:${port}/cover?path=${encodeURIComponent(t.filePath)}` : t.coverArt
                }))
                setTracks(cleanWithCovers)
                if (window.api.saveLibrary) {
                  await window.api.saveLibrary(cleanWithCovers)
                }
                setIsScanning(false)
                return
              }
            }
          } catch (e) {
            console.error('[Bonkey Music] Failed to parse MediaStore JSON:', e)
          }
        }
      }

      // 2. Tauri Command auto_scan_audio (Backend scan)
      if (window.api.autoScanAudio) {
        const scanned = await window.api.autoScanAudio()
        if (scanned && Array.isArray(scanned) && scanned.length > 0) {
          const clean = (scanned as TrackMeta[]).filter(t => !isJunkTrack(t))
          setTracks(clean)
          const settings = await window.api.loadSettings()
          if (settings && Array.isArray(settings.libraryFolders)) {
            setLibraryFolders(settings.libraryFolders as string[])
          }
          if (settings && typeof settings.libraryFolder === 'string') {
            setLibraryFolder(settings.libraryFolder)
          }
        }
      }
    } catch (err) {
      console.error('[Bonkey Music] Auto-scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  // ─── Android Resume Bridge Callback ─────────────────────────────────
  useEffect(() => {
    ;(window as any).__refreshAndroidLibrary = () => {
      handleAutoScan()
    }
    return () => {
      delete (window as any).__refreshAndroidLibrary
    }
  }, [])

  // ─── Load Library and Settings ──────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const settings = await window.api.loadSettings()
      let currentFolder: string | null = null
      let currentFolders: string[] = []

      if (settings) {
        if (typeof settings.libraryFolder === 'string') {
          currentFolder = settings.libraryFolder
          setLibraryFolder(settings.libraryFolder)
        }
        if (Array.isArray(settings.libraryFolders)) {
          currentFolders = settings.libraryFolders as string[]
          setLibraryFolders(currentFolders)
        } else if (typeof settings.libraryFolder === 'string') {
          currentFolders = [settings.libraryFolder]
          setLibraryFolders(currentFolders)
        }
        if (Array.isArray(settings.favorites)) {
          setFavorites(settings.favorites as string[])
        }
        if (Array.isArray(settings.playlists)) {
          setPlaylists(settings.playlists as string[])
        }
        if (settings.playlistTracks && typeof settings.playlistTracks === 'object') {
          setPlaylistTracks(settings.playlistTracks as Record<string, string[]>)
        }
        if (settings.playlistCovers && typeof settings.playlistCovers === 'object') {
          setPlaylistCovers(settings.playlistCovers as Record<string, string>)
        }
      }

      let lib = await window.api.loadLibrary()
      if (lib && Array.isArray(lib) && lib.length > 0) {
        const clean = (lib as TrackMeta[]).filter(t => !isJunkTrack(t))
        if (clean.length > 0) {
          let port = 0
          if (window.api.getAudioPort) {
            try {
              port = await window.api.getAudioPort()
            } catch (_) {}
          }
          const cleanWithCovers = clean.map(t => ({
            ...t,
            coverArt: (port && port > 0) ? `http://127.0.0.1:${port}/cover?path=${encodeURIComponent(t.filePath)}` : t.coverArt
          }))
          setTracks(cleanWithCovers)
          if (clean.length !== lib.length && window.api.saveLibrary) {
            await window.api.saveLibrary(cleanWithCovers)
          }
        } else {
          handleAutoScan()
        }
      } else {
        // Run auto-scan in background if empty
        handleAutoScan()
      }

      // Auto-recover folder from indexed tracks if settings was empty
      if (!currentFolder && lib && Array.isArray(lib) && lib.length > 0 && lib[0]?.filePath) {
        const firstPath = lib[0].filePath
        const separator = firstPath.includes('/') ? '/' : '\\'
        const folderPart = firstPath.substring(0, firstPath.lastIndexOf(separator))
        if (folderPart) {
          currentFolder = folderPart
          if (!currentFolders.includes(folderPart)) {
            currentFolders.push(folderPart)
          }
          setLibraryFolder(currentFolder)
          setLibraryFolders(currentFolders)
          await persistSettings({ libraryFolder: currentFolder, libraryFolders: currentFolders })
        }
      }
    }
    loadData()
  }, [])

  // ─── Folder Selection & Scanning ────────────────────────────────────
  const handleSelectAndAddFolder = async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      const nextFolders = libraryFolders.includes(folder)
        ? libraryFolders
        : [...libraryFolders, folder]
      setLibraryFolders(nextFolders)
      setLibraryFolder(folder)
      await persistSettings({ libraryFolder: folder, libraryFolders: nextFolders })
      await handleScanFolder(folder)
    }
  }

  const handleScanFolder = async (path: string) => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const scannedTracks = await window.api.scanFolder(path)
      if (scannedTracks && Array.isArray(scannedTracks)) {
        setTracks(scannedTracks as TrackMeta[])
        
        // Reload folders from settings
        const settings = await window.api.loadSettings()
        if (settings && Array.isArray(settings.libraryFolders)) {
          setLibraryFolders(settings.libraryFolders as string[])
        }
        if (settings && typeof settings.libraryFolder === 'string') {
          setLibraryFolder(settings.libraryFolder)
        }
      }
    } catch (err) {
      console.error('Scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleRefreshLibrary = async () => {
    if (isScanning) return
    const foldersToScan = libraryFolders.length > 0 ? libraryFolders : (libraryFolder ? [libraryFolder] : [])
    if (foldersToScan.length === 0) return

    setIsScanning(true)
    try {
      let finalTracks: TrackMeta[] = []
      for (const folder of foldersToScan) {
        const res = await window.api.scanFolder(folder)
        if (Array.isArray(res)) {
          finalTracks = res as TrackMeta[]
        }
      }
      setTracks(finalTracks)
    } catch (err) {
      console.error('Refresh library error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    handleRefreshLibraryRef.current = handleRefreshLibrary
  })

  const handleRemoveFolder = async (folderPath: string) => {
    const confirmRemove = window.confirm(
      `Are you sure you want to remove the folder "${folderPath}" from your library? The songs inside will be removed from your library.`
    )
    if (!confirmRemove) return

    setIsScanning(true)
    try {
      const updatedTracks = await window.api.removeLibraryFolder(folderPath)
      setTracks(updatedTracks as TrackMeta[])

      const settings = await window.api.loadSettings()
      let folders: string[] = Array.isArray(settings.libraryFolders)
        ? (settings.libraryFolders as string[])
        : []
      setLibraryFolders(folders)
      const nextFolder = libraryFolder === folderPath ? (folders[0] || null) : libraryFolder
      setLibraryFolder(nextFolder)
      await persistSettings({ libraryFolder: nextFolder, libraryFolders: folders })
    } catch (err) {
      console.error('Failed to remove folder:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleImportFiles = async () => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const selected = await window.api.selectFiles()
      if (selected && selected.length > 0) {
        const updated = await window.api.importFiles(selected)
        if (updated && Array.isArray(updated)) {
          setTracks(updated as TrackMeta[])
        }
      }
    } catch (err) {
      console.error('Import files error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleResetLibrary = async () => {
    const confirmReset = window.confirm('Are you sure you want to reset your library? This will clear all cached tracks from the app.')
    if (!confirmReset) return

    setIsScanning(true)
    try {
      // Clear playback and queue first for instant visual response
      clearQueue()
      const clearedTracks = await window.api.resetLibrary()
      setTracks(clearedTracks)
      setLibraryFolder(null)
      setLibraryFolders([])
      await persistSettings({ libraryFolder: null, libraryFolders: [] })
    } catch (err) {
      console.error('Failed to reset library:', err)
      // Fallback: clear the UI tracks anyway
      setTracks([])
      setLibraryFolder(null)
      setLibraryFolders([])
      await persistSettings({ libraryFolder: null, libraryFolders: [] })
    } finally {
      setIsScanning(false)
    }
  }

  const modalFilteredTracks = useMemo(() => {
    if (!playlistModalSearch.trim()) return tracks
    const q = playlistModalSearch.toLowerCase()
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    )
  }, [tracks, playlistModalSearch])

  const handleCreatePlaylist = (track?: TrackMeta) => {
    setNewPlaylistName('')
    setPlaylistModalSearch('')
    if (track) {
      setPlaylistModalSelectedTracks(new Set([track.filePath]))
    } else {
      setPlaylistModalSelectedTracks(new Set())
    }
    setIsCreatePlaylistOpen(true)
  }

  const handleToggleModalTrackSelect = (filePath: string) => {
    setPlaylistModalSelectedTracks((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  const handleSelectAllFiltered = (filtered: TrackMeta[]) => {
    setPlaylistModalSelectedTracks((prev) => {
      const next = new Set(prev)
      filtered.forEach((t) => next.add(t.filePath))
      return next
    })
  }

  const handleClearModalSelection = () => {
    setPlaylistModalSelectedTracks(new Set())
  }

  const handleSubmitNewPlaylist = async () => {
    const trimmed = newPlaylistName.trim()
    if (!trimmed) return

    if (playlists.includes(trimmed)) {
      alert(`Playlist "${trimmed}" already exists.`)
      return
    }

    const nextPlaylists = [...playlists, trimmed]
    setPlaylists(nextPlaylists)

    const selectedFilePaths = Array.from(playlistModalSelectedTracks)
    let nextPlaylistTracks = { ...playlistTracks }
    nextPlaylistTracks[trimmed] = selectedFilePaths
    setPlaylistTracks(nextPlaylistTracks)

    await persistSettings({
      playlists: nextPlaylists,
      playlistTracks: nextPlaylistTracks
    })

    // Reset states and close modal
    setNewPlaylistName('')
    setPlaylistModalSearch('')
    setPlaylistModalSelectedTracks(new Set())
    setIsCreatePlaylistOpen(false)

    // Immediately navigate to the newly created playlist!
    setActivePlaylist(trimmed)
    setActiveAlbum(null)
    setSearchQuery('')
    setCurrentView('library')
  }

  const handleAddToPlaylist = async (playlistName: string, track: TrackMeta) => {
    const currentTracks = playlistTracks[playlistName] || []
    if (currentTracks.includes(track.filePath)) {
      alert(`Song is already in playlist "${playlistName}"`)
      return
    }
    const updatedTracks = {
      ...playlistTracks,
      [playlistName]: [...currentTracks, track.filePath]
    }
    setPlaylistTracks(updatedTracks)
    await persistSettings({ playlistTracks: updatedTracks })
  }

  const handleRemoveFromPlaylist = async (track: TrackMeta) => {
    if (!activePlaylist) return
    const currentTracks = playlistTracks[activePlaylist] || []
    const nextTracks = currentTracks.filter((path) => path !== track.filePath)
    const updatedTracks = {
      ...playlistTracks,
      [activePlaylist]: nextTracks
    }
    setPlaylistTracks(updatedTracks)
    await persistSettings({ playlistTracks: updatedTracks })
  }

  const handleChangePlaylistCover = async (playlistName: string) => {
    try {
      const dataUri = await window.api.selectImage()
      if (dataUri) {
        const nextCovers = {
          ...playlistCovers,
          [playlistName]: dataUri
        }
        setPlaylistCovers(nextCovers)
        await persistSettings({ playlistCovers: nextCovers })
      }
    } catch (err) {
      console.error('Failed to change playlist cover:', err)
    }
  }

  const handlePlayPlaylist = () => {
    if (displayedTracks.length > 0) {
      playTrack(displayedTracks[0], displayedTracks)
    }
  }

  const handleReorderPlaylistTracks = async (startIndex: number, endIndex: number) => {
    if (!activePlaylist) return
    const currentTracks = [...(playlistTracks[activePlaylist] || [])]
    const [removed] = currentTracks.splice(startIndex, 1)
    currentTracks.splice(endIndex, 0, removed)

    const nextPlaylistTracks = {
      ...playlistTracks,
      [activePlaylist]: currentTracks
    }
    setPlaylistTracks(nextPlaylistTracks)
    await persistSettings({ playlistTracks: nextPlaylistTracks })
  }

  const handleRenamePlaylist = async (oldName: string) => {
    const name = prompt(`Rename playlist "${oldName}" to:`, oldName)
    if (!name) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === oldName) return

    if (playlists.includes(trimmed)) {
      alert(`A playlist named "${trimmed}" already exists.`)
      return
    }

    const nextPlaylists = playlists.map((p) => (p === oldName ? trimmed : p))
    const nextPlaylistTracks = { ...playlistTracks }
    if (nextPlaylistTracks[oldName]) {
      nextPlaylistTracks[trimmed] = nextPlaylistTracks[oldName]
      delete nextPlaylistTracks[oldName]
    }

    const nextCovers = { ...playlistCovers }
    if (nextCovers[oldName]) {
      nextCovers[trimmed] = nextCovers[oldName]
      delete nextCovers[oldName]
    }

    setPlaylists(nextPlaylists)
    setPlaylistTracks(nextPlaylistTracks)
    setPlaylistCovers(nextCovers)
    
    if (activePlaylist === oldName) {
      setActivePlaylist(trimmed)
    }

    await persistSettings({
      playlists: nextPlaylists,
      playlistTracks: nextPlaylistTracks,
      playlistCovers: nextCovers
    })
  }

  const handleDeletePlaylist = async (name: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the playlist "${name}"?`)
    if (!confirmDelete) return

    const nextPlaylists = playlists.filter((p) => p !== name)
    const nextPlaylistTracks = { ...playlistTracks }
    delete nextPlaylistTracks[name]

    setPlaylists(nextPlaylists)
    setPlaylistTracks(nextPlaylistTracks)

    if (activePlaylist === name) {
      setActivePlaylist(null)
    }

    await persistSettings({
      playlists: nextPlaylists,
      playlistTracks: nextPlaylistTracks
    })
  }

  const handleExportPlaylist = async (name: string) => {
    const pTracks = playlistTracks[name] || []
    if (pTracks.length === 0) {
      alert('Cannot export an empty playlist!')
      return
    }

    setIsScanning(true)
    try {
      const result = await window.api.exportPlaylist(name, pTracks)
      if (result.success) {
        alert(`Playlist exported successfully to:\n${result.destination}`)
      } else if (result.reason !== 'canceled') {
        alert(`Export failed: ${result.reason}`)
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message || err}`)
    } finally {
      setIsScanning(false)
    }
  }

  const handleToggleFavorite = async (filePath: string) => {
    const nextFavorites = favorites.includes(filePath)
      ? favorites.filter((path) => path !== filePath)
      : [...favorites, filePath]
    
    setFavorites(nextFavorites)
    await persistSettings({ favorites: nextFavorites })
  }

  // ─── Computed Properties ───────────────────────────────────────────
  const albums = useMemo((): AlbumGroup[] => {
    const groups: Record<string, TrackMeta[]> = {}
    tracks.forEach((track) => {
      const key = track.album || 'Unknown Album'
      if (!groups[key]) groups[key] = []
      groups[key].push(track)
    })

    return Object.entries(groups).map(([name, albumTracks]) => {
      // Find first non-null cover art
      const coverArt = albumTracks.find((t) => t.coverArt !== null)?.coverArt || null
      // Get artists
      const uniqueArtists = Array.from(new Set(albumTracks.map((t) => t.artist)))
      const artist = uniqueArtists.length > 1 ? 'Various Artists' : uniqueArtists[0] || 'Unknown Artist'

      return {
        name,
        artist,
        coverArt,
        tracks: albumTracks
      }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks])

  const totalArtistsCount = useMemo(() => {
    return new Set(tracks.map((t) => t.artist)).size
  }, [tracks])

  const addableTracks = useMemo(() => {
    if (!activePlaylist) return []
    const currentPaths = playlistTracks[activePlaylist] || []
    return tracks.filter((t) => !currentPaths.includes(t.filePath))
  }, [tracks, playlistTracks, activePlaylist])

  const filteredAddableTracks = useMemo(() => {
    const available = addableTracks
    if (!playlistSearch.trim()) {
      return available.slice(0, 10)
    }
    const q = playlistSearch.toLowerCase()
    return available
      .filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
      .slice(0, 10)
  }, [addableTracks, playlistSearch])

  // Filtered tracks based on view, playlist, album, and search query
  const displayedTracks = useMemo(() => {
    let result = [...tracks]

    // 1. Filter by Main View
    if (currentView === 'favorites') {
      result = result.filter((t) => favorites.includes(t.filePath))
    } else if (currentView === 'latest') {
      // Sort newest first by default
      result = [...result].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    } else if (currentView === 'library') {
      if (activePlaylist) {
        const pFilePaths = playlistTracks[activePlaylist] || []
        result = result.filter((t) => pFilePaths.includes(t.filePath))
      } else if (activeAlbum) {
        result = result.filter((t) => t.album === activeAlbum)
        if (albumSearch.trim()) {
          const aq = albumSearch.toLowerCase()
          result = result.filter(
            (t) =>
              t.title.toLowerCase().includes(aq) ||
              t.artist.toLowerCase().includes(aq)
          )
        }
      }
    }

    // 2. Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      )
    }

    // 3. Sort tracks if sortField is active
    if (sortField) {
      result.sort((a, b) => {
        const valA = a[sortField] || 0
        const valB = b[sortField] || 0

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA)
        }

        // Numbers (duration, addedAt)
        return sortOrder === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      })
    }

    return result
  }, [tracks, currentView, activePlaylist, activeAlbum, favorites, playlistTracks, searchQuery, sortField, sortOrder])

  const playlistDurationStr = useMemo(() => {
    if (!activePlaylist) return ''
    const totalSecs = displayedTracks.reduce((sum, t) => sum + (t.duration || 0), 0)
    if (totalSecs <= 0) return '0 min'
    const hrs = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    if (hrs > 0) {
      return `about ${hrs} hr ${mins} min`
    }
    return `${mins} min`
  }, [activePlaylist, displayedTracks])

  const playlistCoverSrc = useMemo(() => {
    if (!activePlaylist) return null
    if (playlistCovers[activePlaylist]) {
      return playlistCovers[activePlaylist]
    }
    // Fallback: use first song with cover art in the playlist
    const songWithCover = displayedTracks.find((s) => s.coverArt)
    return songWithCover ? songWithCover.coverArt : null
  }, [activePlaylist, playlistCovers, displayedTracks])

  // ─── Handlers ───────────────────────────────────────────────────────
  const handlePlayTrack = (track: TrackMeta) => {
    recordTrackPlay(track)
    // Provide queue context so next/prev can advance sequentially within current filtered list
    playTrack(track, displayedTracks)
  }

  useEffect(() => {
    if (!isPlaying || !currentTrack) return
    const interval = setInterval(() => {
      recordListeningDuration(5)
    }, 5000)
    return () => clearInterval(interval)
  }, [isPlaying, currentTrack])

  const handleSelectArtistFromDashboard = (artist: string) => {
    setSearchQuery(artist)
    setCurrentView('library')
    setActivePlaylist(null)
    setActiveAlbum(null)
  }

  const handleSelectAlbumFromDashboard = (album: string) => {
    setActiveAlbum(album)
    setAlbumSearch('')
    setCurrentView('library')
    setActivePlaylist(null)
    setSearchQuery('')
  }

  // Go back to full library view when browsing specific album, playlist, or latest
  const handleClearFilters = () => {
    setActivePlaylist(null)
    setActiveAlbum(null)
    setSearchQuery('')
    setAlbumSearch('')
    if (currentView === 'latest') {
      setCurrentView('library')
    }
  }

  return (
    <div className="app-container">
      {/* Draggable header bar */}
      <header className="app-header" data-tauri-drag-region>
        <div className="app-title" data-tauri-drag-region>Bonkey Music</div>
      </header>

      {/* Left Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={(view) => {
          setCurrentView(view)
          setActiveAlbum(null)
          setActivePlaylist(null)
        }}
        libraryFolder={libraryFolder}
        playlists={playlists}
        activePlaylist={activePlaylist}
        setActivePlaylist={(playlistName) => {
          setActivePlaylist(playlistName)
          setActiveAlbum(null)
          if (playlistName !== null) {
            setCurrentView('library')
          }
        }}
        onCreatePlaylist={handleCreatePlaylist}
        onAddFolder={handleSelectAndAddFolder}
        onImportAudio={handleImportFiles}
        albums={albums}
        activeAlbum={activeAlbum}
        setActiveAlbum={(albumName) => {
          setActiveAlbum(albumName)
          setActivePlaylist(null)
          if (albumName !== null) {
            setCurrentView('library')
          }
        }}
        playlistTracks={playlistTracks}
        playlistCovers={playlistCovers}
        tracks={tracks}
        onPlayTrack={handlePlayTrack}
        currentTrack={currentTrack}
      />

      {/* Main Panel */}
      <main className="main-content">
        {/* Search Bar / Action Bar (Dedicated to local library, hidden in Music Studio and clean Home view) */}
        {currentView !== 'studio' && !(currentView === 'home' && !activeAlbum && !activePlaylist && !searchQuery) && (
          <div className="search-bar-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {(activeAlbum || activePlaylist || searchQuery || currentView === 'latest') && (
              <button
                className="btn-control"
                onClick={handleClearFilters}
                style={{
                  border: '1px solid rgba(255,255,255,0.05)',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  borderRadius: '50%'
                }}
                title="Back"
              >
                <ArrowLeft size={16} weight="light" />
              </button>
            )}
            <div className="search-input-wrapper" style={{ flexGrow: 1, maxWidth: '320px' }}>
              <MagnifyingGlass size={18} weight="light" />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="Search tracks, artists, albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* View Routing */}
        {currentView === 'studio' ? (
          <StudioHub
            currentTrack={currentTrack}
            seek={seek}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            onPlayTrack={handlePlayTrack}
            allTracks={tracks}
            onTrackImported={async () => {
              const lib = await window.api.loadLibrary()
              setTracks(lib as TrackMeta[])
            }}
          />
        ) : currentView === 'settings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 className="section-title">Settings</h2>
            
            <div className="settings-section">
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                <div className="settings-label">
                  <span className="settings-title">Music Library Folders</span>
                  <span className="settings-subtitle">Manage local folders scanned for audio files</span>
                </div>
                
                {libraryFolders.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', padding: '4px 0' }}>
                    No folders added yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    {libraryFolders.map((folder) => (
                      <div key={folder} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', width: '100%', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }} title={folder}>
                          {folder}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            className="btn-control" 
                            title="Sync folder"
                            style={{ padding: '6px', height: '30px', width: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleScanFolder(folder)}
                            disabled={isScanning}
                          >
                            <ArrowClockwise size={14} className={isScanning && libraryFolder === folder ? 'animate-spin' : ''} />
                          </button>
                          <button 
                            className="btn-control danger-hover" 
                            title="Remove folder"
                            style={{ padding: '6px', height: '30px', width: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleRemoveFolder(folder)}
                            disabled={isScanning}
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button className="btn-primary" onClick={handleSelectAndAddFolder} disabled={isScanning}>
                  <FolderOpen size={16} weight="light" />
                  <span>Add Music Folder</span>
                </button>
              </div>

              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-title">Load Music Files</span>
                  <span className="settings-subtitle">Select individual audio files to import directly into your library</span>
                </div>
                <button className="btn-primary" onClick={handleImportFiles} disabled={isScanning}>
                  <FolderOpen size={16} weight="light" />
                  <span>Import Audio Files</span>
                </button>
              </div>

              <div className="settings-row" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <div className="settings-label">
                  <span className="settings-title" style={{ color: 'var(--color-favorite)' }}>Reset Music Library</span>
                  <span className="settings-subtitle">Remove all indexed songs from your library cache. This will not delete your files.</span>
                </div>
                <button 
                  className="btn-secondary" 
                  style={{ borderColor: 'rgba(244,63,94,0.25)', color: 'var(--color-favorite)' }}
                  onClick={handleResetLibrary}
                  disabled={isScanning}
                >
                  <span>Reset Library</span>
                </button>
              </div>
            </div>

            <h2 className="section-title" style={{ marginTop: '8px', marginBottom: '0' }}>Keyboard Shortcuts (Keybinds)</h2>
            <div className="settings-section">
              <div className="keybinds-grid">
                <div className="keybind-row">
                  <span className="keybind-action">Play / Pause</span>
                  <kbd className="keybind-key">Space</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Next Track</span>
                  <kbd className="keybind-key">Ctrl + Right Arrow</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Previous Track</span>
                  <kbd className="keybind-key">Ctrl + Left Arrow</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Focus & Select Search</span>
                  <kbd className="keybind-key">Ctrl + F</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Toggle Shuffle Mode</span>
                  <kbd className="keybind-key">Ctrl + R</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Volume Control</span>
                  <kbd className="keybind-key">Ctrl + Scroll Wheel / Ctrl + Up/Down</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Page Navigation Back</span>
                  <kbd className="keybind-key">Mouse Thumb 1 (Back)</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Page Navigation Forward</span>
                  <kbd className="keybind-key">Mouse Thumb 2 (Forward)</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Toggle Repeat (Loop) Mode</span>
                  <kbd className="keybind-key">Ctrl + L</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Toggle Play Queue</span>
                  <kbd className="keybind-key">Ctrl + Q</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Skip Forward/Backward 5s</span>
                  <kbd className="keybind-key">Shift + Right/Left Arrow</kbd>
                </div>
                <div className="keybind-row">
                  <span className="keybind-action">Mute / Unmute Audio</span>
                  <kbd className="keybind-key">Ctrl + M</kbd>
                </div>
              </div>
            </div>

            <div className="settings-section" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.01)', boxShadow: 'none', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Info size={16} weight="light" color="var(--text-tertiary)" />
                <span>Supports MP3, FLAC, WAV, M4A, OGG, AAC, WMA audio formats.</span>
              </div>
            </div>
          </div>
        ) : (!libraryFolder && tracks.length === 0) ? (
          /* Empty Library / Init State */
          <div
            className="empty-state"
            style={{
              maxWidth: '440px',
              margin: '40px auto 0',
              textAlign: 'center',
              padding: '36px 24px',
              background: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}
          >
            <div
              className="empty-state-icon"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
            >
              <MusicNotes size={32} weight="duotone" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Pustaka Musik Kosong
            </h2>
            <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 24px', lineHeight: 1.5 }}>
              {isMobilePlatform
                ? 'Pindai otomatis semua lagu yang tersimpan di memori perangkat Anda untuk mulai mendengarkan.'
                : 'Pindai otomatis file audio dari penyimpanan sistem Anda atau pilih folder musik secara manual.'}
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: isMobilePlatform ? 'column' : 'row',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <button
                className="btn-primary"
                onClick={handleAutoScan}
                disabled={isScanning}
                style={{
                  width: isMobilePlatform ? '100%' : 'auto',
                  minHeight: '44px',
                  padding: '0 24px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                <ArrowClockwise size={18} className={isScanning ? 'animate-spin' : ''} weight="bold" />
                <span>{isScanning ? 'Sedang Memindai Audio...' : 'Pindai Musik Otomatis'}</span>
              </button>
              {!isMobilePlatform && (
                <button
                  className="btn-control"
                  onClick={handleSelectAndAddFolder}
                  disabled={isScanning}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '13px'
                  }}
                >
                  <FolderOpen size={18} weight="light" />
                  <span>Pilih Folder Manual</span>
                </button>
              )}
            </div>
          </div>
        ) : (currentView === 'home' && !activePlaylist && !activeAlbum && !searchQuery) ? (
          <DashboardHome
            tracks={tracks}
            albums={albums}
            onPlayTrack={handlePlayTrack}
            onSelectArtist={handleSelectArtistFromDashboard}
            onSelectAlbum={handleSelectAlbumFromDashboard}
            onNavigateToLibrary={() => setCurrentView('library')}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : (
          /* Dashboard or Track List Views */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Spotify/Apple Music style Album Banner (matching Foto 2) */}
            {activeAlbum && !activePlaylist && (
              <AlbumBanner
                albumName={activeAlbum}
                tracks={displayedTracks}
                onPlayAlbum={(shuffle) => {
                  if (displayedTracks.length > 0) {
                    if (shuffle) {
                      const randomIndex = Math.floor(Math.random() * displayedTracks.length)
                      playTrack(displayedTracks[randomIndex], displayedTracks)
                      if (!isShuffle) {
                        toggleShuffle()
                      }
                    } else {
                      playTrack(displayedTracks[0], displayedTracks)
                    }
                  }
                }}
                onAddToQueue={(albumTracks) => {
                  albumTracks.forEach((t) => addToQueue(t))
                }}
                onSelectArtist={(artist) => {
                  setSearchQuery(artist)
                }}
                searchQuery={albumSearch}
                onSearchChange={setAlbumSearch}
              />
            )}

            {/* Header section if active search filter is set (when not in album) */}
            {searchQuery && !activeAlbum && !activePlaylist && currentView !== 'latest' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      Search Results
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {displayedTracks.length} tracks found
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Playlist Spotify-style banner and control row */}
            {activePlaylist && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="playlist-banner">

                  <div className="playlist-banner-cover" onClick={() => handleChangePlaylistCover(activePlaylist)}>
                    {playlistCoverSrc ? (
                      <img src={playlistCoverSrc} alt={activePlaylist} />
                    ) : (
                      <MusicNotes size={64} weight="light" color="var(--text-tertiary)" />
                    )}
                    <div className="playlist-pfp-overlay">
                      <PencilSimple size={24} weight="light" />
                      <span>Change Photo</span>
                    </div>
                  </div>

                  <div className="playlist-banner-details">
                    <span className="playlist-banner-type">Playlist</span>
                    <h1 
                      className="playlist-banner-title" 
                      onClick={() => handleRenamePlaylist(activePlaylist)}
                      style={{ cursor: 'pointer' }}
                      title="Click to rename playlist"
                    >
                      {activePlaylist}
                    </h1>
                    <div className="playlist-banner-meta">
                      <span className="playlist-banner-owner">Bonkey User</span>
                      <span className="playlist-banner-bullet">•</span>
                      <span className="playlist-banner-stats">
                        {displayedTracks.length} {displayedTracks.length === 1 ? 'song' : 'songs'}
                      </span>
                      {playlistDurationStr && (
                        <>
                          <span className="playlist-banner-bullet">•</span>
                          <span className="playlist-banner-stats" style={{ color: 'var(--text-secondary)' }}>
                            {playlistDurationStr}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="playlist-controls-row">
                  <div className="playlist-controls-left">
                    <button
                      className="btn-play-large"
                      onClick={handlePlayPlaylist}
                      title="Play Playlist"
                      disabled={displayedTracks.length === 0}
                      style={{ opacity: displayedTracks.length === 0 ? 0.5 : 1 }}
                    >
                      <Play size={28} weight="fill" />
                    </button>
                  </div>
                  <div className="playlist-controls-right" style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn-control"
                      title="Rename Playlist"
                      onClick={() => handleRenamePlaylist(activePlaylist)}
                      style={{
                        border: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: 'var(--bg-secondary)',
                        width: '44px',
                        height: '44px',
                        minWidth: '44px'
                      }}
                    >
                      <PencilSimple size={22} weight="light" />
                    </button>
                    <button
                      className="btn-control"
                      title="Export Playlist as Folder"
                      onClick={() => handleExportPlaylist(activePlaylist)}
                      style={{
                        border: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: 'var(--bg-secondary)',
                        width: '44px',
                        height: '44px',
                        minWidth: '44px'
                      }}
                    >
                      <DownloadSimple size={22} weight="light" />
                    </button>
                    <button
                      className="btn-control danger-hover"
                      title="Delete Playlist"
                      onClick={() => handleDeletePlaylist(activePlaylist)}
                      style={{
                        border: '1px solid rgba(255,78,46,0.1)',
                        backgroundColor: 'var(--bg-secondary)',
                        width: '44px',
                        height: '44px',
                        minWidth: '44px'
                      }}
                    >
                      <Trash size={22} weight="light" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Render Bento compilation grid only on root My Library page */}
            {currentView === 'library' && !activeAlbum && !activePlaylist && !searchQuery && (
              <PlaylistGrid
                albums={albums}
                playlists={playlists}
                playlistTracks={playlistTracks}
                playlistCovers={playlistCovers}
                favoritesCount={favorites.length}
                totalTracksCount={tracks.length}
                totalArtistsCount={totalArtistsCount}
                onSelectAlbum={(name) => setActiveAlbum(name)}
                onSelectPlaylist={(name) => {
                  setActivePlaylist(name)
                  setActiveAlbum(null)
                }}
                onCreatePlaylist={handleCreatePlaylist}
                onSelectFavorites={() => setCurrentView('favorites')}
                onSelectAllSongs={() => setSearchQuery(' ')} // triggers displaying list view with space filter (resets to lists)
              />
            )}

            {/* Track rows (rendered when browsing an album, playlist, searching, favorited, or latest) */}
            {(currentView === 'favorites' || currentView === 'latest' || activeAlbum || activePlaylist || searchQuery) && (
              <div>
                {currentView === 'favorites' && !searchQuery && (
                  <div style={{ marginBottom: '24px' }}>
                    <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Heart size={20} weight="fill" color="var(--accent)" />
                      Liked Songs
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {displayedTracks.length} tracks saved
                    </span>
                  </div>
                )}

                {currentView === 'latest' && !searchQuery && (
                  <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <ClockCounterClockwise size={22} weight="bold" />
                        Recently Added
                      </h2>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {displayedTracks.length} tracks • Sorted by newest added
                      </span>
                    </div>

                    {displayedTracks.length > 0 && (
                      <button
                        className="btn-spotlight-primary"
                        onClick={() => playTrack(displayedTracks[0], displayedTracks)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px' }}
                      >
                        <Play size={16} weight="fill" />
                        <span>Play All</span>
                      </button>
                    )}
                  </div>
                )}

                <TrackList
                  tracks={displayedTracks}
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  onAddToQueue={addToQueue}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={(field) => {
                    if (sortField === field) {
                      if (sortOrder === 'asc') {
                        setSortOrder('desc')
                      } else {
                        setSortField(null)
                      }
                    } else {
                      setSortField(field)
                      setSortOrder('asc')
                    }
                  }}
                  playlists={playlists}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToNewPlaylist={handleCreatePlaylist}
                  onRemoveFromPlaylist={handleRemoveFromPlaylist}
                  currentPlaylistName={activePlaylist}
                  onReorderTracks={activePlaylist ? handleReorderPlaylistTracks : undefined}
                  isAlbumView={Boolean(activeAlbum)}
                />

                {activePlaylist && (
                  <div className="playlist-builder-section" style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '8px' }}>Let's add some songs to your playlist</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Search for songs in your library to add them directly.</p>
                    
                    <div className="playlist-builder-search" style={{ marginBottom: '20px', maxWidth: '400px' }}>
                      <div className="search-input-wrapper" style={{ height: '36px' }}>
                        <MagnifyingGlass size={16} weight="light" />
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search in your library..."
                          value={playlistSearch}
                          onChange={(e) => setPlaylistSearch(e.target.value)}
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div className="playlist-builder-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredAddableTracks.length === 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          No songs found to add.
                        </span>
                      ) : (
                        filteredAddableTracks.map((track) => (
                          <div key={track.filePath} className="playlist-builder-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="track-thumbnail" style={{ width: '32px', height: '32px' }}>
                                {track.coverArt ? (
                                  <img src={track.coverArt} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <MusicNotes size={14} weight="light" />
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{track.title}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{track.artist}</span>
                              </div>
                            </div>
                            <button
                              className="btn-control"
                              title="Add to Playlist"
                              onClick={() => handleAddToPlaylist(activePlaylist, track)}
                              style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--text-primary)', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                            >
                              <span>Add</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Queue Panel */}
      <QueuePanel
        isOpen={isQueueOpen}
        isLyricsOpen={isLyricsOpen}
        onClose={() => setIsQueueOpen(false)}
        allTracks={tracks}
        onAddToQueue={addToQueue}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
        onShuffleQueue={shuffleQueue}
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        queue={queue}
        onReorderQueue={reorderQueue}
      />

      {/* Synced Lyrics Panel */}
      {isLyricsOpen && (
        <LyricsView
          currentTrack={currentTrack}
          seek={seek}
          onClose={() => setIsLyricsOpen(false)}
          isQueueOpen={isQueueOpen}
          onCloseQueue={() => setIsQueueOpen(false)}
          onSwitchToNowPlaying={() => {
            setIsLyricsOpen(false)
            setIsNowPlayingOpen(true)
          }}
        />
      )}

      {/* Full Now Playing Screen (Body Lagu Mode) */}
      {isNowPlayingOpen && (
        <NowPlayingView
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          onPlayPause={togglePlay}
          onNext={nextTrack}
          onPrevious={prevTrack}
          seek={seek}
          onVolumeChange={changeVolume}
          onToggleMute={toggleMute}
          onClose={() => setIsNowPlayingOpen(false)}
          onSwitchToLyrics={() => {
            setIsNowPlayingOpen(false)
            setIsLyricsOpen(true)
          }}
          onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
          isQueueOpen={isQueueOpen}
          sourceTitle={activePlaylist ? `Playing from ${activePlaylist}` : 'Playing from Queue'}
          isShuffle={isShuffle}
          onToggleShuffle={toggleShuffle}
          isRepeat={isRepeat}
          onToggleRepeat={toggleRepeat}
          isFavorite={currentTrack ? favorites.includes(currentTrack.filePath) : false}
          onToggleFavorite={currentTrack ? () => handleToggleFavorite(currentTrack.filePath) : undefined}
          onAddToPlaylist={handleAddToPlaylist}
          onAddToNewPlaylist={handleCreatePlaylist}
          playlists={playlists}
        />
      )}

      {/* Bottom fixed Player Control Bar (Hidden when Now Playing modal is active) */}
      {!isNowPlayingOpen && (
        <PlayerBar
          onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
          isQueueOpen={isQueueOpen}
          onToggleLyrics={() => {
            setIsNowPlayingOpen(false)
            setIsLyricsOpen((prev) => !prev)
          }}
          isLyricsOpen={isLyricsOpen}
          displayedTracks={displayedTracks}
          playlists={playlists}
          favorites={favorites}
          onAddToQueue={addToQueue}
          onToggleFavorite={handleToggleFavorite}
          onAddToPlaylist={handleAddToPlaylist}
          onAddToNewPlaylist={handleCreatePlaylist}
          onOpenNowPlaying={() => {
            setIsLyricsOpen(false)
            setIsNowPlayingOpen(true)
          }}
          currentView={currentView}
          setCurrentView={(view) => {
            setCurrentView(view)
            setActiveAlbum(null)
            setActivePlaylist(null)
          }}
          activePlaylist={activePlaylist}
          activeAlbum={activeAlbum}
          onClearActiveFilters={handleClearFilters}
        />
      )}

      {/* Create New Playlist Custom Modal */}
      {isCreatePlaylistOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsCreatePlaylistOpen(false)
            setPlaylistModalSelectedTracks(new Set())
            setPlaylistModalSearch('')
          }}
        >
          <div className="modal-content playlist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Playlist</h3>
              <button
                className="btn-modal-close"
                onClick={() => {
                  setIsCreatePlaylistOpen(false)
                  setPlaylistModalSelectedTracks(new Set())
                  setPlaylistModalSearch('')
                }}
              >
                <X size={18} weight="light" />
              </button>
            </div>
            <div className="modal-body">
              <label htmlFor="new-playlist-input">Playlist Name</label>
              <input
                id="new-playlist-input"
                type="text"
                className="modal-input"
                placeholder="My Awesome Playlist"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitNewPlaylist()
                  }
                }}
                autoFocus
              />

              {/* Song Selection Area */}
              <div className="modal-song-picker-header">
                <span className="modal-song-picker-label">Choose Songs from Library</span>
                <span className="modal-song-picker-count">
                  {playlistModalSelectedTracks.size}{' '}
                  {playlistModalSelectedTracks.size === 1 ? 'song' : 'songs'} selected
                </span>
              </div>

              <div className="modal-song-picker-search">
                <div className="search-input-wrapper" style={{ height: '34px' }}>
                  <MagnifyingGlass size={15} weight="light" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search song, artist, album..."
                    value={playlistModalSearch}
                    onChange={(e) => setPlaylistModalSearch(e.target.value)}
                    style={{ fontSize: '12.5px' }}
                  />
                  {playlistModalSearch && (
                    <button
                      type="button"
                      onClick={() => setPlaylistModalSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {tracks.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectAllFiltered(modalFilteredTracks)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Select All ({modalFilteredTracks.length})
                  </button>
                  {playlistModalSelectedTracks.size > 0 && (
                    <button
                      type="button"
                      onClick={handleClearModalSelection}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              <div className="modal-song-picker-list">
                {modalFilteredTracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '12.5px' }}>
                    {tracks.length === 0 ? 'No songs in your library yet.' : 'No matching songs found.'}
                  </div>
                ) : (
                  modalFilteredTracks.map((track) => {
                    const isSelected = playlistModalSelectedTracks.has(track.filePath)
                    return (
                      <div
                        key={track.filePath}
                        className={`modal-song-picker-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleModalTrackSelect(track.filePath)}
                      >
                        <div className="modal-song-checkbox">
                          {isSelected ? (
                            <CheckSquare size={18} weight="fill" color="var(--accent)" />
                          ) : (
                            <Square size={18} weight="light" />
                          )}
                        </div>
                        <div className="modal-song-thumb">
                          {track.coverArt ? (
                            <img src={track.coverArt} alt={track.title} />
                          ) : (
                            <MusicNotes size={16} weight="light" color="var(--text-tertiary)" />
                          )}
                        </div>
                        <div className="modal-song-info">
                          <span className="modal-song-title">{track.title}</span>
                          <span className="modal-song-artist">{track.artist || 'Unknown Artist'}</span>
                        </div>
                        <span className="modal-song-duration">{formatSeconds(track.duration)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-modal-cancel"
                onClick={() => {
                  setIsCreatePlaylistOpen(false)
                  setPlaylistModalSelectedTracks(new Set())
                  setPlaylistModalSearch('')
                }}
              >
                Cancel
              </button>
              <button
                className="btn-modal-submit"
                onClick={handleSubmitNewPlaylist}
                disabled={!newPlaylistName.trim()}
              >
                Create Playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
