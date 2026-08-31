use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::http::build_http_client;

// ── Types ──

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    pub api_endpoint: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub temperature: f64,
    pub max_tokens: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub content: String,
    pub model: String,
    pub usage: Option<LlmUsage>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

// ── OpenAI-compatible API request/response ──

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: Option<RawUsage>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Deserialize)]
struct ChatResponseMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct RawUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

// ── Tauri command ──

#[tauri::command]
pub async fn call_llm(app: AppHandle, request: LlmRequest) -> Result<LlmResponse, String> {
    let client = build_http_client(&app)?;

    let body = ChatRequest {
        model: &request.model,
        messages: vec![
            ChatMessage {
                role: "system",
                content: &request.system_prompt,
            },
            ChatMessage {
                role: "user",
                content: &request.user_prompt,
            },
        ],
        temperature: request.temperature,
        max_tokens: request.max_tokens,
    };

    let resp = client
        .post(&request.api_endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", request.api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM API 请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let error_body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "LLM API 返回错误 (HTTP {}): {}",
            status, error_body
        ));
    }

    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析 LLM 响应失败: {}", e))?;

    let content = chat_resp
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .unwrap_or("")
        .to_string();

    let model = request.model.clone();
    let usage = chat_resp.usage.map(|u| LlmUsage {
        prompt_tokens: u.prompt_tokens,
        completion_tokens: u.completion_tokens,
        total_tokens: u.total_tokens,
    });

    Ok(LlmResponse {
        content,
        model,
        usage,
    })
}
