export function normalizeSymbols(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s，、]+/)
        .map((x) => x.trim().toUpperCase())
        .filter((x) => /^[A-Z][A-Z0-9]{1,9}$/.test(x)),
    ),
  );
}

export function extractTaggedSymbols(body: string): string[] {
  const matched = body.match(/[#$]([A-Za-z][A-Za-z0-9]{1,9})/g) ?? [];
  return Array.from(new Set(matched.map((x) => x.slice(1).toUpperCase())));
}

/** Binance Square API 允许的最大 # 标签数量 */
const MAX_HASHTAGS = 10;

export function buildFinalBody(body: string, symbols: string[]): string {
  if (symbols.length === 0) return body;
  const existing = new Set<string>();
  for (const item of extractTaggedSymbols(body)) existing.add(item);
  const missing = symbols.filter((s) => !existing.has(s));
  if (missing.length === 0) return body;

  // 统计正文中已有的 # 标签数量，计算剩余可用额度
  const existingHashtags = (body.match(/#[A-Za-z][A-Za-z0-9]{1,9}/g) ?? []).length;
  const hashtagBudget = Math.max(0, MAX_HASHTAGS - existingHashtags);

  const tags: string[] = [];
  for (let i = 0; i < missing.length; i++) {
    // $ 标签始终添加，# 标签受额度限制
    tags.push(`$${missing[i]}`);
    if (i < hashtagBudget) {
      tags.push(`#${missing[i]}`);
    }
  }
  return `${body.trim()}\n\n${tags.join(" ")}`;
}

export function nowText(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
