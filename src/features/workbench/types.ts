import type {
  BinanceSquareConfig,
  BinanceSquareProxyConfig,
  BinanceSymbolSearchItem,
} from "../../lib/tauri";

export type Tab = "仪表盘" | "选题池" | "新闻源" | "流水线" | "内容工坊" | "发布队列" | "设置";
export type PublishType = "post" | "article" | "video";
export type VideoSourceType = "url" | "local";
export type PublishState = "idle" | "scheduled" | "sending" | "sent" | "failed";

export type Topic = { id: number; title: string; source: string; verified: boolean; summary?: string; link?: string; processedContent?: string };

export type Draft = {
  title: string;
  body: string;
  reviewed: boolean;
  queued: boolean;
  publishType: PublishType;
  videoSourceType: VideoSourceType;
  videoUrl: string;
  videoFilePath: string;
};

export type SquareState = {
  config: BinanceSquareConfig | null;
  keyInput: string;
  notice: string;
  loading: boolean;
  refreshing: boolean;
  openingCenter: boolean;
  lastRefreshTime: string;
};

export type ProxyState = {
  config: BinanceSquareProxyConfig;
  proxyUrlInput: string;
  saving: boolean;
  notice: string;
};

export type SymbolSearchState = {
  query: string;
  searching: boolean;
  notice: string;
  results: BinanceSymbolSearchItem[];
  manualSymbolsInput: string;
};

export type NewsSource = {
  id: string;
  name: string;
  category: string;
  url: string;
};

export type NewsArticle = {
  id: string;
  title: string;
  link: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string | null;
};

export type NewsFetchResult = {
  source: NewsSource;
  articles: NewsArticle[];
  error: string | null;
};

// ── Pipeline types ──

export type PipelineNodeKind = "source" | "llm";

export type SourceNodeConfig = {
  /** 选中的新闻源 ID 列表，空数组表示全部 */
  sourceIds: string[];
};

export type LlmNodeConfig = {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
};

export type PipelineNode = {
  id: string;
  kind: PipelineNodeKind;
  name: string;
  position: { x: number; y: number };
  sourceConfig?: SourceNodeConfig;
  llmConfig?: LlmNodeConfig;
};

export type ProcessedArticle = {
  originalTitle: string;
  originalSummary: string;
  sourceName: string;
  link: string;
  processedContent: string;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

export type SavedPipeline = {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: FlowEdge[];
  isDefault: boolean;
};
