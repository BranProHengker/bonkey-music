use crate::services::discord::DiscordService;
use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri::State;

pub struct DiscordState(pub DiscordService);

#[tauri::command]
pub fn select_folder() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new().pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn select_files() -> Result<Vec<String>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("Audio Files", &["mp3", "flac", "wav", "m4a", "ogg", "aac", "wma", "alac", "aiff"])
        .pick_files();
    Ok(files
        .unwrap_or_default()
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn select_image() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp", "gif"])
        .pick_file();
    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<bool, String> {
    let p = Path::new(&file_path);
    if let Some(parent) = p.parent() {
        let _ = open::that(parent);
        Ok(true)
    } else {
        let _ = open::that(p);
        Ok(true)
    }
}

#[tauri::command]
pub fn export_playlist(name: String, file_paths: Vec<String>) -> Result<Value, String> {
    let save_path = rfd::FileDialog::new()
        .set_file_name(&format!("{}.m3u8", name))
        .add_filter("M3U8 Playlist", &["m3u8"])
        .save_file();

    if let Some(dest) = save_path {
        let mut content = String::from("#EXTM3U\n");
        for fp in file_paths {
            content.push_str(&fp);
            content.push('\n');
        }
        fs::write(&dest, content).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({
            "success": true,
            "destination": dest.to_string_lossy()
        }))
    } else {
        Ok(serde_json::json!({
            "success": false,
            "reason": "Cancelled by user"
        }))
    }
}

#[tauri::command]
pub fn update_discord_status(state: State<'_, DiscordState>, song_data: Value) {
    state.0.update(&song_data);
}

#[tauri::command]
pub fn get_audio_port() -> u16 {
    crate::services::audio_server::get_server_port()
}
