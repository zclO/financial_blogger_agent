pub mod binance_square;
pub mod store;
pub mod x_twitter;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

// ── Types ──

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublishRequest {
    pub title: Option<String>,
    pub text: String,
    pub content_type: String,
    pub video_url: Option<String>,
    pub video_path: Option<String>,
    #[serde(default)]
    pub image_base64: Option<String>,
    #[serde(default)]
    pub image_mime: Option<String>,
    #[serde(default)]
    pub image_name: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PublishResult {
    pub platform: String,
    pub success: bool,
    pub message: String,
}

// For deserialization in store
impl<'de> serde::Deserialize<'de> for PublishResult {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(serde::Deserialize)]
        struct Helper {
            platform: String,
            success: bool,
            message: String,
        }
        let helper = Helper::deserialize(deserializer)?;
        Ok(PublishResult {
            platform: helper.platform,
            success: helper.success,
            message: helper.message,
        })
    }
}

// ── Platform trait ──

pub trait PublishPlatform: Send + Sync {
    fn name(&self) -> &str;
    fn is_configured(&self, app: &AppHandle) -> bool;
    fn publish(
        &self,
        app: &AppHandle,
        req: &PublishRequest,
    ) -> Result<PublishResult, String>;
}

// ── Dispatcher ──

pub fn build_platform(platform_id: &str) -> Box<dyn PublishPlatform> {
    match platform_id {
        "binance_square" => Box::new(binance_square::BinanceSquarePlatform),
        "x_twitter" => Box::new(x_twitter::XTwitterPlatform),
        other => Box::new(UnknownPlatform(other.to_string())),
    }
}

struct UnknownPlatform(String);

impl PublishPlatform for UnknownPlatform {
    fn name(&self) -> &str {
        &self.0
    }

    fn is_configured(&self, _app: &AppHandle) -> bool {
        false
    }

    fn publish(
        &self,
        _app: &AppHandle,
        _req: &PublishRequest,
    ) -> Result<PublishResult, String> {
        Err(format!("未知平台: {}", self.0))
    }
}

// ── Tauri commands ──

#[tauri::command]
pub async fn publish_to_platforms(
    app: AppHandle,
    request: PublishRequest,
    platforms: Vec<String>,
) -> Result<Vec<PublishResult>, String> {
    if platforms.is_empty() {
        return Err("未指定目标平台".into());
    }
    if request.text.trim().is_empty() {
        return Err("正文不能为空".into());
    }

    let mut results = Vec::new();

    for platform_id in &platforms {
        let adapter = build_platform(platform_id);
        let app_clone = app.clone();
        let req = request.clone();
        let result = adapter.publish(&app_clone, &req);

        match result {
            Ok(r) => results.push(r),
            Err(e) => results.push(PublishResult {
                platform: platform_id.clone(),
                success: false,
                message: e,
            }),
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn get_platform_configs(app: AppHandle) -> Result<Vec<store::PlatformCredentials>, String> {
    let store = store::load_platform_store(app)?;
    Ok(store.platforms)
}

#[tauri::command]
pub fn configure_platform(
    app: AppHandle,
    platform: String,
    credentials: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    let mut store = store::load_platform_store(app.clone())?;

    let entry = store
        .platforms
        .iter_mut()
        .find(|p| p.platform == platform);

    match entry {
        Some(existing) => {
            existing.credentials = credentials;
            existing.enabled = true;
        }
        None => {
            store.platforms.push(store::PlatformCredentials {
                platform: platform.clone(),
                enabled: true,
                credentials,
            });
        }
    }

    store::save_platform_store(app, store)?;
    Ok(format!("平台 {} 凭证已保存", platform))
}

#[tauri::command]
pub fn set_platform_enabled(
    app: AppHandle,
    platform: String,
    enabled: bool,
) -> Result<String, String> {
    let mut store = store::load_platform_store(app.clone())?;

    let entry = store
        .platforms
        .iter_mut()
        .find(|p| p.platform == platform);

    match entry {
        Some(existing) => {
            existing.enabled = enabled;
        }
        None => {
            store.platforms.push(store::PlatformCredentials {
                platform: platform.clone(),
                enabled,
                credentials: std::collections::HashMap::new(),
            });
        }
    }

    store::save_platform_store(app, store)?;
    Ok(format!("平台 {} 已{}", platform, if enabled { "启用" } else { "禁用" }))
}
