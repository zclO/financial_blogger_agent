use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, process::Command};
use tauri::{AppHandle, Manager};
use reqwest::Client;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Topic {
    pub id: String,
    pub title: String,
    pub source: String,
    pub verified: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub topic_id: String,
    pub title: String,
    pub body: String,
    pub reviewed: bool,
    pub queued: bool,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub topics: Vec<Topic>,
    pub drafts: Vec<Draft>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BinanceSquareProxyConfig {
    pub enabled: bool,
    pub proxy_url: Option<String>,
}

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

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("workspace.json"))
}

fn proxy_file(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.join("binance_square_proxy.json"))
}

fn load_proxy_config(app: &AppHandle) -> BinanceSquareProxyConfig {
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

fn save_proxy_config(app: &AppHandle, config: &BinanceSquareProxyConfig) -> Result<(), String> {
    fs::write(
        proxy_file(app)?,
        serde_json::to_vec_pretty(config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn seed() -> Workspace {
    Workspace {
        topics: vec![
            Topic {
                id: "eth-upgrade".into(),
                title: "以太坊生态升级官方公告".into(),
                source: "项目官方 API（示例）".into(),
                verified: true,
            },
            Topic {
                id: "btc-etf".into(),
                title: "BTC ETF 日度资金数据待核验".into(),
                source: "授权行情源（示例）".into(),
                verified: false,
            },
        ],
        drafts: vec![],
    }
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Workspace, String> {
    let p = file(&app)?;
    if !p.exists() {
        return Ok(seed());
    }
    serde_json::from_slice(&fs::read(p).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_workspace(app: AppHandle, workspace: Workspace) -> Result<(), String> {
    fs::write(
        file(&app)?,
        serde_json::to_vec_pretty(&workspace).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

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

fn build_http_client(app: &AppHandle) -> Result<Client, String> {
    let mut builder = Client::builder().timeout(std::time::Duration::from_secs(15));
    let proxy = load_proxy_config(app);
    if proxy.enabled {
        if let Some(proxy_url) = proxy.proxy_url {
            let px = reqwest::Proxy::all(&proxy_url).map_err(|e| format!("代理配置无效: {}", e))?;
            builder = builder.proxy(px);
        }
    }
    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

#[tauri::command]
fn get_binance_square_config(app: AppHandle) -> serde_json::Value {
    serde_json::json!({
        "enabled": false,
        "keyConfigured": is_binance_square_key_configured(&app),
        "creatorCenterUrl": "https://www.binance.com/square/creator-center/home"
    })
}

#[tauri::command]
fn configure_binance_square(app: AppHandle, api_key: String) -> Result<String, String> {
    square(&app, "save-key.mjs", &[], Some(&api_key))
}

#[tauri::command]
fn publish_binance_square_text(
    app: AppHandle,
    title: Option<String>,
    text: String,
) -> Result<String, String> {
    if text.trim().is_empty() {
        return Err("正文不能为空".into());
    }
    let mut args = vec!["--text", text.as_str()];
    if let Some(t) = title.as_deref() {
        if !t.trim().is_empty() {
            args.extend(["--title", t]);
        }
    }
    square(&app, "post-text.mjs", &args, None)
}

#[tauri::command]
fn get_binance_square_proxy_config(app: AppHandle) -> BinanceSquareProxyConfig {
    load_proxy_config(&app)
}

#[tauri::command]
fn set_binance_square_proxy_config(
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
async fn search_binance_symbols(
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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            load_workspace,
            save_workspace,
            get_binance_square_config,
            configure_binance_square,
            publish_binance_square_text,
            get_binance_square_proxy_config,
            set_binance_square_proxy_config,
            search_binance_symbols
        ])
        .run(tauri::generate_context!())
        .expect("error while running Financial Blogger Agent");
}
