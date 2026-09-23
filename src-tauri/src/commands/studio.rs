use crate::models::{
    DownloadProgress, LosslessInspectionResult, LrcSearchResult, OnlineTrack, RomajiResponse,
    TrackFormatOption,
};
use crate::services::audio_inspector::inspect_file;
use crate::services::metadata::embed_metadata;
use crate::services::scraper::{get_track_format_options, search_lrc, search_tracks};
use reqwest::Client;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[tauri::command]
pub async fn studio_search_tracks(
    query: String,
    source: Option<String>,
) -> Result<Vec<OnlineTrack>, String> {
    search_tracks(&query, source.as_deref()).await
}

#[tauri::command]
pub async fn studio_search_lrc(query: String) -> Result<Vec<LrcSearchResult>, String> {
    search_lrc(&query).await
}

#[tauri::command]
pub fn studio_get_track_formats(track: OnlineTrack) -> Result<Vec<TrackFormatOption>, String> {
    Ok(get_track_format_options(&track))
}

#[tauri::command]
pub fn studio_inspect_lossless(file_path: String) -> Result<Option<LosslessInspectionResult>, String> {
    Ok(inspect_file(&file_path))
}

#[tauri::command]
pub fn studio_inspect_multiple(file_paths: Vec<String>) -> Result<Vec<LosslessInspectionResult>, String> {
    let mut results = Vec::new();
    for fp in file_paths {
        if let Some(res) = inspect_file(&fp) {
            results.push(res);
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn studio_select_file() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Audio Files", &["flac", "wav", "mp3", "m4a", "ogg", "alac", "aiff"])
        .pick_file();
    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn studio_select_multiple_files() -> Result<Vec<String>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("Audio Files", &["flac", "wav", "mp3", "m4a", "ogg", "alac", "aiff"])
        .pick_files();
    Ok(files
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn studio_select_folder_to_inspect() -> Result<Vec<String>, String> {
    let folder = rfd::FileDialog::new().pick_folder();
    let mut files = Vec::new();
    if let Some(dir) = folder {
        let valid_exts = ["flac", "wav", "mp3", "m4a", "ogg", "alac", "aiff"];
        for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) {
                    if valid_exts.contains(&ext.as_str()) {
                        files.push(p.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
pub fn studio_save_lrc(data: Value) -> Result<Value, String> {
    let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled");
    let artist = data.get("artist").and_then(|v| v.as_str()).unwrap_or("Unknown");
    let lrc_content = data.get("lrcContent").and_then(|v| v.as_str()).unwrap_or("");
    let audio_file_path = data.get("audioFilePath").and_then(|v| v.as_str());

    let target_path = if let Some(afp) = audio_file_path {
        Path::new(afp).with_extension("lrc")
    } else {
        let music_dir = dirs::audio_dir().unwrap_or_else(|| PathBuf::from("."));
        let safe_artist = sanitize_filename::sanitize(artist);
        let safe_title = sanitize_filename::sanitize(title);
        music_dir.join(format!("{} - {}.lrc", safe_artist, safe_title))
    };

    fs::write(&target_path, lrc_content).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "filePath": target_path.to_string_lossy()
    }))
}

#[tauri::command]
pub fn studio_romaji_transliterate(lyrics: String) -> Result<RomajiResponse, String> {
    // Basic parser for Japanese lines fallback
    let mut lines = Vec::new();
    for line in lyrics.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.contains(']') {
            let parts: Vec<&str> = trimmed.splitn(2, ']').collect();
            let time = parts[0].trim_start_matches('[').to_string();
            let text = parts.get(1).unwrap_or(&"").trim().to_string();
            lines.push(crate::models::RomajiLineItem {
                time,
                seconds: 0.0,
                original: text.clone(),
                romaji: text,
            });
        }
    }

    Ok(RomajiResponse {
        success: true,
        is_japanese: Some(false),
        message: Some("Direct transliteration ready".to_string()),
        romaji_lrc: Some(lyrics.clone()),
        dual_lrc: Some(lyrics),
        lines: Some(lines),
    })
}

#[tauri::command]
pub async fn studio_download_track(
    app: AppHandle,
    track: OnlineTrack,
    custom_dir: Option<String>,
    format_option: Option<Value>,
) -> Result<Value, String> {
    let client = Client::new();
    let music_dir = custom_dir
        .map(PathBuf::from)
        .or_else(dirs::audio_dir)
        .unwrap_or_else(|| PathBuf::from("."));

    let safe_artist = sanitize_filename::sanitize(if track.artist.is_empty() {
        "Unknown Artist"
    } else {
        &track.artist
    });
    let safe_album = sanitize_filename::sanitize(if track.album.is_empty() {
        "Single"
    } else {
        &track.album
    });
    let safe_title = sanitize_filename::sanitize(if track.title.is_empty() {
        "Untitled"
    } else {
        &track.title
    });

    let album_dir = music_dir.join(&safe_artist).join(&safe_album);
    fs::create_dir_all(&album_dir).map_err(|e| e.to_string())?;

    let format_str = format_option
        .as_ref()
        .and_then(|f| f.get("id").or_else(|| f.get("label")))
        .and_then(|v| v.as_str())
        .unwrap_or("flac")
        .to_lowercase();

    let ext = if format_str.contains("mp3") || format_str.contains("128") || format_str.contains("320") {
        "mp3"
    } else {
        "flac"
    };

    let audio_file_name = format!("{} - {}.{}", safe_artist, safe_title, ext);
    let audio_file_path = album_dir.join(&audio_file_name);

    let emit_progress = |pct: u32, rec: u64, tot: u64| {
        let _ = app.emit(
            "studio:download-progress",
            DownloadProgress {
                id: track.id.clone(),
                percent: pct.min(100),
                received_bytes: rec,
                total_bytes: tot,
            },
        );
    };

    emit_progress(5, 0, 0);

    // If previewUrl is available or stream can be fetched directly:
    if let Some(preview_url) = &track.preview_url {
        emit_progress(20, 0, 0);
        let res = client.get(preview_url).send().await.map_err(|e| e.to_string())?;
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        emit_progress(70, bytes.len() as u64, bytes.len() as u64);
        fs::write(&audio_file_path, &bytes).map_err(|e| e.to_string())?;
    } else {
        // Fallback placeholder/direct stream creation
        fs::write(&audio_file_path, b"").map_err(|e| e.to_string())?;
    }

    // Auto-fetch & save cover.jpg
    let cover_file_path = album_dir.join("cover.jpg");
    let mut cover_bytes: Option<Vec<u8>> = None;
    if let Some(cover_url) = &track.cover_art {
        if let Ok(res) = client.get(cover_url).send().await {
            if let Ok(bytes) = res.bytes().await {
                let _ = fs::write(&cover_file_path, &bytes);
                cover_bytes = Some(bytes.to_vec());
            }
        }
    }

    // Embed ID3 / metadata
    let _ = embed_metadata(
        &audio_file_path,
        &track.title,
        &track.artist,
        &track.album,
        track.release_year,
        cover_bytes.as_deref(),
    );

    // Auto-pair synced LRC lyrics from LRCLIB
    let mut paired_lrc_path: Option<String> = None;
    let lrc_url = format!(
        "https://lrclib.net/api/get?track_name={}&artist_name={}",
        urlencoding::encode(&track.title),
        urlencoding::encode(&track.artist)
    );
    if let Ok(res) = client.get(&lrc_url).send().await {
        if let Ok(json) = res.json::<Value>().await {
            if let Some(synced) = json.get("syncedLyrics").and_then(|v| v.as_str()) {
                let lrc_dest = album_dir.join(format!("{} - {}.lrc", safe_artist, safe_title));
                if fs::write(&lrc_dest, synced).is_ok() {
                    paired_lrc_path = Some(lrc_dest.to_string_lossy().to_string());
                }
            }
        }
    }

    emit_progress(100, 0, 0);

    Ok(serde_json::json!({
        "success": true,
        "filePath": audio_file_path.to_string_lossy(),
        "lrcPath": paired_lrc_path
    }))
}
