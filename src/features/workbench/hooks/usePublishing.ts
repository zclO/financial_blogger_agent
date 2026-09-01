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
import type { AutoPublishConfig, Draft, PublishState, QueueEntryStatus } from "../types";
import { nowText } from "../utils";

const DEFAULT_AUTO_PUBLISH: AutoPublishConfig = {
  enabled: false,
  intervalMinutes: 30,
  lastSourceName: "",
  lastTime: null,
  sourcePriority: [],
  pipelineId: null,
};

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
  const [autoPublish, setAutoPublish] = useState<AutoPublishConfig>(DEFAULT_AUTO_PUBLISH);
  const [loaded, setLoaded] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Ref for queueEntries to use in interval
  const queueEntriesRef = useRef(queueEntries);
  queueEntriesRef.current = queueEntries;

  // Ref for squareConfig to use in interval
  const squareConfigRef = useRef(squareConfig);
  squareConfigRef.current = squareConfig;

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

        setAutoPublish({
          enabled: draftStore.autoPublishEnabled ?? false,
          intervalMinutes: draftStore.autoPublishIntervalMinutes || 30,
          lastSourceName: draftStore.autoPublishLastSourceName ?? "",
          lastTime: draftStore.autoPublishLastTime ?? null,
          sourcePriority: draftStore.autoPublishSourcePriority ?? [],
          pipelineId: draftStore.autoPublishPipelineId ?? null,
        });

        setQueueEntries(queueStore.entries);
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
          autoPublishEnabled: autoPublish.enabled,
          autoPublishIntervalMinutes: autoPublish.intervalMinutes,
          autoPublishLastSourceName: autoPublish.lastSourceName,
          autoPublishLastTime: autoPublish.lastTime,
          autoPublishSourcePriority: autoPublish.sourcePriority,
          autoPublishPipelineId: autoPublish.pipelineId,
        }),
        savePublishQueue({ entries: queueEntries }),
      ]).catch((err) => console.error("Failed to save:", err));
    }, 800);
    return () => clearTimeout(timer);
  }, [queueEntries, queueLogs, publishState, publishOutput, scheduleAtInput, allowScheduledPublish, autoPublish, loaded]);

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
    sourceName: string = "",
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
      sourceName,
      status: "pending",
      createdAt: nowText(),
      sentAt: null,
      logs: [],
    };
    setQueueEntries((prev) => [newEntry, ...prev]);
    setSelectedEntryId(entryId);
    appendQueueLog(`新稿件加入队列：${draftData.title || "(无标题)"}；来源：${sourceName || "未知"}；类型：${draftData.publishType}；标签：${symbols.join(", ")}`);
    return null;
  }, [appendQueueLog]);

  // ── Publish a specific queue entry ──
  const publishEntry = useCallback(async (entryId: string, trigger: "manual" | "scheduled" | "auto") => {
    const entry = queueEntriesRef.current.find((e) => e.id === entryId);
    if (!entry) {
      setNotice("未找到该队列条目。");
      return false;
    }
    if (entry.status === "sent") {
      setNotice("该稿件已发送。");
      return false;
    }
    if (!squareConfigRef.current?.keyConfigured) {
      setNotice("Square OpenAPI Key 未配置，无法发送。");
      return false;
    }

    updateEntryStatus(entryId, "sending");
    setPublishState("sending");
    setPublishOutput("");
    const triggerLabel = trigger === "auto" ? "自动发布" : trigger === "scheduled" ? "定时任务" : "手动";
    appendEntryLog(entryId, `${triggerLabel}开始执行发送...`);

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
      appendEntryLog(entryId, `${triggerLabel}发送成功。`);
      appendQueueLog(`${triggerLabel}成功：${entry.title || "(无标题)"}`);
      setNotice("发送成功。");

      if (draftRef.current.queued && draftRef.current.title === entry.title) {
        setDraft((prev) => ({ ...prev, queued: false }));
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPublishOutput(message);
      setPublishState("failed");
      updateEntryStatus(entryId, "failed");
      appendEntryLog(entryId, `${triggerLabel}失败：${message}`);
      appendQueueLog(`${triggerLabel}失败：${entry.title || "(无标题)"}：${message}`);
      setNotice("发送失败，请查看日志并重试。");
      return false;
    }
  }, [updateEntryStatus, appendEntryLog, appendQueueLog, setNotice, setDraft]);

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
        const scheduledEntry = queueEntriesRef.current.find((e) => e.status === "scheduled");
        if (scheduledEntry) {
          void publishEntry(scheduledEntry.id, "scheduled");
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allowScheduledPublish, scheduleAtInput, publishEntry]);

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

  // ── Auto-publish config setters ──
  const setAutoPublishEnabled = useCallback((enabled: boolean) => {
    setAutoPublish((prev) => ({ ...prev, enabled }));
  }, []);

  const setAutoPublishInterval = useCallback((intervalMinutes: number) => {
    setAutoPublish((prev) => ({ ...prev, intervalMinutes: Math.max(1, intervalMinutes) }));
  }, []);

  const setSourcePriority = useCallback((sourcePriority: string[]) => {
    setAutoPublish((prev) => ({ ...prev, sourcePriority }));
  }, []);

  const moveSourcePriority = useCallback((index: number, direction: -1 | 1) => {
    setAutoPublish((prev) => {
      const list = [...prev.sourcePriority];
      const target = index + direction;
      if (target < 0 || target >= list.length) return prev;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, sourcePriority: list };
    });
  }, []);

  const removeSourcePriority = useCallback((sourceName: string) => {
    setAutoPublish((prev) => ({
      ...prev,
      sourcePriority: prev.sourcePriority.filter((s) => s !== sourceName),
    }));
  }, []);

  const addSourcePriority = useCallback((sourceName: string) => {
    setAutoPublish((prev) => {
      if (prev.sourcePriority.includes(sourceName)) return prev;
      return { ...prev, sourcePriority: [...prev.sourcePriority, sourceName] };
    });
  }, []);

  const setAutoPublishPipeline = useCallback((pipelineId: string | null) => {
    setAutoPublish((prev) => ({ ...prev, pipelineId }));
  }, []);

  const updateAutoPublishLast = useCallback((sourceName: string) => {
    setAutoPublish((prev) => ({
      ...prev,
      lastSourceName: sourceName,
      lastTime: nowText(),
    }));
  }, []);

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
    autoPublish,
    setAutoPublishEnabled,
    setAutoPublishInterval,
    setSourcePriority,
    moveSourcePriority,
    removeSourcePriority,
    addSourcePriority,
    setAutoPublishPipeline,
    updateAutoPublishLast,
  };
}
