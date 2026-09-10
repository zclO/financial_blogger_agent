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
