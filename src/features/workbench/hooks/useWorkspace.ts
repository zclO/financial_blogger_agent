import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useMemo, useState } from "react";

import { DEFAULT_DRAFT_BODY, DEFAULT_TOPICS } from "../constants";
import type { Draft, NewsArticle, Tab, Topic } from "../types";

export function useWorkspace(setNotice: (msg: string) => void, setTab: (tab: Tab) => void) {
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_TOPICS);
  const [draft, setDraft] = useState<Draft>({
    title: DEFAULT_TOPICS[0].title,
    body: DEFAULT_DRAFT_BODY,
    reviewed: false,
    queued: false,
    publishType: "post",
    videoSourceType: "url",
    videoUrl: "",
    videoFilePath: "",
  });

  const verifiedCount = useMemo(() => topics.filter((x) => x.verified).length, [topics]);

  const verifyTopic = (id: number) => {
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, verified: true } : x)));
  };

  const verifyMany = (ids: number[]) => {
    const idSet = new Set(ids);
    setTopics((prev) => prev.map((x) => (idSet.has(x.id) ? { ...x, verified: true } : x)));
  };

  const openComposer = (topic?: Topic) => {
    if (topic) {
      const bodyParts = [topic.title];
      if (topic.summary) bodyParts.push("", topic.summary);
      if (topic.link) bodyParts.push("", `原文链接：${topic.link}`);
      bodyParts.push("", "信息整理，不构成投资建议。");
      setDraft({
        title: topic.title,
        body: bodyParts.join("\n"),
        reviewed: false,
        queued: false,
        publishType: "post",
        videoSourceType: "url",
        videoUrl: "",
        videoFilePath: "",
      });
    }
    setTab("内容工坊");
  };

  /** 将抓取到的文章自动导入选题池（去重），返回实际新增条数 */
  const importArticlesToTopics = (articles: NewsArticle[]): number => {
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
          summary: article.summary || undefined,
          link: article.link || undefined,
        });
      }
      addedCount = newTopics.length;
      return newTopics.length > 0 ? [...newTopics, ...prev] : prev;
    });
    return addedCount;
  };

  const convertArticleToTopic = (article: NewsArticle) => {
    const newTopic: Topic = {
      id: Date.now(),
      title: article.title,
      source: `${article.sourceName}（RSS）`,
      verified: false,
      summary: article.summary || undefined,
      link: article.link || undefined,
    };
    setTopics((prev) => [newTopic, ...prev]);
    setNotice(`已将"${article.title}"加入选题池。`);
    setTab("选题池");
  };

  const validateDraftForQueue = (): string | null => {
    if (!draft.body.includes("不构成投资建议")) return "草稿必须保留\u201c信息整理，不构成投资建议\u201d。";
    if (draft.publishType === "article" && !draft.title.trim()) return "文章类型必须填写标题。";
    if (draft.publishType === "video" && draft.videoSourceType === "url" && !draft.videoUrl.trim())
      return "视频类型（链接）必须填写视频链接。";
    if (draft.publishType === "video" && draft.videoSourceType === "local" && !draft.videoFilePath.trim())
      return "视频类型（本地文件）必须选择本地视频文件。";
    return null;
  };

  const queueDraft = (allSymbols: string[], appendLog: (msg: string) => void) => {
    const error = validateDraftForQueue();
    if (error) return error;
    setDraft((prev) => ({ ...prev, queued: true }));
    appendLog(`草稿进入发布队列；类型：${draft.publishType}；标签：${allSymbols.join(", ")}`);
    setNotice("已进入发布队列。");
    setTab("发布队列");
    return null;
  };

  const chooseLocalVideoFile = async () => {
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "Video", extensions: ["mp4", "mov", "avi", "webm", "mkv"] }],
      });
      if (typeof selected === "string" && selected.trim()) {
        setDraft((prev) => ({ ...prev, videoFilePath: selected }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(`选择文件失败：${message}`);
    }
  };

  return {
    topics,
    setTopics,
    draft,
    setDraft,
    verifiedCount,
    verifyTopic,
    verifyMany,
    openComposer,
    importArticlesToTopics,
    convertArticleToTopic,
    validateDraftForQueue,
    queueDraft,
    chooseLocalVideoFile,
  };
}
