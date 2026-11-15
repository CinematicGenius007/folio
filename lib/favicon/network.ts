/**
 * Guards for the icon fetcher. Folio only ever asks the public internet for icons: a bookmark for
 * `http://192.168.1.1/` or `http://intranet/` must not make the extension probe your local network.
 */

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^(22[4-9]|2[3-5]\d)\./, // multicast and reserved
];

const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp'];

const isPrivateIpv4 = (address: string) => PRIVATE_IPV4.some((range) => range.test(address));

/**
 * Expands an IPv6 literal (as `URL` normalises it, without brackets) to eight 16-bit groups,
 * or returns null if it is not valid. Handles `::` compression and a trailing dotted IPv4.
 */
function expandIpv6(address: string): number[] | null {
  let text = address;
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number) as [number, number, number, number];
    text = text.slice(0, dotted.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail].map((g) =>
    parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function isPublicIpv6(address: string): boolean {
  const g = expandIpv6(address);
  if (!g) return false;
  const embeddedV4 = `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
  const mappedOrCompatible = g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0); // ::ffff:a.b.c.d and ::a.b.c.d
  if (mappedOrCompatible) return !isPrivateIpv4(embeddedV4);
  if (g[0] === 0x64 && g[1] === 0xff9b) return !isPrivateIpv4(embeddedV4); // NAT64 64:ff9b::/96
  if (g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1)) return false; // :: and ::1
  if ((g[0]! & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g[0]! & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((g[0]! & 0xff00) === 0xff00) return false; // multicast
  return true;
}

/** True when `hostname` (as given by `URL.hostname`) looks like a public internet host. */
export function isPublicHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!host || host === 'localhost') return false;
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false;
  if (host.includes(':')) return isPublicIpv6(host);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !isPrivateIpv4(host);
  return host.includes('.'); // a single-label name is an intranet host
}

/**
 * Test builds point the fetcher at a local server; production builds never do.
 * The flag must be exactly `"1"`, so values like `0` or `false` cannot enable it by accident.
 */
const ALLOW_PRIVATE = import.meta.env?.VITE_FOLIO_TEST === '1';

/** True when Folio may fetch `url`: http(s) only, a public host, and no credentials in the URL. */
export function isFetchableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.username || u.password) return false;
    return ALLOW_PRIVATE || isPublicHost(u.hostname);
  } catch {
    return false;
  }
}
