const TRACKING = /^(utm_|fbclid$|gclid$|mc_eid$|igshid$|ref_src$)/i;

/** Only http(s) and ftp links are ever navigated to. javascript:, data:, file: etc. are inert. */
export function isSafeUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === 'http:' || p === 'https:' || p === 'ftp:';
  } catch {
    return false;
  }
}

/** Canonical form for duplicate detection. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    let s = u.toString();
    if (u.pathname === '/' && !u.search) s = s.replace(/\/$/, '');
    else if (u.pathname.length > 1) s = s.replace(/\/(?=\?|$)/, '');
    return s;
  } catch {
    return raw.trim();
  }
}

export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Turn pasted text into a URL if it looks like one. */
export function parseUrlInput(input: string): string | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return isSafeUrl(s) ? s : null;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(s)) return `https://${s}`;
  return null;
}
