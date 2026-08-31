use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleLogEntry {
    pub id: String,
    pub topic_id: u64,
    pub topic_title: String,
    pub timestamp: String,
    pub status: String,
    pub logs: Vec<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArticleLogStore {
    pub entries: Vec<ArticleLogEntry>,
}

// ── File path ──

fn article_log_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("article_logs.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_article_log_store(app: AppHandle) -> Result<ArticleLogStore, String> {
    let p = article_log_store_file(&app)?;
    if !p.exists() {
        return Ok(ArticleLogStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_article_log_store(app: AppHandle, store: ArticleLogStore) -> Result<(), String> {
    fs::write(
        article_log_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
