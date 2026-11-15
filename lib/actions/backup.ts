import { db, setSetting } from '@/lib/core/db';
import { normalizeUrl } from '@/lib/util/url';
import type { Meta } from '@/lib/core/types';

/** Tags and notes live only in Folio, so they are the only thing a backup needs to carry. */
export interface BackupEntry {
  url: string;
  tags: string[];
  note: string;
}

const BACKUP_APP = 'folio';
const BACKUP_VERSION = 1;

/** Limits applied to imported files, so a hostile or corrupt backup cannot flood the database. */
export const BACKUP_LIMITS = { entries: 50_000, url: 4096, tags: 50, tag: 64, note: 20_000 } as const;

/** Largest backup file accepted, checked before the file is read into memory. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const TAG_PATTERN = /^[\p{L}\p{N}_-]+$/u;

/**
 * Serialises tags and notes to JSON. Entries are keyed by URL, not bookmark id, because native
 * ids differ between browser profiles. Records the backup time so the dashboard can stop nagging.
 */
export async function exportBackup(): Promise<string> {
  const [metaRows, bookmarks] = await Promise.all([db.meta.toArray(), db.bookmarks.toArray()]);
  const urlOf = new Map(bookmarks.map((b) => [b.id, b.url]));
  const entries: BackupEntry[] = [];
  for (const m of metaRows) {
    const url = urlOf.get(m.id);
    if (url) entries.push({ url, tags: m.tags, note: m.note });
  }
  await setSetting('lastBackupAt', Date.now());
  return JSON.stringify(
    { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), meta: entries },
    null,
    2,
  );
}

/**
 * Validates backup JSON and returns its entries. Throws on anything that is not a Folio backup.
 * Entries with malformed fields are rejected, not repaired, so imports are all-or-nothing.
 */
export function parseBackup(text: string): BackupEntry[] {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large');
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a Folio backup');
  const { app, version, meta } = data as { app?: unknown; version?: unknown; meta?: unknown };
  if (app !== BACKUP_APP || version !== BACKUP_VERSION || !Array.isArray(meta)) throw new Error('Not a Folio backup');
  if (meta.length > BACKUP_LIMITS.entries) throw new Error('Backup is too large');

  return meta.map((entry: unknown): BackupEntry => {
    const e = entry as Partial<BackupEntry> | null;
    const ok =
      !!e &&
      typeof e.url === 'string' &&
      e.url.length <= BACKUP_LIMITS.url &&
      typeof e.note === 'string' &&
      e.note.length <= BACKUP_LIMITS.note &&
      Array.isArray(e.tags) &&
      e.tags.length <= BACKUP_LIMITS.tags &&
      e.tags.every((t) => typeof t === 'string' && t.length <= BACKUP_LIMITS.tag && TAG_PATTERN.test(t));
    if (!ok) throw new Error('Backup contains an invalid entry');
    return { url: e.url!, tags: e.tags!, note: e.note! };
  });
}

/**
 * Restores tags and notes onto bookmarks with a matching URL. Returns how many bookmarks were updated.
 * Looks bookmarks up once and writes in a single transaction, so a large backup is a few database
 * operations, not one per entry.
 */
export async function importBackup(text: string): Promise<number> {
  const entries = parseBackup(text);
  const idsByUrl = new Map<string, string[]>();
  for (const bookmark of await db.bookmarks.toArray()) {
    const ids = idsByUrl.get(bookmark.normUrl) ?? [];
    ids.push(bookmark.id);
    idsByUrl.set(bookmark.normUrl, ids);
  }

  const now = Date.now();
  const puts: Meta[] = [];
  const deletes: string[] = [];
  let updated = 0;
  for (const entry of entries) {
    for (const id of idsByUrl.get(normalizeUrl(entry.url)) ?? []) {
      updated++;
      if (entry.tags.length || entry.note) puts.push({ id, tags: entry.tags, note: entry.note, updatedAt: now });
      else deletes.push(id);
    }
  }
  await db.transaction('rw', db.meta, async () => {
    await db.meta.bulkPut(puts);
    await db.meta.bulkDelete(deletes);
  });
  return updated;
}
