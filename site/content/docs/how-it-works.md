---
title: How Folio works
nav: How it works
description: Folio's one-way data loop over native bookmarks, why search is instant, and why your browser stays the source of truth.
order: 7
---

# How it works

Folio is a view over your browser's bookmarks, not a second home for them. Three pieces keep it fast and honest.

## The one-way loop

1. **Pages read from a local index.** The popup, the full page and the side panel never ask the browser for bookmarks. They read a small copy kept in the browser's IndexedDB, and redraw the moment it changes. That is why search and navigation feel instant.
2. **Changes go straight to the browser.** When you save, edit, move or delete, Folio calls the browser's bookmark API directly. It does not touch the index.
3. **One writer keeps the index in step.** A background script listens for bookmark events, re-reads the tree and writes only the differences into the index. It is the only thing that ever writes there.

Because every change travels the same way round, every open Folio window agrees, changes made in the browser's own bookmark manager show up immediately, and the browser always remains the source of truth.

## Search

The index feeds a small full-text search engine that runs in the page. It matches titles, links, tags, notes and folder paths, completes words as you type, forgives small typos in longer words, and ranks title matches first.

## Deletes you can undo

When a bookmark disappears, the background script keeps a record of it, with its tags and notes, for 30 days. Undo recreates the bookmark in its folder, or in the Inbox if that folder is gone too, and reattaches what you wrote about it.

## Built with

TypeScript, React and Tailwind CSS on [WXT](https://wxt.dev), with Dexie for IndexedDB and MiniSearch for search. One codebase builds Manifest V3 for Chromium browsers and Manifest V2 for Firefox and Zen. The full architecture notes are in the [repository](https://github.com/CinematicGenius007/folio/blob/main/docs/ARCHITECTURE.md).
