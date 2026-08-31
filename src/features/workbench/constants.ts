import type { Tab, Topic, NewsSource } from "./types";

export const TABS: Tab[] = ["仪表盘", "选题池", "新闻源", "内容工坊", "发布队列", "设置"];

export const DEFAULT_TOPICS: Topic[] = [
  { id: 1, title: "以太坊生态升级官方公告", source: "项目官方 API（示例）", verified: true },
  { id: 2, title: "BTC ETF 日度资金数据待核验", source: "授权行情源（示例）", verified: false },
];

export const DEFAULT_DRAFT_BODY =
  "【市场信息整理】\n\n以官方公告为准，等待更多数据交叉验证。\n\n信息整理，不构成投资建议。";

export const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  // Crypto Media
  { id: "coindesk", name: "CoinDesk", category: "加密货币", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { id: "cointelegraph", name: "Cointelegraph", category: "加密货币", url: "https://cointelegraph.com/rss" },
  { id: "theblock", name: "The Block", category: "加密货币", url: "https://www.theblock.co/rss" },
  { id: "decrypt", name: "Decrypt", category: "加密货币", url: "https://decrypt.co/feed" },
  // Government & Regulatory
  { id: "sec", name: "SEC", category: "政府监管", url: "https://www.sec.gov/news/pressreleases.rss" },
  { id: "cftc", name: "CFTC", category: "政府监管", url: "https://www.cftc.gov/rss/rss_news.xml" },
  { id: "fed", name: "Federal Reserve", category: "政府监管", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { id: "treasury", name: "U.S. Treasury", category: "政府监管", url: "https://home.treasury.gov/system/files/126/press-releases.rss" },
  { id: "federal-register", name: "Federal Register", category: "政府监管", url: "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=crypto&per_page=20&order=newest" },
];
