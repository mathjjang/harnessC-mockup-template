# AGENTS.md — {{PROJECT_NAME}} 목업 저장소 에이전트 규칙

> 기획·디자인이 보는 저장소. 모든 에이전트(Claude Code·Codex·Gemini·Cursor 등) 공통. 기본은 개발 저장소와 **별도 GitHub 저장소**(기획·디자인 분리)이고, 개발자 혼자일 때는 개발 저장소 안 `mockups/`에 둘 수 있다(embedded — 규칙은 같다). 어느 쪽이든 이 폴더는 개발 저장소를 모른다(의존은 개발→목업 한 방향). 절차 정본은 `runbooks/design-mockup.md`.

## 무엇이 정본인가

- **확정 목업 = 신규 화면의 시각 정본.** 화면 폴더 `screens/<모듈>/<화면>/`가 기획의 원자 단위 — 상태 파일(`NN-slug.html`, 상태 하나 = 파일 하나) + `policy.md`(목업이 못 그리는 전이·동작·조건·문구) + `rev.yaml`(확정 스탬프).
- 관측 가능한 것은 HTML이 정본, 산문(policy)은 파생. 둘이 어긋나면 HTML을 고친다.
- 확정은 **사람**이 한다. 에이전트는 `--ready`로 요청하고, 확정자가 `node scripts/confirm.mjs <모듈>/<화면> --by "<이름>"`을 돌린다.

## 지켜야 하는 것 (게이트 `scripts/validate.mjs`가 커밋 전에 막는다)

1. 폴더는 `node scripts/new-screen.mjs <모듈> <화면> "<제목>"`으로만 만든다. 손 복사 금지.
2. **확정 후 수정은 rev+1 재확정만.** confirmed 화면을 고치려면 `confirm.mjs --reopen "<사유>"` → 고침 → `confirm`(rev+1). 몰래 고친 html은 해시 대조로 막힌다.
3. 자산 참조는 화면 폴더 기준 상대 경로(`../../_assets/…` · `./_screen.css`). 참조가 열리지 않는 목업은 커밋되지 않는다 — 승격(복사) 뒤에도 같은 상대 위치에 놓이기 때문이다.
4. **데이터는 결정적으로.** 오늘 날짜·"3분 전"·난수·환경 의존 값 금지. 목업의 예시 데이터가 곧 개발 쪽 픽셀 대조의 시드 명세다.
5. 공용 어휘는 `screens/_assets/components.css`·`tokens.css`. 화면 고유 CSS는 `_screen.css`에만. 공용 CSS를 화면 안에서 재정의하지 않는다.
6. `data-testid`는 화면계약이다 — 구현이 문자 그대로 이식하고 E2E가 그것으로 요소를 찾는다. 바꾸면 rev+1.
7. 이 저장소에 개발 저장소의 경로·기록 ID(`FDR-`·`ADR-`·`docs/features/` …)·원가·공수·내부 판단을 쓰지 않는다. 게이트가 거부한다.
8. 테스트 서버에서 발견한 것은 `qa/`로 접수한다(`scripts/qa.mjs` · `runbooks/qa-intake.md`). 검수자는 사실만, 분류는 에이전트가 근거와 함께. 유형이 경로를 정한다 — 기획수정을 개발로 보내지 않는다. `resolution.md`는 개발 소유라 여기서 고치지 않는다.
9. 모든 텍스트 파일은 UTF-8(BOM 없음). 보고·질문은 한국어, 결론 먼저.

## 개발 저장소와의 연결 (여기서는 하지 않는다)

개발 저장소가 이 저장소를 형제 체크아웃(`../<이름>`)으로 두고 `harness.yaml references`에 `role: mockup, mode: read-only`로 등록한다. 승격(`mockup-diff.mjs promote`)은 confirmed 화면만 받고 rev·확정자·해시를 가져간다. 이 저장소에는 그 사실을 적지 않는다.
