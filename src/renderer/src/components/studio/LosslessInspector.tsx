import { useState, useEffect, useRef } from 'react'
import {
  Sliders,
  FolderOpen,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  XCircle,
  Sparkle,
  MusicNotes,
  Disc,
  Trash,
  Copy,
  Check,
  MagnifyingGlass,
  StopCircle,
  ChartBar
} from '@phosphor-icons/react'
import type { LosslessInspectionResult } from '../../../../preload/index.d'
import type { TrackMeta } from '../../hooks/useAudioEngine'

interface LosslessInspectorProps {
  currentTrack?: TrackMeta | null
  initialFilePath?: string
  onSelectForLrcStudio?: (query: string) => void
  allTracks?: TrackMeta[]
}

interface BatchProgress {
  current: number
  total: number
  currentFileName?: string
}

export default function LosslessInspector({
  currentTrack,
  initialFilePath,
  onSelectForLrcStudio,
  allTracks = []
}: LosslessInspectorProps) {
  const [isInspecting, setIsInspecting] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [results, setResults] = useState<LosslessInspectionResult[]>([])
  const [selectedResult, setSelectedResult] = useState<LosslessInspectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [filter, setFilter] = useState<'all' | 'fake' | 'transcode' | 'lossless'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  const cancelBatchRef = useRef(false)

  // Single file inspection
  const inspectFile = async (filePath: string) => {
    if (!filePath) return
    setIsInspecting(true)
    setError(null)

    try {
      const res = await window.api.studio.inspectLossless(filePath)
      if (res) {
        setResults((prev) => {
          const filtered = prev.filter((r) => r.filePath !== res.filePath)
          return [res, ...filtered]
        })
        setSelectedResult(res)
      } else {
        setError('Could not inspect audio file. Ensure the file exists and is a valid audio format.')
      }
    } catch (err: any) {
      console.error('Inspection failed:', err)
      setError(err?.message || 'Failed to inspect file')
    } finally {
      setIsInspecting(false)
    }
  }

  // Batch inspection with smooth chunked progress updates
  const runBatchInspection = async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return
    setIsInspecting(true)
    setError(null)
    cancelBatchRef.current = false
    setBatchProgress({ current: 0, total: filePaths.length, currentFileName: 'Initializing...' })

    const CHUNK_SIZE = 8
    try {
      for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
        if (cancelBatchRef.current) break

        const chunk = filePaths.slice(i, i + CHUNK_SIZE)
        const currentName = chunk[0]?.split(/[/\\]/).pop() || ''
        setBatchProgress({
          current: i,
          total: filePaths.length,
          currentFileName: currentName
        })

        let chunkResults: LosslessInspectionResult[] = []
        if (typeof window.api?.studio?.inspectMultiple === 'function') {
          chunkResults = await window.api.studio.inspectMultiple(chunk)
        } else if (typeof window.api?.studio?.inspectLossless === 'function') {
          // Resilient fallback: inspect tracks via inspectLossless
          const inspected = await Promise.all(
            chunk.map(async (fp) => {
              try {
                return await window.api.studio.inspectLossless(fp)
              } catch {
                return null
              }
            })
          )
          chunkResults = inspected.filter((r): r is LosslessInspectionResult => r !== null)
        } else {
          throw new Error('Lossless inspection service is not available. Please restart the app.')
        }

        if (chunkResults && chunkResults.length > 0) {
          setResults((prev) => {
            const existingPaths = new Set(prev.map((r) => r.filePath))
            const newItems = chunkResults.filter((r) => !existingPaths.has(r.filePath))
            return [...prev, ...newItems]
          })
          setSelectedResult((prev) => prev || chunkResults[0])
        }
      }
    } catch (err: any) {
      console.error('Batch inspection error:', err)
      setError(err?.message || 'Error occurred during batch inspection')
    } finally {
      setIsInspecting(false)
      setBatchProgress(null)
    }
  }

  const handleStopBatch = () => {
    cancelBatchRef.current = true
  }

  // Inspect initial file if passed from props
  useEffect(() => {
    if (initialFilePath) {
      inspectFile(initialFilePath)
    }
  }, [initialFilePath])

  // Scan actions with resilient IPC fallbacks
  const handlePickSingleOrMultipleFiles = async () => {
    try {
      let files: string[] = []
      if (typeof window.api?.studio?.selectMultipleFiles === 'function') {
        files = await window.api.studio.selectMultipleFiles()
      } else if (typeof window.api?.selectFiles === 'function') {
        files = (await window.api.selectFiles()) || []
      } else if (typeof window.api?.studio?.selectFile === 'function') {
        const single = await window.api.studio.selectFile()
        if (single) files = [single]
      }

      if (files && files.length > 0) {
        if (files.length === 1) {
          inspectFile(files[0])
        } else {
          runBatchInspection(files)
        }
      }
    } catch (err) {
      console.error('File selection error:', err)
    }
  }

  const handleScanFolder = async () => {
    try {
      let files: string[] = []
      if (typeof window.api?.studio?.selectFolderToInspect === 'function') {
        files = await window.api.studio.selectFolderToInspect()
      } else if (typeof window.api?.selectFolder === 'function') {
        const folder = await window.api.selectFolder()
        if (folder) {
          const scanned = await window.api.scanFolder(folder)
          if (Array.isArray(scanned)) {
            files = (scanned as TrackMeta[]).map((t) => t.filePath).filter(Boolean)
          }
        }
      }
      if (files && files.length > 0) {
        runBatchInspection(files)
      }
    } catch (err) {
      console.error('Folder selection error:', err)
    }
  }

  const handleScanLibrary = () => {
    if (!allTracks || allTracks.length === 0) return
    const filePaths = allTracks.map((t) => t.filePath).filter(Boolean)
    runBatchInspection(filePaths)
  }

  const handleInspectCurrent = () => {
    if (currentTrack?.filePath) {
      inspectFile(currentTrack.filePath)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i] as any
        const p = f.path || f.name
        if (p) paths.push(p)
      }
      if (paths.length === 1) {
        inspectFile(paths[0])
      } else if (paths.length > 1) {
        runBatchInspection(paths)
      }
    }
  }

  // Filtering & Stats calculation
  const stats = {
    total: results.length,
    lossless: results.filter((r) => r.verdict === 'lossless').length,
    goodTranscode: results.filter((r) => r.verdict === 'good_transcode').length,
    lowUpscale: results.filter((r) => r.verdict === 'low_upscale').length
  }

  const filteredResults = results.filter((r) => {
    if (filter === 'lossless' && r.verdict !== 'lossless') return false
    if (filter === 'transcode' && r.verdict !== 'good_transcode') return false
    if (filter === 'fake' && r.verdict !== 'low_upscale') return false
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      return r.fileName.toLowerCase().includes(q) || r.filePath.toLowerCase().includes(q)
    }
    return true
  })

  const handleCopyFakeList = () => {
    const fakes = results.filter((r) => r.verdict === 'low_upscale')
    if (fakes.length === 0) return
    const text = fakes
      .map(
        (f) =>
          `[SUSPICIOUS / FAKE FLAC]\nFile: ${f.fileName}\nCutoff: ${f.estimatedCutoffKhz.toFixed(1)} kHz | Codec: ${f.format.toUpperCase()} ${Math.round(f.bitrate / 1000)} kbps\nPath: ${f.filePath}`
      )
      .join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClearResults = () => {
    setResults([])
    setSelectedResult(null)
  }

  return (
    <div className="studio-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '24px'
        }}
      >
        {/* Title & Description */}
        <div style={{ marginBottom: '18px' }}>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sliders size={22} weight="bold" />
            <span>Real Lossless Inspector & Batch Spectrum Analyzer</span>
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Scan individual tracks, multiple files, folders, or your entire library to detect authentic lossless audio (&gt;20 kHz) vs fake upscaled transcode MP3s.
          </p>
        </div>

        {/* Studio Action Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '16px'
          }}
        >
          {allTracks && allTracks.length > 0 && (
            <button
              className="studio-btn-secondary"
              onClick={handleScanLibrary}
              disabled={isInspecting}
              title={`Batch inspect all ${allTracks.length} tracks in your library`}
            >
              <Disc size={16} weight="bold" color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>Scan Entire Library ({allTracks.length})</span>
            </button>
          )}

          <button
            className="studio-btn-secondary"
            onClick={handleScanFolder}
            disabled={isInspecting}
            title="Select a music folder to recursively batch inspect"
          >
            <FolderOpen size={16} />
            <span>Scan Music Folder...</span>
          </button>

          {currentTrack && (
            <button
              className="studio-btn-secondary"
              onClick={handleInspectCurrent}
              disabled={isInspecting}
              title={`Inspect currently playing song: ${currentTrack.title}`}
            >
              <MusicNotes size={16} />
              <span>Inspect Playing: {currentTrack.title}</span>
            </button>
          )}
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handlePickSingleOrMultipleFiles}
          style={{
            border: isDragging ? '2px dashed var(--accent)' : '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '24px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          <MusicNotes size={28} weight="light" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Drop single or multiple audio files here (.flac, .wav, .mp3, .m4a) or click to browse
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Multi-select supported • Real-time FFT spectral cutoff & codec validation
          </div>
        </div>
      </div>

      {/* Batch Inspection Progress Banner */}
      {batchProgress && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowClockwise size={18} className="animate-spin" color="var(--accent)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Batch Inspecting Audio Files ({batchProgress.current} / {batchProgress.total})
              </span>
              {batchProgress.currentFileName && (
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Current: {batchProgress.currentFileName}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%
              </span>
              <button
                className="btn-control"
                onClick={handleStopBatch}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#ef4444'
                }}
              >
                <StopCircle size={14} weight="bold" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100))}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.2s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Loading state for single file */}
      {isInspecting && !batchProgress && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ArrowClockwise size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Inspecting audio stream & frequency bins...</div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <XCircle size={18} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards & Filters (shown when results exist) */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* KPI Dashboard */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="studio-spec-card">
              <span className="spec-label">TOTAL SCANNED</span>
              <span className="spec-value">{stats.total} Tracks</span>
            </div>

            <div
              className="studio-spec-card"
              style={{
                background: 'rgba(16, 185, 129, 0.05)',
                borderColor: 'rgba(16, 185, 129, 0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="studio-status-dot lossless" />
                <span className="spec-label" style={{ color: '#10b981' }}>
                  TRUE LOSSLESS (&gt;20 kHz)
                </span>
              </div>
              <span className="spec-value" style={{ color: '#10b981' }}>
                {stats.lossless} ({Math.round((stats.lossless / Math.max(1, stats.total)) * 100)}%)
              </span>
            </div>

            <div
              className="studio-spec-card"
              style={{
                background: 'rgba(245, 158, 11, 0.05)',
                borderColor: 'rgba(245, 158, 11, 0.2)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="studio-status-dot transcode" />
                <span className="spec-label" style={{ color: '#f59e0b' }}>
                  GOOD TRANSCODE (~18-20 kHz)
                </span>
              </div>
              <span className="spec-value" style={{ color: '#f59e0b' }}>
                {stats.goodTranscode} ({Math.round((stats.goodTranscode / Math.max(1, stats.total)) * 100)}%)
              </span>
            </div>

            <div
              className="studio-spec-card"
              style={{
                background: stats.lowUpscale > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.025)',
                borderColor: stats.lowUpscale > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`studio-status-dot ${stats.lowUpscale > 0 ? 'fake' : ''}`} style={stats.lowUpscale === 0 ? { background: 'var(--text-tertiary)' } : {}} />
                <span className="spec-label" style={{ color: stats.lowUpscale > 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                  FAKE / UPSCALE (&lt;16 kHz)
                </span>
              </div>
              <span className="spec-value" style={{ color: stats.lowUpscale > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                {stats.lowUpscale} ({Math.round((stats.lowUpscale / Math.max(1, stats.total)) * 100)}%)
              </span>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '8px'
            }}
          >
            {/* Filter Pills */}
            <div className="studio-segmented">
              <button
                className={`studio-segmented-pill ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <span>All ({stats.total})</span>
              </button>

              <button
                className={`studio-segmented-pill ${filter === 'lossless' ? 'active' : ''}`}
                onClick={() => setFilter('lossless')}
              >
                <span className="studio-status-dot lossless" />
                <span>True Lossless ({stats.lossless})</span>
              </button>

              <button
                className={`studio-segmented-pill ${filter === 'transcode' ? 'active' : ''}`}
                onClick={() => setFilter('transcode')}
              >
                <span className="studio-status-dot transcode" />
                <span>Transcode ({stats.goodTranscode})</span>
              </button>

              <button
                className={`studio-segmented-pill ${filter === 'fake' ? 'active' : ''}`}
                onClick={() => setFilter('fake')}
              >
                <span className="studio-status-dot fake" />
                <span style={{ color: stats.lowUpscale > 0 ? '#ef4444' : undefined }}>Fake / Upscale ({stats.lowUpscale})</span>
              </button>
            </div>

            {/* Right Tools: Search, Copy Fake List, Clear */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <MagnifyingGlass
                  size={14}
                  style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }}
                />
                <input
                  type="text"
                  placeholder="Filter by filename..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '6px 10px 6px 30px',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '180px'
                  }}
                />
              </div>

              {stats.lowUpscale > 0 && (
                <button
                  className="studio-btn-secondary"
                  onClick={handleCopyFakeList}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.25)'
                  }}
                  title="Copy list of fake FLAC tracks to clipboard"
                >
                  {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy Fake List'}</span>
                </button>
              )}

              <button
                className="studio-btn-secondary"
                onClick={handleClearResults}
                style={{ padding: '5px 10px', fontSize: '12px' }}
                title="Clear all inspected results"
              >
                <Trash size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto'
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '13px'
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      backdropFilter: 'blur(8px)'
                    }}
                  >
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: '150px' }}>
                      VERDICT
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                      TRACK / FILE
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: '120px' }}>
                      CODEC / SPEC
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: '120px' }}>
                      CUTOFF
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', width: '140px', textAlign: 'right' }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No songs match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((item) => {
                      const isSelected = selectedResult?.filePath === item.filePath
                      return (
                        <tr
                          key={item.filePath}
                          onClick={() => setSelectedResult(item)}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          {/* Verdict Badge */}
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border:
                                  item.verdict === 'lossless'
                                    ? '1px solid rgba(16, 185, 129, 0.4)'
                                    : item.verdict === 'good_transcode'
                                      ? '1px solid rgba(245, 158, 11, 0.4)'
                                      : '1px solid rgba(239, 68, 68, 0.4)',
                                background:
                                  item.verdict === 'lossless'
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : item.verdict === 'good_transcode'
                                      ? 'rgba(245, 158, 11, 0.1)'
                                      : 'rgba(239, 68, 68, 0.15)',
                                color:
                                  item.verdict === 'lossless'
                                    ? '#10b981'
                                    : item.verdict === 'good_transcode'
                                      ? '#f59e0b'
                                      : '#ef4444'
                              }}
                            >
                              {item.verdict === 'lossless' ? (
                                <CheckCircle size={14} weight="bold" />
                              ) : item.verdict === 'good_transcode' ? (
                                <WarningCircle size={14} weight="bold" />
                              ) : (
                                <XCircle size={14} weight="bold" />
                              )}
                              <span>{item.verdictLabel}</span>
                            </span>
                          </td>

                          {/* Filename */}
                          <td style={{ padding: '12px 16px' }}>
                            <div
                              style={{
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                maxWidth: '320px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={item.fileName}
                            >
                              {item.fileName}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-tertiary)',
                                maxWidth: '320px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: '2px'
                              }}
                              title={item.filePath}
                            >
                              {item.filePath}
                            </div>
                          </td>

                          {/* Codec & Bitrate */}
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            <div style={{ color: 'var(--text-primary)' }}>
                              {item.format.toUpperCase()} {item.bitsPerSample > 0 ? `${item.bitsPerSample}-bit` : ''}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {(item.sampleRate / 1000).toFixed(1)} kHz • {item.bitrate > 0 ? `${Math.round(item.bitrate / 1000)} kbps` : 'VBR'}
                            </div>
                          </td>

                          {/* Cutoff frequency */}
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            <span
                              style={{
                                color:
                                  item.verdict === 'lossless'
                                    ? '#10b981'
                                    : item.verdict === 'good_transcode'
                                      ? '#f59e0b'
                                      : '#ef4444',
                                fontWeight: 600
                              }}
                            >
                              {item.estimatedCutoffKhz.toFixed(1)} kHz
                            </span>
                          </td>

                          {/* Row Actions */}
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                className="studio-btn-icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedResult(item)
                                }}
                                title="View FFT Spectrum Analysis"
                              >
                                <ChartBar size={15} />
                              </button>

                              <button
                                className="studio-btn-icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.api.openFileLocation(item.filePath)
                                }}
                                title="Show in Folder"
                              >
                                <FolderOpen size={15} />
                              </button>

                              <button
                                className="studio-btn-icon"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectForLrcStudio?.(item.fileName.replace(/\.[^.]+$/, ''))
                                }}
                                title="Find Lyrics in LRC Studio"
                              >
                                <Sparkle size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Selected Track Deep Dive Inspector */}
      {selectedResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Verdict Banner */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '12px',
              border:
                selectedResult.verdict === 'lossless'
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : selectedResult.verdict === 'good_transcode'
                    ? '1px solid rgba(245, 158, 11, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
              background:
                selectedResult.verdict === 'lossless'
                  ? 'rgba(16, 185, 129, 0.06)'
                  : selectedResult.verdict === 'good_transcode'
                    ? 'rgba(245, 158, 11, 0.06)'
                    : 'rgba(239, 68, 68, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {selectedResult.verdict === 'lossless' ? (
                <CheckCircle size={32} weight="fill" color="#10b981" />
              ) : selectedResult.verdict === 'good_transcode' ? (
                <WarningCircle size={32} weight="fill" color="#f59e0b" />
              ) : (
                <XCircle size={32} weight="fill" color="#ef4444" />
              )}

              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedResult.verdictLabel}: {selectedResult.fileName}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {selectedResult.verdict === 'lossless'
                    ? `True lossless spectrum preserved with estimated cutoff at ${selectedResult.estimatedCutoffKhz.toFixed(1)} kHz.`
                    : selectedResult.verdict === 'good_transcode'
                      ? `Cutoff around ~${selectedResult.estimatedCutoffKhz.toFixed(1)} kHz detected. Consistent with high-quality lossy master.`
                      : `Severe cutoff at ${selectedResult.estimatedCutoffKhz.toFixed(1)} kHz detected. High likelihood of upscaled low-bitrate transcode.`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="studio-btn-secondary"
                onClick={() => window.api.openFileLocation(selectedResult.filePath)}
              >
                <FolderOpen size={15} />
                <span>Show in Folder</span>
              </button>

              <button
                className="studio-btn-secondary"
                onClick={() => onSelectForLrcStudio?.(selectedResult.fileName.replace(/\.[^.]+$/, ''))}
              >
                <Sparkle size={15} />
                <span>Find LRC</span>
              </button>
            </div>
          </div>

          {/* Technical Specs Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px'
            }}
          >
            <div className="studio-spec-card">
              <span className="spec-label">CONTAINER / CODEC</span>
              <span className="spec-value">{selectedResult.format.toUpperCase()}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">SAMPLE RATE</span>
              <span className="spec-value">{(selectedResult.sampleRate / 1000).toFixed(1)} kHz</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">BIT DEPTH</span>
              <span className="spec-value">{selectedResult.bitsPerSample > 0 ? `${selectedResult.bitsPerSample}-bit` : '16-bit'}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">BITRATE</span>
              <span className="spec-value">{selectedResult.bitrate > 0 ? `${Math.round(selectedResult.bitrate / 1000)} kbps` : 'Variable'}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">CHANNELS</span>
              <span className="spec-value">{selectedResult.channels === 2 ? 'Stereo (2ch)' : `${selectedResult.channels} ch`}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">CUTOFF FREQUENCY</span>
              <span
                className="spec-value"
                style={{
                  color:
                    selectedResult.verdict === 'lossless'
                      ? '#10b981'
                      : selectedResult.verdict === 'good_transcode'
                        ? '#f59e0b'
                        : '#ef4444'
                }}
              >
                &gt;{selectedResult.estimatedCutoffKhz.toFixed(1)} kHz
              </span>
            </div>
          </div>

          {/* Frequency Spectrum Graph Visualizer */}
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={16} weight="bold" />
                <span>Estimated Frequency Spectrum Profile ({selectedResult.fileName})</span>
              </div>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                48-Bin FFT Distribution
              </span>
            </div>

            {/* Spectrum Bar Chart */}
            <div
              style={{
                height: '140px',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '3px',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative'
              }}
            >
              {selectedResult.spectrumBins.map((val, idx) => {
                const maxKhz = selectedResult.sampleRate / 2000
                const curKhz = (idx / selectedResult.spectrumBins.length) * maxKhz
                const isAboveCutoff = curKhz > selectedResult.estimatedCutoffKhz

                return (
                  <div
                    key={idx}
                    title={`${curKhz.toFixed(1)} kHz: ${(val * 100).toFixed(0)}% energy`}
                    style={{
                      flex: 1,
                      height: `${Math.round(val * 100)}%`,
                      background: isAboveCutoff
                        ? 'rgba(255, 255, 255, 0.08)'
                        : selectedResult.verdict === 'lossless'
                          ? 'var(--accent)'
                          : selectedResult.verdict === 'good_transcode'
                            ? '#f59e0b'
                            : '#ef4444',
                      borderRadius: '2px 2px 0 0',
                      transition: 'height 0.3s ease'
                    }}
                  />
                )
              })}
            </div>

            {/* Frequency Axis Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              <span>0 kHz</span>
              <span>4 kHz</span>
              <span>8 kHz</span>
              <span>12 kHz</span>
              <span>16 kHz</span>
              <span>20 kHz</span>
              <span>22.05 kHz</span>
              <span>{Math.round(selectedResult.sampleRate / 2000)} kHz</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
