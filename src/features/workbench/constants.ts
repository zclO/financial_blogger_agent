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
  { id: "cryptoslate", name: "CryptoSlate", category: "加密货币", url: "https://cryptoslate.com/feed/" },
  { id: "decrypt", name: "Decrypt", category: "加密货币", url: "https://decrypt.co/feed" },
  { id: "bitcoin-magazine", name: "Bitcoin Magazine", category: "加密货币", url: "https://bitcoinmagazine.com/.rss/full/" },
  // Government & Regulatory
  { id: "sec", name: "SEC", category: "政府监管", url: "https://www.sec.gov/news/pressreleases.rss" },
  { id: "fed", name: "Federal Reserve", category: "政府监管", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { id: "federal-register", name: "Federal Register (Crypto)", category: "政府监管", url: "https://www.federalregister.gov/api/v1/documents.rss?conditions[term]=crypto&per_page=20" },
];
