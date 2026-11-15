# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added

- **Meadow** background: a quiet, grainy dusk meadow along the page edges that keeps the list calm, in both themes.
- Website at folio.cinematicgenius007.com with user documentation (`site/`): static HTML, no client JavaScript, deployable on Vercel.
- The folder breadcrumb starts at _All bookmarks_, folds long paths behind `…`, and is a labelled navigation landmark for screen readers.

## [0.1.0]

First public version.

### Added

- Toolbar popup to save the current page into any folder, with a note and `#tags`, a `/` search across every folder, and a height that follows the task.
- Full-page dashboard and side panel over the browser's native bookmarks: instant search, nested folders, folder switcher, breadcrumb, multi-select, right-click menu.
- Keyboard-first navigation (`J K H L C O E M X ⌫ Z ?`) and global shortcuts (`Alt+S`, `Alt+Shift+F`, `Alt+Shift+B`).
- Tags and notes with JSON backup and restore, validated on import.
- Undoable deletes for bookmarks and folders, kept for 30 days.
- Hardening: the icon fetcher refuses private networks (including IPv6-mapped forms), streams downloads with a byte budget, and discards answers from private redirect targets; backups are limited and validated; Folio refuses to save or edit non-http(s)/ftp URLs; release builds are verified against the documented permissions.
- Duplicate detection that ignores tracking parameters and fragments.
- Favicons: browser cache on Chromium (with letter tiles instead of the generic globe), local fetch and cache on Firefox and Zen.
- Overcast and Dusk themes; Marble, Edges, Glow, Horizon and Waves backgrounds, or a custom image.
- Builds for Chromium (MV3) and Firefox/Zen (MV2) from one codebase; unit and end-to-end tests for both.
