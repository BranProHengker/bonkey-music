import { useMemo, memo } from 'react'
import {
  MagnifyingGlass,
  Play,
  CaretRight,
  MusicNotes,
  User
} from '@phosphor-icons/react'
import { TrackMeta } from '../hooks/useAudioEngine'

interface DashboardHomeProps {
  tracks: TrackMeta[]
  albums: { name: string; artist: string; coverArt: string | null }[]
  onPlayTrack: (track: TrackMeta, contextTracks?: TrackMeta[]) => void
  onSelectArtist: (artist: string) => void
  onSelectAlbum: (album: string) => void
  onNavigateToLibrary: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
}

interface TopArtistItem {
  name: string
  trackCount: number
  coverArt: string | null
  sampleTrack: TrackMeta
}

function DashboardHome({
  tracks,
  albums,
  onPlayTrack,
  onSelectArtist,
  onSelectAlbum,
  onNavigateToLibrary,
  searchQuery,
  setSearchQuery
}: DashboardHomeProps) {
  // Derive Top Artists from user's actual library
  const topArtists = useMemo<TopArtistItem[]>(() => {
    const artistMap = new Map<string, { count: number; coverArt: string | null; sampleTrack: TrackMeta }>()

    for (const t of tracks) {
      if (!t.artist || t.artist === 'Unknown' || t.artist === 'Unknown Artist') continue
      const existing = artistMap.get(t.artist)
      if (existing) {
        existing.count += 1
        if (!existing.coverArt && t.coverArt) {
          existing.coverArt = t.coverArt
        }
      } else {
        artistMap.set(t.artist, {
          count: 1,
          coverArt: t.coverArt || null,
          sampleTrack: t
        })
      }
    }

    const sorted = Array.from(artistMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)

    return sorted.map(([name, data]) => ({
      name,
      trackCount: data.count,
      coverArt: data.coverArt,
      sampleTrack: data.sampleTrack
    }))
  }, [tracks])

  // Derive featured item from library (prefer track with cover art)
  const featuredItem = useMemo(() => {
    if (tracks.length === 0) return null
    const withArt = tracks.find((t) => !!t.coverArt)
    return withArt || tracks[0]
  }, [tracks])

  // Derive Highlights (Albums)
  const highlights = useMemo(() => {
    if (albums.length > 0) {
      return albums.slice(0, 6)
    }
    const uniqueAlbums = new Map<string, { name: string; artist: string; coverArt: string | null }>()
    for (const t of tracks) {
      if (t.album && !uniqueAlbums.has(t.album)) {
        uniqueAlbums.set(t.album, {
          name: t.album,
          artist: t.artist || 'Unknown',
          coverArt: t.coverArt || null
        })
      }
    }
    return Array.from(uniqueAlbums.values()).slice(0, 6)
  }, [albums, tracks])

  return (
    <div className="lunio-dashboard-container">
      {/* ─── Top Header Ribbon ───────────────────────────────────────── */}
      <header className="lunio-header">
        <div className="lunio-greeting-wrapper">
          <h1 className="lunio-greeting">Home</h1>
          <p className="lunio-library-stats">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            {albums.length > 0 ? ` • ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}` : ''}
          </p>
        </div>

        <div className="lunio-header-actions">
          {/* Pill Search Input */}
          <div className="lunio-search-pill">
            <MagnifyingGlass size={18} weight="bold" className="lunio-search-icon" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="lunio-search-input"
            />
          </div>
        </div>
      </header>

      {/* ─── Top Split Grid: Hero Banner + Top Artists ──────────────── */}
      <section className="lunio-top-grid">
        {/* Left: Featured Track Banner */}
        <div className="lunio-hero-card">
          <div className="lunio-hero-content">
            <div className="lunio-hero-badge">
              <span>Featured</span>
            </div>

            <h2 className="lunio-hero-title">
              {featuredItem ? featuredItem.title : 'Your Music Library'}
            </h2>

            <p className="lunio-hero-subtitle">
              {featuredItem
                ? `${featuredItem.artist || 'Unknown Artist'}${featuredItem.album ? ` • ${featuredItem.album}` : ''}`
                : 'Browse and play your offline music collection.'}
            </p>

            {featuredItem && (
              <button
                className="lunio-hero-play-btn"
                onClick={() => onPlayTrack(featuredItem, tracks)}
              >
                <Play size={16} weight="fill" />
                <span>Play Now</span>
              </button>
            )}
          </div>

          <div className="lunio-hero-art-wrapper">
            {featuredItem?.coverArt ? (
              <img src={featuredItem.coverArt} alt={featuredItem.title} className="lunio-hero-cover-img" />
            ) : (
              <div className="lunio-hero-art-placeholder">
                <MusicNotes size={80} weight="thin" />
              </div>
            )}
          </div>
        </div>

        {/* Right: Top Artists Card */}
        <div className="lunio-artists-card">
          <div className="lunio-section-header">
            <h3 className="lunio-section-title">Top Artists</h3>
            <button className="lunio-see-more-link" onClick={onNavigateToLibrary}>
              <span>See All</span>
              <CaretRight size={13} weight="bold" />
            </button>
          </div>

          <div className="lunio-artists-grid">
            {topArtists.length === 0 ? (
              <div className="lunio-empty-hint">Add songs to see your top artists</div>
            ) : (
              topArtists.map((artist) => (
                <div
                  key={artist.name}
                  className="lunio-artist-item"
                  onClick={() => onSelectArtist(artist.name)}
                  title={`View songs by ${artist.name}`}
                >
                  <div className="lunio-artist-avatar">
                    {artist.coverArt ? (
                      <img src={artist.coverArt} alt={artist.name} />
                    ) : (
                      <User size={18} weight="regular" />
                    )}
                  </div>
                  <div className="lunio-artist-info">
                    <span className="lunio-artist-name">{artist.name}</span>
                    <span className="lunio-artist-listeners">
                      {artist.trackCount} {artist.trackCount === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                  <CaretRight size={14} weight="bold" className="lunio-artist-chevron" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ─── Bottom Section: Listening Highlights ───────────────────── */}
      <section className="lunio-highlights-section">
        <div className="lunio-section-header">
          <h3 className="lunio-section-title">Albums</h3>
          <button className="lunio-see-more-link" onClick={onNavigateToLibrary}>
            <span>See All</span>
            <CaretRight size={13} weight="bold" />
          </button>
        </div>

        <div className="lunio-highlights-grid">
          {highlights.length === 0 ? (
            <div className="lunio-empty-hint">No albums found in library</div>
          ) : (
            highlights.map((album, idx) => (
              <div
                key={`${album.name}-${idx}`}
                className="lunio-highlight-card"
                onClick={() => onSelectAlbum(album.name)}
              >
                <div className="lunio-highlight-thumb">
                  {album.coverArt ? (
                    <img src={album.coverArt} alt={album.name} />
                  ) : (
                    <div className="lunio-highlight-placeholder">
                      <MusicNotes size={32} weight="light" />
                    </div>
                  )}
                  <button
                    className="lunio-highlight-play-overlay"
                    title={`Play ${album.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAlbum(album.name)
                    }}
                  >
                    <Play size={18} weight="fill" />
                  </button>
                </div>
                <div className="lunio-highlight-meta">
                  <h4 className="lunio-highlight-title" title={album.name}>
                    {album.name}
                  </h4>
                  <p className="lunio-highlight-artist" title={album.artist}>
                    {album.artist}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default memo(DashboardHome)
