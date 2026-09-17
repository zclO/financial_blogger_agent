import { Handle, Position, useReactFlow, type NodeProps, type Node } from "@xyflow/react";

import type { PipelineNode } from "../types";

type AppNode = Node<PipelineNode>;

// ── Color palette ──

export const NODE_COLORS: Record<string, string> = {
  source: "#52c41a",
  llm: "#7c3aed",
  image: "#f59e0b",
  image_cf: "#f97316",
  image_tx: "#0ea5e9",
};

// ── SVG Icons ──

function SourceIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function LlmIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </svg>
  );
}

function ImageIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function ImageCfIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}

function ImageTxIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9 9 9 0 0 1 9-9z" />
      <path d="M9.5 9h5M9.5 12h5M9.5 15h3" />
      <path d="M16 3.5A9 9 0 0 1 20.5 8" />
    </svg>
  );
}

export function getNodeIcon(kind: string, color: string) {
  switch (kind) {
    case "source": return <SourceIcon color={color} />;
    case "llm": return <LlmIcon color={color} />;
    case "image": return <ImageIcon color={color} />;
    case "image_cf": return <ImageCfIcon color={color} />;
    case "image_tx": return <ImageTxIcon color={color} />;
    default: return <ImageIcon color={color} />;
  }
}

// ── Subtitle helper ──

function getSubtitle(data: PipelineNode): string {
  switch (data.kind) {
    case "source": return "文章输入";
    case "llm": return data.llmConfig?.model || "未配置模型";
    case "image": return `${data.imageConfig?.width ?? 1024}×${data.imageConfig?.height ?? 1024}`;
    case "image_cf": return `CF ${data.imageCfConfig?.width ?? 1024}×${data.imageCfConfig?.height ?? 1024}`;
    case "image_tx": return `混元 ${data.imageTxConfig?.resolution ?? "768:768"}`;
    default: return "未配置";
  }
}

// ── Node Component ──

export function PipelineNodeComponent({ id, data, selected }: NodeProps<AppNode>) {
  const { deleteElements } = useReactFlow();
  const color = NODE_COLORS[data.kind] ?? "#888";
  const subtitle = getSubtitle(data);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div
      className={`pipeline-node${selected ? " selected" : ""}`}
      style={{ "--node-color": color } as React.CSSProperties}
    >
      {/* Input handle */}
      {data.kind !== "source" && (
        <Handle
          type="target"
          position={Position.Left}
          className="pipeline-handle"
          style={{ background: color, left: -5 }}
        />
      )}

      {/* Main content area */}
      <div style={{ display: "flex" }}>
        {/* Color bar */}
        <div className="pipeline-node-bar" style={{ background: color }} />

        {/* Body */}
        <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Icon */}
            <div
              className="pipeline-node-icon"
              style={{ background: `${color}15` }}
            >
              {getNodeIcon(data.kind, color)}
            </div>

            {/* Name + subtitle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600, fontSize: 13, color: "#111",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {data.name}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>
                {subtitle}
              </div>
            </div>

            {/* Delete button (visible on hover via CSS) */}
            {selected && (
              <button
                onClick={handleDelete}
                className="pipeline-node-delete"
                title="删除节点"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="pipeline-node-status">
        {data.kind === "llm" && (
          <span>{data.llmConfig?.model ? `模型: ${data.llmConfig.model}` : "点击配置模型"}</span>
        )}
        {data.kind === "image" && (
          <span>{data.imageConfig?.outputFormat?.toUpperCase() ?? "PNG"} · {data.imageConfig?.width ?? 1024}×{data.imageConfig?.height ?? 1024}</span>
        )}
        {data.kind === "image_cf" && (
          <span>Cloudflare FLUX · {data.imageCfConfig?.steps ?? 25} steps</span>
        )}
        {data.kind === "image_tx" && (
          <span>腾讯云混元 · {data.imageTxConfig?.resolution ?? "768:768"}</span>
        )}
        {data.kind === "source" && (
          <span>选题池数据源</span>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="pipeline-handle"
        style={{ background: color, right: -5 }}
      />
    </div>
  );
}
