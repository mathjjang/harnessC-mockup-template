#!/usr/bin/env node
// validate.mjs — 목업 저장소 게이트 (pre-commit · CI · 세션 시작). 종료코드 1 = 위반. 우회 플래그 없음.
// 검사: ① rev.yaml 스키마(screen·rev·visual_status) ② 확정본 불변 — confirmed 화면의 html sha256이 rev.yaml files와 같은가(수정하려면 confirm.mjs --reopen)
//       ③ 상태 파일 이름 NN-slug.html ④ 자산 참조가 디스크에서 열리는가(무스타일 목업 차단) ⑤ 결정성 — 현재 시각·난수·상대 시각·오늘 날짜 금지(confirmed·ready만 차단, draft는 경고)
//       ⑥ policy.md 고정 7절(confirmed·ready) ⑦ 화면 폴더에 rev.yaml·policy.md가 있는가 ⑧ 개발 저장소 내용(FDR-·ADR-·docs/features/ …)을 쓰지 않았는가 — 의존은 개발→목업 한 방향
// 검사하지 않는 것: 디자인의 타당성·요구사항 일치 — 사람 확정의 몫. --self-test: 위반 표본에서 각 검사가 잡히는지.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, existsSync, join, readdirSync, readRev, rd, sha, confirmedFiles, STATUSES, STATE_RE, stateFiles, unresolvedAssets, nondeterminism, missingPolicySections, listScreens, posix, relative } from './lib/mockup.mjs';
import { readFileSync } from 'node:fs';
import { validateQa } from './qa.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_MARK_RE = /\b(FDR|ADR|RFC|PLAN|PG|QA|HR|BL|INC|HO|RETRO)-\d{6}-[a-z0-9-]+|docs\/(features|decisions|research|handoffs|records|queue|specs)\//;

export function validate(root) {
  const problems = [], warnings = [];
  const base = join(root, config(root).screensDir);
  if (existsSync(base)) for (const m of readdirSync(base, { withFileTypes: true })) { if (!m.isDirectory() || m.name.startsWith('_')) continue; for (const s of readdirSync(join(base, m.name), { withFileTypes: true })) if (s.isDirectory() && !existsSync(join(base, m.name, s.name, 'rev.yaml'))) problems.push(`${m.name}/${s.name}: rev.yaml 없음 — new-screen.mjs로 만든 폴더만 화면이다`); }
  for (const sc of listScreens(root)) {
    const rev = readRev(sc.path); const tag = sc.id;
    if (rev.screen !== sc.id) problems.push(`${tag}: rev.yaml screen(${rev.screen})이 폴더와 다르다`);
    if (!STATUSES.includes(rev.visual_status)) problems.push(`${tag}: visual_status(${rev.visual_status || '없음'})는 ${STATUSES.join('|')}`);
    if (!Number.isInteger(rev.rev) || rev.rev < 0) problems.push(`${tag}: rev가 정수가 아니다`);
    if (!existsSync(join(sc.path, 'policy.md'))) problems.push(`${tag}: policy.md 없음`);
    const files = stateFiles(sc.path);
    for (const f of files) if (!STATE_RE.test(f)) problems.push(`${tag}: 상태 파일 이름은 NN-slug.html — ${f}`);
    const strict = ['confirmed', 'ready'].includes(rev.visual_status);
    if (rev.visual_status === 'confirmed' && !rev.confirmed_by) problems.push(`${tag}: confirmed인데 confirmed_by 없음`);
    if (strict) {   // confirmed·ready 모두 지문 대조 — ready는 "손 뗐다" 선언이라 그 뒤 고치면 확정자가 헛것을 확정한다
      const fix = rev.visual_status === 'confirmed' ? 'confirm.mjs --reopen "<사유>" → 고침 → confirm(rev+1)' : 'confirm.mjs --ready 다시(지문 재고정)';
      for (const f of confirmedFiles(sc.path)) { if (!rev.files[f]) problems.push(`${tag}: ${f}는 rev ${rev.rev} ${rev.visual_status} 뒤 추가됐다 — ${fix}`); else if (sha(readFileSync(join(sc.path, f))) !== rev.files[f]) problems.push(`${tag}: ${f}가 rev ${rev.rev} ${rev.visual_status === 'confirmed' ? '확정본' : 'ready 선언본'}과 다르다 — ${rev.visual_status === 'confirmed' ? '확정 후 수정은 ' + fix + '만' : fix}`); }
      for (const f of Object.keys(rev.files)) if (!confirmedFiles(sc.path).includes(f)) problems.push(`${tag}: ${rev.visual_status} 파일 ${f}가 사라졌다 — ${fix}`);
    }
    for (const f of files) {
      const miss = unresolvedAssets(join(sc.path, f)); if (miss.length) problems.push(`${tag}: ${f} 자산 참조가 열리지 않는다(무스타일) — ${miss.join(', ')}`);
      const html = rd(join(sc.path, f));
      for (const n of nondeterminism(html)) (strict ? problems : warnings).push(`${tag}: ${f} ${n}`);
      const dm = html.match(DEV_MARK_RE); if (dm) problems.push(`${tag}: ${f}에 개발 저장소 표식(${dm[0]}) — 목업은 개발 저장소를 모른다`);
    }
    const pol = rd(join(sc.path, 'policy.md')); const ms = missingPolicySections(pol); if (ms.length) (strict ? problems : warnings).push(`${tag}: policy.md 절 누락 ${ms.join('·')}`);
    const dm = pol.match(DEV_MARK_RE); if (dm) problems.push(`${tag}: policy.md에 개발 저장소 표식(${dm[0]})`);
  }
  // ⑨ 검수 접수(qa/) — 스키마·닫기 조건(확인 기록 · 기획수정은 change · 정책공백은 decision · 오류는 resolution)·캡처 실재·개발 표식·자기 검증
  problems.push(...validateQa(root));
  return { problems, warnings };
}

if (process.argv.includes('--self-test')) {
  const { rmSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { create } = await import('./new-screen.mjs'); const { confirm } = await import('./confirm.mjs');
  const tmp = join(ROOT, '.validate-selftest'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'mockup.yaml'), 'project: t\n'); mkdirSync(join(tmp, 'screens', '_assets'), { recursive: true }); writeFileSync(join(tmp, 'screens', '_assets', 'tokens.css'), ''); writeFileSync(join(tmp, 'screens', '_assets', 'components.css'), '');
  const fails = [];
  try {
    const ok = create(tmp, 'm', 'ok', 'OK'); confirm(tmp, 'm/ok', { by: 'cto' });
    const tam = create(tmp, 'm', 'tampered', 'T'); confirm(tmp, 'm/tampered', { by: 'cto' }); writeFileSync(join(tam.path, '01-default.html'), rd(join(tam.path, '01-default.html')) + '<!-- 몰래 -->');
    const pol = create(tmp, 'm', 'poltamper', 'P'); confirm(tmp, 'm/poltamper', { by: 'cto' }); writeFileSync(join(pol.path, 'policy.md'), rd(join(pol.path, 'policy.md')) + '\n- 규칙 하나 더\n');   // 정책만 고침 — 화면은 그대로
    const css = create(tmp, 'm', 'csstamper', 'S'); confirm(tmp, 'm/csstamper', { by: 'cto' }); writeFileSync(join(css.path, '_screen.css'), rd(join(css.path, '_screen.css')) + '\n/* 몰래 */\n');   // CSS만 고침 — 렌더가 rev 없이 바뀐다
    const rdy = create(tmp, 'm', 'readytamper', 'R'); confirm(tmp, 'm/readytamper', { ready: true }); writeFileSync(join(rdy.path, '01-default.html'), rd(join(rdy.path, '01-default.html')) + '<!-- ready 뒤 -->');   // 손 뗌 선언 뒤 고침
    const crlf = create(tmp, 'm', 'crlf', 'C'); confirm(tmp, 'm/crlf', { by: 'cto' }); writeFileSync(join(crlf.path, '01-default.html'), rd(join(crlf.path, '01-default.html')).replace(/\n/g, '\r\n'));   // 개행만 바뀜 — 같은 내용(거짓 경보 금지)
    const dr = create(tmp, 'm', 'draft', 'D'); writeFileSync(join(dr.path, '02-x.html'), '<html><body>3분 전 <!-- FDR-261017-x --></body></html>'); writeFileSync(join(dr.path, 'bad name.html'), '<html></html>'); writeFileSync(join(dr.path, '03-nocss.html'), '<html><head><link rel="stylesheet" href="./missing.css"></head></html>');
    mkdirSync(join(tmp, 'screens', 'm', 'norev'), { recursive: true }); writeFileSync(join(tmp, 'screens', 'm', 'norev', '01-a.html'), '<html></html>');
    const bad = create(tmp, 'm', 'badstatus', 'B'); writeFileSync(join(bad.path, 'rev.yaml'), rd(join(bad.path, 'rev.yaml')).replace('visual_status: draft', 'visual_status: done'));
    mkdirSync(join(tmp, 'qa', 'QA-000000-bad'), { recursive: true }); writeFileSync(join(tmp, 'qa', 'QA-000000-bad', 'report.md'), '---\nid: QA-000000-bad\nstate: closed\ntype: 오류\nbasis: x\nclosed: ""\ncaptures: []\n---\n# QA-000000-bad · t\n');
    const { problems, warnings } = validate(tmp);
    const want = ['m/tampered: 01-default.html가 rev 1 확정본과 다르다', 'm/poltamper: policy.md가 rev 1 확정본과 다르다', 'm/csstamper: _screen.css가 rev 1 확정본과 다르다', 'm/readytamper: 01-default.html가 rev 0 ready 선언본과 다르다', 'm/draft: 02-x.html에 개발 저장소 표식(FDR-261017-x)', 'm/draft: 상태 파일 이름은 NN-slug.html — bad name.html', 'm/draft: 03-nocss.html 자산 참조가 열리지 않는다', 'm/norev: rev.yaml 없음', 'm/badstatus: visual_status(done)', 'QA-000000-bad: closed인데 확인 기록', 'QA-000000-bad: 오류 건이 resolution'];
    for (const w of want) if (!problems.some((p) => p.includes(w))) fails.push('미검출: ' + w);
    if (!warnings.some((w) => /m\/draft: 02-x\.html 상대 시각/.test(w))) fails.push('draft 비결정은 경고여야');
    if (problems.some((p) => p.startsWith('m/ok:'))) fails.push('양성 오탐: ' + problems.filter((p) => p.startsWith('m/ok:')).join(' | '));
    if (problems.some((p) => p.startsWith('m/crlf:'))) fails.push('CRLF 거짓 경보: ' + problems.filter((p) => p.startsWith('m/crlf:')).join(' | '));
    if (problems.some((p) => /m\/draft: 02-x\.html 상대 시각/.test(p))) fails.push('draft 비결정이 위반으로');
  } catch (e) { fails.push('예외: ' + e.message); }
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails.length ? 'self-test FAIL: ' + fails.join(' · ') : 'self-test OK (11종 검출 · 정책·CSS 변조 · ready 뒤 수정 · draft 경고 · 양성 대조 1 · CRLF 무경보)');
  process.exit(fails.length ? 1 : 0);
}
if (process.argv[1] && /validate\.mjs$/.test(process.argv[1]) && !process.argv.includes('--self-test')) {
  const { problems, warnings } = validate(ROOT);
  for (const w of warnings) console.log('⚠ ' + w);
  if (problems.length) { console.log(`목업 검사 위반 ${problems.length}건:\n- ` + problems.join('\n- ')); process.exit(1); }
  console.log(`목업 검사 OK (화면 ${listScreens(ROOT).length}개${warnings.length ? ` · 경고 ${warnings.length}` : ''})`);
}
