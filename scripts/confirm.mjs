#!/usr/bin/env node
// confirm.mjs — 화면 확정·재개. 확정은 사람의 결정이고 이 스크립트는 그 결정을 rev.yaml에 스탬프한다(rev+1 · 상태 파일별 sha256).
// 사용: node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>" [--note "<이번 rev에 들어간 것>"]   확정 (validate 통과가 전제 — 실패하면 확정하지 않는다 · ready 선언 뒤 바뀐 파일이 있으면 거부). history에 한 줄 누적
//       node scripts/confirm.mjs <모듈>/<화면> --reopen "<사유>"          확정본을 고치기 위해 연다(visual_status: reopened). 고친 뒤 다시 confirm → rev+1
//       node scripts/confirm.mjs <모듈>/<화면> --ready                     사람 확정 요청 상태(ready)로 표시 — 이 시점의 파일을 지문으로 고정(선언 뒤 고치면 validate가 막는다 · 고쳤으면 --ready 다시)
// 확정된 화면의 html·policy.md를 reopen 없이 고치면 validate(pre-commit)가 막는다 — "확정 후 수정은 rev+1 재확정만". 정책도 지문 대상 — 화면만 잠그면 규칙이 rev 없이 바뀐다.
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, existsSync, join, readRev, writeRevText, hashStates, today, rd, missingPolicySections, emptyPolicySections, fillPolicy, assetsSha, openBlockingIssues, AGENT_NAME_RE, stateFiles, unresolvedAssets, nondeterminism } from './lib/mockup.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 확정 전 검사 — 반환 [] = 확정 가능 */
export function preflight(dir) {
  const p = [];
  const files = stateFiles(dir);
  if (!files.length) p.push('상태 파일(*.html)이 없다');
  for (const f of files) { const miss = unresolvedAssets(join(dir, f)); if (miss.length) p.push(`${f}: 자산 참조가 열리지 않는다 — ${miss.join(', ')}`); for (const n of nondeterminism(rd(join(dir, f)))) p.push(`${f}: ${n}`); }
  const pol = rd(join(dir, 'policy.md'));
  const ms = missingPolicySections(pol); if (ms.length) p.push(`policy.md 절 누락: ${ms.join('·')}`);
  const es = emptyPolicySections(pol); if (es.length) p.push(`policy.md 절이 비어 있다: ${es.join('·')} — 정한 것이 없으면 "해당 없음"이라 적는다(비워 둔 것과 없다고 정한 것은 다르다)`);
  const ob = openBlockingIssues(pol); if (ob.length) p.push(`§미결에 개발을 막는 열린 질문: ${ob.join(' / ')} — 닫거나(상태: 닫힘) 영향을 "막음"이 아닌 것으로 고친 뒤 확정`);
  return p;
}

export function confirm(root, id, { by, reopen, ready, note = '' } = {}) {
  const dir = join(root, config(root).screensDir, id);
  const rev = readRev(dir); if (!rev) throw new Error(`화면이 없다: ${id} (rev.yaml 없음 — new-screen.mjs로 만든다)`);
  if (reopen) {
    if (rev.visual_status !== 'confirmed') throw new Error(`${id}는 confirmed가 아니라 ${rev.visual_status} — reopen 대상이 아니다`);
    writeFileSync(join(dir, 'rev.yaml'), writeRevText({ ...rev, visual_status: 'reopened', reopened: today(), note: `rev ${rev.rev} 재개: ${reopen}`, history: [...rev.history, `rev ${rev.rev} reopened ${today()} — ${reopen}`] }));
    return { id, rev: rev.rev, visual_status: 'reopened' };
  }
  if (ready) { writeFileSync(join(dir, 'rev.yaml'), writeRevText({ ...rev, visual_status: 'ready', files: hashStates(dir), assets_sha: assetsSha(root) })); return { id, rev: rev.rev, visual_status: 'ready', files: Object.keys(hashStates(dir)).length }; }   // 손 뗌 선언 = 이 시점의 지문 고정. 선언 뒤 고치면 validate가 막는다(고쳤으면 --ready 다시). 확정자는 자기가 본 그 파일을 확정한다
  if (!by) throw new Error('--by "<확정자>"가 필요하다 — 확정은 사람의 결정이다');
  if (AGENT_NAME_RE.test(by)) throw new Error(`--by "${by}" — 에이전트 이름으로는 확정하지 않는다. 확정은 사람의 결정이다; 사람 이름으로`);
  const problems = preflight(dir); if (problems.length) throw new Error(`확정 불가 — 먼저 고친다:\n- ${problems.join('\n- ')}`);
  if (rev.visual_status === 'ready') {   // 확정자는 ready 선언 때 본 그 파일을 확정한다 — 선언 뒤 바뀐 파일을 재해시해 확정하면 '본 것'과 '확정된 것'이 갈린다
    const now = hashStates(dir); const diff = [...new Set([...Object.keys(rev.files), ...Object.keys(now)])].filter((f) => rev.files[f] !== now[f]);
    if (diff.length) throw new Error(`확정 불가 — ready 선언 뒤 바뀐 파일: ${diff.join(', ')}. 담당자가 confirm.mjs --ready를 다시 해서 지문을 고정한 뒤 확정`);
  }
  const next = rev.rev + 1;
  writeFileSync(join(dir, 'rev.yaml'), writeRevText({ screen: rev.screen, title: rev.title, rev: next, visual_status: 'confirmed', confirmed: today(), confirmed_by: by, files: hashStates(dir), assets_sha: assetsSha(root), history: [...rev.history, `rev ${next} confirmed ${today()} ${by}${note ? ' — ' + note : ''}`] }));
  return { id, rev: next, visual_status: 'confirmed', files: Object.keys(hashStates(dir)).length };
}

if (process.argv.includes('--self-test') && /confirm.mjs$/.test(process.argv[1] || '')) {
  const { rmSync, mkdirSync } = await import('node:fs');
  const { create } = await import('./new-screen.mjs');
  const tmp = join(ROOT, '.confirm-selftest'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'mockup.yaml'), 'project: t\n'); mkdirSync(join(tmp, 'screens', '_assets'), { recursive: true }); writeFileSync(join(tmp, 'screens', '_assets', 'tokens.css'), ''); writeFileSync(join(tmp, 'screens', '_assets', 'components.css'), '');
  const fails = [];
  try {
    const s = create(tmp, 'm', 's', '제목');
    try { confirm(tmp, 'm/s', { by: 'cto' }); fails.push('빈 절 확정 통과'); } catch (e) { if (!/절이 비어 있다/.test(e.message)) fails.push('빈 절 사유: ' + e.message); }
    try { confirm(tmp, 'm/s', { by: 'Leo1' }); fails.push('빈 절인데 Leo1 통과'); } catch (e) { if (/에이전트 이름/.test(e.message)) fails.push('사람 이름 Leo1을 에이전트로 오판'); }   // o[1-9]는 낱말 경계 안에서만 — 거부 사유는 빈 절이어야 한다
    fillPolicy(s.path);
    writeFileSync(join(s.path, "policy.md"), rd(join(s.path, "policy.md")) + "| 1 | 결제 대행사? | 막음 | 열림 |\n");
    try { confirm(tmp, 'm/s', { by: 'cto' }); fails.push('막는 미결 확정 통과'); } catch (e) { if (!/개발을 막는 열린 질문: 결제 대행사?/.test(e.message)) fails.push('막는 미결 사유: ' + e.message); }
    for (const st of ['미결정', '결정 대기', '미해결']) { writeFileSync(join(s.path, 'policy.md'), rd(join(s.path, 'policy.md')).replace(/\| 막음 \| [^|]*\|/, `| 막음 | ${st} |`)); try { confirm(tmp, 'm/s', { by: 'cto' }); fails.push(`상태 "${st}"를 닫힘으로 봄`); } catch (e) { if (!/개발을 막는 열린 질문/.test(e.message)) fails.push(`상태 "${st}" 사유: ` + e.message); } }   // "미결정"·"결정 대기"는 열린 것 — 앞 글자 일치로 닫힘 오판 금지(리뷰 지적)
    writeFileSync(join(s.path, 'policy.md'), rd(join(s.path, 'policy.md')).replace(/\| 막음 \| [^|]*\|/, '| 막음 | 닫힘(토스) |'));
    try { confirm(tmp, 'm/s', { by: 'claude-opus-5-5' }); fails.push('에이전트 이름 확정 통과'); } catch (e) { if (!/에이전트 이름으로는 확정하지 않는다/.test(e.message)) fails.push('에이전트 거부 사유: ' + e.message); }
    try { confirm(tmp, 'm/s', {}); fails.push('--by 없이 통과'); } catch { /* 기대 */ }
    writeFileSync(join(s.path, '02-empty.html'), '<html><head><link rel="stylesheet" href="./nope.css"></head><body>3분 전</body></html>');
    try { confirm(tmp, 'm/s', { by: 'cto' }); fails.push('자산 미해석·비결정 통과'); } catch (e) { if (!/nope\.css/.test(e.message) || !/분 전/.test(e.message)) fails.push('preflight 사유 누락: ' + e.message); }
    writeFileSync(join(s.path, '02-empty.html'), '<html><head><link rel="stylesheet" href="../../_assets/tokens.css"></head><body>2026-01-01</body></html>');
    const c = confirm(tmp, 'm/s', { by: 'cto' }); const r1 = readRev(s.path);
    if (c.rev !== 1 || r1.visual_status !== 'confirmed' || r1.confirmed_by !== 'cto' || Object.keys(r1.files).length !== 4 || !r1.files['policy.md'] || !r1.files['_screen.css']) fails.push('확정 rev1(html 2 + css + policy.md)');
    if (r1.history.length !== 1 || !/^rev 1 confirmed \d{4}-\d{2}-\d{2} cto$/.test(r1.history[0])) fails.push('history rev1: ' + JSON.stringify(r1.history));
    try { const rr = confirm(tmp, 'm/s', { ready: true }); if (rr.files !== 4 || Object.keys(readRev(s.path).files).length !== 4) fails.push('ready가 지문을 고정하지 않음'); } catch { fails.push('ready 전환'); }
    writeFileSync(join(s.path, '_screen.css'), '/* ready 뒤 */\n');   // 선언 뒤 바뀜 → 확정 거부 · --ready 다시 → 확정
    try { confirm(tmp, 'm/s', { by: 'cto' }); fails.push('ready 뒤 바뀐 파일을 확정'); } catch (e) { if (!/ready 선언 뒤 바뀐 파일: _screen\.css/.test(e.message)) fails.push('ready 대조 사유: ' + e.message); }
    confirm(tmp, 'm/s', { ready: true });
    confirm(tmp, 'm/s', { by: 'cto', note: '빈 상태 추가' }); if (readRev(s.path).rev !== 2) fails.push('재확정 rev2');
    if (readRev(s.path).history.length !== 2 || !/rev 2 confirmed .* cto — 빈 상태 추가$/.test(readRev(s.path).history[1])) fails.push('history 누적·note: ' + JSON.stringify(readRev(s.path).history));
    try { confirm(tmp, 'm/s', { reopen: 'x' }); } catch (e) { fails.push('reopen: ' + e.message); }
    if (readRev(s.path).visual_status !== 'reopened' || !/재개: x/.test(readRev(s.path).raw)) fails.push('reopened 표기');
    if (readRev(s.path).history.length !== 3 || !/rev 2 reopened .* — x$/.test(readRev(s.path).history[2])) fails.push('history reopen 줄');
    try { confirm(tmp, 'm/s', { reopen: 'y' }); fails.push('reopened 재reopen 통과'); } catch { /* 기대 */ }
    try { confirm(tmp, 'm/none', { by: 'cto' }); fails.push('없는 화면 통과'); } catch { /* 기대 */ }
  } catch (e) { fails.push('예외: ' + e.message); }
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails.length ? 'self-test FAIL: ' + fails.join(' · ') : 'self-test OK (preflight 거부 · 빈 절·막는 미결·에이전트 이름 거부 · 확정 rev1→2(html·css·policy 지문) · ready 지문 고정·선언 뒤 변경 확정 거부 · history 누적·note · reopen · 거부 3)');
  process.exit(fails.length ? 1 : 0);
}
if (process.argv[1] && /confirm\.mjs$/.test(process.argv[1]) && !process.argv.includes('--self-test')) {
  const argv = process.argv.slice(2); const id = argv[0]; const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  try { const r = confirm(ROOT, id, { by: opt('--by'), reopen: opt('--reopen'), ready: argv.includes('--ready'), note: opt('--note') || '' }); console.log(`${r.id}: rev ${r.rev} · ${r.visual_status}${r.files ? ` · 상태 ${r.files}개 스탬프` : ''}${r.visual_status === 'confirmed' ? '\n커밋하라. 개발 저장소에서 node .harness/scripts/mockup-diff.mjs promote <FDR-ID> ' + r.id : ''}`); }
  catch (e) { console.error(e.message + '\n사용: node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>" | --reopen "<사유>" | --ready'); process.exit(2); }
}
