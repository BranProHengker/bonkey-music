<p align="center">
  <img src="resources/iconapp.png" width="120" height="120" alt="Bonkey Music Logo" />
</p>

<h1 align="center">Bonkey Music</h1>

<p align="center">
  <strong>A premium desktop music player for local audio files.</strong><br/>
  Built with Electron, React, and TypeScript — designed for audiophiles who value a beautiful interface and powerful playback controls.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-171717?style=flat-square&labelColor=0d0d0f" alt="Platforms" />
  <img src="https://img.shields.io/badge/version-2.1.0-0A84FF?style=flat-square&labelColor=0d0d0f" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-8E8E93?style=flat-square&labelColor=0d0d0f" alt="License" />
  <img src="https://img.shields.io/badge/electron-v39-1a1a1f?style=flat-square&labelColor=0d0d0f" alt="Electron" />
</p>

---

## 📥 Download

Choose the right installer for your operating system:

| Platform | Format | Download |
|----------|--------|----------|
| **Windows** | `.exe` (NSIS Installer) | [Download for Windows](https://github.com/BranProHengker/bonkey-music/releases/latest) |
| **macOS** | `.dmg` (Disk Image) | [Download for macOS](https://github.com/BranProHengker/bonkey-music/releases/latest) |
| **Linux** | `.AppImage` | [Download AppImage](https://github.com/BranProHengker/bonkey-music/releases/latest) |
| **Linux** | `.deb` (Debian/Ubuntu) | [Download .deb](https://github.com/BranProHengker/bonkey-music/releases/latest) |
| **Linux** | `.snap` (Snap Store) | [Download .snap](https://github.com/BranProHengker/bonkey-music/releases/latest) |

> **Note**: All downloads are available on the [Releases](https://github.com/BranProHengker/bonkey-music/releases) page. Pick the latest version that matches your system.

---

## ✨ Features

### 🎵 Core Playback
- **Hi-Res Audio Support** — Play MP3, FLAC, WAV, M4A, OGG, AAC, and WMA files with full metadata parsing (bitrate, sample rate, bits per sample, lossless detection).
- **Gapless Playback** — Seamless track-to-track transitions with no audio gaps.
- **Resume Playback** — Automatically remembers your last played track and exact playback position on app restart.
- **Volume Persistence** — Volume and mute settings are saved between sessions.

### 🎤 Synced Lyrics Engine (v2.0 Overhaul)
- **60fps GPU Compositor** — Hardware-accelerated CSS `translate3d` scroller eliminates Chromium rasterization jank and layout reflows.
- **Dual-Line Bilingual Lyrics** — Kanji/Main lyric lines paired with Romaji/Translation sub-text, animated with subtle kinetic micro-floats and 30ms staggered reveals.
- **Karaoke Lead-Time Offset** — Predictive line activation (~220ms ahead of vocals) so you can read comfortably right before singing.
- **Progressive Depth of Field** — Multi-tier optical depth (active line at 0px blur, with calibrated 0.75px, 1.8px, and 3.2px blur tiers).
- **Full Lyrics Mode** — One-click toggle button to hide the album art column and center lyrics across the screen, persisted in `localStorage`.
- **Deep Atmospheric Aura** — 50px backdrop blur and radial ambient illumination from the album cover art without UI bleed-through.

### 📚 Library Management
- **Folder Scanning** — Point Bonkey Music to your local music folder and it will automatically scan, index, and parse all supported audio files with full metadata extraction (title, artist, album, genre, year, track number, cover art).
- **Latest Added Category** — Dedicated library filter tab displaying recently added tracks sorted chronologically, complete with a single-click "Play All" button.
- **Open File Location** — Reveal any song file in your OS file manager (Thunar, Dolphin, Nautilus, Windows Explorer, macOS Finder) directly from track context menus, with native Freedesktop D-Bus `FileManager1` and Hyprland/Wayland compatibility.
- **Individual File Import** — Import specific audio files without adding an entire folder.
- **Album Grouping** — Tracks are automatically organized into albums with cover art, artist info, and track listings.
- **Playlist Creation** — Create custom playlists and manage track assignments.
- **Favorites / Liked Songs** — Heart any track to add it to your favorites collection for quick access.
- **Real-time Search** — Instantly filter tracks by title, artist, or album name with `Ctrl + F` focus shortcut.
- **Column Sorting** — Sort tracks by title, artist, album, genre, or duration in ascending/descending order.

### 🎮 Discord Rich Presence (RPC)
- **Active Status Sync** — Displays what you are listening to on your Discord profile in real-time.
- **Dynamic Track Details** — Shows the song name, artist name, and a real-time progress bar/duration synced with the playback time.

### 🔀 Play Queue
- **Simultaneous Queue Drawer** — Floating queue drawer with studio glass backdrop (`z-index: 60`) that slides in smoothly even while the full-screen lyrics overlay is open.
- **Auto-Hide Cover on Queue** — Automatically collapses the album cover art when the queue is opened in lyrics view, giving ample space to both lyrics and queue side-by-side.
- **Add to Queue** — Add any track to the queue from the track list using the `+` button or context menu.
- **Shuffle & Clear** — Randomize or empty the playback queue with dedicated header controls.
- **Search & Add** — Search your library directly from within the queue panel and add tracks on the fly.

### 🔁 Playback Modes
- **Shuffle Mode** — Randomize track order across your library or playlist.
- **Repeat Off** — Stop after the last track.
- **Repeat All** — Loop the entire queue continuously.
- **Repeat One** — Loop the current track indefinitely.

### 🧭 Navigation
- **Navigation History** — Browser-style back/forward navigation through your views.
- **Mouse Thumb Buttons** — Use mouse thumb buttons (Button 4 / Button 5) for back/forward navigation.
- **Sidebar Navigation** — Quick access to Library, Favorites, Albums, Playlists, and Settings.
- **Bento Dashboard** — Beautiful card-based overview of your library with stats, album grid, and quick actions.

### 🎨 Design
- **Pure Studio Monochrome & Matte Silver** — Clean, anti-AI-slop obsidian dark interface with metallic silver accents and zero eye-straining neons.
- **Asymmetric Player Bar** — Four-section horizontal layout: playback controls, track info with circular cover art, inline progress bar, and volume/utility controls.
- **Audio Metadata Display** — Shows bitrate, sample rate, and format badge directly in the player bar.

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Play / Pause | `Space` |
| Next Track | `Ctrl + →` |
| Previous Track | `Ctrl + ←` |
| Volume Up (+5%) | `Ctrl + ↑` |
| Volume Down (-5%) | `Ctrl + ↓` |
| Toggle Mute | `Ctrl + M` |
| Volume Control (Scroll) | `Ctrl + Scroll Wheel` |
| Toggle Shuffle | `Ctrl + R` |
| Toggle Repeat (Loop) | `Ctrl + L` |
| Toggle Play Queue | `Ctrl + Q` |
| Focus Search Bar | `Ctrl + F` |
| Dismiss Lyrics / Close Queue | `Esc` |
| Navigate Back | Mouse Thumb 1 (Back) |
| Navigate Forward | Mouse Thumb 2 (Forward) |

---

## 🎧 Supported Audio Formats

| Format | Extension | Type |
|--------|-----------|------|
| MP3 | `.mp3` | Lossy |
| FLAC | `.flac` | Lossless |
| WAV | `.wav` | Lossless |
| AAC / M4A | `.m4a`, `.aac` | Lossy |
| OGG Vorbis | `.ogg` | Lossy |
| WMA | `.wma` | Lossy |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Electron](https://www.electronjs.org/) v39 |
| **Frontend** | [React](https://react.dev/) v19 + TypeScript |
| **Build Tool** | [electron-vite](https://electron-vite.org/) v5 |
| **Bundler** | [Vite](https://vite.dev/) v7 |
| **Packaging** | [electron-builder](https://www.electron.build/) v26 |
| **Metadata** | [music-metadata](https://github.com/borewit/music-metadata) v11 |
| **Icons** | [@phosphor-icons/react](https://phosphoricons.com/) |
| **Typography** | [Geist Sans & Geist Mono](https://vercel.com/font) |

---

## 🏗️ Project Structure

```
music-app/
├── src/
│   ├── main/              # Electron main process (window, IPC, file system)
│   ├── preload/            # Preload scripts (secure API bridge)
│   └── renderer/           # React frontend
│       └── src/
│           ├── App.tsx              # Root application component
│           ├── assets/              # CSS, images, icons
│           │   ├── main.css         # Global styles & design tokens
│           │   └── iconapp.png      # App icon
│           ├── components/
│           │   ├── LyricsView.tsx    # Synced 60fps lyrics overlay & karaoke view
│           │   ├── PlayerBar.tsx     # Bottom player controls
│           │   ├── PlaylistGrid.tsx  # Bento dashboard grid
│           │   ├── QueuePanel.tsx    # Play queue side panel
│           │   ├── Sidebar.tsx       # Left navigation sidebar
│           │   └── TrackList.tsx     # Track listing table
│           ├── context/
│           │   └── AudioContext.tsx  # Audio engine & state management
│           └── hooks/
│               └── useAudioEngine.ts # Audio engine hook
├── resources/              # App icons and build resources
├── build/                  # Electron-builder assets
├── electron-builder.yml    # Build & packaging configuration
├── electron.vite.config.ts # Vite config for Electron
├── package.json
└── tsconfig.json
```

---

## 🚀 Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/) (recommended package manager)

### Install Dependencies

```bash
pnpm install
```

### Run in Development Mode

```bash
pnpm dev
```

This launches the Electron app with hot-reload enabled for the renderer process.

### Type Checking

```bash
pnpm run typecheck
```

### Linting & Formatting

```bash
pnpm run lint
pnpm run format
```

---

## 📦 Building for Production

Build distributable packages for each platform:

```bash
# Windows (NSIS installer → .exe)
pnpm build:win

# macOS (DMG → .dmg)
pnpm build:mac

# Linux (AppImage, .deb, .snap)
pnpm build:linux
```

Built artifacts will be output to the `dist/` directory.

> **Cross-compilation note**: Building for macOS requires a macOS host machine. Windows and Linux builds can typically be cross-compiled from any OS using electron-builder.

---

## 📸 Screenshots

<!-- Add your screenshots here -->
<!-- ![Library View](screenshots/library.png) -->
<!-- ![Player Bar](screenshots/player.png) -->
<!-- ![Queue Panel](screenshots/queue.png) -->

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<p align="center">
  Made with 🔥 by <strong><a href="https://gutsi.my.id">gutsi.my.id</a></strong>
</p>
