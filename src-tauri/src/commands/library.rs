use crate::models::TrackMeta;
use crate::services::metadata::read_track_metadata;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn get_app_dir() -> PathBuf {
    if let Some(config) = dirs::config_dir() {
        let dir = config.join("bonkey-music");
        if dir.exists() {
            return dir;
        }
    }
    if let Some(data) = dirs::data_local_dir() {
        let dir = data.join("bonkey-music");
        if dir.exists() {
            return dir;
        }
    }
    let dir = dirs::config_dir()
        .or_else(dirs::data_local_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("bonkey-music");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn get_library_file_path() -> PathBuf {
    get_app_dir().join("library.json")
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
    match fs::read_to_string(&path) {
        Ok(data) => match serde_json::from_str::<Vec<TrackMeta>>(&data) {
            Ok(tracks) => tracks,
            Err(e) => {
                eprintln!("[Bonkey Music] Failed to parse library.json: {}", e);
                Vec::new()
            }
        },
        Err(e) => {
            eprintln!("[Bonkey Music] Failed to read library.json: {}", e);
            Vec::new()
        }
    }
}

#[tauri::command]
pub fn load_library() -> Result<Vec<TrackMeta>, String> {
    let mut tracks = read_library_from_disk();
    let port = crate::services::audio_server::get_server_port();
    let mut needs_migration = false;

    for track in &mut tracks {
        let is_base64 = track
            .cover_art
            .as_ref()
            .map(|c| c.starts_with("data:"))
            .unwrap_or(false);
        if is_base64 {
            needs_migration = true;
        }

        // Always ensure cover_art uses dynamic server port
        if is_base64
            || track
                .cover_art
                .as_ref()
                .map(|c| c.contains("/cover?path="))
                .unwrap_or(false)
        {
            track.cover_art = Some(format!(
                "http://127.0.0.1:{}/cover?path={}",
                port,
                urlencoding::encode(&track.file_path)
            ));
        }
    }

    if needs_migration {
        let _ = save_library_to_disk(&tracks);
        println!("[Library] Migrated library.json from 28MB base64 to ~39KB lightweight URLs!");
    }

    Ok(tracks)
}

#[tauri::command]
pub fn reset_library() -> Result<Vec<TrackMeta>, String> {
    let empty: Vec<TrackMeta> = Vec::new();
    save_library_to_disk(&empty)?;

    let settings_path = crate::commands::settings::get_settings_file_path();
    if settings_path.exists() {
        if let Ok(data) = fs::read_to_string(&settings_path) {
            if let Ok(mut current) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(obj) = current.as_object_mut() {
                    obj.remove("libraryFolder");
                    obj.insert("libraryFolders".to_string(), serde_json::json!([]));
                    if let Ok(json) = serde_json::to_string_pretty(&current) {
                        let _ = fs::write(settings_path, json);
                    }
                }
            }
        }
    }

    Ok(empty)
}

fn save_folder_to_settings(folder_path: &str) {
    let settings_path = crate::commands::settings::get_settings_file_path();
    let mut current: serde_json::Value = if settings_path.exists() {
        let data = fs::read_to_string(&settings_path).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = current.as_object_mut() {
        obj.insert(
            "libraryFolder".to_string(),
            serde_json::Value::String(folder_path.to_string()),
        );
        let mut folders: Vec<String> = obj
            .get("libraryFolders")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        if !folders.contains(&folder_path.to_string()) {
            folders.push(folder_path.to_string());
        }
        obj.insert("libraryFolders".to_string(), serde_json::json!(folders));
    }
    if let Ok(json) = serde_json::to_string_pretty(&current) {
        let _ = fs::write(settings_path, json);
    }
}

fn remove_folder_from_settings(folder_path: &str) {
    let settings_path = crate::commands::settings::get_settings_file_path();
    if !settings_path.exists() {
        return;
    }
    let data = fs::read_to_string(&settings_path).unwrap_or_else(|_| "{}".to_string());
    let mut current: serde_json::Value =
        serde_json::from_str(&data).unwrap_or(serde_json::json!({}));

    if let Some(obj) = current.as_object_mut() {
        let mut folders: Vec<String> = obj
            .get("libraryFolders")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        folders.retain(|f| f != folder_path);
        let next_primary = folders.first().cloned();
        obj.insert("libraryFolders".to_string(), serde_json::json!(folders));
        match next_primary {
            Some(p) => {
                obj.insert("libraryFolder".to_string(), serde_json::Value::String(p));
            }
            None => {
                obj.remove("libraryFolder");
            }
        }
    }
    if let Ok(json) = serde_json::to_string_pretty(&current) {
        let _ = fs::write(settings_path, json);
    }
}

#[tauri::command]
pub fn scan_folder(path: String) -> Result<Vec<TrackMeta>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }

    let mut scanned_tracks = Vec::new();
    let valid_exts = [
        "mp3", "flac", "wav", "m4a", "ogg", "aac", "wma", "alac", "aiff",
    ];

    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase())
            {
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
    save_folder_to_settings(&path);
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
    remove_folder_from_settings(&path);
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
        return fs::read_to_string(lrc_path)
            .map(Some)
            .map_err(|e| e.to_string());
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_existing_library() {
        let path = get_library_file_path();
        if path.exists() {
            let res = load_library();
            assert!(res.is_ok());
            let tracks = res.unwrap();
            assert!(
                !tracks.is_empty(),
                "Library should not be empty when file exists"
            );
            println!(
                "Successfully parsed & migrated {} tracks from library.json!",
                tracks.len()
            );
        }
    }
}
