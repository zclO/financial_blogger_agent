import { useCallback, useMemo, useState } from "react";

import type { QueueEntryData, PublishResultItem } from "../../../lib/tauri";
import type { PublishState, QueueFilter } from "../types";

const FILTER_LABELS: { key: QueueFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unsent", label: "未发送" },
  { key: "sent", label: "已发送" },
];

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

function statusClass(status: string): string {
  switch (status) {
    case "sent": return "queue-status sent";
    case "failed": return "queue-status failed";
    case "scheduled": return "queue-status scheduled";
    case "sending": return "queue-status sending";
    default: return "queue-status pending";
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

export function QueuePanel({
  queueEntries,
  selectedEntryId,
  onSelectEntry,
  onDeleteEntry,
  onDeleteEntries,
  publishState,
  allowScheduledPublish,
  onToggleScheduled,
  scheduleAtInput,
  setScheduleAtInput,
  schedulePublish,
  cancelSchedule,
  publishNow,
  publishOutput,
  queueLogs,
}: {
  queueEntries: QueueEntryData[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteEntries: (ids: string[]) => void;
  publishState: PublishState;
  allowScheduledPublish: boolean;
  onToggleScheduled: (v: boolean) => void;
  scheduleAtInput: string;
  setScheduleAtInput: (v: string) => void;
  schedulePublish: () => void;
  cancelSchedule: () => void;
  publishNow: () => void;
  publishOutput: string;
  queueLogs: string[];
}) {
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);

  const filteredEntries = useMemo(() => {
    if (filter === "unsent") {
      return queueEntries.filter((e) => e.status !== "sent");
    }
    if (filter === "sent") {
      return queueEntries.filter((e) => e.status === "sent");
    }
    return queueEntries;
  }, [queueEntries, filter]);

  const selectedEntry = selectedEntryId
    ? queueEntries.find((e) => e.id === selectedEntryId) ?? null
    : null;

  const pendingCount = queueEntries.filter((e) => e.status !== "sent").length;
  const sentCount = queueEntries.filter((e) => e.status === "sent").length;

  // Entries that can be deleted (not sent, not sending)
  const deletableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of filteredEntries) {
      if (e.status !== "sent" && e.status !== "sending") ids.add(e.id);
    }
    return ids;
  }, [filteredEntries]);

  // Only keep checked IDs that are still visible & deletable
  const activeCheckedIds = useMemo(() => {
    const s = new Set<string>();
    for (const id of checkedIds) {
      if (deletableIds.has(id)) s.add(id);
    }
    return s;
  }, [checkedIds, deletableIds]);

  const allDeletableChecked = deletableIds.size > 0 && deletableIds.size === activeCheckedIds.size;

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setCheckedIds(new Set(deletableIds));
  }, [deletableIds]);

  const invertSelection = useCallback(() => {
    setCheckedIds((prev) => {
      const next = new Set<string>();
      for (const id of deletableIds) {
        if (!prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [deletableIds]);

  const enterDeleteMode = useCallback(() => {
    setDeleteMode(true);
    setCheckedIds(new Set());
  }, []);

  const exitDeleteMode = useCallback(() => {
    setDeleteMode(false);
    setCheckedIds(new Set());
  }, []);

  const confirmBatchDelete = useCallback(() => {
    const ids = Array.from(activeCheckedIds);
    if (ids.length === 0) return;
    onDeleteEntries(ids);
    setDeleteMode(false);
    setCheckedIds(new Set());
  }, [activeCheckedIds, onDeleteEntries]);

  const handleFilterChange = useCallback((key: QueueFilter) => {
    setFilter(key);
    setCheckedIds(new Set());
    setDeleteMode(false);
  }, []);

  return (
    <section className="panel queue-panel">
      <h2>发布队列</h2>

      {/* ── Filter tabs ── */}
      <div className="queue-filters">
        <div className="queue-filter-group">
          {FILTER_LABELS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "active" : ""}
              onClick={() => handleFilterChange(f.key)}
            >
              {f.label}
              {f.key === "all" && ` (${queueEntries.length})`}
              {f.key === "unsent" && ` (${pendingCount})`}
              {f.key === "sent" && ` (${sentCount})`}
            </button>
          ))}
        </div>
        {!deleteMode && deletableIds.size > 0 && (
          <button type="button" className="queue-manage-btn" onClick={enterDeleteMode}>
            删除
          </button>
        )}
      </div>

      {/* ── Delete mode toolbar ── */}
      {deleteMode && (
        <div className="queue-delete-bar">
          <div className="queue-delete-actions">
            <button type="button" className="queue-sel-btn" onClick={selectAll}>
              全选
            </button>
            <button type="button" className="queue-sel-btn" onClick={invertSelection}>
              反选
            </button>
            <span className="queue-sel-count">
              已选 {activeCheckedIds.size} / {deletableIds.size}
            </span>
          </div>
          <div className="queue-delete-confirm">
            <button
              type="button"
              className="queue-confirm-delete"
              disabled={activeCheckedIds.size === 0}
              onClick={confirmBatchDelete}
            >
              确认删除 ({activeCheckedIds.size})
            </button>
            <button type="button" className="queue-cancel-delete" onClick={exitDeleteMode}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── Queue list ── */}
      {filteredEntries.length === 0 && (
        <p className="hint">
          {filter === "all" && "暂无待发送内容。请先在内容工坊提交草稿。"}
          {filter === "unsent" && "没有未发送的稿件。"}
          {filter === "sent" && "没有已发送的稿件。"}
        </p>
      )}

      <div className="queue-list">
        {filteredEntries.map((entry) => (
          <div
            key={entry.id}
            className={`queue-item ${selectedEntryId === entry.id ? "selected" : ""} ${activeCheckedIds.has(entry.id) ? "checked" : ""}`}
            onClick={() => onSelectEntry(entry.id)}
          >
            <div className="queue-item-main">
              {deleteMode && entry.status !== "sent" && entry.status !== "sending" && (
                <input
                  type="checkbox"
                  className="queue-item-checkbox"
                  checked={activeCheckedIds.has(entry.id)}
                  onChange={(e) => { e.stopPropagation(); toggleCheck(entry.id); }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <span className="queue-item-title">{entry.title || "(无标题)"}</span>
              <span className={`queue-status-badge ${statusClass(entry.status)}`}>
                {statusLabel(entry.status)}
              </span>
              {!deleteMode && entry.status !== "sent" && entry.status !== "sending" && (
                <button
                  type="button"
                  className="queue-item-delete"
                  title="删除"
                  onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="queue-item-meta">
              <span className="queue-item-type">{publishTypeLabel(entry.publishType)}</span>
              {entry.sourceName && <span className="queue-item-source">{entry.sourceName}</span>}
              {entry.targetPlatforms && entry.targetPlatforms.length > 0 && (
                <span className="queue-item-platforms">
                  {entry.targetPlatforms.map((p) => (
                    <span key={p} className="platform-badge">{platformShortName(p)}</span>
                  ))}
                </span>
              )}
              <span className="queue-item-time">{entry.createdAt}</span>
              {entry.symbols.length > 0 && (
                <span className="queue-item-symbols">
                  {entry.symbols.slice(0, 3).map((s) => `#${s}`).join(" ")}
                  {entry.symbols.length > 3 && ` +${entry.symbols.length - 3}`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Detail view for selected entry ── */}
      {selectedEntry && (
        <div className="queue-detail">
          <hr />
          <h3>稿件详情</h3>

          <div className="kv">
            <span className="key">标题</span>
            <span className="value">{selectedEntry.title || "(无标题)"}</span>
          </div>
          <div className="kv">
            <span className="key">内容类型</span>
            <span className="value">{publishTypeLabel(selectedEntry.publishType)}</span>
          </div>
          {selectedEntry.sourceName && (
            <div className="kv">
              <span className="key">新闻来源</span>
              <span className="value">{selectedEntry.sourceName}</span>
            </div>
          )}
          {selectedEntry.publishType === "video" && selectedEntry.videoSourceType === "url" && (
            <div className="kv">
              <span className="key">视频链接</span>
              <span className="value">{selectedEntry.videoUrl}</span>
            </div>
          )}
          {selectedEntry.publishType === "video" && selectedEntry.videoSourceType === "local" && (
            <div className="kv">
              <span className="key">本地视频文件</span>
              <span className="value">{selectedEntry.videoFilePath}</span>
            </div>
          )}
          <div className="kv">
            <span className="key">目标平台</span>
            <span className="value">
              {selectedEntry.targetPlatforms?.length > 0
                ? selectedEntry.targetPlatforms.map(platformShortName).join(", ")
                : "Binance Square"}
            </span>
          </div>
          {selectedEntry.platformResults && selectedEntry.platformResults.length > 0 && (
            <div className="platform-results">
              <h4>平台发送结果</h4>
              {selectedEntry.platformResults.map((r) => (
                <div key={r.platform} className={`platform-result-row ${r.success ? "ok" : "err"}`}>
                  <span className="platform-name">{platformShortName(r.platform)}</span>
                  <span className="platform-status">{r.success ? "✓ 成功" : "✗ 失败"}</span>
                  <span className="platform-msg">{r.message}</span>
                </div>
              ))}
            </div>
          )}
          <div className="kv">
            <span className="key">发送状态</span>
            <span className={`status ${selectedEntry.status === "sent" ? "ok" : ""}`}>
              {statusLabel(selectedEntry.status)}
            </span>
          </div>
          <div className="kv">
            <span className="key">提交时间</span>
            <span className="value">{selectedEntry.createdAt}</span>
          </div>
          {selectedEntry.sentAt && (
            <div className="kv">
              <span className="key">发送时间</span>
              <span className="value">{selectedEntry.sentAt}</span>
            </div>
          )}
          <p className="hint">
            发送标签：{selectedEntry.symbols.map((s) => `#${s} $${s}`).join(" ")}
          </p>

          <details>
            <summary>查看最终发送文本</summary>
            <pre className="output">{selectedEntry.finalBody}</pre>
          </details>

          {/* ── Publishing controls (only for unsent entries) ── */}
          {selectedEntry.status !== "sent" && (
            <>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={allowScheduledPublish}
                  onChange={(e) => onToggleScheduled(e.target.checked)}
                />
                允许执行定时发送（人工暂停开关）
              </label>
              <label>
                发送时间
                <input
                  type="datetime-local"
                  value={scheduleAtInput}
                  onChange={(e) => setScheduleAtInput(e.target.value)}
                />
              </label>
              <div className="actions">
                <button disabled={publishState === "sending"} onClick={schedulePublish}>
                  设置定时发送
                </button>
                <button
                  disabled={publishState === "sending" || publishState !== "scheduled"}
                  onClick={cancelSchedule}
                >
                  取消定时
                </button>
                <button disabled={publishState === "sending"} onClick={publishNow}>
                  立即发送
                </button>
                <button
                  className="danger"
                  disabled={publishState === "sending"}
                  onClick={() => onDeleteEntry(selectedEntry.id)}
                >
                  删除
                </button>
              </div>
              {publishOutput && <pre className="output">{publishOutput}</pre>}
            </>
          )}

          {/* ── Entry-specific logs ── */}
          {selectedEntry.logs.length > 0 && (
            <div className="log-list">
              <h3>发送日志</h3>
              {selectedEntry.logs.map((log, i) => (
                <p key={`${selectedEntry.id}-log-${i}`}>{log}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Activity log ── */}
      <div className="log-list">
        <h3>执行日志</h3>
        {queueLogs.length === 0 && <p>暂无日志。</p>}
        {queueLogs.map((log) => (
          <p key={log}>{log}</p>
        ))}
      </div>
    </section>
  );
}

function platformShortName(platformId: string): string {
  switch (platformId) {
    case "binance_square": return "Square";
    case "x_twitter": return "X";
    default: return platformId;
  }
}
