/**
 * Picks icon candidates out of a page's HTML, best first.
 * Scalable SVG wins; otherwise the raster closest to 64px, with Apple touch icons slightly preferred.
 */
export function parseIconLinks(html: string, baseUrl: string): string[] {
  const found: { href: string; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    if (!/\bicon\b/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    const size = Number(/\bsizes\s*=\s*["']?(\d+)x/i.exec(tag)?.[1] ?? 0);
    let score = size >= 32 && size <= 256 ? 100 - Math.abs(size - 64) / 4 : 50;
    if (rel.includes('apple-touch')) score += 5;
    if (/\.svg(\?|$)/i.test(href) || /image\/svg/i.test(tag)) score = 110;
    try {
      found.push({ href: new URL(href, baseUrl).toString(), score });
    } catch {
      /* ignore an unparseable href */
    }
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.href);
}
