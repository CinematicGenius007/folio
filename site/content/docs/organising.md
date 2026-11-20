---
title: Folders, tags and notes in Folio
nav: Folders, tags and notes
description: How to organise bookmarks in Folio with nested folders, the folder switcher, tags, notes, duplicates detection and undoable deletes.
order: 4
---

# Folders, tags and notes

Folio shows your browser's real bookmark folders. Anything you do here is done to your bookmarks, and anything you do in the browser shows up here straight away.

## Nested folders

Folders can sit inside folders as deep as you like. In the full page:

- `L` or `→` opens the highlighted folder, `H` or `←` goes up.
- The **breadcrumb** in the top left shows where you are, for example `All bookmarks / Dev / Rust`. Click any part of it to jump there. Very long paths fold their middle into `…`; click it to see the rest.
- `C` opens the **folder switcher**. Type part of any folder's name, at any depth, and press `Enter`.
- `Shift+N` creates a new folder inside the current one.

## Moving and saving

- `M` moves the highlighted bookmark, or everything you selected with `X`, using a folder picker you can search.
- Paste a link into the search box and press `Enter` to save it into the current folder. The edit box opens with the site name selected, so you can type a title straight away, or press `Esc` to keep it.
- A move can be undone with `Z`, like a delete.

## Filing the Inbox

Pages saved without a folder land in the **Inbox**. Open it with `C`: the highlighted bookmark shows up to three folders that suit it, worked out on your device from where you keep that site and similar pages. Press `1`, `2` or `3` (or click one) to file it there, and the next bookmark moves up under the cursor. `Z` puts it back.

- From any page, `Alt+S` opens the popup to save it. Number keys pick one of the listed folders; `/` searches all of them, at any depth.

## Tags and notes

Press `E` on a bookmark to edit its title, link, tags and a note. Search matches tags and notes too, so a few words now save a hunt later. While you type a `#tag`, Folio shows the rest of your most-used matching tag in faint text; `Tab` accepts it, so `#rust` does not drift into `#rustlang`. Type `#tag` in the search box, or click a tag on a bookmark, to list only the bookmarks with that tag. The popup takes a note and tags as you save a page, and `E` there edits them once it is saved. Tags and notes are stored in your browser profile on this device, not in the bookmark itself.

## Duplicates

Saving a page you already have shows where it lives instead of making a second copy. Folio ignores tracking parameters such as `utm_source` and `#fragments` when it compares links.

Copies made elsewhere (by the browser, an import or sync) are gathered in the **Duplicates** view, which the folder switcher offers when there are any. Each link's copies are listed together with their folders; `Backspace` deletes the highlighted one, with undo.

## Deleting and undo

One bookmark deletes immediately with an undo toast. Several bookmarks, or a whole folder, ask first. Either way, deleted bookmarks are kept for **30 days**: press `Z` to bring the last ones back, tags and notes included.

## Backups

Open the Folio menu with `O` and choose **Back up tags and notes** to download a JSON file. **Restore** reads it back. Your bookmarks themselves are already backed up by your browser and its sync.
