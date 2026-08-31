import { useCallback, useState } from "react";

import { callLlm, type LlmRequest } from "../../../lib/tauri";
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

// ── Hook ──

export function usePipeline() {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProcessedArticle[]>([]);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [currentArticle, setCurrentArticle] = useState<Topic | null>(null);

  const appendLog = useCallback((msg: string) => {
    setRunLog((prev) =>
      [`[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${msg}`, ...prev].slice(0, 100),
    );
  }, []);

  // ── Node CRUD ──

  const addNode = (kind: PipelineNodeKind, position: { x: number; y: number }) => {
    const id = `node-${++nextId}`;
    const name = kind === "source" ? "信息源" : "大模型";
    const node: PipelineNode = {
      id,
      kind,
      name,
      position,
      ...(kind === "llm" ? { llmConfig: defaultLlmConfig() } : {}),
    };
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(id);
    return id;
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
  };

  const updateNodePosition = (id: string, position: { x: number; y: number }) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, position } : n)));
  };

  const updateLlmConfig = (nodeId: string, config: Partial<LlmNodeConfig>) => {
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
  };

  // ── Edge CRUD ──

  const addEdge = (source: string, target: string) => {
    if (source === target) return;
    setEdges((prev) => {
      if (prev.some((e) => e.source === source && e.target === target)) return prev;
      return [...prev, { id: `edge-${++nextId}`, source, target }];
    });
  };

  const removeEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  // ── Topological sort ──

  const topoSort = (): string[] | null => {
    const outEdges = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    for (const n of nodes) {
      outEdges.set(n.id, []);
      inDegree.set(n.id, 0);
    }
    for (const e of edges) {
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
    return order.length === nodes.length ? order : null;
  };

  // ── Pipeline execution: process a single topic/article ──

  const processArticle = async (topic: Topic) => {
    setRunning(true);
    setResults([]);
    setRunLog([]);
    setCurrentArticle(topic);

    try {
      if (nodes.length === 0) {
        appendLog("工作流为空，请先添加节点。");
        setRunning(false);
        return;
      }

      const order = topoSort();
      if (!order) {
        appendLog("检测到环路，工作流无法执行。");
        setRunning(false);
        return;
      }

      // Source node output: the selected article
      const sourceNode = nodes.find((n) => n.kind === "source");
      if (!sourceNode) {
        appendLog("未找到信息源节点。");
        setRunning(false);
        return;
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
      appendLog(`📰 「${sourceNode.name}」输入文章：${topic.title}`);

      // Process downstream nodes in topological order
      for (const nodeId of order) {
        if (nodeId === sourceNode.id) continue;
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        // Get input from the first predecessor (single-article flow)
        const predId = edges.find((e) => e.target === nodeId)?.source;
        const input = predId ? nodeOutputs.get(predId) : undefined;
        if (!input) {
          appendLog(`⚠️ 「${node.name}」无输入，跳过。`);
          nodeOutputs.set(nodeId, initial);
          continue;
        }

        if (node.kind === "llm") {
          const config = node.llmConfig;
          if (!config || !config.apiKey) {
            appendLog(`⚠️ 「${node.name}」未配置 API Key，跳过。`);
            nodeOutputs.set(nodeId, input);
            continue;
          }

          appendLog(`🤖 「${node.name}」正在处理…`);

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
            appendLog(`  → 生成 ${resp.content.length} 字`);
            nodeOutputs.set(nodeId, { ...input, processedContent: resp.content });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            appendLog(`  → 失败: ${msg}`);
            nodeOutputs.set(nodeId, input);
          }
          appendLog(`✅ 「${node.name}」处理完成。`);
        } else {
          // Source node in non-start position: pass through
          nodeOutputs.set(nodeId, input);
        }
      }

      // Collect result from terminal node
      const terminalIds = nodes.filter(
        (n) => !edges.some((e) => e.source === n.id),
      );
      const lastNode = terminalIds.length > 0 ? terminalIds[terminalIds.length - 1] : nodes[nodes.length - 1];
      const finalResult = nodeOutputs.get(lastNode.id) ?? initial;

      setResults([finalResult]);
      appendLog(`🏁 工作流执行完成。`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(`❌ 工作流执行出错: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return {
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
    running,
    results,
    runLog,
    currentArticle,
    processArticle,
  };
}
