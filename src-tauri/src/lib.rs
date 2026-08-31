mod binance;
mod draft_store;
mod http;
mod news;
mod pipeline;
mod pipeline_store;
mod topic_store;
mod workspace;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // workspace
            workspace::get_app_info,
            workspace::load_workspace,
            workspace::save_workspace,
            // binance square
            binance::get_binance_square_config,
            binance::configure_binance_square,
            binance::publish_binance_square_text,
            binance::publish_binance_square_video_file,
            binance::get_binance_square_proxy_config,
            binance::set_binance_square_proxy_config,
            binance::search_binance_symbols,
            // news
            news::get_default_news_sources,
            news::fetch_news,
            // pipeline
            pipeline::call_llm,
            // pipeline store
            pipeline_store::load_pipelines,
            pipeline_store::save_pipelines,
            // topic store
            topic_store::load_topic_store,
            topic_store::save_topic_store,
            // draft store
            draft_store::load_draft_store,
            draft_store::save_draft_store,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Financial Blogger Agent");
}
