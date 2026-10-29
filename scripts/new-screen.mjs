#!/usr/bin/env node
// new-screen.mjs — 화면 폴더 생성: screens/<모듈>/<화면>/{01-default.html, _screen.css, policy.md, rev.yaml(draft)}. 손 복사 금지.
// 사용: node scripts/new-screen.mjs <모듈> <화면> "<제목>"   (모듈·화면은 영문 소문자·숫자·하이픈)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, existsSync, join, writeRevText, today } from './lib/mockup.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = (title, screen) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${title} — 01 default</title>
<!-- 자산 참조는 화면 폴더 기준 상대 경로. 승격(복사) 뒤에도 같은 상대 위치에 자산이 놓인다 -->
<link rel="stylesheet" href="../../_assets/tokens.css">
<link rel="stylesheet" href="../../_assets/components.css">
<link rel="stylesheet" href="./_screen.css">
</head>
<body data-screen="${screen}" data-state="01-default">
  <!-- 상태 하나 = 파일 하나. 구현이 문자 그대로 이식할 마크업·클래스·data-testid를 여기 쓴다 -->
  <main class="content" data-testid="${screen.split('/')[1]}-pane">
    <h1 class="h1">${title}</h1>
  </main>
</body>
</html>
`;
const policy = (title, screen) => `# ${title} — 화면정책 (policy.md)

- 화면: \`${screen}\` · 작성: (에이전트(모델)) · ${today()}

> 목업이 그리지 못하는 것(전이·동작·조건·문구)의 정본. 근거는 요구사항·확정 결정·실측뿐 — 없으면 §미결로. 고정 7절은 비워 두더라도 지우지 않는다.

## 1. 상태 전이
(상태 파일 ↔ 상태 이름 · 어떤 조작으로 어느 상태로 가는가)

## 2. 액션별 동작

## 3. 권한

## 4. 빈/오류 조건

## 5. 한계값

## 6. 동적 동작
(스크롤·진행 중·애니메이션 등 정적 목업이 못 담는 것 — E2E가 본다)

## 7. 문구

## 미결
(영향이 「막음」이고 상태가 「열림」인 질문이 있으면 확정되지 않는다 — 개발이 착수했다가 재작업한다. 막지 않는 질문은 남겨도 된다)
| # | 질문 | 영향 | 상태 |
|---|---|---|---|
`;

export function create(root, mod, screen, title) {
  for (const [k, v] of [['모듈', mod], ['화면', screen]]) if (!/^[a-z0-9][a-z0-9-]*$/.test(v || '')) throw new Error(`${k}은 영문 소문자·숫자·하이픈: ${v}`);
  if (!title) throw new Error('제목이 필요하다');
  const id = `${mod}/${screen}`; const dir = join(root, config(root).screensDir, mod, screen);
  if (existsSync(dir)) throw new Error(`이미 있다: ${id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '01-default.html'), html(title, id));
  writeFileSync(join(dir, '_screen.css'), `/* ${id} 화면 고유 CSS — 공용 어휘(components.css)로 안 되는 것만. 승격 시 html과 함께 파일째 간다 */\n`);
  writeFileSync(join(dir, 'policy.md'), policy(title, id));
  writeFileSync(join(dir, 'rev.yaml'), writeRevText({ screen: id, title, rev: 0, visual_status: 'draft' }));
  return { id, path: dir };
}

if (process.argv.includes('--self-test') && /new-screen.mjs$/.test(process.argv[1] || '')) {
  const { rmSync } = await import('node:fs');
  const tmp = join(ROOT, '.newscreen-selftest'); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'mockup.yaml'), 'project: t\n');
  const fails = [];
  try {
    const r = create(tmp, 'dataset', 'list', '데이터셋 목록');
    for (const f of ['01-default.html', '_screen.css', 'policy.md', 'rev.yaml']) if (!existsSync(join(r.path, f))) fails.push(`${f} 없음`);
    const { readRev, missingPolicySections, rd, unresolvedAssets } = await import('./lib/mockup.mjs');
    const rev = readRev(r.path); if (!rev || rev.rev !== 0 || rev.visual_status !== 'draft' || rev.screen !== 'dataset/list') fails.push('rev.yaml draft');
    if (missingPolicySections(rd(join(r.path, 'policy.md'))).length) fails.push('policy 7절');
    mkdirSync(join(tmp, 'screens', '_assets'), { recursive: true }); writeFileSync(join(tmp, 'screens', '_assets', 'tokens.css'), ''); writeFileSync(join(tmp, 'screens', '_assets', 'components.css'), '');
    if (unresolvedAssets(join(r.path, '01-default.html')).length) fails.push('자산 참조 미해석: ' + unresolvedAssets(join(r.path, '01-default.html')).join(','));
    try { create(tmp, 'dataset', 'list', 'x'); fails.push('중복 통과'); } catch { /* 기대 */ }
    try { create(tmp, 'Bad Mod', 'x', 'x'); fails.push('잘못된 이름 통과'); } catch { /* 기대 */ }
  } catch (e) { fails.push('예외: ' + e.message); }
  rmSync(tmp, { recursive: true, force: true });
  console.log(fails.length ? 'self-test FAIL: ' + fails.join(' · ') : 'self-test OK (화면 폴더 4파일 · draft rev · policy 7절 · 자산 참조 · 거부 2)');
  process.exit(fails.length ? 1 : 0);
}
if (process.argv[1] && /new-screen\.mjs$/.test(process.argv[1]) && !process.argv.includes('--self-test')) {
  const [mod, screen, title] = process.argv.slice(2);
  try { const r = create(ROOT, mod, screen, title); console.log(`${r.id} → ${r.path}\n다음: 상태 파일을 늘리고(02-…html) policy.md를 채운 뒤 사람 확정 → node scripts/confirm.mjs ${r.id} --by "<이름>"`); }
  catch (e) { console.error(e.message + '\n사용: node scripts/new-screen.mjs <모듈> <화면> "<제목>"'); process.exit(2); }
}
