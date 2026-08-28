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

export function buildFinalBody(body: string, symbols: string[]): string {
  if (symbols.length === 0) return body;
  const existing = new Set<string>();
  for (const item of extractTaggedSymbols(body)) existing.add(item);
  const missing = symbols.filter((s) => !existing.has(s));
  if (missing.length === 0) return body;
  const tags = missing.flatMap((s) => [`#${s}`, `$${s}`]).join(" ");
  return `${body.trim()}\n\n${tags}`;
}

export function nowText(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}
