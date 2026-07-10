import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 28572;
const wait = ms => new Promise(r => setTimeout(r, ms));

// 사전 체크 — 이미 응답 중이면 외부 인스턴스를 상대로 검증할 위험이 있어 즉시 실패
const occupied = await fetch(`http://localhost:${PORT}/health`).then(r => r.ok).catch(() => false);
if (occupied) {
  throw new Error(`포트 ${PORT} 점유 중 — 기존 studio-serve 종료 후 재실행`);
}

test('serve: health, injection, save-tokens round-trip', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-'));
  const tokensPath = join(dir, 'tokens.json');
  writeFileSync(tokensPath, JSON.stringify({
    $schema: 'design-studio/tokens-v1',
    meta: { project: 'test', updated: '2026-07-10', source: 'onboarding' },
    color: { primary: '#0046FF', bg: '#fff', surface: '#f4f5f7', text: '#111', muted: '#777', allowed: [] },
    font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
    radius: { base: '10px', card: '14px', pill: '999px' },
    spacing: { unit: '4px', gutter: '16px' },
    tolerance: { colorDeltaE: 5, radiusPx: 2 },
  }));
  const proc = spawn('node', ['design-studio/scripts/studio-serve.mjs', '--tokens', tokensPath, '--no-open'],
    { env: { ...process.env, CLAUDE_PLUGIN_DATA: dir } });
  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { await wait(250);
      up = await fetch(`http://localhost:${PORT}/health`).then(r => r.ok).catch(() => false); }
    assert.ok(up, 'server did not start');

    const health = await fetch(`http://localhost:${PORT}/health`).then(r => r.json());
    assert.equal(health.app, 'design-studio');

    const html = await fetch(`http://localhost:${PORT}/`).then(r => r.text());
    assert.ok(html.includes('__USER_TOKENS__'), 'tokens injected');
    assert.ok(html.includes('"#0046FF"'), 'token value present');
    assert.ok(html.includes('__STUDIO_SERVER__'), 'server flag injected');

    const newTokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
    newTokens.color.primary = '#FF0000';
    const r1 = await fetch(`http://localhost:${PORT}/save-tokens`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTokens) });
    assert.equal(r1.status, 200);
    assert.equal(JSON.parse(readFileSync(tokensPath, 'utf8')).color.primary, '#FF0000');

    const r2 = await fetch(`http://localhost:${PORT}/add-use`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'shimmer-button', use: { p: 'test', where: 'a.tsx', how: 'x', date: '2026-07' } }) });
    assert.equal(r2.status, 200);
    assert.ok(existsSync(join(dir, 'uses.json')));

    const exp = await fetch(`http://localhost:${PORT}/export.json`).then(r => r.json());
    assert.ok(Array.isArray(exp.motions));
    assert.ok(exp.motions.length > 100);
  } finally { proc.kill(); }
});

test('serve: save-tokens rejects payload with "undefined" leaked value', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-'));
  const tokensPath = join(dir, 'tokens.json');
  const base = {
    $schema: 'design-studio/tokens-v1',
    meta: { project: 'test', updated: '2026-07-10', source: 'onboarding' },
    color: { primary: '#0046FF', bg: '#fff', surface: '#f4f5f7', text: '#111', muted: '#777', allowed: [] },
    font: { family: 'Pretendard', headingWeight: 800, bodySize: '14px' },
    radius: { base: '10px', card: '14px', pill: '999px' },
    spacing: { unit: '4px', gutter: '16px' },
    tolerance: { colorDeltaE: 5, radiusPx: 2 },
  };
  writeFileSync(tokensPath, JSON.stringify(base));
  const proc = spawn('node', ['design-studio/scripts/studio-serve.mjs', '--tokens', tokensPath, '--no-open'],
    { env: { ...process.env, CLAUDE_PLUGIN_DATA: dir } });
  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) { await wait(250);
      up = await fetch(`http://localhost:${PORT}/health`).then(r => r.ok).catch(() => false); }
    assert.ok(up, 'server did not start');

    const broken = { ...base, radius: { ...base.radius, base: 'undefinedpx' } };
    const r = await fetch(`http://localhost:${PORT}/save-tokens`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(broken) });
    assert.equal(r.status, 400);
    assert.equal(JSON.parse(readFileSync(tokensPath, 'utf8')).radius.base, '10px', 'tokens.json unchanged on rejection');
  } finally { proc.kill(); }
});
