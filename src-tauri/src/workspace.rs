use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
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

fn workspace_file(app: &AppHandle) -> Result<PathBuf, String> {
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
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
pub fn load_workspace(app: AppHandle) -> Result<Workspace, String> {
    let p = workspace_file(&app)?;
    if !p.exists() {
        return Ok(seed());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_workspace(app: AppHandle, workspace: Workspace) -> Result<(), String> {
    fs::write(
        workspace_file(&app)?,
        serde_json::to_vec_pretty(&workspace).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
