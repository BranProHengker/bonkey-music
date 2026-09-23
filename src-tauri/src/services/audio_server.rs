use std::sync::atomic::{AtomicU16, Ordering};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tokio::net::TcpListener;

pub static AUDIO_PORT: AtomicU16 = AtomicU16::new(0);

pub fn get_server_port() -> u16 {
    AUDIO_PORT.load(Ordering::SeqCst)
}

pub fn start_audio_server() -> u16 {
    let existing = AUDIO_PORT.load(Ordering::SeqCst);
    if existing > 0 {
        return existing;
    }

    let std_listener = match std::net::TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[AudioServer] Failed to bind 127.0.0.1:0: {}", e);
            return 0;
        }
    };
    let _ = std_listener.set_nonblocking(true);
    let port = match std_listener.local_addr() {
        Ok(addr) => addr.port(),
        Err(e) => {
            eprintln!("[AudioServer] Failed to get local port: {}", e);
            return 0;
        }
    };

    AUDIO_PORT.store(port, Ordering::SeqCst);
    println!("[AudioServer] Streaming server running at http://127.0.0.1:{}", port);

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::from_std(std_listener) {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[AudioServer] Failed to convert to Tokio TcpListener: {}", e);
                return;
            }
        };

        while let Ok((mut socket, _)) = listener.accept().await {
            tauri::async_runtime::spawn(async move {
                let mut buf = [0u8; 8192];
                let n = match socket.read(&mut buf).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };

                let req_str = String::from_utf8_lossy(&buf[..n]);
                let first_line = req_str.lines().next().unwrap_or("");
                let mut parts = first_line.split_whitespace();
                let method = parts.next().unwrap_or("GET");
                let uri = parts.next().unwrap_or("/");

                if method == "OPTIONS" {
                    let resp = "HTTP/1.1 200 OK\r\n\
                                Access-Control-Allow-Origin: *\r\n\
                                Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
                                Access-Control-Allow-Headers: Range, Origin, Content-Type, Accept\r\n\
                                Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
                                Content-Length: 0\r\n\r\n";
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // Parse query params (?path=...)
                let query = uri.split_once('?').map(|x| x.1).unwrap_or("");
                let mut file_path_str = String::new();
                for param in query.split('&') {
                    if let Some(val) = param.strip_prefix("path=") {
                        file_path_str = urlencoding::decode(val)
                            .unwrap_or_else(|_| val.into())
                            .to_string();
                        break;
                    }
                }

                if file_path_str.is_empty() || !std::path::Path::new(&file_path_str).exists() {
                    let resp = "HTTP/1.1 404 Not Found\r\n\
                                Access-Control-Allow-Origin: *\r\n\
                                Content-Length: 0\r\n\r\n";
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                let mut file = match tokio::fs::File::open(&file_path_str).await {
                    Ok(f) => f,
                    Err(_) => {
                        let resp = "HTTP/1.1 500 Internal Error\r\n\
                                    Access-Control-Allow-Origin: *\r\n\
                                    Content-Length: 0\r\n\r\n";
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                };

                let meta = match file.metadata().await {
                    Ok(m) => m,
                    Err(_) => return,
                };
                let total_len = meta.len();

                let ext = std::path::Path::new(&file_path_str)
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();

                let mime = match ext.as_str() {
                    "flac" => "audio/flac",
                    "mp3" => "audio/mpeg",
                    "wav" => "audio/wav",
                    "ogg" => "audio/ogg",
                    "m4a" => "audio/mp4",
                    "aac" => "audio/aac",
                    "opus" => "audio/opus",
                    "wma" => "audio/x-ms-wma",
                    "alac" => "audio/mp4",
                    "aiff" => "audio/aiff",
                    _ => "application/octet-stream",
                };

                if method == "HEAD" {
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\n\
                         Content-Type: {}\r\n\
                         Content-Length: {}\r\n\
                         Accept-Ranges: bytes\r\n\
                         Access-Control-Allow-Origin: *\r\n\
                         Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\r\n",
                        mime, total_len
                    );
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // Find Range header
                let mut range_val = None;
                for line in req_str.lines() {
                    if line.to_ascii_lowercase().starts_with("range:") {
                        range_val = line.split_once(':').map(|x| x.1.trim().to_string());
                        break;
                    }
                }

                if let Some(r) = range_val {
                    if let Some(range_spec) = r.strip_prefix("bytes=") {
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
                        let header = format!(
                            "HTTP/1.1 206 Partial Content\r\n\
                             Content-Type: {}\r\n\
                             Content-Range: bytes {}-{}/{}\r\n\
                             Content-Length: {}\r\n\
                             Accept-Ranges: bytes\r\n\
                             Access-Control-Allow-Origin: *\r\n\
                             Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\r\n",
                            mime, start, end, total_len, chunk_len
                        );

                        if socket.write_all(header.as_bytes()).await.is_ok() {
                            let _ = file.seek(SeekFrom::Start(start)).await;
                            let mut stream = AsyncReadExt::take(file, chunk_len);
                            let _ = tokio::io::copy(&mut stream, &mut socket).await;
                        }
                        return;
                    }
                }

                let header = format!(
                    "HTTP/1.1 200 OK\r\n\
                     Content-Type: {}\r\n\
                     Content-Length: {}\r\n\
                     Accept-Ranges: bytes\r\n\
                     Access-Control-Allow-Origin: *\r\n\
                     Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\r\n",
                    mime, total_len
                );

                if socket.write_all(header.as_bytes()).await.is_ok() {
                    let _ = tokio::io::copy(&mut file, &mut socket).await;
                }
            });
        }
    });

    port
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_server_start() {
        let port = start_audio_server();
        assert!(port > 0);
        assert_eq!(get_server_port(), port);
    }
}
