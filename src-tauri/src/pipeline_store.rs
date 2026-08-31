use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

// ── Serializable pipeline types (mirror of TS types) ──

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PipelinePosition {
    pub x: f64,
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
pub struct StoredPipelineNode {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub position: PipelinePosition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_config: Option<SourceNodeConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_config: Option<LlmNodeConfig>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredFlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredPipeline {
    pub id: String,
    pub name: String,
    pub nodes: Vec<StoredPipelineNode>,
    pub edges: Vec<StoredFlowEdge>,
    pub is_default: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStore {
    pub pipelines: Vec<StoredPipeline>,
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
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_pipelines(app: AppHandle, store: PipelineStore) -> Result<(), String> {
    fs::write(
        pipelines_file(&app)?,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}
