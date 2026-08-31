import { useMemo, useState } from "react";

import type { Topic } from "../types";

export function TopicsPanel({
  topics,
  verify,
  verifyMany,
  openComposer,
}: {
  topics: Topic[];
  verify: (id: number) => void;
  verifyMany: (ids: number[]) => void;
  openComposer: () => void;
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

      {filtered.map((x) => (
        <div className="row" key={x.id}>
          <div>
            <b>{x.title}</b>
            <small>
              {x.source} · {x.verified ? "已核验" : "待核验"}
            </small>
          </div>
          {x.verified ? (
            <button onClick={openComposer}>编辑草稿</button>
          ) : (
            <button onClick={() => verify(x.id)}>标为已核验</button>
          )}
        </div>
      ))}
    </section>
  );
}
