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
    let mut current: Value = if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let (Some(cur_obj), Some(new_obj)) = (current.as_object_mut(), settings.as_object()) {
        for (k, v) in new_obj {
            cur_obj.insert(k.clone(), v.clone());
        }
    } else {
        current = settings;
    }

    let json = serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(true)
}
