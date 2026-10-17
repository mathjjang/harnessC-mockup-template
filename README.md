# harnessC-mockup-template

하네스C 개발 저장소와 짝을 이루는 **목업(기획·디자인) 저장소**의 뼈대. 확정 목업이 신규 화면의 시각 정본이 되고, 개발 저장소가 그것을 읽어 픽셀 단위로 대조한다(`harnessC-template`의 `mockup-diff.mjs`).

- 버전: **0.1.0** · 짝: harnessC-template ≥ 0.3.1
- 원칙: **개발과 기획·디자인은 다른 저장소다.** 이 저장소는 별도 GitHub 저장소로 만들고, 개발 저장소에는 형제 체크아웃으로만 연결한다(중첩·복사·submodule 금지). 의존은 개발→목업 한 방향 — 이 저장소는 개발 저장소를 모른다.

## 언제 만드나

개발 저장소와 **동시에 만들 필요는 없다.** 화면 설계가 시작되는 시점에 만든다. UI가 없는 프로젝트(데이터 파이프라인 등)는 이 저장소가 없다.

```bash
# 1. GitHub "Use this template" → <프로젝트>-mockups (비공개). 개발 저장소의 형제 폴더로 clone
# 2. 이름 치환 + 훅
node init.mjs --name <프로젝트>
git config core.hooksPath scripts/git-hooks
# 3. 첫 화면
node scripts/new-screen.mjs <모듈> <화면> "<제목>"
# 4. 개발 저장소 harness.yaml 에 등록 (개발 쪽에서)
#    references:
#      - { path: ../<프로젝트>-mockups, role: mockup, mode: read-only }
```

## 구조

```
screens/<모듈>/<화면>/   NN-slug.html(상태 하나 = 파일 하나) · _screen.css · policy.md · rev.yaml(확정 스탬프)
screens/_assets/         tokens.css · components.css · fonts/   — 공용 시각 어휘 (화면이 소비만 한다)
runbooks/                design-mockup.md — 제작·확정·재개 절차 정본
scripts/                 new-screen · confirm · validate(pre-commit 게이트) · 각각 --self-test
mockup.yaml              프로젝트명 · 뷰포트
AGENTS.md                에이전트 규칙 (≤2KB) · CLAUDE.md·GEMINI.md는 입구
.claude/ .agents/ .gemini/   런북 포인터 (세 런타임의 /design-mockup)
```

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
