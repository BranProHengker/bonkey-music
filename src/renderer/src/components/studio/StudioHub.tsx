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
  isPlaying?: boolean
  togglePlay?: () => void
  onPlayTrack?: (track: TrackMeta) => void
  currentTime?: number
  seek?: (time: number) => void
  onTrackImported?: (trackPath: string) => void
  allTracks?: TrackMeta[]
}

export default function StudioHub({
  currentTrack,
  isPlaying,
  togglePlay,
  onPlayTrack,
  currentTime = 0,
  seek,
  onTrackImported,
  allTracks = []
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
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              Music Studio
            </h1>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Lossless audio downloader, quality inspector, and synchronized lyrics editor.
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="studio-segmented">
          <button
            className={`studio-segmented-pill ${activeTab === 'downloader' ? 'active' : ''}`}
            onClick={() => setActiveTab('downloader')}
          >
            <DownloadSimple size={15} weight={activeTab === 'downloader' ? 'bold' : 'regular'} />
            <span>FLAC Downloader</span>
          </button>

          <button
            className={`studio-segmented-pill ${activeTab === 'lrc' ? 'active' : ''}`}
            onClick={() => setActiveTab('lrc')}
          >
            <Sparkle size={15} weight={activeTab === 'lrc' ? 'bold' : 'regular'} />
            <span>Lyrics Studio</span>
          </button>

          <button
            className={`studio-segmented-pill ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            <Sliders size={15} weight={activeTab === 'inspector' ? 'bold' : 'regular'} />
            <span>Lossless Inspector</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'downloader' && (
        <FlacDownloader
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          onPlayTrack={onPlayTrack}
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
          allTracks={allTracks}
        />
      )}
    </div>
  )
}
