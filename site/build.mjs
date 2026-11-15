// Builds the Folio website into ./dist as plain static HTML: no client JavaScript, CSS inlined per page.
//
//   node build.mjs            build into dist/
//
// Pages:
//   src/home.html            the landing page body
//   content/docs/*.md        documentation, one page per file (front matter: title, description, order)
// Also writes sitemap.xml, robots.txt, llms.txt, llms-full.txt, a raw .md copy of every doc page, and 404.html.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE = 'https://folio.cinematicgenius007.com';
const REPO = 'https://github.com/CinematicGenius007/folio';
const EMAIL = 'folio@cinematicgenius007.com';
const NAME = 'Folio';
const TAGLINE = 'A keyboard-first bookmark manager for your browser’s own bookmarks';
const SUMMARY =
  'Folio is a free, open-source browser extension that turns the bookmarks your browser already keeps into a fast, ' +
  'keyboard-first library: instant search, nested folders, tags and notes, with no account, no server and no telemetry. ' +
  'It works in Chrome, Edge, Brave, Arc, Dia and other Chromium browsers, and in Firefox and Zen.';
/** The extension's version, from the repo root (absent if the site is ever built on its own). */
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, '..', 'package.json'), 'utf8')).version;
  } catch {
    return undefined;
  }
})();
/** Last commit date (YYYY-MM-DD) of a file, or undefined when git history is unavailable (e.g. a shallow export). */
function lastModified(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

// ---------- helpers ----------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Very small CSS minifier: comments and redundant whitespace only. */
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

const CSS = minifyCss(readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8'));

/** Parses `---` front matter of simple `key: value` lines. */
function frontMatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) return { data: {}, body: source };
  const data = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );
  return { data, body: source.slice(match[0].length) };
}

const LOGO = `<svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true"><g fill="#f4ead2"><circle cx="22" cy="22" r="1.7"/><circle cx="18" cy="22" r="1.7" fill-opacity=".75"/><circle cx="22" cy="18" r="1.7" fill-opacity=".75"/><circle cx="14" cy="22" r="1.7" fill-opacity=".5"/><circle cx="18" cy="18" r="1.7" fill-opacity=".5"/><circle cx="22" cy="14" r="1.7" fill-opacity=".5"/></g></svg>`;

const nav = (current) => `<header class="nav">
  <a class="brand" href="/" aria-label="Folio home">${LOGO}<span>Folio</span></a>
  <nav aria-label="Main"><ul>
    <li class="wide"><a href="/#features">features</a></li>
    <li class="wide"><a href="/#keys">keys</a></li>
    <li><a href="/docs"${current === 'docs' ? ' aria-current="page"' : ''}>docs</a></li>
    <li><a href="${REPO}" rel="noopener">source</a></li>
  </ul></nav>
</header>`;

const footer = () => `<footer>
  <div>
    <a class="brand" href="/">${LOGO}<span>Folio</span></a>
    <p>Free and open source under the MIT license. Made with care, kept on your machine.</p>
  </div>
  <ul>
    <li><a href="/docs">Documentation</a></li>
    <li><a href="/docs/privacy">Privacy</a></li>
    <li><a href="${REPO}" rel="noopener">GitHub</a></li>
    <li><a href="${REPO}/blob/main/LICENSE" rel="noopener">MIT License</a></li>
    <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
  </ul>
</footer>`;

/** The shared document shell. */
function page({ path, title, description, body, jsonLd, preloadHero = false, bodyClass = '', type = 'website' }) {
  const url = SITE + (path === '/' ? '' : path);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0c1226">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Folio">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Folio: Bookmarks, set free. A dusk meadow under a coral cloud.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${SITE}/og.jpg">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="text/plain" href="/llms.txt" title="Folio, summarised for language models">
<link rel="preload" href="/fonts/eb-garamond.woff2" as="font" type="font/woff2" crossorigin>
${
  preloadHero
    ? `<link rel="preload" as="image" href="/assets/hero-1920.avif" type="image/avif" media="(min-width: 900px)" fetchpriority="high">
<link rel="preload" as="image" href="/assets/hero-960.avif" type="image/avif" media="(max-width: 899px)" fetchpriority="high">`
    : ''
}
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${body}
</body>
</html>
`;
}

// ---------- structured data ----------

const PUBLISHER = { '@type': 'Organization', name: 'Folio contributors', url: SITE, email: EMAIL };

const softwareLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: NAME,
      description: SUMMARY,
      inLanguage: 'en',
      publisher: PUBLISHER,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE}/#software`,
      name: NAME,
      alternateName: 'Folio bookmark manager',
      description: SUMMARY,
      url: SITE,
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'Bookmark manager',
      operatingSystem: 'Chrome, Edge, Brave, Arc, Dia, Firefox, Zen (Windows, macOS, Linux)',
      ...(VERSION && { softwareVersion: VERSION }),
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      downloadUrl: `${REPO}/releases`,
      installUrl: `${SITE}/docs/install`,
      softwareHelp: { '@type': 'CreativeWork', url: `${SITE}/docs` },
      screenshot: `${SITE}/assets/memory-dashboard-1120.webp`,
      image: `${SITE}/og.jpg`,
      featureList: [
        'Works on the browser’s native bookmarks, no separate account or copy',
        'Instant fuzzy search over titles, URLs, tags, notes and folder paths',
        'Keyboard shortcuts for every action',
        'Nested folders with a folder switcher and breadcrumb',
        'Tags and notes stored locally, with JSON backup and restore',
        'Deleted bookmarks kept for 30 days and restorable with undo',
        'Popup, full-page dashboard and side panel',
        'No server, no analytics, no telemetry',
      ],
      author: PUBLISHER,
      publisher: PUBLISHER,
      sameAs: [REPO],
    },
    {
      '@type': 'SoftwareSourceCode',
      name: 'Folio source code',
      codeRepository: REPO,
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
      targetProduct: { '@id': `${SITE}/#software` },
    },
  ],
};

// ---------- docs ----------

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      if (depth === 1) return `<h1 class="ink ink--sky">${text}</h1>\n`;
      const id = slugify(text);
      return `<h${depth} id="${id}"><a href="#${id}">${text}</a></h${depth}>\n`;
    },
    // Docs are first-party, but raw HTML and odd URL schemes are still refused so a slip cannot ship markup.
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      if (!/^(https:|mailto:|\/|#)/.test(href)) throw new Error(`Refusing link with unsafe or relative URL: ${href}`);
      const external = /^https?:/.test(href) && !href.startsWith(SITE);
      return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' rel="noopener"' : ''}>${text}</a>`;
    },
  },
});

const DOCS_DIR = join(ROOT, 'content', 'docs');
const docs = readdirSync(DOCS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((file) => {
    const source = readFileSync(join(DOCS_DIR, file), 'utf8');
    const { data, body } = frontMatter(source);
    const slug = file === 'index.md' ? '' : file.replace(/\.md$/, '');
    return {
      slug,
      path: slug ? `/docs/${slug}` : '/docs',
      title: data.title,
      nav: data.nav || data.title,
      description: data.description,
      order: Number(data.order ?? 99),
      markdown: body,
      modified: lastModified(join(DOCS_DIR, file)),
      html: marked.parse(body),
    };
  })
  .sort((a, b) => a.order - b.order);

for (const d of docs) {
  if (!d.title || !d.description) throw new Error(`docs/${d.slug || 'index'}.md needs title and description`);
}

function docPage(doc, i) {
  const prev = docs[i - 1];
  const next = docs[i + 1];
  const side = docs
    .map((d) => `<li><a href="${d.path}"${d === doc ? ' aria-current="page"' : ''}>${escapeHtml(d.nav)}</a></li>`)
    .join('');
  const crumbs = [
    { name: 'Folio', path: '/' },
    { name: 'Docs', path: '/docs' },
    ...(doc.slug ? [{ name: doc.nav, path: doc.path }] : []),
  ];
  const body = `${nav('docs')}
<div class="docs">
<div class="docs-sky" aria-hidden="true"></div>
<div class="docs-wrap">
  <aside class="docs-side">
    <p class="label">documentation</p>
    <nav aria-label="Documentation"><ol>${side}</ol></nav>
  </aside>
  <main id="main">
    <nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs
      .map((c, n) =>
        n === crumbs.length - 1
          ? `<li aria-current="page">${escapeHtml(c.name)}</li>`
          : `<li><a href="${c.path}">${escapeHtml(c.name)}</a></li>`,
      )
      .join('')}</ol></nav>
    <article class="prose halo">${doc.html}</article>
    <nav class="pager" aria-label="Pages">${
      prev ? `<a href="${prev.path}"><small>previous</small>${escapeHtml(prev.nav)}</a>` : ''
    }${next ? `<a class="next" href="${next.path}"><small>next</small>${escapeHtml(next.nav)}</a>` : ''}</nav>
  </main>
</div>
${footer()}
</div>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: doc.title,
        description: doc.description,
        url: SITE + doc.path,
        inLanguage: 'en',
        ...(doc.modified && { dateModified: doc.modified }),
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@type': 'SoftwareApplication', name: NAME, url: SITE },
        author: PUBLISHER,
        publisher: PUBLISHER,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, n) => ({
          '@type': 'ListItem',
          position: n + 1,
          name: c.name,
          item: SITE + (c.path === '/' ? '' : c.path),
        })),
      },
    ],
  };
  return page({
    path: doc.path,
    title: doc.slug ? `${doc.title} · Folio docs` : 'Folio documentation',
    description: doc.description,
    body,
    jsonLd,
    type: 'article',
  });
}

// ---------- write ----------

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });

const homeBody = readFileSync(join(ROOT, 'src', 'home.html'), 'utf8')
  .replaceAll('{{nav}}', nav('home'))
  .replaceAll('{{footer}}', footer())
  .replaceAll('{{repo}}', REPO)
  .replaceAll('{{email}}', EMAIL)
  .replaceAll('{{summary}}', escapeHtml(SUMMARY));
writeFileSync(
  join(DIST, 'index.html'),
  page({
    path: '/',
    title: `Folio · ${TAGLINE}`,
    description:
      'Folio is a free, open-source, keyboard-first bookmark manager for Chrome, Edge, Brave, Arc, Dia, Firefox and Zen. Instant search, nested folders, tags and notes over your native bookmarks. No account, no server, no telemetry.',
    body: homeBody,
    jsonLd: softwareLd,
    preloadHero: true,
  }),
);

mkdirSync(join(DIST, 'docs'), { recursive: true });
docs.forEach((doc, i) => {
  const file = join(DIST, 'docs', `${doc.slug || 'index'}.html`);
  writeFileSync(file, docPage(doc, i));
  // a plain-markdown twin of every page, for people and models that prefer the source
  writeFileSync(
    join(DIST, 'docs', `${doc.slug || 'index'}.md`),
    `# ${doc.title}\n\n> ${doc.description}\n\n${doc.markdown.replace(/^# .*\n+/, '')}`,
  );
});

writeFileSync(
  join(DIST, '404.html'),
  page({
    path: '/404',
    title: 'Not found · Folio',
    description: 'This page wandered off into the meadow. Head back to the Folio home page or the documentation.',
    body: `${nav('home')}<main id="main" class="hero" style="justify-content:center"><h1 class="ink ink--sky">Lost in the meadow.</h1><p class="sub">This page does not exist. Try the <a href="/">home page</a> or the <a href="/docs">documentation</a>.</p></main>`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Not found' },
  }).replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"'),
);

const urls = [
  { loc: SITE, priority: '1.0', lastmod: lastModified(join(ROOT, 'src', 'home.html')) },
  ...docs.map((d) => ({ loc: SITE + d.path, priority: d.slug ? '0.7' : '0.8', lastmod: d.modified })),
];
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`,
);

writeFileSync(
  join(DIST, 'robots.txt'),
  `# Everyone is welcome, people and machines alike.
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,
);

// llms.txt (https://llmstxt.org): a short map for language models; llms-full.txt carries every doc page.
const llms = `# Folio

> ${SUMMARY}

Key facts:
- Price: free. License: MIT. Source: ${REPO}
${VERSION ? `- Current version: ${VERSION}\n` : ''}- Browsers: Chrome, Edge, Brave, Arc, Dia and other Chromium browsers (Manifest V3); Firefox and Zen (Manifest V2).
- Data: works on the browser's native bookmark tree. Tags, notes, settings and a search index stay in the browser's IndexedDB on this device. No account, server, analytics or telemetry.
- Network: none on Chromium. On Firefox and Zen it only fetches each bookmarked site's favicon directly from that site.
- Not on a browser store yet; install from a GitHub release or build from source.
- Contact: ${EMAIL}

## Documentation

${docs.map((d) => `- [${d.title}](${SITE}/docs/${d.slug || 'index'}.md): ${d.description}`).join('\n')}

## Optional

- [Full documentation in one file](${SITE}/llms-full.txt)
- [Source code and issues](${REPO})
`;
writeFileSync(join(DIST, 'llms.txt'), llms);
writeFileSync(
  join(DIST, 'llms-full.txt'),
  `# Folio documentation\n\n> ${SUMMARY}\n\n` +
    docs.map((d) => `---\nSource: ${SITE}${d.path}\n\n${d.markdown.trim()}\n`).join('\n'),
);

if (!existsSync(join(DIST, 'og.jpg'))) console.warn('warning: public/og.jpg is missing (run `node scripts/og.mjs`)');
console.log(`built ${docs.length + 2} pages into dist/`);
