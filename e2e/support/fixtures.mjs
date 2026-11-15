// A tiny local web server so tests never touch the internet. It serves a page that declares a favicon.
import http from 'node:http';
import { deflateSync } from 'node:zlib';

/** A solid-colour PNG of the given size, built without dependencies. */
export function solidPng(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) rows.set([r, g, b], y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Starts the fixture server on a free port. Returns its origin and a `close()`. */
export async function startFixtureServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/declared-icon.png') {
      res.setHeader('content-type', 'image/png');
      return res.end(solidPng(128, 128, [46, 158, 82]));
    }
    if (req.url === '/favicon.ico') {
      res.setHeader('content-type', 'image/png');
      return res.end(solidPng(32, 32, [47, 138, 220]));
    }
    res.setHeader('content-type', 'text/html');
    res.end('<title>Fixture Page</title><link rel="icon" href="/declared-icon.png" sizes="128x128">hello');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => server.close() };
}
