import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AutoPublishPanel } from "../features/workbench/components/AutoPublishPanel";
import { ComposerPanel } from "../features/workbench/components/ComposerPanel";
import { MetricCard } from "../features/workbench/components/MetricCard";
import { NewsPanel } from "../features/workbench/components/NewsPanel";
import { PipelinePanel } from "../features/workbench/components/PipelinePanel";
import { QueuePanel } from "../features/workbench/components/QueuePanel";
import { SettingsPanel } from "../features/workbench/components/SettingsPanel";
import { Sidebar } from "../features/workbench/components/Sidebar";
import { TopicsPanel } from "../features/workbench/components/TopicsPanel";
import {
  ArticleLogDetailModal,
  ArticleLogHistoryModal,
  WorkflowRunModal,
} from "../features/workbench/components/WorkflowRunModal";
import { TABS } from "../features/workbench/constants";
import { useNews } from "../features/workbench/hooks/useNews";
import { usePipeline } from "../features/workbench/hooks/usePipeline";
import { usePlatforms } from "../features/workbench/hooks/usePlatforms";
import { usePublishing } from "../features/workbench/hooks/usePublishing";
import { useSquare } from "../features/workbench/hooks/useSquare";
import { useSymbolSearch } from "../features/workbench/hooks/useSymbolSearch";
import { useWorkspace } from "../features/workbench/hooks/useWorkspace";
import type { Tab, Topic, Draft } from "../features/workbench/types";
import type { ArticleLogEntry } from "../lib/tauri";
import { fetchNews } from "../lib/tauri";
import { buildFinalBody } from "../features/workbench/utils";

export function App() {
  const [tab, setTab] = useState<Tab>("仪表盘");
  const [notice, setNotice] = useState("未连接外部数据源；当前仅使用本地演示数据。");

  // Modal states
  const [showRunModal, setShowRunModal] = useState(false);
  const [showLogHistory, setShowLogHistory] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<ArticleLogEntry | null>(null);
  const [pendingWorkflowTopic, setPendingWorkflowTopic] = useState<Topic | null>(null);
  const [draftSourceName, setDraftSourceName] = useState("");

  // ── Feature hooks ──
  const workspace = useWorkspace(setNotice, setTab);
  const square = useSquare();
  const platforms = usePlatforms();
  const symbols = useSymbolSearch(workspace.draft);
  const pipeline = usePipeline(workspace.updateTopicProcessedContent);

  // Auto-execute default pipeline when new topics are imported
  const handleNewTopics = useCallback(
    (topics: Topic[]) => {
      if (!pipeline.defaultPipelineId) return;
      for (const topic of topics) {
        void pipeline.autoProcessTopic(topic);
      }
    },
    [pipeline.defaultPipelineId, pipeline.autoProcessTopic],
  );

  // Add titles to the persistent seen set for dedup
  const addSeenTitles = useCallback(
    (titles: string[]) => {
      workspace.setSeenTitles((prev) => {
        const next = new Set(prev);
        for (const t of titles) next.add(t);
        return next;
      });
    },
    [workspace.setSeenTitles],
  );

  // ── Derived values (must be before usePublishing which depends on finalPublishBody) ──
  const finalPublishBody = useMemo(
    () => buildFinalBody(workspace.draft.body, symbols.allSymbols),
    [workspace.draft.body, symbols.allSymbols],
  );

  const news = useNews(workspace.setTopics, setNotice, handleNewTopics, workspace.seenTitles, addSeenTitles);
  const publishing = usePublishing(
    workspace.draft,
    workspace.setDraft,
    workspace.validateDraftForQueue,
    finalPublishBody,
    square.squareConfig,
    setNotice,
    setTab,
  );

  // ── Full auto-publish orchestration: fetch → process → queue → publish ──
  // All mutable values accessed via refs to keep the effect dependency stable.
  const autoPublishRef = useRef(publishing.autoPublish);
  autoPublishRef.current = publishing.autoPublish;

  const newsSourcesRef = useRef(news.newsSources);
  newsSourcesRef.current = news.newsSources;

  const savedPipelinesRef = useRef(pipeline.savedPipelines);
  savedPipelinesRef.current = pipeline.savedPipelines;

  const seenTitlesRef = useRef(workspace.seenTitles);
  seenTitlesRef.current = workspace.seenTitles;

  const topicsRef = useRef(workspace.topics);
  topicsRef.current = workspace.topics;

  const addSeenTitlesRef = useRef(addSeenTitles);
  addSeenTitlesRef.current = addSeenTitles;

  const addToQueueRef = useRef(publishing.addToQueue);
  addToQueueRef.current = publishing.addToQueue;

  const appendQueueLogRef = useRef(publishing.appendQueueLog);
  appendQueueLogRef.current = publishing.appendQueueLog;

  const publishEntryRef = useRef(publishing.publishEntry);
  publishEntryRef.current = publishing.publishEntry;

  const runSavedPipelineRef = useRef(pipeline.runSavedPipeline);
  runSavedPipelineRef.current = pipeline.runSavedPipeline;

  const queueEntriesRef = useRef(publishing.queueEntries);
  queueEntriesRef.current = publishing.queueEntries;

  const squareConfigRef = useRef(square.squareConfig);
  squareConfigRef.current = square.squareConfig;

  const platformConfigsRef = useRef(platforms.platformConfigs);
  platformConfigsRef.current = platforms.platformConfigs;

  const updateAutoPublishLastRef = useRef(publishing.updateAutoPublishLast);
  updateAutoPublishLastRef.current = publishing.updateAutoPublishLast;

  useEffect(() => {
    const ap = autoPublishRef.current;
    if (!ap.enabled || !ap.intervalMinutes || ap.intervalMinutes < 1) return;
    const intervalMs = ap.intervalMinutes * 60 * 1000;

    const tick = async () => {
      try {
      const currentAP = autoPublishRef.current;

      // ── Step 1: Fetch news ──
      const sources = newsSourcesRef.current;
      if (sources.length === 0) return;

      let articles: { title: string; sourceName: string; summary?: string; link?: string }[];
      try {
        const results = await fetchNews(sources);
        articles = results
          .filter((r) => !r.error)
          .flatMap((r) => r.articles);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendQueueLogRef.current(`自动发布抓取失败：${msg}`);
        return;
      }

      if (articles.length === 0) {
        appendQueueLogRef.current("自动发布：未抓取到任何文章。");
        return;
      }

      // ── Step 2: Deduplicate ──
      const seen = seenTitlesRef.current;
      const existingTitles = new Set<string>([
        ...topicsRef.current.map((t) => t.title),
        ...seen,
      ]);
      const newArticles = articles.filter((a) => a.title && !existingTitles.has(a.title));

      if (newArticles.length > 0) {
        // Mark new titles as seen
        addSeenTitlesRef.current(newArticles.map((a) => a.title));

        // Convert to topics
        const newTopics: Topic[] = newArticles.map((a, i) => ({
          id: Date.now() + i,
          title: a.title,
          source: `${a.sourceName}（RSS）`,
          verified: false,
          summary: a.summary,
          link: a.link,
        }));

        // ── Step 3: Run pipeline ──
        const pipelineId = currentAP.pipelineId;
        const pl = pipelineId
          ? savedPipelinesRef.current.find((p) => p.id === pipelineId)
          : null;

        let queuedCount = 0;
        let processedCount = 0;
        const newlyQueuedIds: string[] = [];

        for (const topic of newTopics) {
          if (pl) {
            try {
              const results = await runSavedPipelineRef.current(pl.id, topic);
              const processed = results[0]?.processedContent;
              if (processed && processed.length > 0) {
                processedCount++;
                const autoDraft: Draft = {
                  title: topic.title,
                  body: topic.title,
                  reviewed: true,
                  queued: true,
                  publishType: "post",
                  videoSourceType: "url",
                  videoUrl: "",
                  videoFilePath: "",
                  targetPlatforms: currentAP.targetPlatforms,
                  imageBase64: results[0]?.generatedImage,
                  imageMime: results[0]?.generatedImageMime,
                  imageName: results[0]?.generatedImageName,
                };
                const entryId = addToQueueRef.current(autoDraft, processed, [], topic.source.replace(/（RSS）$/, ""));
                if (entryId) newlyQueuedIds.push(entryId);
                queuedCount++;
              } else {
                appendQueueLogRef.current(`自动发布：流水线处理「${topic.title}」无输出，跳过。`);
              }
            } catch {
              appendQueueLogRef.current(`自动发布：流水线处理「${topic.title}」失败，跳过。`);
            }
          } else {
            // No pipeline configured — queue raw article content
            const autoDraft: Draft = {
              title: topic.title,
              body: topic.summary || topic.title,
              reviewed: true,
              queued: true,
              publishType: "post",
              videoSourceType: "url",
              videoUrl: "",
              videoFilePath: "",
              targetPlatforms: currentAP.targetPlatforms,
            };
            const entryId = addToQueueRef.current(autoDraft, topic.summary || topic.title, [], topic.source.replace(/（RSS）$/, ""));
            if (entryId) newlyQueuedIds.push(entryId);
            queuedCount++;
          }
        }

        const pipelineLabel = pl ? `使用流水线「${pl.name}」` : "无流水线";
        appendQueueLogRef.current(
          `自动发布：抓取 ${newArticles.length} 篇新文章，${pipelineLabel}处理 ${processedCount} 篇，入队 ${queuedCount} 篇。`,
        );
      } else {
        appendQueueLogRef.current(`自动发布：抓取到 ${articles.length} 篇文章，均为已知内容，跳过抓取。`);
      }

      // ── Step 4: Publish from queue (round-robin by source priority) ──
      // Combine existing pending entries with newly queued ones from this tick
      let entries = queueEntriesRef.current;
      let pending = entries.filter((e) => e.status === "pending");
      if (pending.length === 0) return;

      // Check if at least one target platform is configured
      const targetPlatforms = currentAP.targetPlatforms.length > 0
        ? currentAP.targetPlatforms
        : ["binance_square"];
      const anyPlatformConfigured = targetPlatforms.some((pid) => {
        if (pid === "binance_square") return squareConfigRef.current?.keyConfigured ?? false;
        const pc = platformConfigsRef.current.find((p) => p.platform === pid);
        if (!pc || !pc.enabled) return false;
        const keys = Object.keys(pc.credentials);
        return keys.length > 0 && keys.some((k) => pc.credentials[k] !== "");
      });
      if (!anyPlatformConfigured) {
        appendQueueLogRef.current("自动发布：所有目标平台均未配置凭证，跳过发送。");
        return;
      }

      const lastSource = currentAP.lastSourceName;
      const priority = currentAP.sourcePriority;

      const bySource = new Map<string, typeof pending>();
      for (const e of pending) {
        const src = e.sourceName || "(无来源)";
        const list = bySource.get(src) ?? [];
        list.push(e);
        bySource.set(src, list);
      }

      const availableSources = [...bySource.keys()];
      const ordered = [
        ...priority.filter((s) => availableSources.includes(s)),
        ...availableSources.filter((s) => !priority.includes(s)),
      ];
      const lastIdx = ordered.indexOf(lastSource);
      const rotated = lastIdx >= 0
        ? [...ordered.slice(lastIdx + 1), ...ordered.slice(0, lastIdx + 1)]
        : ordered;

      let chosen: typeof pending[0] | undefined;
      let chosenSource = "";
      for (const src of rotated) {
        const list = bySource.get(src);
        if (list && list.length > 0) {
          chosen = list[0];
          chosenSource = src;
          break;
        }
      }

      if (chosen) {
        const success = await publishEntryRef.current(chosen.id, "auto");
        if (success) {
          updateAutoPublishLastRef.current(chosenSource);
        }
      }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendQueueLogRef.current(`自动发布执行异常：${msg}`);
      }
    };

    // Execute immediately on enable
    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishing.autoPublish.enabled, publishing.autoPublish.intervalMinutes]);

  const handleQueue = () => {
    const error = workspace.validateDraftForQueue();
    if (error) {
      symbols.setComposerError(error);
      return;
    }
    publishing.addToQueue(workspace.draft, finalPublishBody, symbols.allSymbols, draftSourceName);
    workspace.setDraft((prev) => ({ ...prev, queued: true }));
    symbols.setComposerError("");
    publishing.setPublishState("idle");
    publishing.setPublishOutput("");
    setNotice("已进入发布队列。");
    setTab("发布队列");
  };

  /** 从选题池触发工作流：重置状态后显示运行弹窗 */
  const handleRunWorkflow = (topic: Topic) => {
    pipeline.resetExecution();
    setPendingWorkflowTopic(topic);
    setShowRunModal(true);
  };

  /** 打开编辑器时记录来源 */
  const handleOpenComposer = (topic?: Topic) => {
    if (topic) {
      setDraftSourceName(topic.source.replace(/（RSS）$/, ""));
    } else {
      setDraftSourceName("");
    }
    workspace.openComposer(topic);
  };

  /** 在弹窗中选择流水线后执行 */
  const handleRunPipeline = (pipelineId: string) => {
    if (!pendingWorkflowTopic) return;
    void pipeline.processArticleWithSavedPipeline(pipelineId, pendingWorkflowTopic);
  };

  /** 查看文章的历史运行日志 */
  const handleViewLogs = (topic: Topic) => {
    setShowLogHistory(true);
  };

  // ── Render ──
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
              <MetricCard n={workspace.topics.length - workspace.verifiedCount} t="待核验选题" />
              <MetricCard n={workspace.verifiedCount} t="可生成草稿" />
              <MetricCard n={publishing.queueEntries.filter((e) => e.status !== "sent").length} t="待人工发布" />
            </section>
            <TopicsPanel 
              topics={workspace.topics} 
              verify={workspace.verifyTopic} 
              verifyMany={workspace.verifyMany} 
              openComposer={handleOpenComposer} 
              onRunWorkflow={handleRunWorkflow}
              onViewLogs={handleViewLogs}
            />
          </>
        )}

        {tab === "选题池" && (
          <TopicsPanel 
            topics={workspace.topics} 
            verify={workspace.verifyTopic} 
            verifyMany={workspace.verifyMany} 
            openComposer={handleOpenComposer} 
            onRunWorkflow={handleRunWorkflow}
            onViewLogs={handleViewLogs}
          />
        )}

        {tab === "新闻源" && (
          <NewsPanel
            sources={news.newsSources}
            fetchResults={news.newsResults}
            fetching={news.newsFetching}
            onFetchAll={() => void news.fetchAllNews()}
            onFetchSource={(source) => void news.fetchSingleSource(source)}
            onArticleToTopic={workspace.convertArticleToTopic}
            onAddSource={news.addSource}
            onUpdateSource={news.updateSource}
            onRemoveSource={news.removeSource}
            onResetSources={news.resetSources}
          />
        )}

        {tab === "流水线" && (
          <PipelinePanel
            savedPipelines={pipeline.savedPipelines}
            defaultPipelineId={pipeline.defaultPipelineId}
            editingPipelineId={pipeline.editingPipelineId}
            editingPipeline={pipeline.editingPipeline}
            dirty={pipeline.dirty}
            nodes={pipeline.nodes}
            edges={pipeline.edges}
            selectedNodeId={pipeline.selectedNodeId}
            selectedNode={pipeline.selectedNode}
            onSelectNode={pipeline.setSelectedNodeId}
            onAddNode={pipeline.addNode}
            onRemoveNode={pipeline.removeNode}
            onUpdateNodePosition={pipeline.updateNodePosition}
            onUpdateLlmConfig={pipeline.updateLlmConfig}
            onUpdateImageConfig={pipeline.updateImageConfig}
            onAddEdge={pipeline.addEdge}
            onRemoveEdge={pipeline.removeEdge}
            onCreatePipeline={pipeline.createPipeline}
            onCopyPipeline={pipeline.copyPipeline}
            onLoadPipeline={pipeline.loadPipeline}
            onSavePipeline={pipeline.saveCurrentPipeline}
            onRenamePipeline={pipeline.renamePipeline}
            onDeletePipeline={pipeline.deletePipeline}
            onSetDefaultPipeline={pipeline.setDefaultPipeline}
            onClearDefaultPipeline={pipeline.clearDefaultPipeline}
            onCloseEditor={pipeline.closeEditor}
            running={pipeline.running}
            results={pipeline.results}
            runLog={pipeline.runLog}
            currentArticle={pipeline.currentArticle}
            newsSources={news.newsSources}
          />
        )}

        {tab === "内容工坊" && (
          <ComposerPanel
            draft={workspace.draft}
            setDraft={workspace.setDraft}
            symbolQuery={symbols.symbolQuery}
            setSymbolQuery={symbols.setSymbolQuery}
            symbolSearching={symbols.symbolSearching}
            symbolSearchNotice={symbols.symbolSearchNotice}
            symbolSearchResults={symbols.symbolSearchResults}
            addSymbolFromSearch={symbols.addSymbolFromSearch}
            manualSymbolsInput={symbols.manualSymbolsInput}
            setManualSymbolsInput={symbols.setManualSymbolsInput}
            bodyTaggedSymbols={symbols.bodyTaggedSymbols}
            allSymbols={symbols.allSymbols}
            removeManualSymbol={symbols.removeManualSymbol}
            chooseLocalVideoFile={() => void workspace.chooseLocalVideoFile()}
            composerError={symbols.composerError}
            onQueue={handleQueue}
            platformConfigs={platforms.platformConfigs}
            isPlatformConfigured={platforms.isPlatformConfigured}
          />
        )}

        {tab === "发布队列" && (
          <QueuePanel
            queueEntries={publishing.queueEntries}
            selectedEntryId={publishing.selectedEntryId}
            onSelectEntry={(id) => publishing.selectEntry(id)}
            onDeleteEntry={(id) => publishing.removeQueueEntry(id)}
            onDeleteEntries={(ids) => publishing.removeQueueEntries(ids)}
            publishState={publishing.publishState}
            allowScheduledPublish={publishing.allowScheduledPublish}
            onToggleScheduled={(v) => {
              publishing.setAllowScheduledPublish(v);
              publishing.appendQueueLog(v ? "已开启定时发送执行开关。" : "已关闭定时发送执行开关。");
            }}
            scheduleAtInput={publishing.scheduleAtInput}
            setScheduleAtInput={publishing.setScheduleAtInput}
            schedulePublish={() => {
              if (publishing.selectedEntryId) publishing.scheduleEntry(publishing.selectedEntryId);
            }}
            cancelSchedule={() => {
              if (publishing.selectedEntryId) publishing.cancelScheduleEntry(publishing.selectedEntryId);
            }}
            publishNow={() => {
              if (publishing.selectedEntryId) void publishing.publishEntry(publishing.selectedEntryId, "manual");
            }}
            publishOutput={publishing.publishOutput}
            queueLogs={publishing.queueLogs}
          />
        )}

        {tab === "自动发布" && (
          <AutoPublishPanel
            autoPublish={publishing.autoPublish}
            queueEntries={publishing.queueEntries}
            queueLogs={publishing.queueLogs}
            keyConfigured={square.squareConfig?.keyConfigured ?? false}
            savedPipelines={pipeline.savedPipelines}
            platformConfigs={platforms.platformConfigs}
            onToggle={(v) => {
              publishing.setAutoPublishEnabled(v);
              publishing.appendQueueLog(v ? "已开启全流程自动发布。" : "已关闭全流程自动发布。");
            }}
            onSetInterval={publishing.setAutoPublishInterval}
            onSetPipeline={publishing.setAutoPublishPipeline}
            onMoveSource={publishing.moveSourcePriority}
            onRemoveSource={publishing.removeSourcePriority}
            onAddSource={publishing.addSourcePriority}
            onSetTargetPlatforms={publishing.setAutoPublishTargetPlatforms}
          />
        )}

        {tab === "设置" && (
          <SettingsPanel
            squareConfig={square.squareConfig}
            lastRefreshTime={square.lastRefreshTime}
            squareKeyInput={square.squareKeyInput}
            setSquareKeyInput={square.setSquareKeyInput}
            squareNotice={square.squareNotice}
            squareLoading={square.squareLoading}
            refreshingSquare={square.refreshingSquare}
            openingSquare={square.openingSquare}
            onSaveSquareKey={() => void square.saveSquareKey()}
            onRefreshSquare={() => void square.loadSquareConfig(true)}
            onOpenSquareCenter={() => void square.openSquareCenter()}
            proxyConfig={square.proxyConfig}
            setProxyEnabled={(v) => square.setProxyConfig((prev) => ({ ...prev, enabled: v }))}
            proxyUrlInput={square.proxyUrlInput}
            setProxyUrlInput={square.setProxyUrlInput}
            proxySaving={square.proxySaving}
            proxyNotice={square.proxyNotice}
            onSaveProxy={() => void square.saveProxyConfig()}
            onReloadProxy={() => void square.loadProxyConfig()}
            platformConfigs={platforms.platformConfigs}
            platformsNotice={platforms.platformsNotice}
            xTwitterForm={platforms.xTwitterForm}
            setXTwitterForm={platforms.setXTwitterForm}
            xTwitterSaving={platforms.xTwitterSaving}
            onSaveXTwitter={() => void platforms.saveXTwitterCredentials()}
            onTogglePlatform={(platformId, enabled) => void platforms.togglePlatformEnabled(platformId, enabled)}
          />
        )}
      </main>

      {/* Workflow Run Modal */}
      {showRunModal && (
        <WorkflowRunModal
          topic={pendingWorkflowTopic}
          running={pipeline.running}
          runLog={pipeline.runLog}
          results={pipeline.results}
          savedPipelines={pipeline.savedPipelines}
          defaultPipelineId={pipeline.defaultPipelineId}
          onRun={handleRunPipeline}
          onClose={() => {
            setShowRunModal(false);
            setPendingWorkflowTopic(null);
          }}
        />
      )}

      {/* Article Log History Modal */}
      {showLogHistory && !selectedLogEntry && (
        <ArticleLogHistoryModal
          entries={pipeline.articleLogEntries}
          onClose={() => setShowLogHistory(false)}
          onViewEntry={(entry) => setSelectedLogEntry(entry)}
        />
      )}

      {/* Article Log Detail Modal */}
      {showLogHistory && selectedLogEntry && (
        <ArticleLogDetailModal
          entry={selectedLogEntry}
          onClose={() => {
            setSelectedLogEntry(null);
            setShowLogHistory(false);
          }}
          onBack={() => setSelectedLogEntry(null)}
        />
      )}
    </div>
  );
}
