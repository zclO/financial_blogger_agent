use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Types ──

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredDraft {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub reviewed: bool,
    #[serde(default)]
    pub queued: bool,
    #[serde(default)]
    pub publish_type: String,
    #[serde(default)]
    pub video_source_type: String,
    #[serde(default)]
    pub video_url: String,
    #[serde(default)]
    pub video_file_path: String,
    #[serde(default)]
    pub target_platforms: Vec<String>,
    #[serde(default)]
    pub image_base64: Option<String>,
    #[serde(default)]
    pub image_mime: Option<String>,
    #[serde(default)]
    pub image_name: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DraftStore {
    #[serde(default)]
    pub draft: Option<StoredDraft>,
    #[serde(default)]
    pub queue_logs: Vec<String>,
    #[serde(default)]
    pub publish_state: String,
    #[serde(default)]
    pub publish_output: String,
    #[serde(default)]
    pub schedule_at_input: String,
    #[serde(default)]
    pub allow_scheduled_publish: bool,
    #[serde(default)]
    pub auto_publish_enabled: bool,
    #[serde(default)]
    pub auto_publish_interval_minutes: u32,
    #[serde(default)]
    pub auto_publish_last_source_name: String,
    #[serde(default)]
    pub auto_publish_last_time: Option<String>,
    #[serde(default)]
    pub auto_publish_source_priority: Vec<String>,
    #[serde(default)]
    pub auto_publish_pipeline_id: Option<String>,
    #[serde(default)]
    pub auto_publish_target_platforms: Vec<String>,
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
    let data = fs::read(&p).map_err(|e| e.to_string())?;
    match serde_json::from_slice::<DraftStore>(&data) {
        Ok(store) => Ok(store),
        Err(e) => {
            eprintln!("[draft_store] Failed to parse {}, resetting to defaults: {}", p.display(), e);
            Ok(DraftStore::default())
        }
    }
}

#[tauri::command]
pub fn save_draft_store(app: AppHandle, store: DraftStore) -> Result<(), String> {
    fs::write(
        draft_store_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
