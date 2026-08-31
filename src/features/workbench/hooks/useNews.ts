import { useEffect, useState } from "react";

import { fetchNews, getDefaultNewsSources, type NewsFetchResult, type NewsSource } from "../../../lib/tauri";
import { DEFAULT_NEWS_SOURCES } from "../constants";
import type { Topic } from "../types";

export function useNews(setTopics: (fn: (prev: Topic[]) => Topic[]) => void, setNotice: (msg: string) => void) {
  const [newsSources, setNewsSources] = useState<NewsSource[]>(DEFAULT_NEWS_SOURCES);
  const [newsResults, setNewsResults] = useState<NewsFetchResult[]>([]);
  const [newsFetching, setNewsFetching] = useState(false);

  const importArticlesToTopics = (articles: { title: string; sourceName: string }[]): number => {
    let addedCount = 0;
    setTopics((prev) => {
      const existingTitles = new Set(prev.map((t) => t.title));
      const newTopics: Topic[] = [];
      for (const article of articles) {
        if (!article.title || existingTitles.has(article.title)) continue;
        existingTitles.add(article.title);
        newTopics.push({
          id: Date.now() + newTopics.length,
          title: article.title,
          source: `${article.sourceName}（RSS）`,
          verified: false,
        });
      }
      addedCount = newTopics.length;
      return newTopics.length > 0 ? [...newTopics, ...prev] : prev;
    });
    return addedCount;
  };

  const fetchAllNews = async () => {
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
      setNewsFetching(false);
    }
  };

  const fetchSingleSource = async (source: NewsSource) => {
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
      setNewsFetching(false);
    }
  };

  useEffect(() => {
    getDefaultNewsSources()
      .then((sources) => setNewsSources(sources))
      .catch(() => {/* keep DEFAULT_NEWS_SOURCES */});
  }, []);

  return {
    newsSources,
    newsResults,
    newsFetching,
    fetchAllNews,
    fetchSingleSource,
  };
}
