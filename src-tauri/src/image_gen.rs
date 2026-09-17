use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::error::Error as _;
use tauri::AppHandle;

use crate::http::build_http_client_with_timeout;

// ── Types ──

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenRequest {
    pub api_key: String,
    /// Optional custom API endpoint; defaults to Stability AI Core if empty.
    #[serde(default)]
    pub api_endpoint: String,
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: String,
    #[serde(default = "default_output_format")]
    pub output_format: String,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
}

fn default_output_format() -> String {
    "png".to_string()
}

fn default_width() -> u32 {
    1024
}

fn default_height() -> u32 {
    1024
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenResponse {
    /// Base64-encoded image data
    pub image_base64: String,
    /// File name hint (e.g. "generated-image.png")
    pub file_name: String,
    /// MIME type
    pub mime_type: String,
}

// ── Tauri command ──

#[tauri::command]
pub async fn generate_image(app: AppHandle, request: ImageGenRequest) -> Result<ImageGenResponse, String> {
    // Image generation can take 30-60s; use 90s timeout
    let client = build_http_client_with_timeout(&app, std::time::Duration::from_secs(90))?;

    let endpoint = if request.api_endpoint.trim().is_empty() {
        "https://api.stability.ai/v2beta/stable-image/generate/core"
    } else {
        &request.api_endpoint
    };

    // Build multipart form
    let form = reqwest::multipart::Form::new()
        .text("prompt", request.prompt.clone())
        .text("output_format", request.output_format.clone())
        // Stability API requires a dummy file part
        .part(
            "none",
            reqwest::multipart::Part::bytes(b"" as &[u8])
                .file_name("")
                .mime_str("application/octet-stream")
                .map_err(|e| format!("构建请求失败: {}", e))?,
        );

    // Add optional negative prompt
    let form = if !request.negative_prompt.trim().is_empty() {
        form.text("negative_prompt", request.negative_prompt.clone())
    } else {
        form
    };

    // Add dimensions
    let form = form
        .text("width", request.width.to_string())
        .text("height", request.height.to_string());

    let resp = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", request.api_key))
        .header("Accept", "image/*")
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            let mut msg = String::new();
            if e.is_timeout() {
                msg.push_str("图片生成请求超时（90 秒），请检查网络或稍后重试。");
            } else if e.is_connect() {
                msg.push_str("无法连接到图片生成服务，请检查：");
                msg.push_str("\n  1. 目标地址是否可达");
                msg.push_str(&format!("\n  目标: {}", endpoint));
            } else {
                msg.push_str("图片生成请求发送失败。");
            }
            msg.push_str(&format!("\n原始错误: {}", e));
            msg
        })?;

    let status = resp.status();

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "图片生成 API 返回错误 (HTTP {}): {}",
            status, body
        ));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let bytes = resp.bytes().await.map_err(|e| {
        format!("读取图片响应失败: {}", e)
    })?;

    if bytes.is_empty() {
        return Err("图片生成 API 返回空数据".to_string());
    }

    use base64::Engine;
    let image_base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let ext = request.output_format.trim().to_lowercase();
    let mime = if content_type.starts_with("image/") {
        content_type
    } else {
        format!("image/{}", if ext.is_empty() { "png" } else { &ext })
    };
    let file_name = format!("generated-image.{}", if ext.is_empty() { "png" } else { &ext });

    Ok(ImageGenResponse {
        image_base64,
        file_name,
        mime_type: mime,
    })
}

// ══════════════════════════════════════════════════════════════
// Cloudflare Workers AI — FLUX 文生图
// ══════════════════════════════════════════════════════════════

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenCfRequest {
    pub api_token: String,
    /// Full Cloudflare Workers AI endpoint URL, e.g.
    /// `https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/@cf/black-forest-labs/flux-2-dev`
    pub api_endpoint: String,
    pub prompt: String,
    #[serde(default = "default_steps")]
    pub steps: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
}

fn default_steps() -> u32 {
    25
}

// ── Cloudflare response wrapper ──

#[derive(Deserialize)]
struct CfResponse {
    success: bool,
    errors: Option<Vec<CfError>>,
    result: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct CfError {
    message: String,
}

#[tauri::command]
pub async fn generate_image_cf(
    app: AppHandle,
    request: ImageGenCfRequest,
) -> Result<ImageGenResponse, String> {
    let client = build_http_client_with_timeout(&app, std::time::Duration::from_secs(120))?;

    let endpoint = request.api_endpoint.trim();
    if endpoint.is_empty() {
        return Err("Cloudflare API 端点不能为空，请填写完整的 Workers AI URL。".to_string());
    }

    // Build multipart form — Cloudflare Workers AI expects: prompt, steps, width, height
    let form = reqwest::multipart::Form::new()
        .text("prompt", request.prompt.clone())
        .text("steps", request.steps.to_string())
        .text("width", request.width.to_string())
        .text("height", request.height.to_string());

    let resp = client
        .post(endpoint)
        .header("Authorization", format!("Bearer {}", request.api_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            let mut msg = String::new();
            if e.is_timeout() {
                msg.push_str("Cloudflare 图片生成请求超时（120 秒），请检查网络或稍后重试。");
            } else if e.is_connect() {
                msg.push_str("无法连接到 Cloudflare Workers AI 服务，请检查：");
                msg.push_str("\n  1. API 端点 URL 是否正确");
                msg.push_str("\n  2. 网络 / 代理是否可达（当前依赖系统代理设置）");
                msg.push_str(&format!("\n  目标: {}", endpoint));
            } else {
                msg.push_str("Cloudflare 图片生成请求发送失败。");
            }
            // Walk the error source chain for deeper diagnostics
            msg.push_str(&format!("\n原始错误: {}", e));
            let mut src: Option<&(dyn std::error::Error + 'static)> = e.source();
            let mut depth = 0;
            while let Some(cause) = src {
                depth += 1;
                msg.push_str(&format!("\n  原因 {}: {}", depth, cause));
                if depth >= 5 { break; }
                src = cause.source();
            }
            msg
        })?;

    let status = resp.status();

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Cloudflare Workers AI 返回错误 (HTTP {}): {}",
            status, body
        ));
    }

    // Cloudflare returns JSON: { success, errors, result }
    // `result` can be a base64 string or a nested object with image data.
    let body = resp.text().await.map_err(|e| {
        format!("读取 Cloudflare 响应失败: {}", e)
    })?;

    let cf_resp: CfResponse = serde_json::from_str(&body)
        .map_err(|e| format!("解析 Cloudflare 响应失败: {}\n原始响应: {}", e, &body[..body.len().min(500)]))?;

    if !cf_resp.success {
        let err_msgs: Vec<String> = cf_resp
            .errors
            .unwrap_or_default()
            .iter()
            .map(|e| e.message.clone())
            .collect();
        return Err(format!(
            "Cloudflare Workers AI 返回错误: {}",
            if err_msgs.is_empty() { "未知错误".to_string() } else { err_msgs.join("; ") }
        ));
    }

    // Extract image bytes from result
    let result_val = cf_resp.result.ok_or("Cloudflare 响应中缺少 result 字段")?;

    let image_bytes: Vec<u8> = if let Some(b64_str) = result_val.as_str() {
        // result is a base64-encoded string
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(b64_str.as_bytes())
            .map_err(|e| format!("解码 base64 图片数据失败: {}", e))?
    } else if let Some(obj) = result_val.as_object() {
        // result is an object — look for "image" field (base64 string)
        if let Some(img_b64) = obj.get("image").and_then(|v| v.as_str()) {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD
                .decode(img_b64.as_bytes())
                .map_err(|e| format!("解码 base64 图片数据失败: {}", e))?
        } else {
            return Err(format!("Cloudflare result 对象中未找到 image 字段，实际键: {:?}", obj.keys().collect::<Vec<_>>()));
        }
    } else {
        return Err("Cloudflare result 字段格式不受支持，期望 base64 字符串或包含 image 字段的对象".to_string());
    };

    if image_bytes.is_empty() {
        return Err("Cloudflare Workers AI 返回了空图片数据".to_string());
    }

    use base64::Engine;
    let image_base64 = base64::engine::general_purpose::STANDARD.encode(&image_bytes);

    Ok(ImageGenResponse {
        image_base64,
        file_name: "generated-image.png".to_string(),
        mime_type: "image/png".to_string(),
    })
}

// ══════════════════════════════════════════════════════════════
// Tencent Cloud Hunyuan — 文生图轻量版 (TextToImageLite)
// ══════════════════════════════════════════════════════════════

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenTxRequest {
    pub secret_id: String,
    pub secret_key: String,
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: String,
    #[serde(default)]
    pub style: String,
    #[serde(default = "default_tx_resolution")]
    pub resolution: String,
    #[serde(default = "default_tx_logo_add")]
    pub logo_add: i32,
}

fn default_tx_resolution() -> String {
    "768:768".to_string()
}

fn default_tx_logo_add() -> i32 {
    0
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

#[tauri::command]
pub async fn generate_image_tx(
    app: AppHandle,
    request: ImageGenTxRequest,
) -> Result<ImageGenResponse, String> {
    let client = build_http_client_with_timeout(&app, std::time::Duration::from_secs(120))?;

    let host = "hunyuan.tencentcloudapi.com";
    let service = "hunyuan";
    let action = "TextToImageLite";
    let version = "2023-09-01";
    let region = "ap-guangzhou";

    // Current UTC timestamp
    let now = chrono::Utc::now();
    let timestamp = now.timestamp();
    let date = now.format("%Y-%m-%d").to_string();

    // ── Build request body ──
    let mut body = serde_json::Map::new();
    body.insert(
        "Prompt".to_string(),
        serde_json::Value::String(request.prompt.clone()),
    );
    if !request.negative_prompt.trim().is_empty() {
        body.insert(
            "NegativePrompt".to_string(),
            serde_json::Value::String(request.negative_prompt.clone()),
        );
    }
    if !request.style.trim().is_empty() {
        body.insert(
            "Style".to_string(),
            serde_json::Value::String(request.style.clone()),
        );
    }
    if !request.resolution.trim().is_empty() {
        body.insert(
            "Resolution".to_string(),
            serde_json::Value::String(request.resolution.clone()),
        );
    }
    body.insert(
        "LogoAdd".to_string(),
        serde_json::Value::Number(request.logo_add.into()),
    );
    body.insert(
        "RspImgType".to_string(),
        serde_json::Value::String("base64".to_string()),
    );

    let payload = serde_json::to_string(&body).map_err(|e| format!("序列化请求失败: {}", e))?;
    let hashed_payload = sha256_hex(payload.as_bytes());

    // ── Step 1: Canonical request ──
    let canonical_headers = format!(
        "content-type:application/json; charset=utf-8\nhost:{}\nx-tc-action:{}\n",
        host,
        action.to_lowercase()
    );
    let signed_headers = "content-type;host;x-tc-action";
    let canonical_request = format!(
        "POST\n/\n\n{}\n{}\n{}",
        canonical_headers, signed_headers, hashed_payload
    );

    // ── Step 2: String to sign ──
    let credential_scope = format!("{}/{}/tc3_request", date, service);
    let hashed_canonical = sha256_hex(canonical_request.as_bytes());
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{}\n{}\n{}",
        timestamp, credential_scope, hashed_canonical
    );

    // ── Step 3: Signing key ──
    let secret_date = hmac_sha256(format!("TC3{}", request.secret_key).as_bytes(), date.as_bytes());
    let secret_service = hmac_sha256(&secret_date, service.as_bytes());
    let secret_signing = hmac_sha256(&secret_service, b"tc3_request");

    // ── Step 4: Signature ──
    let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

    // ── Step 5: Authorization ──
    let authorization = format!(
        "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
        request.secret_id, credential_scope, signed_headers, signature
    );

    // ── Send request ──
    let url = format!("https://{}", host);
    let resp = client
        .post(&url)
        .header("Authorization", &authorization)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Host", host)
        .header("X-TC-Action", action)
        .header("X-TC-Version", version)
        .header("X-TC-Region", region)
        .header("X-TC-Timestamp", timestamp.to_string())
        .body(payload)
        .send()
        .await
        .map_err(|e| {
            let mut msg = String::new();
            if e.is_timeout() {
                msg.push_str("腾讯云文生图请求超时（120 秒），请检查网络或稍后重试。");
            } else if e.is_connect() {
                msg.push_str("无法连接到腾讯云混元服务，请检查：");
                msg.push_str("\n  1. 网络 / 代理是否可达");
                msg.push_str(&format!("\n  目标: {}", url));
            } else {
                msg.push_str("腾讯云文生图请求发送失败。");
            }
            msg.push_str(&format!("\n原始错误: {}", e));
            msg
        })?;

    let status = resp.status();
    let body_text = resp.text().await.map_err(|e| {
        format!("读取腾讯云响应失败: {}", e)
    })?;

    if !status.is_success() {
        return Err(format!(
            "腾讯云文生图 API 返回错误 (HTTP {}): {}",
            status, body_text
        ));
    }

    // ── Parse response ──
    let resp_json: serde_json::Value = serde_json::from_str(&body_text).map_err(|e| {
        format!("解析腾讯云响应失败: {}\n原始响应: {}", e, &body_text[..body_text.len().min(500)])
    })?;

    let response_obj = resp_json
        .get("Response")
        .ok_or("腾讯云响应中缺少 Response 字段")?;

    // Check for error in response
    if let Some(error) = response_obj.get("Error") {
        let code = error.get("Code").and_then(|v| v.as_str()).unwrap_or("Unknown");
        let message = error.get("Message").and_then(|v| v.as_str()).unwrap_or("未知错误");
        return Err(format!("腾讯云文生图错误 [{}]: {}", code, message));
    }

    let result_image = response_obj
        .get("ResultImage")
        .and_then(|v| v.as_str())
        .ok_or("腾讯云响应中缺少 ResultImage 字段")?;

    if result_image.is_empty() {
        return Err("腾讯云文生图返回了空的图片数据".to_string());
    }

    Ok(ImageGenResponse {
        image_base64: result_image.to_string(),
        file_name: "generated-image.png".to_string(),
        mime_type: "image/png".to_string(),
    })
}
