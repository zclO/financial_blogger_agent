use tauri::AppHandle;

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

        // X/Twitter has a 280 character limit for tweets
        // If content is too long, truncate and append link
        let tweet_text = truncate_for_twitter(&req.text, req.title.as_deref());

        let client = reqwest::blocking::Client::new();
        let url = "https://api.twitter.com/2/tweets";

        let body = serde_json::json!({
            "text": tweet_text,
        });

        // If there's a video URL (non-local), include it in the tweet
        // Note: actual video upload requires chunked upload which is more complex
        // For now, we include the URL in the text content

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
        let body_text = resp
            .text()
            .map_err(|e| format!("读取 X API 响应失败: {}", e))?;

        if status.is_success() {
            Ok(PublishResult {
                platform: "x_twitter".to_string(),
                success: true,
                message: format!("推文已发送成功 (HTTP {})", status),
            })
        } else {
            Err(format!("X API 返回错误 (HTTP {}): {}", status, body_text))
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

    if text.len() <= MAX_LEN {
        return text.to_string();
    }

    // Reserve space for truncation indicator and potential link
    let reserved = title.map_or(30, |_| 60);
    let cutoff = MAX_LEN.saturating_sub(reserved);

    let truncated = if cutoff < text.len() {
        format!("{}...", &text[..cutoff])
    } else {
        text.to_string()
    };

    // If title is provided, prepend it
    match title {
        Some(t) if !t.is_empty() => format!("{}\n\n{}", t, truncated),
        _ => truncated,
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
    _body: &str,
) -> Result<String, String> {
    use base64::Engine;
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

    // Collect all parameters for signature base string
    let mut all_params: Vec<(&str, &str)> = oauth_params
        .iter()
        .map(|(k, v)| (*k, v.as_str()))
        .collect();

    // For POST with JSON body, we don't include body params in signature
    // (only form-encoded bodies are included)

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
