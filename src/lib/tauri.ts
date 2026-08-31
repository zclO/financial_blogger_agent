import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export interface BinanceSquareConfig {
  enabled: boolean;
  keyConfigured: boolean;
  creatorCenterUrl: string;
}

export interface BinanceSquareProxyConfig {
  enabled: boolean;
  proxyUrl: string | null;
}

export interface BinanceSymbolSearchItem {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export function getBinanceSquareConfig(): Promise<BinanceSquareConfig> {
  return invoke<BinanceSquareConfig>("get_binance_square_config");
}

export function configureBinanceSquare(apiKey: string): Promise<string> {
  return invoke<string>("configure_binance_square", { apiKey });
}

export function publishBinanceSquareText(payload: {
  title?: string;
  text: string;
  contentType?: "post" | "article" | "video";
  videoUrl?: string;
}): Promise<string> {
  return invoke<string>("publish_binance_square_text", payload);
}

export function publishBinanceSquareVideoFile(payload: {
  text: string;
  videoPath: string;
  title?: string;
}): Promise<string> {
  return invoke<string>("publish_binance_square_video_file", payload);
}

export function getBinanceSquareProxyConfig(): Promise<BinanceSquareProxyConfig> {
  return invoke<BinanceSquareProxyConfig>("get_binance_square_proxy_config");
}

export function setBinanceSquareProxyConfig(payload: {
  enabled: boolean;
  proxyUrl?: string | null;
}): Promise<string> {
  return invoke<string>("set_binance_square_proxy_config", payload);
}

export function searchBinanceSymbols(payload: {
  query: string;
  limit?: number;
}): Promise<BinanceSymbolSearchItem[]> {
  return invoke<BinanceSymbolSearchItem[]>("search_binance_symbols", payload);
}

export interface NewsSource {
  id: string;
  name: string;
  category: string;
  url: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string | null;
}

export interface NewsFetchResult {
  source: NewsSource;
  articles: NewsArticle[];
  error: string | null;
}

export function fetchNews(sources: NewsSource[]): Promise<NewsFetchResult[]> {
  return invoke<NewsFetchResult[]>("fetch_news", { sources });
}

export function getDefaultNewsSources(): Promise<NewsSource[]> {
  return invoke<NewsSource[]>("get_default_news_sources");
}

// ── Pipeline / LLM ──

export interface LlmRequest {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: LlmUsage | null;
}

export function callLlm(request: LlmRequest): Promise<LlmResponse> {
  return invoke<LlmResponse>("call_llm", { request });
}

// ── Pipeline Store ──

export interface StoredPipelineNode {
  id: string;
  kind: string;
  name: string;
  position: { x: number; y: number };
  sourceConfig?: { sourceIds: string[] };
  llmConfig?: {
    apiEndpoint: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    userPromptTemplate: string;
    temperature: number;
    maxTokens: number;
  };
}

export interface StoredFlowEdge {
  id: string;
  source: string;
  target: string;
}

export interface StoredPipeline {
  id: string;
  name: string;
  nodes: StoredPipelineNode[];
  edges: StoredFlowEdge[];
  isDefault: boolean;
}

export interface PipelineStore {
  pipelines: StoredPipeline[];
  defaultPipelineId: string | null;
}

export function loadPipelines(): Promise<PipelineStore> {
  return invoke<PipelineStore>("load_pipelines");
}

export function savePipelines(store: PipelineStore): Promise<void> {
  return invoke<void>("save_pipelines", { store });
}
