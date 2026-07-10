#!/usr/bin/env node
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { parseMotions } from './lib/motions-parse.mjs';

const PORT = 28572;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');   // design-studio/
const HTML_PATH = join(ROOT, 'assets', 'studio.html');
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA
  || join(homedir(), '.claude', 'design-studio-data');
const USES_PATH = join(DATA_DIR, 'uses.json');

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const TOKENS_PATH = resolve(flag('--tokens') || join(process.cwd(), '.design', 'tokens.json'));
const NO_OPEN = args.includes('--no-open');
const IDLE_MS = 30 * 60 * 1000;

const readJson = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };
const body = req => new Promise((res, rej) => {
  let b = ''; req.on('data', c => { b += c; if (b.length > 2e6) rej(new Error('too large')); });
  req.on('end', () => res(b)); req.on('error', rej);
});

let idleTimer;
const touch = () => { clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { console.log('[studio] 30분 유휴 — 종료'); process.exit(0); }, IDLE_MS); };

const server = http.createServer(async (req, res) => {
  touch();
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && req.url === '/health') return json(200, { app: 'design-studio' });
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
      const tokens = readJson(TOKENS_PATH, null);
      const uses = readJson(USES_PATH, {});
      // JSON 값 안의 </script> 탈출 방지: <는 유효한 JSON 이스케이프이므로 의미는 동일
      const esc = s => JSON.stringify(s).replace(/</g, '\\u003c');
      const inject = `<script>window.__STUDIO_SERVER__=1;` +
        `window.__USER_TOKENS__=${esc(tokens)};` +
        `window.__USES__=${esc(uses)};</script>`;
      const html = readFileSync(HTML_PATH, 'utf8').replace('</head>', inject + '\n</head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
    if (req.method === 'POST' && req.url === '/save-tokens') {
      const raw = await body(req);
      const t = JSON.parse(raw);
      if (t.$schema !== 'design-studio/tokens-v1') return json(400, { error: 'bad schema' });
      // 클라이언트 렌더링 버그로 "undefinedpx" 같은 값이 새어들어온 경우 저장 거부
      if (raw.includes('undefined')) return json(400, { error: 'leaked undefined value in tokens' });
      mkdirSync(dirname(TOKENS_PATH), { recursive: true });
      writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2));
      console.log('[studio] tokens 저장 →', TOKENS_PATH);
      return json(200, { ok: true, path: TOKENS_PATH });
    }
    if (req.method === 'POST' && req.url === '/add-use') {
      const { id, use } = JSON.parse(await body(req));
      if (!id || !use) return json(400, { error: 'need id, use' });
      mkdirSync(DATA_DIR, { recursive: true });
      const uses = readJson(USES_PATH, {});
      (uses[id] = uses[id] || []).push(use);
      writeFileSync(USES_PATH, JSON.stringify(uses, null, 2));
      return json(200, { ok: true });
    }
    if (req.method === 'GET' && req.url === '/export.json') {
      const motions = parseMotions(readFileSync(HTML_PATH, 'utf8'));
      return json(200, { app: 'design-studio', tokensPath: TOKENS_PATH, motions });
    }
    json(404, { error: 'not found' });
  } catch (e) { json(500, { error: String(e.message || e) }); }
});

// 28572 점유 시: 우리 서버면 재사용(브라우저만 오픈), 아니면 명확한 에러
const existing = await fetch(`http://localhost:${PORT}/health`)
  .then(r => r.json()).catch(() => null);
if (existing && existing.app === 'design-studio') {
  console.log(`[studio] 기존 인스턴스 재사용 → http://localhost:${PORT}`);
  if (!NO_OPEN) execFile('open', [`http://localhost:${PORT}`]);
  process.exit(0);
}
server.listen(PORT, '127.0.0.1', () => {
  touch();
  console.log(`[studio] http://localhost:${PORT}  (tokens: ${TOKENS_PATH})`);
  if (!NO_OPEN) execFile('open', [`http://localhost:${PORT}`]);
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE'
    ? `[studio] 포트 ${PORT}가 다른 프로세스에 점유됨 — 해당 프로세스 종료 후 재시도`
    : String(e));
  process.exit(1);
});
