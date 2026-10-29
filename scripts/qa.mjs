#!/usr/bin/env node
// qa.mjs — 검수 접수 (기획·검수자가 테스트 서버에서 써보다 발견한 것). 한 건 = 한 폴더 qa/QA-<YYMMDD>-<slug>/ — report.md(정본 · 기획 소유) + intake/(캡처·로그 원본) + resolution.md(개발 소유 · 개발 저장소 qa-intake.mjs가 쓴다)
//
//   new      <slug> "<증상 요약>" [--by "<이름>"] [--screen <모듈>/<화면>] [--server <주소>] [--capture <파일>]…   접수 — 검수자는 캡처·증상·되어야 할 모습만. 분류는 에이전트
//   classify <ID> <유형> "<근거>" [--by …]        유형: 오류 | 기획수정(UI) | 기획수정(정책) | 정책공백  — 판별 질문 셋(runbooks/qa-intake.md). 근거는 단서 그대로
//   decide   <ID> "<결정>"                         정책공백 — 사람 결정 기록
//   change   <ID> "<목업 rev 또는 policy 개정>"    기획수정 — 반영 근거(예: ds/list rev 3 · policy.md 2026-10-17 개정). 이것 없이는 닫히지 않는다
//   close    <ID> --by "<이름>" "<확인 방법>"      닫기 — 기획(보고자)만. 오류 건은 resolution.md가 resolved|verified여야 한다
//   reopen   <ID> "<사유>"                         여전히 재현
//   index                                          qa/INDEX.generated.md 생성(생성물)
// 상태(report.md state · 기획 소유): open → closed / reopened. 개발 쪽 진행은 resolution.md state(taken → resolved → verified)로 — 서로의 파일을 고치지 않는다.
// 유형이 처리 경로를 정한다: 오류 → 개발 저장소가 가져가 고친다 · 기획수정 → 이 저장소에서 목업 rev+1 / policy 개정 · 정책공백 → 결정 후 셋 중 하나. 기획수정을 개발 경로로 보내지 않는다.
import { cpSync, mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rd, today, posix } from './lib/mockup.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TYPES = ['미정', '오류', '기획수정(UI)', '기획수정(정책)', '정책공백'];
export const STATES = ['open', 'closed', 'reopened'];
export const RES_STATES = ['taken', 'resolved', 'verified'];
const fm = (t) => (t.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || '';
export const field = (t, k) => ((fm(t).match(new RegExp(`^${k}:\\s*(.*)$`, 'm')) || [])[1] || '').trim().replace(/^"(.*)"$/, '$1');
export function setField(t, k, v) {
  const head = fm(t); const line = `${k}: ${/[:#"]|^\s*$/.test(v) ? JSON.stringify(v) : v}`;
  const next = new RegExp(`^${k}:.*$`, 'm').test(head) ? head.replace(new RegExp(`^${k}:.*$`, 'm'), line) : head + '\n' + line;
  return t.replace(head, next);
}
const stamp = (name) => `${today().slice(2).replace(/-/g, '')}`;
export const qaDir = (root) => join(root, 'qa');
export function listQa(root) { const d = qaDir(root); return existsSync(d) ? readdirSync(d).filter((n) => /^QA-\d{6}-[a-z0-9-]+$/.test(n) && existsSync(join(d, n, 'report.md'))).sort().map((n) => ({ id: n, path: join(d, n), report: rd(join(d, n, 'report.md')), resolution: rd(join(d, n, 'resolution.md')) })) : []; }
const find = (root, id) => { const q = listQa(root).find((x) => x.id === id); if (!q) throw new Error(`접수 건이 없다: ${id}`); return q; };
const save = (q, t) => writeFileSync(join(q.path, 'report.md'), t);
const log = (t, line) => t.replace(/\n## 기록\n[\s\S]*$/, (m) => m.replace(/\n$/, '') + `\n| ${today()} | ${line} |\n`);

export function create(root, slug, title, { by = '(이름 없음)', screen = '', server = '', captures = [] } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) throw new Error(`slug는 영문 소문자·숫자·하이픈: ${slug}`);
  if (!title) throw new Error('증상 요약이 필요하다');
  const id = `QA-${stamp()}-${slug}`; const dir = join(qaDir(root), id);
  if (existsSync(dir)) throw new Error(`이미 있다: ${id}`);
  mkdirSync(join(dir, 'intake'), { recursive: true });
  const caps = [];
  for (const c of captures) { const src = resolve(c); if (!existsSync(src)) throw new Error(`캡처 파일이 없다: ${c}`); cpSync(src, join(dir, 'intake', basename(src))); caps.push(`intake/${basename(src)}`); }
  writeFileSync(join(dir, 'report.md'), `---
id: ${id}
state: open
type: 미정
screen: ${screen}
reporter: "${by}"
reported: ${today()}
server: "${server}"
classified_by: ""
basis: ""
decision: ""
change: ""
closed: ""
captures: [${caps.join(', ')}]
---

# ${id} · ${title}

> 검수자는 사실만 낸다(캡처 · 무엇을 했나 · 무엇이 나왔나 · 되어야 할 모습). 유형·담당은 에이전트가 \`qa.mjs classify\`로 정하고 근거를 남긴다. 틀렸으면 다시 classify.

## 무엇을 했나 (재현 절차)

1.

## 무엇이 나왔나

>

## 되어야 할 모습 ★ (보고자의 말 그대로 — 번역하지 않는다)

>

## 분류 근거

## 결정 (정책공백일 때 — 사람)

## 처리 (개발 쪽 — \`resolution.md\`가 정본 · 이 절은 비워 둔다)

## 기록

| 날짜 | 내용 |
|---|---|
| ${today()} | 접수 (${by}) |
`);
  return { id, path: dir, captures: caps };
}
export function classify(root, id, type, basis, { by = '(이름 없음)' } = {}) {
  if (!TYPES.includes(type) || type === '미정') throw new Error(`유형은 ${TYPES.slice(1).join(' | ')}: ${type}`);
  if (!basis) throw new Error('근거가 필요하다 — 단서(화면 주소·캡처 속 표시·콘솔 경로·기획의 어느 절)를 그대로');
  const q = find(root, id); let t = q.report;
  t = setField(setField(setField(t, 'type', type), 'classified_by', by), 'basis', basis);
  t = t.replace(/## 분류 근거\n/, `## 분류 근거\n\n- ${today()} · ${by} · **${type}** — ${basis}\n`);
  save(q, log(t, `분류 ${type} (${by})`));
  const route = { '오류': '개발 저장소가 가져간다(qa-intake.mjs pull) — 고치고 리뷰어가 verified로 올리면 기획이 테스트 서버에서 확인 후 close', '기획수정(UI)': '이 저장소에서 목업 reopen → 고침 → confirm(rev+1) → qa.mjs change <ID> "<모듈>/<화면> rev N" → 개발이 재승격·구현 → close', '기획수정(정책)': '이 저장소에서 목업 reopen → policy.md 개정 → confirm(rev+1) → qa.mjs change <ID> "<모듈>/<화면> rev N" → 개발이 재승격·구현 → close', '정책공백': '사람 결정을 기다린다 → qa.mjs decide <ID> "<결정>" → 결정에 따라 다시 classify' }[type];
  return { id, type, next: route };
}
export function decide(root, id, decision) { const q = find(root, id); if (field(q.report, 'type') !== '정책공백') throw new Error(`${id}는 정책공백이 아니다(${field(q.report, 'type')})`); if (!decision) throw new Error('결정 내용이 필요하다'); let t = setField(q.report, 'decision', decision); t = t.replace(/## 결정 \(정책공백일 때 — 사람\)\n/, `## 결정 (정책공백일 때 — 사람)\n\n- ${today()} · ${decision}\n`); save(q, log(t, `결정: ${decision}`)); return { id }; }
export function change(root, id, ref) { const q = find(root, id); if (!/^기획수정/.test(field(q.report, 'type'))) throw new Error(`${id}는 기획수정 건이 아니다(${field(q.report, 'type')})`); if (!ref) throw new Error('반영 근거(목업 rev 또는 policy 개정)가 필요하다'); save(q, log(setField(q.report, 'change', ref), `기획 반영: ${ref}`)); return { id }; }
export function close(root, id, { by, how } = {}) {
  const q = find(root, id); const type = field(q.report, 'type'); const st = field(q.report, 'state');
  if (!by || !how) throw new Error('--by "<이름>" "<확인 방법>" — 닫기는 사람(보고자)의 확인 기록이다');
  if (st === 'closed') throw new Error(`${id}는 이미 closed`);
  if (type === '미정') throw new Error('분류 없이 닫지 않는다 — classify 먼저');
  if (/^기획수정/.test(type) && !field(q.report, 'change')) throw new Error('기획수정 건은 반영 근거(change) 없이 닫히지 않는다 — 기획 없이 화면·정책이 바뀌는 것을 막는 유일한 장치');
  if (type === '정책공백' && !field(q.report, 'decision')) throw new Error('정책공백 건은 결정(decide) 없이 닫히지 않는다');
  if (type === '오류') { const rs = field(q.resolution, 'state'); if (!['resolved', 'verified'].includes(rs)) throw new Error(`오류 건은 개발 쪽 resolution.md가 resolved|verified여야 닫는다 (지금 ${rs || '없음'})`); }
  save(q, log(setField(setField(q.report, 'state', 'closed'), 'closed', `${today()} · ${by} · ${how}`), `닫힘 (${by}: ${how})`));
  return { id, type };
}
export function reopen(root, id, reason) { const q = find(root, id); if (!reason) throw new Error('사유가 필요하다'); if (field(q.report, 'state') !== 'closed') throw new Error(`${id}는 closed가 아니다`); save(q, log(setField(setField(q.report, 'state', 'reopened'), 'closed', ''), `재열림: ${reason}`)); return { id }; }

/** 게이트 — validate.mjs가 부른다. 반환 [문제] */
export function validateQa(root) {
  const p = []; const DEV = /\b(FDR|ADR|RFC|PLAN|PG|HR|BL|INC|HO|RETRO)-\d{6}-[a-z0-9-]+|docs\/(features|decisions|research|handoffs|records|queue|specs)\//;
  const d = qaDir(root);
  if (existsSync(d)) for (const n of readdirSync(d)) if (/^QA-/.test(n) && !existsSync(join(d, n, 'report.md'))) p.push(`${n}: report.md 없음`);
  for (const q of listQa(root)) {
    const id = field(q.report, 'id'), st = field(q.report, 'state'), type = field(q.report, 'type');
    if (id !== q.id) p.push(`${q.id}: report.md id(${id})가 폴더와 다르다`);
    if (!STATES.includes(st)) p.push(`${q.id}: state(${st})는 ${STATES.join('|')}`);
    if (!TYPES.includes(type)) p.push(`${q.id}: type(${type})는 ${TYPES.join('|')}`);
    if (st === 'closed') { if (!field(q.report, 'closed')) p.push(`${q.id}: closed인데 확인 기록(closed: 날짜·이름·방법) 없음`); if (type === '미정') p.push(`${q.id}: 분류 없이 closed`); if (/^기획수정/.test(type) && !field(q.report, 'change')) p.push(`${q.id}: 기획수정 건이 반영 근거(change) 없이 closed`); if (type === '정책공백' && !field(q.report, 'decision')) p.push(`${q.id}: 정책공백 건이 결정 없이 closed`); if (type === '오류' && !['resolved', 'verified'].includes(field(q.resolution, 'state'))) p.push(`${q.id}: 오류 건이 resolution(resolved|verified) 없이 closed`); }
    if (type !== '미정' && !field(q.report, 'basis')) p.push(`${q.id}: 분류 근거(basis) 없음`);
    for (const c of (field(q.report, 'captures').replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean))) if (!existsSync(join(q.path, c))) p.push(`${q.id}: 캡처 ${c} 없음`);
    const dm = q.report.match(DEV); if (dm) p.push(`${q.id}: report.md에 개발 저장소 표식(${dm[0]}) — 접수는 개발 저장소를 모른다(개발 쪽 기록은 resolution.md)`);
    if (q.resolution) { const rs = field(q.resolution, 'state'); if (!RES_STATES.includes(rs)) p.push(`${q.id}: resolution.md state(${rs})는 ${RES_STATES.join('|')}`); if (rs === 'verified' && field(q.resolution, 'verified_by') && field(q.resolution, 'verified_by') === field(q.resolution, 'by')) p.push(`${q.id}: 고친 쪽이 자기 검증자 — verified_by가 by와 같다`); }
  }
  return p;
}
export function index(root) {
  const rows = listQa(root).map((q) => ({ id: q.id, state: field(q.report, 'state'), type: field(q.report, 'type'), screen: field(q.report, 'screen'), res: field(q.resolution, 'state') || '-', title: (q.report.match(/^# [^·\n]+· (.+)$/m) || [])[1] || '' }));
  const open = rows.filter((r) => r.state !== 'closed');
  let out = `<!-- 생성물: node scripts/qa.mjs index · ${today()} · 손으로 편집하지 않는다 -->\n# 검수 접수 현황\n\n열림 ${open.length} / 전체 ${rows.length}\n\n## 사람 할 일\n\n`;
  const todo = open.filter((r) => r.type === '미정' || r.type === '정책공백' || r.res === 'verified');
  out += todo.length ? todo.map((r) => `- ${r.id} — ${r.type === '미정' ? '분류 대기' : r.type === '정책공백' ? '결정 대기' : '확인 후 닫기(개발 verified)'} · ${r.title}`).join('\n') + '\n' : '- 없음\n';
  out += `\n## 전체\n\n| ID | 상태 | 유형 | 화면 | 개발 | 제목 |\n|---|---|---|---|---|---|\n` + rows.map((r) => `| [${r.id}](${r.id}/report.md) | ${r.state} | ${r.type} | ${r.screen} | ${r.res} | ${r.title} |`).join('\n') + '\n';
  mkdirSync(qaDir(root), { recursive: true }); writeFileSync(join(qaDir(root), 'INDEX.generated.md'), out); return rows.length;
}

const IS_MAIN = process.argv[1] && /qa\.mjs$/.test(process.argv[1]);
if (IS_MAIN && process.argv.includes('--self-test')) {
  const { rmSync } = await import('node:fs');
  const tmp = join(ROOT, '.qa-selftest'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true }); writeFileSync(join(tmp, 'cap.png'), 'png');
  const fails = [];
  try {
    const a = create(tmp, 'login-500', '로그인하면 500', { by: 'kim', screen: 'auth/login', captures: [join(tmp, 'cap.png')] });
    if (!existsSync(join(a.path, 'intake', 'cap.png')) || field(rd(join(a.path, 'report.md')), 'state') !== 'open' || !/captures: \[intake\/cap\.png\]/.test(rd(join(a.path, 'report.md')))) fails.push('접수');
    try { close(tmp, a.id, { by: 'kim', how: 'x' }); fails.push('미정 닫기 통과'); } catch { /* 기대 */ }
    try { classify(tmp, a.id, '오류', ''); fails.push('근거 없는 분류 통과'); } catch { /* 기대 */ }
    classify(tmp, a.id, '오류', '콘솔 500 /api/login', { by: 'agent' });
    try { close(tmp, a.id, { by: 'kim', how: '재현 안 됨' }); fails.push('resolution 없는 오류 닫기 통과'); } catch { /* 기대 */ }
    writeFileSync(join(a.path, 'resolution.md'), '---\nid: ' + a.id + '\nstate: verified\nby: "dev"\nverified_by: "reviewer"\n---\n');
    close(tmp, a.id, { by: 'kim', how: '테스트 서버에서 로그인 성공' }); if (field(rd(join(a.path, 'report.md')), 'state') !== 'closed') fails.push('닫기');
    reopen(tmp, a.id, '여전히 재현'); if (field(rd(join(a.path, 'report.md')), 'state') !== 'reopened') fails.push('재열림');
    const b = create(tmp, 'btn-color', '버튼 색을 바꾸고 싶다', { by: 'kim' }); classify(tmp, b.id, '기획수정(UI)', '기획 §3 답대로 동작, 바꾸고 싶음', { by: 'agent' });
    try { close(tmp, b.id, { by: 'kim', how: 'x' }); fails.push('change 없는 기획수정 닫기 통과'); } catch { /* 기대 */ }
    change(tmp, b.id, 'auth/login rev 2'); close(tmp, b.id, { by: 'kim', how: '목업 rev 2 확인' });
    const c = create(tmp, 'no-rule', '중복 이름 허용?', { by: 'kim' }); classify(tmp, c.id, '정책공백', 'policy §5에 없음', { by: 'agent' });
    try { close(tmp, c.id, { by: 'kim', how: 'x' }); fails.push('결정 없는 정책공백 닫기 통과'); } catch { /* 기대 */ }
    decide(tmp, c.id, '허용하지 않는다'); try { decide(tmp, b.id, 'x'); fails.push('기획수정에 decide 통과'); } catch { /* 기대 */ }
    if (validateQa(tmp).length) fails.push('양성 오탐: ' + validateQa(tmp).join(' | '));
    // 게이트 부정 — 수기 조작
    const bad = rd(join(b.path, 'report.md')).replace(/^change:.*$/m, 'change: ""'); writeFileSync(join(b.path, 'report.md'), bad); if (!validateQa(tmp).some((x) => /반영 근거\(change\) 없이 closed/.test(x))) fails.push('change 제거 미검출');
    writeFileSync(join(a.path, 'report.md'), rd(join(a.path, 'report.md')) + '\n개발 FDR-261017-x 참고\n'); if (!validateQa(tmp).some((x) => /개발 저장소 표식/.test(x))) fails.push('개발 표식 미검출');
    writeFileSync(join(a.path, 'resolution.md'), '---\nstate: verified\nby: "dev"\nverified_by: "dev"\n---\n'); if (!validateQa(tmp).some((x) => /자기 검증자/.test(x))) fails.push('자기 검증 미검출');
    if (index(tmp) !== 3 || !/결정 대기|확인 후 닫기|분류 대기|없음/.test(rd(join(tmp, 'qa', 'INDEX.generated.md')))) fails.push('index');
  } catch (e) { fails.push('예외: ' + e.stack.split('\n').slice(0, 2).join(' ')); }
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails.length ? 'self-test FAIL: ' + fails.join(' · ') : 'self-test OK (접수·분류·닫기 조건 4종·재열림·기획수정 change·정책공백 decide · 게이트 부정 3 · index)');
  process.exit(fails.length ? 1 : 0);
}
if (IS_MAIN && !process.argv.includes('--self-test')) {
  const argv = process.argv.slice(2); const [cmd, a, b, c] = argv; const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined); const all = (f) => argv.filter((x, i) => argv[i - 1] === f);
  try {
    if (cmd === 'new') { const r = create(ROOT, a, b, { by: opt('--by'), screen: opt('--screen'), server: opt('--server'), captures: all('--capture') }); console.log(`${r.id} 접수 → ${posix(r.path)}\nreport.md의 「무엇을 했나·무엇이 나왔나·되어야 할 모습」을 보고자의 말 그대로 채운 뒤 분류: node scripts/qa.mjs classify ${r.id} <유형> "<근거>"`); }
    else if (cmd === 'classify') { const r = classify(ROOT, a, b, c, { by: opt('--by') }); console.log(`${r.id}: ${r.type}\n다음: ${r.next}`); }
    else if (cmd === 'decide') { decide(ROOT, a, b); console.log(`${a}: 결정 기록 — 결정에 맞춰 다시 classify`); }
    else if (cmd === 'change') { change(ROOT, a, b); console.log(`${a}: 기획 반영 근거 기록 — 테스트 서버 확인 후 close`); }
    else if (cmd === 'close') { const r = close(ROOT, a, { by: opt('--by'), how: argv.filter((x, i) => i > 0 && argv[i - 1] !== '--by' && x !== '--by' && x !== a && x !== cmd)[0] }); console.log(`${r.id} 닫힘 (${r.type})`); }
    else if (cmd === 'reopen') { reopen(ROOT, a, b); console.log(`${a} 재열림`); }
    else if (cmd === 'index') { console.log(`qa/INDEX.generated.md (${index(ROOT)}건)`); }
    else { console.error('사용: node scripts/qa.mjs new <slug> "<증상 요약>" [--by …] [--screen m/s] [--server …] [--capture f]… | classify <ID> <유형> "<근거>" | decide <ID> "<결정>" | change <ID> "<반영 근거>" | close <ID> --by "<이름>" "<확인 방법>" | reopen <ID> "<사유>" | index'); process.exit(2); }
    if (cmd !== 'index') index(ROOT);
  } catch (e) { console.error(e.message); process.exit(1); }
}
