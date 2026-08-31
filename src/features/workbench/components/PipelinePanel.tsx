import {
  Background,
  Controls,
  type Connection,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { callLlm } from "../../../lib/tauri";
import type {
  LlmNodeConfig,
  PipelineNode,
  PipelineNodeKind,
  ProcessedArticle,
  FlowEdge,
  SavedPipeline,
  Topic,
} from "../types";
import { PipelineNodeComponent } from "./PipelineNode";

const nodeTypes = { pipelineNode: PipelineNodeComponent };

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: { stroke: "#b1b1b1", strokeWidth: 1.5 },
};

// ── Props ──

export function PipelinePanel({
  savedPipelines,
  defaultPipelineId,
  editingPipelineId,
  editingPipeline,
  dirty,
  nodes,
  edges,
  selectedNodeId,
  selectedNode,
  onSelectNode,
  onAddNode,
  onRemoveNode,
  onUpdateNodePosition,
  onUpdateLlmConfig,
  onAddEdge,
  onRemoveEdge,
  onCreatePipeline,
  onLoadPipeline,
  onSavePipeline,
  onRenamePipeline,
  onDeletePipeline,
  onSetDefaultPipeline,
  onClearDefaultPipeline,
  onCloseEditor,
  running,
  results,
  runLog,
  currentArticle,
  newsSources,
}: {
  savedPipelines: SavedPipeline[];
  defaultPipelineId: string | null;
  editingPipelineId: string | null;
  editingPipeline: SavedPipeline | null;
  dirty: boolean;
  nodes: PipelineNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  selectedNode: PipelineNode | null;
  onSelectNode: (id: string | null) => void;
  onAddNode: (kind: PipelineNodeKind, position: { x: number; y: number }) => string;
  onRemoveNode: (id: string) => void;
  onUpdateNodePosition: (id: string, pos: { x: number; y: number }) => void;
  onUpdateLlmConfig: (nodeId: string, config: Partial<LlmNodeConfig>) => void;
  onAddEdge: (source: string, target: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onCreatePipeline: (name: string) => string;
  onLoadPipeline: (id: string) => void;
  onSavePipeline: () => void;
  onRenamePipeline: (id: string, name: string) => void;
  onDeletePipeline: (id: string) => void;
  onSetDefaultPipeline: (id: string) => void;
  onClearDefaultPipeline: () => void;
  onCloseEditor: () => void;
  running: boolean;
  results: ProcessedArticle[];
  runLog: string[];
  currentArticle: Topic | null;
  newsSources: { id: string; name: string }[];
}) {
  // If editing a pipeline, show the editor; otherwise show the list
  if (editingPipelineId && editingPipeline) {
    return (
      <PipelineEditor
        editingPipeline={editingPipeline}
        dirty={dirty}
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        selectedNode={selectedNode}
        onSelectNode={onSelectNode}
        onAddNode={onAddNode}
        onRemoveNode={onRemoveNode}
        onUpdateNodePosition={onUpdateNodePosition}
        onUpdateLlmConfig={onUpdateLlmConfig}
        onAddEdge={onAddEdge}
        onRemoveEdge={onRemoveEdge}
        onSavePipeline={onSavePipeline}
        onLoadPipeline={onLoadPipeline}
        onCloseEditor={onCloseEditor}
        running={running}
        results={results}
        runLog={runLog}
        currentArticle={currentArticle}
      />
    );
  }

  return (
    <PipelineList
      savedPipelines={savedPipelines}
      defaultPipelineId={defaultPipelineId}
      onCreatePipeline={onCreatePipeline}
      onLoadPipeline={onLoadPipeline}
      onRenamePipeline={onRenamePipeline}
      onDeletePipeline={onDeletePipeline}
      onSetDefaultPipeline={onSetDefaultPipeline}
      onClearDefaultPipeline={onClearDefaultPipeline}
    />
  );
}

// ══════════════════════════════════════════════════════════════
// Pipeline List View
// ══════════════════════════════════════════════════════════════

function PipelineList({
  savedPipelines,
  defaultPipelineId,
  onCreatePipeline,
  onLoadPipeline,
  onRenamePipeline,
  onDeletePipeline,
  onSetDefaultPipeline,
  onClearDefaultPipeline,
}: {
  savedPipelines: SavedPipeline[];
  defaultPipelineId: string | null;
  onCreatePipeline: (name: string) => string;
  onLoadPipeline: (id: string) => void;
  onRenamePipeline: (id: string, name: string) => void;
  onDeletePipeline: (id: string) => void;
  onSetDefaultPipeline: (id: string) => void;
  onClearDefaultPipeline: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreatePipeline(name);
    setNewName("");
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenamePipeline(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb", marginBottom: "0.5rem",
      }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>流水线管理</h2>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#888" }}>
          共 {savedPipelines.length} 条流水线
        </span>
      </div>

      {/* Create new pipeline */}
      <div style={{
        display: "flex", gap: "0.5rem", padding: "0.75rem 0",
        borderBottom: "1px solid #f0f0f0",
      }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="新建流水线名称…"
          style={{
            flex: 1, padding: "8px 12px", border: "1px solid #ddd",
            borderRadius: 8, fontSize: 13, outline: "none",
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: newName.trim() ? "#7c3aed" : "#e5e7eb",
            color: newName.trim() ? "#fff" : "#aaa",
            fontSize: 13, fontWeight: 500, cursor: newName.trim() ? "pointer" : "default",
          }}
        >
          + 新建
        </button>
      </div>

      {/* Pipeline list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
        {savedPipelines.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#aaa" }}>
            <div style={{ fontSize: 40, marginBottom: "0.75rem" }}>📋</div>
            <p style={{ fontSize: 14 }}>还没有流水线</p>
            <p style={{ fontSize: 12 }}>在上方输入名称创建第一条流水线</p>
          </div>
        )}
        {savedPipelines.map((pl) => {
          const isDefault = pl.id === defaultPipelineId;
          const isRenaming = renamingId === pl.id;
          return (
            <div
              key={pl.id}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.65rem 0.75rem", margin: "0 0 0.35rem",
                borderRadius: 10, border: "1px solid #e5e7eb",
                background: "#fff", transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c4b5fd"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            >
              {/* Icon */}
              <span style={{ fontSize: 20, flexShrink: 0 }}>
                {isDefault ? "\u2B50" : "\u{1F4CB}"}
              </span>

              {/* Name / rename input */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                      if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                    }}
                    onBlur={confirmRename}
                    style={{
                      width: "100%", padding: "4px 8px", border: "1px solid #7c3aed",
                      borderRadius: 6, fontSize: 13, outline: "none",
                    }}
                  />
                ) : (
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>
                    {pl.name}
                    {isDefault && (
                      <span style={{
                        marginLeft: 8, fontSize: 11, fontWeight: 500,
                        color: "#7c3aed", background: "#f3e8ff",
                        padding: "2px 6px", borderRadius: 4,
                      }}>
                        默认
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                  {pl.nodes.length} 个节点 · {pl.edges.length} 条连线
                </div>
              </div>

              {/* Actions */}
              {!isRenaming && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <SmallBtn
                    title="编辑"
                    onClick={() => onLoadPipeline(pl.id)}
                    style={{ color: "#7c3aed", borderColor: "#ddd6fe" }}
                  >
                    ✏️
                  </SmallBtn>
                  <SmallBtn
                    title={isDefault ? "取消默认" : "设为默认"}
                    onClick={() => isDefault ? onClearDefaultPipeline() : onSetDefaultPipeline(pl.id)}
                    style={{ color: isDefault ? "#f59e0b" : "#888", borderColor: "#e5e7eb" }}
                  >
                    {isDefault ? "★" : "☆"}
                  </SmallBtn>
                  <SmallBtn
                    title="重命名"
                    onClick={() => startRename(pl.id, pl.name)}
                    style={{ color: "#888", borderColor: "#e5e7eb" }}
                  >
                    ✎
                  </SmallBtn>
                  <SmallBtn
                    title="删除"
                    onClick={() => { if (confirm(`确定删除流水线「${pl.name}」？`)) onDeletePipeline(pl.id); }}
                    style={{ color: "#ef4444", borderColor: "#fecaca" }}
                  >
                    🗑
                  </SmallBtn>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <div style={{
        padding: "0.75rem", borderTop: "1px solid #e5e7eb",
        fontSize: 12, color: "#aaa", lineHeight: 1.6,
      }}>
        <b>默认流水线</b>会在新闻导入选题池时自动执行加工。
        点击 ☆ 将流水线设为默认。
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Pipeline Editor View
// ══════════════════════════════════════════════════════════════

function PipelineEditor({
  editingPipeline,
  dirty,
  nodes,
  edges,
  selectedNodeId,
  selectedNode,
  onSelectNode,
  onAddNode,
  onRemoveNode,
  onUpdateNodePosition,
  onUpdateLlmConfig,
  onAddEdge,
  onRemoveEdge,
  onSavePipeline,
  onLoadPipeline,
  onCloseEditor,
  running,
  results,
  runLog,
  currentArticle,
}: {
  editingPipeline: SavedPipeline;
  dirty: boolean;
  nodes: PipelineNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  selectedNode: PipelineNode | null;
  onSelectNode: (id: string | null) => void;
  onAddNode: (kind: PipelineNodeKind, position: { x: number; y: number }) => string;
  onRemoveNode: (id: string) => void;
  onUpdateNodePosition: (id: string, pos: { x: number; y: number }) => void;
  onUpdateLlmConfig: (nodeId: string, config: Partial<LlmNodeConfig>) => void;
  onAddEdge: (source: string, target: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onSavePipeline: () => void;
  onLoadPipeline: (id: string) => void;
  onCloseEditor: () => void;
  running: boolean;
  results: ProcessedArticle[];
  runLog: string[];
  currentArticle: Topic | null;
}) {
  type AppNode = Node<PipelineNode>;

  // ── Context menu state ──
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; nodeId: string | null;
  } | null>(null);
  const rfInstance = useRef<ReactFlowInstance<AppNode, Edge> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const flowNodes: AppNode[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "pipelineNode" as const,
        position: n.position,
        data: n,
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: running,
      })),
    [edges, running],
  );

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState(flowNodes);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => { setRfNodes(flowNodes); }, [flowNodes, setRfNodes]);
  useEffect(() => { setRfEdges(flowEdges); }, [flowEdges, setRfEdges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onAddEdge(connection.source, connection.target);
      }
    },
    [onAddEdge],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => { onSelectNode(node.id); },
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => { onSelectNode(null); }, [onSelectNode]);

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      onUpdateNodePosition(node.id, node.position);
    },
    [onUpdateNodePosition],
  );

  const handleDelete = useCallback(
    (deletions: { nodes: Node[]; edges: Edge[] }) => {
      for (const n of deletions.nodes) onRemoveNode(n.id);
      for (const e of deletions.edges) onRemoveEdge(e.id);
    },
    [onRemoveNode, onRemoveEdge],
  );

  // ── Context menu handlers ──

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setCtxMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [],
  );

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const clientX = "clientX" in event ? event.clientX : (event as MouseEvent).clientX;
      const clientY = "clientY" in event ? event.clientY : (event as MouseEvent).clientY;
      setCtxMenu({ x: clientX, y: clientY, nodeId: null });
    },
    [],
  );

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [ctxMenu]);

  const handleAddNodeAt = (kind: PipelineNodeKind) => {
    if (!ctxMenu || !rfInstance.current) return;
    const pos = rfInstance.current.screenToFlowPosition({
      x: ctxMenu.x, y: ctxMenu.y,
    });
    onAddNode(kind, { x: pos.x, y: pos.y });
    setCtxMenu(null);
  };

  const handleAddNode = (kind: PipelineNodeKind) => {
    const offset = nodes.length * 80;
    onAddNode(kind, { x: 120 + offset, y: 120 + offset });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.5rem 0", borderBottom: "1px solid #e5e7eb", marginBottom: "0.5rem",
      }}>
        <button
          onClick={onCloseEditor}
          style={{
            background: "none", border: "1px solid #ddd", borderRadius: 6,
            padding: "4px 10px", cursor: "pointer", fontSize: 13, color: "#555",
          }}
          title="返回流水线列表"
        >
          ← 列表
        </button>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          {editingPipeline.name}
        </h2>
        {dirty && (
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 500 }}>● 未保存</span>
        )}
        <span style={{ flex: 1 }} />
        {running && (
          <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 500 }}>⏳ 执行中…</span>
        )}
        <button
          onClick={onSavePipeline}
          disabled={!dirty}
          style={{
            padding: "6px 16px", borderRadius: 8, border: "none",
            background: dirty ? "#7c3aed" : "#e5e7eb",
            color: dirty ? "#fff" : "#aaa",
            fontSize: 13, fontWeight: 500,
            cursor: dirty ? "pointer" : "default",
          }}
        >
          💾 保存
        </button>
      </div>

      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
        {/* ── Left: Node palette ── */}
        <div style={{
          width: 180, flexShrink: 0, padding: "0.75rem",
          borderRight: "1px solid #e5e7eb", background: "#fafbfc",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", marginBottom: "0.5rem", letterSpacing: 0.5 }}>
            节点列表
          </div>
          <PaletteButton
            icon="📰" label="信息源" desc="文章输入"
            color="#52c41a" onClick={() => handleAddNode("source")}
          />
          <PaletteButton
            icon="🤖" label="大模型" desc="LLM 加工"
            color="#7c3aed" onClick={() => handleAddNode("llm")}
          />
          <div style={{ marginTop: "1rem", fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
            点击添加节点到画布。拖动端口创建连线。右键可快速添加。
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div ref={canvasRef} style={{ flex: 1, minWidth: 0, background: "#f8f9fb", position: "relative" }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onRfNodesChange}
            onEdgesChange={onRfEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStop={handleNodeDragStop}
            onDelete={handleDelete}
            onInit={(inst) => { rfInstance.current = inst; }}
            onNodeContextMenu={handleNodeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e0e0e0" gap={20} size={1} />
            <Controls
              showInteractive={false}
              style={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
          </ReactFlow>

          {/* ── Context menu ── */}
          {ctxMenu && (
            <ContextMenu
              x={ctxMenu.x}
              y={ctxMenu.y}
              anchor={canvasRef.current}
              onClose={closeCtxMenu}
            >
              {ctxMenu.nodeId ? (
                <CtxItem
                  icon="🗑️" label="删除节点" danger
                  onClick={() => { onRemoveNode(ctxMenu.nodeId!); closeCtxMenu(); }}
                />
              ) : (
                <>
                  <CtxItem icon="📰" label="添加信息源"
                    onClick={() => handleAddNodeAt("source")} />
                  <CtxItem icon="🤖" label="添加大模型"
                    onClick={() => handleAddNodeAt("llm")} />
                </>
              )}
            </ContextMenu>
          )}
        </div>

        {/* ── Right: Config panel ── */}
        <div style={{
          width: 340, flexShrink: 0, borderLeft: "1px solid #e5e7eb",
          background: "#fff", overflowY: "auto",
        }}>
          {selectedNode ? (
            <div style={{ padding: "0.75rem" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "0.75rem",
              }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {selectedNode.kind === "source" ? "📰" : "🤖"} {selectedNode.name}
                </h3>
                <button
                  onClick={() => onRemoveNode(selectedNode.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16 }}
                  title="删除节点"
                >
                  ×
                </button>
              </div>

              {selectedNode.kind === "source" && (
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {currentArticle ? (
                    <>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>当前文章</span>
                      </div>
                      <div style={{
                        padding: "0.6rem", background: "#f8f9fb", borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#111", marginBottom: "0.35rem" }}>
                          {currentArticle.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: "0.35rem" }}>
                          来源：{currentArticle.source}
                        </div>
                        {currentArticle.summary && (
                          <div style={{
                            fontSize: 12, color: "#444", lineHeight: 1.6,
                            marginTop: "0.35rem", paddingTop: "0.35rem",
                            borderTop: "1px solid #eee",
                          }}>
                            {currentArticle.summary}
                          </div>
                        )}
                        {currentArticle.link && (
                          <div style={{ marginTop: "0.35rem" }}>
                            <a
                              href={currentArticle.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 11, color: "#4a90d9", textDecoration: "none" }}
                            >
                              查看原文 →
                            </a>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ color: "#888" }}>信息源节点负责将选题池中的文章传递给后续处理节点。</p>
                      <p style={{ color: "#aaa", marginTop: "0.5rem" }}>在选题池中点击「▶ 工作流」即可触发执行。</p>
                    </>
                  )}
                </div>
              )}

              {selectedNode.kind === "llm" && (
                <LlmConfigEditor
                  nodeId={selectedNode.id}
                  config={selectedNode.llmConfig ?? {
                    apiEndpoint: "",
                    apiKey: "",
                    model: "",
                    systemPrompt: "",
                    userPromptTemplate: "",
                    temperature: 0.7,
                    maxTokens: 2000,
                  }}
                  onUpdate={onUpdateLlmConfig}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: "1.5rem 1rem", color: "#888", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: "0.5rem" }}>👈</div>
              <p style={{ fontSize: 13 }}>点击画布中的节点查看配置</p>
            </div>
          )}

          {/* ── Execution results ── */}
          {results.length > 0 && (
            <div style={{ padding: "0.75rem", borderTop: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: 13, fontWeight: 600 }}>加工结果</h4>
              {results.map((r, i) => (
                <details key={i} style={{ marginBottom: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: 13 }}>
                    <b>{r.originalTitle}</b>
                  </summary>
                  <pre style={{
                    whiteSpace: "pre-wrap", fontSize: 12, background: "#f9f9f9",
                    padding: "0.5rem", borderRadius: 6, marginTop: "0.25rem",
                    maxHeight: 300, overflow: "auto", lineHeight: 1.6,
                  }}>
                    {r.processedContent}
                  </pre>
                </details>
              ))}
            </div>
          )}

          {/* ── Execution log ── */}
          {runLog.length > 0 && (
            <div style={{ padding: "0.75rem", borderTop: "1px solid #e5e7eb" }}>
              <details>
                <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#888" }}>
                  执行日志（{runLog.length}）
                </summary>
                <pre style={{
                  fontSize: 11, maxHeight: 200, overflow: "auto",
                  background: "#f5f5f5", padding: "0.5rem", borderRadius: 4,
                  marginTop: "0.25rem", lineHeight: 1.5,
                }}>
                  {runLog.join("\n")}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════
// Shared sub-components
// ══════════════════════════════════════════════════════════════

function SmallBtn({
  children, title, onClick, style,
}: {
  children: React.ReactNode; title: string; onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 30, borderRadius: 6,
        border: "1px solid #e5e7eb", background: "#fff",
        cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 14, padding: 0, transition: "background 0.1s",
        ...style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f5f5"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
    >
      {children}
    </button>
  );
}

function ContextMenu({
  x, y, anchor, onClose, children,
}: {
  x: number; y: number;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const rect = anchor?.getBoundingClientRect();
  const left = rect ? x - rect.left : x;
  const top = rect ? y - rect.top : y;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "absolute", left, top, zIndex: 1000,
        background: "#fff", borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb", padding: "4px 0",
        minWidth: 160, fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function CtxItem({
  icon, label, danger, onClick,
}: {
  icon: string; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", padding: "8px 14px", border: "none",
        background: "none", cursor: "pointer", textAlign: "left",
        color: danger ? "#ef4444" : "#333", fontSize: 13,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "#fef2f2" : "#f5f5f5"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

function PaletteButton({
  icon, label, desc, color, onClick,
}: {
  icon: string; label: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        width: "100%", padding: "0.5rem 0.6rem", marginBottom: "0.35rem",
        border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff",
        cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#999" }}>{desc}</div>
      </div>
    </button>
  );
}

function LlmConfigEditor({
  nodeId, config, onUpdate,
}: {
  nodeId: string;
  config: LlmNodeConfig;
  onUpdate: (nodeId: string, config: Partial<LlmNodeConfig>) => void;
}) {
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const handleTest = async () => {
    if (!config.apiEndpoint || !config.apiKey || !config.model) {
      setTestState("error");
      setTestMsg("请先填写 API 端点、API Key 和模型名称。");
      return;
    }
    setTestState("testing");
    setTestMsg("");
    try {
      const resp = await callLlm({
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model,
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Hi",
        temperature: 0,
        maxTokens: 10,
      });
      setTestState("success");
      setTestMsg(`连通成功 · 模型: ${resp.model}${resp.usage ? ` · ${resp.usage.totalTokens} tokens` : ""}`);
    } catch (err) {
      setTestState("error");
      setTestMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const labelStyle = { display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 2 };
  const inputStyle = {
    width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6,
    fontSize: 13, outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <label>
        <span style={labelStyle}>API 端点</span>
        <input style={inputStyle} value={config.apiEndpoint}
          onChange={(e) => onUpdate(nodeId, { apiEndpoint: e.target.value })}
          placeholder="https://api.openai.com/v1/chat/completions" />
      </label>
      <label>
        <span style={labelStyle}>API Key</span>
        <input style={inputStyle} type="password" value={config.apiKey}
          onChange={(e) => onUpdate(nodeId, { apiKey: e.target.value })}
          placeholder="sk-..." />
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <label style={{ flex: 1 }}>
          <span style={labelStyle}>模型</span>
          <input style={inputStyle} value={config.model}
            onChange={(e) => onUpdate(nodeId, { model: e.target.value })}
            placeholder="gpt-4o-mini" />
        </label>
        <label style={{ width: 80 }}>
          <span style={labelStyle}>温度</span>
          <input style={inputStyle} type="number" min={0} max={2} step={0.1}
            value={config.temperature}
            onChange={(e) => onUpdate(nodeId, { temperature: parseFloat(e.target.value) || 0.7 })} />
        </label>
      </div>

      {/* ── Test connection ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          onClick={handleTest}
          disabled={testState === "testing"}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid",
            borderColor: testState === "success" ? "#86efac" : testState === "error" ? "#fca5a5" : "#ddd",
            background: testState === "success" ? "#f0fdf4" : testState === "error" ? "#fef2f2" : "#fff",
            color: testState === "testing" ? "#aaa" : "#333",
            fontSize: 12, fontWeight: 500, cursor: testState === "testing" ? "wait" : "pointer",
            transition: "all 0.15s", whiteSpace: "nowrap",
          }}
        >
          {testState === "testing" ? "⏳ 测试中…" : testState === "success" ? "✅ 已连通" : testState === "error" ? "❌ 失败" : "🔌 测试连通"}
        </button>
        {testMsg && (
          <span style={{
            fontSize: 11, lineHeight: 1.4, flex: 1,
            color: testState === "success" ? "#16a34a" : testState === "error" ? "#dc2626" : "#888",
          }}>
            {testMsg}
          </span>
        )}
      </div>

      <label>
        <span style={labelStyle}>系统提示词</span>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
          value={config.systemPrompt}
          onChange={(e) => onUpdate(nodeId, { systemPrompt: e.target.value })} />
      </label>
      <label>
        <span style={labelStyle}>用户提示词模板</span>
        <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
          value={config.userPromptTemplate}
          onChange={(e) => onUpdate(nodeId, { userPromptTemplate: e.target.value })} />
        <span style={{ fontSize: 11, color: "#aaa", marginTop: 2, display: "block" }}>
          变量：{`{{title}}`} {`{{summary}}`} {`{{source}}`} {`{{link}}`}
        </span>
      </label>
    </div>
  );
}
