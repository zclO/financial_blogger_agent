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
}): Promise<string> {
  return invoke<string>("publish_binance_square_text", payload);
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
