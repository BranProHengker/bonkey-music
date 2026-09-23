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
pub fn studio_inspect_lossless(
    file_path: String,
) -> Result<Option<LosslessInspectionResult>, String> {
    Ok(inspect_file(&file_path))
}

#[tauri::command]
pub fn studio_inspect_multiple(
    file_paths: Vec<String>,
) -> Result<Vec<LosslessInspectionResult>, String> {
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
        .add_filter(
            "Audio Files",
            &["flac", "wav", "mp3", "m4a", "ogg", "alac", "aiff"],
        )
        .pick_file();
    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn studio_select_multiple_files() -> Result<Vec<String>, String> {
    let files = rfd::FileDialog::new()
        .add_filter(
            "Audio Files",
            &["flac", "wav", "mp3", "m4a", "ogg", "alac", "aiff"],
        )
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
                if let Some(ext) = p
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase())
                {
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
    let title = data
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled");
    let artist = data
        .get("artist")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown");
    let lrc_content = data
        .get("lrcContent")
        .and_then(|v| v.as_str())
        .unwrap_or("");
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

fn contains_japanese(text: &str) -> bool {
    text.chars().any(|c| {
        matches!(
            c,
            '\u{3040}'..='\u{309F}'  // Hiragana
            | '\u{30A0}'..='\u{30FF}' // Katakana
            | '\u{4E00}'..='\u{9FFF}' // CJK Unified Ideographs / Kanji
            | '\u{3400}'..='\u{4DBF}' // Extension A
        )
    })
}

fn parse_lrc_timestamp_seconds(time_str: &str) -> f64 {
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() == 2 {
        let mins: f64 = parts[0].parse().unwrap_or(0.0);
        let secs: f64 = parts[1].parse().unwrap_or(0.0);
        mins * 60.0 + secs
    } else {
        0.0
    }
}

#[tauri::command]
pub fn studio_romaji_transliterate(lyrics: String) -> Result<RomajiResponse, String> {
    if lyrics.trim().is_empty() {
        return Ok(RomajiResponse {
            success: false,
            is_japanese: Some(false),
            message: Some("Lyrics are empty".to_string()),
            romaji_lrc: None,
            dual_lrc: None,
            lines: None,
        });
    }

    let has_japanese = contains_japanese(&lyrics);
    if !has_japanese {
        return Ok(RomajiResponse {
            success: true,
            is_japanese: Some(false),
            message: Some("No Japanese Kanji/Kana characters detected.".to_string()),
            romaji_lrc: Some(lyrics.clone()),
            dual_lrc: Some(lyrics),
            lines: Some(Vec::new()),
        });
    }

    let mut line_items = Vec::new();
    let mut romaji_lines = Vec::new();
    let mut dual_lines = Vec::new();

    for line in lyrics.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.contains(']') {
            if let Some(close_idx) = trimmed.find(']') {
                let time_tag = &trimmed[..=close_idx]; // e.g. "[01:23.45]"
                let raw_time = &trimmed[1..close_idx]; // e.g. "01:23.45"
                let text = trimmed[close_idx + 1..].trim();

                let romaji_text = if contains_japanese(text) {
                    kakasi::convert(text).romaji
                } else {
                    text.to_string()
                };

                let seconds = parse_lrc_timestamp_seconds(raw_time);

                line_items.push(crate::models::RomajiLineItem {
                    time: raw_time.to_string(),
                    seconds,
                    original: text.to_string(),
                    romaji: romaji_text.clone(),
                });

                romaji_lines.push(format!("{} {}", time_tag, romaji_text));
                dual_lines.push(format!("{} {}", time_tag, text));
                if romaji_text != text && !romaji_text.is_empty() {
                    dual_lines.push(format!("{} {}", time_tag, romaji_text));
                }
                continue;
            }
        }

        // Line without timestamp (plain text or header)
        if contains_japanese(trimmed) {
            let romaji_text = kakasi::convert(trimmed).romaji;
            romaji_lines.push(romaji_text.clone());
            dual_lines.push(trimmed.to_string());
            if romaji_text != trimmed {
                dual_lines.push(romaji_text);
            }
        } else {
            romaji_lines.push(trimmed.to_string());
            dual_lines.push(trimmed.to_string());
        }
    }

    Ok(RomajiResponse {
        success: true,
        is_japanese: Some(true),
        message: Some("Romaji transliteration successful".to_string()),
        romaji_lrc: Some(romaji_lines.join("\n")),
        dual_lrc: Some(dual_lines.join("\n")),
        lines: Some(line_items),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kakasi_transliterate() {
        let input = "[00:12.34] たぶん私は生きている\n[00:15.00] 風が私を呼んでいる";
        let res = studio_romaji_transliterate(input.to_string()).unwrap();
        assert_eq!(res.is_japanese, Some(true));
        assert!(res.romaji_lrc.is_some());
        let romaji = res.romaji_lrc.unwrap();
        assert!(romaji.contains("[00:12.34]"));
        assert!(romaji.contains("watashi") || romaji.contains("ikiteiru"));
    }
}
