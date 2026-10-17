#!/usr/bin/env node
// init.mjs — 템플릿 적용: {{PROJECT_NAME}} 치환 + mockup.yaml project 갱신 + 자기 자신 삭제(--keep 없으면). 의존성 0.
// 사용: node init.mjs --name <프로젝트> [--keep]   ·   node init.mjs --self-test
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['.git', 'node_modules', 'init.mjs']);
const TEXT = /\.(md|yaml|yml|toml|json|mjs|html|css)$/i;

export function run(root, name) {
  if (!name) throw new Error('--name <프로젝트>가 필요하다');
  const changed = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (SKIP.has(e.name)) continue; const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (TEXT.test(e.name)) { const t = readFileSync(p, 'utf8'); const u = t.replace(/\{\{PROJECT_NAME\}\}/g, name); if (u !== t) { writeFileSync(p, u); changed.push(p); } } } };
  walk(root);
  const my = join(root, 'mockup.yaml'); writeFileSync(my, readFileSync(my, 'utf8').replace(/^project:.*$/m, `project: "${name}"`));
  return { changed: changed.length };
}

if (process.argv.includes('--self-test')) {
  const tmp = join(ROOT, '.init-selftest'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp);
  for (const n of readdirSync(ROOT)) if (!['.git', 'node_modules', '.init-selftest'].includes(n)) cpSync(join(ROOT, n), join(tmp, n), { recursive: true });
  const fails = [];
  try {
    const r = run(tmp, 'proj-x');
    if (r.changed < 1) fails.push('치환 0건');
    if (!/^project: "proj-x"$/m.test(readFileSync(join(tmp, 'mockup.yaml'), 'utf8'))) fails.push('mockup.yaml 미갱신');
    if (/\{\{PROJECT_NAME\}\}/.test(readFileSync(join(tmp, 'AGENTS.md'), 'utf8'))) fails.push('AGENTS 치환 누락');
    try { run(tmp); fails.push('이름 없이 통과'); } catch { /* 기대 */ }
  } catch (e) { fails.push('예외: ' + e.message); }
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails.length ? 'self-test FAIL: ' + fails.join(' · ') : 'self-test OK (치환 · mockup.yaml · 거부)');
  process.exit(fails.length ? 1 : 0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.argv.includes('--self-test')) {
  const a = process.argv.slice(2); const name = a.includes('--name') ? a[a.indexOf('--name') + 1] : null;
  try { const r = run(ROOT, name); console.log(`적용: ${name} · 치환 ${r.changed}파일`); if (!a.includes('--keep')) { rmSync(join(ROOT, 'init.mjs'), { force: true }); console.log('init.mjs 제거(템플릿 전용)'); } }
  catch (e) { console.error(e.message + '\n사용: node init.mjs --name <프로젝트> [--keep]'); process.exit(2); }
}
