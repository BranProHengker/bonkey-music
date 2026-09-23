use crate::models::TrackMeta;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::probe::Probe;
use lofty::tag::{Accessor, Tag, TagExt};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

pub fn read_track_metadata(path: &Path) -> Result<TrackMeta, String> {
    let tagged_file = Probe::open(path)
        .map_err(|e| format!("Failed to open file {:?}: {}", path, e))?
        .read()
        .map_err(|e| format!("Failed to read metadata {:?}: {}", path, e))?;

    let properties = tagged_file.properties();
    let duration = properties.duration().as_secs_f64();
    let sample_rate = properties.sample_rate();
    let bitrate = properties.audio_bitrate();
    let bits_per_sample = properties.bit_depth().map(|b| b as u32);

    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let lossless = match ext.as_str() {
        "flac" | "wav" | "alac" | "aiff" => true,
        _ => false,
    };

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    let title = tag
        .and_then(|t| t.title().map(|s| s.to_string()))
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        });

    let artist = tag
        .and_then(|t| t.artist().map(|s| s.to_string()))
        .unwrap_or_else(|| "Unknown Artist".to_string());

    let album = tag
        .and_then(|t| t.album().map(|s| s.to_string()))
        .unwrap_or_else(|| "Unknown Album".to_string());

    let track_number = tag.and_then(|t| t.track());
    let year = tag.and_then(|t| t.year());
    let genre = tag.and_then(|t| t.genre().map(|s| s.to_string()));

    let cover_art = tag.and_then(|t| {
        t.pictures().first().map(|pic| {
            let mime = match pic.mime_type() {
                Some(MimeType::Png) => "image/png",
                _ => "image/jpeg",
            };
            format!("data:{};base64,{}", mime, BASE64.encode(pic.data()))
        })
    });

    let added_at = fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    Ok(TrackMeta {
        file_path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration,
        track_number,
        year,
        genre,
        cover_art,
        bitrate,
        sample_rate,
        bits_per_sample,
        lossless: Some(lossless),
        container: Some(ext),
        added_at,
    })
}

pub fn embed_metadata(
    path: &Path,
    title: &str,
    artist: &str,
    album: &str,
    year: Option<u32>,
    cover_data: Option<&[u8]>,
) -> Result<(), String> {
    let mut tagged_file = Probe::open(path)
        .map_err(|e| format!("Failed to open for embedding: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read for embedding: {}", e))?;

    let tag_type = tagged_file.primary_tag_type();
    let tag = match tagged_file.tag_mut(tag_type) {
        Some(t) => t,
        None => {
            tagged_file.insert_tag(Tag::new(tag_type));
            tagged_file
                .tag_mut(tag_type)
                .ok_or_else(|| "Failed to create tag".to_string())?
        }
    };

    tag.set_title(title.to_string());
    tag.set_artist(artist.to_string());
    tag.set_album(album.to_string());
    if let Some(y) = year {
        tag.set_year(y);
    }

    if let Some(pic_data) = cover_data {
        let pic = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Jpeg),
            None,
            pic_data.to_vec(),
        );
        tag.push_picture(pic);
    }

    tag.save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Failed to save tag to file: {}", e))?;

    Ok(())
}
