import { useEffect, useState } from "react";

import { getAppInfo, type AppInfo } from "../lib/tauri";

const modules = [
  ["仪表盘", "任务状态与市场概览"],
  ["选题池", "聚合、去重与来源核验"],
  ["内容工坊", "图文草稿与风险检查"],
  ["发布队列", "审核、定时与失败重试"],
  ["设置", "数据源、口吻与发布策略"],
] as const;

export function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  return (
    <main className="shell">
      <header>
        <p className="eyebrow">FINANCIAL BLOGGER AGENT</p>
        <h1>财经内容工作台</h1>
        <p>先建立可靠的来源、审核与发布闭环，再开启自动化。</p>
      </header>

      <section className="module-grid" aria-label="产品模块">
        {modules.map(([name, description]) => (
          <article key={name} className="module-card">
            <h2>{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer>
        <span>应用状态：{appInfo ? "桌面后端已连接" : "前端预览模式"}</span>
        {appInfo && <span>{appInfo.name} v{appInfo.version}</span>}
      </footer>
    </main>
  );
}
