import {useState} from "react";

type Tab = "仪表盘" | "选题池" | "内容工坊" | "发布队列" | "设置";
type Topic = { id: number; title: string; source: string; verified: boolean };
type Draft = { title: string; body: string; reviewed: boolean; queued: boolean };

const seed: Topic[] = [
    {id: 1, title: "以太坊生态升级官方公告", source: "项目官方 API（示例）", verified: true},
    {id: 2, title: "BTC ETF 日度资金数据待核验", source: "授权行情源（示例）", verified: false},
];
const tabs: Tab[] = ["仪表盘", "选题池", "内容工坊", "发布队列", "设置"];

export function App() {
    const [tab, setTab] = useState<Tab>("仪表盘");
    const [topics, setTopics] = useState(seed);
    const [draft, setDraft] = useState<Draft>({
        title: seed[0].title,
        body: "【市场信息整理】\n\n以官方公告为准，等待更多数据交叉验证。\n\n信息整理，不构成投资建议。",
        reviewed: false,
        queued: false
    });
    const [notice, setNotice] = useState("未连接外部数据源；当前仅使用本地演示数据。");
    const verified = topics.filter((x) => x.verified).length;
    const queue = () => {
        if (!draft.body.includes("不构成投资建议")) return setNotice("草稿必须保留风险提示。");
        setDraft({...draft, queued: true});
        setNotice("已进入内部审核队列，不会对外发布。");
        setTab("发布队列");
    };
    return <div className="app">
        <aside><b>↗ 财经内容工作台</b><small>本地优先 · 审核优先</small>{tabs.map((x) => <button
            className={tab === x ? "active" : ""} onClick={() => setTab(x)} key={x}>{x}</button>)}
            <p>真实发布默认关闭，直至完成授权、来源备案与审核配置。</p></aside>
        <main>
            <header>
                <div><em>FINANCIAL BLOGGER AGENT</em><h1>{tab}</h1></div>
                <span>● 本地工作区</span></header>
            <div className="notice">{notice}</div>
            {tab === "仪表盘" && <>
                <section className="metrics"><Card n={topics.length - verified} t="待核验选题"/><Card n={verified}
                                                                                                      t="可生成草稿"/><Card
                    n={draft.queued ? 1 : 0} t="待人工发布"/></section>
                <Topics topics={topics}
                        verify={(id) => setTopics(topics.map((x) => x.id === id ? {...x, verified: true} : x))}
                        open={() => setTab("内容工坊")}/></>}{tab === "选题池" && <Topics topics={topics}
                                                                                          verify={(id) => setTopics(topics.map((x) => x.id === id ? {
                                                                                              ...x,
                                                                                              verified: true
                                                                                          } : x))}
                                                                                          open={() => setTab("内容工坊")}/>} {tab === "内容工坊" &&
            <section className="panel"><label>标题<input value={draft.title}
                                                         onChange={(e) => setDraft({...draft, title: e.target.value})}/></label><label>正文<textarea
                rows={12} value={draft.body}
                onChange={(e) => setDraft({...draft, body: e.target.value})}/></label><label><input type="checkbox"
                                                                                                    checked={draft.reviewed}
                                                                                                    onChange={(e) => setDraft({
                                                                                                        ...draft,
                                                                                                        reviewed: e.target.checked
                                                                                                    })}/> 已完成来源与风险人工复核</label>
                <button disabled={!draft.reviewed} onClick={queue}>提交人工审核</button>
            </section>}{tab === "发布队列" &&
            <section className="panel"><h2>{draft.queued ? draft.title : "暂无待审核内容"}</h2>
                <p>{draft.queued ? "状态：待人工发布。平台连接器尚未启用，因此不会自动发送。" : "请先在内容工坊提交草稿。"}</p>
            </section>}{tab === "设置" && <section className="panel"><h2>数据源与自动化策略</h2><p>数据源：未配置。只接受官方
            API、商业许可或书面授权。</p><p>自动发布：关闭。密钥将由 Rust 端安全存储，前端不保存 Token 或 Cookie。</p>
        </section>}</main>
    </div>;
}

function Card({n, t}: { n: number; t: string }) {
    return <article><small>{t}</small><strong>{n}</strong></article>
}

function Topics({topics, verify, open}: { topics: Topic[]; verify: (id: number) => void; open: () => void }) {
    return <section className="panel"><h2>选题池</h2>{topics.map((x) => <div className="row" key={x.id}>
        <div><b>{x.title}</b><small>{x.source} · {x.verified ? "已核验" : "待核验"}</small></div>
        {x.verified ? <button onClick={open}>编辑草稿</button> :
            <button onClick={() => verify(x.id)}>标为已核验</button>}</div>)}</section>
}
