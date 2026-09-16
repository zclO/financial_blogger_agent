use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Serializable pipeline types (mirror of TS types) ──

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PipelinePosition {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SourceNodeConfig {
    pub source_ids: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LlmNodeConfig {
    pub api_endpoint: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
    pub user_prompt_template: String,
    pub temperature: f64,
    pub max_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageNodeConfig {
    pub api_endpoint: String,
    pub api_key: String,
    pub prompt_template: String,
    pub negative_prompt: String,
    pub output_format: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageCfNodeConfig {
    pub api_endpoint: String,
    pub api_token: String,
    pub prompt_template: String,
    pub steps: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredPipelineNode {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub position: PipelinePosition,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_config: Option<SourceNodeConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub llm_config: Option<LlmNodeConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_config: Option<ImageNodeConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_cf_config: Option<ImageCfNodeConfig>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredFlowEdge {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub target: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StoredPipeline {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub nodes: Vec<StoredPipelineNode>,
    #[serde(default)]
    pub edges: Vec<StoredFlowEdge>,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStore {
    #[serde(default)]
    pub pipelines: Vec<StoredPipeline>,
    #[serde(default)]
    pub default_pipeline_id: Option<String>,
}

// ── File path ──

fn pipelines_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("pipelines.json"))
}

// ── Commands ──

#[tauri::command]
pub fn load_pipelines(app: AppHandle) -> Result<PipelineStore, String> {
    let p = pipelines_file(&app)?;
    if !p.exists() {
        return Ok(PipelineStore::default());
    }
    let data = fs::read(&p).map_err(|e| e.to_string())?;
    match serde_json::from_slice::<PipelineStore>(&data) {
        Ok(store) => Ok(store),
        Err(e) => {
            eprintln!("[pipeline] Failed to parse {}, resetting to defaults: {}", p.display(), e);
            Ok(PipelineStore::default())
        }
    }
}

#[tauri::command]
pub fn save_pipelines(app: AppHandle, store: PipelineStore) -> Result<(), String> {
    fs::write(
        pipelines_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
