---
title: Troubleshooting Folio
nav: Troubleshooting
description: Fixes for common Folio problems, from a missing manifest when loading the extension to shortcuts that do nothing and icons shown as letters.
order: 8
---

# Troubleshooting

| What you see                                       | What to do                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Manifest file is missing" when loading            | You picked the parent folder. Choose the folder that contains `manifest.json`.                                            |
| `Alt+S` does nothing                               | Another extension or your system owns it. Rebind it in the browser's extension shortcut settings.                         |
| The full page is empty right after installing      | Give it a second; the first read covers your whole bookmark tree. Reloading the page reads it again.                      |
| Icons show letters instead of logos (Chromium)     | Chromium only has icons for pages you have visited. Folio shows a letter tile for the rest.                               |
| Icons show letters instead of logos (Firefox, Zen) | Icons are fetched in the background after install; give it a minute. Sites that block automated requests keep their tile. |
| Folio disappeared after restarting Firefox or Zen  | It was loaded as a temporary add-on. See [keeping it installed](/docs/install#keep-it).                                   |
| A link will not open                               | Folio only opens `http`, `https` and `ftp` links, never `javascript:`, `data:` or `file:` ones.                           |

Still stuck? [Open an issue](https://github.com/CinematicGenius007/folio/issues) or write to [folio@cinematicgenius007.com](mailto:folio@cinematicgenius007.com).
