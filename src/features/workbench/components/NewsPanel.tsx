import { openUrl } from "@tauri-apps/plugin-opener";
import { useMemo, useState } from "react";
import type { NewsArticle, NewsFetchResult, NewsSource } from "../types";

export function NewsPanel({
  sources,
  fetchResults,
  fetching,
  onFetchAll,
  onFetchSource,
  onArticleToTopic,
  onAddSource,
  onUpdateSource,
  onRemoveSource,
  onResetSources,
}: {
  sources: NewsSource[];
  fetchResults: NewsFetchResult[];
  fetching: boolean;
  onFetchAll: () => void;
  onFetchSource: (source: NewsSource) => void;
  onArticleToTopic: (article: NewsArticle) => void;
  onAddSource: (source: NewsSource) => void;
  onUpdateSource: (id: string, patch: Partial<NewsSource>) => void;
  onRemoveSource: (id: string) => void;
  onResetSources: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFetchLog, setShowFetchLog] = useState(false);

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
  const okCount = fetchResults.filter((r) => !r.error).length;
  const errCount = fetchResults.filter((r) => r.error).length;
  const hasFetched = fetchResults.length > 0;

  return (
    <section className="panel news-panel">
      {/* ── Header ── */}
      <div className="news-header">
        <div className="news-header-left">
          <h2>新闻源</h2>
          {totalArticles > 0 && (
            <span className="news-header-badge">{totalArticles} 篇文章</span>
          )}
          {errCount > 0 && (
            <span className="news-header-badge err">{errCount} 个失败</span>
          )}
        </div>
        <div className="news-header-actions">
          <button className="news-btn-ghost" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "取消" : "＋ 添加"}
          </button>
          <button className="news-btn-ghost" onClick={onResetSources} title="恢复为默认新闻源">
            ↺ 重置
          </button>
          {hasFetched && (
            <button
              className="news-btn-ghost"
              onClick={() => setShowFetchLog((v) => !v)}
            >
              {showFetchLog ? "隐藏日志" : "📋 抓取日志"}
            </button>
          )}
          <button className="news-btn-primary" onClick={onFetchAll} disabled={fetching}>
            {fetching ? "抓取中…" : "▶ 全部抓取"}
          </button>
        </div>
      </div>

      {/* ── Add Source Form ── */}
      {showAddForm && (
        <AddSourceForm
          onAdd={(s) => { onAddSource(s); setShowAddForm(false); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ── Fetch Log ── */}
      {showFetchLog && hasFetched && (
        <FetchLogPanel results={fetchResults} />
      )}

      {/* ── Sources grouped by category ── */}
      {Array.from(grouped.entries()).map(([category, srcs]) => {
        const catResults = srcs.map((s) => resultMap.get(s.id)).filter(Boolean) as NewsFetchResult[];
        const catArticles = catResults.reduce((sum, r) => sum + r.articles.length, 0);
        const catErr = catResults.filter((r) => r.error).length;

        return (
          <div key={category} className="news-category">
            <div className="news-category-header">
              <span className="news-category-name">{category}</span>
              <span className="news-category-meta">{srcs.length} 个源</span>
              {catArticles > 0 && (
                <span className="news-category-meta ok">{catArticles} 篇</span>
              )}
              {catErr > 0 && (
                <span className="news-category-meta err">{catErr} 失败</span>
              )}
            </div>
            <div className="news-source-list">
              {srcs.map((s) => {
                const result = resultMap.get(s.id);
                const hasError = result?.error != null;
                const articleCount = result?.articles.length ?? 0;
                const isEditing = editingId === s.id;

                if (isEditing) {
                  return (
                    <EditSourceRow
                      key={s.id}
                      source={s}
                      onSave={(patch) => { onUpdateSource(s.id, patch); setEditingId(null); }}
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }

                return (
                  <div key={s.id} className={`news-source-row ${hasError ? "has-error" : ""} ${result ? "fetched" : ""}`}>
                    <button
                      className="news-source-btn"
                      onClick={() => onFetchSource(s)}
                      disabled={fetching}
                      title={hasError ? (result?.error ?? "抓取失败") : `${s.name} — 点击抓取`}
                    >
                      <span className="news-source-indicator" />
                      <span className="news-source-name">{s.name}</span>
                      {result && (
                        <span className={`news-source-count ${hasError ? "error" : "ok"}`}>
                          {hasError ? "✗" : articleCount}
                        </span>
                      )}
                    </button>
                    <div className="news-source-actions">
                      <button
                        className="news-src-act-edit"
                        title="编辑"
                        onClick={() => setEditingId(s.id)}
                      >✎</button>
                      <button
                        className="news-src-act-del"
                        title="删除"
                        onClick={() => { if (confirm(`确定删除「${s.name}」？`)) onRemoveSource(s.id); }}
                      >✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Articles list ── */}
      {fetchResults.flatMap((r) => r.articles).length > 0 && (
        <div className="news-articles-section">
          <h3 className="news-articles-title">最新文章</h3>
          {fetchResults
            .filter((r) => r.articles.length > 0)
            .map((r) => (
              <div key={r.source.id} className="news-articles-source">
                <h4 className="news-articles-source-name">
                  {r.source.name}
                  <span className="news-articles-source-count">{r.articles.length} 篇</span>
                </h4>
                {r.articles.slice(0, 10).map((article) => (
                  <div key={article.id} className="news-article-row">
                    <div className="news-article-main">
                      <div
                        className="news-article-title"
                        onClick={() => { if (article.link) void openUrl(article.link); }}
                        title={article.title}
                      >
                        {article.title || "(无标题)"}
                      </div>
                      {article.summary && (
                        <div className="news-article-summary">{article.summary}</div>
                      )}
                      {article.publishedAt && (
                        <small className="news-article-time">
                          {new Date(article.publishedAt).toLocaleString("zh-CN", { hour12: false })}
                        </small>
                      )}
                    </div>
                    <button
                      className="news-article-convert"
                      onClick={() => onArticleToTopic(article)}
                      title="转为选题"
                    >→ 选题</button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── Error summary ── */}
      {fetchResults.some((r) => r.error) && (
        <div className="news-error-summary">
          <b>抓取失败的源：</b>
          {fetchResults
            .filter((r) => r.error)
            .map((r) => (
              <div key={r.source.id}>{r.source.name}: {r.error}</div>
            ))}
        </div>
      )}
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Fetch Log Panel
// ══════════════════════════════════════════════════════════════

function FetchLogPanel({ results }: { results: NewsFetchResult[] }) {
  const okResults = results.filter((r) => !r.error);
  const errResults = results.filter((r) => r.error);

  return (
    <div className="news-fetch-log">
      <div className="news-fetch-log-header">
        <span className="news-fetch-log-title">抓取日志</span>
        <span className="news-fetch-log-summary">
          共 {results.length} 个源，成功 {okResults.length}，失败 {errResults.length}，
          合计 {results.reduce((s, r) => s + r.articles.length, 0)} 篇文章
        </span>
      </div>
      <div className="news-fetch-log-list">
        {results.map((r) => (
          <div key={r.source.id} className={`news-fetch-log-entry ${r.error ? "err" : "ok"}`}>
            <span className="news-fetch-log-status">{r.error ? "✗" : "✓"}</span>
            <span className="news-fetch-log-name">{r.source.name}</span>
            {r.error ? (
              <span className="news-fetch-log-detail err-text">{r.error}</span>
            ) : (
              <span className="news-fetch-log-detail">{r.articles.length} 篇文章</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Add Source Form
// ══════════════════════════════════════════════════════════════

function AddSourceForm({
  onAdd,
  onCancel,
}: {
  onAdd: (source: NewsSource) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    const trimName = name.trim();
    const trimUrl = url.trim();
    if (!trimName || !trimUrl) return;
    const id = `custom-${Date.now()}`;
    onAdd({ id, name: trimName, category: category.trim() || "自定义", url: trimUrl });
    setName("");
    setCategory("");
    setUrl("");
  };

  return (
    <div className="news-source-form">
      <div className="news-source-form-title">添加新闻源</div>
      <div className="news-source-form-fields">
        <div className="news-field">
          <label className="news-field-label">名称 <span className="req">*</span></label>
          <input
            placeholder="如：CoinDesk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div className="news-field">
          <label className="news-field-label">分类</label>
          <input
            placeholder="如：加密货币、宏观经济"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div className="news-field" style={{ flex: 2 }}>
          <label className="news-field-label">RSS / Atom URL <span className="req">*</span></label>
          <input
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
      </div>
      <div className="news-source-form-actions">
        <button className="news-btn-primary" onClick={handleAdd} disabled={!name.trim() || !url.trim()}>
          添加
        </button>
        <button className="news-btn-ghost" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Edit Source Row (inline)
// ══════════════════════════════════════════════════════════════

function EditSourceRow({
  source,
  onSave,
  onCancel,
}: {
  source: NewsSource;
  onSave: (patch: Partial<NewsSource>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(source.name);
  const [category, setCategory] = useState(source.category);
  const [url, setUrl] = useState(source.url);

  const handleSave = () => {
    const trimName = name.trim();
    const trimUrl = url.trim();
    if (!trimName || !trimUrl) return;
    onSave({ name: trimName, category: category.trim() || source.category, url: trimUrl });
  };

  return (
    <div className="news-source-row editing">
      <div className="news-source-form-fields edit-inline" style={{ flex: 1 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名称"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="分类"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          style={{ flex: 2 }}
        />
      </div>
      <div className="news-source-actions visible">
        <button className="news-src-act-save" title="保存" onClick={handleSave}>✓</button>
        <button className="news-src-act-cancel" title="取消" onClick={onCancel}>✕</button>
      </div>
    </div>
  );
}
