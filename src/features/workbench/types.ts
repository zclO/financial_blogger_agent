import type {
  BinanceSquareConfig,
  BinanceSquareProxyConfig,
  BinanceSymbolSearchItem,
} from "../../lib/tauri";

export type Tab = "仪表盘" | "选题池" | "内容工坊" | "发布队列" | "设置";
export type PublishType = "post" | "article" | "video";
export type VideoSourceType = "url" | "local";
export type PublishState = "idle" | "scheduled" | "sending" | "sent" | "failed";

export type Topic = { id: number; title: string; source: string; verified: boolean };

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
