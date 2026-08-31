import { useEffect, useMemo, useState } from "react";

import { searchBinanceSymbols, type BinanceSymbolSearchItem } from "../../../lib/tauri";
import type { Draft } from "../types";
import { extractTaggedSymbols, normalizeSymbols } from "../utils";

export function useSymbolSearch(draft: Draft) {
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolSearching, setSymbolSearching] = useState(false);
  const [symbolSearchNotice, setSymbolSearchNotice] = useState("");
  const [symbolSearchResults, setSymbolSearchResults] = useState<BinanceSymbolSearchItem[]>([]);
  const [manualSymbolsInput, setManualSymbolsInput] = useState("");
  const [composerError, setComposerError] = useState("");

  const manualSymbols = useMemo(() => normalizeSymbols(manualSymbolsInput), [manualSymbolsInput]);
  const bodyTaggedSymbols = useMemo(() => extractTaggedSymbols(draft.body), [draft.body]);
  const allSymbols = useMemo(
    () => Array.from(new Set([...bodyTaggedSymbols, ...manualSymbols])),
    [bodyTaggedSymbols, manualSymbols],
  );

  useEffect(() => {
    setComposerError("");
  }, [draft, manualSymbolsInput]);

  useEffect(() => {
    const query = symbolQuery.trim();
    if (query.length < 2) {
      setSymbolSearchResults([]);
      setSymbolSearchNotice(query.length === 0 ? "" : "至少输入 2 个字符再搜索。");
      return;
    }

    const timer = window.setTimeout(async () => {
      setSymbolSearching(true);
      setSymbolSearchNotice("");
      try {
        const items = await searchBinanceSymbols({ query, limit: 20 });
        setSymbolSearchResults(items);
        if (items.length === 0) setSymbolSearchNotice("没有匹配到币种。");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSymbolSearchNotice(`币种搜索失败：${message}`);
      } finally {
        setSymbolSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [symbolQuery]);

  const addSymbolFromSearch = (symbol: string) => {
    const merged = Array.from(new Set([...manualSymbols, symbol.toUpperCase()]));
    setManualSymbolsInput(merged.join(","));
  };

  const removeManualSymbol = (symbol: string) => {
    if (bodyTaggedSymbols.includes(symbol)) return;
    setManualSymbolsInput(manualSymbols.filter((x) => x !== symbol).join(","));
  };

  return {
    symbolQuery,
    setSymbolQuery,
    symbolSearching,
    symbolSearchNotice,
    symbolSearchResults,
    manualSymbolsInput,
    setManualSymbolsInput,
    composerError,
    setComposerError,
    manualSymbols,
    bodyTaggedSymbols,
    allSymbols,
    addSymbolFromSearch,
    removeManualSymbol,
  };
}
