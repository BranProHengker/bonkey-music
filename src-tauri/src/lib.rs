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

pub fn resolve_media_path(uri_str: &str) -> PathBuf {
    let raw_path = uri_str
        .strip_prefix("media://localhost/")
        .or_else(|| uri_str.strip_prefix("media://localhost"))
        .or_else(|| uri_str.strip_prefix("media:///"))
        .or_else(|| uri_str.strip_prefix("media://"))
        .or_else(|| uri_str.strip_prefix("media:/"))
        .unwrap_or(uri_str);

    let decoded = urlencoding::decode(raw_path).unwrap_or_else(|_| raw_path.into());
    let clean_str = decoded.trim_start_matches('/');

    #[cfg(windows)]
    {
        if clean_str.len() >= 2 && clean_str.chars().nth(1) == Some('/') {
            let drive = &clean_str[..1];
            let rest = &clean_str[2..];
            PathBuf::from(format!("{}:/{}", drive, rest))
        } else {
            PathBuf::from(clean_str)
        }
    }

    #[cfg(not(windows))]
    {
        PathBuf::from(format!("/{}", clean_str))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DiscordState(DiscordService::new()))
        .register_uri_scheme_protocol("media", |_ctx, request| {
            if request.method() == tauri::http::Method::OPTIONS {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "Range, Origin, Content-Type, Accept")
                    .header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
                    .body(Vec::new())
                    .unwrap();
            }

            let file_path = resolve_media_path(&request.uri().to_string());

            if !file_path.exists() {
                eprintln!("[media] 404 Not Found: {:?}", file_path);
                return Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap();
            }

            let mut file = match File::open(&file_path) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("[media] Error opening {:?}: {}", file_path, e);
                    return Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Vec::new())
                        .unwrap();
                }
            };

            let total_len = match file.metadata() {
                Ok(m) => m.len(),
                Err(_) => 0,
            };

            let ext = file_path
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_lowercase())
                .unwrap_or_default();

            let mime_type = match ext.as_str() {
                "flac" => "audio/flac",
                "mp3" => "audio/mpeg",
                "wav" => "audio/wav",
                "ogg" => "audio/ogg",
                "m4a" => "audio/mp4",
                "aac" => "audio/aac",
                _ => "audio/mpeg",
            };

            if request.method() == tauri::http::Method::HEAD {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, mime_type)
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::CONTENT_LENGTH, total_len.to_string())
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
                    .body(Vec::new())
                    .unwrap();
            }

            let range_header = request
                .headers()
                .get(header::RANGE)
                .and_then(|v| v.to_str().ok());

            if let Some(range) = range_header {
                if let Some(range_spec) = range.strip_prefix("bytes=") {
                    let parts: Vec<&str> = range_spec.split('-').collect();
                    let start: u64 = parts[0].parse().unwrap_or(0);
                    let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                        parts[1]
                            .parse()
                            .unwrap_or(total_len.saturating_sub(1))
                            .min(total_len.saturating_sub(1))
                    } else {
                        total_len.saturating_sub(1)
                    };

                    let chunk_len = if end >= start { (end - start) + 1 } else { 0 };
                    let mut buffer = Vec::with_capacity(chunk_len as usize);
                    let _ = file.seek(SeekFrom::Start(start));
                    let _ = file.take(chunk_len).read_to_end(&mut buffer);

                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, mime_type)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(
                            header::CONTENT_RANGE,
                            format!("bytes {}-{}/{}", start, end, total_len),
                        )
                        .header(header::CONTENT_LENGTH, buffer.len().to_string())
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
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
                .header(header::CONTENT_LENGTH, buffer.len().to_string())
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
                .body(buffer)
                .unwrap()
        })
        .setup(|app| {
            crate::services::audio_server::start_audio_server();

            #[cfg(target_os = "linux")]
            let has_indicator = unsafe {
                libloading::Library::new("libayatana-appindicator3.so.1").is_ok()
                    || libloading::Library::new("libappindicator3.so.1").is_ok()
                    || libloading::Library::new("libayatana-appindicator3.so").is_ok()
                    || libloading::Library::new("libappindicator3.so").is_ok()
            };
            #[cfg(not(target_os = "linux"))]
            let has_indicator = true;

            if has_indicator {
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

                let mut builder = tauri::tray::TrayIconBuilder::with_id("main-tray")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
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
                    })
                    .on_tray_icon_event(|tray, event| {
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

                if let Some(icon) = app.default_window_icon() {
                    builder = builder.icon(icon.clone());
                }

                if let Err(e) = builder.build(app) {
                    eprintln!("[Bonkey Music] Failed to build tray icon: {}", e);
                } else if let Some(main_window) = app.get_webview_window("main") {
                    let win_clone = main_window.clone();
                    main_window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = win_clone.hide();
                        }
                    });
                }
            } else {
                eprintln!("[Bonkey Music] Warning: System tray disabled because libayatana-appindicator is missing on this system.");
                eprintln!("[Bonkey Music] Arch Linux: run 'sudo pacman -S libayatana-appindicator'");
                eprintln!("[Bonkey Music] Ubuntu/Debian: run 'sudo apt install libayatana-appindicator3-1'");
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
            get_audio_port,
            studio_search_lrc,
            studio_inspect_lossless,
            studio_inspect_multiple,
            studio_select_file,
            studio_select_multiple_files,
            studio_select_folder_to_inspect,
            studio_save_lrc,
            studio_romaji_transliterate,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_media_path() {
        #[cfg(not(windows))]
        {
            assert_eq!(
                resolve_media_path("media:///home/user/Music/song.flac"),
                PathBuf::from("/home/user/Music/song.flac")
            );
            assert_eq!(
                resolve_media_path("media:////home/user/Music/song.flac"),
                PathBuf::from("/home/user/Music/song.flac")
            );
            assert_eq!(
                resolve_media_path("media://localhost/home/user/Music/song.flac"),
                PathBuf::from("/home/user/Music/song.flac")
            );
            assert_eq!(
                resolve_media_path("media:///home/user/Music/My%20Song.flac"),
                PathBuf::from("/home/user/Music/My Song.flac")
            );
        }

        #[cfg(windows)]
        {
            assert_eq!(
                resolve_media_path("media:///C:/Music/song.flac"),
                PathBuf::from("C:/Music/song.flac")
            );
        }
    }
}
