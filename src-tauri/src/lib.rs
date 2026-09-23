mod commands;
mod models;
mod services;

use commands::*;
use services::discord::DiscordService;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tauri::http::{header, Response, StatusCode};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DiscordState(DiscordService::new()))
        .register_uri_scheme_protocol("media", |_ctx, request| {
            let uri_str = request.uri().to_string();
            let path_str = uri_str
                .strip_prefix("media:///")
                .or_else(|| uri_str.strip_prefix("media://"))
                .unwrap_or(&uri_str);

            let decoded = urlencoding::decode(path_str).unwrap_or_else(|_| path_str.into());
            #[allow(unused_mut)]
            let mut file_path = PathBuf::from(decoded.as_ref());

            #[cfg(windows)]
            {
                let s = file_path.to_string_lossy();
                if s.starts_with('/') || s.starts_with('\\') {
                    file_path = PathBuf::from(&s[1..]);
                }
            }

            if !file_path.exists() {
                return Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Vec::new())
                    .unwrap();
            }

            let mut file = match File::open(&file_path) {
                Ok(f) => f,
                Err(_) => {
                    return Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Vec::new())
                        .unwrap();
                }
            };

            let total_len = match file.metadata() {
                Ok(m) => m.len(),
                Err(_) => 0,
            };

            let mime_type = match file_path.extension().and_then(|s| s.to_str()).unwrap_or("") {
                "flac" => "audio/flac",
                "mp3" => "audio/mpeg",
                "wav" => "audio/wav",
                "ogg" => "audio/ogg",
                "m4a" | "aac" => "audio/mp4",
                _ => "application/octet-stream",
            };

            let range_header = request
                .headers()
                .get(header::RANGE)
                .and_then(|v| v.to_str().ok());

            if let Some(range) = range_header {
                if let Some(range_spec) = range.strip_prefix("bytes=") {
                    let parts: Vec<&str> = range_spec.split('-').collect();
                    let start: u64 = parts[0].parse().unwrap_or(0);
                    let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                        parts[1].parse().unwrap_or(total_len - 1).min(total_len - 1)
                    } else {
                        total_len - 1
                    };

                    let chunk_len = if end >= start { (end - start) + 1 } else { 0 };
                    let _ = file.seek(SeekFrom::Start(start));
                    let mut buffer = vec![0u8; chunk_len as usize];
                    let _ = file.read_exact(&mut buffer);

                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, mime_type)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(
                            header::CONTENT_RANGE,
                            format!("bytes {}-{}/{}", start, end, total_len),
                        )
                        .header(header::CONTENT_LENGTH, chunk_len.to_string())
                        .header("Access-Control-Allow-Origin", "*")
                        .body(buffer)
                        .unwrap();
                }
            }

            let mut buffer = Vec::with_capacity(total_len as usize);
            let _ = file.read_to_end(&mut buffer);

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime_type)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CONTENT_LENGTH, total_len.to_string())
                .header("Access-Control-Allow-Origin", "*")
                .body(buffer)
                .unwrap()
        })
        .setup(|app| {
            if let Some(main_window) = app.get_webview_window("main") {
                let win_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

            let show_hide = MenuItem::with_id(app, "toggle_window", "Show / Hide Bonkey Music", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let play_pause = MenuItem::with_id(app, "play_pause", "Play / Pause", true, None::<&str>)?;
            let next_track = MenuItem::with_id(app, "next_track", "Next Track", true, None::<&str>)?;
            let prev_track = MenuItem::with_id(app, "prev_track", "Previous Track", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&show_hide, &sep1, &play_pause, &next_track, &prev_track, &sep2, &quit],
            )?;

            if let Some(tray) = app.tray_by_id("main-tray") {
                let _ = tray.set_menu(Some(menu));
                tray.on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "toggle_window" => {
                            if let Some(win) = app.get_webview_window("main") {
                                if win.is_visible().unwrap_or(false) {
                                    let _ = win.hide();
                                } else {
                                    let _ = win.show();
                                    let _ = win.set_focus();
                                }
                            }
                        }
                        "play_pause" => {
                            let _ = app.emit("media-control", "play-pause");
                        }
                        "next_track" => {
                            let _ = app.emit("media-control", "next");
                        }
                        "prev_track" => {
                            let _ = app.emit("media-control", "prev");
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                });

                tray.on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            load_library,
            reset_library,
            remove_library_folder,
            import_files,
            get_cover_art,
            get_lyrics,
            load_settings,
            save_settings,
            select_folder,
            select_files,
            select_image,
            open_file_location,
            export_playlist,
            update_discord_status,
            studio_search_tracks,
            studio_search_lrc,
            studio_get_track_formats,
            studio_inspect_lossless,
            studio_inspect_multiple,
            studio_select_file,
            studio_select_multiple_files,
            studio_select_folder_to_inspect,
            studio_save_lrc,
            studio_romaji_transliterate,
            studio_download_track,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
