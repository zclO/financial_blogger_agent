import { useMemo, useState } from "react";

import type { Topic } from "../types";

export function TopicsPanel({
  topics,
  verify,
  verifyMany,
  openComposer,
  onRunWorkflow,
  onViewLogs,
}: {
  topics: Topic[];
  verify: (id: number) => void;
  verifyMany: (ids: number[]) => void;
  openComposer: (topic?: Topic) => void;
  onRunWorkflow: (topic: Topic) => void;
  onViewLogs: (topic: Topic) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const query = keyword.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      query
        ? topics.filter(
            (t) => t.title.toLowerCase().includes(query) || t.source.toLowerCase().includes(query),
          )
        : topics,
    [topics, query],
  );

  const unverifiedFiltered = useMemo(
    () => filtered.filter((t) => !t.verified),
    [filtered],
  );

  const handleVerifyAll = () => {
    if (unverifiedFiltered.length > 0) {
      verifyMany(unverifiedFiltered.map((t) => t.id));
    }
  };

  return (
    <section className="panel">
      <h2>选题池</h2>

      <div className="row" style={{ gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input
          type="text"
          placeholder="搜索关键词（标题或来源）…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        {query && unverifiedFiltered.length > 0 && (
          <button onClick={handleVerifyAll}>
            一键核验（{unverifiedFiltered.length}）
          </button>
        )}
      </div>

      {query && filtered.length === 0 && (
        <small style={{ color: "#888" }}>没有匹配"{keyword}"的选题。</small>
      )}

      <div style={{ marginTop: "0.5rem" }}>
        {filtered.map((x) => (
          <div className="topic-row" key={x.id}>
            <div className="topic-row-info">
              <b>{x.title}</b>
              <small>
                <span className={`topic-verified-badge ${x.verified ? "verified" : "unverified"}`}>
                  {x.verified ? "✓ 已核验" : "待核验"}
                </span>
                {x.source}
                {x.processedContent && (
                  <span style={{ color: "#059669", marginLeft: "0.5rem" }} title="已通过流水线加工">
                    ✨ 已加工
                  </span>
                )}
              </small>
            </div>
            <div className="topic-row-actions">
              {x.verified ? (
                <>
                  <button className="btn-edit" onClick={() => openComposer(x)}>编辑草稿</button>
                  <button className="btn-workflow" onClick={() => onRunWorkflow(x)} title="用工作流加工此文章">
                    ▶ 工作流
                  </button>
                  <button className="btn-logs" onClick={() => onViewLogs(x)} title="查看运行日志">
                    📜
                  </button>
                </>
              ) : (
                <button className="btn-verify" onClick={() => verify(x.id)}>标为已核验</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
