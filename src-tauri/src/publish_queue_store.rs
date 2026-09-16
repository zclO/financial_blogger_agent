use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

use crate::publisher::PublishResult;

// ── Types ──

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueueEntry {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub final_body: String,
    #[serde(default)]
    pub publish_type: String,
    #[serde(default)]
    pub video_source_type: String,
    #[serde(default)]
    pub video_url: String,
    #[serde(default)]
    pub video_file_path: String,
    #[serde(default)]
    pub symbols: Vec<String>,
    #[serde(default)]
    pub source_name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub sent_at: Option<String>,
    #[serde(default)]
    pub logs: Vec<String>,
    #[serde(default)]
    pub target_platforms: Vec<String>,
    #[serde(default)]
    pub platform_results: Vec<PublishResult>,
    #[serde(default)]
    pub image_base64: Option<String>,
    #[serde(default)]
    pub image_mime: Option<String>,
    #[serde(default)]
    pub image_name: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PublishQueueStore {
    #[serde(default)]
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
    let data = fs::read(&p).map_err(|e| e.to_string())?;
    match serde_json::from_slice::<PublishQueueStore>(&data) {
        Ok(store) => Ok(store),
        Err(e) => {
            eprintln!("[publish_queue] Failed to parse {}, resetting to defaults: {}", p.display(), e);
            Ok(PublishQueueStore::default())
        }
    }
}

#[tauri::command]
pub fn save_publish_queue(app: AppHandle, store: PublishQueueStore) -> Result<(), String> {
    fs::write(
        publish_queue_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
