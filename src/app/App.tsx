import { useCallback, useMemo, useState } from "react";

import { ComposerPanel } from "../features/workbench/components/ComposerPanel";
import { MetricCard } from "../features/workbench/components/MetricCard";
import { NewsPanel } from "../features/workbench/components/NewsPanel";
import { PipelinePanel } from "../features/workbench/components/PipelinePanel";
import { QueuePanel } from "../features/workbench/components/QueuePanel";
import { SettingsPanel } from "../features/workbench/components/SettingsPanel";
import { Sidebar } from "../features/workbench/components/Sidebar";
import { TopicsPanel } from "../features/workbench/components/TopicsPanel";
import { TABS } from "../features/workbench/constants";
import { useNews } from "../features/workbench/hooks/useNews";
import { usePipeline } from "../features/workbench/hooks/usePipeline";
import { usePublishing } from "../features/workbench/hooks/usePublishing";
import { useSquare } from "../features/workbench/hooks/useSquare";
import { useSymbolSearch } from "../features/workbench/hooks/useSymbolSearch";
import { useWorkspace } from "../features/workbench/hooks/useWorkspace";
import type { Tab, Topic } from "../features/workbench/types";
import { buildFinalBody } from "../features/workbench/utils";

export function App() {
  const [tab, setTab] = useState<Tab>("仪表盘");
  const [notice, setNotice] = useState("未连接外部数据源；当前仅使用本地演示数据。");

  // ── Feature hooks ──
  const workspace = useWorkspace(setNotice, setTab);
  const square = useSquare();
  const symbols = useSymbolSearch(workspace.draft);
  const pipeline = usePipeline();

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

  // ── Derived values (must be before usePublishing which depends on finalPublishBody) ──
  const finalPublishBody = useMemo(
    () => buildFinalBody(workspace.draft.body, symbols.allSymbols),
    [workspace.draft.body, symbols.allSymbols],
  );

  const news = useNews(workspace.setTopics, setNotice, handleNewTopics);
  const publishing = usePublishing(
    workspace.draft,
    workspace.setDraft,
    workspace.validateDraftForQueue,
    finalPublishBody,
    square.squareConfig,
    setNotice,
    setTab,
  );

  const handleQueue = () => {
    const error = workspace.queueDraft(symbols.allSymbols, publishing.appendQueueLog);
    if (error) symbols.setComposerError(error);
    else {
      symbols.setComposerError("");
      publishing.setPublishState("idle");
      publishing.setPublishOutput("");
    }
  };

  /** 从选题池触发工作流：跳转到流水线 Tab 并执行 */
  const handleRunWorkflow = (topic: Topic) => {
    setTab("流水线");
    void pipeline.processArticle(topic);
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
              <MetricCard n={workspace.draft.queued ? 1 : 0} t="待人工发布" />
            </section>
            <TopicsPanel topics={workspace.topics} verify={workspace.verifyTopic} verifyMany={workspace.verifyMany} openComposer={workspace.openComposer} onRunWorkflow={handleRunWorkflow} />
          </>
        )}

        {tab === "选题池" && (
          <TopicsPanel topics={workspace.topics} verify={workspace.verifyTopic} verifyMany={workspace.verifyMany} openComposer={workspace.openComposer} onRunWorkflow={handleRunWorkflow} />
        )}

        {tab === "新闻源" && (
          <NewsPanel
            sources={news.newsSources}
            fetchResults={news.newsResults}
            fetching={news.newsFetching}
            onFetchAll={() => void news.fetchAllNews()}
            onFetchSource={(source) => void news.fetchSingleSource(source)}
            onArticleToTopic={workspace.convertArticleToTopic}
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
            onAddEdge={pipeline.addEdge}
            onRemoveEdge={pipeline.removeEdge}
            onCreatePipeline={pipeline.createPipeline}
            onLoadPipeline={pipeline.loadPipeline}
            onSavePipeline={pipeline.saveCurrentPipeline}
            onRenamePipeline={pipeline.renamePipeline}
            onDeletePipeline={pipeline.deletePipeline}
            onSetDefaultPipeline={pipeline.setDefaultPipeline}
            onClearDefaultPipeline={pipeline.clearDefaultPipeline}
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
          />
        )}

        {tab === "发布队列" && (
          <QueuePanel
            draft={workspace.draft}
            publishState={publishing.publishState}
            allSymbols={symbols.allSymbols}
            finalPublishBody={finalPublishBody}
            allowScheduledPublish={publishing.allowScheduledPublish}
            onToggleScheduled={(v) => {
              publishing.setAllowScheduledPublish(v);
              publishing.appendQueueLog(v ? "已开启定时发送执行开关。" : "已关闭定时发送执行开关。");
            }}
            scheduleAtInput={publishing.scheduleAtInput}
            setScheduleAtInput={publishing.setScheduleAtInput}
            schedulePublish={publishing.schedulePublish}
            cancelSchedule={publishing.cancelSchedule}
            publishNow={() => void publishing.publishNow("manual")}
            publishOutput={publishing.publishOutput}
            queueLogs={publishing.queueLogs}
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
          />
        )}
      </main>
    </div>
  );
}
