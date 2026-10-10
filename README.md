<p align="center">
  <img src="resources/iconapp.png" width="120" height="120" alt="Bonkey Music Logo" />
</p>

<h1 align="center">Bonkey Music</h1>

<p align="center">
  Pemutar musik lokal ringan berbasis <strong>Tauri v2 (Rust)</strong> dan React 19.<br/>
  Mendukung format lossless, sinkronisasi lirik kanji dan Romaji, serta inspeksi spektral audio langsung dari sistem operasi Anda.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20Android-171717?style=flat-square&labelColor=0d0d0f" alt="Platforms" />
  <img src="https://img.shields.io/badge/version-2.4.0-0A84FF?style=flat-square&labelColor=0d0d0f" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-8E8E93?style=flat-square&labelColor=0d0d0f" alt="License" />
  <img src="https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&labelColor=0d0d0f&logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&labelColor=0d0d0f&logo=rust&logoColor=white" alt="Rust" />
</p>

---

## Download

Installer dan paket aplikasi tersedia di halaman [Releases](https://github.com/BranProHengker/bonkey-music/releases/latest):

| Platform | Format | Keterangan |
|----------|--------|------------|
| Android | `.apk` | Installer Android (arsitektur ARM64 / aarch64) |
| Windows | `.exe` | Windows Setup Installer (NSIS) |
| Windows | `.msi` | Windows Installer Package |
| Linux | `.deb` | Paket installer untuk Debian, Ubuntu, Linux Mint |
| Linux | `.AppImage` | Standalone portable executable untuk distro Linux |

---

## Fitur Utama

### Performa dan Konsumsi Memori
- Berjalan menggunakan Tauri v2 dan webview native OS, dengan penggunaan memori berkisar antara 40 sampai 70 MB RAM.
- Membaca dan memproses metadata audio melalui backend Rust (Symphonia dan Lofty) tanpa konversi base64 berlebih.
- Integrasi tray sistem, tombol media keyboard, dan kontrol playback di latar belakang.

### Pemutaran Audio
- Memutar format MP3, FLAC, WAV, M4A, OGG, AAC, dan ALAC.
- Menampilkan informasi teknis file: format, bit depth, dan sample rate audio hingga 192 kHz.
- Transisi antar lagu tanpa jeda (gapless playback).
- Menyimpan posisi pemutaran, volume, dan antrean lagu terakhir saat aplikasi ditutup.

### Lirik dan Romaji
- Mendukung sinkronisasi lirik LRC berbasis waktu.
- Transliterasi kanji ke Romaji otomatis untuk lagu berbahasa Jepang menggunakan library Kakasi di backend.
- Pengaturan offset waktu lirik agar pembacaan lirik dapat disesuaikan dengan tempo lagu.
- Mode tampilan lirik layar penuh dengan aksen pencahayaan dinamis yang mengikuti warna sampul album.

### Studio Hub
- Lossless Audio Inspector: Analisis frekuensi spektral berbasis FFT untuk mengecek batas cutoff audio asli atau mendeteksi file upscaled transcode. Mendukung inspeksi per file maupun per folder.
- Lyrics Studio: Pencarian lirik dari LRCLIB, konversi teks Jepang ke Romaji, dan ekspor langsung ke file `.lrc`.

### Manajemen Koleksi dan Mobile
- Pemindaian otomatis folder musik lokal (`~/Music`, `/storage/emulated/0/Music`, dan direktori Download pada Android).
- Tampilan antarmuka responsif: navigasi dock mengambang adaptif, gesture swipe pada pemutar lagu di layar sentuh, dan dukungan safe-area insets untuk perangkat Android.
- Kategori lagu yang baru ditambahkan beserta kontrol pemutaran cepat.
- Menu konteks untuk membuka lokasi file langsung di file manager sistem.

### Discord Rich Presence
- Menampilkan judul lagu yang sedang diputar, nama artis, dan durasi berjalan di status profil Discord.

---

## Pintasan Keyboard

| Pintasan | Tindakan |
|----------|----------|
| `Space` | Putar / Jeda |
| `Ctrl + →` | Lagu Berikutnya |
| `Ctrl + ←` | Lagu Sebelumnya |
| `Ctrl + ↑` | Naikkan Volume (+5%) |
| `Ctrl + ↓` | Turunkan Volume (-5%) |
| `Ctrl + M` | Matikan / Nyalakan Suara (Mute) |
| `Ctrl + R` | Acak Lagu (Shuffle) |
| `Ctrl + L` | Ulangi Lagu (Loop) |
| `Ctrl + Q` | Buka atau Tutup Antrean Putar |
| `Ctrl + F` | Fokus ke Kolom Pencarian |
| `Esc` | Tutup Tampilan Lirik atau Antrean |

---

## Format Audio yang Didukung

| Format | Ekstensi | Tipe |
|--------|----------|------|
| MP3 | `.mp3` | Lossy |
| FLAC | `.flac` | Lossless |
| WAV | `.wav` | Lossless |
| AAC / M4A | `.m4a`, `.aac` | Lossy |
| OGG Vorbis | `.ogg` | Lossy |
| WMA | `.wma` | Lossy |

---

## Teknologi

| Komponen | Pustaka / Alat |
|----------|----------------|
| Framework Inti | [Tauri v2](https://tauri.app/) (Rust 2021) |
| Antarmuka | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| Bundler | [Vite 7](https://vite.dev/) |
| Pemrosesan Audio dan Metadata | Symphonia, Lofty, Kakasi (Rust) |
| Tipografi | [Outfit](https://fontsource.org/fonts/outfit), [Geist Mono](https://vercel.com/font) |
| Ikon | [@phosphor-icons/react](https://phosphoricons.com/) |

---

## Struktur Proyek

```
bonkey-music/
├── src-tauri/                 # Backend Rust (Tauri Core)
│   ├── src/
│   │   ├── commands/          # IPC Commands (library, settings, studio, dialogs)
│   │   ├── services/          # Layanan backend (audio, metadata, inspector, discord)
│   │   ├── models/            # Definisi struktur data Rust
│   │   ├── lib.rs             # Titik masuk aplikasi Tauri dan registrasi plugin
│   │   └── main.rs            # Binary entrypoint
│   ├── Cargo.toml             # Konfigurasi dependensi Rust
│   └── tauri.conf.json        # Konfigurasi window dan izin Tauri v2
├── src/
│   └── renderer/src/          # Frontend React + TypeScript
│       ├── components/        # Komponen UI (TrackList, PlayerBar, LyricsView, dsb.)
│       │   └── studio/        # Studio Hub (LosslessInspector, LrcStudio)
│       ├── context/           # State management context
│       ├── hooks/             # Custom React hooks (useAudioEngine)
│       ├── lib/               # Utility dan bridge IPC Tauri
│       ├── assets/            # CSS tokens, variabel tema, dan font
│       ├── types/             # Definisi tipe TypeScript
│       ├── App.tsx            # Komponen tata letak utama
│       └── main.tsx           # Entrypoint aplikasi frontend
└── package.json               # Konfigurasi proyek dan skrip build
```

---

## Pengembangan Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) v20+ dan [pnpm](https://pnpm.io/)
- [Rust toolchain](https://rustup.rs/) (versi stable)
- Dependensi sistem Linux (Debian/Ubuntu):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev
  ```

### Menjalankan Aplikasi
```bash
# Pasang dependensi
pnpm install

# Jalankan server pengembangan
pnpm dev
```

### Membangun Paket Rilis
```bash
pnpm build
```

Paket binary lokal akan dibuat di folder `src-tauri/target/release/bundle/`.

---

## Lisensi

Proyek ini menggunakan lisensi [MIT](LICENSE).
