use serde::{Deserialize, Serialize};
use std::error::Error as StdError;
use tauri::AppHandle;

use crate::http::build_http_client_with_timeout;

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
    // LLM generation can take 30-120s for large content; use 120s timeout
    let client = build_http_client_with_timeout(&app, std::time::Duration::from_secs(120))?;

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
        .map_err(|e| {
            // Provide detailed diagnostic info
            let mut msg = String::new();
            if e.is_timeout() {
                msg.push_str("请求超时（120 秒），请检查网络连通性或模型服务状态。");
            } else if e.is_connect() {
                msg.push_str("无法建立连接，请检查：");
                msg.push_str("\n  1. 目标地址是否可达（DNS / 防火墙 / 代理）");
                msg.push_str(&format!("\n  目标: {}", request.api_endpoint));
            } else if e.is_redirect() {
                msg.push_str("重定向次数过多。");
            } else if e.is_request() {
                msg.push_str("请求构建失败，请检查 API 端点格式。");
            } else {
                msg.push_str("请求发送失败。");
            }
            // Append the full error chain
            msg.push_str(&format!("\n原始错误: {}", e));
            let mut source = StdError::source(&e);
            while let Some(cause) = source {
                msg.push_str(&format!("\n  → {}", cause));
                source = StdError::source(cause);
            }
            msg
        })?;

    let status = resp.status();
    let raw_body = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!(
            "LLM API 返回错误 (HTTP {}): {}",
            status, raw_body
        ));
    }

    let chat_resp: ChatResponse = serde_json::from_str(&raw_body)
        .map_err(|e| format!("解析 LLM 响应失败: {}\n原始响应: {}", e, raw_body))?;

    let content = chat_resp
        .choices
        .first()
        .and_then(|c| c.message.content.as_deref())
        .unwrap_or("")
        .to_string();

    if content.is_empty() {
        let choices_count = chat_resp.choices.len();
        let has_null_content = chat_resp.choices.first()
            .map(|c| c.message.content.is_none())
            .unwrap_or(false);
        let mut detail = format!("LLM API 返回内容为空（choices 数量: {}）", choices_count);
        if choices_count == 0 {
            detail.push_str("\nAPI 未返回任何候选结果，请检查模型名称和提示词。");
        } else if has_null_content {
            detail.push_str("\n模型返回了 null 内容，可能原因：");
            detail.push_str("\n  - 提示词触发了内容安全过滤");
            detail.push_str("\n  - 模型不支持的请求格式");
        }
        detail.push_str(&format!("\n原始响应: {}", raw_body));
        return Err(detail);
    }

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
