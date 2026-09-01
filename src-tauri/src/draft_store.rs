use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredDraft {
    pub title: String,
    pub body: String,
    pub reviewed: bool,
    pub queued: bool,
    pub publish_type: String,
    pub video_source_type: String,
    pub video_url: String,
    pub video_file_path: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DraftStore {
    pub draft: Option<StoredDraft>,
    pub queue_logs: Vec<String>,
    pub publish_state: String,
    pub publish_output: String,
    pub schedule_at_input: String,
    pub allow_scheduled_publish: bool,
    pub auto_publish_enabled: bool,
    pub auto_publish_interval_minutes: u32,
    pub auto_publish_last_source_name: String,
    pub auto_publish_last_time: Option<String>,
    pub auto_publish_source_priority: Vec<String>,
    pub auto_publish_pipeline_id: String,
}

// ── File path ──

fn draft_store_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("draft.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_draft_store(app: AppHandle) -> Result<DraftStore, String> {
    let p = draft_store_file(&app)?;
    if !p.exists() {
        return Ok(DraftStore::default());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_draft_store(app: AppHandle, store: DraftStore) -> Result<(), String> {
    fs::write(
        draft_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
