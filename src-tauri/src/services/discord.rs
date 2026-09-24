use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::collections::HashMap;
use std::sync::mpsc::{channel, Sender};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

fn fetch_online_artwork(
    http_client: &reqwest::blocking::Client,
    title: &str,
    artist: &str,
) -> Option<String> {
    let clean_artist = if artist == "Unknown Artist" {
        ""
    } else {
        artist
    };
    let term = format!("{} {}", title, clean_artist).trim().to_string();
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&term)
    );

    let resp = http_client.get(&url).send().ok()?;
    let json: serde_json::Value = resp.json().ok()?;
    let artwork = json
        .get("results")?
        .get(0)?
        .get("artworkUrl100")?
        .as_str()?;

    Some(artwork.replace("100x100bb.jpg", "512x512bb.jpg"))
}

pub struct DiscordService {
    sender: Sender<serde_json::Value>,
}

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<serde_json::Value>();

        thread::spawn(move || {
            let mut client: Option<DiscordIpcClient> = None;
            let mut last_connect_attempt = Instant::now();
            let http_client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap_or_default();
            let mut artwork_cache: HashMap<String, Option<String>> = HashMap::new();

            // Attempt initial connection immediately
            if let Ok(mut c) = DiscordIpcClient::new("1519697840094580757") {
                if c.connect().is_ok() {
                    client = Some(c);
                }
            }

            while let Ok(song_data) = rx.recv() {
                // Drain any pending updates to only process the freshest playback state
                let mut latest_data = song_data;
                while let Ok(next) = rx.try_recv() {
                    latest_data = next;
                }

                let title = latest_data.get("title").and_then(|v| v.as_str());
                let artist = latest_data
                    .get("artist")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown Artist");
                let is_playing = latest_data
                    .get("isPlaying")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let current_time = latest_data
                    .get("currentTime")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let duration = latest_data
                    .get("duration")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);

                if title.is_none() {
                    if let Some(c) = client.as_mut() {
                        let _ = c.clear_activity();
                    }
                    continue;
                }
                let title = title.unwrap();

                // Throttle reconnection attempts to at most once every 15 seconds
                if client.is_none() && last_connect_attempt.elapsed() >= Duration::from_secs(15) {
                    last_connect_attempt = Instant::now();
                    if let Ok(mut c) = DiscordIpcClient::new("1519697840094580757") {
                        if c.connect().is_ok() {
                            client = Some(c);
                        }
                    }
                }

                if let Some(c) = client.as_mut() {
                    let state_str = if is_playing {
                        format!("by {}", artist)
                    } else {
                        format!("by {} • Paused", artist)
                    };

                    let cache_key = format!("{} - {}", artist, title);
                    let cover_url = artwork_cache
                        .entry(cache_key)
                        .or_insert_with(|| fetch_online_artwork(&http_client, title, artist))
                        .clone();

                    let large_img = cover_url.as_deref().unwrap_or("logo_app");

                    let mut assets = activity::Assets::new()
                        .large_image(large_img)
                        .large_text(title);

                    if is_playing {
                        assets = assets.small_image("play_icon").small_text("Playing");
                    } else {
                        assets = assets.small_image("pause_icon").small_text("Paused");
                    }

                    let mut act = activity::Activity::new()
                        .activity_type(activity::ActivityType::Listening)
                        .details(title)
                        .state(&state_str)
                        .assets(assets);

                    if is_playing {
                        let now_epoch = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs() as i64;
                        let start = (now_epoch - current_time as i64).max(0);
                        let mut timestamps = activity::Timestamps::new().start(start);
                        if duration > 0.0 {
                            let end = start + duration as i64;
                            timestamps = timestamps.end(end);
                        }
                        act = act.timestamps(timestamps);
                    }

                    if c.set_activity(act).is_err() {
                        let _ = c.close();
                        client = None;
                    }
                }
            }
        });

        Self { sender: tx }
    }

    pub fn update(&self, song_data: &serde_json::Value) {
        let _ = self.sender.send(song_data.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discord_connect() {
        if let Ok(mut client) = DiscordIpcClient::new("1519697840094580757") {
            let res = client.connect();
            println!("Discord connect result: {:?}", res);
            assert!(res.is_ok(), "Discord connect failed: {:?}", res);
        }
    }
}
