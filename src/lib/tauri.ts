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

// ── News Source Store ──

export interface NewsSourceStoreData {
  sources: NewsSource[];
}

export function loadNewsSourceStore(): Promise<NewsSourceStoreData> {
  return invoke<NewsSourceStoreData>("load_news_source_store");
}

export function saveNewsSourceStore(store: NewsSourceStoreData): Promise<void> {
  return invoke<void>("save_news_source_store", { store });
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

// ── Image Generation ──

export interface ImageGenRequest {
  apiKey: string;
  apiEndpoint?: string;
  prompt: string;
  negativePrompt?: string;
  outputFormat?: string;
  width?: number;
  height?: number;
}

export interface ImageGenResponse {
  imageBase64: string;
  fileName: string;
  mimeType: string;
}

export function generateImage(request: ImageGenRequest): Promise<ImageGenResponse> {
  return invoke<ImageGenResponse>("generate_image", { request });
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
  imageConfig?: {
    apiEndpoint: string;
    apiKey: string;
    promptTemplate: string;
    negativePrompt: string;
    outputFormat: string;
    width: number;
    height: number;
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

// ── Topic Store ──

export interface StoredTopic {
  id: number;
  title: string;
  source: string;
  verified: boolean;
  summary?: string;
  link?: string;
  processedContent?: string;
  generatedImage?: string;
  generatedImageName?: string;
  generatedImageMime?: string;
}

export interface TopicStoreData {
  topics: StoredTopic[];
  seenTitles: string[];
}

export function loadTopicStore(): Promise<TopicStoreData> {
  return invoke<TopicStoreData>("load_topic_store");
}

export function saveTopicStore(store: TopicStoreData): Promise<void> {
  return invoke<void>("save_topic_store", { store });
}

// ── Draft Store ──

export interface StoredDraft {
  title: string;
  body: string;
  reviewed: boolean;
  queued: boolean;
  publishType: string;
  videoSourceType: string;
  videoUrl: string;
  videoFilePath: string;
  targetPlatforms: string[];
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
}

export interface DraftStoreData {
  draft: StoredDraft | null;
  queueLogs: string[];
  publishState: string;
  publishOutput: string;
  scheduleAtInput: string;
  allowScheduledPublish: boolean;
  autoPublishEnabled: boolean;
  autoPublishIntervalMinutes: number;
  autoPublishLastSourceName: string;
  autoPublishLastTime: string | null;
  autoPublishSourcePriority: string[];
  autoPublishPipelineId: string | null;
  autoPublishTargetPlatforms: string[] | null;
}

export function loadDraftStore(): Promise<DraftStoreData> {
  return invoke<DraftStoreData>("load_draft_store");
}

export function saveDraftStore(store: DraftStoreData): Promise<void> {
  return invoke<void>("save_draft_store", { store });
}

// ── Article Log Store ──

export interface ArticleLogEntry {
  id: string;
  topicId: number;
  topicTitle: string;
  timestamp: string;
  status: string;
  logs: string[];
}

export interface ArticleLogStoreData {
  entries: ArticleLogEntry[];
}

export function loadArticleLogStore(): Promise<ArticleLogStoreData> {
  return invoke<ArticleLogStoreData>("load_article_log_store");
}

export function saveArticleLogStore(store: ArticleLogStoreData): Promise<void> {
  return invoke<void>("save_article_log_store", { store });
}

// ── Publish Queue Store ──

export interface QueueEntryData {
  id: string;
  title: string;
  body: string;
  finalBody: string;
  publishType: string;
  videoSourceType: string;
  videoUrl: string;
  videoFilePath: string;
  symbols: string[];
  sourceName: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  logs: string[];
  targetPlatforms: string[];
  platformResults: PublishResultItem[];
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
}

export interface PublishQueueStoreData {
  entries: QueueEntryData[];
}

export function loadPublishQueue(): Promise<PublishQueueStoreData> {
  return invoke<PublishQueueStoreData>("load_publish_queue");
}

export function savePublishQueue(store: PublishQueueStoreData): Promise<void> {
  return invoke<void>("save_publish_queue", { store });
}

// ── Multi-Platform Publishing ──

export type PlatformId = "binance_square" | "x_twitter";

export interface PlatformConfig {
  platform: PlatformId;
  enabled: boolean;
  credentials: Record<string, string>;
}

export interface PublishRequest {
  title?: string;
  text: string;
  contentType: string;
  videoUrl?: string;
  videoPath?: string;
  imageBase64?: string;
  imageMime?: string;
  imageName?: string;
}

export interface PublishResultItem {
  platform: string;
  success: boolean;
  message: string;
}

export function publishToPlatforms(
  request: PublishRequest,
  platforms: string[],
): Promise<PublishResultItem[]> {
  return invoke<PublishResultItem[]>("publish_to_platforms", { request, platforms });
}

export function getPlatformConfigs(): Promise<PlatformConfig[]> {
  return invoke<PlatformConfig[]>("get_platform_configs");
}

export function configurePlatform(
  platform: string,
  credentials: Record<string, string>,
): Promise<string> {
  return invoke<string>("configure_platform", { platform, credentials });
}

export function setPlatformEnabled(
  platform: string,
  enabled: boolean,
): Promise<string> {
  return invoke<string>("set_platform_enabled", { platform, enabled });
}
