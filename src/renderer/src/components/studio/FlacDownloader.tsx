import { useState, useEffect, useRef } from 'react'
import {
  MagnifyingGlass,
  DownloadSimple,
  Play,
  Pause,
  CheckCircle,
  FolderOpen,
  Sliders,
  ArrowClockwise,
  Sparkle,
  MusicNotes,
  Link,
  Info
} from '@phosphor-icons/react'
import type { OnlineTrack, DownloadProgress } from '../../../../preload/index.d'

interface FlacDownloaderProps {
  onSelectForLrcStudio?: (query: string) => void
  onSelectForInspector?: (filePath: string) => void
  onTrackImported?: (trackPath: string) => void
}

interface DownloadStatus {
  state: 'idle' | 'downloading' | 'tagging' | 'completed' | 'error'
  percent: number
  filePath?: string
  lrcPath?: string
  error?: string
}

export default function FlacDownloader({
  onSelectForLrcStudio,
  onSelectForInspector,
  onTrackImported
}: FlacDownloaderProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [tracks, setTracks] = useState<OnlineTrack[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null)
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})
  const [showCustomUrlDrawer, setShowCustomUrlDrawer] = useState(false)

  // Custom Direct Stream inputs
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [customArtist, setCustomArtist] = useState('')
  const [customAlbum, setCustomAlbum] = useState('')
  const [customCover, setCustomCover] = useState('')

  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Quick query recommendation chips
  const quickPills = [
    'YOASOBI - Idol',
    'Yorushika - Replicant',
    'Radiohead - Creep',
    'Fujii Kaze - Shinunoga E-Wa',
    'Queen - Bohemian Rhapsody',
    'Ado - Show'
  ]

  // Listen for download progress updates from backend IPC
  useEffect(() => {
    const unsub = window.api.studio.onDownloadProgress((prog: DownloadProgress) => {
      setDownloadStatuses((prev) => {
        const cur = prev[prog.id]
        if (!cur || cur.state === 'completed' || cur.state === 'error') return prev
        return {
          ...prev,
          [prog.id]: {
            ...cur,
            state: prog.percent >= 99 ? 'tagging' : 'downloading',
            percent: prog.percent
          }
        }
      })
    })

    return () => {
      unsub()
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [])

  const handleSearch = async (searchTerm?: string) => {
    const text = (searchTerm !== undefined ? searchTerm : query).trim()
    if (!text) return

    setIsSearching(true)
    setHasSearched(true)
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPreviewTrackId(null)
    }

    try {
      const results = await window.api.studio.searchTracks(text)
      setTracks(results)
    } catch (err) {
      console.error('Failed to search tracks:', err)
      setTracks([])
    } finally {
      setIsSearching(false)
    }
  }

  const togglePreview = (track: OnlineTrack) => {
    if (!track.previewUrl) return

    if (previewTrackId === track.id && previewAudioRef.current) {
      if (previewAudioRef.current.paused) {
        previewAudioRef.current.play()
      } else {
        previewAudioRef.current.pause()
        setPreviewTrackId(null)
      }
      return
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
    }

    const audio = new Audio(track.previewUrl)
    previewAudioRef.current = audio
    setPreviewTrackId(track.id)

    audio.onended = () => {
      setPreviewTrackId(null)
    }
    audio.play().catch((err) => {
      console.warn('Audio preview playback error:', err)
      setPreviewTrackId(null)
    })
  }

  const handleDownload = async (track: OnlineTrack) => {
    setDownloadStatuses((prev) => ({
      ...prev,
      [track.id]: { state: 'downloading', percent: 0 }
    }))

    try {
      const res = await window.api.studio.downloadTrack(track)
      if (res.success && res.filePath) {
        setDownloadStatuses((prev) => ({
          ...prev,
          [track.id]: {
            state: 'completed',
            percent: 100,
            filePath: res.filePath,
            lrcPath: res.lrcPath
          }
        }))
        // Automatically import into Bonkey Music library so it is ready to play
        try {
          await window.api.importFiles([res.filePath])
          onTrackImported?.(res.filePath)
        } catch {}
      } else {
        setDownloadStatuses((prev) => ({
          ...prev,
          [track.id]: {
            state: 'error',
            percent: 0,
            error: res.error || 'Download failed'
          }
        }))
      }
    } catch (err: any) {
      setDownloadStatuses((prev) => ({
        ...prev,
        [track.id]: {
          state: 'error',
          percent: 0,
          error: err?.message || 'Download error'
        }
      }))
    }
  }

  const handleCustomDownload = async () => {
    if (!customUrl.trim() || !customTitle.trim()) return

    const customTrack: OnlineTrack = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      artist: customArtist.trim() || 'Unknown Artist',
      album: customAlbum.trim() || 'Single',
      duration: 0,
      coverArt: customCover.trim() || null,
      releaseYear: new Date().getFullYear(),
      previewUrl: customUrl.trim()
    }

    await handleDownload(customTrack)
    setCustomUrl('')
    setCustomTitle('')
    setCustomArtist('')
    setCustomAlbum('')
    setCustomCover('')
    setShowCustomUrlDrawer(false)
  }

  const formatDuration = (sec: number): string => {
    if (!sec || isNaN(sec)) return '--:--'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="studio-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Search Header Banner */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DownloadSimple size={22} weight="bold" />
              <span>Lossless & High-Res Audio Downloader</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Search across global catalogs for high-resolution metadata, official album art, and auto-paired synchronized lyrics.
            </p>
          </div>

          <button
            className="btn-control"
            onClick={() => setShowCustomUrlDrawer((prev) => !prev)}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: showCustomUrlDrawer ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <Link size={16} weight="light" />
            <span>Direct Audio URL</span>
          </button>
        </div>

        {/* Custom Stream Input Drawer */}
        {showCustomUrlDrawer && (
          <div
            style={{
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={16} weight="bold" />
              <span>Direct Audio Stream / FLAC URL Resolver</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Stream URL (http://... *.flac, *.mp3)"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                style={{ gridColumn: 'span 2' }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Song Title *"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Artist Name"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Album Title"
                value={customAlbum}
                onChange={(e) => setCustomAlbum(e.target.value)}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Cover Art URL (optional)"
                value={customCover}
                onChange={(e) => setCustomCover(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn-control"
                onClick={() => setShowCustomUrlDrawer(false)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                className="btn-spotlight-primary"
                onClick={handleCustomDownload}
                disabled={!customUrl.trim() || !customTitle.trim()}
                style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '6px' }}
              >
                Download & Embed Tags
              </button>
            </div>
          </div>
        )}

        {/* Studio Online Search Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, height: '44px' }}>
            <MagnifyingGlass size={18} weight="light" />
            <input
              type="text"
              className="search-input"
              placeholder="Search online catalog by song title or artist (e.g. YOASOBI - Idol)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              style={{ fontSize: '14px' }}
            />
          </div>

          <button
            className="btn-spotlight-primary"
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            style={{
              height: '44px',
              padding: '0 20px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            {isSearching ? <ArrowClockwise size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
            <span>Search</span>
          </button>
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
            Quick Search:
          </span>
          {quickPills.map((pill) => (
            <button
              key={pill}
              type="button"
              className="filter-pill"
              onClick={() => {
                setQuery(pill)
                handleSearch(pill)
              }}
              style={{ fontSize: '11px', padding: '4px 10px', background: 'rgba(255,255,255,0.03)' }}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Stage */}
      {isSearching && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ArrowClockwise size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Searching online music databases...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Resolving 1400x1400 artwork and audio streams</div>
        </div>
      )}

      {!isSearching && hasSearched && tracks.length === 0 && (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '12px'
          }}
        >
          <MusicNotes size={32} weight="light" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No online tracks found</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Try checking spelling or search with artist keywords.
          </div>
        </div>
      )}

      {!isSearching && tracks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              Found {tracks.length} tracks
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Auto ID3 injection & paired .lrc active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tracks.map((track) => {
              const status = downloadStatuses[track.id] || { state: 'idle', percent: 0 }
              const isPlayingPreview = previewTrackId === track.id

              return (
                <div
                  key={track.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    gap: '16px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Left: Cover Art & Track Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        position: 'relative',
                        width: '48px',
                        height: '48px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: '#1a1a20',
                        flexShrink: 0
                      }}
                    >
                      {track.coverArt ? (
                        <img
                          src={track.coverArt}
                          alt={track.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MusicNotes size={20} weight="light" />
                        </div>
                      )}

                      {/* Preview Play/Pause Overlay */}
                      {track.previewUrl && (
                        <button
                          type="button"
                          onClick={() => togglePreview(track)}
                          title={isPlayingPreview ? 'Pause 30s preview' : 'Play 30s preview'}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: isPlayingPreview ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer',
                            opacity: isPlayingPreview ? 1 : 0.8
                          }}
                        >
                          {isPlayingPreview ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.title}
                        </span>
                        {track.releaseYear && (
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {track.releaseYear}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</span>
                        {track.album && (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>{track.album}</span>
                          </>
                        )}
                        {track.duration > 0 && (
                          <>
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{formatDuration(track.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions & Download Progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {status.state === 'idle' && (
                      <button
                        className="btn-spotlight-primary"
                        onClick={() => handleDownload(track)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          borderRadius: '6px'
                        }}
                      >
                        <DownloadSimple size={16} weight="bold" />
                        <span>Download</span>
                      </button>
                    )}

                    {status.state === 'downloading' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '130px' }}>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          Downloading {status.percent}%
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${status.percent}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s ease' }} />
                        </div>
                      </div>
                    )}

                    {status.state === 'tagging' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        <ArrowClockwise size={14} className="animate-spin" />
                        <span>Injecting ID3 & LRC...</span>
                      </div>
                    )}

                    {status.state === 'completed' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#10b981', fontWeight: 500 }}>
                          <CheckCircle size={16} weight="fill" />
                          <span>Saved</span>
                        </div>

                        {status.filePath && (
                          <>
                            <button
                              className="btn-control"
                              title="Reveal audio file in folder"
                              onClick={() => window.api.openFileLocation(status.filePath!)}
                              style={{ padding: '6px 10px', fontSize: '11px' }}
                            >
                              <FolderOpen size={14} />
                            </button>

                            <button
                              className="btn-control"
                              title="Inspect frequency spectrum & quality"
                              onClick={() => onSelectForInspector?.(status.filePath!)}
                              style={{ padding: '6px 10px', fontSize: '11px' }}
                            >
                              <Sliders size={14} />
                              <span style={{ marginLeft: '4px' }}>Inspect</span>
                            </button>

                            <button
                              className="btn-control"
                              title="Open in Synced Lyrics Studio"
                              onClick={() => onSelectForLrcStudio?.(`${track.artist} - ${track.title}`)}
                              style={{ padding: '6px 10px', fontSize: '11px' }}
                            >
                              <Sparkle size={14} />
                              <span style={{ marginLeft: '4px' }}>LRC</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {status.state === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#ef4444' }}>{status.error || 'Failed'}</span>
                        <button
                          className="btn-control"
                          onClick={() => handleDownload(track)}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
