use crate::models::{LrcSearchResult, OnlineTrack, TrackFormatOption};
use reqwest::Client;
use serde_json::Value;

pub async fn search_tracks(query: &str, source: Option<&str>) -> Result<Vec<OnlineTrack>, String> {
    let client = Client::new();
    let src = source.unwrap_or("all");

    let mut results = Vec::new();

    if src == "all" || src == "deezer" {
        let url = format!("https://api.deezer.com/search?q={}&limit=30", urlencoding::encode(query));
        if let Ok(res) = client.get(&url).send().await {
            if let Ok(json) = res.json::<Value>().await {
                if let Some(items) = json.get("data").and_then(|d| d.as_array()) {
                    for item in items {
                        let id = item.get("id").and_then(|v| v.as_u64()).map(|n| format!("deezer_{}", n)).unwrap_or_default();
                        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
                        let artist = item.get("artist").and_then(|a| a.get("name")).and_then(|v| v.as_str()).unwrap_or("Unknown Artist").to_string();
                        let album = item.get("album").and_then(|a| a.get("title")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let duration = item.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let cover_art = item.get("album").and_then(|a| a.get("cover_big").or_else(|| a.get("cover_medium"))).and_then(|v| v.as_str()).map(|s| s.to_string());
                        let preview_url = item.get("preview").and_then(|v| v.as_str()).map(|s| s.to_string());

                        results.push(OnlineTrack {
                            id,
                            title,
                            artist,
                            album,
                            duration,
                            cover_art,
                            release_year: None,
                            preview_url,
                            source: Some("deezer".to_string()),
                            quality_label: Some("16-bit / 44.1 kHz FLAC".to_string()),
                            hires: Some(false),
                        });
                    }
                }
            }
        }
    }

    if src == "all" || src == "qobuz" {
        let url = format!("https://itunes.apple.com/search?term={}&media=music&entity=song&limit=25", urlencoding::encode(query));
        if let Ok(res) = client.get(&url).send().await {
            if let Ok(json) = res.json::<Value>().await {
                if let Some(items) = json.get("results").and_then(|r| r.as_array()) {
                    for item in items {
                        let id = item.get("trackId").and_then(|v| v.as_u64()).map(|n| format!("qobuz_{}", n)).unwrap_or_default();
                        let title = item.get("trackName").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
                        let artist = item.get("artistName").and_then(|v| v.as_str()).unwrap_or("Unknown Artist").to_string();
                        let album = item.get("collectionName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let duration = item.get("trackTimeMillis").and_then(|v| v.as_f64()).map(|ms| ms / 1000.0).unwrap_or(0.0);
                        let cover_art = item.get("artworkUrl100").and_then(|v| v.as_str()).map(|s| s.replace("100x100bb", "600x600bb"));
                        let preview_url = item.get("previewUrl").and_then(|v| v.as_str()).map(|s| s.to_string());

                        results.push(OnlineTrack {
                            id,
                            title,
                            artist,
                            album,
                            duration,
                            cover_art,
                            release_year: None,
                            preview_url,
                            source: Some("qobuz".to_string()),
                            quality_label: Some("24-bit / 96 kHz Hi-Res".to_string()),
                            hires: Some(true),
                        });
                    }
                }
            }
        }
    }

    Ok(results)
}

pub async fn search_lrc(query: &str) -> Result<Vec<LrcSearchResult>, String> {
    let client = Client::new();
    let url = format!("https://lrclib.net/api/search?q={}", urlencoding::encode(query));
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let results: Vec<LrcSearchResult> = res.json().await.map_err(|e| e.to_string())?;
    Ok(results)
}

pub fn get_track_format_options(track: &OnlineTrack) -> Vec<TrackFormatOption> {
    let is_deezer = track.source.as_deref() == Some("deezer");
    let is_qobuz = track.source.as_deref() == Some("qobuz");

    if is_deezer {
        vec![
            TrackFormatOption {
                id: serde_json::json!("flac"),
                label: "FLAC (Lossless)".to_string(),
                desc: "16-bit · 44.1 kHz · Bit-perfect CD quality".to_string(),
                recommended: Some(true),
                tag: Some("FLAC CD".to_string()),
                hires: Some(false),
            },
            TrackFormatOption {
                id: serde_json::json!("320"),
                label: "MP3 320k (High Quality)".to_string(),
                desc: "320 kbps · Constant bitrate".to_string(),
                recommended: Some(false),
                tag: Some("MP3 320K".to_string()),
                hires: Some(false),
            },
            TrackFormatOption {
                id: serde_json::json!("128"),
                label: "MP3 128k (Standard)".to_string(),
                desc: "128 kbps · Compact file size".to_string(),
                recommended: Some(false),
                tag: Some("MP3 128K".to_string()),
                hires: Some(false),
            },
        ]
    } else if is_qobuz {
        vec![
            TrackFormatOption {
                id: serde_json::json!("6"),
                label: "FLAC (CD Quality)".to_string(),
                desc: "16-bit · 44.1 kHz · Lossless".to_string(),
                recommended: Some(!track.hires.unwrap_or(false)),
                tag: Some("FLAC CD".to_string()),
                hires: Some(false),
            },
            TrackFormatOption {
                id: serde_json::json!("7"),
                label: "FLAC Hi-Res".to_string(),
                desc: "24-bit · 96 kHz · Studio Master".to_string(),
                recommended: Some(track.hires.unwrap_or(false)),
                tag: Some("Hi-Res 24-bit".to_string()),
                hires: Some(true),
            },
            TrackFormatOption {
                id: serde_json::json!("5"),
                label: "MP3 320k".to_string(),
                desc: "320 kbps · Standard compressed".to_string(),
                recommended: Some(false),
                tag: Some("MP3 320K".to_string()),
                hires: Some(false),
            },
        ]
    } else {
        vec![TrackFormatOption {
            id: serde_json::json!("default"),
            label: "Audio Stream".to_string(),
            desc: "Direct stream audio".to_string(),
            recommended: Some(true),
            tag: None,
            hires: None,
        }]
    }
}
