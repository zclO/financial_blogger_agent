import type { Draft, PublishState } from "../types";

export function QueuePanel({
  draft,
  publishState,
  allSymbols,
  finalPublishBody,
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
  draft: Draft;
  publishState: PublishState;
  allSymbols: string[];
  finalPublishBody: string;
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
  return (
    <section className="panel settings">
      <h2>发布队列</h2>
      {!draft.queued && <p>暂无待发送内容。请先在内容工坊提交草稿。</p>}
      {draft.queued && (
        <>
          <div className="kv">
            <span className="key">队列稿件</span>
            <span className="value">{draft.title || "(无标题)"}</span>
          </div>
          <div className="kv">
            <span className="key">内容类型</span>
            <span className="value">{draft.publishType}</span>
          </div>
          {draft.publishType === "video" && (
            <div className="kv">
              <span className="key">视频来源</span>
              <span className="value">{draft.videoSourceType === "local" ? "本地文件上传" : "视频链接"}</span>
            </div>
          )}
          {draft.publishType === "video" && draft.videoSourceType === "url" && (
            <div className="kv">
              <span className="key">视频链接</span>
              <span className="value">{draft.videoUrl}</span>
            </div>
          )}
          {draft.publishType === "video" && draft.videoSourceType === "local" && (
            <div className="kv">
              <span className="key">本地视频文件</span>
              <span className="value">{draft.videoFilePath}</span>
            </div>
          )}
          <div className="kv">
            <span className="key">发送状态</span>
            <span className={`status ${publishState === "sent" ? "ok" : ""}`}>
              {publishState === "idle" && "待发送"}
              {publishState === "scheduled" && "已定时"}
              {publishState === "sending" && "发送中"}
              {publishState === "sent" && "已发送"}
              {publishState === "failed" && "发送失败"}
            </span>
          </div>
          <p className="hint">本次发送标签：{allSymbols.map((s) => `#${s} $${s}`).join(" ")}</p>
          <details>
            <summary>查看最终发送文本</summary>
            <pre className="output">{finalPublishBody}</pre>
          </details>
          <label className="inline">
            <input type="checkbox" checked={allowScheduledPublish} onChange={(e) => onToggleScheduled(e.target.checked)} />
            允许执行定时发送（人工暂停开关）
          </label>
          <label>
            发送时间
            <input type="datetime-local" value={scheduleAtInput} onChange={(e) => setScheduleAtInput(e.target.value)} />
          </label>
          <div className="actions">
            <button disabled={publishState === "sending"} onClick={schedulePublish}>
              设置定时发送
            </button>
            <button disabled={publishState === "sending" || publishState !== "scheduled"} onClick={cancelSchedule}>
              取消定时
            </button>
            <button disabled={publishState === "sending"} onClick={publishNow}>
              立即发送
            </button>
          </div>
          {publishOutput && <pre className="output">{publishOutput}</pre>}
          <div className="log-list">
            <h3>执行日志</h3>
            {queueLogs.length === 0 && <p>暂无日志。</p>}
            {queueLogs.map((log) => (
              <p key={log}>{log}</p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
