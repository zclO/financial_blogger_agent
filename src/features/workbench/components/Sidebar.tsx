import type { Tab } from "../types";

export function Sidebar({
  tab,
  tabs,
  onChangeTab,
}: {
  tab: Tab;
  tabs: Tab[];
  onChangeTab: (tab: Tab) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <b>财经内容工作台</b>
        <small>本地优先 · 审核优先</small>
      </div>
      <nav className="nav">
        {tabs.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => onChangeTab(item)}>
            {item}
          </button>
        ))}
      </nav>
      <p>真实发布默认关闭，需完成授权、来源备案与审核配置。</p>
    </aside>
  );
}
