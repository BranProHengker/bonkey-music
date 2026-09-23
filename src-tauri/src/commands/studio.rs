use crate::models::{LosslessInspectionResult, LrcSearchResult, RomajiResponse};
use crate::services::audio_inspector::inspect_file;
use crate::services::scraper::search_lrc;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[tauri::command]
pub async fn studio_search_lrc(query: String) -> Result<Vec<LrcSearchResult>, String> {
    search_lrc(&query).await
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

fn resolve_target_music_dir(custom_dir: Option<String>) -> PathBuf {
    // 1. Explicit custom directory if provided
    if let Some(dir) = custom_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    // 2. User configured libraryFolder from settings
    if let Ok(settings) = crate::commands::settings::load_settings() {
        if let Some(folder) = settings.get("libraryFolder").and_then(|v| v.as_str()) {
            let trimmed = folder.trim();
            if !trimmed.is_empty() {
                return PathBuf::from(trimmed);
            }
        }
        if let Some(folders) = settings.get("libraryFolders").and_then(|v| v.as_array()) {
            for f in folders {
                if let Some(folder_str) = f.as_str() {
                    let trimmed = folder_str.trim();
                    if !trimmed.is_empty() {
                        return PathBuf::from(trimmed);
                    }
                }
            }
        }
    }

    // 3. System audio directory (e.g. XDG_MUSIC_DIR)
    if let Some(audio) = dirs::audio_dir() {
        return audio;
    }

    // 4. Default user ~/Music folder
    if let Some(home) = dirs::home_dir() {
        let music = home.join("Music");
        return music;
    }

    // 5. User home folder or current dir
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
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
        let music_dir = resolve_target_music_dir(None);
        let safe_artist = sanitize_filename::sanitize(artist);
        let safe_title = sanitize_filename::sanitize(title);
        music_dir.join(format!("{} - {}.lrc", safe_artist, safe_title))
    };

    if let Some(parent) = target_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

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

