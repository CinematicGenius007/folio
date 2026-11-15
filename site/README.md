# Folio website

The site at [folio.cinematicgenius007.com](https://folio.cinematicgenius007.com): a landing page and the user documentation.
It is plain static HTML with the CSS inlined into each page and **no client-side JavaScript**.

```sh
cd site
npm install
npm run build      # builds dist/ and runs the link and SEO checks
npm run preview    # build, then serve dist/ on http://localhost:4321
```

## Layout

| Path                      | What it is                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/home.html`           | The landing page body (`{{nav}}`, `{{footer}}`, `{{repo}}`, `{{email}}`, `{{summary}}` are filled in)               |
| `src/styles.css`          | All styles, inlined and minified into every page                                                                    |
| `content/docs/*.md`       | One documentation page per file. Front matter: `title`, `nav`, `description`, `order`                               |
| `public/`                 | Copied as-is: fonts, painted images, icons, the social card                                                         |
| `build.mjs`               | Renders everything, plus `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` and a `.md` twin of each doc page |
| `scripts/check.mjs`       | Fails the build on a missing title, description, canonical or `<h1>`, a broken link, or a script tag                |
| `scripts/paint-assets.py` | Paints the scene images (needs Python with numpy and Pillow). Outputs are committed                                 |
| `scripts/og.mjs`          | Renders `og.jpg` and the favicons in headless Chromium. Outputs are committed                                       |

To add a documentation page, drop a Markdown file in `content/docs/` with front matter; navigation, the sitemap and
`llms.txt` pick it up automatically.

## The look

One painted scene, with the words infused into it: a navy dusk sky, one coral cloud, and a meadow that darkens down the
page. The images are painted without grain so they compress to a few kilobytes; the film grain is an SVG noise filter in
CSS laid over everything, text included, and display type is filled with a speckled ink texture via `background-clip: text`.
There are no cards or panels: text stays readable through soft halos tinted by whatever is behind it.

## Deploying on Vercel

Import the repository and set **Root Directory** to `site`. `vercel.json` sets the build command, output directory,
clean URLs, long-lived caching for `/assets` and `/fonts`, and security headers (a strict CSP that allows no scripts).
Add `folio.cinematicgenius007.com` under the project's domains.

## SEO and answer engines

- Every page has a unique title, description, canonical URL, Open Graph and Twitter card.
- JSON-LD: `SoftwareApplication`, `WebSite` and `SoftwareSourceCode` on the home page; `TechArticle` and `BreadcrumbList` on docs.
- `llms.txt` gives language models a short, factual map of Folio; `llms-full.txt` and `/docs/*.md` carry the full text.
- `robots.txt` welcomes all crawlers and points at the sitemap.
