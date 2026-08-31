use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::http::build_http_client;

// ── Types ──

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewsSourceDto {
    pub id: String,
    pub name: String,
    pub category: String,
    pub url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewsArticle {
    pub id: String,
    pub title: String,
    pub link: String,
    pub summary: String,
    pub source_id: String,
    pub source_name: String,
    pub published_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewsFetchResult {
    pub source: NewsSourceDto,
    pub articles: Vec<NewsArticle>,
    pub error: Option<String>,
}

// ── Default sources ──

fn default_news_sources() -> Vec<NewsSourceDto> {
    vec![
        // Crypto Media
        NewsSourceDto { id: "coindesk".into(), name: "CoinDesk".into(), category: "加密货币".into(), url: "https://www.coindesk.com/arc/outboundfeeds/rss/".into() },
        NewsSourceDto { id: "cointelegraph".into(), name: "Cointelegraph".into(), category: "加密货币".into(), url: "https://cointelegraph.com/rss".into() },
        NewsSourceDto { id: "cryptoslate".into(), name: "CryptoSlate".into(), category: "加密货币".into(), url: "https://cryptoslate.com/feed/".into() },
        NewsSourceDto { id: "decrypt".into(), name: "Decrypt".into(), category: "加密货币".into(), url: "https://decrypt.co/feed".into() },
        NewsSourceDto { id: "bitcoin-magazine".into(), name: "Bitcoin Magazine".into(), category: "加密货币".into(), url: "https://bitcoinmagazine.com/.rss/full/".into() },
        // Government & Regulatory
        NewsSourceDto { id: "sec".into(), name: "SEC".into(), category: "政府监管".into(), url: "https://www.sec.gov/news/pressreleases.rss".into() },
        NewsSourceDto { id: "fed".into(), name: "Federal Reserve".into(), category: "政府监管".into(), url: "https://www.federalreserve.gov/feeds/press_all.xml".into() },
        NewsSourceDto { id: "federal-register".into(), name: "Federal Register (Crypto)".into(), category: "政府监管".into(), url: "https://www.federalregister.gov/api/v1/documents.rss?conditions[term]=crypto&per_page=20".into() },
    ]
}

#[tauri::command]
pub fn get_default_news_sources() -> Vec<NewsSourceDto> {
    default_news_sources()
}

// ── Feed parsing helpers ──

fn extract_text(t: &feed_rs::model::Text) -> String {
    t.content.clone()
}

/// Strip HTML tags and decode common entities from RSS content.
fn strip_html(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut in_tag = false;
    for c in input.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }
    // Decode common HTML entities
    result
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .trim()
        .to_string()
}

fn map_entry_to_article(
    entry: &feed_rs::model::Entry,
    source: &NewsSourceDto,
    index: usize,
) -> NewsArticle {
    let title = entry
        .title
        .as_ref()
        .map(|t| strip_html(&extract_text(t)))
        .unwrap_or_default();

    let link = entry
        .links
        .first()
        .map(|l| l.href.clone())
        .unwrap_or_default();

    // Try summary first, then content body, then media descriptions
    let raw_summary = entry
        .summary
        .as_ref()
        .map(|s| extract_text(s))
        .or_else(|| entry.content.as_ref().and_then(|c| c.body.clone()))
        .unwrap_or_default();

    let summary = strip_html(&raw_summary);

    // Truncate to ~500 chars for readability
    let summary = if summary.len() > 500 {
        format!("{}...", &summary[..500])
    } else {
        summary
    };

    let published_at = entry.published.or(entry.updated).map(|dt| dt.to_rfc3339());

    NewsArticle {
        id: format!("{}-{}", source.id, index),
        title,
        link,
        summary,
        source_id: source.id.clone(),
        source_name: source.name.clone(),
        published_at,
    }
}

// ── Tauri command ──

#[tauri::command]
pub async fn fetch_news(
    app: AppHandle,
    sources: Vec<NewsSourceDto>,
) -> Result<Vec<NewsFetchResult>, String> {
    let client = build_http_client(&app)?;
    let mut results = Vec::new();

    for source in sources {
        let result = async {
            let resp = client
                .get(&source.url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                .header("Accept", "application/rss+xml, application/xml, text/xml, */*")
                .send()
                .await
                .map_err(|e| format!("网络请求失败: {}", e))?;

            let status = resp.status();
            let bytes = resp
                .bytes()
                .await
                .map_err(|e| format!("读取响应失败: {}", e))?;

            // Some servers (e.g. Federal Register) return 403 but still include
            // valid RSS content in the body. Try parsing first; only report HTTP
            // status if parsing also fails.
            match feed_rs::parser::parse(std::io::Cursor::new(&bytes)) {
                Ok(feed) => {
                    let articles: Vec<NewsArticle> = feed
                        .entries
                        .iter()
                        .enumerate()
                        .map(|(i, e)| map_entry_to_article(e, &source, i))
                        .collect();
                    Ok(articles)
                }
                Err(parse_err) => {
                    if !status.is_success() {
                        Err(format!("HTTP 状态码: {}", status))
                    } else {
                        Err(format!("RSS 解析失败: {}", parse_err))
                    }
                }
            }
        }
        .await;

        match result {
            Ok(articles) => results.push(NewsFetchResult {
                source,
                articles,
                error: None,
            }),
            Err(err) => results.push(NewsFetchResult {
                source,
                articles: vec![],
                error: Some(err),
            }),
        }
    }

    Ok(results)
}
