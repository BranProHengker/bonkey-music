use crate::models::TrackMeta;
use crate::services::metadata::read_track_metadata;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

fn get_library_file_path() -> PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("bonkey-music");
    let _ = fs::create_dir_all(&dir);
    dir.join("library.json")
}

fn save_library_to_disk(tracks: &[TrackMeta]) -> Result<(), String> {
    let path = get_library_file_path();
    let json = serde_json::to_string_pretty(tracks).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_library_from_disk() -> Vec<TrackMeta> {
    let path = get_library_file_path();
    if !path.exists() {
        return Vec::new();
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn load_library() -> Result<Vec<TrackMeta>, String> {
    Ok(read_library_from_disk())
}

#[tauri::command]
pub fn reset_library() -> Result<Vec<TrackMeta>, String> {
    let empty: Vec<TrackMeta> = Vec::new();
    save_library_to_disk(&empty)?;
    Ok(empty)
}

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<TrackMeta>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }

    let mut scanned_tracks = Vec::new();
    let valid_exts = ["mp3", "flac", "wav", "m4a", "ogg", "aac", "wma", "alac", "aiff"];

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|s| s.to_str()).map(|s| s.to_lowercase()) {
                if valid_exts.contains(&ext.as_str()) {
                    if let Ok(meta) = read_track_metadata(p) {
                        scanned_tracks.push(meta);
                    }
                }
            }
        }
    }

    let mut existing = read_library_from_disk();
    for track in scanned_tracks {
        if let Some(pos) = existing.iter().position(|t| t.file_path == track.file_path) {
            existing[pos] = track;
        } else {
            existing.push(track);
        }
    }

    save_library_to_disk(&existing)?;
    Ok(existing)
}

#[tauri::command]
pub fn import_files(file_paths: Vec<String>) -> Result<Vec<TrackMeta>, String> {
    let mut existing = read_library_from_disk();
    for p_str in file_paths {
        let p = Path::new(&p_str);
        if p.is_file() {
            if let Ok(meta) = read_track_metadata(p) {
                if let Some(pos) = existing.iter().position(|t| t.file_path == meta.file_path) {
                    existing[pos] = meta;
                } else {
                    existing.push(meta);
                }
            }
        }
    }

    save_library_to_disk(&existing)?;
    Ok(existing)
}

#[tauri::command]
pub fn remove_library_folder(path: String) -> Result<Vec<TrackMeta>, String> {
    let mut existing = read_library_from_disk();
    existing.retain(|t| !t.file_path.starts_with(&path));
    save_library_to_disk(&existing)?;
    Ok(existing)
}

#[tauri::command]
pub fn get_cover_art(file_path: String) -> Result<Option<String>, String> {
    let p = Path::new(&file_path);
    if !p.exists() {
        return Ok(None);
    }
    match read_track_metadata(p) {
        Ok(meta) => Ok(meta.cover_art),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn get_lyrics(audio_file_path: String) -> Result<Option<String>, String> {
    let p = Path::new(&audio_file_path);
    let lrc_path = p.with_extension("lrc");
    if lrc_path.exists() {
        return fs::read_to_string(lrc_path).map(Some).map_err(|e| e.to_string());
    }
    Ok(None)
}
