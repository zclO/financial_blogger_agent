import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadDraftStore,
  loadPublishQueue,
  publishBinanceSquareText,
  publishBinanceSquareVideoFile,
  saveDraftStore,
  savePublishQueue,
  type BinanceSquareConfig,
  type QueueEntryData,
} from "../../../lib/tauri";
import type { Draft, PublishState, QueueEntryStatus } from "../types";
import { nowText } from "../utils";

export function usePublishing(
  draft: Draft,
  setDraft: React.Dispatch<React.SetStateAction<Draft>>,
  validateDraft: () => string | null,
  finalPublishBody: string,
  squareConfig: BinanceSquareConfig | null,
  setNotice: (msg: string) => void,
  setTab: (tab: "发布队列") => void,
) {
  const [queueEntries, setQueueEntries] = useState<QueueEntryData[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [allowScheduledPublish, setAllowScheduledPublish] = useState(false);
  const [scheduleAtInput, setScheduleAtInput] = useState("");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishOutput, setPublishOutput] = useState("");
  const [queueLogs, setQueueLogs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  // ── Load from persistence on mount ──
  useEffect(() => {
    Promise.all([loadDraftStore(), loadPublishQueue()])
      .then(([draftStore, queueStore]) => {
        if (draftStore.draft) {
          setDraft({
            title: draftStore.draft.title,
            body: draftStore.draft.body,
            reviewed: draftStore.draft.reviewed,
            queued: draftStore.draft.queued,
            publishType: draftStore.draft.publishType as Draft["publishType"],
            videoSourceType: draftStore.draft.videoSourceType as Draft["videoSourceType"],
            videoUrl: draftStore.draft.videoUrl,
            videoFilePath: draftStore.draft.videoFilePath,
          });
        }
        setQueueLogs(draftStore.queueLogs);
        setPublishState((draftStore.publishState as PublishState) || "idle");
        setPublishOutput(draftStore.publishOutput);
        setScheduleAtInput(draftStore.scheduleAtInput);
        setAllowScheduledPublish(draftStore.allowScheduledPublish);

        setQueueEntries(queueStore.entries);
        // Auto-select the first pending entry, or the first entry
        if (queueStore.entries.length > 0) {
          const pending = queueStore.entries.find((e) => e.status === "pending" || e.status === "scheduled");
          setSelectedEntryId(pending?.id ?? queueStore.entries[0].id);
        }
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, [setDraft]);

  // ── Debounced save when state changes ──
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      Promise.all([
        saveDraftStore({
          draft: {
            title: draftRef.current.title,
            body: draftRef.current.body,
            reviewed: draftRef.current.reviewed,
            queued: draftRef.current.queued,
            publishType: draftRef.current.publishType,
            videoSourceType: draftRef.current.videoSourceType,
            videoUrl: draftRef.current.videoUrl,
            videoFilePath: draftRef.current.videoFilePath,
          },
          queueLogs,
          publishState,
          publishOutput,
          scheduleAtInput,
          allowScheduledPublish,
        }),
        savePublishQueue({ entries: queueEntries }),
      ]).catch((err) => console.error("Failed to save:", err));
    }, 800);
    return () => clearTimeout(timer);
  }, [queueEntries, queueLogs, publishState, publishOutput, scheduleAtInput, allowScheduledPublish, loaded]);

  const appendQueueLog = useCallback((content: string) => {
    setQueueLogs((prev) => [`[${nowText()}] ${content}`, ...prev].slice(0, 50));
  }, []);

  const appendEntryLog = useCallback((entryId: string, content: string) => {
    setQueueEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, logs: [`[${nowText()}] ${content}`, ...e.logs] } : e,
      ),
    );
  }, []);

  const updateEntryStatus = useCallback((entryId: string, status: QueueEntryStatus, extra?: Partial<QueueEntryData>) => {
    setQueueEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, status, ...extra } : e)),
    );
  }, []);

  // ── Add draft to queue ──
  const addToQueue = useCallback((
    draftData: Draft,
    finalBody: string,
    symbols: string[],
  ): string | null => {
    const entryId = `qe-${Date.now()}`;
    const newEntry: QueueEntryData = {
      id: entryId,
      title: draftData.title,
      body: draftData.body,
      finalBody,
      publishType: draftData.publishType,
      videoSourceType: draftData.videoSourceType,
      videoUrl: draftData.videoUrl,
      videoFilePath: draftData.videoFilePath,
      symbols,
      status: "pending",
      createdAt: nowText(),
      sentAt: null,
      logs: [],
    };
    setQueueEntries((prev) => [newEntry, ...prev]);
    setSelectedEntryId(entryId);
    appendQueueLog(`新稿件加入队列：${draftData.title || "(无标题)"}；类型：${draftData.publishType}；标签：${symbols.join(", ")}`);
    return null;
  }, [appendQueueLog]);

  // ── Publish a specific queue entry ──
  const publishEntry = useCallback(async (entryId: string, trigger: "manual" | "scheduled") => {
    const entry = queueEntries.find((e) => e.id === entryId);
    if (!entry) {
      setNotice("未找到该队列条目。");
      return;
    }
    if (entry.status === "sent") {
      setNotice("该稿件已发送。");
      return;
    }
    if (!squareConfig?.keyConfigured) {
      setNotice("Square OpenAPI Key 未配置，无法发送。");
      return;
    }

    updateEntryStatus(entryId, "sending");
    setPublishState("sending");
    setPublishOutput("");
    appendEntryLog(entryId, trigger === "scheduled" ? "定时任务开始执行发送..." : "开始手动发送...");

    try {
      const result =
        entry.publishType === "video" && entry.videoSourceType === "local"
          ? await publishBinanceSquareVideoFile({
              title: entry.title || undefined,
              text: entry.finalBody,
              videoPath: entry.videoFilePath,
            })
          : await publishBinanceSquareText({
              title: entry.title || undefined,
              text: entry.finalBody,
              contentType: entry.publishType as "post" | "article" | "video",
              videoUrl: entry.publishType === "video" ? entry.videoUrl : undefined,
            });

      setPublishOutput(result.trim());
      setPublishState("sent");
      updateEntryStatus(entryId, "sent", { sentAt: nowText() });
      appendEntryLog(entryId, trigger === "scheduled" ? "定时发送成功。" : "手动发送成功。");
      appendQueueLog(trigger === "scheduled" ? `定时发送成功：${entry.title || "(无标题)"}` : `手动发送成功：${entry.title || "(无标题)"}`);
      setNotice("发送成功。");

      // If this was the current draft, clear the queued state
      if (draftRef.current.queued && draftRef.current.title === entry.title) {
        setDraft((prev) => ({ ...prev, queued: false }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPublishOutput(message);
      setPublishState("failed");
      updateEntryStatus(entryId, "failed");
      appendEntryLog(entryId, trigger === "scheduled" ? `定时发送失败：${message}` : `手动发送失败：${message}`);
      appendQueueLog(trigger === "scheduled" ? `定时发送失败：${entry.title || "(无标题)"}：${message}` : `手动发送失败：${entry.title || "(无标题)"}：${message}`);
      setNotice("发送失败，请查看日志并重试。");
    }
  }, [queueEntries, squareConfig, updateEntryStatus, appendEntryLog, appendQueueLog, setNotice, setDraft]);

  // ── Schedule a specific queue entry ──
  const scheduleEntry = useCallback((entryId: string) => {
    const entry = queueEntries.find((e) => e.id === entryId);
    if (!entry) {
      setNotice("未找到该队列条目。");
      return;
    }
    if (!allowScheduledPublish) {
      setNotice("请先开启\u201c允许执行定时发送\u201d。");
      return;
    }
    if (!scheduleAtInput) {
      setNotice("请先设置发送时间。");
      return;
    }
    const scheduleMs = new Date(scheduleAtInput).getTime();
    if (Number.isNaN(scheduleMs)) {
      setNotice("发送时间格式无效。");
      return;
    }
    if (scheduleMs <= Date.now()) {
      setNotice("发送时间必须晚于当前时间。");
      return;
    }
    updateEntryStatus(entryId, "scheduled");
    setPublishState("scheduled");
    appendEntryLog(entryId, `已设置定时发送：${scheduleAtInput.replace("T", " ")}`);
    appendQueueLog(`已设置定时发送：${entry.title || "(无标题)"} - ${scheduleAtInput.replace("T", " ")}`);
    setNotice("定时发送已创建。");
  }, [queueEntries, allowScheduledPublish, scheduleAtInput, updateEntryStatus, appendEntryLog, appendQueueLog, setNotice]);

  const cancelScheduleEntry = useCallback((entryId: string) => {
    updateEntryStatus(entryId, "pending");
    setPublishState("idle");
    setScheduleAtInput("");
    appendQueueLog("已取消定时发送。");
    setNotice("定时发送已取消。");
  }, [updateEntryStatus, appendQueueLog, setNotice]);

  // ── Auto-execute scheduled entries ──
  useEffect(() => {
    if (!allowScheduledPublish) return;
    const timer = window.setInterval(() => {
      if (!scheduleAtInput) return;
      if (Date.now() >= new Date(scheduleAtInput).getTime()) {
        window.clearInterval(timer);
        // Find the scheduled entry and publish it
        const scheduledEntry = queueEntries.find((e) => e.status === "scheduled");
        if (scheduledEntry) {
          void publishEntry(scheduledEntry.id, "scheduled");
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allowScheduledPublish, scheduleAtInput, queueEntries, publishEntry]);

  // ── Sync selected entry state with publishState ──
  const selectEntry = useCallback((entryId: string | null) => {
    setSelectedEntryId(entryId);
    if (entryId) {
      const entry = queueEntries.find((e) => e.id === entryId);
      if (entry) {
        setPublishState(entry.status as PublishState);
        setPublishOutput("");
      }
    }
  }, [queueEntries]);

  return {
    queueEntries,
    selectedEntryId,
    selectEntry,
    allowScheduledPublish,
    setAllowScheduledPublish,
    scheduleAtInput,
    setScheduleAtInput,
    publishState,
    setPublishState,
    publishOutput,
    setPublishOutput,
    queueLogs,
    appendQueueLog,
    addToQueue,
    publishEntry,
    scheduleEntry,
    cancelScheduleEntry,
  };
}
