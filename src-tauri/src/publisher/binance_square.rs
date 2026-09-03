use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

use crate::http::load_proxy_config;
use super::{PublishPlatform, PublishRequest, PublishResult};

pub struct BinanceSquarePlatform;

impl PublishPlatform for BinanceSquarePlatform {
    fn name(&self) -> &str {
        "binance_square"
    }

    fn is_configured(&self, app: &AppHandle) -> bool {
        is_key_configured(app)
    }

    fn publish(
        &self,
        app: &AppHandle,
        req: &PublishRequest,
    ) -> Result<PublishResult, String> {
        if req.text.trim().is_empty() {
            return Err("正文不能为空".into());
        }

        let message = if req.content_type == "video"
            && req.video_path.as_deref().map_or(false, |p| !p.is_empty())
        {
            // Video with local file
            let path = PathBuf::from(req.video_path.as_ref().unwrap());
            if !path.exists() {
                return Err("视频文件不存在".into());
            }
            if !path.is_file() {
                return Err("视频路径不是文件".into());
            }
            let mut args = vec!["--video".to_string(), path.to_string_lossy().to_string()];
            if !req.text.trim().is_empty() {
                args.push("--text".to_string());
                args.push(req.text.trim().to_string());
            }
            if let Some(ref t) = req.title {
                if !t.trim().is_empty() {
                    args.push("--title".to_string());
                    args.push(t.trim().to_string());
                }
            }
            run_square_script(app, "post-video.mjs", &args)?
        } else {
            // Text or video with URL
            let mut args = vec!["--text".to_string(), req.text.clone()];
            if !req.content_type.is_empty() {
                args.push("--contentType".to_string());
                args.push(req.content_type.clone());
            }
            if let Some(ref t) = req.title {
                if !t.trim().is_empty() {
                    args.push("--title".to_string());
                    args.push(t.trim().to_string());
                }
            }
            if let Some(ref v) = req.video_url {
                if !v.trim().is_empty() {
                    args.push("--videoUrl".to_string());
                    args.push(v.trim().to_string());
                }
            }
            run_square_script(app, "post-text.mjs", &args)?
        };

        Ok(PublishResult {
            platform: "binance_square".to_string(),
            success: true,
            message,
        })
    }
}

// ── Helpers (migrated from binance.rs) ──

fn is_key_configured(app: &AppHandle) -> bool {
    let Ok(path) = binance_square_key_file(app) else {
        return false;
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return false;
    };
    !content.trim().is_empty()
}

fn binance_square_key_file(app: &AppHandle) -> Result<PathBuf, String> {
    let home = app.path().home_dir().map_err(|e: tauri::Error| e.to_string())?;
    Ok(home.join(".config").join("binance-square").join("openapi-key"))
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
            && dir.join("scripts").join("post-video.mjs").exists()
        {
            return Ok(dir);
        }
    }

    Err("未找到内置 binance-square 资源目录，请确认 src-tauri/resources/binance-square 已打包。".into())
}

fn run_square_script(app: &AppHandle, script: &str, args: &[String]) -> Result<String, String> {
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

    // Read the API key
    let key_path = binance_square_key_file(app)?;
    let api_key = std::fs::read_to_string(&key_path)
        .map_err(|e| format!("读取 Binance Square API Key 失败: {}", e))?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("Binance Square API Key 未配置".into());
    }

    let mut cmd = Command::new("node");
    cmd.arg(script).args(args).current_dir(scripts_dir);
    cmd.env("BINANCE_SQUARE_OPENAPI_KEY", api_key);

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
