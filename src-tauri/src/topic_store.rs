use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredTopic {
    pub id: u64,
    pub title: String,
    pub source: String,
    pub verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TopicStore {
    pub topics: Vec<StoredTopic>,
    /// Titles already imported — used for cross-session deduplication.
    pub seen_titles: Vec<String>,
}

// ── File path ──

fn topic_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("topics.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_topic_store(app: AppHandle) -> Result<TopicStore, String> {
    let p = topic_store_file(&app)?;
    if !p.exists() {
        return Ok(TopicStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_topic_store(app: AppHandle, store: TopicStore) -> Result<(), String> {
    fs::write(
        topic_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
