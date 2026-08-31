import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";

import {
  configureBinanceSquare,
  fetchNews,
  getBinanceSquareConfig,
  getBinanceSquareProxyConfig,
  getDefaultNewsSources,
  publishBinanceSquareText,
  publishBinanceSquareVideoFile,
  searchBinanceSymbols,
  setBinanceSquareProxyConfig,
  type BinanceSquareConfig,
  type BinanceSquareProxyConfig,
  type NewsArticle,
  type NewsFetchResult,
  type NewsSource,
} from "../lib/tauri";
import { ComposerPanel } from "../features/workbench/components/ComposerPanel";
import { MetricCard } from "../features/workbench/components/MetricCard";
import { NewsPanel } from "../features/workbench/components/NewsPanel";
import { QueuePanel } from "../features/workbench/components/QueuePanel";
import { SettingsPanel } from "../features/workbench/components/SettingsPanel";
import { Sidebar } from "../features/workbench/components/Sidebar";
import { TopicsPanel } from "../features/workbench/components/TopicsPanel";
import { DEFAULT_DRAFT_BODY, DEFAULT_NEWS_SOURCES, DEFAULT_TOPICS, TABS } from "../features/workbench/constants";
import type { Draft, PublishState, Tab, Topic } from "../features/workbench/types";
import { buildFinalBody, extractTaggedSymbols, normalizeSymbols } from "../features/workbench/utils";

export function App() {
  const [tab, setTab] = useState<Tab>("仪表盘");
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
  const [notice, setNotice] = useState("未连接外部数据源；当前仅使用本地演示数据。");

  const [squareConfig, setSquareConfig] = useState<BinanceSquareConfig | null>(null);
  const [squareKeyInput, setSquareKeyInput] = useState("");
  const [squareNotice, setSquareNotice] = useState("");
  const [squareLoading, setSquareLoading] = useState(false);
  const [refreshingSquare, setRefreshingSquare] = useState(false);
  const [openingSquare, setOpeningSquare] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState("");

  const [proxyConfig, setProxyConfig] = useState<BinanceSquareProxyConfig>({ enabled: false, proxyUrl: null });
  const [proxyUrlInput, setProxyUrlInput] = useState("");
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyNotice, setProxyNotice] = useState("");

  const [manualSymbolsInput, setManualSymbolsInput] = useState("");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [symbolSearching, setSymbolSearching] = useState(false);
  const [symbolSearchNotice, setSymbolSearchNotice] = useState("");
  const [symbolSearchResults, setSymbolSearchResults] = useState<Awaited<ReturnType<typeof searchBinanceSymbols>>>([]);
  const [composerError, setComposerError] = useState("");

  const [allowScheduledPublish, setAllowScheduledPublish] = useState(false);
  const [scheduleAtInput, setScheduleAtInput] = useState("");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishOutput, setPublishOutput] = useState("");
  const [queueLogs, setQueueLogs] = useState<string[]>([]);

  const [newsSources, setNewsSources] = useState<NewsSource[]>(DEFAULT_NEWS_SOURCES);
  const [newsResults, setNewsResults] = useState<NewsFetchResult[]>([]);
  const [newsFetching, setNewsFetching] = useState(false);

  const verifiedCount = useMemo(() => topics.filter((x) => x.verified).length, [topics]);
  const manualSymbols = useMemo(() => normalizeSymbols(manualSymbolsInput), [manualSymbolsInput]);
  const bodyTaggedSymbols = useMemo(() => extractTaggedSymbols(draft.body), [draft.body]);
  const allSymbols = useMemo(() => Array.from(new Set([...bodyTaggedSymbols, ...manualSymbols])), [bodyTaggedSymbols, manualSymbols]);
  const finalPublishBody = useMemo(() => buildFinalBody(draft.body, allSymbols), [draft.body, allSymbols]);

  useEffect(() => {
    setComposerError("");
  }, [draft, manualSymbolsInput]);

  const appendQueueLog = (content: string) => {
    setQueueLogs((prev) => [`[${nowText()}] ${content}`, ...prev].slice(0, 30));
  };

  const loadSquareConfig = async (showSuccess: boolean) => {
    setRefreshingSquare(true);
    try {
      const config = await getBinanceSquareConfig();
      setSquareConfig(config);
      const time = nowText();
      setLastRefreshTime(time);
      if (showSuccess) setSquareNotice(`状态已刷新（${time}）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`读取配置失败：${message}`);
    } finally {
      setRefreshingSquare(false);
    }
  };

  const loadProxyConfig = async () => {
    try {
      const config = await getBinanceSquareProxyConfig();
      setProxyConfig(config);
      setProxyUrlInput(config.proxyUrl ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProxyNotice(`读取代理配置失败：${message}`);
    }
  };

  useEffect(() => {
    void loadSquareConfig(false);
    void loadProxyConfig();
  }, []);

  useEffect(() => {
    const query = symbolQuery.trim();
    if (query.length < 2) {
      setSymbolSearchResults([]);
      setSymbolSearchNotice(query.length === 0 ? "" : "至少输入 2 个字符再搜索。");
      return;
    }

    const timer = window.setTimeout(async () => {
      setSymbolSearching(true);
      setSymbolSearchNotice("");
      try {
        const items = await searchBinanceSymbols({ query, limit: 20 });
        setSymbolSearchResults(items);
        if (items.length === 0) setSymbolSearchNotice("没有匹配到币种。");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSymbolSearchNotice(`币种搜索失败：${message}`);
      } finally {
        setSymbolSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [symbolQuery]);

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

  const addSymbolFromSearch = (symbol: string) => {
    const merged = Array.from(new Set([...manualSymbols, symbol.toUpperCase()]));
    setManualSymbolsInput(merged.join(","));
  };

  const removeManualSymbol = (symbol: string) => {
    if (bodyTaggedSymbols.includes(symbol)) return;
    setManualSymbolsInput(manualSymbols.filter((x) => x !== symbol).join(","));
  };

  const validateDraftForQueue = (): string | null => {
    if (!draft.body.includes("不构成投资建议")) return "草稿必须保留“信息整理，不构成投资建议”。";
    if (allSymbols.length === 0) return "请至少添加一个相关币种，系统会自动附加 #币种 与 $币种 标签。";
    if (draft.publishType === "article" && !draft.title.trim()) return "文章类型必须填写标题。";
    if (draft.publishType === "video" && draft.videoSourceType === "url" && !draft.videoUrl.trim()) return "视频类型（链接）必须填写视频链接。";
    if (draft.publishType === "video" && draft.videoSourceType === "local" && !draft.videoFilePath.trim())
      return "视频类型（本地文件）必须选择本地视频文件。";
    return null;
  };

  const queueDraft = () => {
    const error = validateDraftForQueue();
    if (error) {
      setComposerError(error);
      return;
    }
    setComposerError("");
    setDraft((prev) => ({ ...prev, queued: true }));
    setPublishState("idle");
    setPublishOutput("");
    appendQueueLog(`草稿进入发布队列；类型：${draft.publishType}；标签：${allSymbols.join(", ")}`);
    setNotice("已进入发布队列。");
    setTab("发布队列");
  };

  const saveSquareKey = async () => {
    const apiKey = squareKeyInput.trim();
    if (!apiKey) {
      setSquareNotice("请先输入 Square OpenAPI Key。");
      return;
    }
    setSquareLoading(true);
    setSquareNotice("");
    try {
      await configureBinanceSquare(apiKey);
      setSquareKeyInput("");
      setSquareNotice(`Key 已保存（${nowText()}）`);
      await loadSquareConfig(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`保存失败：${message}`);
    } finally {
      setSquareLoading(false);
    }
  };

  const saveProxyConfig = async () => {
    setProxySaving(true);
    setProxyNotice("");
    try {
      const message = await setBinanceSquareProxyConfig({
        enabled: proxyConfig.enabled,
        proxyUrl: proxyUrlInput.trim() || null,
      });
      setProxyNotice(`${message}（${nowText()}）`);
      await loadProxyConfig();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setProxyNotice(`保存代理配置失败：${msg}`);
    } finally {
      setProxySaving(false);
    }
  };

  const openSquareCenter = async () => {
    if (!squareConfig?.creatorCenterUrl) {
      setSquareNotice("未读取到 Creator Center 地址，请先刷新状态。");
      return;
    }
    setOpeningSquare(true);
    try {
      await openUrl(squareConfig.creatorCenterUrl);
      setSquareNotice("已请求打开 Square Creator Center。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`打开失败：${message}`);
    } finally {
      setOpeningSquare(false);
    }
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
    const error = validateDraftForQueue();
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
      setNotice("请先开启“允许执行定时发送”。");
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
  }, [allowScheduledPublish, draft.queued, publishState, scheduleAtInput]); // publishNow uses current state values

  const verifyTopic = (id: number) => {
    setTopics(topics.map((x) => (x.id === id ? { ...x, verified: true } : x)));
  };

  const openComposer = () => setTab("内容工坊");

  const fetchAllNews = async () => {
    setNewsFetching(true);
    setNotice("");
    try {
      const results = await fetchNews(newsSources);
      setNewsResults(results);
      const okCount = results.filter((r) => !r.error).length;
      const errCount = results.filter((r) => r.error).length;
      const articleCount = results.reduce((s, r) => s + r.articles.length, 0);
      setNotice(`抓取完成：${okCount} 个源成功，${errCount} 个失败，共 ${articleCount} 篇文章。`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setNotice(`新闻抓取失败：${msg}`);
    } finally {
      setNewsFetching(false);
    }
  };

  const fetchSingleSource = async (source: NewsSource) => {
    setNewsFetching(true);
    try {
      const results = await fetchNews([source]);
      setNewsResults((prev) => {
        const filtered = prev.filter((r) => r.source.id !== source.id);
        return [...filtered, ...results];
      });
      const r = results[0];
      if (r?.error) {
        setNotice(`${source.name} 抓取失败：${r.error}`);
      } else {
        setNotice(`${source.name} 抓取成功，${r?.articles.length ?? 0} 篇文章。`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setNotice(`${source.name} 抓取失败：${msg}`);
    } finally {
      setNewsFetching(false);
    }
  };

  const convertArticleToTopic = (article: NewsArticle) => {
    const newTopic: Topic = {
      id: Date.now(),
      title: article.title,
      source: `${article.sourceName}（RSS）`,
      verified: false,
    };
    setTopics((prev) => [newTopic, ...prev]);
    setNotice(`已将"${article.title}"加入选题池。`);
    setTab("选题池");
  };

  // Load default news sources from Rust on mount
  useEffect(() => {
    getDefaultNewsSources()
      .then((sources) => setNewsSources(sources))
      .catch(() => {/* keep DEFAULT_NEWS_SOURCES */});
  }, []);

  return (
    <div className="app">
      <Sidebar tab={tab} tabs={TABS} onChangeTab={setTab} />

      <main className="content">
        <header className="topbar">
          <div>
            <em>FINANCIAL BLOGGER AGENT</em>
            <h1>{tab}</h1>
          </div>
          <span className="badge">本地工作区</span>
        </header>

        <div className="notice">{notice}</div>

        {tab === "仪表盘" && (
          <>
            <section className="metrics">
              <MetricCard n={topics.length - verifiedCount} t="待核验选题" />
              <MetricCard n={verifiedCount} t="可生成草稿" />
              <MetricCard n={draft.queued ? 1 : 0} t="待人工发布" />
            </section>
            <TopicsPanel topics={topics} verify={verifyTopic} openComposer={openComposer} />
          </>
        )}

        {tab === "选题池" && <TopicsPanel topics={topics} verify={verifyTopic} openComposer={openComposer} />}

        {tab === "新闻源" && (
          <NewsPanel
            sources={newsSources}
            fetchResults={newsResults}
            fetching={newsFetching}
            onFetchAll={() => void fetchAllNews()}
            onFetchSource={(source) => void fetchSingleSource(source)}
            onArticleToTopic={convertArticleToTopic}
          />
        )}

        {tab === "内容工坊" && (
          <ComposerPanel
            draft={draft}
            setDraft={setDraft}
            symbolQuery={symbolQuery}
            setSymbolQuery={setSymbolQuery}
            symbolSearching={symbolSearching}
            symbolSearchNotice={symbolSearchNotice}
            symbolSearchResults={symbolSearchResults}
            addSymbolFromSearch={addSymbolFromSearch}
            manualSymbolsInput={manualSymbolsInput}
            setManualSymbolsInput={setManualSymbolsInput}
            bodyTaggedSymbols={bodyTaggedSymbols}
            allSymbols={allSymbols}
            removeManualSymbol={removeManualSymbol}
            chooseLocalVideoFile={() => void chooseLocalVideoFile()}
            composerError={composerError}
            onQueue={queueDraft}
          />
        )}

        {tab === "发布队列" && (
          <QueuePanel
            draft={draft}
            publishState={publishState}
            allSymbols={allSymbols}
            finalPublishBody={finalPublishBody}
            allowScheduledPublish={allowScheduledPublish}
            onToggleScheduled={(v) => {
              setAllowScheduledPublish(v);
              appendQueueLog(v ? "已开启定时发送执行开关。" : "已关闭定时发送执行开关。");
            }}
            scheduleAtInput={scheduleAtInput}
            setScheduleAtInput={setScheduleAtInput}
            schedulePublish={schedulePublish}
            cancelSchedule={cancelSchedule}
            publishNow={() => void publishNow("manual")}
            publishOutput={publishOutput}
            queueLogs={queueLogs}
          />
        )}

        {tab === "设置" && (
          <SettingsPanel
            squareConfig={squareConfig}
            lastRefreshTime={lastRefreshTime}
            squareKeyInput={squareKeyInput}
            setSquareKeyInput={setSquareKeyInput}
            squareNotice={squareNotice}
            squareLoading={squareLoading}
            refreshingSquare={refreshingSquare}
            openingSquare={openingSquare}
            onSaveSquareKey={() => void saveSquareKey()}
            onRefreshSquare={() => void loadSquareConfig(true)}
            onOpenSquareCenter={() => void openSquareCenter()}
            proxyConfig={proxyConfig}
            setProxyEnabled={(v) => setProxyConfig((prev) => ({ ...prev, enabled: v }))}
            proxyUrlInput={proxyUrlInput}
            setProxyUrlInput={setProxyUrlInput}
            proxySaving={proxySaving}
            proxyNotice={proxyNotice}
            onSaveProxy={() => void saveProxyConfig()}
            onReloadProxy={() => void loadProxyConfig()}
          />
        )}
      </main>
    </div>
  );
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
