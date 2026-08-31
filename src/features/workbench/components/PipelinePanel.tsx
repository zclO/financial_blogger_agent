import {
  Background,
  Controls,
  type Connection,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";

import type {
  LlmNodeConfig,
  PipelineNode,
  PipelineNodeKind,
  ProcessedArticle,
  FlowEdge,
  Topic,
} from "../types";
import { PipelineNodeComponent } from "./PipelineNode";

const nodeTypes = { pipelineNode: PipelineNodeComponent };

// ── Default edge options for smooth curves ──
const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: { stroke: "#b1b1b1", strokeWidth: 1.5 },
};

// ── Props ──

export function PipelinePanel({
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
  running,
  results,
  runLog,
  currentArticle,
  newsSources,
}: {
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
  running: boolean;
  results: ProcessedArticle[];
  runLog: string[];
  currentArticle: Topic | null;
  newsSources: { id: string; name: string }[];
}) {
  type AppNode = Node<PipelineNode>;

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
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>工作流编排</h2>
        <span style={{ flex: 1 }} />
        {running && (
          <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 500 }}>
            ⏳ 执行中…
          </span>
        )}
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
            点击添加节点到画布。拖动端口创建连线。
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div style={{ flex: 1, minWidth: 0, background: "#f8f9fb" }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onRfNodesChange}
            onEdgesChange={onRfEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onNodeDragStop={handleNodeDragStop}
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

// ── Sub-components ──

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
