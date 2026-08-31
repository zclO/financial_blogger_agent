import { useEffect, useRef, useState } from "react";

import {
  loadDraftStore,
  publishBinanceSquareText,
  publishBinanceSquareVideoFile,
  saveDraftStore,
  type BinanceSquareConfig,
} from "../../../lib/tauri";
import type { Draft, PublishState } from "../types";
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
  const [allowScheduledPublish, setAllowScheduledPublish] = useState(false);
  const [scheduleAtInput, setScheduleAtInput] = useState("");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishOutput, setPublishOutput] = useState("");
  const [queueLogs, setQueueLogs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Ref for draft to use in save effect without causing re-runs
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // ── Load from persistence on mount ──
  useEffect(() => {
    loadDraftStore()
      .then((store) => {
        if (store.draft) {
          setDraft({
            title: store.draft.title,
            body: store.draft.body,
            reviewed: store.draft.reviewed,
            queued: store.draft.queued,
            publishType: store.draft.publishType as Draft["publishType"],
            videoSourceType: store.draft.videoSourceType as Draft["videoSourceType"],
            videoUrl: store.draft.videoUrl,
            videoFilePath: store.draft.videoFilePath,
          });
        }
        setQueueLogs(store.queueLogs);
        setPublishState(store.publishState as PublishState || "idle");
        setPublishOutput(store.publishOutput);
        setScheduleAtInput(store.scheduleAtInput);
        setAllowScheduledPublish(store.allowScheduledPublish);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, [setDraft]);

  // ── Debounced save when state changes ──
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
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
      }).catch((err) => console.error("Failed to save draft:", err));
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, queueLogs, publishState, publishOutput, scheduleAtInput, allowScheduledPublish, loaded]);

  const appendQueueLog = (content: string) => {
    setQueueLogs((prev) => [`[${nowText()}] ${content}`, ...prev].slice(0, 30));
  };

  const publishNow = async (trigger: "manual" | "scheduled") => {
    if (!draft.queued) {
      setNotice("当前没有待发送草稿。");
      return;
    }
    if (!draft.reviewed) {
      setNotice("草稿未完成人工复核，禁止发送。");
      return;
    }
    if (!squareConfig?.keyConfigured) {
      setNotice("Square OpenAPI Key 未配置，无法发送。");
      return;
    }
    const error = validateDraft();
    if (error) {
      setNotice(error);
      return;
    }

    setPublishState("sending");
    try {
      const result =
        draft.publishType === "video" && draft.videoSourceType === "local"
          ? await publishBinanceSquareVideoFile({
              title: draft.title || undefined,
              text: finalPublishBody,
              videoPath: draft.videoFilePath,
            })
          : await publishBinanceSquareText({
              title: draft.title || undefined,
              text: finalPublishBody,
              contentType: draft.publishType,
              videoUrl: draft.publishType === "video" ? draft.videoUrl : undefined,
            });

      setPublishOutput(result.trim());
      setPublishState("sent");
      setDraft((prev) => ({ ...prev, queued: false }));
      setScheduleAtInput("");
      setAllowScheduledPublish(false);
      appendQueueLog(trigger === "scheduled" ? "定时任务执行成功并发送。" : "手动发送成功。");
      setNotice("发送成功。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPublishState("failed");
      setPublishOutput(message);
      appendQueueLog(trigger === "scheduled" ? `定时任务发送失败：${message}` : `手动发送失败：${message}`);
      setNotice("发送失败，请查看日志并重试。");
    }
  };

  const schedulePublish = () => {
    if (!draft.queued) {
      setNotice("当前没有待发送草稿。");
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
    setPublishState("scheduled");
    appendQueueLog(`已设置定时发送：${scheduleAtInput.replace("T", " ")}`);
    setNotice("定时发送已创建。");
  };

  const cancelSchedule = () => {
    setPublishState("idle");
    setScheduleAtInput("");
    appendQueueLog("已取消定时发送。");
    setNotice("定时发送已取消。");
  };

  useEffect(() => {
    if (!draft.queued || !allowScheduledPublish || publishState !== "scheduled" || !scheduleAtInput) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= new Date(scheduleAtInput).getTime()) {
        window.clearInterval(timer);
        void publishNow("scheduled");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allowScheduledPublish, draft.queued, publishState, scheduleAtInput]);

  return {
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
    publishNow,
    schedulePublish,
    cancelSchedule,
  };
}
