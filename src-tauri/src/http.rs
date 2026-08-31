use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BinanceSquareProxyConfig {
    pub enabled: bool,
    pub proxy_url: Option<String>,
}

fn proxy_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("binance_square_proxy.json"))
}

pub fn load_proxy_config(app: &AppHandle) -> BinanceSquareProxyConfig {
    let Ok(path) = proxy_file(app) else {
        return BinanceSquareProxyConfig::default();
    };
    if !path.exists() {
        return BinanceSquareProxyConfig::default();
    }
    let Ok(raw) = fs::read(path) else {
        return BinanceSquareProxyConfig::default();
    };
    serde_json::from_slice::<BinanceSquareProxyConfig>(&raw).unwrap_or_default()
}

pub fn save_proxy_config(app: &AppHandle, config: &BinanceSquareProxyConfig) -> Result<(), String> {
    fs::write(
        proxy_file(app)?,
        serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

pub fn build_http_client(app: &AppHandle) -> Result<reqwest::Client, String> {
    build_http_client_with_timeout(app, std::time::Duration::from_secs(15))
}

pub fn build_http_client_with_timeout(app: &AppHandle, timeout: std::time::Duration) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().timeout(timeout);
    let proxy = load_proxy_config(app);
    if proxy.enabled {
        if let Some(proxy_url) = proxy.proxy_url {
            let px = reqwest::Proxy::all(&proxy_url).map_err(|e| format!("代理配置无效: {}", e))?;
            builder = builder.proxy(px);
        }
    }
    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}
