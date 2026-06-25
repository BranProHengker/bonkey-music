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
  <img src="https://img.shields.io/badge/version-1.1.1-FF4E2E?style=flat-square&labelColor=0d0d0f" alt="Version" />
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

### 📚 Library Management
- **Folder Scanning** — Point Bonkey Music to your local music folder and it will automatically scan, index, and parse all supported audio files with full metadata extraction (title, artist, album, genre, year, track number, cover art).
- **Individual File Import** — Import specific audio files without adding an entire folder.
- **Album Grouping** — Tracks are automatically organized into albums with cover art, artist info, and track listings.
- **Playlist Creation** — Create custom playlists and manage track assignments.
- **Favorites / Liked Songs** — Heart any track to add it to your favorites collection for quick access.
- **Real-time Search** — Instantly filter tracks by title, artist, or album name with `Ctrl + F` focus shortcut.
- **Column Sorting** — Sort tracks by title, artist, album, genre, or duration in ascending/descending order.

### 🔀 Play Queue
- **Queue Panel** — Dedicated side panel showing the current playback queue, toggled with `Ctrl + Q`.
- **Add to Queue** — Add any track to the queue from the track list using the `+` button.
- **Shuffle Queue** — Randomize the order of remaining tracks in the queue.
- **Clear Queue** — Instantly clear the entire playback queue.
- **Search & Add** — Search your library directly from within the queue panel and add tracks on the fly.

### 🔁 Playback Modes
- **Shuffle Mode** — Randomize track order across your library or playlist.
- **Repeat Off** — Stop after the last track.
- **Repeat All** — Loop the entire queue continuously.
- **Repeat One** — Loop the current track indefinitely.

### 🎤 Synced Lyrics
- **Automatic Loading** — Automatically detects `.lrc` or `.txt` files placed in the same folder as your audio files.
- **Synced Overlay** — Beautiful Apple Music-style blurred background lyrics overlay that syncs with the current playback time.
- **Interactive** — Click on any lyric line to instantly seek to that part of the song.

### 🧭 Navigation
- **Navigation History** — Browser-style back/forward navigation through your views.
- **Mouse Thumb Buttons** — Use mouse thumb buttons (Button 4 / Button 5) for back/forward navigation.
- **Sidebar Navigation** — Quick access to Library, Favorites, Albums, Playlists, and Settings.
- **Bento Dashboard** — Beautiful card-based overview of your library with stats, album grid, and quick actions.

### 🎨 Design
- **Premium Dark Theme** — Charcoal matte & Electric Orange color scheme with obsidian surfaces.
- **Asymmetric Player Bar** — Four-section horizontal layout: playback controls, track info with circular cover art, inline progress bar, and volume/utility controls.
- **Audio Metadata Display** — Shows bitrate, sample rate, and format badge directly in the player bar.
- **Smooth Animations** — Micro-animations on hover, transitions, and interactive elements throughout the UI.

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
