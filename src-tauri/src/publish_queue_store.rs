use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueueEntry {
    pub id: String,
    pub title: String,
    pub body: String,
    pub final_body: String,
    pub publish_type: String,
    pub video_source_type: String,
    pub video_url: String,
    pub video_file_path: String,
    pub symbols: Vec<String>,
    pub source_name: String,
    pub status: String,
    pub created_at: String,
    pub sent_at: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PublishQueueStore {
    pub entries: Vec<QueueEntry>,
}

// ── File path ──

fn publish_queue_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("publish_queue.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_publish_queue(app: AppHandle) -> Result<PublishQueueStore, String> {
    let p = publish_queue_store_file(&app)?;
    if !p.exists() {
        return Ok(PublishQueueStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_publish_queue(app: AppHandle, store: PublishQueueStore) -> Result<(), String> {
    fs::write(
        publish_queue_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
