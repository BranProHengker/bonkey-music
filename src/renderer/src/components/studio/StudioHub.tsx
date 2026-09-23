import { useState } from 'react'
import {
  Sparkle,
  Sliders,
  Equalizer
} from '@phosphor-icons/react'
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
  currentTime = 0,
  seek,
  allTracks = []
}: StudioHubProps) {
  const [activeTab, setActiveTab] = useState<'lrc' | 'inspector'>('lrc')
  const [lrcInitialQuery, setLrcInitialQuery] = useState('')
  const handleJumpToLrc = (query: string) => {
    setLrcInitialQuery(query)
    setActiveTab('lrc')
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
              Lossless audio quality inspector and synchronized lyrics editor with Romaji transliteration.
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="studio-segmented">
          <button
            className={`studio-segmented-pill ${activeTab === 'lrc' ? 'active' : ''}`}
            onClick={() => setActiveTab('lrc')}
          >
            <Sparkle size={15} weight={activeTab === 'lrc' ? 'bold' : 'regular'} />
            <span>Lyrics & Romaji Studio</span>
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
          onSelectForLrcStudio={handleJumpToLrc}
          allTracks={allTracks}
        />
      )}
    </div>
  )
}
