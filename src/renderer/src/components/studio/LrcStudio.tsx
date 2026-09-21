import { useState, useMemo, useEffect, useRef } from 'react'
import {
  MagnifyingGlass,
  Sparkle,
  Copy,
  Check,
  DownloadSimple,
  FloppyDisk,
  Eye,
  Code,
  ArrowClockwise,
  CheckCircle,
  FileText,
  Info,
  Disc
} from '@phosphor-icons/react'
import type { LrcSearchResult } from '../../../../preload/index.d'
import type { TrackMeta } from '../../hooks/useAudioEngine'

interface LrcStudioProps {
  currentTrack?: TrackMeta | null
  currentTime?: number
  seek?: (time: number) => void
  initialQuery?: string
}

interface ParsedLyricLine {
  id: number
  timeTag: string
  seconds: number
  originalText: string
  romajiText?: string
}

export default function LrcStudio({
  currentTrack,
  currentTime = 0,
  seek,
  initialQuery = ''
}: LrcStudioProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LrcSearchResult[]>([])
  const [selectedTrack, setSelectedTrack] = useState<LrcSearchResult | null>(null)

  const [originalLrc, setOriginalLrc] = useState('')
  const [romajiLrc, setRomajiLrc] = useState('')
  const [dualLrc, setDualLrc] = useState('')
  const [rawEditedLrc, setRawEditedLrc] = useState('')

  const [isConvertingRomaji, setIsConvertingRomaji] = useState(false)
  const [isRomajiConverted, setIsRomajiConverted] = useState(false)
  const [syncOffset, setSyncOffset] = useState(0) // seconds
  const [exportMode, setExportMode] = useState<'dual' | 'romaji' | 'original'>('dual')
  const [activeView, setActiveView] = useState<'karaoke' | 'raw'>('karaoke')
  const [hasCopied, setHasCopied] = useState(false)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

  const karaokeContainerRef = useRef<HTMLDivElement | null>(null)

  // Auto-fill initial query if provided
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery)
      handleSearch(initialQuery)
    }
  }, [initialQuery])

  const containsJapanese = (text: string): boolean => {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
  }

  const isJapaneseSong = useMemo(() => {
    return containsJapanese(originalLrc)
  }, [originalLrc])

  const formatLrcWithWatermark = (raw: string): string => {
    if (!raw || !raw.trim()) return ''
    const title = selectedTrack?.trackName || currentTrack?.title || ''
    const artist = selectedTrack?.artistName || currentTrack?.artist || ''

    const lines = raw.split('\n')
    const contentLines: string[] = []
    let foundTi = ''
    let foundAr = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^\[ti:\s*(.*?)\s*\]$/i.test(trimmed)) {
        foundTi = trimmed.match(/^\[ti:\s*(.*?)\s*\]$/i)?.[1]?.trim() || ''
      } else if (/^\[ar:\s*(.*?)\s*\]$/i.test(trimmed)) {
        foundAr = trimmed.match(/^\[ar:\s*(.*?)\s*\]$/i)?.[1]?.trim() || ''
      } else if (/^\[by:.*\]$/i.test(trimmed)) {
        // Strip legacy by-tag
      } else {
        contentLines.push(line)
      }
    }

    const finalTi = foundTi || title
    const finalAr = foundAr || artist

    const headerTags: string[] = []
    if (finalTi) headerTags.push(`[ti:${finalTi}]`)
    if (finalAr) headerTags.push(`[ar:${finalAr}]`)
    headerTags.push(`[by:Bonkey Music]`)

    while (contentLines.length > 0 && !contentLines[0].trim()) {
      contentLines.shift()
    }

    return `${headerTags.join('\n')}\n\n${contentLines.join('\n')}`
  }

  const finalLrcOutput = useMemo(() => {
    let content = ''
    if (activeView === 'raw' && rawEditedLrc) {
      content = rawEditedLrc
    } else if (exportMode === 'romaji' && romajiLrc) {
      content = romajiLrc
    } else if (exportMode === 'dual' && dualLrc) {
      content = dualLrc
    } else {
      content = originalLrc
    }
    return formatLrcWithWatermark(content)
  }, [activeView, rawEditedLrc, exportMode, romajiLrc, dualLrc, originalLrc])

  // Parse lines for live karaoke view
  const parsedLines = useMemo<ParsedLyricLine[]>(() => {
    const source = activeView === 'raw' && rawEditedLrc ? rawEditedLrc : originalLrc
    if (!source) return []

    const lines = source.split('\n').map((l) => l.trim()).filter(Boolean)
    const timeRegex = /^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/
    const items: ParsedLyricLine[] = []

    const romajiMap = new Map<string, string>()
    if (romajiLrc) {
      const rLines = romajiLrc.split('\n').map((l) => l.trim()).filter(Boolean)
      for (const r of rLines) {
        const match = r.match(timeRegex)
        if (match) {
          romajiMap.set(`[${match[1]}:${match[2]}]`, match[3].trim())
        }
      }
    }

    let idCounter = 0
    for (const line of lines) {
      const match = line.match(timeRegex)
      if (match) {
        const min = parseInt(match[1], 10)
        const sec = parseFloat(match[2])
        const seconds = min * 60 + sec
        const tag = `[${match[1]}:${match[2]}]`
        const orig = match[3].trim()
        const r = romajiMap.get(tag)

        items.push({
          id: idCounter++,
          timeTag: tag,
          seconds,
          originalText: orig,
          romajiText: r && r !== orig ? r : undefined
        })
      }
    }

    return items.sort((a, b) => a.seconds - b.seconds)
  }, [activeView, rawEditedLrc, originalLrc, romajiLrc])

  // Active line index synced with audio engine
  const activeLineIndex = useMemo(() => {
    if (parsedLines.length === 0) return -1
    const effectiveTime = currentTime - syncOffset

    let activeIdx = -1
    for (let i = 0; i < parsedLines.length; i++) {
      if (effectiveTime >= parsedLines[i].seconds) {
        activeIdx = i
      } else {
        break
      }
    }
    return activeIdx
  }, [parsedLines, currentTime, syncOffset])

  // Auto-scroll karaoke container to active line
  useEffect(() => {
    if (activeLineIndex < 0 || activeView !== 'karaoke' || !karaokeContainerRef.current) return
    const el = karaokeContainerRef.current.querySelector(`[data-line-id="${activeLineIndex}"]`) as HTMLElement
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLineIndex, activeView])

  const handleSearch = async (override?: string) => {
    const q = (override !== undefined ? override : searchQuery).trim()
    if (!q) return

    setIsSearching(true)
    setSearchResults([])
    try {
      const res = await window.api.studio.searchLrc(q)
      setSearchResults(res)
    } catch (err) {
      console.error('LRCLIB search error:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleLoadCurrentTrack = () => {
    if (!currentTrack) return
    const q = `${currentTrack.artist} - ${currentTrack.title}`
    setSearchQuery(q)
    handleSearch(q)
  }

  const handleSelectTrack = (track: LrcSearchResult) => {
    setSelectedTrack(track)
    const raw = track.syncedLyrics || track.plainLyrics || ''
    const formatted = formatLrcWithWatermark(raw)
    setOriginalLrc(formatted)
    setRomajiLrc('')
    setDualLrc(formatted)
    setRawEditedLrc(formatted)
    setIsRomajiConverted(false)
    setSyncOffset(0)
    setSearchResults([])
  }

  const handleGenerateRomaji = async () => {
    if (!originalLrc.trim()) return
    setIsConvertingRomaji(true)
    setApplyMessage(null)

    try {
      const res = await window.api.studio.romajiTransliterate(originalLrc)
      if (res.success) {
        if (!res.isJapanese) {
          setApplyMessage('Notice: No Japanese Kanji/Kana characters detected.')
          return
        }
        if (res.romajiLrc && res.dualLrc) {
          setRomajiLrc(formatLrcWithWatermark(res.romajiLrc))
          setDualLrc(formatLrcWithWatermark(res.dualLrc))
          setRawEditedLrc(formatLrcWithWatermark(res.dualLrc))
          setIsRomajiConverted(true)
          setExportMode('dual')
          setApplyMessage('Romaji bilingual lyrics generated successfully!')
        }
      } else {
        setApplyMessage(`Romaji generation error: ${res.message || 'Failed'}`)
      }
    } catch (err: any) {
      console.error('Romaji generation error:', err)
      setApplyMessage('Error communicating with Romaji generator.')
    } finally {
      setIsConvertingRomaji(false)
    }
  }

  const handleApplyToCurrentSong = async () => {
    if (!currentTrack?.filePath) {
      setApplyMessage('No track is currently loaded in the player to apply lyrics to.')
      return
    }

    try {
      const res = await window.api.studio.saveLrc({
        audioFilePath: currentTrack.filePath,
        title: currentTrack.title,
        artist: currentTrack.artist,
        lrcContent: finalLrcOutput
      })

      if (res.success) {
        setApplyMessage(`Applied to active track! Saved at: ${res.filePath}`)
      } else {
        setApplyMessage(`Failed to save: ${res.error}`)
      }
    } catch (err: any) {
      setApplyMessage(`Error saving LRC: ${err?.message || err}`)
    }
  }

  const handleDownloadFile = () => {
    if (!finalLrcOutput) return
    const blob = new Blob([finalLrcOutput], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    const base = selectedTrack
      ? `${selectedTrack.artistName} - ${selectedTrack.trackName}`
      : currentTrack
        ? `${currentTrack.artist} - ${currentTrack.title}`
        : 'lyrics'

    const suffix = exportMode === 'romaji' ? ' (Romaji)' : exportMode === 'dual' ? ' (Dual)' : ''
    a.download = `${base}${suffix}.lrc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalLrcOutput)
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
    } catch {
      // Fallback
    }
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
              <Sparkle size={22} weight="bold" />
              <span>Synced Lyrics Studio & Romaji Generator</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Fetch millisecond-synced lyrics from LRCLIB, transcribe Japanese Kanji into Romaji, preview live karaoke, and apply directly to your local songs.
            </p>
          </div>

          {currentTrack && (
            <button
              className="btn-control"
              onClick={handleLoadCurrentTrack}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Disc size={16} weight="light" />
              <span>Load Playing: {currentTrack.title}</span>
            </button>
          )}
        </div>

        {/* LRCLIB Search Input Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, height: '44px' }}>
            <MagnifyingGlass size={18} weight="light" />
            <input
              type="text"
              className="search-input"
              placeholder="Search song title and artist on LRCLIB (e.g. Yorushika - Matasaburo)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              style={{ fontSize: '14px' }}
            />
          </div>

          <button
            className="btn-spotlight-primary"
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
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
            <span>Search Lyrics</span>
          </button>
        </div>

        {/* Search Results Dropdown List */}
        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              AVAILABLE VERSIONS IN LRCLIB ({searchResults.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectTrack(item)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    transition: 'all 0.15s ease'
                  }}
                  className="studio-result-card"
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.trackName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {containsJapanese(item.trackName + (item.syncedLyrics || '')) && (
                      <span className="badge-hires" style={{ fontSize: '10px' }}>JP</span>
                    )}
                    <span className="badge-hires" style={{ fontSize: '10px' }}>
                      {item.syncedLyrics ? 'Synced' : 'Plain'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Notice / Status message */}
      {applyMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Info size={16} weight="bold" />
          <span>{applyMessage}</span>
        </div>
      )}

      {/* Main Studio Stage (when lyrics are loaded) */}
      {originalLrc ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Ribbon & Controllers */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            {/* Left: Romaji Generator & View Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {isJapaneseSong && !isRomajiConverted && (
                <button
                  className="btn-spotlight-primary"
                  onClick={handleGenerateRomaji}
                  disabled={isConvertingRomaji}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    borderRadius: '6px'
                  }}
                >
                  {isConvertingRomaji ? (
                    <ArrowClockwise size={14} className="animate-spin" />
                  ) : (
                    <Sparkle size={14} weight="bold" />
                  )}
                  <span>{isConvertingRomaji ? 'Romanizing...' : 'Generate Romaji'}</span>
                </button>
              )}

              {isRomajiConverted && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#10b981',
                    fontWeight: 600,
                    padding: '6px 10px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '6px'
                  }}
                >
                  <CheckCircle size={16} weight="fill" />
                  <span>Romaji Active</span>
                </div>
              )}

              {/* View Switcher: Karaoke vs Raw */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  className={`filter-pill ${activeView === 'karaoke' ? 'active' : ''}`}
                  onClick={() => setActiveView('karaoke')}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Eye size={14} />
                  <span>Karaoke Stage</span>
                </button>
                <button
                  className={`filter-pill ${activeView === 'raw' ? 'active' : ''}`}
                  onClick={() => setActiveView('raw')}
                  style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Code size={14} />
                  <span>Raw Editor</span>
                </button>
              </div>

              {/* Offset Tuner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginRight: '4px' }}>
                  OFFSET:
                </span>
                <button
                  className="btn-control"
                  style={{ padding: '2px 6px', fontSize: '11px' }}
                  onClick={() => setSyncOffset((prev) => Math.round((prev - 0.2) * 10) / 10)}
                >
                  -0.2s
                </button>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '40px', textAlign: 'center', color: syncOffset !== 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s`}
                </span>
                <button
                  className="btn-control"
                  style={{ padding: '2px 6px', fontSize: '11px' }}
                  onClick={() => setSyncOffset((prev) => Math.round((prev + 0.2) * 10) / 10)}
                >
                  +0.2s
                </button>
                {syncOffset !== 0 && (
                  <button
                    className="btn-control"
                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--text-tertiary)' }}
                    onClick={() => setSyncOffset(0)}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Right: Output Mode & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Output Mode Selector */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  className={`filter-pill ${exportMode === 'dual' ? 'active' : ''}`}
                  onClick={() => setExportMode('dual')}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Dual-Line
                </button>
                <button
                  className={`filter-pill ${exportMode === 'romaji' ? 'active' : ''}`}
                  disabled={!romajiLrc}
                  onClick={() => setExportMode('romaji')}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Romaji
                </button>
                <button
                  className={`filter-pill ${exportMode === 'original' ? 'active' : ''}`}
                  onClick={() => setExportMode('original')}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Original
                </button>
              </div>

              {/* Copy */}
              <button
                className="btn-control"
                onClick={handleCopy}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {hasCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>{hasCopied ? 'Copied' : 'Copy'}</span>
              </button>

              {/* Apply to Current Track (Desktop Special) */}
              <button
                className="btn-spotlight-primary"
                onClick={handleApplyToCurrentSong}
                disabled={!currentTrack}
                title={currentTrack ? `Save alongside ${currentTrack.title}` : 'Play a track to apply lyrics'}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FloppyDisk size={14} weight="bold" />
                <span>Apply to Current Song</span>
              </button>

              {/* Download File */}
              <button
                className="btn-control"
                onClick={handleDownloadFile}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <DownloadSimple size={14} />
                <span>Export .lrc</span>
              </button>
            </div>
          </div>

          {/* Lyrics View Canvas */}
          <div
            style={{
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              minHeight: '440px',
              padding: '24px'
            }}
          >
            {activeView === 'karaoke' ? (
              <div
                ref={karaokeContainerRef}
                style={{
                  maxHeight: '480px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  paddingRight: '12px'
                }}
              >
                {parsedLines.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '60px 0' }}>
                    No timestamped lyric lines found. Switch to Raw Editor to edit plain text.
                  </div>
                ) : (
                  parsedLines.map((line, idx) => {
                    const isActive = activeLineIndex === idx
                    return (
                      <div
                        key={line.id}
                        data-line-id={idx}
                        onClick={() => seek?.(line.seconds)}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: isActive ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: isActive ? '17px' : '15px',
                              fontWeight: isActive ? 700 : 400,
                              color: isActive ? '#ffffff' : 'var(--text-secondary)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {line.originalText}
                          </span>
                          {line.romajiText && (
                            <span
                              style={{
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)'
                              }}
                            >
                              {line.romajiText}
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                          }}
                        >
                          {line.timeTag}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                  <span>Raw .lrc Content (Editable)</span>
                  <span>{rawEditedLrc.split('\n').length} lines</span>
                </div>
                <textarea
                  value={rawEditedLrc}
                  onChange={(e) => setRawEditedLrc(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '440px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    resize: 'vertical',
                    outline: 'none'
                  }}
                  placeholder="[00:00.00] Lyrics..."
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty Workspace Prompt */
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px dashed rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <FileText size={36} weight="light" style={{ opacity: 0.4 }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            No lyrics loaded yet
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: 0 }}>
            Search for a track using the LRCLIB search bar above, or click "Load Playing" to fetch synced lyrics for the current song.
          </p>
        </div>
      )}
    </div>
  )
}
