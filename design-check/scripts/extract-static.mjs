#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const EXT = new Set(['.css', '.scss', '.less', '.tsx', '.jsx', '.js', '.ts', '.vue', '.html', '.svelte']);
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage', 'out']);
const root = process.argv[2] || process.cwd();

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.has(extname(name)) && st.size < 2e6) yield p;
  }
}

const RE = {
  color: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]{3,40}\)|hsla?\([^)]{3,40}\)/g,
  radius: /border-radius\s*:\s*([^;}"']+)|borderRadius\s*:\s*['"]([^'"]+)['"]/g,
  // font-family CSS values may or may not be quoted; \1 backreference keeps
  // opening/closing quotes symmetric so quoted names like 'Comic Sans MS' are captured whole.
  font: /font-family\s*:\s*(['"]?)([^;}'"]+)\1|fontFamily\s*:\s*(['"])([^'"]+)\3/g,
};

const findings = [];
for (const file of walk(root)) {
  const rel = relative(root, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    for (const m of text.matchAll(RE.color))
      findings.push({ file: rel, line: i + 1, kind: 'color',
        value: m[0].toLowerCase(), context: text.trim().slice(0, 120) });
    for (const m of text.matchAll(RE.radius))
      findings.push({ file: rel, line: i + 1, kind: 'radius',
        value: (m[1] || m[2] || '').trim(), context: text.trim().slice(0, 120) });
    for (const m of text.matchAll(RE.font))
      findings.push({ file: rel, line: i + 1, kind: 'font',
        value: (m[2] || m[4] || '').trim(), context: text.trim().slice(0, 120) });
  });
}
console.log(JSON.stringify({ root, findings }, null, 2));
