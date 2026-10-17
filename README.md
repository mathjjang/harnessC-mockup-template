# harnessC-mockup-template

하네스C 개발 저장소와 짝을 이루는 **목업(기획·디자인) 저장소**의 뼈대. 확정 목업이 신규 화면의 시각 정본이 되고, 개발 저장소가 그것을 읽어 픽셀 단위로 대조한다(`harnessC-template`의 `mockup-diff.mjs`).

- 버전: **0.1.3** · 릴리스 태그 `v0.1.3` · 짝: harnessC-template `v0.3.5`
- 원칙: **개발과 기획·디자인은 다른 저장소다.** 이 저장소는 별도 GitHub 저장소로 만들고, 개발 저장소에는 형제 체크아웃으로만 연결한다(중첩·복사·submodule 금지). 의존은 개발→목업 한 방향 — 이 저장소는 개발 저장소를 모른다.

## 언제, 어디에 만드나

개발 저장소와 **동시에 만들 필요는 없다.** 화면 설계가 시작되는 시점에 만든다. UI가 없는 프로젝트(데이터 파이프라인 등)는 이 저장소가 없다. 자리는 둘 중 하나를 고른다 — 개발 저장소 루트에서 한 명령으로:

| | `separate` (기본) | `embedded` |
|---|---|---|
| 언제 | 기획·디자인이 다른 사람·조직일 때 | 개발자 혼자 목업까지 만들 때 |
| 자리 | 별도 GitHub 저장소 → 형제 폴더 `../<프로젝트>-mockups` | 개발 저장소 안 `mockups/` (개발 저장소가 추적) |
| 명령 | `node .harness/scripts/mockup-diff.mjs init separate` (gh가 있으면 템플릿으로 생성·clone) | `node .harness/scripts/mockup-diff.mjs init embedded` |
| harness.yaml | `{ path: ../<프로젝트>-mockups, role: mockup, mode: read-only }` | `{ path: mockups, role: mockup, mode: read-write, embedded: true }` |
| 게이트 | 이 저장소의 pre-commit(`scripts/validate.mjs`) | 개발 저장소 lint ⑰이 `mockups/scripts/validate.mjs`를 대신 돈다 |
| 입구(/design-mockup) | 이 저장소의 `.claude/ .agents/ .gemini/` | 개발 저장소 `harness-build`가 `mockups/runbooks/`에서 생성 |

레이아웃이 같으므로 **embedded → separate 이사는 폴더 이동 하나**다: `mockups/`를 새 비공개 저장소로 옮기고 harness.yaml의 path를 바꾼다. 기획 담당이 생기면 그때 분리한다.

수동으로 할 때(GitHub "Use this template" → clone):

```bash
node init.mjs --name <프로젝트>
git config core.hooksPath scripts/git-hooks
node scripts/new-screen.mjs <모듈> <화면> "<제목>"
```

## 구조

```
screens/<모듈>/<화면>/   NN-slug.html(상태 하나 = 파일 하나) · _screen.css · policy.md · rev.yaml(확정 스탬프)
screens/_assets/         tokens.css · components.css · fonts/   — 공용 시각 어휘 (화면이 소비만 한다)
qa/QA-<YYMMDD>-<slug>/   검수 접수 — report.md(기획 소유) · intake/(캡처) · resolution.md(개발 소유)
runbooks/                design-mockup.md(제작·확정·재개) · qa-intake.md(검수 접수·분류·닫기) — 절차 정본
scripts/                 new-screen · confirm · qa · validate(pre-commit 게이트) · 각각 --self-test
mockup.yaml              프로젝트명 · 뷰포트
AGENTS.md                에이전트 규칙 (≤2KB) · CLAUDE.md·GEMINI.md는 입구
.claude/ .agents/ .gemini/   런북 포인터 (세 런타임의 /design-mockup)
```

## 검수 — 테스트 서버에서 써보다 발견한 것

접수처는 이 저장소 `qa/`다(`node scripts/qa.mjs new <slug> "<증상>" --capture …`, 절차 `runbooks/qa-intake.md`). 검수자는 캡처·증상·되어야 할 모습만 내고, 에이전트가 유형을 분류한다. **유형이 처리 경로를 정한다**: `오류` → 개발 저장소가 가져가 고치고 리뷰어가 검증(`qa/<ID>/resolution.md`) · `기획수정(UI)` → 여기서 목업 rev+1 · `기획수정(정책)` → policy.md 개정 · `정책공백` → 사람 결정. 닫기는 기획만, 조건은 게이트가 지킨다(기획수정은 반영 근거 없이는 닫히지 않는다). 현황은 `qa/INDEX.generated.md`.

## 흐름

```
new-screen → 상태 파일·policy 채움 → validate → confirm --ready → (사람) confirm --by → 개발 저장소 promote
                                         ↑                                             │
                                         └──── confirm --reopen "<사유>" → 고침 → confirm(rev+1) ←┘ (재대조 필요)
```

| 게이트(validate) | 막는 것 |
|---|---|
| 확정본 불변 | confirmed 화면의 html이 rev.yaml 해시와 다르면 거부 — 수정은 reopen→confirm(rev+1)만 |
| 자산 참조 | stylesheet·script·img·`url()`이 디스크에서 안 열리면 거부(무스타일 목업) |
| 결정성 | 현재 시각·난수·상대 시각·오늘 날짜 — confirmed·ready는 거부, draft는 경고 |
| 경계 | 개발 저장소 경로·기록 ID가 들어오면 거부 |
| 형식 | rev.yaml 스키마 · `NN-slug.html` 이름 · policy.md 7절 |

## 검증

```bash
for s in scripts/*.mjs; do node $s --self-test; done && node scripts/validate.mjs
```

## 개정

이 템플릿의 규칙 변경은 하네스C의 REP에 준한다 — 개발 저장소 쪽(harnessC-template)에 ADR을 남기고 두 템플릿의 짝 버전을 맞춘다. 라이선스: 미정(비공개).
