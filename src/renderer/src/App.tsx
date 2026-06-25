import { useState, useEffect, useMemo, useRef } from 'react'
import {
  MagnifyingGlass,
  FolderOpen,
  ArrowLeft,
  ArrowClockwise,
  Heart,
  Folder,
  Info
} from '@phosphor-icons/react'

import Sidebar from './components/Sidebar'
import TrackList from './components/TrackList'
import PlaylistGrid from './components/PlaylistGrid'
import PlayerBar from './components/PlayerBar'
import { useAudioEngine, TrackMeta } from './hooks/useAudioEngine'

interface AlbumGroup {
  name: string
  artist: string
  coverArt: string | null
  tracks: TrackMeta[]
}

export default function App(): React.JSX.Element {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const {
    playTrack,
    currentTrack,
    isPlaying,
    volume,
    changeVolume,
    nextTrack,
    prevTrack,
    toggleShuffle,
    togglePlay,
    toggleRepeat,
    isShuffle
  } = useAudioEngine()

  // ─── State ──────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<'library' | 'favorites' | 'settings'>('library')
  const [libraryFolder, setLibraryFolder] = useState<string | null>(null)
  const [tracks, setTracks] = useState<TrackMeta[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [playlists, setPlaylists] = useState<string[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, string[]>>({})
  
  const [searchQuery, setSearchQuery] = useState('')
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null)
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [sortField, setSortField] = useState<'title' | 'artist' | 'album' | 'genre' | 'duration' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // ─── Navigation History ──────────────────────────────────────────────
  const [history, setHistory] = useState<Array<{
    currentView: 'library' | 'favorites' | 'settings'
    activePlaylist: string | null
    activeAlbum: string | null
  }>>([{ currentView: 'library', activePlaylist: null, activeAlbum: null }])
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

  const goBack = () => {
    if (historyIndex > 0) {
      setIsNavigatingHistory(true)
      const nextIndex = historyIndex - 1
      setHistoryIndex(nextIndex)
      const state = history[nextIndex]
      setCurrentView(state.currentView)
      setActivePlaylist(state.activePlaylist)
      setActiveAlbum(state.activeAlbum)
    }
  }

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      setIsNavigatingHistory(true)
      const nextIndex = historyIndex + 1
      setHistoryIndex(nextIndex)
      const state = history[nextIndex]
      setCurrentView(state.currentView)
      setActivePlaylist(state.activePlaylist)
      setActiveAlbum(state.activeAlbum)
    }
  }

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
      }

      if (e.ctrlKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          nextTrack()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          prevTrack()
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault()
          toggleShuffle()
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault()
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        } else if (e.key === 'l' || e.key === 'L') {
          e.preventDefault()
          toggleRepeat()
        }
      }
    }

    // 3. Ctrl + Wheel Scroll for Volume Control
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          changeVolume(Math.min(1, volume + 0.05))
        } else if (e.deltaY > 0) {
          changeVolume(Math.max(0, volume - 0.05))
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
  }, [historyIndex, history, volume, changeVolume, nextTrack, prevTrack, toggleShuffle, togglePlay, toggleRepeat, isShuffle])

  // ─── Load Library and Settings ──────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const settings = await window.api.loadSettings()
      if (settings) {
        if (typeof settings.libraryFolder === 'string') {
          setLibraryFolder(settings.libraryFolder)
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
      }

      const lib = await window.api.loadLibrary()
      if (lib && Array.isArray(lib)) {
        setTracks(lib as TrackMeta[])
      }
    }
    loadData()
  }, [])

  // ─── Save Settings Helper ───────────────────────────────────────────
  const persistSettings = async (updates: Record<string, unknown>) => {
    const settings = await window.api.loadSettings()
    const updatedSettings = {
      ...settings,
      ...updates
    }
    await window.api.saveSettings(updatedSettings)
  }

  // ─── Folder Selection & Scanning ────────────────────────────────────
  const handleSelectFolder = async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setLibraryFolder(folder)
      handleScanFolder(folder)
    }
  }

  const handleScanFolder = async (path: string) => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const scannedTracks = await window.api.scanFolder(path)
      if (scannedTracks && Array.isArray(scannedTracks)) {
        setTracks(scannedTracks as TrackMeta[])
      }
    } catch (err) {
      console.error('Scan error:', err)
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

  // ─── Playlists Management ──────────────────────────────────────────
  const handleCreatePlaylist = async () => {
    const name = prompt('Enter playlist name:')
    if (!name) return
    const trimmed = name.trim()
    if (trimmed && !playlists.includes(trimmed)) {
      const nextPlaylists = [...playlists, trimmed]
      setPlaylists(nextPlaylists)
      await persistSettings({ playlists: nextPlaylists })
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

  // Filtered tracks based on view, playlist, album, and search query
  const displayedTracks = useMemo(() => {
    let result = [...tracks]

    // 1. Filter by Main View
    if (currentView === 'favorites') {
      result = result.filter((t) => favorites.includes(t.filePath))
    } else if (currentView === 'library') {
      if (activePlaylist) {
        const pFilePaths = playlistTracks[activePlaylist] || []
        result = result.filter((t) => pFilePaths.includes(t.filePath))
      } else if (activeAlbum) {
        result = result.filter((t) => t.album === activeAlbum)
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
        const valA = a[sortField] || ''
        const valB = b[sortField] || ''

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA)
        }

        // Numbers (duration)
        return sortOrder === 'asc'
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number)
      })
    }

    return result
  }, [tracks, currentView, activePlaylist, activeAlbum, favorites, playlistTracks, searchQuery, sortField, sortOrder])

  // ─── Handlers ───────────────────────────────────────────────────────
  const handlePlayTrack = (track: TrackMeta) => {
    // Provide queue context so next/prev can advance sequentially within current filtered list
    playTrack(track, displayedTracks)
  }

  // Go back to full library view when browsing specific album or playlist
  const handleClearFilters = () => {
    setActivePlaylist(null)
    setActiveAlbum(null)
    setSearchQuery('')
  }

  return (
    <div className="app-container">
      {/* Draggable header bar */}
      <header className="app-header">
        <div className="app-title">Vault Audio Player</div>
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
      />

      {/* Main Panel */}
      <main className="main-content">
        {/* Search Bar / Action Bar */}
        <div className="search-bar-container">
          <div className="search-input-wrapper">
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

          {libraryFolder && (
            <button
              className="btn-secondary"
              onClick={() => handleScanFolder(libraryFolder)}
              disabled={isScanning}
            >
              <span>{isScanning ? 'Syncing...' : 'Sync Folder'}</span>
              <div className="btn-icon-circle">
                <ArrowClockwise size={14} weight="light" className={isScanning ? 'animate-spin' : ''} />
              </div>
            </button>
          )}
        </div>

        {/* View Routing */}
        {currentView === 'settings' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h2 className="section-title">Settings</h2>
            
            <div className="settings-section">
              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-title">Music Library Folder</span>
                  <span className="settings-subtitle">Select where your local audio files are located</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {libraryFolder && <span className="settings-value">{libraryFolder}</span>}
                  <button className="btn-primary" onClick={handleSelectFolder}>
                    <FolderOpen size={16} weight="light" />
                    <span>Choose Folder</span>
                  </button>
                </div>
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

              {libraryFolder && (
                <div className="settings-row">
                  <div className="settings-label">
                    <span className="settings-title">Recompile Metadata Cache</span>
                    <span className="settings-subtitle">Scans library for new tracks and updates metadata tags</span>
                  </div>
                  <button className="btn-secondary" onClick={() => handleScanFolder(libraryFolder)} disabled={isScanning}>
                    <span>{isScanning ? 'Scanning...' : 'Rescan Library'}</span>
                    <div className="btn-icon-circle">
                      <ArrowClockwise size={14} weight="light" />
                    </div>
                  </button>
                </div>
              )}
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
                  <kbd className="keybind-key">Ctrl + Scroll Wheel</kbd>
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
              </div>
            </div>

            <div className="settings-section" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.01)', boxShadow: 'none', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <Info size={16} weight="light" color="var(--accent)" />
                <span>Supports MP3, FLAC, WAV, M4A, OGG, AAC, WMA audio formats.</span>
              </div>
            </div>
          </div>
        ) : !libraryFolder ? (
          /* Empty Library / Init State */
          <div className="empty-state">
            <div className="empty-state-icon">
              <Folder size={28} weight="light" />
            </div>
            <h2>Setup Your Library</h2>
            <p>
              To get started, select the folder on your computer where your local music files are stored. We'll automatically index your tracks.
            </p>
            <button className="btn-primary" onClick={handleSelectFolder} style={{ marginTop: '8px' }}>
              <FolderOpen size={18} weight="light" />
              <span>Select Music Folder</span>
            </button>
          </div>
        ) : (
          /* Dashboard or Track List Views */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Header section with back button if active filter is set */}
            {(activeAlbum || activePlaylist || searchQuery) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  className="btn-control"
                  onClick={handleClearFilters}
                  style={{ border: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'var(--bg-secondary)' }}
                >
                  <ArrowLeft size={16} weight="light" />
                </button>
                <div>
                  <h2 className="section-title" style={{ marginBottom: 0 }}>
                    {activeAlbum ? `Album: ${activeAlbum}` : activePlaylist ? `Playlist: ${activePlaylist}` : 'Search Results'}
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {displayedTracks.length} tracks found
                  </span>
                </div>
              </div>
            )}

            {/* Render Bento compilation grid only on root My Library page */}
            {currentView === 'library' && !activeAlbum && !activePlaylist && !searchQuery && (
              <PlaylistGrid
                albums={albums}
                favoritesCount={favorites.length}
                totalTracksCount={tracks.length}
                totalArtistsCount={totalArtistsCount}
                onSelectAlbum={(name) => setActiveAlbum(name)}
                onSelectFavorites={() => setCurrentView('favorites')}
                onSelectAllSongs={() => setSearchQuery(' ')} // triggers displaying list view with space filter (resets to lists)
              />
            )}

            {/* Track rows (rendered when browsing an album, playlist, searching, or favorited) */}
            {(currentView === 'favorites' || activeAlbum || activePlaylist || searchQuery) && (
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

                <TrackList
                  tracks={displayedTracks}
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
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
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom fixed Player Control Bar */}
      <PlayerBar displayedTracks={displayedTracks} />
    </div>
  )
}
