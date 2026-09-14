use base64::Engine;
use tauri::AppHandle;

use crate::http::load_proxy_config;

use super::store;
use super::{PublishPlatform, PublishRequest, PublishResult};

pub struct XTwitterPlatform;

impl PublishPlatform for XTwitterPlatform {
    fn name(&self) -> &str {
        "x_twitter"
    }

    fn is_configured(&self, app: &AppHandle) -> bool {
        get_credentials(app).is_ok()
    }

    fn publish(
        &self,
        app: &AppHandle,
        req: &PublishRequest,
    ) -> Result<PublishResult, String> {
        let creds = get_credentials(app)?;

        if req.text.trim().is_empty() {
            return Err("正文不能为空".into());
        }

        let tweet_text = truncate_for_twitter(&req.text, req.title.as_deref());
        let client = build_blocking_client(app)?;
        let mut media_ids: Vec<String> = Vec::new();

        // ── Handle image attachment (from pipeline image generation) ──
        if let Some(ref image_b64) = req.image_base64 {
            if !image_b64.is_empty() {
                let mime = req.image_mime.as_deref().unwrap_or("image/png");
                let media_id = upload_image(
                    app, &client, &creds, image_b64, mime,
                )?;
                media_ids.push(media_id);
            }
        }

        // ── Handle video attachment ──
        if let Some(ref video_path) = req.video_path {
            if !video_path.is_empty()
                && req.content_type == "video"
                && media_ids.is_empty()
            {
                let path = std::path::Path::new(video_path);
                if !path.exists() {
                    return Err("视频文件不存在".into());
                }
                if !path.is_file() {
                    return Err("视频路径不是文件".into());
                }
                let video_data = std::fs::read(video_path)
                    .map_err(|e| format!("读取视频文件失败: {}", e))?;
                let media_id = upload_video(app, &client, &creds, &video_data)?;
                media_ids.push(media_id);
            }
        }
        // Remote video URL: include in tweet text (X API does not support
        // direct remote-URL video embedding; chunked upload requires binary).

        // ── Post tweet ──
        let url = "https://api.twitter.com/2/tweets";
        let body = if media_ids.is_empty() {
            serde_json::json!({ "text": tweet_text })
        } else {
            serde_json::json!({
                "text": tweet_text,
                "media": { "media_ids": media_ids }
            })
        };

        let oauth_header = build_oauth_header(
            &creds.api_key,
            &creds.api_secret,
            &creds.access_token,
            &creds.access_token_secret,
            "POST",
            url,
            &serde_json::to_string(&body).unwrap(),
        )?;

        let resp = client
            .post(url)
            .header("Content-Type", "application/json")
            .header("Authorization", oauth_header)
            .body(serde_json::to_string(&body).unwrap())
            .send()
            .map_err(|e| format!("X API 请求失败: {}", e))?;

        let status = resp.status();
        let resp_text = resp
            .text()
            .map_err(|e| format!("读取 X API 响应失败: {}", e))?;

        if status.is_success() {
            let media_note = if media_ids.is_empty() {
                String::new()
            } else {
                format!("（附带 {} 个媒体）", media_ids.len())
            };
            Ok(PublishResult {
                platform: "x_twitter".to_string(),
                success: true,
                message: format!("推文已发送成功{} (HTTP {})", media_note, status),
            })
        } else {
            Err(format!("X API 返回错误 (HTTP {}): {}", status, resp_text))
        }
    }
}

// ── Credential loading ──

struct XTwitterCredentials {
    api_key: String,
    api_secret: String,
    access_token: String,
    access_token_secret: String,
}

fn get_credentials(app: &AppHandle) -> Result<XTwitterCredentials, String> {
    let platform_store = store::load_platform_store(app.clone())
        .map_err(|e| format!("读取平台配置失败: {}", e))?;

    let platform = platform_store
        .platforms
        .iter()
        .find(|p| p.platform == "x_twitter")
        .ok_or_else(|| "X (Twitter) 平台未配置，请在设置中配置凭证".to_string())?;

    if !platform.enabled {
        return Err("X (Twitter) 平台已禁用".into());
    }

    let api_key = platform
        .credentials
        .get("apiKey")
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "X API Key 未配置".to_string())?
        .clone();
    let api_secret = platform
        .credentials
        .get("apiSecret")
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "X API Secret 未配置".to_string())?
        .clone();
    let access_token = platform
        .credentials
        .get("accessToken")
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "X Access Token 未配置".to_string())?
        .clone();
    let access_token_secret = platform
        .credentials
        .get("accessTokenSecret")
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "X Access Token Secret 未配置".to_string())?
        .clone();

    Ok(XTwitterCredentials {
        api_key,
        api_secret,
        access_token,
        access_token_secret,
    })
}

// ── Tweet text truncation ──

fn truncate_for_twitter(text: &str, title: Option<&str>) -> String {
    const MAX_LEN: usize = 280;

    // Build the full content with optional title prefix
    let title_prefix = title
        .filter(|t| !t.is_empty())
        .map(|t| format!("{}\n\n", t));

    // If the full content already fits, return as-is
    let full = match &title_prefix {
        Some(prefix) => format!("{}{}", prefix, text),
        None => text.to_string(),
    };
    if full.len() <= MAX_LEN {
        return full;
    }

    // Need to truncate — calculate available space for the text portion
    let prefix_len = title_prefix.as_ref().map_or(0, |p| p.len());
    let suffix = "...";
    let available_for_text = MAX_LEN.saturating_sub(prefix_len).saturating_sub(suffix.len());

    if available_for_text == 0 {
        // Title alone fills or exceeds the limit; truncate the title itself
        let title_max = MAX_LEN.saturating_sub(suffix.len());
        let title_text = title.unwrap_or("");
        return format!("{}{}", &title_text[..title_max], suffix);
    }

    let truncated = if text.len() > available_for_text {
        format!("{}{}", &text[..available_for_text], suffix)
    } else {
        text.to_string()
    };

    match &title_prefix {
        Some(prefix) => format!("{}{}", prefix, truncated),
        None => truncated,
    }
}

// ── OAuth 1.0a signing ──

fn build_oauth_header(
    consumer_key: &str,
    consumer_secret: &str,
    access_token: &str,
    access_token_secret: &str,
    method: &str,
    url: &str,
    body: &str,
) -> Result<String, String> {
    use hmac::{Hmac, Mac};
    use sha1::Sha1;

    type HmacSha1 = Hmac<Sha1>;

    // Generate OAuth parameters
    let nonce = generate_nonce();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        .to_string();

    let mut oauth_params = vec![
        ("oauth_consumer_key", consumer_key.to_string()),
        ("oauth_nonce", nonce),
        ("oauth_signature_method", "HMAC-SHA1".to_string()),
        ("oauth_timestamp", timestamp),
        ("oauth_token", access_token.to_string()),
        ("oauth_version", "1.0".to_string()),
    ];

    // Parse URL to get base URL (without query params)
    let parsed_url = url::Url::parse(url).map_err(|e| format!("URL 解析失败: {}", e))?;
    let base_url = format!(
        "{}://{}{}",
        parsed_url.scheme(),
        parsed_url.host_str().unwrap_or(""),
        parsed_url.path()
    );

    // For form-encoded bodies, include params in the OAuth signature.
    // JSON bodies and multipart bodies are NOT included (per RFC 5849).
    let form_params: Vec<(String, String)> = if body.starts_with('{') || body.starts_with('[') {
        Vec::new()
    } else if !body.is_empty() {
        url::form_urlencoded::parse(body.as_bytes())
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    } else {
        Vec::new()
    };

    // Collect all parameters for signature base string
    let mut all_params: Vec<(&str, &str)> = oauth_params
        .iter()
        .map(|(k, v)| (*k, v.as_str()))
        .collect();
    for (k, v) in &form_params {
        all_params.push((k.as_str(), v.as_str()));
    }

    // Sort and encode parameters
    all_params.sort_by(|a, b| a.0.cmp(b.0).then(a.1.cmp(b.1)));
    let param_string = all_params
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    // Create signature base string
    let base_string = format!(
        "{}&{}&{}",
        percent_encode(method),
        percent_encode(&base_url),
        percent_encode(&param_string)
    );

    // Create signing key
    let signing_key = format!(
        "{}&{}",
        percent_encode(consumer_secret),
        percent_encode(access_token_secret)
    );

    // Calculate HMAC-SHA1 signature
    let mut mac = HmacSha1::new_from_slice(signing_key.as_bytes())
        .map_err(|e| format!("HMAC 初始化失败: {}", e))?;
    mac.update(base_string.as_bytes());
    let signature = mac.finalize().into_bytes();
    let signature_b64 = base64::engine::general_purpose::STANDARD.encode(&signature);

    // Add signature to OAuth params
    oauth_params.push(("oauth_signature", signature_b64));

    // Build Authorization header
    let header_value = oauth_params
        .iter()
        .map(|(k, v)| format!("{}=\"{}\"", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join(", ");

    Ok(format!("OAuth {}", header_value))
}

fn generate_nonce() -> String {
    use base64::Engine;
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 24] = rng.gen();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn percent_encode(input: &str) -> String {
    url::form_urlencoded::byte_serialize(input.as_bytes()).collect::<String>()
        .replace('+', "%20")
}

// ── HTTP client with proxy ──

fn build_blocking_client(app: &AppHandle) -> Result<reqwest::blocking::Client, String> {
    let mut builder = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30));
    let proxy = load_proxy_config(app);
    if proxy.enabled {
        if let Some(ref proxy_url) = proxy.proxy_url {
            let px = reqwest::Proxy::all(proxy_url)
                .map_err(|e| format!("代理配置无效: {}", e))?;
            builder = builder.proxy(px);
        }
    }
    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

// ── Media upload: image (single-request multipart) ──

fn upload_image(
    _app: &AppHandle,
    client: &reqwest::blocking::Client,
    creds: &XTwitterCredentials,
    image_b64: &str,
    mime: &str,
) -> Result<String, String> {
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(image_b64)
        .map_err(|e| format!("解码图片 base64 失败: {}", e))?;

    let upload_url = "https://upload.twitter.com/1.1/media/upload.json";
    let mime_type = mime.split(';').next().unwrap_or("image/png");

    let form = reqwest::blocking::multipart::Form::new()
        .part(
            "media",
            reqwest::blocking::multipart::Part::bytes(image_bytes)
                .mime_str(mime_type).map_err(|e| format!("设置 MIME 类型失败: {}", e))?
                .file_name("media"),
        );

    let oauth_header = build_oauth_header(
        &creds.api_key,
        &creds.api_secret,
        &creds.access_token,
        &creds.access_token_secret,
        "POST",
        upload_url,
        "", // multipart body excluded from OAuth signature
    )?;

    let resp = client
        .post(upload_url)
        .header("Authorization", oauth_header)
        .multipart(form)
        .send()
        .map_err(|e| format!("X 图片上传请求失败: {}", e))?;

    let status = resp.status();
    let resp_text = resp
        .text()
        .map_err(|e| format!("读取图片上传响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("X 图片上传失败 (HTTP {}): {}", status, resp_text));
    }

    let json: serde_json::Value =
        serde_json::from_str(&resp_text).map_err(|e| format!("解析上传响应失败: {}", e))?;
    json.get("media_id_string")
        .or_else(|| json.get("media_id"))
        .and_then(|v| v.as_str().map(|s| s.to_string()).or_else(|| v.as_u64().map(|n| n.to_string())))
        .ok_or_else(|| format!("上传响应中无 media_id: {}", resp_text))
}

// ── Media upload: video (chunked: INIT → UPLOAD → FINALIZE) ──

fn upload_video(
    _app: &AppHandle,
    client: &reqwest::blocking::Client,
    creds: &XTwitterCredentials,
    video_data: &[u8],
) -> Result<String, String> {
    let upload_url = "https://upload.twitter.com/1.1/media/upload.json";
    let total_bytes = video_data.len();

    // ── INIT ──
    let init_body = format!(
        "command=INIT&media_type=video%2Fmp4&total_bytes={}&media_category=tweet_video",
        total_bytes
    );
    let init_oauth = build_oauth_header(
        &creds.api_key,
        &creds.api_secret,
        &creds.access_token,
        &creds.access_token_secret,
        "POST",
        upload_url,
        &init_body,
    )?;

    let resp = client
        .post(upload_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Authorization", init_oauth)
        .body(init_body)
        .send()
        .map_err(|e| format!("X 视频 INIT 请求失败: {}", e))?;

    let status = resp.status();
    let resp_text = resp
        .text()
        .map_err(|e| format!("读取 INIT 响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("X 视频 INIT 失败 (HTTP {}): {}", status, resp_text));
    }

    let init_json: serde_json::Value =
        serde_json::from_str(&resp_text).map_err(|e| format!("解析 INIT 响应失败: {}", e))?;
    let media_id = init_json
        .get("media_id_string")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("INIT 响应中无 media_id: {}", resp_text))?
        .to_string();

    // ── UPLOAD (5 MB chunks) ──
    let chunk_size: usize = 5 * 1024 * 1024;
    let mut segment_index = 0;
    let mut offset: usize = 0;

    while offset < total_bytes {
        let end = (offset + chunk_size).min(total_bytes);
        let chunk = &video_data[offset..end];

        let append_body = format!(
            "command=APPEND&media_id={}&segment_index={}",
            media_id, segment_index
        );
        let append_oauth = build_oauth_header(
            &creds.api_key,
            &creds.api_secret,
            &creds.access_token,
            &creds.access_token_secret,
            "POST",
            upload_url,
            &append_body,
        )?;

        let form = reqwest::blocking::multipart::Form::new()
            .text("command", "APPEND")
            .text("media_id", media_id.clone())
            .text("segment_index", segment_index.to_string())
            .part(
                "media",
                reqwest::blocking::multipart::Part::bytes(chunk.to_vec())
                    .mime_str("video/mp4").map_err(|e| format!("设置视频 MIME 失败: {}", e))?
                    .file_name("segment"),
            );

        let resp = client
            .post(upload_url)
            .header("Authorization", append_oauth)
            .multipart(form)
            .send()
            .map_err(|e| format!("X 视频 UPLOAD #{} 请求失败: {}", segment_index, e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().unwrap_or_default();
            return Err(format!(
                "X 视频 UPLOAD #{} 失败 (HTTP {}): {}",
                segment_index, status, err_text
            ));
        }

        offset = end;
        segment_index += 1;
    }

    // ── FINALIZE ──
    let finalize_body = format!("command=FINALIZE&media_id={}", media_id);
    let finalize_oauth = build_oauth_header(
        &creds.api_key,
        &creds.api_secret,
        &creds.access_token,
        &creds.access_token_secret,
        "POST",
        upload_url,
        &finalize_body,
    )?;

    let resp = client
        .post(upload_url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Authorization", finalize_oauth)
        .body(finalize_body)
        .send()
        .map_err(|e| format!("X 视频 FINALIZE 请求失败: {}", e))?;

    let status = resp.status();
    let resp_text = resp
        .text()
        .map_err(|e| format!("读取 FINALIZE 响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!(
            "X 视频 FINALIZE 失败 (HTTP {}): {}",
            status, resp_text
        ));
    }

    let fin_json: serde_json::Value =
        serde_json::from_str(&resp_text).map_err(|e| format!("解析 FINALIZE 响应失败: {}", e))?;
    fin_json
        .get("media_id_string")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("FINALIZE 响应中无 media_id: {}", resp_text))
}
