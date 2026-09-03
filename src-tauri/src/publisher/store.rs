use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCredentials {
    pub platform: String,
    pub enabled: bool,
    pub credentials: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlatformStore {
    pub platforms: Vec<PlatformCredentials>,
}

// ── File path ──

fn platform_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("platforms.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_platform_store(app: AppHandle) -> Result<PlatformStore, String> {
    let p = platform_store_file(&app)?;
    if !p.exists() {
        return Ok(PlatformStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_platform_store(app: AppHandle, store: PlatformStore) -> Result<(), String> {
    fs::write(
        platform_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
