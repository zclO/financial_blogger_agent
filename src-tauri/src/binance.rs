use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, process::Command};
use tauri::{AppHandle, Manager};

use crate::http::{build_http_client, load_proxy_config, save_proxy_config, BinanceSquareProxyConfig};

// ── Types ──

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinanceSymbolSearchItem {
    pub symbol: String,
    pub base_asset: String,
    pub quote_asset: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinanceExchangeInfo {
    symbols: Vec<BinanceExchangeSymbol>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinanceExchangeSymbol {
    symbol: String,
    status: String,
    base_asset: String,
    quote_asset: String,
}

// ── Key management ──

fn binance_square_key_file(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok(home.join(".config").join("binance-square").join("openapi-key"))
}

fn is_binance_square_key_configured(app: &AppHandle) -> bool {
    let Ok(path) = binance_square_key_file(app) else {
        return false;
    };
    let Ok(content) = fs::read_to_string(path) else {
        return false;
    };
    !content.trim().is_empty()
}

// ── Script execution ──

fn square_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("binance-square"));
        candidates.push(resource_dir.join("resources").join("binance-square"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("resources").join("binance-square"));
        candidates.push(cwd.join("resources").join("binance-square"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("resources").join("binance-square"));
            candidates.push(parent.join("..").join("resources").join("binance-square"));
        }
    }

    for dir in candidates {
        if dir.join("scripts").join("save-key.mjs").exists()
            && dir.join("scripts").join("post-text.mjs").exists()
            && dir.join("scripts").join("post-video.mjs").exists()
        {
            return Ok(dir);
        }
    }

    Err("未找到内置 binance-square 资源目录，请确认 src-tauri/resources/binance-square 已打包。".into())
}

fn square(app: &AppHandle, script: &str, args: &[&str], key: Option<&str>) -> Result<String, String> {
    let dir = square_dir(app)?;
    let scripts_dir = dir.join("scripts");
    let script_path = scripts_dir.join(script);
    if !script_path.exists() {
        return Err(format!(
            "未找到脚本: {}（资源目录: {}）",
            script_path.display(),
            dir.display()
        ));
    }

    let mut cmd = Command::new("node");
    cmd.arg(script).args(args).current_dir(scripts_dir);

    if let Some(k) = key {
        cmd.env("BINANCE_SQUARE_OPENAPI_KEY", k);
    }

    let proxy = load_proxy_config(app);
    if proxy.enabled {
        if let Some(proxy_url) = proxy.proxy_url.as_deref() {
            cmd.env("HTTP_PROXY", proxy_url);
            cmd.env("HTTPS_PROXY", proxy_url);
            cmd.env("ALL_PROXY", proxy_url);
            cmd.env("http_proxy", proxy_url);
            cmd.env("https_proxy", proxy_url);
            cmd.env("all_proxy", proxy_url);
            cmd.env("NODE_USE_ENV_PROXY", "1");
        }
    }

    let out = cmd.output().map_err(|e| e.to_string())?;
    let result = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    if out.status.success() {
        Ok(result)
    } else {
        Err(result)
    }
}

// ── Tauri commands ──

#[tauri::command]
pub fn get_binance_square_config(app: AppHandle) -> serde_json::Value {
    serde_json::json!({
        "enabled": false,
        "keyConfigured": is_binance_square_key_configured(&app),
        "creatorCenterUrl": "https://www.binance.com/square/creator-center/home"
    })
}

#[tauri::command]
pub fn configure_binance_square(app: AppHandle, api_key: String) -> Result<String, String> {
    square(&app, "save-key.mjs", &[], Some(&api_key))
}

#[tauri::command]
pub fn publish_binance_square_text(
    app: AppHandle,
    title: Option<String>,
    text: String,
    content_type: Option<String>,
    video_url: Option<String>,
) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("正文不能为空".into());
    }
    let mut args = vec!["--text", text.as_str()];
    if let Some(ct) = content_type.as_deref() {
        if !ct.trim().is_empty() {
            args.extend(["--contentType", ct.trim()]);
        }
    }
    if let Some(t) = title.as_deref() {
        if !t.trim().is_empty() {
            args.extend(["--title", t]);
        }
    }
    if let Some(v) = video_url.as_deref() {
        if !v.trim().is_empty() {
            args.extend(["--videoUrl", v.trim()]);
        }
    }
    square(&app, "post-text.mjs", &args, None)
}

#[tauri::command]
pub fn publish_binance_square_video_file(
    app: AppHandle,
    text: String,
    video_path: String,
    title: Option<String>,
) -> Result<String, String> {
    let path = PathBuf::from(video_path);
    if !path.exists() {
        return Err("视频文件不存在。".into());
    }
    if !path.is_file() {
        return Err("视频路径不是文件。".into());
    }
    let path_str = path.to_string_lossy().to_string();
    let mut args = vec!["--video", path_str.as_str()];
    if !text.trim().is_empty() {
        args.extend(["--text", text.trim()]);
    }
    if let Some(t) = title.as_deref() {
        if !t.trim().is_empty() {
            args.extend(["--title", t.trim()]);
        }
    }
    square(&app, "post-video.mjs", &args, None)
}

#[tauri::command]
pub fn get_binance_square_proxy_config(app: AppHandle) -> BinanceSquareProxyConfig {
    load_proxy_config(&app)
}

#[tauri::command]
pub fn set_binance_square_proxy_config(
    app: AppHandle,
    enabled: bool,
    proxy_url: Option<String>,
) -> Result<String, String> {
    let normalized = proxy_url.map(|x| x.trim().to_string()).filter(|x| !x.is_empty());

    if enabled {
        let Some(ref url) = normalized else {
            return Err("已启用代理时，代理地址不能为空。".into());
        };
        let valid = url.starts_with("http://")
            || url.starts_with("https://")
            || url.starts_with("socks5://")
            || url.starts_with("socks5h://");
        if !valid {
            return Err("代理地址必须以 http://、https://、socks5:// 或 socks5h:// 开头。".into());
        }
    }

    let config = BinanceSquareProxyConfig {
        enabled,
        proxy_url: normalized,
    };
    save_proxy_config(&app, &config)?;
    Ok("代理配置已保存。".into())
}

#[tauri::command]
pub async fn search_binance_symbols(
    app: AppHandle,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<BinanceSymbolSearchItem>, String> {
    let q = query.trim().to_uppercase();
    if q.len() < 2 {
        return Ok(Vec::new());
    }
    let max = limit.unwrap_or(20).clamp(1, 100);

    let client = build_http_client(&app)?;
    let res = client
        .get("https://api.binance.com/api/v3/exchangeInfo")
        .send()
        .await
        .map_err(|e| format!("币种搜索请求失败: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("币种搜索接口返回异常: {}", res.status()));
    }

    let info: BinanceExchangeInfo = res
        .json()
        .await
        .map_err(|e| format!("币种搜索结果解析失败: {}", e))?;

    let items = info
        .symbols
        .into_iter()
        .filter(|s| {
            s.status == "TRADING"
                && (s.quote_asset == "USDT" || s.quote_asset == "FDUSD" || s.quote_asset == "USDC")
                && (s.symbol.contains(&q) || s.base_asset.contains(&q))
        })
        .map(|s| BinanceSymbolSearchItem {
            symbol: s.base_asset.clone(),
            base_asset: s.base_asset,
            quote_asset: s.quote_asset,
        })
        .collect::<Vec<_>>();

    let mut dedup = std::collections::HashSet::<String>::new();
    let mut out = Vec::new();
    for item in items {
        if dedup.insert(item.symbol.clone()) {
            out.push(item);
        }
        if out.len() >= max {
            break;
        }
    }
    Ok(out)
}
