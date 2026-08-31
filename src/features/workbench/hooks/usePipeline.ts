import { useCallback, useEffect, useRef, useState } from "react";

import {
  callLlm,
  loadArticleLogStore,
  loadPipelines,
  saveArticleLogStore,
  savePipelines,
  type ArticleLogEntry,
  type LlmRequest,
  type StoredPipeline,
} from "../../../lib/tauri";
import {
  DEFAULT_LLM_SYSTEM_PROMPT,
  DEFAULT_LLM_USER_PROMPT,
} from "../constants";
import type {
  FlowEdge,
  LlmNodeConfig,
  PipelineNode,
  PipelineNodeKind,
  ProcessedArticle,
  SavedPipeline,
  Topic,
} from "../types";

// ── Helpers ──

let nextId = 100;

function defaultLlmConfig(): LlmNodeConfig {
  return {
    apiEndpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "",
    model: "gpt-4o-mini",
    systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_LLM_USER_PROMPT,
    temperature: 0.7,
    maxTokens: 2000,
  };
}

function toStored(p: SavedPipeline): StoredPipeline {
  return {
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    nodes: p.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      name: n.name,
      position: n.position,
      sourceConfig: n.sourceConfig,
      llmConfig: n.llmConfig,
    })),
    edges: p.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function fromStored(s: StoredPipeline): SavedPipeline {
  return {
    id: s.id,
    name: s.name,
    isDefault: s.isDefault,
    nodes: s.nodes.map((n) => ({
      id: n.id,
      kind: n.kind as PipelineNodeKind,
      name: n.name,
      position: n.position,
      sourceConfig: n.sourceConfig,
      llmConfig: n.llmConfig,
    })),
    edges: s.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}

// ── Topological sort (pure function) ──

function topoSort(
  nodeList: PipelineNode[],
  edgeList: FlowEdge[],
): string[] | null {
  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodeList) {
    outEdges.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edgeList) {
    outEdges.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outEdges.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }
  return order.length === nodeList.length ? order : null;
}

// ── Execute a pipeline with given nodes/edges ──

async function executePipeline(
  nodeList: PipelineNode[],
  edgeList: FlowEdge[],
  topic: Topic,
  appendLog: (msg: string) => void,
): Promise<ProcessedArticle[]> {
  if (nodeList.length === 0) {
    appendLog("工作流为空，请先添加节点。");
    return [];
  }
  const order = topoSort(nodeList, edgeList);
  if (!order) {
    appendLog("检测到环路，工作流无法执行。");
    return [];
  }
  const sourceNode = nodeList.find((n) => n.kind === "source");
  if (!sourceNode) {
    appendLog("未找到信息源节点。");
    return [];
  }

  const nodeOutputs = new Map<string, ProcessedArticle>();
  const initial: ProcessedArticle = {
    originalTitle: topic.title,
    originalSummary: topic.summary ?? "",
    sourceName: topic.source,
    link: topic.link ?? "",
    processedContent: topic.summary ?? topic.title,
  };
  nodeOutputs.set(sourceNode.id, initial);
  appendLog(`\u{1F4F0} \u300C${sourceNode.name}\u300D\u8F93\u5165\u6587\u7AE0\uFF1A${topic.title}`);

  for (const nodeId of order) {
    if (nodeId === sourceNode.id) continue;
    const node = nodeList.find((n) => n.id === nodeId);
    if (!node) continue;

    const predId = edgeList.find((e) => e.target === nodeId)?.source;
    const input = predId ? nodeOutputs.get(predId) : undefined;
    if (!input) {
      appendLog(`\u26A0\uFE0F \u300C${node.name}\u300D\u65E0\u8F93\u5165\uFF0C\u8DF3\u8FC7\u3002`);
      nodeOutputs.set(nodeId, initial);
      continue;
    }

    if (node.kind === "llm") {
      const config = node.llmConfig;
      if (!config || !config.apiKey) {
        appendLog(`\u26A0\uFE0F \u300C${node.name}\u300D\u672A\u914D\u7F6E API Key\uFF0C\u8DF3\u8FC7\u3002`);
        nodeOutputs.set(nodeId, input);
        continue;
      }
      appendLog(`\u{1F916} \u300C${node.name}\u300D\u6B63\u5728\u5904\u7406\u2026`);

      const userPrompt = config.userPromptTemplate
        .replace(/\{\{title\}\}/g, input.originalTitle)
        .replace(/\{\{summary\}\}/g, input.processedContent)
        .replace(/\{\{source\}\}/g, input.sourceName)
        .replace(/\{\{link\}\}/g, input.link);

      const request: LlmRequest = {
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: config.systemPrompt,
        userPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      };

      try {
        const resp = await callLlm(request);
        appendLog(`  \u2192 \u751F\u6210 ${resp.content.length} \u5B57`);
        nodeOutputs.set(nodeId, { ...input, processedContent: resp.content });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog(`  \u2192 \u5931\u8D25: ${msg}`);
        nodeOutputs.set(nodeId, input);
      }
      appendLog(`\u2705 \u300C${node.name}\u300D\u5904\u7406\u5B8C\u6210\u3002`);
    } else {
      nodeOutputs.set(nodeId, input);
    }
  }

  const terminalIds = nodeList.filter(
    (n) => !edgeList.some((e) => e.source === n.id),
  );
  const lastNode =
    terminalIds.length > 0
      ? terminalIds[terminalIds.length - 1]
      : nodeList[nodeList.length - 1];
  const finalResult = nodeOutputs.get(lastNode.id) ?? initial;
  appendLog(`\u{1F3C1} \u5DE5\u4F5C\u6D41\u6267\u884C\u5B8C\u6210\u3002`);
  return [finalResult];
}

// ── Hook ──

export function usePipeline(onProcessComplete?: (topicId: number, content: string) => void) {
  // Saved pipelines
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>([]);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string | null>(null);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Article log entries (persisted)
  const [articleLogEntries, setArticleLogEntries] = useState<ArticleLogEntry[]>([]);

  // Callback ref to avoid stale closures
  const onCompleteRef = useRef(onProcessComplete);
  onCompleteRef.current = onProcessComplete;

  // Canvas state (editing buffer)
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Execution state
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProcessedArticle[]>([]);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Topic | null>(null);

  const appendLog = useCallback((msg: string) => {
    setRunLog((prev) =>
      [`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`, ...prev].slice(0, 100),
    );
  }, []);

  // ── Load from persistence on mount ──

  useEffect(() => {
    loadPipelines()
      .then((store) => {
        setSavedPipelines(store.pipelines.map(fromStored));
        setDefaultPipelineId(store.defaultPipelineId);
      })
      .catch(() => {/* no pipelines yet */});

    loadArticleLogStore()
      .then((store) => {
        setArticleLogEntries(store.entries);
      })
      .catch(() => {/* no logs yet */});
  }, []);

  // ── Persist helper ──

  const persist = useCallback(
    (pipelines: SavedPipeline[], defId: string | null) => {
      savePipelines({
        pipelines: pipelines.map(toStored),
        defaultPipelineId: defId,
      }).catch((err) => console.error("Failed to save pipelines:", err));
    },
    [],
  );

  // ── Article log persistence helper ──

  const persistArticleLog = useCallback(
    (entry: ArticleLogEntry) => {
      setArticleLogEntries((prev) => {
        const updated = [entry, ...prev].slice(0, 100); // Keep last 100 entries
        saveArticleLogStore({ entries: updated }).catch((err) =>
          console.error("Failed to save article logs:", err)
        );
        return updated;
      });
    },
    [],
  );

  const getLogsForTopic = useCallback(
    (topicId: number) => {
      return articleLogEntries.filter((e) => e.topicId === topicId);
    },
    [articleLogEntries],
  );

  // ── Pipeline CRUD ──

  const createPipeline = useCallback(
    (name: string) => {
      const id = `pl-${Date.now()}`;
      const sourceId = `node-${++nextId}`;
      const llmId = `node-${++nextId}`;
      const newPipeline: SavedPipeline = {
        id,
        name,
        isDefault: false,
        nodes: [
          { id: sourceId, kind: "source", name: "\u4FE1\u606F\u6E90", position: { x: 100, y: 150 } },
          {
            id: llmId,
            kind: "llm",
            name: "\u5927\u6A21\u578B\u52A0\u5DE5",
            position: { x: 400, y: 150 },
            llmConfig: defaultLlmConfig(),
          },
        ],
        edges: [{ id: `edge-${++nextId}`, source: sourceId, target: llmId }],
      };
      const updated = [...savedPipelines, newPipeline];
      setSavedPipelines(updated);
      persist(updated, defaultPipelineId);
      // Load into editor
      setEditingPipelineId(id);
      setNodes(newPipeline.nodes);
      setEdges(newPipeline.edges);
      setDirty(false);
      setSelectedNodeId(null);
      return id;
    },
    [savedPipelines, defaultPipelineId, persist],
  );

  const loadPipeline = useCallback(
    (id: string) => {
      const pl = savedPipelines.find((p) => p.id === id);
      if (!pl) return;
      setEditingPipelineId(id);
      setNodes(pl.nodes);
      setEdges(pl.edges);
      setDirty(false);
      setSelectedNodeId(null);
      setResults([]);
      setRunLog([]);
      setCurrentArticle(null);
    },
    [savedPipelines],
  );

  const saveCurrentPipeline = useCallback(() => {
    if (!editingPipelineId) return;
    const updated = savedPipelines.map((p) =>
      p.id === editingPipelineId
        ? { ...p, name: p.name, nodes, edges }
        : p,
    );
    setSavedPipelines(updated);
    setDirty(false);
    persist(updated, defaultPipelineId);
  }, [editingPipelineId, savedPipelines, nodes, edges, defaultPipelineId, persist]);

  const renamePipeline = useCallback(
    (id: string, name: string) => {
      const updated = savedPipelines.map((p) =>
        p.id === id ? { ...p, name } : p,
      );
      setSavedPipelines(updated);
      persist(updated, defaultPipelineId);
    },
    [savedPipelines, defaultPipelineId, persist],
  );

  const deletePipeline = useCallback(
    (id: string) => {
      const updated = savedPipelines.filter((p) => p.id !== id);
      const newDefaultId = defaultPipelineId === id ? null : defaultPipelineId;
      setSavedPipelines(updated);
      if (newDefaultId !== defaultPipelineId) setDefaultPipelineId(newDefaultId);
      persist(updated, newDefaultId);
      if (editingPipelineId === id) {
        setEditingPipelineId(null);
        setNodes([]);
        setEdges([]);
        setDirty(false);
      }
    },
    [savedPipelines, defaultPipelineId, editingPipelineId, persist],
  );

  const setDefaultPipeline = useCallback(
    (id: string) => {
      const updated = savedPipelines.map((p) => ({
        ...p,
        isDefault: p.id === id,
      }));
      setSavedPipelines(updated);
      setDefaultPipelineId(id);
      persist(updated, id);
    },
    [savedPipelines, persist],
  );

  const clearDefaultPipeline = useCallback(() => {
    const updated = savedPipelines.map((p) => ({ ...p, isDefault: false }));
    setSavedPipelines(updated);
    setDefaultPipelineId(null);
    persist(updated, null);
  }, [savedPipelines, persist]);

  const closeEditor = useCallback(() => {
    setEditingPipelineId(null);
    setNodes([]);
    setEdges([]);
    setDirty(false);
    setSelectedNodeId(null);
    setResults([]);
    setRunLog([]);
    setCurrentArticle(null);
  }, []);

  // ── Node CRUD ──

  const addNode = useCallback(
    (kind: PipelineNodeKind, position: { x: number; y: number }) => {
      const id = `node-${++nextId}`;
      const name = kind === "source" ? "\u4FE1\u606F\u6E90" : "\u5927\u6A21\u578B";
      const node: PipelineNode = {
        id,
        kind,
        name,
        position,
        ...(kind === "llm" ? { llmConfig: defaultLlmConfig() } : {}),
      };
      setNodes((prev) => [...prev, node]);
      setSelectedNodeId(id);
      setDirty(true);
      return id;
    },
    [],
  );

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
    setDirty(true);
  }, []);

  const updateNodePosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, position } : n)));
      setDirty(true);
    },
    [],
  );

  const updateLlmConfig = useCallback(
    (nodeId: string, config: Partial<LlmNodeConfig>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                llmConfig: {
                  apiEndpoint: "",
                  apiKey: "",
                  model: "",
                  systemPrompt: "",
                  userPromptTemplate: "",
                  temperature: 0.7,
                  maxTokens: 2000,
                  ...n.llmConfig,
                  ...config,
                },
              }
            : n,
        ),
      );
      setDirty(true);
    },
    [],
  );

  // ── Edge CRUD ──

  const addEdge = useCallback((source: string, target: string) => {
    if (source === target) return;
    setEdges((prev) => {
      if (prev.some((e) => e.source === source && e.target === target)) return prev;
      return [...prev, { id: `edge-${++nextId}`, source, target }];
    });
    setDirty(true);
  }, []);

  const removeEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setDirty(true);
  }, []);

  // ── Execute current canvas pipeline ──

  const processArticle = async (topic: Topic) => {
    setRunning(true);
    setResults([]);
    setRunLog([]);
    setCurrentArticle(topic);
    const collectedLogs: string[] = [];
    const collectLog = (msg: string) => {
      const timestamped = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`;
      collectedLogs.push(timestamped);
      appendLog(msg);
    };
    const startTime = new Date().toISOString();
    try {
      const res = await executePipeline(nodes, edges, topic, collectLog);
      setResults(res);
      // Persist processed content back to the topic
      if (res.length > 0 && res[0].processedContent) {
        onCompleteRef.current?.(topic.id, res[0].processedContent);
      }
      // Persist log entry
      const hasError = collectedLogs.some((l) => l.includes("❌") || l.includes("失败"));
      persistArticleLog({
        id: `log-${Date.now()}`,
        topicId: topic.id,
        topicTitle: topic.title,
        timestamp: startTime,
        status: hasError ? "failed" : "completed",
        logs: collectedLogs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      collectLog(`\u274C \u5DE5\u4F5C\u6D41\u6267\u884C\u51FA\u9519: ${msg}`);
      // Persist log entry on error
      persistArticleLog({
        id: `log-${Date.now()}`,
        topicId: topic.id,
        topicTitle: topic.title,
        timestamp: startTime,
        status: "failed",
        logs: collectedLogs,
      });
    } finally {
      setRunning(false);
    }
  };

  // ── Execute a saved pipeline directly (for auto-execution) ──

  const runSavedPipeline = async (
    pipelineId: string,
    topic: Topic,
  ): Promise<ProcessedArticle[]> => {
    const pl = savedPipelines.find((p) => p.id === pipelineId);
    if (!pl) return [];
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);
    try {
      const res = await executePipeline(pl.nodes, pl.edges, topic, log);
      return res;
    } catch {
      return [];
    }
  };

  // ── Execute a saved pipeline with full UI state and log persistence ──

  const processArticleWithSavedPipeline = async (pipelineId: string, topic: Topic) => {
    const pl = savedPipelines.find((p) => p.id === pipelineId);
    if (!pl) {
      appendLog("未找到指定的流水线。");
      return;
    }
    setRunning(true);
    setResults([]);
    setRunLog([]);
    setCurrentArticle(topic);
    const collectedLogs: string[] = [];
    const collectLog = (msg: string) => {
      const timestamped = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`;
      collectedLogs.push(timestamped);
      appendLog(msg);
    };
    const startTime = new Date().toISOString();
    collectLog(`📋 使用流水线「${pl.name}」处理：${topic.title}`);
    try {
      const res = await executePipeline(pl.nodes, pl.edges, topic, collectLog);
      setResults(res);
      if (res.length > 0 && res[0].processedContent) {
        onCompleteRef.current?.(topic.id, res[0].processedContent);
      }
      const hasError = collectedLogs.some((l) => l.includes("❌") || l.includes("失败"));
      persistArticleLog({
        id: `log-${Date.now()}`,
        topicId: topic.id,
        topicTitle: topic.title,
        timestamp: startTime,
        status: hasError ? "failed" : "completed",
        logs: collectedLogs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      collectLog(`\u274C 工作流执行出错: ${msg}`);
      persistArticleLog({
        id: `log-${Date.now()}`,
        topicId: topic.id,
        topicTitle: topic.title,
        timestamp: startTime,
        status: "failed",
        logs: collectedLogs,
      });
    } finally {
      setRunning(false);
    }
  };

  // ── Auto-execute default pipeline for a topic ──

  const autoProcessTopic = async (topic: Topic) => {
    if (!defaultPipelineId) return;
    const pl = savedPipelines.find((p) => p.id === defaultPipelineId);
    if (!pl) return;
    appendLog(`\u26A1 \u81EA\u52A8\u6267\u884C\u9ED8\u8BA4\u6D41\u6C34\u7EBF\u300C${pl.name}\u300D\u5904\u7406\uFF1A${topic.title}`);
    setRunning(true);
    setCurrentArticle(topic);
    setResults([]);
    setRunLog([]);
    try {
      const res = await executePipeline(pl.nodes, pl.edges, topic, appendLog);
      setResults(res);
      // Persist processed content back to the topic
      if (res.length > 0 && res[0].processedContent) {
        onCompleteRef.current?.(topic.id, res[0].processedContent);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`\u274C \u81EA\u52A8\u6267\u884C\u51FA\u9519: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const editingPipeline =
    savedPipelines.find((p) => p.id === editingPipelineId) ?? null;

  return {
    // Pipeline management
    savedPipelines,
    defaultPipelineId,
    editingPipelineId,
    editingPipeline,
    dirty,
    createPipeline,
    loadPipeline,
    saveCurrentPipeline,
    renamePipeline,
    deletePipeline,
    setDefaultPipeline,
    clearDefaultPipeline,
    closeEditor,
    // Canvas state
    nodes,
    edges,
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    addNode,
    removeNode,
    updateNodePosition,
    updateLlmConfig,
    addEdge,
    removeEdge,
    // Execution
    running,
    results,
    runLog,
    currentArticle,
    processArticle,
    processArticleWithSavedPipeline,
    runSavedPipeline,
    autoProcessTopic,
    // Article logs
    articleLogEntries,
    getLogsForTopic,
  };
}
