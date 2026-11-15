# Design

Folio's look is derived from [minimal.so](https://minimal.so)'s calm, list-first interface, adapted for an extension that is driven
from the keyboard. This page records the decisions so changes stay consistent.

## Principles

1. **Quiet by default.** Content first; chrome appears on hover or focus. No heavy outlines or loud borders.
2. **Fill, not outline, for state.** Hover and selection are a faint background fill. A thin 1 px ring is reserved for text-field focus.
3. **Keyboard is a first-class input.** Every action has a key, and keys are shown (small keycaps) where they apply.
4. **Off-black, never black.** Text is a soft charcoal, and the dark theme is a lifted charcoal, not pure black.
5. **Everything has a tile.** Missing icons are never broken images: a letter tile with a stable colour takes their place.

## Themes

| Theme    | Selector                   | Feel                                   |
| -------- | -------------------------- | -------------------------------------- |
| Overcast | `:root`                    | Cool, near-white ground, charcoal text |
| Dusk     | `:root[data-theme='dark']` | Lifted charcoal ground, neutral accent |

Both are defined as CSS variables in `styles/theme.css`, so a theme is one block of values. The user picks System, Overcast or Dusk.

## Colour system

Neutrals follow a 12-step role scale (the same roles as Radix Colors), so each step has one job:

| Step | Role                       | Overcast  | Dusk      |
| ---- | -------------------------- | --------- | --------- |
| 1    | Page background (`ground`) | `#fdfdff` | `#1f1f23` |
| 2    | Subtle background          | `#f5f7fb` | `#232327` |
| 3    | Hover fill                 | `#f6f6f9` | `#2a2a2f` |
| 4    | Selected fill              | `#e6e8ec` | `#313137` |
| 6    | Hairline (decorative)      | `#ebebee` | `#37373d` |
| 10   | Muted text                 | `#5c5c66` | `#a3a3ac` |
| 11   | Secondary text             | `#46464e` | `#c6c6cd` |
| 12   | Primary text (`ink`)       | `#2b2b31` | `#e9e9ed` |

Contrast targets: body and muted text at least 4.5:1 on their backgrounds; UI components at least 3:1 where they carry meaning.
The 8%/10% control border is intentionally subtle and decorative; focus is carried by the ring and the fill.

Collection and tile colours come from eight hues (red, yellow, green, teal, blue, violet, pink, slate) chosen at equal lightness and chroma per theme: darker for white letters on the light theme, lighter with dark letters on the dark theme.

In code, use the semantic Tailwind names (`bg-ground`, `bg-hover`, `bg-select`, `text-ink`, `text-muted`, `border-control`, `bg-primary`) and CSS variables, never hex values.

## Typography

[Geist](https://vercel.com/font) for text and Geist Mono for keycaps and shortcuts, both bundled with `@fontsource-variable`, so nothing loads from the network.

| Use            | Size and weight                 |
| -------------- | ------------------------------- |
| Row title      | 14 px, 500                      |
| Domain, dates  | 13 px, 500, muted               |
| Section labels | 11 px, uppercase, wide tracking |
| Keycaps        | 12 px mono                      |

## Layout

- The dashboard is one centred column, **672 px max** with 20 px padding, under a 56 px top bar. There is deliberately no sidebar; folders are navigated with the switcher and breadcrumb.
- The breadcrumb (`All bookmarks / Dev / Rust`) sits top left in quiet muted text; each ancestor is a button with a hover fill, and the current folder is the switcher itself. Paths deeper than four steps keep the root and the parent and fold the middle into `…`, which reveals it in place. Clicking a parent is the same as `H`.
- Rows are 14 px-radius, `12px 16px` padded, and extend 12 px beyond the column so hover fills align with the text edge.
- The popup is 380 px wide and its height follows the task (saving, saved, moving).
- The side panel uses the same components in a compact layout (two-line rows).

## Interaction details

- The row highlight appears after the first hover or key press, like a plain list.
- Hovering a row swaps its date for `⌘ Enter`.
- Menus are dropdowns with a filter box where lists can be long. `↑↓` moves, `↵` selects, `Esc` closes.
- Destructive actions: one bookmark deletes immediately with an Undo toast; several, or a whole folder, ask first.
- Keyboard symbols (`⌫ ↵ ⌘ ⇧ ↑ ↓`) are drawn icons, not font glyphs, so they stay crisp and aligned.

## Logo and icon

A rounded charcoal tile with six small dots fading out from the bottom-right corner (three, two, one), and no letter. `scripts/generate-icons.mjs` draws it with no dependencies; run `pnpm icons` to rewrite `public/icon/`. The dashboard top bar uses the same PNG, and `--sheet` renders the light-tile variant for comparison.

## Backgrounds

Generated, not images: **Marble** (domain-warped noise as a halftone dot grid, faded behind the list), and ordered-dither **Edges**, **Glow**, **Horizon** and **Waves** that keep the content column clear.

**Meadow** is a quiet version of the landing page's painted dusk: navy sky, a tilted coral cloud streak along the top, a rolling green hill with a few flowers along the bottom, slightly desaturated, vignetted and grained. Only the scene comes over, never the landing page's type.

- It lives in the gutters. `meadowWeight` keeps a soft, wavering oval behind the list at a 10% floor and lets the sky and meadow reach in a little along the top and bottom edges.
- Overcast gets a sun-faded print (same hues lifted toward paper, lower opacity) so it never looks muddy; Dusk gets the richer colours, still subdued.
- It is painted once per resize or theme change on a canvas at 1/5 of the page size, and the browser's smooth upscale gives the soft, dreamy edges. Grain is a seeded 128 px tile repeated with CSS. Nothing animates.
  A custom image is dimmed to keep text readable in both themes.
