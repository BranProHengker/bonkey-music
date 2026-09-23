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
  Info,
  X
} from '@phosphor-icons/react'
import type { OnlineTrack, DownloadProgress, TrackFormatOption } from '../../../../preload/index.d'
import type { TrackMeta } from '../../hooks/useAudioEngine'

interface FlacDownloaderProps {
  currentTrack?: TrackMeta | null
  isPlaying?: boolean
  togglePlay?: () => void
  onPlayTrack?: (track: TrackMeta) => void
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
  currentTrack,
  isPlaying,
  togglePlay,
  onPlayTrack,
  onSelectForLrcStudio,
  onSelectForInspector,
  onTrackImported
}: FlacDownloaderProps) {
  const [query, setQuery] = useState('')
  const [searchSource, setSearchSource] = useState<'deezer' | 'qobuz'>('deezer')
  const [isSearching, setIsSearching] = useState(false)
  const [tracks, setTracks] = useState<OnlineTrack[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null)
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({})
  const [showCustomUrlDrawer, setShowCustomUrlDrawer] = useState(false)

  // Quality / Format Selector Modal State
  const [selectedFormatTrack, setSelectedFormatTrack] = useState<OnlineTrack | null>(null)
  const [availableFormats, setAvailableFormats] = useState<TrackFormatOption[]>([])
  const [isLoadingFormats, setIsLoadingFormats] = useState(false)

  // Custom Direct Stream inputs
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [customArtist, setCustomArtist] = useState('')
  const [customAlbum, setCustomAlbum] = useState('')
  const [customCover, setCustomCover] = useState('')

  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

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

  const handleSearch = async (searchTerm?: string, sourceOverride?: 'deezer' | 'qobuz') => {
    const text = (searchTerm !== undefined ? searchTerm : query).trim()
    if (!text) return
    const src = sourceOverride || searchSource

    setIsSearching(true)
    setHasSearched(true)
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      setPreviewTrackId(null)
    }

    try {
      const results = await window.api.studio.searchTracks(text, src)
      setTracks(results || [])
    } catch (err) {
      console.error('Failed to search tracks:', err)
      setTracks([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSourceChange = (newSource: 'deezer' | 'qobuz') => {
    setSearchSource(newSource)
    if (query.trim()) {
      handleSearch(query, newSource)
    }
  }

  const handlePlayTrack = (track: OnlineTrack) => {
    if (!track.previewUrl) return

    if (onPlayTrack) {
      if (currentTrack?.filePath === track.previewUrl) {
        togglePlay?.()
        return
      }
      onPlayTrack({
        filePath: track.previewUrl,
        title: track.title,
        artist: track.artist,
        album: track.album || 'Online Preview',
        duration: track.duration,
        trackNumber: null,
        year: track.releaseYear,
        genre: null,
        coverArt: track.coverArt,
        lossless: false,
        container: 'mp3'
      })
      setPreviewTrackId(track.id)
    } else {
      togglePreview(track)
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

  const openFormatSelector = async (track: OnlineTrack) => {
    setSelectedFormatTrack(track)
    setIsLoadingFormats(true)
    try {
      const formats = await window.api.studio.getTrackFormats(track)
      setAvailableFormats(formats || [])
    } catch (err) {
      console.error('Failed to get track formats:', err)
      if (track.source === 'deezer') {
        setAvailableFormats([
          { id: 'flac', label: 'FLAC', desc: 'Lossless · maximum quality', recommended: true, tag: 'FLAC' },
          { id: 'mp3_320', label: 'MP3 320K', desc: '320 kbps · high quality', tag: 'MP3' },
          { id: 'mp3_128', label: 'MP3 128K', desc: '128 kbps · smaller size', tag: 'MP3' }
        ])
      } else {
        setAvailableFormats([
          { id: 5, label: 'MP3 320', desc: '320 kbps' },
          { id: 6, label: 'FLAC CD', desc: '16-bit · 44.1 kHz', recommended: true }
        ])
      }
    } finally {
      setIsLoadingFormats(false)
    }
  }

  const handleDownload = async (track: OnlineTrack, formatOption?: TrackFormatOption) => {
    setDownloadStatuses((prev) => ({
      ...prev,
      [track.id]: { state: 'downloading', percent: 0 }
    }))

    try {
      const res = await window.api.studio.downloadTrack(track, undefined, formatOption)
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

  const getSearchPlaceholder = (): string => {
    return searchSource === 'qobuz'
      ? 'Search Qobuz catalog for Studio Master 24-bit Hi-Res & 16-bit FLAC (e.g. Daft Punk)...'
      : 'Search Deezer catalog for 16-bit FLAC / 320kbps tracks (e.g. YOASOBI)...'
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
        <div style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DownloadSimple size={22} weight="bold" />
            <span>Lossless & High-Res Downloader</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Search Deezer and Qobuz for lossless tracks, official album art, and auto-paired lyrics.
          </p>
        </div>

        {/* Catalog Source Selector & Direct URL Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="studio-segmented">
            {[
              { id: 'deezer', label: 'Deezer FLAC' },
              { id: 'qobuz', label: 'Qobuz Hi-Res' }
            ].map((src) => {
              const isActive = searchSource === src.id
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => handleSourceChange(src.id as 'deezer' | 'qobuz')}
                  className={`studio-segmented-pill ${isActive ? 'active' : ''}`}
                >
                  <span>{src.label}</span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="studio-btn-secondary"
            onClick={() => setShowCustomUrlDrawer((prev) => !prev)}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              borderColor: showCustomUrlDrawer ? 'var(--accent)' : undefined
            }}
          >
            <Link size={15} />
            <span>Direct Stream URL</span>
          </button>
        </div>

        {/* Custom Stream Input Drawer */}
        {showCustomUrlDrawer && (
          <div
            style={{
              marginBottom: '18px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.35)',
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
                className="studio-btn-secondary"
                onClick={() => setShowCustomUrlDrawer(false)}
              >
                Cancel
              </button>
              <button
                className="studio-btn-primary"
                onClick={handleCustomDownload}
                disabled={!customUrl.trim() || !customTitle.trim()}
              >
                Download & Embed Tags
              </button>
            </div>
          </div>
        )}

        {/* Studio Online Search Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, height: '40px' }}>
            <MagnifyingGlass size={18} weight="light" />
            <input
              type="text"
              className="search-input"
              placeholder={getSearchPlaceholder()}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
            />
          </div>

          <button
            className="studio-btn-primary"
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            style={{
              height: '40px',
              padding: '0 20px',
              borderRadius: '8px',
              fontSize: '13px'
            }}
          >
            {isSearching ? <ArrowClockwise size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
            <span>Search</span>
          </button>
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
              const isPlayingThis =
                (currentTrack?.filePath === track.previewUrl && isPlaying) ||
                (previewTrackId === track.id && previewAudioRef.current && !previewAudioRef.current.paused)

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
                          onClick={() => handlePlayTrack(track)}
                          title={isPlayingThis ? 'Pause preview' : 'Play preview'}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: isPlayingThis ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.3)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer',
                            opacity: isPlayingThis ? 1 : 0.85
                          }}
                        >
                          {isPlayingThis ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
                        </button>
                      )}
                    </div>

                    <div
                      style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px', cursor: track.previewUrl ? 'pointer' : 'default' }}
                      onClick={() => track.previewUrl && handlePlayTrack(track)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.title}
                        </span>
                        {track.releaseYear && (
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                            {track.releaseYear}
                          </span>
                        )}
                        {track.source && (
                          <span
                            className={`studio-tag ${
                              track.source === 'qobuz'
                                ? 'studio-tag-qobuz'
                                : track.source === 'deezer'
                                  ? 'studio-tag-deezer'
                                  : 'studio-tag-neutral'
                            }`}
                          >
                            {track.source === 'qobuz' ? (track.hires ? 'QOBUZ HI-RES' : 'QOBUZ') : track.source.toUpperCase()}
                          </span>
                        )}
                        {track.qualityLabel && !track.hires && (
                          <span className="studio-tag studio-tag-neutral">
                            {track.qualityLabel}
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
                        className="studio-btn-primary"
                        onClick={() => {
                          if (track.source === 'custom') {
                            handleDownload(track)
                          } else {
                            openFormatSelector(track)
                          }
                        }}
                      >
                        <DownloadSimple size={15} weight="bold" />
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                          <CheckCircle size={15} weight="fill" />
                          <span>Saved</span>
                        </span>

                        {status.filePath && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="studio-btn-icon"
                              title="Reveal audio file in folder"
                              onClick={() => window.api.openFileLocation(status.filePath!)}
                            >
                              <FolderOpen size={15} />
                            </button>

                            <button
                              className="studio-btn-icon"
                              title="Inspect audio spectrum & quality"
                              onClick={() => onSelectForInspector?.(status.filePath!)}
                            >
                              <Sliders size={15} />
                            </button>

                            <button
                              className="studio-btn-icon"
                              title="Open in Synced Lyrics Studio"
                              onClick={() => onSelectForLrcStudio?.(`${track.artist} - ${track.title}`)}
                            >
                              <Sparkle size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {status.state === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#ef4444' }}>{status.error || 'Failed'}</span>
                        <button
                          className="studio-btn-secondary"
                          onClick={() => {
                            if (track.source === 'custom') {
                              handleDownload(track)
                            } else {
                              openFormatSelector(track)
                            }
                          }}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
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

      {/* Quality / Format Selection Modal */}
      {selectedFormatTrack && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setSelectedFormatTrack(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '430px',
              background: '#0e0e11',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '22px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedFormatTrack(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px'
              }}
              title="Close"
            >
              <X size={16} />
            </button>

            {/* Track Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingRight: '24px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#1a1a22',
                  flexShrink: 0
                }}
              >
                {selectedFormatTrack.coverArt ? (
                  <img
                    src={selectedFormatTrack.coverArt}
                    alt={selectedFormatTrack.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MusicNotes size={22} weight="light" />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px', flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFormatTrack.title}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFormatTrack.artist}
                </div>
                {selectedFormatTrack.album && (
                  <div style={{ fontSize: '12px', color: '#636366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFormatTrack.album}
                  </div>
                )}
                <div style={{ marginTop: '2px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.6px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      background: selectedFormatTrack.source === 'qobuz' ? 'rgba(63, 120, 209, 0.15)' : 'rgba(20, 184, 166, 0.12)',
                      border: selectedFormatTrack.source === 'qobuz' ? '1px solid rgba(63, 120, 209, 0.4)' : '1px solid rgba(20, 184, 166, 0.35)',
                      color: selectedFormatTrack.source === 'qobuz' ? '#60a5fa' : '#2dd4bf'
                    }}
                  >
                    {selectedFormatTrack.source === 'qobuz' ? 'QOBUZ' : 'DEEZER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.07)', margin: '16px 0' }} />

            {/* Formats List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isLoadingFormats ? (
                <div style={{ padding: '30px 0', textAlign: 'center', color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <ArrowClockwise size={20} className="animate-spin" />
                  <span style={{ fontSize: '12px' }}>Loading available qualities...</span>
                </div>
              ) : (
                availableFormats.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    className="studio-format-option-card"
                    onClick={() => {
                      handleDownload(selectedFormatTrack, fmt)
                      setSelectedFormatTrack(null)
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#ffffff' }}>
                        {fmt.label}
                      </span>

                      {fmt.recommended && (
                        <span
                          style={{
                            background: 'rgba(5, 150, 105, 0.18)',
                            border: '1px solid rgba(5, 150, 105, 0.45)',
                            color: '#10b981',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            letterSpacing: '0.4px'
                          }}
                        >
                          RECOMMENDED
                        </span>
                      )}

                      {fmt.tag && (
                        <span
                          style={{
                            background: 'rgba(20, 184, 166, 0.15)',
                            border: '1px solid rgba(20, 184, 166, 0.4)',
                            color: '#2dd4bf',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            letterSpacing: '0.4px'
                          }}
                        >
                          {fmt.tag}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#8e8e93', marginTop: '4px' }}>
                      {fmt.desc}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
