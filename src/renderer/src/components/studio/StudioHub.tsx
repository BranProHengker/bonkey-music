import { useState } from 'react'
import {
  DownloadSimple,
  Sparkle,
  Sliders,
  Equalizer
} from '@phosphor-icons/react'
import FlacDownloader from './FlacDownloader'
import LrcStudio from './LrcStudio'
import LosslessInspector from './LosslessInspector'
import type { TrackMeta } from '../../hooks/useAudioEngine'

interface StudioHubProps {
  currentTrack?: TrackMeta | null
  currentTime?: number
  seek?: (time: number) => void
  onTrackImported?: (trackPath: string) => void
}

export default function StudioHub({
  currentTrack,
  currentTime = 0,
  seek,
  onTrackImported
}: StudioHubProps) {
  const [activeTab, setActiveTab] = useState<'downloader' | 'lrc' | 'inspector'>('downloader')
  const [lrcInitialQuery, setLrcInitialQuery] = useState('')
  const [inspectorInitialPath, setInspectorInitialPath] = useState('')

  const handleJumpToLrc = (query: string) => {
    setLrcInitialQuery(query)
    setActiveTab('lrc')
  }

  const handleJumpToInspector = (filePath: string) => {
    setInspectorInitialPath(filePath)
    setActiveTab('inspector')
  }

  return (
    <div className="studio-hub-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '80px' }}>
      {/* Studio Navigation Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Equalizer size={22} weight="bold" color="var(--accent)" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Music Studio
              </h1>
              <span className="badge-hires" style={{ fontSize: '10px' }}>
                v2.0 Hub
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              FLAC Downloader, Auto-ID3 Embedder, Lossless Inspector & Synced Lyrics Port
            </span>
          </div>
        </div>

        {/* Tab Pills */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            gap: '2px'
          }}
        >
          <button
            className={`filter-pill ${activeTab === 'downloader' ? 'active' : ''}`}
            onClick={() => setActiveTab('downloader')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <DownloadSimple size={15} weight={activeTab === 'downloader' ? 'bold' : 'light'} />
            <span>FLAC Downloader</span>
          </button>

          <button
            className={`filter-pill ${activeTab === 'lrc' ? 'active' : ''}`}
            onClick={() => setActiveTab('lrc')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkle size={15} weight={activeTab === 'lrc' ? 'bold' : 'light'} />
            <span>LRC Lyrics Studio</span>
          </button>

          <button
            className={`filter-pill ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sliders size={15} weight={activeTab === 'inspector' ? 'bold' : 'light'} />
            <span>Lossless Inspector</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'downloader' && (
        <FlacDownloader
          onSelectForLrcStudio={handleJumpToLrc}
          onSelectForInspector={handleJumpToInspector}
          onTrackImported={onTrackImported}
        />
      )}

      {activeTab === 'lrc' && (
        <LrcStudio
          currentTrack={currentTrack}
          currentTime={currentTime}
          seek={seek}
          initialQuery={lrcInitialQuery}
        />
      )}

      {activeTab === 'inspector' && (
        <LosslessInspector
          currentTrack={currentTrack}
          initialFilePath={inspectorInitialPath}
          onSelectForLrcStudio={handleJumpToLrc}
        />
      )}
    </div>
  )
}
