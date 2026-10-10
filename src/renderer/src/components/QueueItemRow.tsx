import React, { memo } from 'react'
import { Equals, MusicNotes, Play, X } from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface QueueItemRowProps {
  track: TrackMeta
  index: number
  isCurrent: boolean
  isPlaying: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent, index: number) => void
  onDragOver?: (e: React.DragEvent, index: number) => void
  onDragLeave?: (e: React.DragEvent, index: number) => void
  onDrop?: (e: React.DragEvent, index: number) => void
  onDragEnd?: (e: React.DragEvent) => void
  onPlay: (track: TrackMeta) => void
  onRemove: (filePath: string) => void
  formatTime?: (seconds: number) => string
}

function formatDuration(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function QueueItemRow({
  track,
  index,
  isCurrent,
  isPlaying,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onPlay,
  onRemove,
  formatTime = formatDuration
}: QueueItemRowProps) {
  const isDraggable = Boolean(onDragStart)

  return (
    <div
      className={`queue-unified-row ${isCurrent ? 'active' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart?.(e, index)}
      onDragOver={(e) => onDragOver?.(e, index)}
      onDragLeave={(e) => onDragLeave?.(e, index)}
      onDrop={(e) => onDrop?.(e, index)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onClick={() => onPlay(track)}
      title="Click to play, drag handle to reorder"
    >
      {/* 1. Drag Handle on the left */}
      {isDraggable && (
        <div className="queue-row-drag-handle" title="Drag to reorder" onClick={(e) => e.stopPropagation()}>
          <Equals size={16} weight="bold" />
        </div>
      )}

      {/* 2. Cover Art Thumbnail */}
      <div className="queue-row-thumb">
        {track.coverArt ? (
          <img src={track.coverArt} alt={track.title} />
        ) : (
          <MusicNotes size={16} weight="light" />
        )}

        {/* Animated Equalizer when current & playing, else Play overlay on hover */}
        {isCurrent && isPlaying ? (
          <div className="queue-equalizer-overlay">
            <span className="eq-bar eq-1" />
            <span className="eq-bar eq-2" />
            <span className="eq-bar eq-3" />
          </div>
        ) : (
          <div className="queue-item-play-overlay">
            <Play size={12} weight="fill" />
          </div>
        )}
      </div>

      {/* 3. Track Details: Title & Artist */}
      <div className="queue-row-info">
        <span className="queue-row-title" title={track.title}>
          {track.title}
        </span>
        <span className="queue-row-artist" title={track.artist}>
          {track.artist || 'Unknown Artist'}
        </span>
      </div>

      {/* 4. Duration */}
      {track.duration > 0 && (
        <span className="queue-row-time">{formatTime(track.duration)}</span>
      )}

      {/* 5. Remove Button */}
      <button
        type="button"
        className="queue-row-remove-btn"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(track.filePath)
        }}
        title="Remove from queue"
        aria-label="Remove"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}

export default memo(QueueItemRow)
