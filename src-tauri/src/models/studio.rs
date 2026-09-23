use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnlineTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub cover_art: Option<String>,
    pub release_year: Option<u32>,
    pub preview_url: Option<String>,
    pub source: Option<String>,
    pub quality_label: Option<String>,
    pub hires: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LrcSearchResult {
    pub id: u64,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub duration: Option<f64>,
    pub instrumental: bool,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomajiLineItem {
    pub time: String,
    pub seconds: f64,
    pub original: String,
    pub romaji: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomajiResponse {
    pub success: bool,
    pub is_japanese: Option<bool>,
    pub message: Option<String>,
    pub romaji_lrc: Option<String>,
    pub dual_lrc: Option<String>,
    pub lines: Option<Vec<RomajiLineItem>>,
}
