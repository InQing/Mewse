import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd(), 'prototype');
const out = path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  try { const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); const real = path.resolve(file); if (!real.startsWith(root + path.sep)) throw new Error(); res.writeHead(200, { 'Content-Type': mime[path.extname(real)] || 'application/octet-stream' }); fs.createReadStream(real).pipe(res); } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const profile = path.resolve('.taste-skill', 'chrome-interaction');
fs.mkdirSync(profile, { recursive: true });
const portFile = path.join(profile, 'DevToolsActivePort');
try { fs.rmSync(portFile); } catch {}
const chromePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
const chrome = spawn(chromePath, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let port;
  for (let i = 0; i < 150; i++) { await sleep(100); try { port = parseInt(fs.readFileSync(portFile, 'utf8'), 10); break; } catch {} }
  if (!port) throw new Error('Chrome did not start');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id); } else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text); });
  const send = (method, params = {}, sessionId) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = async (method, params = {}) => { const result = await send(method, params, sessionId); if (result.error) throw new Error(result.error.message); return result.result; };
  const evaluate = async expression => { const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result.value; };
  const screenshot = async name => { const { data } = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64')); };
  const click = async selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing ${selector}'); el.click(); return true; })()`);
  const view = async (width, height) => { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await sleep(200); };
  const visible = selector => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return !!e && !e.hidden && e.getClientRects().length > 0; })()`);
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url }); await sleep(1400);
  assert.equal(await visible('#workspaceView'), true, 'Default writing workspace visible');
  assert.equal(await evaluate(`document.querySelector('#editor').contentEditable`), 'true');
  assert.ok(await evaluate(`document.querySelector('#wordCount').textContent`) !== '0', 'Word count is populated');
  await screenshot('workbench');

  await click('[data-doc="chapter4"]'); await sleep(750);
  assert.equal(await evaluate(`document.querySelector('#chapterTitle').value`), '潮汐表', 'Chapter switching works');
  await click('[data-doc="chapter5"]'); await sleep(750);
  await click('#workspaceView [data-action="theme"]'); await sleep(220);
  assert.equal(await visible('#themePanel'), true, 'Unified theme panel opens in workspace');
  await click('[data-theme-choice="green"]');
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'green', 'Theme changes from workspace button');
  await click('#themePanel [data-close]');
  await click('[data-action="settings"]'); await sleep(250);
  assert.equal(await visible('#settingsDrawer'), true);
  await evaluate(`(() => { const e = document.querySelector('#fontSize'); e.value = '21'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim()`), '21px');
  await screenshot('settings');
  await click('#settingsDrawer [data-close]');
  await click('#workspaceView [data-action="theme"]'); await sleep(180);
  await click('[data-theme-choice="paper"]');
  await click('#themePanel [data-close]');

  await click('[data-action="split"]'); await sleep(250);
  assert.equal(await visible('#referencePane'), true, 'Split view visible');
  assert.ok((await evaluate(`document.querySelector('#referenceBody').textContent`)).includes('核心线索'));
  await screenshot('split');
  await click('[data-action="split"]');

  await click('[data-action="search"]'); await sleep(180);
  assert.equal(await evaluate(`document.querySelector('#searchResultCount').textContent`), '', 'No redundant recent label when search empty');
  await screenshot('search-empty');
  await evaluate(`(() => { const e = document.querySelector('#globalSearch'); e.value = '父亲'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.ok((await evaluate(`document.querySelector('#searchResultCount').textContent`)).includes('个匹配文档'));
  await screenshot('search');
  await evaluate(`document.querySelector('#searchResults [data-doc="chapter5"]').click()`); await sleep(700);
  assert.equal(await visible('#searchPanel'), false, 'Search closes after selection');

  await click('[data-action="find"]');
  await evaluate(`(() => { const e = document.querySelector('#findInput'); e.value = '沈舟'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.ok(!(await evaluate(`document.querySelector('#matchCount').textContent`)).startsWith('0'), 'Find results shown');
  await click('#findPanel [data-close]');
  assert.equal(await evaluate(`document.querySelectorAll('#editor mark.search-match').length`), 0, 'Find highlights cleaned up');
  assert.equal(await evaluate(`document.querySelector('#chapterTitle').value`), '雾中的船鸣');

  await click('[data-action="wordcount"]'); await sleep(220); assert.equal(await visible('#wordPanel'), true);
  await screenshot('wordcount'); await click('#wordPanel [data-action="calendar"]'); await sleep(240);
  assert.equal(await visible('#calendarModal'), true); assert.equal(await evaluate(`document.querySelectorAll('#heatmap i').length`), 364);
  await screenshot('calendar'); await click('#calendarModal [data-close]');

  await click('[data-action="snapshot"]'); await sleep(240); assert.equal(await visible('#historyDrawer'), true); await screenshot('history');
  await click('[data-action="create-snapshot"]'); await sleep(220); assert.equal(await visible('#actionModal'), true); await click('[data-action="confirm-snapshot"]');
  await click('[data-action="trash"]'); await sleep(220); assert.equal(await visible('#trashDrawer'), true); await click('#trashDrawer [data-close]');
  const syncBox = await evaluate(`(() => { const r = document.querySelector('#syncStatus').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: syncBox.x, y: syncBox.y }); await sleep(220);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sync-tooltip')).opacity`), '1', 'Tooltip visible on hover');
  await screenshot('sync-connected');
  await evaluate(`document.querySelector('#syncStatus').dataset.sync = 'offline'`); await sleep(200);
  assert.equal(await visible('.sync-tip-offline small'), true, 'Offline reason visible');
  await screenshot('sync-offline');
  await evaluate(`document.querySelector('#syncStatus').dataset.sync = 'connected'`);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 }); await sleep(200);
  await click('[data-action="publish"]'); await sleep(220); assert.equal(await visible('#publishPanel'), true, 'Standalone publish preset panel opens');
  assert.equal(await evaluate(`!!document.querySelector('#publishPanel [data-action="copy"]')`), false, 'Publish panel does not embed copy button');
  await screenshot('publish');
  await click('#publishPanel [data-close]');
  await click('[data-action="copy"]'); await sleep(200); assert.ok((await evaluate(`document.querySelector('#toastMessage').textContent`)).includes('已按发布格式复制'));

  await click('[data-action="focus"]'); await sleep(220); assert.equal(await evaluate(`document.querySelector('#workspaceView').classList.contains('focus-mode')`), true); await screenshot('focus');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); assert.equal(await evaluate(`document.querySelector('#workspaceView').classList.contains('focus-mode')`), false);

  await click('[data-action="library"]'); await sleep(200); assert.equal(await visible('#libraryView'), true);
  assert.equal(await evaluate(`!!document.querySelector('.avatar, .local-label')`), false, 'No avatar or local cloud hint in library');
  await screenshot('library');
  await click('#libraryView [data-action="theme"]'); await sleep(220);
  assert.equal(await visible('#themePanel'), true, 'Unified theme panel opens in library');
  await click('[data-theme-choice="dark"]'); await sleep(180);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark', 'Theme changes from library button');
  await screenshot('library-dark');
  await click('[data-theme-choice="paper"]'); await click('#themePanel [data-close]');
  await click('[data-book="mountain"] [data-action="open-workspace"]'); await sleep(720); assert.equal(await visible('#workspaceView'), true); assert.equal(await evaluate(`document.querySelector('#currentBook').textContent`), '山间邮局');
  await click('[data-action="library"]'); await click('[data-book="tide"] [data-action="open-workspace"]'); await sleep(720);

  for (const [width, height, name] of [[1024, 768, 'workbench-1024'], [390, 844, 'workbench-mobile'], [320, 640, 'workbench-320']]) {
    await view(width, height);
    await evaluate(`window.dispatchEvent(new Event('resize'))`);
    await sleep(220);
    const overflow = await evaluate(`(() => { const w = innerWidth; if (document.documentElement.scrollWidth <= w) return null; return [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > w + 1).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)).slice(0, 6); })()`);
    assert.equal(overflow, null, `No horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
    await screenshot(name);
  }
  await view(390, 844); await click('[data-action="library"]'); await sleep(200); await screenshot('library-mobile');
  assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`), false, 'Library has no horizontal overflow');
  assert.deepEqual(errors, [], 'No browser JavaScript exceptions');
  console.log('PASS: default view, chapter switching, theme, font size, split, global search, find cleanup, word count, calendar, snapshots, trash, conflict, copy, focus, library, book switching, responsive widths.');
  fs.writeFileSync(path.join(root, 'checks', 'results.json'), JSON.stringify({ status: 'PASS', errors, screenshots: fs.readdirSync(out).filter(name => name.endsWith('.png')) }, null, 2));
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  try { ws?.send(JSON.stringify({ id: 9999, method: 'Browser.close' })); } catch {}
  await sleep(300);
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  server.close();
}
