import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchNews,
  getDefaultNewsSources,
  loadNewsSourceStore,
  saveNewsSourceStore,
  type NewsFetchResult,
  type NewsSource,
} from "../../../lib/tauri";
import { DEFAULT_NEWS_SOURCES } from "../constants";
import type { Topic } from "../types";

export function useNews(
  setTopics: (fn: (prev: Topic[]) => Topic[]) => void,
  setNotice: (msg: string) => void,
  onNewTopics?: (topics: Topic[]) => void,
  seenTitles?: Set<string>,
  addSeenTitles?: (titles: string[]) => void,
) {
  const [newsSources, setNewsSources] = useState<NewsSource[]>(DEFAULT_NEWS_SOURCES);
  const [newsResults, setNewsResults] = useState<NewsFetchResult[]>([]);
  const [newsFetching, setNewsFetching] = useState(false);
  const onNewTopicsRef = useRef(onNewTopics);
  onNewTopicsRef.current = onNewTopics;

  // Ref indicating a manual fetch is in progress; shared with auto-publish tick to avoid concurrency
  const manualFetchLockRef = useRef(false);

  // Skip the first effect run (initial mount) since we load from store manually
  const skipInitialSaveRef = useRef(true);

  // ── Load persisted sources on mount ──
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadNewsSourceStore();
        if (stored.sources.length > 0) {
          setNewsSources(stored.sources);
          return;
        }
      } catch { /* fall through */ }
      // Fallback: try Rust-side defaults
      try {
        const defaults = await getDefaultNewsSources();
        setNewsSources(defaults);
      } catch { /* keep DEFAULT_NEWS_SOURCES */ }
    })();
  }, []);

  // ── Persist sources whenever they change ──
  useEffect(() => {
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }
    saveNewsSourceStore({ sources: newsSources }).catch(() => {});
  }, [newsSources]);

  // ── CRUD ──

  const addSource = useCallback((source: NewsSource) => {
    setNewsSources((prev) => [...prev, source]);
  }, []);

  const updateSource = useCallback((id: string, patch: Partial<NewsSource>) => {
    setNewsSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSource = useCallback((id: string) => {
    setNewsSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetSources = useCallback(async () => {
    try {
      const defaults = await getDefaultNewsSources();
      setNewsSources(defaults);
    } catch {
      setNewsSources(DEFAULT_NEWS_SOURCES);
    }
  }, []);

  // ── Article import ──

  const importArticlesToTopics = (articles: { title: string; sourceName: string; summary?: string; link?: string }[]): number => {
    let addedCount = 0;
    const newTopics: Topic[] = [];
    const newTitles: string[] = [];
    const seen = seenTitles ?? new Set<string>();
    setTopics((prev) => {
      const existingTitles = new Set([...prev.map((t) => t.title), ...seen]);
      for (const article of articles) {
        if (!article.title || existingTitles.has(article.title)) continue;
        existingTitles.add(article.title);
        newTopics.push({
          id: Date.now() + newTopics.length,
          title: article.title,
          source: `${article.sourceName}（RSS）`,
          verified: false,
          summary: article.summary || undefined,
          link: article.link || undefined,
        });
        newTitles.push(article.title);
      }
      addedCount = newTopics.length;
      return newTopics.length > 0 ? [...newTopics, ...prev] : prev;
    });
    if (newTitles.length > 0) {
      addSeenTitles?.(newTitles);
    }
    if (newTopics.length > 0) {
      setTimeout(() => onNewTopicsRef.current?.(newTopics), 0);
    }
    return addedCount;
  };

  // ── Fetch ──

  const fetchAllNews = async () => {
    if (manualFetchLockRef.current) return;
    manualFetchLockRef.current = true;
    setNewsFetching(true);
    setNotice("");
    try {
      const results = await fetchNews(newsSources);
      setNewsResults(results);
      const okCount = results.filter((r) => !r.error).length;
      const errCount = results.filter((r) => r.error).length;
      const allArticles = results.flatMap((r) => r.articles);
      const imported = importArticlesToTopics(allArticles);
      setNotice(
        `抓取完成：${okCount} 个源成功，${errCount} 个失败，共 ${allArticles.length} 篇文章，新增 ${imported} 条选题。`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setNotice(`新闻抓取失败：${msg}`);
    } finally {
      manualFetchLockRef.current = false;
      setNewsFetching(false);
    }
  };

  const fetchSingleSource = async (source: NewsSource) => {
    if (manualFetchLockRef.current) return;
    manualFetchLockRef.current = true;
    setNewsFetching(true);
    try {
      const results = await fetchNews([source]);
      setNewsResults((prev) => {
        const filtered = prev.filter((r) => r.source.id !== source.id);
        return [...filtered, ...results];
      });
      const r = results[0];
      if (r?.error) {
        setNotice(`${source.name} 抓取失败：${r.error}`);
      } else {
        const imported = importArticlesToTopics(r?.articles ?? []);
        setNotice(`${source.name} 抓取成功，${r?.articles.length ?? 0} 篇文章，新增 ${imported} 条选题。`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setNotice(`${source.name} 抓取失败：${msg}`);
    } finally {
      manualFetchLockRef.current = false;
      setNewsFetching(false);
    }
  };

  return {
    newsSources,
    newsResults,
    newsFetching,
    fetchAllNews,
    fetchSingleSource,
    addSource,
    updateSource,
    removeSource,
    resetSources,
    manualFetchLockRef,
  };
}
