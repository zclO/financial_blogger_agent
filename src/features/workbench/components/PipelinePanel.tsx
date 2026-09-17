import {
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  type ReactFlowInstance,
  useNodesState,
  useEdgesState,
  type Edge,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { callLlm, generateImage, generateImageCf, generateImageTx } from "../../../lib/tauri";
import type {
  ImageCfNodeConfig,
  ImageNodeConfig,
  ImageTxNodeConfig,
  LlmNodeConfig,
  PipelineNode,
  PipelineNodeKind,
  ProcessedArticle,
  FlowEdge,
  SavedPipeline,
  Topic,
} from "../types";
import { PipelineNodeComponent, NODE_COLORS, getNodeIcon } from "./PipelineNode";

const nodeTypes = { pipelineNode: PipelineNodeComponent };

// ── Custom gradient edge ──

function PipelineEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {}, markerEnd, source, target,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  // Get colors from node data if available
  const sourceColor = "#b1b1b1";
  const targetColor = "#b1b1b1";
  const gradientId = `gradient-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <path
        id={id}
        className="pipeline-edge-path"
        style={style}
        d={edgePath}
        stroke={`url(#${gradientId})`}
        markerEnd={markerEnd}
      />
    </>
  );
}

const edgeTypes = { pipelineEdge: PipelineEdge };

const defaultEdgeOptions = {
  type: "pipelineEdge" as const,
  style: { strokeWidth: 2 },
  animated: false,
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
  onUpdateImageConfig,
  onUpdateImageCfConfig,
  onUpdateImageTxConfig,
  onAddEdge,
  onRemoveEdge,
  onCreatePipeline,
  onLoadPipeline,
  onSavePipeline,
  onRenamePipeline,
  onDeletePipeline,
  onSetDefaultPipeline,
  onClearDefaultPipeline,
  onCopyPipeline,
  onCloseEditor,
  running,
  results,
  runLog,
  currentArticle
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
  onUpdateImageConfig: (nodeId: string, config: Partial<ImageNodeConfig>) => void;
  onUpdateImageCfConfig: (nodeId: string, config: Partial<ImageCfNodeConfig>) => void;
  onUpdateImageTxConfig: (nodeId: string, config: Partial<ImageTxNodeConfig>) => void;
  onAddEdge: (source: string, target: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onCreatePipeline: (name: string) => string;
  onLoadPipeline: (id: string) => void;
  onSavePipeline: () => void;
  onRenamePipeline: (id: string, name: string) => void;
  onDeletePipeline: (id: string) => void;
  onSetDefaultPipeline: (id: string) => void;
  onClearDefaultPipeline: () => void;
  onCopyPipeline: (id: string) => void;
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
        onUpdateImageConfig={onUpdateImageConfig}
        onUpdateImageCfConfig={onUpdateImageCfConfig}
        onUpdateImageTxConfig={onUpdateImageTxConfig}
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
      onCopyPipeline={onCopyPipeline}
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
  onCopyPipeline,
}: {
  savedPipelines: SavedPipeline[];
  defaultPipelineId: string | null;
  onCreatePipeline: (name: string) => string;
  onLoadPipeline: (id: string) => void;
  onRenamePipeline: (id: string, name: string) => void;
  onDeletePipeline: (id: string) => void;
  onSetDefaultPipeline: (id: string) => void;
  onClearDefaultPipeline: () => void;
  onCopyPipeline: (id: string) => void;
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
                    title="复制流水线"
                    onClick={() => onCopyPipeline(pl.id)}
                    style={{ color: "#0ea5e9", borderColor: "#bae6fd" }}
                  >
                    ⧉
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
  onUpdateImageConfig,
  onUpdateImageCfConfig,
  onUpdateImageTxConfig,
  onAddEdge,
  onRemoveEdge,
  onSavePipeline,
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
  onUpdateImageConfig: (nodeId: string, config: Partial<ImageNodeConfig>) => void;
  onUpdateImageCfConfig: (nodeId: string, config: Partial<ImageCfNodeConfig>) => void;
  onUpdateImageTxConfig: (nodeId: string, config: Partial<ImageTxNodeConfig>) => void;
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
  const [paletteCollapsed, setPaletteCollapsed] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const rfInstance = useRef<ReactFlowInstance<AppNode, Edge> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Drag from palette ──
  const handleDragStart = (e: React.DragEvent, kind: PipelineNodeKind) => {
    e.dataTransfer.setData("application/pipeline-node-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData("application/pipeline-node-kind") as PipelineNodeKind;
    if (!kind || !rfInstance.current || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const pos = rfInstance.current.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    });
    onAddNode(kind, { x: pos.x, y: pos.y });
  };

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
    (_event, node) => { onSelectNode(node.id); setConfigOpen(true); },
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => { onSelectNode(null); setConfigOpen(false); }, [onSelectNode]);

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
      {/* ── Header / Toolbar ── */}
      <div className="pipeline-toolbar">
        {/* Left: Breadcrumb */}
        <div className="pipeline-breadcrumb">
          <a onClick={onCloseEditor}>流水线管理</a>
          <span>/</span>
          <span style={{ color: "#333", fontWeight: 500 }}>{editingPipeline.name}</span>
          {dirty && <span className="pipeline-unsaved-dot" title="有未保存的修改" />}
        </div>
      
        <span style={{ flex: 1 }} />
      
        {/* Center: Status indicator */}
        <div className="pipeline-status-indicator">
          <span className={`pipeline-status-dot ${running ? "running" : "idle"}`} />
          <span style={{ color: running ? "#7c3aed" : "#888" }}>
            {running ? "执行中…" : "空闲"}
          </span>
        </div>
      
        <span style={{ flex: 1 }} />
      
        {/* Right: Actions */}
        <button
          onClick={onSavePipeline}
          disabled={!dirty}
          style={{
            padding: "6px 16px", borderRadius: 8, border: "none",
            background: dirty ? "#7c3aed" : "#e5e7eb",
            color: dirty ? "#fff" : "#aaa",
            fontSize: 13, fontWeight: 500,
            cursor: dirty ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          保存
        </button>
      </div>

      <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
        {/* ── Left: Node palette ── */}
        <div style={{
          width: paletteCollapsed ? 48 : 200, flexShrink: 0, padding: paletteCollapsed ? "0.75rem 0.25rem" : "0.75rem",
          borderRight: "1px solid var(--panel-border)", background: "var(--panel-bg)",
          transition: "width 0.2s ease", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: paletteCollapsed ? "center" : "space-between", marginBottom: "0.5rem" }}>
            {!paletteCollapsed && (
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
                节点库
              </div>
            )}
            <button
              onClick={() => setPaletteCollapsed(!paletteCollapsed)}
              style={{
                width: 24, height: 24, borderRadius: 4, border: "1px solid #e5e7eb",
                background: "#fff", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 10, color: "#888",
                padding: 0,
              }}
              title={paletteCollapsed ? "展开节点库" : "折叠节点库"}
            >
              {paletteCollapsed ? "▶" : "◀"}
            </button>
          </div>

          {!paletteCollapsed && (
            <>
              {/* ── Data Source ── */}
              <div className="palette-section">
                <div className="palette-section-title">数据源</div>
                <PaletteItem
                  kind="source" icon={<SourceIconSmall color="#52c41a" />} label="信息源" desc="文章输入"
                  color="#52c41a" onClick={() => handleAddNode("source")}
                  onDragStart={(e) => handleDragStart(e, "source")}
                />
              </div>

              {/* ── AI Processing ── */}
              <div className="palette-section">
                <div className="palette-section-title">AI 处理</div>
                <PaletteItem
                  kind="llm" icon={<LlmIconSmall color="#7c3aed" />} label="大模型" desc="LLM 加工"
                  color="#7c3aed" onClick={() => handleAddNode("llm")}
                  onDragStart={(e) => handleDragStart(e, "llm")}
                />
              </div>

              {/* ── Image Generation ── */}
              <div className="palette-section">
                <div className="palette-section-title">配图生成</div>
                <PaletteItem
                  kind="image" icon={<ImageIconSmall color="#f59e0b" />} label="配图生成" desc="Stability AI"
                  color="#f59e0b" onClick={() => handleAddNode("image")}
                  onDragStart={(e) => handleDragStart(e, "image")}
                />
                <PaletteItem
                  kind="image_cf" icon={<ImageCfIconSmall color="#f97316" />} label="CF 配图" desc="Cloudflare FLUX"
                  color="#f97316" onClick={() => handleAddNode("image_cf")}
                  onDragStart={(e) => handleDragStart(e, "image_cf")}
                />
                <PaletteItem
                  kind="image_tx" icon={<ImageTxIconSmall color="#0ea5e9" />} label="腾讯云配图" desc="混元文生图"
                  color="#0ea5e9" onClick={() => handleAddNode("image_tx")}
                  onDragStart={(e) => handleDragStart(e, "image_tx")}
                />
              </div>

              <div style={{ marginTop: "1rem", fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                拖拽节点到画布创建，或点击添加。右键画布可快速添加。
              </div>
            </>
          )}
        </div>

        {/* ── Center: Canvas ── */}
        <div ref={canvasRef} style={{ flex: 1, minWidth: 0, background: "var(--pipeline-bg)", position: "relative" }}
          onDragOver={handleDragOver} onDrop={handleDrop}>
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
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#f0f0f0" gap={24} lineWidth={1} />
            <Controls
              showInteractive={false}
              className="pipeline-controls"
            />
            <MiniMap
              className="pipeline-minimap"
              nodeColor={(n) => {
                const kind = (n.data as PipelineNode)?.kind;
                return NODE_COLORS[kind] ?? "#888";
              }}
              nodeStrokeWidth={3}
              zoomable
              pannable
              style={{ width: 140, height: 90 }}
            />
            {nodes.length === 0 && (
              <div className="pipeline-canvas-empty">
                <div className="pipeline-canvas-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="pipeline-canvas-empty-text">从左侧拖入节点开始编排</div>
                <div className="pipeline-canvas-empty-hint">或右键画布快速添加节点</div>
              </div>
            )}
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
                  <CtxItem icon="🖼️" label="添加配图生成"
                    onClick={() => handleAddNodeAt("image")} />
                  <CtxItem icon="⚡" label="添加 CF 配图"
                    onClick={() => handleAddNodeAt("image_cf")} />
                  <CtxItem icon="🎨" label="添加腾讯云配图"
                    onClick={() => handleAddNodeAt("image_tx")} />
                </>
              )}
            </ContextMenu>
          )}

          {/* ── Right: Config panel (overlay) ── */}
          {configOpen && selectedNode && (
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0,
              width: 340, zIndex: 10,
              borderLeft: "1px solid var(--panel-border)",
              background: "var(--config-bg)", overflowY: "auto",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
            }}>
            <div style={{ padding: "0.75rem" }}>
              {/* Close button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                <button
                  onClick={() => { setConfigOpen(false); onSelectNode(null); }}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: "1px solid #e5e7eb", background: "#fff",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 12, color: "#888", padding: 0,
                  }}
                  title="关闭配置面板"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </div>

              {/* Node summary card */}
              <div className="config-node-summary">
                <div className="config-node-summary-icon" style={{ background: `${NODE_COLORS[selectedNode.kind] ?? "#888"}15` }}>
                  {getNodeIcon(selectedNode.kind, NODE_COLORS[selectedNode.kind] ?? "#888")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{selectedNode.name}</div>
                  <span className="config-node-summary-type" style={{
                    background: `${NODE_COLORS[selectedNode.kind] ?? "#888"}15`,
                    color: NODE_COLORS[selectedNode.kind] ?? "#888",
                  }}>
                    {selectedNode.kind === "source" ? "数据源" : selectedNode.kind === "llm" ? "AI 处理" : "配图生成"}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveNode(selectedNode.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 16, padding: 4 }}
                  title="删除节点"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l8 8M11 3l-8 8" />
                  </svg>
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

              {selectedNode.kind === "image" && (
                <ImageConfigEditor
                  nodeId={selectedNode.id}
                  config={selectedNode.imageConfig ?? {
                    apiEndpoint: "",
                    apiKey: "",
                    promptTemplate: "",
                    negativePrompt: "",
                    outputFormat: "png",
                    width: 1024,
                    height: 1024,
                  }}
                  onUpdate={onUpdateImageConfig}
                />
              )}

              {selectedNode.kind === "image_cf" && (
                <ImageCfConfigEditor
                  nodeId={selectedNode.id}
                  config={selectedNode.imageCfConfig ?? {
                    apiEndpoint: "",
                    apiToken: "",
                    promptTemplate: "",
                    steps: 25,
                    width: 1024,
                    height: 1024,
                  }}
                  onUpdate={onUpdateImageCfConfig}
                />
              )}

              {selectedNode.kind === "image_tx" && (
                <ImageTxConfigEditor
                  nodeId={selectedNode.id}
                  config={selectedNode.imageTxConfig ?? {
                    secretId: "",
                    secretKey: "",
                    promptTemplate: "",
                    negativePrompt: "",
                    style: "",
                    resolution: "768:768",
                  }}
                  onUpdate={onUpdateImageTxConfig}
                />
              )}
            </div>

            {/* ── Execution results ── */}
          {results.length > 0 && (
            <div style={{ padding: "0.75rem", borderTop: "1px solid #e5e7eb" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: 13, fontWeight: 600 }}>加工结果</h4>
              {results.map((r, i) => (
                <details key={i} style={{ marginBottom: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: 13 }}>
                    <b>{r.originalTitle}</b>
                  </summary>
                  {r.generatedImage && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <img
                        src={`data:${r.generatedImageMime ?? "image/png"};base64,${r.generatedImage}`}
                        alt={r.generatedImageName ?? "Generated"}
                        style={{
                          maxWidth: "100%", borderRadius: 8,
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                        {r.generatedImageName}
                      </div>
                    </div>
                  )}
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
  x, y, anchor, children,
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

// ── Small palette icons ──

function SourceIconSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function LlmIconSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </svg>
  );
}

function ImageIconSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function ImageCfIconSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}

function ImageTxIconSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9z" />
      <path d="M9.5 9h5M9.5 12h5M9.5 15h3" />
    </svg>
  );
}

function PaletteItem({
  icon, label, desc, color, onClick, onDragStart,
}: {
  kind: string;
  icon: React.ReactNode; label: string; desc: string; color: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className="palette-item"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{}}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 1px 4px ${color}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--panel-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="palette-item-icon" style={{ background: `${color}15` }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#999" }}>{desc}</div>
      </div>
    </div>
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
        maxTokens: 128,
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
      {/* API Configuration */}
      <div className="config-section">
        <div className="config-section-title">API 配置</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
        </div>
      </div>

      {/* Test connection */}
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
          {testState === "testing" ? <><span className="test-btn-spinner" />测试中…</> : testState === "success" ? "✅ 已连通" : testState === "error" ? "❌ 失败" : "🔌 测试连通"}
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

      {/* Prompts */}
      <div className="config-section">
        <div className="config-section-title">提示词</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
      </div>
    </div>
  );
}

function ImageConfigEditor({
  nodeId, config, onUpdate,
}: {
  nodeId: string;
  config: ImageNodeConfig;
  onUpdate: (nodeId: string, config: Partial<ImageNodeConfig>) => void;
}) {
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const handleTest = async () => {
    if (!config.apiKey) {
      setTestState("error");
      setTestMsg("请先填写 API Key。");
      return;
    }
    if (!config.promptTemplate.trim()) {
      setTestState("error");
      setTestMsg("请先填写提示词模板。");
      return;
    }
    setTestState("testing");
    setTestMsg("");
    try {
      const resp = await generateImage({
        apiKey: config.apiKey,
        apiEndpoint: config.apiEndpoint || undefined,
        prompt: "A cute orange tabby cat sitting on a windowsill, warm sunlight",
        outputFormat: config.outputFormat || "png",
        width: config.width || 1024,
        height: config.height || 1024,
      });
      setTestState("success");
      setTestMsg(`连通成功 · ${resp.fileName} · ${(resp.imageBase64.length * 0.75 / 1024).toFixed(0)} KB`);
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
      {/* API Configuration */}
      <div className="config-section">
        <div className="config-section-title">API 配置</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            <span style={labelStyle}>API 端点（可选）</span>
            <input style={inputStyle} value={config.apiEndpoint}
              onChange={(e) => onUpdate(nodeId, { apiEndpoint: e.target.value })}
              placeholder="默认: https://api.stability.ai/v2beta/stable-image/generate/core" />
          </label>
          <label>
            <span style={labelStyle}>API Key</span>
            <input style={inputStyle} type="password" value={config.apiKey}
              onChange={(e) => onUpdate(nodeId, { apiKey: e.target.value })}
              placeholder="Stability AI API Key" />
          </label>
        </div>
      </div>

      {/* Test connection */}
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
          {testState === "testing" ? <><span className="test-btn-spinner" />生成中…</> : testState === "success" ? "✅ 已连通" : testState === "error" ? "❌ 失败" : "🔌 测试连通"}
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

      {/* Generation Parameters */}
      <div className="config-section">
        <div className="config-section-title">生成参数</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>输出格式</span>
            <select style={{ ...inputStyle, cursor: "pointer" }}
              value={config.outputFormat}
              onChange={(e) => onUpdate(nodeId, { outputFormat: e.target.value })}>
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label style={{ width: 90 }}>
            <span style={labelStyle}>宽度</span>
            <input style={inputStyle} type="number" min={512} max={1536} step={64}
              value={config.width}
              onChange={(e) => onUpdate(nodeId, { width: parseInt(e.target.value) || 1024 })} />
          </label>
          <label style={{ width: 90 }}>
            <span style={labelStyle}>高度</span>
            <input style={inputStyle} type="number" min={512} max={1536} step={64}
              value={config.height}
              onChange={(e) => onUpdate(nodeId, { height: parseInt(e.target.value) || 1024 })} />
          </label>
        </div>
      </div>

      {/* Prompts */}
      <div className="config-section">
        <div className="config-section-title">提示词</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            <span style={labelStyle}>提示词模板</span>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
              value={config.promptTemplate}
              onChange={(e) => onUpdate(nodeId, { promptTemplate: e.target.value })}
              placeholder="描述要生成的图片内容…" />
            <span style={{ fontSize: 11, color: "#aaa", marginTop: 2, display: "block" }}>
              变量：{`{{title}}`} {`{{summary}}`} {`{{source}}`} {`{{link}}`}
            </span>
          </label>
          <label>
            <span style={labelStyle}>反向提示词（可选）</span>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
              value={config.negativePrompt}
              onChange={(e) => onUpdate(nodeId, { negativePrompt: e.target.value })}
              placeholder="不希望出现的内容…" />
          </label>
        </div>
      </div>
    </div>
  );
}

function ImageTxConfigEditor({
  nodeId, config, onUpdate,
}: {
  nodeId: string;
  config: ImageTxNodeConfig;
  onUpdate: (nodeId: string, config: Partial<ImageTxNodeConfig>) => void;
}) {
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const handleTest = async () => {
    if (!config.secretId || !config.secretKey) {
      setTestState("error");
      setTestMsg("请先填写 SecretId 和 SecretKey。");
      return;
    }
    if (!config.promptTemplate.trim()) {
      setTestState("error");
      setTestMsg("请先填写提示词模板。");
      return;
    }
    setTestState("testing");
    setTestMsg("");
    try {
      const resp = await generateImageTx({
        secretId: config.secretId,
        secretKey: config.secretKey,
        prompt: "一只可爱的橘色猫咪坐在窗台上，温暖的阳光",
        negativePrompt: config.negativePrompt || undefined,
        style: config.style || undefined,
        resolution: config.resolution || "768:768",
        logoAdd: 0,
      });
      setTestState("success");
      setTestMsg(`连通成功 · ${resp.fileName} · ${(resp.imageBase64.length * 0.75 / 1024).toFixed(0)} KB`);
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
      <div style={{ padding: "0.5rem 0.6rem", background: "#f0f9ff", borderRadius: 6, border: "1px solid #bae6fd", fontSize: 11, color: "#0369a1", lineHeight: 1.5 }}>
        使用腾讯云混元大模型文生图轻量版接口。需要腾讯云 API 密钥（SecretId + SecretKey）。
      </div>

      {/* API Configuration */}
      <div className="config-section">
        <div className="config-section-title">API 配置</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            <span style={labelStyle}>SecretId</span>
            <input style={inputStyle} value={config.secretId}
              onChange={(e) => onUpdate(nodeId, { secretId: e.target.value })}
              placeholder="腾讯云 API SecretId" />
          </label>
          <label>
            <span style={labelStyle}>SecretKey</span>
            <input style={inputStyle} type="password" value={config.secretKey}
              onChange={(e) => onUpdate(nodeId, { secretKey: e.target.value })}
              placeholder="腾讯云 API SecretKey" />
          </label>
        </div>
      </div>

      {/* Test connection */}
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
          {testState === "testing" ? <><span className="test-btn-spinner" />生成中…</> : testState === "success" ? "✅ 已连通" : testState === "error" ? "❌ 失败" : "🔌 测试连通"}
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

      {/* Generation Parameters */}
      <div className="config-section">
        <div className="config-section-title">生成参数</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>分辨率</span>
            <select style={{ ...inputStyle, cursor: "pointer" }}
              value={config.resolution}
              onChange={(e) => onUpdate(nodeId, { resolution: e.target.value })}>
              <option value="768:768">768×768 (1:1)</option>
              <option value="768:1024">768×1024 (3:4)</option>
              <option value="1024:768">1024×768 (4:3)</option>
              <option value="1024:1024">1024×1024 (1:1)</option>
              <option value="720:1280">720×1280 (9:16)</option>
              <option value="1280:720">1280×720 (16:9)</option>
              <option value="768:1280">768×1280 (3:5)</option>
              <option value="1280:768">1280×768 (5:3)</option>
              <option value="1080:1920">1080×1920 (9:16)</option>
              <option value="1920:1080">1920×1080 (16:9)</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>风格（可选）</span>
            <input style={inputStyle} value={config.style}
              onChange={(e) => onUpdate(nodeId, { style: e.target.value })}
              placeholder="例如: 201 (日系动漫)" />
          </label>
        </div>
      </div>

      {/* Prompts */}
      <div className="config-section">
        <div className="config-section-title">提示词</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            <span style={labelStyle}>提示词模板</span>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
              value={config.promptTemplate}
              onChange={(e) => onUpdate(nodeId, { promptTemplate: e.target.value })}
              placeholder="描述要生成的图片内容…" />
            <span style={{ fontSize: 11, color: "#aaa", marginTop: 2, display: "block" }}>
              变量：{`{{title}}`} {`{{summary}}`} {`{{source}}`} {`{{link}}`}
            </span>
          </label>
          <label>
            <span style={labelStyle}>反向提示词（可选）</span>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
              value={config.negativePrompt}
              onChange={(e) => onUpdate(nodeId, { negativePrompt: e.target.value })}
              placeholder="不希望出现的内容…" />
          </label>
        </div>
      </div>
    </div>
  );
}

function ImageCfConfigEditor({
  nodeId, config, onUpdate,
}: {
  nodeId: string;
  config: ImageCfNodeConfig;
  onUpdate: (nodeId: string, config: Partial<ImageCfNodeConfig>) => void;
}) {
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const handleTest = async () => {
    if (!config.apiToken) {
      setTestState("error");
      setTestMsg("请先填写 Cloudflare API Token。");
      return;
    }
    if (!config.apiEndpoint.trim()) {
      setTestState("error");
      setTestMsg("请先填写 API 端点 URL。");
      return;
    }
    if (!config.promptTemplate.trim()) {
      setTestState("error");
      setTestMsg("请先填写提示词模板。");
      return;
    }
    setTestState("testing");
    setTestMsg("");
    try {
      const resp = await generateImageCf({
        apiToken: config.apiToken,
        apiEndpoint: config.apiEndpoint,
        prompt: "A cute orange tabby cat sitting on a windowsill, warm sunlight",
        steps: config.steps || 25,
        width: config.width || 1024,
        height: config.height || 1024,
      });
      setTestState("success");
      setTestMsg(`连通成功 · ${resp.fileName} · ${(resp.imageBase64.length * 0.75 / 1024).toFixed(0)} KB`);
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
      {/* API Configuration */}
      <div className="config-section">
        <div className="config-section-title">API 配置</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label>
            <span style={labelStyle}>API 端点</span>
            <input style={inputStyle} value={config.apiEndpoint}
              onChange={(e) => onUpdate(nodeId, { apiEndpoint: e.target.value })}
              placeholder="https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/@cf/black-forest-labs/flux-2-dev" />
          </label>
          <label>
            <span style={labelStyle}>API Token</span>
            <input style={inputStyle} type="password" value={config.apiToken}
              onChange={(e) => onUpdate(nodeId, { apiToken: e.target.value })}
              placeholder="Cloudflare API Token" />
          </label>
        </div>
      </div>

      {/* Test connection */}
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
          {testState === "testing" ? <><span className="test-btn-spinner" />生成中…</> : testState === "success" ? "✅ 已连通" : testState === "error" ? "❌ 失败" : "🔌 测试连通"}
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

      {/* Generation Parameters */}
      <div className="config-section">
        <div className="config-section-title">生成参数</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <label style={{ width: 80 }}>
            <span style={labelStyle}>步数</span>
            <input style={inputStyle} type="number" min={1} max={50} step={1}
              value={config.steps}
              onChange={(e) => onUpdate(nodeId, { steps: parseInt(e.target.value) || 25 })} />
          </label>
          <label style={{ width: 90 }}>
            <span style={labelStyle}>宽度</span>
            <input style={inputStyle} type="number" min={512} max={1536} step={64}
              value={config.width}
              onChange={(e) => onUpdate(nodeId, { width: parseInt(e.target.value) || 1024 })} />
          </label>
          <label style={{ width: 90 }}>
            <span style={labelStyle}>高度</span>
            <input style={inputStyle} type="number" min={512} max={1536} step={64}
              value={config.height}
              onChange={(e) => onUpdate(nodeId, { height: parseInt(e.target.value) || 1024 })} />
          </label>
        </div>
      </div>

      {/* Prompts */}
      <div className="config-section">
        <div className="config-section-title">提示词</div>
        <label>
          <span style={labelStyle}>提示词模板</span>
          <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
            value={config.promptTemplate}
            onChange={(e) => onUpdate(nodeId, { promptTemplate: e.target.value })}
            placeholder="描述要生成的图片内容…" />
          <span style={{ fontSize: 11, color: "#aaa", marginTop: 2, display: "block" }}>
            变量：{`{{title}}`} {`{{summary}}`} {`{{source}}`} {`{{link}}`}
          </span>
        </label>
      </div>
    </div>
  );
}
