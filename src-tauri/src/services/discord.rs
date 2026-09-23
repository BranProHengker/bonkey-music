use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;

pub struct DiscordService {
    client: Mutex<Option<DiscordIpcClient>>,
}

impl DiscordService {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
        }
    }

    pub fn update(&self, song_data: &serde_json::Value) {
        let mut guard = self.client.lock().unwrap();
        if guard.is_none() {
            if let Ok(mut client) = DiscordIpcClient::new("1519697840094580757") {
                if client.connect().is_ok() {
                    *guard = Some(client);
                }
            }
        }

        if let Some(client) = guard.as_mut() {
            let title = song_data
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Playing Audio");
            let artist = song_data
                .get("artist")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown Artist");

            let payload = activity::Activity::new()
                .state(artist)
                .details(title)
                .assets(
                    activity::Assets::new()
                        .large_image("iconapp")
                        .large_text("Bonkey Music"),
                );
            let _ = client.set_activity(payload);
        }
    }
}
