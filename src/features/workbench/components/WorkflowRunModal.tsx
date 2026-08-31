import { useState } from "react";
import type { ProcessedArticle, SavedPipeline, Topic } from "../types";

// ── Workflow Run Modal (real-time execution) ──

export function WorkflowRunModal({
  topic,
  running,
  runLog,
  results,
  savedPipelines,
  defaultPipelineId,
  onRun,
  onClose,
}: {
  topic: Topic | null;
  running: boolean;
  runLog: string[];
  results: ProcessedArticle[];
  savedPipelines: SavedPipeline[];
  defaultPipelineId: string | null;
  onRun: (pipelineId: string) => void;
  onClose: () => void;
}) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    defaultPipelineId ?? savedPipelines[0]?.id ?? ""
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!topic) return null;

  const hasError = runLog.some((l) => l.includes("❌"));
  const isComplete = !running && results.length > 0 && !hasError;
  const isFailed = !running && hasError;
  const hasStarted = runLog.length > 0 || running;
  const canRun = selectedPipelineId && savedPipelines.length > 0;

  const selectedPipeline = savedPipelines.find((p) => p.id === selectedPipelineId);

  return (
    <div style={overlayStyle} onClick={running ? undefined : onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={headerIconStyle}>
              {running ? "⏳" : isComplete ? "✅" : isFailed ? "❌" : "▶"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111" }}>
                {running ? "工作流执行中" : isComplete ? "执行完成" : isFailed ? "执行失败" : "运行工作流"}
              </h3>
              {!hasStarted && (
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>选择流水线并执行加工</div>
              )}
            </div>
          </div>
          {!running && (
            <button onClick={onClose} style={closeBtnStyle} title="关闭">
              ×
            </button>
          )}
        </div>

        {/* ── Article info ── */}
        <div style={articleInfoStyle}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              📰
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.4 }}>
                {topic.title}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 3, display: "flex", gap: 8 }}>
                <span>{topic.source}</span>
                {topic.link && (
                  <a href={topic.link} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#7c3aed", textDecoration: "none" }}>
                    原文 ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pipeline selector (only before execution starts) ── */}
        {!hasStarted && (
          <div style={selectorStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                流水线
              </div>
              {savedPipelines.length > 0 && (
                <div style={{ fontSize: 11, color: "#aaa" }}>
                  已选 {selectedPipeline?.name ?? "—"}
                </div>
              )}
            </div>
            {savedPipelines.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "1.5rem 1rem",
                background: "#fafbfc", borderRadius: 10, border: "1px dashed #e5e7eb",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>📋</div>
                <div style={{ fontSize: 13, color: "#888", fontWeight: 500 }}>暂无已保存的流水线</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>请先在「流水线」页面创建</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {savedPipelines.map((pl) => {
                  const isDefault = pl.id === defaultPipelineId;
                  const isSelected = pl.id === selectedPipelineId;
                  const isHovered = hoveredId === pl.id;
                  const llmNodes = pl.nodes.filter((n) => n.kind === "llm");
                  return (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPipelineId(pl.id)}
                      onMouseEnter={() => setHoveredId(pl.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${isSelected ? "#7c3aed" : isHovered ? "#c4b5fd" : "#eef0f3"}`,
                        background: isSelected
                          ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)"
                          : isHovered ? "#fafaff" : "#fff",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: isSelected ? "0 2px 8px rgba(124, 58, 237, 0.1)" : "none",
                        position: "relative",
                      }}
                    >
                      {/* Radio indicator */}
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${isSelected ? "#7c3aed" : "#d1d5db"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: "#7c3aed",
                          }} />
                        )}
                      </div>

                      {/* Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: isSelected ? "#7c3aed" : "#f3f4f6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 15, flexShrink: 0,
                        transition: "background 0.15s",
                      }}>
                        {isDefault ? "⭐" : "📋"}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>
                            {pl.name}
                          </span>
                          {isDefault && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                              color: "#7c3aed", background: "#f3e8ff",
                              padding: "2px 6px", borderRadius: 4, textTransform: "uppercase",
                            }}>
                              默认
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            {pl.nodes.length} 节点
                          </span>
                          <span style={{ fontSize: 11, color: "#d1d5db" }}>·</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>
                            {pl.edges.length} 连线
                          </span>
                          {llmNodes.length > 0 && (
                            <>
                              <span style={{ fontSize: 11, color: "#d1d5db" }}>·</span>
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>
                                🤖 {llmNodes.length}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      {isSelected && (
                        <div style={{ color: "#7c3aed", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Execution log ── */}
        <div style={logContainerStyle}>
          {runLog.length === 0 && running && (
            <div style={{ color: "#888", fontSize: 13, textAlign: "center", padding: "1.5rem 1rem" }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>⏳</div>
              正在初始化工作流...
            </div>
          )}
          {runLog.length === 0 && !running && !hasStarted && (
            <div style={{ color: "#bbb", fontSize: 12, textAlign: "center", padding: "1rem" }}>
              执行日志将在此处显示
            </div>
          )}
          {runLog.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                color: line.includes("❌") || line.includes("失败") ? "#dc2626" :
                       line.includes("✅") || line.includes("完成") ? "#16a34a" :
                       line.includes("⚡") || line.includes("⏳") ? "#7c3aed" :
                       "#374151",
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {line}
            </div>
          ))}
          {running && (
            <div style={{ color: "#7c3aed", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={spinnerStyle}>●</span> 处理中...
            </div>
          )}
        </div>

        {/* ── Result preview ── */}
        {isComplete && results.length > 0 && results[0].processedContent && (
          <div style={resultStyle}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#16a34a", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#dcfce7", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11,
                }}>📄</span>
                查看加工结果
              </summary>
              <pre style={resultPreStyle}>
                {results[0].processedContent}
              </pre>
            </details>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={footerStyle}>
          {!hasStarted ? (
            <>
              <button onClick={onClose} style={cancelBtnStyle}>
                取消
              </button>
              <button
                onClick={() => canRun && onRun(selectedPipelineId)}
                disabled={!canRun}
                style={runBtnStyle}
              >
                ▶ 运行
              </button>
            </>
          ) : running ? (
            <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 500 }}>请等待执行完成...</span>
          ) : (
            <>
              <span style={{ fontSize: 12, color: "#888" }}>
                {isComplete ? `生成 ${results[0]?.processedContent?.length ?? 0} 字` : "执行出错，请检查日志"}
              </span>
              <button onClick={onClose} style={doneBtnStyle}>
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Article Log History Modal ──

export function ArticleLogHistoryModal({
  entries,
  onClose,
  onViewEntry,
}: {
  entries: {
    id: string;
    topicId: number;
    topicTitle: string;
    timestamp: string;
    status: string;
    logs: string[];
  }[];
  onClose: () => void;
  onViewEntry: (entry: {
    id: string;
    topicId: number;
    topicTitle: string;
    timestamp: string;
    status: string;
    logs: string[];
  }) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={headerIconStyle}>📜</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111" }}>文章运行日志</h3>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>共 {entries.length} 条记录</div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="关闭">
            ×
          </button>
        </div>

        {/* Entries list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
          {entries.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "2.5rem 1rem",
              background: "#fafbfc", borderRadius: 12, border: "1px dashed #e5e7eb",
              margin: "8px 0",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.5 }}>📭</div>
              <p style={{ fontSize: 13, color: "#888", fontWeight: 500, margin: 0 }}>暂无运行日志</p>
              <p style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>执行工作流后日志将自动保存</p>
            </div>
          ) : (
            entries.map((entry) => {
              const isHovered = hoveredId === entry.id;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    margin: "0 0 4px",
                    borderRadius: 10,
                    border: `1px solid ${isHovered ? "#c4b5fd" : "#eef0f3"}`,
                    background: isHovered ? "#fafaff" : "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onClick={() => onViewEntry(entry)}
                  onMouseEnter={(e) => { setHoveredId(entry.id); e.currentTarget.style.borderColor = "#c4b5fd"; }}
                  onMouseLeave={(e) => { setHoveredId(null); e.currentTarget.style.borderColor = "#eef0f3"; }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: entry.status === "completed" ? "#f0fdf4" : entry.status === "failed" ? "#fef2f2" : "#fefce8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                  }}>
                    {entry.status === "completed" ? "✅" : entry.status === "failed" ? "❌" : "⏳"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13, color: "#111",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {entry.topicTitle}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 3, display: "flex", gap: 8 }}>
                      <span>{new Date(entry.timestamp).toLocaleString("zh-CN", { hour12: false })}</span>
                      <span style={{ color: "#d1d5db" }}>·</span>
                      <span>{entry.logs.length} 条日志</span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, color: "#7c3aed", fontWeight: 600, flexShrink: 0,
                    padding: "3px 8px", borderRadius: 6,
                    background: isHovered ? "#f5f3ff" : "transparent",
                    transition: "background 0.15s",
                  }}>
                    查看 →
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single Log Entry Detail Modal ──

export function ArticleLogDetailModal({
  entry,
  onClose,
  onBack,
}: {
  entry: {
    id: string;
    topicId: number;
    topicTitle: string;
    timestamp: string;
    status: string;
    logs: string[];
  };
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} style={backBtnStyle}>←</button>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: entry.status === "completed" ? "#f0fdf4" : entry.status === "failed" ? "#fef2f2" : "#fefce8",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15,
            }}>
              {entry.status === "completed" ? "✅" : entry.status === "failed" ? "❌" : "⏳"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111" }}>运行详情</h3>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                {new Date(entry.timestamp).toLocaleString("zh-CN", { hour12: false })}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="关闭">
            ×
          </button>
        </div>

        {/* Article info */}
        <div style={articleInfoStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>
              📰
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.4 }}>
              {entry.topicTitle}
            </div>
          </div>
        </div>

        {/* Log content */}
        <div style={logContainerStyle}>
          {entry.logs.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                color: line.includes("❌") || line.includes("失败") ? "#dc2626" :
                       line.includes("✅") || line.includes("完成") ? "#16a34a" :
                       "#374151",
                fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <span style={{ fontSize: 12, color: "#aaa" }}>
            共 {entry.logs.length} 条日志
          </span>
          <button onClick={onClose} style={doneBtnStyle}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "2rem",
};

const modalStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  width: "100%",
  maxWidth: 520,
  maxHeight: "75vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.06)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid #f0f0f3",
  background: "#fff",
};

const headerIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "linear-gradient(135deg, #ede9fe, #ddd6fe)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 17,
  flexShrink: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 22,
  cursor: "pointer",
  color: "#bbb",
  padding: "4px 8px",
  lineHeight: 1,
  borderRadius: 6,
  transition: "color 0.15s",
};

const backBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 13,
  color: "#555",
};

const articleInfoStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderBottom: "1px solid #f0f0f3",
  background: "linear-gradient(180deg, #fafbfc 0%, #fff 100%)",
};

const logContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "10px 18px",
  background: "#f9fafb",
  minHeight: 120,
  maxHeight: 280,
  borderTop: "1px solid #f0f0f3",
};

const resultStyle: React.CSSProperties = {
  padding: "8px 18px",
  borderTop: "1px solid #bbf7d0",
  background: "linear-gradient(180deg, #f0fdf4 0%, #fff 100%)",
};

const resultPreStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontSize: 12,
  background: "#fff",
  padding: "8px 10px",
  borderRadius: 8,
  marginTop: "6px",
  maxHeight: 200,
  overflow: "auto",
  lineHeight: 1.7,
  border: "1px solid #e5e7eb",
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  padding: "12px 18px",
  borderTop: "1px solid #f0f0f3",
  background: "#fff",
};

const doneBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
  transition: "all 0.15s",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#666",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
};

const runBtnStyle: React.CSSProperties = {
  padding: "8px 24px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
  letterSpacing: "0.02em",
  transition: "all 0.15s",
};

const selectorStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid #f0f0f3",
  background: "#fff",
};

const spinnerStyle: React.CSSProperties = {
  display: "inline-block",
  animation: "pulse 1s ease-in-out infinite",
};
