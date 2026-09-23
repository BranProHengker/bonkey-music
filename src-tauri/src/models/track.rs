use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMeta {
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub track_number: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub cover_art: Option<String>,
    pub bitrate: Option<f64>,
    pub sample_rate: Option<u32>,
    pub bits_per_sample: Option<u32>,
    pub lossless: Option<bool>,
    pub container: Option<String>,
    pub added_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LosslessInspectionResult {
    pub file_path: String,
    pub file_name: String,
    pub format: String,
    pub lossless: bool,
    pub sample_rate: u32,
    pub bits_per_sample: u32,
    pub bitrate: u32,
    pub channels: u32,
    pub estimated_cutoff_khz: f64,
    pub verdict: String,
    pub verdict_label: String,
    pub spectrum_bins: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackFormatOption {
    pub id: serde_json::Value,
    pub label: String,
    pub desc: String,
    pub recommended: Option<bool>,
    pub tag: Option<String>,
    pub hires: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub id: String,
    pub percent: u32,
    pub received_bytes: u64,
    pub total_bytes: u64,
}
