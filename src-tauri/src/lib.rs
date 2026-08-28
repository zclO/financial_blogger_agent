use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, process::Command};
use tauri::{AppHandle, Manager};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Topic {
    pub id: String,
    pub title: String,
    pub source: String,
    pub verified: bool,
}
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub topic_id: String,
    pub title: String,
    pub body: String,
    pub reviewed: bool,
    pub queued: bool,
}
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub topics: Vec<Topic>,
    pub drafts: Vec<Draft>,
}
fn file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("workspace.json"))
}
fn seed() -> Workspace {
    Workspace {
        topics: vec![
            Topic {
                id: "eth-upgrade".into(),
                title: "以太坊生态升级官方公告".into(),
                source: "项目官方 API（示例）".into(),
                verified: true,
            },
            Topic {
                id: "btc-etf".into(),
                title: "BTC ETF 日度资金数据待核验".into(),
                source: "授权行情源（示例）".into(),
                verified: false,
            },
        ],
        drafts: vec![],
    }
}
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    }
}
#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Workspace, String> {
    let p = file(&app)?;
    if !p.exists() {
        return Ok(seed());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
#[tauri::command]
fn save_workspace(app: AppHandle, workspace: Workspace) -> Result<(), String> {
    fs::write(
        file(&app)?,
        serde_json::to_vec_pretty(&workspace).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
fn get_binance_square_config() -> serde_json::Value {
    serde_json::json!({"enabled":false,"keyConfigured":std::env::var("BINANCE_SQUARE_OPENAPI_KEY").is_ok(),"creatorCenterUrl":"https://www.binance.com/square/creator-center/home"})
}
fn square_dir() -> Result<PathBuf, String> {
    std::env::var("BINANCE_SQUARE_SKILL_DIR")
        .map(PathBuf::from)
        .map_err(|_| "请设置 BINANCE_SQUARE_SKILL_DIR 为 square-post 目录".into())
}
fn square(script: &str, args: &[&str], key: Option<&str>) -> Result<String, String> {
    let dir = square_dir()?;
    let mut cmd = Command::new("node");
    cmd.arg(dir.join("scripts").join(script))
        .args(args)
        .current_dir(dir);
    if let Some(k) = key {
        cmd.env("BINANCE_SQUARE_OPENAPI_KEY", k);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    let result = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    if out.status.success() {
        Ok(result)
    } else {
        Err(result)
    }
}
#[tauri::command]
fn configure_binance_square(api_key: String) -> Result<String, String> {
    square("save-key.mjs", &[], Some(&api_key))
}
#[tauri::command]
fn publish_binance_square_text(title: Option<String>, text: String) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("正文不能为空".into());
    }
    let mut a = vec!["--text", text.as_str()];
    if let Some(t) = title.as_deref() {
        if !t.trim().is_empty() {
            a.extend(["--title", t]);
        }
    }
    square("post-text.mjs", &a, None)
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_workspace,
            save_workspace,
            get_binance_square_config,
            configure_binance_square,
            publish_binance_square_text
        ])
        .run(tauri::generate_context!())
        .expect("error while running Financial Blogger Agent");
}
