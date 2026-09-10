import type { Tab, Topic, NewsSource, PipelineNode } from "./types";

export const TABS: Tab[] = ["仪表盘", "选题池", "新闻源", "流水线", "内容工坊", "发布队列", "自动发布", "设置"];

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
  // Macro & Economic Data
  { id: "fomc", name: "FOMC 利率决议", category: "宏观经济", url: "https://www.federalreserve.gov/feeds/press_monetary.xml" },
  { id: "epi", name: "经济政策研究所 (EPI)", category: "宏观经济", url: "https://www.epi.org/feed/" },
  { id: "bea", name: "美国经济分析局 (BEA)", category: "宏观经济", url: "https://apps.bea.gov/rss/rss.xml" },
  // Silver & Precious Metals
  { id: "ahead-of-the-herd", name: "Ahead of the Herd", category: "白银贵金属", url: "https://aheadoftheherd.com/feed/" },
  { id: "mining-com", name: "Mining.com", category: "白银贵金属", url: "https://www.mining.com/feed" },
];

// ── Pipeline defaults ──

export const DEFAULT_LLM_SYSTEM_PROMPT =
  "你是一位专业的加密货币财经编辑。请根据提供的新闻素材，撰写一篇简明扼要的中文财经资讯。要求：\n1. 客观准确，不添加未经证实的信息\n2. 语言简洁，适合社交媒体发布\n3. 在末尾标注信息来源\n4. 必须包含\u201c信息整理，不构成投资建议\u201d声明";

export const DEFAULT_LLM_USER_PROMPT =
  "标题：{{title}}\n来源：{{source}}\n摘要：{{summary}}\n链接：{{link}}\n\n请根据以上新闻素材撰写一篇财经资讯。";

export const DEFAULT_IMAGE_PROMPT =
  "A professional financial news illustration for: \"{{title}}\". Clean, modern design with subtle crypto/finance motifs, warm lighting, high quality, editorial style.";

export const DEFAULT_IMAGE_NEGATIVE_PROMPT =
  "blurry, low quality, distorted text, watermark, ugly, deformed, nsfw";

export const DEFAULT_PIPELINE_NODES: PipelineNode[] = [
  {
    id: "source-default",
    kind: "source",
    name: "新闻源",
    position: { x: 100, y: 150 },
    sourceConfig: { sourceIds: [] },
  },
  {
    id: "llm-default",
    kind: "llm",
    name: "大模型加工",
    position: { x: 400, y: 150 },
    llmConfig: {
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      model: "gpt-4o-mini",
      systemPrompt: DEFAULT_LLM_SYSTEM_PROMPT,
      userPromptTemplate: DEFAULT_LLM_USER_PROMPT,
      temperature: 0.7,
      maxTokens: 2000,
    },
  },
];
