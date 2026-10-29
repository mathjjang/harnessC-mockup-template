// mockup.mjs — 목업 저장소 공용 라이브러리 (new-screen · confirm · validate가 공유). 프로젝트 지식 없음.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';

export const STATUSES = ['draft', 'ready', 'confirmed', 'reopened'];
export const STATE_RE = /^\d{2}-[a-z0-9][a-z0-9-]*\.html$/;           // 01-default.html
export const POLICY_SECTIONS = ['상태 전이', '액션별 동작', '권한', '빈/오류 조건', '한계값', '동적 동작', '문구'];
export const rd = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
/** 지문(해시) — 텍스트는 CRLF→LF 정규화 뒤, 바이너리(NUL 포함)는 바이트 그대로. 저장소가 eol=lf라 git은 LF로 저장하는데 Windows에서 CRLF로 쓴 작업트리를 그대로 해시하면
 *  커밋 뒤 영원히 재현되지 않아 같은 내용에 「확정 뒤 수정」 거짓 경보가 난다. 거짓 경보는 게이트를 죽인다. 읽는 쪽(개발 저장소 mockup-diff.mjs)과 같은 규약 — 한쪽만 바꾸면 사고 */
export const isBinary = (buf) => { const n = Math.min(buf.length, 8000); for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true; return false; };
export const sha = (buf) => createHash('sha256').update(Buffer.isBuffer(buf) && isBinary(buf) ? buf : Buffer.from(String(buf).replace(/\r\n/g, '\n'), 'utf8')).digest('hex');
export const posix = (p) => p.split('\\').join('/');
export const today = () => new Date().toISOString().slice(0, 10);
const scalar = (t, k) => ((t.match(new RegExp(`^${k}:\\s*([^#\\n]*?)\\s*(#.*)?$`, 'm')) || [])[1] || '').trim().replace(/^["']|["']$/g, '');

export function config(root) {
  const t = rd(join(root, 'mockup.yaml'));
  return { project: scalar(t, 'project') || '', viewport: scalar(t, 'viewport') || '1440x900', screensDir: scalar(t, 'screens_dir') || 'screens' };
}

/** rev.yaml 읽기 — { screen, title, rev, visual_status, confirmed, confirmed_by, files{html: sha}, raw } */
export function readRev(dir) {
  const t = rd(join(dir, 'rev.yaml')); if (!t) return null;
  const files = {}; for (const m of t.matchAll(/^  ([^:\n]+\.(?:html|md|css)):\s*([0-9a-f]{64})\s*$/gm)) files[m[1]] = m[2];
  const history = ((t.match(/^history:\n((?:  - [^\n]*\n?)*)/m) || [])[1] || '').split('\n').map((l) => l.replace(/^  - /, '')).filter(Boolean);
  return { history, screen: scalar(t, 'screen'), title: scalar(t, 'title'), rev: Number(scalar(t, 'rev')) || 0, visual_status: scalar(t, 'visual_status'), confirmed: scalar(t, 'confirmed'), confirmed_by: scalar(t, 'confirmed_by'), reopened: scalar(t, 'reopened'), files, raw: t };
}
export function writeRevText({ screen, title, rev, visual_status, confirmed = '', confirmed_by = '', reopened = '', files = {}, note = '', history = [] }) {
  const lines = ['# rev.yaml — 이 화면의 확정 스탬프 (정본). confirm.mjs가 쓴다 · 손 편집 금지. 확정 뒤 수정은 reopen → 고침 → confirm(rev+1)만. history는 누적 — rev마다 무엇이 들어갔나.',
    `screen: ${screen}`, `title: "${title.replace(/"/g, '\\"')}"`, `rev: ${rev}`, `visual_status: ${visual_status}`, `confirmed: ${confirmed}`, `confirmed_by: "${confirmed_by}"`, `reopened: ${reopened}`, 'files:'];
  for (const f of Object.keys(files).sort()) lines.push(`  ${f}: ${files[f]}`);
  if (history.length) lines.push('history:', ...history.map((h) => `  - ${h.replace(/\n/g, ' ')}`));
  if (note) lines.push('note: |', ...note.split('\n').map((l) => '  ' + l));
  return lines.join('\n') + '\n';
}
export const stateFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
/** 확정 대상 = 상태 HTML 전수 + 폴더 안 CSS + policy.md — 화면만 지문에 넣으면 정책이 rev 없이 바뀌고, CSS를 빼면 렌더가 rev 없이 바뀐다. 셋 다 reopen → 고침 → confirm(rev+1) */
export const confirmedFiles = (dir) => [...stateFiles(dir), ...readdirSync(dir).filter((f) => f.endsWith('.css')).sort(), ...(existsSync(join(dir, 'policy.md')) ? ['policy.md'] : [])];
export const hashStates = (dir) => Object.fromEntries(confirmedFiles(dir).map((f) => [f, sha(readFileSync(join(dir, f)))]));

/** 모든 화면 폴더 [{ id: "<모듈>/<화면>", path }] — rev.yaml이 있는 폴더 */
export function listScreens(root) {
  const base = join(root, config(root).screensDir); const out = [];
  if (!existsSync(base)) return out;
  for (const m of readdirSync(base, { withFileTypes: true })) { if (!m.isDirectory() || m.name.startsWith('_')) continue; for (const s of readdirSync(join(base, m.name), { withFileTypes: true })) if (s.isDirectory() && existsSync(join(base, m.name, s.name, 'rev.yaml'))) out.push({ id: `${m.name}/${s.name}`, path: join(base, m.name, s.name) }); }
  return out;
}

/** HTML이 참조하는 로컬 자산 경로(stylesheet·script·img·source·CSS url()) — 절대 URL·data:·#은 제외 */
export function assetRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/<(?:link|script|img|source|video|audio)\b[^>]*?\b(?:href|src)=["']([^"']+)["']/gi)) refs.add(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.add(m[1]);
  return [...refs].map((r) => r.split('#')[0].split('?')[0]).filter((r) => r && !/^(https?:|data:|\/\/|mailto:|javascript:)/i.test(r));
}
/** html 파일이 참조하는 자산 중 디스크에 없는 것 (CSS 안의 url()도 한 단계 따라간다) */
export function unresolvedAssets(htmlPath) {
  const dir = dirname(htmlPath); const missing = [];
  for (const r of assetRefs(rd(htmlPath))) {
    const p = resolve(dir, r);
    if (!existsSync(p)) { missing.push(r); continue; }
    if (/\.css$/i.test(p)) for (const u of assetRefs(rd(p))) if (!existsSync(resolve(dirname(p), u))) missing.push(`${r} → ${u}`);
  }
  return missing;
}
/** 결정성 위반 — 시드로 재현 불가한 값. 반환 [사유] */
export function nondeterminism(html) {
  const out = [];
  const body = html.replace(/<!--[\s\S]*?-->/g, '');
  if (/\b(new\s+Date|Date\.now|Math\.random|performance\.now)\s*\(/.test(body)) out.push('스크립트가 현재 시각·난수를 쓴다(new Date · Date.now · Math.random)');
  const rel = body.match(/(방금 전|초 전|분 전|시간 전|어제|그제|\bjust now\b|\bminutes? ago\b|\bhours? ago\b|\byesterday\b)/i);
  if (rel) out.push(`상대 시각 표현 "${rel[1]}" — 고정 날짜로`);
  const t = today(); if (body.includes(t) || body.includes(t.replace(/-/g, '.'))) out.push(`오늘 날짜(${t})가 박혀 있다 — 내일 깨진다. 고정 날짜로`);
  return out;
}
/** policy.md의 고정 7절 중 빠진 것 */
export const missingPolicySections = (md) => POLICY_SECTIONS.filter((s) => !new RegExp(`^##\\s*\\d*\\.?\\s*${s.replace(/[/]/g, '\\/')}`, 'm').test(md));
/** 7절 중 본문이 빈 것 — 제목만 있는 절은 "정한 것이 없다"가 아니라 "안 적었다"다. "해당 없음" 한 줄은 정한 것이므로 통과 */
export const emptyPolicySections = (md) => POLICY_SECTIONS.filter((s) => { const m = md.match(new RegExp(`^##\\s*\\d*\\.?\\s*${s.replace(/[/]/g, '\\/')}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm')); return m && !m[1].replace(/\([^)]*\)/g, '').trim(); });
/** §미결 표에서 개발을 막는데(영향 열에 "막음") 아직 열린(상태 열이 "닫힘·해결·결정"이 아닌) 행 — 이것이 있으면 확정하지 않는다(확정 뒤 개발이 착수했다가 재작업한다) */
export function openBlockingIssues(md) {
  const sec = (md.split(/^##\s*미결[^\n]*$/m)[1] || '').split(/^## /m)[0];
  return sec.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-|^\|\s*#\s*\|/.test(l)).map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length >= 5 && /막음/.test(c[3]) && !/닫힘|해결|결정/.test(c[4])).map((c) => c[2]);
}
/** 확정자 칸에 에이전트 모델명이 오면 거부 — 확정은 사람의 결정이다 */

/** 시험용 — 7절을 "해당 없음"으로 채운다(빈 절은 확정 거부). 실제 기획은 절마다 규칙을 적는다 */
export const fillPolicy = (dir) => { const p = join(dir, "policy.md"); const t = readFileSync(p, "utf8").replace(/^(##\s*\d\.\s*[^\n]+\n)(\([^)]*\)\n)?/gm, "$1해당 없음\n"); writeFileSync(p, t); };
export const AGENT_NAME_RE = /claude|gpt|codex|gemini|opus|sonnet|haiku|fable|o[1-9]\b|llama|mistral|deepseek|agent|에이전트/i;

export { join, resolve, relative, existsSync, statSync, readdirSync };
