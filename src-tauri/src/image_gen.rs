use serde::{Deserialize, Serialize};
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
                msg.push_str("\n  2. 网络 / 代理是否可达");
                msg.push_str(&format!("\n  目标: {}", endpoint));
            } else {
                msg.push_str("Cloudflare 图片生成请求发送失败。");
            }
            msg.push_str(&format!("\n原始错误: {}", e));
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
