#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseMotions } from './lib/motions-parse.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA
  || join(homedir(), '.claude', 'design-studio-data');
const USES_PATH = join(DATA_DIR, 'uses.json');
const readJson = (p, fb) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };

const motions = parseMotions(readFileSync(join(ROOT, 'assets', 'studio.html'), 'utf8'));
const userUses = readJson(USES_PATH, {});
for (const m of motions) if (userUses[m.id]) m.uses = [...m.uses, ...userUses[m.id]];

const [cmd, ...rest] = process.argv.slice(2);
const opt = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
const asJson = rest.includes('--json');
const row = m => `${m.id.padEnd(24)} [${m.cat}] ${m.title} — ${m.lib}` +
  (m.uses.length ? `  📌${m.uses.map(u => u.p).join(',')}` : '');

switch (cmd) {
  case 'list': {
    let list = motions;
    if (opt('--cat')) list = list.filter(m => m.cat === opt('--cat'));
    if (opt('--proj')) list = list.filter(m => m.uses.some(u => u.p === opt('--proj')));
    console.log(asJson ? JSON.stringify(list.map(({ code, ...m }) => m), null, 2)
      : list.map(row).join('\n'));
    break;
  }
  case 'search': {
    const q = (rest.find(a => !a.startsWith('--')) || '').toLowerCase();
    const list = motions.filter(m =>
      [m.id, m.title, m.lib, m.note].join(' ').toLowerCase().includes(q));
    console.log(asJson ? JSON.stringify(list.map(({ code, ...m }) => m), null, 2)
      : list.map(row).join('\n') || '(no match)');
    break;
  }
  case 'get': {
    const m = motions.find(x => x.id === rest[0]);
    if (!m) { console.error(`unknown id: ${rest[0]}`); process.exit(1); }
    console.log(asJson ? JSON.stringify(m, null, 2)
      : `# ${m.title} (${m.id})\n라이브러리: ${m.lib}\n의존성: ${m.deps}\n` +
        `링크: ${m.links.map(l => l[1]).join(' ')}\n\n${m.code}\n\n` +
        (m.uses.length ? '사용 이력:\n' + m.uses.map(u =>
          `- ${u.p} · ${u.where} · ${u.how} (${u.date})`).join('\n') : ''));
    break;
  }
  case 'add-use': {
    const id = rest[0];
    if (!motions.find(x => x.id === id)) { console.error(`unknown id: ${id}`); process.exit(1); }
    const use = { p: opt('--p'), where: opt('--where'), how: opt('--how'),
      date: opt('--date') || new Date().toISOString().slice(0, 7) };
    if (!use.p || !use.where || !use.how) {
      console.error('need --p --where --how'); process.exit(1); }
    mkdirSync(DATA_DIR, { recursive: true });
    const uses = readJson(USES_PATH, {});
    (uses[id] = uses[id] || []).push(use);
    writeFileSync(USES_PATH, JSON.stringify(uses, null, 2));
    console.log(`recorded: ${id} ← ${use.p}`);
    break;
  }
  case 'export':
    console.log(JSON.stringify(motions, null, 2)); break;
  default:
    console.log(`usage: motion-lab <list|search|get|add-use|export>
  list [--cat text|comp|sect|page|bg|eng] [--proj 이름] [--json]
  search <키워드> [--json]
  get <id> [--json]
  add-use <id> --p <프로젝트> --where <파일> --how <한줄> [--date YYYY-MM]
  export`);
}
