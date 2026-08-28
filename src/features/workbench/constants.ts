import type { Tab, Topic } from "./types";

export const TABS: Tab[] = ["仪表盘", "选题池", "内容工坊", "发布队列", "设置"];

export const DEFAULT_TOPICS: Topic[] = [
  { id: 1, title: "以太坊生态升级官方公告", source: "项目官方 API（示例）", verified: true },
  { id: 2, title: "BTC ETF 日度资金数据待核验", source: "授权行情源（示例）", verified: false },
];

export const DEFAULT_DRAFT_BODY =
  "【市场信息整理】\n\n以官方公告为准，等待更多数据交叉验证。\n\n信息整理，不构成投资建议。";
