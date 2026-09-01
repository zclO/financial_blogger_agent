use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

use crate::news::NewsSourceDto;

// ── Types ──

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NewsSourceStore {
    /// User-customised news sources (replaces defaults when non-empty).
    pub sources: Vec<NewsSourceDto>,
}

// ── File path ──

fn news_source_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("news_sources.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_news_source_store(app: AppHandle) -> Result<NewsSourceStore, String> {
    let p = news_source_store_file(&app)?;
    if !p.exists() {
        return Ok(NewsSourceStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_news_source_store(app: AppHandle, store: NewsSourceStore) -> Result<(), String> {
    fs::write(
        news_source_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
