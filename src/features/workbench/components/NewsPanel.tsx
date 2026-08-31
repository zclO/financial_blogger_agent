import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo } from "react";
import type { NewsArticle, NewsFetchResult, NewsSource } from "../types";

export function NewsPanel({
  sources,
  fetchResults,
  fetching,
  onFetchAll,
  onFetchSource,
  onArticleToTopic,
}: {
  sources: NewsSource[];
  fetchResults: NewsFetchResult[];
  fetching: boolean;
  onFetchAll: () => void;
  onFetchSource: (source: NewsSource) => void;
  onArticleToTopic: (article: NewsArticle) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, NewsSource[]>();
    for (const s of sources) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [sources]);

  const resultMap = useMemo(() => {
    const m = new Map<string, NewsFetchResult>();
    for (const r of fetchResults) m.set(r.source.id, r);
    return m;
  }, [fetchResults]);

  const totalArticles = fetchResults.reduce((sum, r) => sum + r.articles.length, 0);

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>新闻源</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalArticles > 0 && (
            <small style={{ color: "#666" }}>共 {totalArticles} 篇文章</small>
          )}
          <button onClick={onFetchAll} disabled={fetching}>
            {fetching ? "抓取中..." : "全部抓取"}
          </button>
        </div>
      </div>

      {/* Sources grouped by category */}
      {Array.from(grouped.entries()).map(([category, srcs]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>{category}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {srcs.map((s) => {
              const result = resultMap.get(s.id);
              const hasError = result?.error != null;
              const articleCount = result?.articles.length ?? 0;
              return (
                <button
                  key={s.id}
                  onClick={() => onFetchSource(s)}
                  disabled={fetching}
                  title={hasError ? (result?.error ?? "抓取失败") : `${s.name} (${articleCount} 篇)`}
                  style={{
                    padding: "6px 12px",
                    border: hasError ? "1px solid #e74c3c" : "1px solid #ccc",
                    borderRadius: 4,
                    background: result ? (hasError ? "#fff5f5" : "#f0fff4") : "#fff",
                    cursor: fetching ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  {s.name}
                  {result && (
                    <span style={{ marginLeft: 4, fontSize: 11, color: hasError ? "#e74c3c" : "#27ae60" }}>
                      {hasError ? "✗" : `${articleCount}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Articles list */}
      {fetchResults.flatMap((r) => r.articles).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>最新文章</h3>
          {fetchResults
            .filter((r) => r.articles.length > 0)
            .map((r) => (
              <div key={r.source.id} style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
                  {r.source.name}
                  <span style={{ fontWeight: "normal", marginLeft: 6, fontSize: 11, color: "#999" }}>
                    {r.articles.length} 篇
                  </span>
                </h4>
                {r.articles.slice(0, 10).map((article) => (
                  <div
                    key={article.id}
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                          color: "#2c3e50",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        onClick={() => {
                          if (article.link) void openUrl(article.link);
                        }}
                        title={article.title}
                      >
                        {article.title || "(无标题)"}
                      </div>
                      {article.summary && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#777",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {article.summary}
                        </div>
                      )}
                      {article.publishedAt && (
                        <small style={{ color: "#aaa", fontSize: 11 }}>
                          {new Date(article.publishedAt).toLocaleString("zh-CN", { hour12: false })}
                        </small>
                      )}
                    </div>
                    <button
                      onClick={() => onArticleToTopic(article)}
                      style={{ flexShrink: 0, fontSize: 12, padding: "4px 8px" }}
                      title="转为选题"
                    >
                      → 选题
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* Error summary */}
      {fetchResults.some((r) => r.error) && (
        <div style={{ marginTop: 12, padding: 8, background: "#fff5f5", borderRadius: 4, fontSize: 12 }}>
          <b>抓取失败的源：</b>
          {fetchResults
            .filter((r) => r.error)
            .map((r) => (
              <div key={r.source.id} style={{ color: "#e74c3c", marginTop: 2 }}>
                {r.source.name}: {r.error}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
