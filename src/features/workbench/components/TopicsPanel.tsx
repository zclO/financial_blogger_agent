import type { Topic } from "../types";

export function TopicsPanel({
  topics,
  verify,
  openComposer,
}: {
  topics: Topic[];
  verify: (id: number) => void;
  openComposer: () => void;
}) {
  return (
    <section className="panel">
      <h2>选题池</h2>
      {topics.map((x) => (
        <div className="row" key={x.id}>
          <div>
            <b>{x.title}</b>
            <small>
              {x.source} · {x.verified ? "已核验" : "待核验"}
            </small>
          </div>
          {x.verified ? <button onClick={openComposer}>编辑草稿</button> : <button onClick={() => verify(x.id)}>标为已核验</button>}
        </div>
      ))}
    </section>
  );
}
