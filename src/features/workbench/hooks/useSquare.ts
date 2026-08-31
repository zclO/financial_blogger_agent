import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";

import {
  configureBinanceSquare,
  getBinanceSquareConfig,
  getBinanceSquareProxyConfig,
  setBinanceSquareProxyConfig,
  type BinanceSquareConfig,
  type BinanceSquareProxyConfig,
} from "../../../lib/tauri";
import { nowText } from "../utils";

export function useSquare() {
  const [squareConfig, setSquareConfig] = useState<BinanceSquareConfig | null>(null);
  const [squareKeyInput, setSquareKeyInput] = useState("");
  const [squareNotice, setSquareNotice] = useState("");
  const [squareLoading, setSquareLoading] = useState(false);
  const [refreshingSquare, setRefreshingSquare] = useState(false);
  const [openingSquare, setOpeningSquare] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState("");

  const [proxyConfig, setProxyConfig] = useState<BinanceSquareProxyConfig>({ enabled: false, proxyUrl: null });
  const [proxyUrlInput, setProxyUrlInput] = useState("");
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyNotice, setProxyNotice] = useState("");

  const loadSquareConfig = async (showSuccess: boolean) => {
    setRefreshingSquare(true);
    try {
      const config = await getBinanceSquareConfig();
      setSquareConfig(config);
      const time = nowText();
      setLastRefreshTime(time);
      if (showSuccess) setSquareNotice(`状态已刷新（${time}）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`读取配置失败：${message}`);
    } finally {
      setRefreshingSquare(false);
    }
  };

  const loadProxyConfig = async () => {
    try {
      const config = await getBinanceSquareProxyConfig();
      setProxyConfig(config);
      setProxyUrlInput(config.proxyUrl ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProxyNotice(`读取代理配置失败：${message}`);
    }
  };

  useEffect(() => {
    void loadSquareConfig(false);
    void loadProxyConfig();
  }, []);

  const saveSquareKey = async () => {
    const apiKey = squareKeyInput.trim();
    if (!apiKey) {
      setSquareNotice("请先输入 Square OpenAPI Key。");
      return;
    }
    setSquareLoading(true);
    setSquareNotice("");
    try {
      await configureBinanceSquare(apiKey);
      setSquareKeyInput("");
      setSquareNotice(`Key 已保存（${nowText()}）`);
      await loadSquareConfig(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`保存失败：${message}`);
    } finally {
      setSquareLoading(false);
    }
  };

  const saveProxyConfig = async () => {
    setProxySaving(true);
    setProxyNotice("");
    try {
      const message = await setBinanceSquareProxyConfig({
        enabled: proxyConfig.enabled,
        proxyUrl: proxyUrlInput.trim() || null,
      });
      setProxyNotice(`${message}（${nowText()}）`);
      await loadProxyConfig();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setProxyNotice(`保存代理配置失败：${msg}`);
    } finally {
      setProxySaving(false);
    }
  };

  const openSquareCenter = async () => {
    if (!squareConfig?.creatorCenterUrl) {
      setSquareNotice("未读取到 Creator Center 地址，请先刷新状态。");
      return;
    }
    setOpeningSquare(true);
    try {
      await openUrl(squareConfig.creatorCenterUrl);
      setSquareNotice("已请求打开 Square Creator Center。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`打开失败：${message}`);
    } finally {
      setOpeningSquare(false);
    }
  };

  return {
    squareConfig,
    squareKeyInput,
    setSquareKeyInput,
    squareNotice,
    squareLoading,
    refreshingSquare,
    openingSquare,
    lastRefreshTime,
    saveSquareKey,
    loadSquareConfig,
    openSquareCenter,
    proxyConfig,
    setProxyConfig,
    proxyUrlInput,
    setProxyUrlInput,
    proxySaving,
    proxyNotice,
    saveProxyConfig,
    loadProxyConfig,
  };
}
