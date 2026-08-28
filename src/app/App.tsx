import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";

import {
  configureBinanceSquare,
  getBinanceSquareConfig,
  getBinanceSquareProxyConfig,
  publishBinanceSquareText,
  setBinanceSquareProxyConfig,
  type BinanceSquareConfig,
  type BinanceSquareProxyConfig,
} from "../lib/tauri";

type Tab = "仪表盘" | "选题池" | "内容工坊" | "发布队列" | "设置";
type Topic = { id: number; title: string; source: string; verified: boolean };
type Draft = { title: string; body: string; reviewed: boolean; queued: boolean };
type PublishState = "idle" | "scheduled" | "sending" | "sent" | "failed";

const tabs: Tab[] = ["仪表盘", "选题池", "内容工坊", "发布队列", "设置"];
const defaultTopics: Topic[] = [
  { id: 1, title: "以太坊生态升级官方公告", source: "项目官方 API（示例）", verified: true },
  { id: 2, title: "BTC ETF 日度资金数据待核验", source: "授权行情源（示例）", verified: false },
];

export function App() {
  const [tab, setTab] = useState<Tab>("仪表盘");
  const [topics, setTopics] = useState<Topic[]>(defaultTopics);
  const [draft, setDraft] = useState<Draft>({
    title: defaultTopics[0].title,
    body: "【市场信息整理】\n\n以官方公告为准，等待更多数据交叉验证。\n\n信息整理，不构成投资建议。",
    reviewed: false,
    queued: false,
  });
  const [notice, setNotice] = useState("未连接外部数据源；当前仅使用本地演示数据。");

  const [squareConfig, setSquareConfig] = useState<BinanceSquareConfig | null>(null);
  const [squareKeyInput, setSquareKeyInput] = useState("");
  const [squareNotice, setSquareNotice] = useState("");
  const [squareLoading, setSquareLoading] = useState(false);
  const [refreshingSquare, setRefreshingSquare] = useState(false);
  const [openingSquare, setOpeningSquare] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState("");

  const [proxyConfig, setProxyConfig] = useState<BinanceSquareProxyConfig>({
    enabled: false,
    proxyUrl: null,
  });
  const [proxyUrlInput, setProxyUrlInput] = useState("");
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyNotice, setProxyNotice] = useState("");

  const [allowScheduledPublish, setAllowScheduledPublish] = useState(false);
  const [scheduleAtInput, setScheduleAtInput] = useState("");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishOutput, setPublishOutput] = useState("");
  const [queueLogs, setQueueLogs] = useState<string[]>([]);

  const verifiedCount = useMemo(() => topics.filter((x) => x.verified).length, [topics]);

  const nowText = () =>
    new Date().toLocaleString("zh-CN", {
      hour12: false,
    });

  const appendQueueLog = (content: string) => {
    setQueueLogs((prev) => [`[${nowText()}] ${content}`, ...prev].slice(0, 20));
  };

  const loadSquareConfig = async (showSuccess: boolean) => {
    setRefreshingSquare(true);
    try {
      const config = await getBinanceSquareConfig();
      setSquareConfig(config);
      const time = nowText();
      setLastRefreshTime(time);
      if (showSuccess) setSquareNotice(`状态已刷新（${time}）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`读取配置失败：${message}`);
    } finally {
      setRefreshingSquare(false);
    }
  };

  const loadProxyConfig = async () => {
    try {
      const config = await getBinanceSquareProxyConfig();
      setProxyConfig(config);
      setProxyUrlInput(config.proxyUrl ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProxyNotice(`读取代理配置失败：${message}`);
    }
  };

  useEffect(() => {
    void loadSquareConfig(false);
    void loadProxyConfig();
  }, []);

  const queueDraft = () => {
    if (!draft.body.includes("不构成投资建议")) {
      setNotice("草稿必须保留“信息整理，不构成投资建议”。");
      return;
    }
    setDraft((prev) => ({ ...prev, queued: true }));
    setPublishState("idle");
    setPublishOutput("");
    appendQueueLog("草稿进入发布队列（待人工/定时执行）。");
    setNotice("已进入发布队列。默认不会自动发送，需手动开启定时执行。");
    setTab("发布队列");
  };

  const saveSquareKey = async () => {
    const apiKey = squareKeyInput.trim();
    if (!apiKey) {
      setSquareNotice("请先输入 Square OpenAPI Key。");
      return;
    }
    setSquareLoading(true);
    setSquareNotice("");
    try {
      await configureBinanceSquare(apiKey);
      setSquareKeyInput("");
      const time = nowText();
      setSquareNotice(`Key 已保存（${time}）`);
      await loadSquareConfig(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`保存失败：${message}`);
    } finally {
      setSquareLoading(false);
    }
  };

  const saveProxyConfig = async () => {
    setProxySaving(true);
    setProxyNotice("");
    try {
      const message = await setBinanceSquareProxyConfig({
        enabled: proxyConfig.enabled,
        proxyUrl: proxyUrlInput.trim() || null,
      });
      setProxyNotice(`${message}（${nowText()}）`);
      await loadProxyConfig();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setProxyNotice(`保存代理配置失败：${msg}`);
    } finally {
      setProxySaving(false);
    }
  };

  const openSquareCenter = async () => {
    if (!squareConfig?.creatorCenterUrl) {
      setSquareNotice("未读取到 Creator Center 地址，请先刷新状态。");
      return;
    }
    setOpeningSquare(true);
    try {
      await openUrl(squareConfig.creatorCenterUrl);
      setSquareNotice("已请求打开 Square Creator Center。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSquareNotice(`打开失败：${message}`);
    } finally {
      setOpeningSquare(false);
    }
  };

  const publishNow = async (trigger: "manual" | "scheduled") => {
    if (!draft.queued) {
      setNotice("当前没有待发送草稿。");
      return;
    }
    if (!draft.reviewed) {
      setNotice("草稿未完成人工复核，禁止发送。");
      return;
    }
    if (!squareConfig?.keyConfigured) {
      setNotice("Square OpenAPI Key 未配置，无法发送。");
      return;
    }

    setPublishState("sending");
    try {
      const result = await publishBinanceSquareText({
        title: draft.title,
        text: draft.body,
      });
      setPublishOutput(result.trim());
      setPublishState("sent");
      setDraft((prev) => ({ ...prev, queued: false }));
      setScheduleAtInput("");
      setAllowScheduledPublish(false);
      appendQueueLog(trigger === "scheduled" ? "定时任务执行成功并发送。" : "手动发送成功。");
      setNotice("发送成功。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPublishState("failed");
      setPublishOutput(message);
      appendQueueLog(trigger === "scheduled" ? `定时任务发送失败：${message}` : `手动发送失败：${message}`);
      setNotice("发送失败，请查看日志并重试。");
    }
  };

  const schedulePublish = () => {
    if (!draft.queued) {
      setNotice("当前没有待发送草稿。");
      return;
    }
    if (!allowScheduledPublish) {
      setNotice("请先开启“允许执行定时发送”。");
      return;
    }
    if (!scheduleAtInput) {
      setNotice("请先设置发送时间。");
      return;
    }
    const scheduleMs = new Date(scheduleAtInput).getTime();
    if (Number.isNaN(scheduleMs)) {
      setNotice("发送时间格式无效。");
      return;
    }
    if (scheduleMs <= Date.now()) {
      setNotice("发送时间必须晚于当前时间。");
      return;
    }
    setPublishState("scheduled");
    appendQueueLog(`已设置定时发送：${scheduleAtInput.replace("T", " ")}`);
    setNotice("定时发送已创建。");
  };

  const cancelSchedule = () => {
    setPublishState("idle");
    setScheduleAtInput("");
    appendQueueLog("已取消定时发送。");
    setNotice("定时发送已取消。");
  };

  useEffect(() => {
    if (!draft.queued || !allowScheduledPublish || publishState !== "scheduled" || !scheduleAtInput) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= new Date(scheduleAtInput).getTime()) {
        window.clearInterval(timer);
        void publishNow("scheduled");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allowScheduledPublish, draft.queued, publishState, scheduleAtInput]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <b>财经内容工作台</b>
          <small>本地优先 · 审核优先</small>
        </div>
        <nav className="nav">
          {tabs.map((item) => (
            <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item}
            </button>
          ))}
        </nav>
        <p>真实发布默认关闭，需完成授权、来源备案与审核配置。</p>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <em>FINANCIAL BLOGGER AGENT</em>
            <h1>{tab}</h1>
          </div>
          <span className="badge">本地工作区</span>
        </header>

        <div className="notice">{notice}</div>

        {tab === "仪表盘" && (
          <>
            <section className="metrics">
              <Card n={topics.length - verifiedCount} t="待核验选题" />
              <Card n={verifiedCount} t="可生成草稿" />
              <Card n={draft.queued ? 1 : 0} t="待人工发布" />
            </section>
            <Topics
              topics={topics}
              verify={(id) => setTopics(topics.map((x) => (x.id === id ? { ...x, verified: true } : x)))}
              open={() => setTab("内容工坊")}
            />
          </>
        )}

        {tab === "选题池" && (
          <Topics
            topics={topics}
            verify={(id) => setTopics(topics.map((x) => (x.id === id ? { ...x, verified: true } : x)))}
            open={() => setTab("内容工坊")}
          />
        )}

        {tab === "内容工坊" && (
          <section className="panel">
            <h2>内容编辑</h2>
            <label>
              标题
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label>
              正文
              <textarea rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={draft.reviewed}
                onChange={(e) => setDraft({ ...draft, reviewed: e.target.checked })}
              />
              已完成人工来源与风险复核
            </label>
            <button disabled={!draft.reviewed} onClick={queueDraft}>
              提交发布队列
            </button>
          </section>
        )}

        {tab === "发布队列" && (
          <section className="panel settings">
            <h2>发布队列</h2>
            {!draft.queued && <p>暂无待发送内容。请先在内容工坊提交草稿。</p>}
            {draft.queued && (
              <>
                <div className="kv">
                  <span className="key">队列稿件</span>
                  <span className="value">{draft.title}</span>
                </div>
                <div className="kv">
                  <span className="key">发送状态</span>
                  <span className={`status ${publishState === "sent" ? "ok" : ""}`}>
                    {publishState === "idle" && "待发送"}
                    {publishState === "scheduled" && "已定时"}
                    {publishState === "sending" && "发送中"}
                    {publishState === "sent" && "已发送"}
                    {publishState === "failed" && "发送失败"}
                  </span>
                </div>

                <label className="inline">
                  <input
                    type="checkbox"
                    checked={allowScheduledPublish}
                    onChange={(e) => {
                      setAllowScheduledPublish(e.target.checked);
                      appendQueueLog(e.target.checked ? "已开启定时发送执行开关。" : "已关闭定时发送执行开关。");
                    }}
                  />
                  允许执行定时发送（人工暂停开关）
                </label>

                <label>
                  发送时间
                  <input type="datetime-local" value={scheduleAtInput} onChange={(e) => setScheduleAtInput(e.target.value)} />
                </label>

                <div className="actions">
                  <button disabled={publishState === "sending"} onClick={schedulePublish}>
                    设置定时发送
                  </button>
                  <button disabled={publishState === "sending" || publishState !== "scheduled"} onClick={cancelSchedule}>
                    取消定时
                  </button>
                  <button disabled={publishState === "sending"} onClick={() => void publishNow("manual")}>
                    立即发送
                  </button>
                </div>

                {publishOutput && <pre className="output">{publishOutput}</pre>}

                <div className="log-list">
                  <h3>执行日志</h3>
                  {queueLogs.length === 0 && <p>暂无日志。</p>}
                  {queueLogs.map((log) => (
                    <p key={log}>{log}</p>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {tab === "设置" && (
          <section className="panel settings">
            <h2>数据源与自动化策略</h2>
            <p>自动发布：关闭。仅在授权、溯源、风险检查通过后，才可按策略自动发布。</p>
            <p>密钥仅通过 Rust 侧安全存储，前端不保存 Token 或 Cookie。</p>

            <div className="setting-grid">
              <div className="kv">
                <span className="key">Square OpenAPI Key 状态</span>
                <span className={squareConfig?.keyConfigured ? "status ok" : "status"}>
                  {squareConfig?.keyConfigured ? "已配置" : "未配置"}
                </span>
              </div>
              <div className="kv">
                <span className="key">最近刷新</span>
                <span className="value">{lastRefreshTime || "未刷新"}</span>
              </div>
            </div>

            <label>
              Square OpenAPI Key
              <input
                type="password"
                autoComplete="off"
                value={squareKeyInput}
                onChange={(e) => setSquareKeyInput(e.target.value)}
                placeholder="输入后仅用于调用 Rust 命令保存"
              />
            </label>

            <div className="actions">
              <button disabled={squareLoading} onClick={saveSquareKey}>
                {squareLoading ? "保存中..." : "保存 Key"}
              </button>
              <button disabled={refreshingSquare || squareLoading} onClick={() => void loadSquareConfig(true)}>
                {refreshingSquare ? "刷新中..." : "刷新状态"}
              </button>
              <button disabled={openingSquare || !squareConfig} onClick={openSquareCenter}>
                {openingSquare ? "打开中..." : "打开 Creator Center"}
              </button>
            </div>
            {squareNotice && <div className="subnotice">{squareNotice}</div>}

            <hr />

            <h2>代理配置</h2>
            <p>用于发布接口请求的网络代理。支持 VPN/本地代理地址。</p>
            <label className="inline">
              <input
                type="checkbox"
                checked={proxyConfig.enabled}
                onChange={(e) => setProxyConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              启用代理发送
            </label>
            <label>
              代理地址
              <input
                value={proxyUrlInput}
                onChange={(e) => setProxyUrlInput(e.target.value)}
                placeholder="例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
              />
            </label>
            <div className="actions">
              <button disabled={proxySaving} onClick={saveProxyConfig}>
                {proxySaving ? "保存中..." : "保存代理配置"}
              </button>
              <button disabled={proxySaving} onClick={() => void loadProxyConfig()}>
                重新加载
              </button>
            </div>
            {proxyNotice && <div className="subnotice">{proxyNotice}</div>}
          </section>
        )}
      </main>
    </div>
  );
}

function Card({ n, t }: { n: number; t: string }) {
  return (
    <article className="metric-card">
      <small>{t}</small>
      <strong>{n}</strong>
    </article>
  );
}

function Topics({ topics, verify, open }: { topics: Topic[]; verify: (id: number) => void; open: () => void }) {
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
          {x.verified ? <button onClick={open}>编辑草稿</button> : <button onClick={() => verify(x.id)}>标为已核验</button>}
        </div>
      ))}
    </section>
  );
}
