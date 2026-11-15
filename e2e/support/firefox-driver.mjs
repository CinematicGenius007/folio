// Drives a throwaway Firefox-family browser (Zen, Firefox) over WebDriver BiDi, with no geckodriver.
// It always uses a fresh temporary profile and never touches your real one.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sleep } from './checks.mjs';

/** Fixed internal UUID so the test can open `moz-extension://<uuid>/...` pages. */
export const EXTENSION_UUID = '11111111-2222-4333-8444-555555555555';
const GECKO_ID = 'folio@cinematicgenius007.com';

const DEFAULT_BINARY =
  process.env.ZEN_BIN ??
  process.env.FIREFOX_BIN ??
  (process.platform === 'darwin' ? '/Applications/Zen.app/Contents/MacOS/zen' : 'firefox');

const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/** Converts a BiDi serialised value into a plain JavaScript value. */
export function plain(value) {
  if (!value) return value;
  if (value.type === 'array') return value.value.map(plain);
  if (value.type === 'object')
    return Object.fromEntries(value.value.map(([k, v]) => [typeof k === 'string' ? k : k.value, plain(v)]));
  return value.value;
}

/** Launches the browser headless, installs the unpacked extension, and returns a small client. */
export async function launchFirefox({ extensionPath, binary = DEFAULT_BINARY }) {
  const profile = mkdtempSync(join(tmpdir(), 'folio-firefox-'));
  writeFileSync(
    join(profile, 'user.js'),
    [
      `user_pref("extensions.webextensions.uuids", ${JSON.stringify(JSON.stringify({ [GECKO_ID]: EXTENSION_UUID }))});`,
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
      'user_pref("app.update.enabled", false);',
      'user_pref("zen.welcome-screen.seen", true);',
    ].join('\n'),
  );

  const port = await freePort();
  const child = spawn(
    binary,
    ['-no-remote', '-profile', profile, '--remote-debugging-port', String(port), '--headless', 'about:blank'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      // BiDi needs this to evaluate scripts inside extension pages. Safe: the profile is disposable.
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
    },
  );
  let log = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (d) => (log += d));

  const socket = await connect(port, () => log);
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.type === 'error') waiter.reject(new Error(`${data.error}: ${data.message}`));
    else waiter.resolve(data.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('session.new', { capabilities: {} });
  await send('webExtension.install', { extensionData: { type: 'path', path: extensionPath } });

  const client = {
    send,
    /** Evaluates an expression inside a tab and returns a plain value. */
    async evaluate(context, expression) {
      const result = await send('script.evaluate', {
        expression,
        target: { context },
        awaitPromise: true,
        resultOwnership: 'none',
        serializationOptions: { maxObjectDepth: 6 },
      });
      if (result.type === 'exception') throw new Error(result.exceptionDetails.text);
      return plain(result.result);
    },
    /** Browsing context id of the first tab whose URL ends with `suffix`. */
    async findTab(suffix) {
      const tree = await send('browsingContext.getTree', {});
      return tree.contexts.find((c) => c.url.endsWith(suffix))?.context;
    },
    async newTab(url) {
      const { context } = await send('browsingContext.create', { type: 'tab' });
      if (url) await send('browsingContext.navigate', { context, url, wait: 'complete' });
      return context;
    },
    /** Presses keys in a tab. Special keys use WebDriver code points, e.g. '' for Enter. */
    async type(context, text) {
      const actions = [...text].flatMap((value) => [
        { type: 'keyDown', value },
        { type: 'keyUp', value },
      ]);
      await send('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions }] });
    },
    async close() {
      try {
        await send('browser.close');
      } catch {
        /* the browser may already be gone */
      }
      child.kill();
      rmSync(profile, { recursive: true, force: true });
    },
  };
  return client;
}

async function connect(port, getLog) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
      await new Promise((resolve, reject) => {
        socket.onopen = resolve;
        socket.onerror = reject;
      });
      return socket;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`The browser did not open a BiDi endpoint.\n${getLog().slice(-2000)}`);
}

/** WebDriver key code points for keys that have no printable character. */
export const ENTER = '\uE007';
export const ESCAPE = '\uE00C';
export const extensionPage = (name) => `moz-extension://${EXTENSION_UUID}/${name}`;
