use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn get_settings_file_path() -> PathBuf {
    crate::commands::library::get_app_dir().join("settings.json")
}

#[tauri::command]
pub fn load_settings() -> Result<Value, String> {
    let path = get_settings_file_path();
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let data = fs::read_to_string(path).unwrap_or_else(|_| "{}".to_string());
    let val: Value = serde_json::from_str(&data).unwrap_or(serde_json::json!({}));
    Ok(val)
}

#[tauri::command]
pub fn save_settings(settings: Value) -> Result<bool, String> {
    let path = get_settings_file_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(true)
}
