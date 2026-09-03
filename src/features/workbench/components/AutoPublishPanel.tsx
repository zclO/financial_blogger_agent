import { useMemo } from "react";

import type { QueueEntryData, PlatformConfig, PlatformId } from "../../../lib/tauri";
import type { AutoPublishConfig, SavedPipeline } from "../types";

function statusLabel(status: string): string {
  switch (status) {
    case "pending": return "待发送";
    case "scheduled": return "已定时";
    case "sending": return "发送中";
    case "sent": return "已发送";
    case "failed": return "发送失败";
    default: return status;
  }
}

function publishTypeLabel(t: string): string {
  switch (t) {
    case "post": return "帖子";
    case "article": return "文章";
    case "video": return "视频";
    default: return t;
  }
}

export function AutoPublishPanel({
  autoPublish,
  queueEntries,
  queueLogs,
  keyConfigured,
  savedPipelines,
  platformConfigs,
  onToggle,
  onSetInterval,
  onSetPipeline,
  onMoveSource,
  onRemoveSource,
  onAddSource,
  onSetTargetPlatforms,
}: {
  autoPublish: AutoPublishConfig;
  queueEntries: QueueEntryData[];
  queueLogs: string[];
  keyConfigured: boolean;
  savedPipelines: SavedPipeline[];
  platformConfigs: PlatformConfig[];
  onToggle: (v: boolean) => void;
  onSetInterval: (minutes: number) => void;
  onSetPipeline: (pipelineId: string | null) => void;
  onMoveSource: (index: number, direction: -1 | 1) => void;
  onRemoveSource: (sourceName: string) => void;
  onAddSource: (sourceName: string) => void;
  onSetTargetPlatforms: (platforms: PlatformId[]) => void;
}) {
  // ── Derived stats ──
  const stats = useMemo(() => {
    const pending = queueEntries.filter((e) => e.status === "pending");
    const sent = queueEntries.filter((e) => e.status === "sent");
    const failed = queueEntries.filter((e) => e.status === "failed");

    // Group pending by source
    const bySource = new Map<string, number>();
    for (const e of pending) {
      const src = e.sourceName || "(无来源)";
      bySource.set(src, (bySource.get(src) ?? 0) + 1);
    }

    // All unique sources from all entries
    const allSources = new Set<string>();
    for (const e of queueEntries) {
      if (e.sourceName) allSources.add(e.sourceName);
    }

    return { pending, sent, failed, bySource, allSources: [...allSources] };
  }, [queueEntries]);

  const selectedPipelineName = useMemo(() => {
    if (!autoPublish.pipelineId) return null;
    return savedPipelines.find((p) => p.id === autoPublish.pipelineId)?.name ?? null;
  }, [autoPublish.pipelineId, savedPipelines]);

  // Sources not yet in priority list
  const unassignedSources = useMemo(
    () => stats.allSources.filter((s) => !autoPublish.sourcePriority.includes(s)),
    [stats.allSources, autoPublish.sourcePriority],
  );

  // Auto-publish logs (entries with "自动发布" in their logs)
  const autoLogs = useMemo(
    () => queueLogs.filter((l) => l.includes("自动发布")).slice(0, 20),
    [queueLogs],
  );

  return (
    <section className="panel auto-publish-panel">
      <h2>全流程自动发布</h2>

      {/* ── Master toggle ── */}
      <div className={`auto-toggle-card ${autoPublish.enabled ? "active" : ""}`}>
        <div className="auto-toggle-main">
          <div>
            <span className={`auto-status-dot ${autoPublish.enabled ? "on" : "off"}`} />
            <span className="auto-status-label">{autoPublish.enabled ? "运行中" : "已停止"}</span>
          </div>
          <label className="inline auto-toggle-switch">
            <input
              type="checkbox"
              checked={autoPublish.enabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            {autoPublish.enabled ? "关闭自动发布" : "开启自动发布"}
          </label>
        </div>
        {autoPublish.enabled && (
          <p className="auto-toggle-hint">
            每 {autoPublish.intervalMinutes} 分钟执行一次：自动抓取新闻 → 流水线加工 → 入队 → 发送，按来源优先级轮换发布。
          </p>
        )}
      </div>

      {/* ── Stats grid ── */}
      <div className="auto-stats-grid">
        <div className="auto-stat">
          <small>发布频率</small>
          <strong>{autoPublish.intervalMinutes} 分钟</strong>
        </div>
        <div className="auto-stat">
          <small>待发送</small>
          <strong>{stats.pending.length}</strong>
        </div>
        <div className="auto-stat">
          <small>已发送</small>
          <strong>{stats.sent.length}</strong>
        </div>
        <div className="auto-stat">
          <small>发送失败</small>
          <strong>{stats.failed.length}</strong>
        </div>
        <div className="auto-stat">
          <small>上次发布来源</small>
          <strong>{autoPublish.lastSourceName || "—"}</strong>
        </div>
        <div className="auto-stat">
          <small>上次发布时间</small>
          <strong>{autoPublish.lastTime || "—"}</strong>
        </div>
        <div className="auto-stat">
          <small>加工流水线</small>
          <strong>{selectedPipelineName || "未指定"}</strong>
        </div>
      </div>

      {!keyConfigured && (
        <div className="subnotice warning">
          Square OpenAPI Key 尚未配置，自动发布无法执行。请前往"设置"页面配置。
        </div>
      )}

      <hr />

      {/* ── Target platforms for auto-publish ── */}
      <h3>自动发布同步平台</h3>
      <p className="hint">
        自动发布时，内容将同步发送到以下平台。未配置凭证的平台无法选择。
      </p>
      <div className="platform-selector">
        <label className="platform-option">
          <input
            type="checkbox"
            checked={autoPublish.targetPlatforms.includes("binance_square")}
            disabled={!keyConfigured}
            onChange={(e) => {
              const next = e.target.checked
                ? [...autoPublish.targetPlatforms, "binance_square"]
                : autoPublish.targetPlatforms.filter((p) => p !== "binance_square");
              onSetTargetPlatforms(next as PlatformId[]);
            }}
          />
          Binance Square
          {!keyConfigured && <em className="hint"> 未配置</em>}
        </label>
        <label className="platform-option">
          <input
            type="checkbox"
            checked={autoPublish.targetPlatforms.includes("x_twitter")}
            disabled={!isPlatformConfigured(platformConfigs, "x_twitter")}
            onChange={(e) => {
              const next = e.target.checked
                ? [...autoPublish.targetPlatforms, "x_twitter"]
                : autoPublish.targetPlatforms.filter((p) => p !== "x_twitter");
              onSetTargetPlatforms(next as PlatformId[]);
            }}
          />
          X (Twitter)
          {!isPlatformConfigured(platformConfigs, "x_twitter") && <em className="hint"> 未配置</em>}
        </label>
      </div>
      {autoPublish.targetPlatforms.length === 0 && (
        <p className="hint warning">请至少选择一个自动发布平台。</p>
      )}

      <hr />

      {/* ── Configuration ── */}
      <h3>发布配置</h3>
      <label>
        发布间隔（分钟）
        <input
          type="number"
          min={1}
          max={1440}
          value={autoPublish.intervalMinutes}
          onChange={(e) => onSetInterval(Number(e.target.value) || 30)}
          style={{ width: 120 }}
        />
      </label>
      <p className="hint">
        系统每隔设定时间执行：抓取新闻 → 流水线加工 → 自动入队 → 发送。最小间隔 1 分钟，最大 1440 分钟（24 小时）。
      </p>

      <hr />

      {/* ── Pipeline selector ── */}
      <h3>加工流水线</h3>
      <p className="hint">
        自动发布将使用所选流水线对抓取到的新闻进行加工，生成发布内容。
        若未选择流水线，将直接使用原始文章入队。
      </p>
      <label>
        指定流水线
        <select
          value={autoPublish.pipelineId ?? ""}
          onChange={(e) => onSetPipeline(e.target.value || null)}
          style={{ minWidth: 200 }}
        >
          <option value="">（不使用流水线，直接入队）</option>
          {savedPipelines.map((pl) => (
            <option key={pl.id} value={pl.id}>{pl.name}</option>
          ))}
        </select>
      </label>
      {autoPublish.pipelineId && !savedPipelines.some((p) => p.id === autoPublish.pipelineId) && (
        <p className="hint warning">所选流水线不存在，请重新选择。</p>
      )}

      <hr />

      {/* ── Source priority ── */}
      <h3>来源发布优先级</h3>
      <p className="hint">
        优先发布排在列表前方的新闻源内容。未列入的来源按默认顺序排在后面。
        拖拽或使用箭头调整顺序。
      </p>

      {autoPublish.sourcePriority.length === 0 && unassignedSources.length === 0 && (
        <p className="hint">暂无来源。提交稿件到队列后，来源将自动出现。</p>
      )}

      {autoPublish.sourcePriority.length > 0 && (
        <div className="auto-priority-list">
          {autoPublish.sourcePriority.map((src, idx) => (
            <div key={src} className="auto-priority-item">
              <span className="auto-priority-rank">#{idx + 1}</span>
              <span className="auto-priority-name">{src}</span>
              <span className="auto-priority-count">{stats.bySource.get(src) ?? 0} 篇待发</span>
              <div className="auto-priority-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={idx === 0}
                  onClick={() => onMoveSource(idx, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={idx === autoPublish.sourcePriority.length - 1}
                  onClick={() => onMoveSource(idx, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onRemoveSource(src)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unassignedSources.length > 0 && (
        <div className="auto-unassigned">
          <p className="hint">未排序的来源（点击添加到优先级列表）：</p>
          <div className="auto-chips">
            {unassignedSources.map((src) => (
              <button
                key={src}
                type="button"
                className="tag-chip"
                onClick={() => onAddSource(src)}
              >
                + {src}
                {(stats.bySource.get(src) ?? 0) > 0 && (
                  <em>{stats.bySource.get(src)} 篇</em>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <hr />

      {/* ── Pending entries by source ── */}
      <h3>队列来源分布</h3>
      {stats.pending.length === 0 && <p className="hint">队列中无待发送稿件。</p>}
      {stats.pending.length > 0 && (
        <div className="auto-source-breakdown">
          {[...stats.bySource.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => (
              <div key={src} className="auto-source-row">
                <span className="auto-source-name">{src}</span>
                <div className="auto-source-bar-wrap">
                  <div
                    className="auto-source-bar"
                    style={{ width: `${Math.max(4, (count / stats.pending.length) * 100)}%` }}
                  />
                </div>
                <span className="auto-source-count">{count} 篇</span>
              </div>
            ))}
        </div>
      )}

      <hr />

      {/* ── Auto-publish log ── */}
      <h3>自动发布日志</h3>
      <div className="log-list">
        {autoLogs.length === 0 && <p>暂无自动发布记录。</p>}
        {autoLogs.map((log, i) => (
          <p key={`auto-log-${i}`}>{log}</p>
        ))}
      </div>
    </section>
  );
}

function isPlatformConfigured(configs: PlatformConfig[], platformId: PlatformId): boolean {
  const p = configs.find((c) => c.platform === platformId);
  if (!p) return false;
  if (!p.enabled) return false;
  const keys = Object.keys(p.credentials);
  return keys.length > 0 && keys.some((k) => p.credentials[k] !== "");
}
