use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedImage {
    pub base64: String,
    pub mime: String,
    pub name: String,
}

#[tauri::command]
pub fn pick_image_file(app: AppHandle) -> Result<Option<PickedImage>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("Image", &["png", "jpg", "jpeg", "webp", "gif"])
        .blocking_pick_file();

    let path = match file {
        Some(p) => p,
        None => return Ok(None),
    };

    let path_buf = PathBuf::from(path.as_path().ok_or("invalid path")?);
    let data = fs::read(&path_buf).map_err(|e| e.to_string())?;
    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".into());

    let ext = path_buf
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);

    Ok(Some(PickedImage {
        base64: b64,
        mime: mime.into(),
        name,
    }))
}
