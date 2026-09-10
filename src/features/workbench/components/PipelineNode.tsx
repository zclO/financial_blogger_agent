import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

import type { PipelineNode } from "../types";

type AppNode = Node<PipelineNode>;

const NODE_COLORS: Record<string, string> = {
  source: "#52c41a",
  llm: "#7c3aed",
  image: "#f59e0b",
};

const NODE_ICONS: Record<string, string> = {
  source: "📰",
  llm: "🤖",
  image: "🖼️",
};

export function PipelineNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const { deleteElements } = useReactFlow();
  const color = NODE_COLORS[data.kind] ?? "#888";
  const icon = NODE_ICONS[data.kind] ?? "📦";
  const subtitle =
    data.kind === "source"
      ? "文章输入"
      : data.kind === "llm"
        ? (data.llmConfig?.model ?? "未配置模型")
        : data.kind === "image"
          ? `${data.imageConfig?.width ?? 1024}×${data.imageConfig?.height ?? 1024}`
          : "未配置";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      style={{
        minWidth: 200,
        maxWidth: 260,
        borderRadius: 10,
        border: selected ? `2px solid ${color}` : "1px solid #e5e7eb",
        background: "#fff",
        boxShadow: selected
          ? `0 0 0 3px ${color}22, 0 2px 8px rgba(0,0,0,0.08)`
          : "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "box-shadow 0.2s, border-color 0.2s",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: 3, background: color }} />

      {/* Input handle */}
      {data.kind !== "source" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: color,
            width: 8,
            height: 8,
            border: "2px solid #fff",
            left: -4,
          }}
        />
      )}

      {/* Header */}
      <div style={{ padding: "10px 14px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>
              {data.name}
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
              {subtitle}
            </div>
          </div>
          {selected && (
            <button
              onClick={handleDelete}
              title="删除节点"
              style={{
                width: 22, height: 22, borderRadius: 4,
                border: "1px solid #fca5a5", background: "#fef2f2",
                color: "#ef4444", fontSize: 14, lineHeight: 1,
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: 0, transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: color,
          width: 8,
          height: 8,
          border: "2px solid #fff",
          right: -4,
        }}
      />
    </div>
  );
}
