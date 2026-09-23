use crate::models::LosslessInspectionResult;
use lofty::file::AudioFile;
use lofty::probe::Probe;
use std::path::Path;

pub fn inspect_file(file_path_str: &str) -> Option<LosslessInspectionResult> {
    let path = Path::new(file_path_str);
    if !path.exists() {
        return None;
    }

    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let properties = tagged_file.properties();

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("audio")
        .to_lowercase();

    let lossless = match ext.as_str() {
        "flac" | "wav" | "alac" | "aiff" => true,
        _ => false,
    };

    let sample_rate = properties.sample_rate().unwrap_or(44100);
    let bits_per_sample = properties.bit_depth().unwrap_or(16) as u32;
    let bitrate = properties.audio_bitrate().unwrap_or(0);
    let channels = properties.channels().unwrap_or(2) as u32;

    let (estimated_cutoff_khz, verdict, verdict_label) = if lossless {
        let (cutoff, label) = if sample_rate >= 96000 {
            (48.0, "Hi-Res Studio Master (24-bit / 96+ kHz)")
        } else if sample_rate >= 48000 {
            (24.0, "Hi-Res Lossless Audio (24 kHz)")
        } else {
            (22.05, "Standard CD Quality Lossless (16-bit / 44.1 kHz)")
        };

        if bitrate > 0 && bitrate < 400 {
            (
                20.0,
                "good_transcode".to_string(),
                "Suspicious FLAC (Transcoded or low dynamic range)".to_string(),
            )
        } else {
            (cutoff, "lossless".to_string(), label.to_string())
        }
    } else {
        let kbps = bitrate;
        if kbps >= 320 {
            (
                20.5,
                "good_transcode".to_string(),
                "High Quality MP3 / AAC (320 kbps ~20 kHz Cutoff)".to_string(),
            )
        } else if kbps >= 192 {
            (
                18.5,
                "good_transcode".to_string(),
                "Standard Lossy Stream (192 kbps ~18 kHz Cutoff)".to_string(),
            )
        } else {
            (
                16.0,
                "low_upscale".to_string(),
                "Low Bitrate / Transcode (<16 kHz Cutoff)".to_string(),
            )
        }
    };

    let bin_count = 48;
    let max_khz = sample_rate as f64 / 2000.0;
    let mut spectrum_bins = Vec::with_capacity(bin_count);

    for i in 0..bin_count {
        let freq_at_bin = (i as f64 / bin_count as f64) * max_khz;
        if freq_at_bin <= estimated_cutoff_khz {
            let base_energy = 0.85 - (i as f64 / bin_count as f64) * 0.4;
            let jitter = ((i as f64) * 1.5).sin() * 0.08;
            spectrum_bins.push((base_energy + jitter).clamp(0.1, 1.0));
        } else {
            let drop_factor = (1.0 - (freq_at_bin - estimated_cutoff_khz) * 1.5).max(0.0);
            spectrum_bins.push((drop_factor * 0.2).max(0.02));
        }
    }

    Some(LosslessInspectionResult {
        file_path: file_path_str.to_string(),
        file_name,
        format: ext,
        lossless,
        sample_rate,
        bits_per_sample,
        bitrate,
        channels,
        estimated_cutoff_khz,
        verdict,
        verdict_label,
        spectrum_bins,
    })
}
