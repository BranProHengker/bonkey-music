<p align="center">
  <img src="resources/iconapp.png" width="120" height="120" alt="Bonkey Music Logo" />
</p>

<h1 align="center">Bonkey Music</h1>

<p align="center">
  <strong>A modern, ultra-fast desktop music player for local audio files.</strong><br/>
  Powered by <strong>Tauri v2 (Rust)</strong>, React 19, and TypeScript — designed for audiophiles who value a stunning interface, bit-perfect playback, and lightweight performance.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-171717?style=flat-square&labelColor=0d0d0f" alt="Platforms" />
  <img src="https://img.shields.io/badge/version-2.2.0-0A84FF?style=flat-square&labelColor=0d0d0f" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-8E8E93?style=flat-square&labelColor=0d0d0f" alt="License" />
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&labelColor=0d0d0f&logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&labelColor=0d0d0f&logo=rust&logoColor=white" alt="Rust" />
</p>

---

## 📥 Download

Installer terbaru tersedia di halaman [**Releases**](https://github.com/BranProHengker/bonkey-music/releases/latest):

| Platform | Format | Description |
|----------|--------|-------------|
| **Linux** | `.deb` | Installer untuk Debian, Ubuntu, Linux Mint, dsb. |
| **Linux** | `.AppImage` | Standalone portable executable untuk semua distro Linux |
| **Windows** | `.exe` | Windows Setup Installer (NSIS) |
| **Windows** | `.msi` | Windows Installer Package |

---

## ✨ Key Features

### ⚡ Tauri v2 & Rust Performance Engine
- **Ultra-Lightweight Memory Footprint** — Menggunakan native webview + Rust backend, menghemat konsumsi RAM hingga **~40–70 MB** (jauh lebih hemat dibanding Electron).
- **Instant Library Loading (< 1ms)** — Arsitektur streaming endpoint cover art langsung dari backend Rust tanpa base64 bloatware, mengeliminasi lag dan freeze pada startup.
- **Native System Integration** — Tray icon interaktif (dengan support `libayatana-appindicator` di Linux), media keys, dan kontrol playback di background.

### 🎵 Core Playback & Hi-Res Audio
- **Lossless & Hi-Res Audio** — Memutar MP3, FLAC, WAV, M4A, OGG, AAC, dan ALAC dengan deteksi bit-perfect audio (bit depth, sample rate hingga 192 kHz).
- **Gapless Playback** — Transisi antar-track mulus tanpa jeda audio.
- **Session Persistence** — Otomatis mengingat lagu terakhir, posisi detik playback, dan pengaturan volume saat aplikasi dibuka kembali.

### 🎤 Synced Lyrics Engine (Bilingual & Romaji)
- **60fps GPU Compositor** — Transisi scroll lirik halus berbasis hardware-accelerated CSS `translate3d`.
- **Dual-Line Lyrics & Romaji** — Sinkronisasi lirik kanji/asli dengan transliterasi Romaji Jepang otomatis.
- **Karaoke Lead-Time Offset** — Baris lirik menyala presisi beberapa milidetik sebelum vokal terdengar untuk kemudahan membaca.
- **Full Lyrics & Ambient Aura** — Mode layar penuh dengan pencahayaan ambient dinamis yang beradaptasi dengan warna cover album.

### 🎛️ Music Studio Hub
- **Lossless Audio Inspector** — Analisis spektral audio berbasis FFT secara real-time untuk memeriksa cutoff frequency, bit depth, sample rate, dan mendeteksi audio palsu (*upscaled transcode*). Mendukung inspeksi batch untuk seluruh folder musik.
- **Lyrics & Romaji Studio** — Pencarian lirik langsung dari LRCLIB, converter lirik Jepang ke Romaji otomatis, visual karaoke test player, dan ekspor instan ke file `.lrc`.

### 📚 Library Management & Organization
- **Smart Folder Indexing** — Scan dan index direktori musik lokal (`~/Music`) dengan metadata lengkap (artis, album, tahun, genre, track number).
- **Latest Added Category** — Filter koleksi berdasarkan lagu yang baru saja ditambahkan lengkap dengan tombol "Play All".
- **Open File Location** — Navigasi langsung ke file lagu di file manager OS (Thunar, Dolphin, Nautilus, Windows Explorer) lewat menu konteks.
- **Custom Playlists & Favorites** — Kelola playlist favorit dan antrean putar dengan mudah.

### 🎮 Discord Rich Presence (RPC)
- Menampilkan lagu yang sedang didengarkan, nama artis, dan progress bar real-time langsung di status profil Discord.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `Space` | Play / Pause |
| `Ctrl + →` | Next Track |
| `Ctrl + ←` | Previous Track |
| `Ctrl + ↑` | Volume Up (+5%) |
| `Ctrl + ↓` | Volume Down (-5%) |
| `Ctrl + M` | Toggle Mute |
| `Ctrl + R` | Toggle Shuffle |
| `Ctrl + L` | Toggle Repeat / Loop |
| `Ctrl + Q` | Buka / Tutup Play Queue |
| `Ctrl + F` | Fokus ke Kotak Pencarian |
| `Esc` | Tutup Lyrics View / Queue |

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

| Komponen | Teknologi |
|----------|-----------|
| **Core Framework** | [Tauri v2](https://tauri.app/) (Rust 2021) |
| **Frontend UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Bundler / Dev Server** | [Vite 7](https://vite.dev/) |
| **Audio Server & Metadata** | Symphonia, lofty, id3 (Rust native backend) |
| **Typography** | [Outfit](https://fontsource.org/fonts/outfit), [Geist Mono](https://vercel.com/font) |
| **Icons** | [@phosphor-icons/react](https://phosphoricons.com/) |

---

## 🏗️ Project Structure

```
bonkey-music/
├── src-tauri/                 # Backend Rust (Tauri Core)
│   ├── src/
│   │   ├── commands/          # Tauri IPC Commands (library, settings, studio, dialogs)
│   │   ├── services/          # Services (audio server, metadata parser, inspector, discord)
│   │   ├── models/            # Rust data structures & types
│   │   ├── lib.rs             # Tauri application entrypoint & protocol handlers
│   │   └── main.rs            # Binary main runner
│   ├── Cargo.toml             # Rust package configuration
│   └── tauri.conf.json        # Tauri v2 configuration & window settings
├── src/                       # Frontend UI (React + TypeScript)
│   ├── renderer/src/
│   │   ├── components/        # UI components (TrackList, PlayerBar, LyricsView, Sidebar)
│   │   │   └── studio/        # Studio Hub (LosslessInspector, LrcStudio)
│   │   ├── hooks/             # Custom React hooks (useAudioEngine)
│   │   ├── lib/               # Tauri IPC bridge & utilities
│   │   ├── assets/            # CSS tokens, animations, font definitions
│   │   └── App.tsx            # Main application layout
│   └── preload/               # Type definitions & IPC declarations
└── package.json               # Node.js scripts & frontend dependencies
```

---

## 🚀 Development Setup

### Prasyarat
- [Node.js](https://nodejs.org/) v20+ & [pnpm](https://pnpm.io/)
- [Rust toolchain](https://rustup.rs/) (`rustc`, `cargo`)
- Linux dependencies (Ubuntu/Debian):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev
  ```

### Jalankan di Mode Development

```bash
# 1. Install dependencies
pnpm install

# 2. Jalankan aplikasi (Vite + Tauri)
pnpm run tauri:dev
```

### Build Binary / Installer Produksi

```bash
pnpm run tauri:build
```

Hasil installer lokal akan berada di folder `src-tauri/target/release/bundle/`.

---

## 📄 License

Proyek ini bersifat open-source di bawah lisensi [MIT License](LICENSE).

<p align="center">
  Crafted with precision by <strong><a href="https://github.com/BranProHengker">Avttr</a></strong>
</p>
