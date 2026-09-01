import { useMemo, useState } from "react";

import type { QueueEntryData } from "../../../lib/tauri";
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

  return (
    <section className="panel queue-panel">
      <h2>发布队列</h2>

      {/* ── Filter tabs ── */}
      <div className="queue-filters">
        {FILTER_LABELS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? "active" : ""}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === "all" && ` (${queueEntries.length})`}
            {f.key === "unsent" && ` (${pendingCount})`}
            {f.key === "sent" && ` (${sentCount})`}
          </button>
        ))}
      </div>

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
            className={`queue-item ${selectedEntryId === entry.id ? "selected" : ""}`}
            onClick={() => onSelectEntry(entry.id)}
          >
            <div className="queue-item-main">
              <span className="queue-item-title">{entry.title || "(无标题)"}</span>
              <span className={`queue-status-badge ${statusClass(entry.status)}`}>
                {statusLabel(entry.status)}
              </span>
            </div>
            <div className="queue-item-meta">
              <span className="queue-item-type">{publishTypeLabel(entry.publishType)}</span>
              {entry.sourceName && <span className="queue-item-source">{entry.sourceName}</span>}
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
