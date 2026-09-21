import { useState, useEffect } from 'react'
import {
  Sliders,
  FolderOpen,
  ArrowClockwise,
  CheckCircle,
  WarningCircle,
  XCircle,
  UploadSimple,
  Sparkle,
  MusicNotes,
  Disc
} from '@phosphor-icons/react'
import type { LosslessInspectionResult } from '../../../../preload/index.d'
import type { TrackMeta } from '../../hooks/useAudioEngine'

interface LosslessInspectorProps {
  currentTrack?: TrackMeta | null
  initialFilePath?: string
  onSelectForLrcStudio?: (query: string) => void
}

export default function LosslessInspector({
  currentTrack,
  initialFilePath,
  onSelectForLrcStudio
}: LosslessInspectorProps) {
  const [isInspecting, setIsInspecting] = useState(false)
  const [result, setResult] = useState<LosslessInspectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const inspectFile = async (filePath: string) => {
    if (!filePath) return
    setIsInspecting(true)
    setError(null)
    setResult(null)

    try {
      const res = await window.api.studio.inspectLossless(filePath)
      if (res) {
        setResult(res)
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

  // Inspect initial file if passed from props
  useEffect(() => {
    if (initialFilePath) {
      inspectFile(initialFilePath)
    }
  }, [initialFilePath])

  const handlePickFile = async () => {
    try {
      const file = await window.api.studio.selectFile()
      if (file) {
        inspectFile(file)
      }
    } catch (err) {
      console.error('File selection error:', err)
    }
  }

  const handleInspectCurrent = () => {
    if (currentTrack?.filePath) {
      inspectFile(currentTrack.filePath)
    }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={22} weight="bold" />
              <span>Real Lossless Inspector & Spectrum Cutoff Checker</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Validate true lossless audio (&gt;22 kHz) and identify fake FLAC upscales or transcoded MP3s via acoustic frequency analysis.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentTrack && (
              <button
                className="btn-control"
                onClick={handleInspectCurrent}
                style={{ padding: '8px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Disc size={16} weight="light" />
                <span>Inspect Playing: {currentTrack.title}</span>
              </button>
            )}

            <button
              className="btn-spotlight-primary"
              onClick={handlePickFile}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UploadSimple size={16} weight="bold" />
              <span>Select File</span>
            </button>
          </div>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              const file = (e.dataTransfer.files[0] as any).path || e.dataTransfer.files[0].name
              inspectFile(file)
            }
          }}
          onClick={handlePickFile}
          style={{
            border: isDragging ? '2px dashed var(--accent)' : '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            padding: '32px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          <MusicNotes size={32} weight="light" style={{ margin: '0 auto 8px', opacity: 0.6 }} />
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Drop any audio file here (.flac, .mp3, .wav, .m4a) or click to browse
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Analyzes container, sample rate, bit depth, bitrate, and spectral cutoff threshold
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isInspecting && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <ArrowClockwise size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '14px', fontWeight: 500 }}>Inspecting audio stream & frequency bins...</div>
        </div>
      )}

      {/* Error state */}
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

      {/* Inspection Results Dashboard */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Verdict Banner */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '12px',
              border:
                result.verdict === 'lossless'
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : result.verdict === 'good_transcode'
                    ? '1px solid rgba(245, 158, 11, 0.3)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
              background:
                result.verdict === 'lossless'
                  ? 'rgba(16, 185, 129, 0.06)'
                  : result.verdict === 'good_transcode'
                    ? 'rgba(245, 158, 11, 0.06)'
                    : 'rgba(239, 68, 68, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {result.verdict === 'lossless' ? (
                <CheckCircle size={32} weight="fill" color="#10b981" />
              ) : result.verdict === 'good_transcode' ? (
                <WarningCircle size={32} weight="fill" color="#f59e0b" />
              ) : (
                <XCircle size={32} weight="fill" color="#ef4444" />
              )}

              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {result.verdictLabel}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {result.verdict === 'lossless'
                    ? `True lossless spectrum preserved with estimated cutoff at ${result.estimatedCutoffKhz.toFixed(1)} kHz.`
                    : result.verdict === 'good_transcode'
                      ? `Cutoff around ~${result.estimatedCutoffKhz.toFixed(1)} kHz detected. Consistent with high-quality lossy master.`
                      : `Severe cutoff at ${result.estimatedCutoffKhz.toFixed(1)} kHz detected. High likelihood of upscaled low-bitrate transcode.`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn-control"
                onClick={() => window.api.openFileLocation(result.filePath)}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FolderOpen size={14} />
                <span>Show in Folder</span>
              </button>

              <button
                className="btn-control"
                onClick={() => onSelectForLrcStudio?.(result.fileName.replace(/\.[^.]+$/, ''))}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkle size={14} />
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
              <span className="spec-value">{result.format.toUpperCase()}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">SAMPLE RATE</span>
              <span className="spec-value">{(result.sampleRate / 1000).toFixed(1)} kHz</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">BIT DEPTH</span>
              <span className="spec-value">{result.bitsPerSample > 0 ? `${result.bitsPerSample}-bit` : '16-bit'}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">BITRATE</span>
              <span className="spec-value">{result.bitrate > 0 ? `${Math.round(result.bitrate / 1000)} kbps` : 'Variable'}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">CHANNELS</span>
              <span className="spec-value">{result.channels === 2 ? 'Stereo (2ch)' : `${result.channels} ch`}</span>
            </div>

            <div className="studio-spec-card">
              <span className="spec-label">CUTOFF FREQUENCY</span>
              <span className="spec-value" style={{ color: result.verdict === 'lossless' ? '#10b981' : '#f59e0b' }}>
                &gt;{result.estimatedCutoffKhz.toFixed(1)} kHz
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
                <span>Estimated Frequency Spectrum Profile</span>
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
              {result.spectrumBins.map((val, idx) => {
                const maxKhz = result.sampleRate / 2000
                const curKhz = (idx / result.spectrumBins.length) * maxKhz
                const isAboveCutoff = curKhz > result.estimatedCutoffKhz

                return (
                  <div
                    key={idx}
                    title={`${curKhz.toFixed(1)} kHz: ${(val * 100).toFixed(0)}% energy`}
                    style={{
                      flex: 1,
                      height: `${Math.round(val * 100)}%`,
                      background: isAboveCutoff
                        ? 'rgba(255, 255, 255, 0.1)'
                        : result.verdict === 'lossless'
                          ? 'var(--accent)'
                          : '#f59e0b',
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
              <span>{Math.round(result.sampleRate / 2000)} kHz</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
