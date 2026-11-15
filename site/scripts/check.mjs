// Sanity checks for the built site (run after `node build.mjs`):
// every page has one <h1>, a title, a description and a canonical link; every internal link and asset resolves;
// no page ships a script other than JSON-LD; JSON-LD parses.
//
//   node scripts/check.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Resolves a site path the way Vercel does with cleanUrls. */
function resolves(path) {
  const clean = decodeURIComponent(path.split(/[?#]/)[0]);
  if (clean === '/' || clean === '') return true;
  const base = join(DIST, clean);
  return [base, `${base}.html`, join(base, 'index.html')].some((p) => existsSync(p) && statSync(p).isFile());
}

const pages = walk(DIST).filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const name = relative(DIST, file);
  const count = (re) => (html.match(re) || []).length;

  if (count(/<h1[\s>]/g) !== 1) problems.push(`${name}: expected exactly one <h1>`);
  if (!/<title>[^<]{10,}<\/title>/.test(html)) problems.push(`${name}: missing or short <title>`);
  if (!/<meta name="description" content="[^"]{50,}"/.test(html))
    problems.push(`${name}: missing or short description`);
  if (!/<link rel="canonical" href="https:\/\/folio\.cinematicgenius007\.com/.test(html))
    problems.push(`${name}: missing canonical`);
  if (/<script(?![^>]*application\/ld\+json)/.test(html)) problems.push(`${name}: ships a script`);

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(json);
    } catch {
      problems.push(`${name}: invalid JSON-LD`);
    }
  }
  for (const [, ref] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (!ref.startsWith('//') && !resolves(ref)) problems.push(`${name}: broken link ${ref}`);
  }
  for (const [, set] of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const ref of set.split(',').map((s) => s.trim().split(/\s+/)[0])) {
      if (!resolves(ref)) problems.push(`${name}: broken srcset ${ref}`);
    }
  }
  for (const [, ref] of html.matchAll(/url\('(\/[^']+)'\)/g)) {
    if (!resolves(ref)) problems.push(`${name}: broken CSS url ${ref}`);
  }
}

for (const file of ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', 'og.jpg', 'favicon.svg']) {
  if (!existsSync(join(DIST, file))) problems.push(`missing ${file}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`site check passed: ${pages.length} pages`);
