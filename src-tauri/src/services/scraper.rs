use crate::models::LrcSearchResult;
use reqwest::Client;

pub async fn search_lrc(query: &str) -> Result<Vec<LrcSearchResult>, String> {
    let client = Client::new();
    let url = format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(query)
    );
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let results: Vec<LrcSearchResult> = res.json().await.map_err(|e| e.to_string())?;
    Ok(results)
}
