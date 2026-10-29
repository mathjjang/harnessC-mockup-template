# harnessC-mockup-template

하네스C 개발 저장소와 짝을 이루는 **목업(기획·디자인) 저장소**의 뼈대. 확정된 목업이 신규 화면의 시각 정본이 되고, 개발 저장소가 그것을 읽어 픽셀 단위로 대조한다(`harnessC-template`의 `mockup-diff.mjs`). 테스트 서버에서 써 보고 발견한 문제의 **접수처**도 여기다.

- 버전: **0.1.13** · 릴리스 태그 `v0.1.13` · 짝: harnessC-template `v0.3.15`
- 원칙: **개발과 기획·디자인은 다른 저장소다.** 이 저장소는 개발 저장소를 모른다(의존은 개발→목업 한 방향). 개발자 혼자 목업까지 만들 때만 개발 저장소 안 `mockups/`에 둔다 — 규칙은 같다.

---

## 사용법

명령은 전부 저장소 루트에서 `node`로 돈다(embedded면 `node mockups/scripts/…`). 에이전트에게는 `/design-mockup`(목업 제작·확정) · `/qa-intake`(검수 접수)로 시킨다 — Claude Code·Codex·Gemini CLI 모두 같은 이름이고 절차 정본은 `runbooks/`.

### 0. 만들기 — 개발 저장소에서 한 명령

화면 설계가 시작될 때 만든다(개발 저장소와 동시일 필요 없음). 개발 저장소 루트에서:

| | 기획·디자인이 따로(기본) | 개발자가 직접 |
|---|---|---|
| 명령 | `node .harness/scripts/mockup-diff.mjs init separate` | `node .harness/scripts/mockup-diff.mjs init embedded` |
| 자리 | 별도 GitHub 저장소 → 형제 폴더 `../<프로젝트>-mockups` | 개발 저장소 안 `mockups/` |
| 개발 저장소 등록 | `{ path: ../<프로젝트>-mockups, role: mockup, mode: read-write, writable: [qa/] }` — 개발은 검수 회신(`qa/`)만 쓴다 | `{ path: mockups, role: mockup, mode: read-write, embedded: true }` |
| 커밋 검사 | 이 저장소의 pre-commit | 개발 저장소의 검사가 대신 돈다 |

개발 저장소의 프로젝트 설정 질문(Q4)에 `self`라고 답했으면 `mockups/`가 이미 만들어져 있다. 나중에 기획 담당이 생기면 `mockups/`를 새 저장소로 옮기고 등록 경로만 바꾸면 된다.

수동으로 만들 때(GitHub "Use this template" → clone):

```bash
node init.mjs --name <프로젝트>
git config core.hooksPath scripts/git-hooks
```

### 1. 기획자 — 화면 만들기

```bash
node scripts/new-screen.mjs <모듈> <화면> "<제목>"
#  → screens/<모듈>/<화면>/ 에 01-default.html · _screen.css · policy.md · rev.yaml(draft)
```

- **상태 하나 = 파일 하나** — `01-default.html` · `02-empty.html` · `03-error.html` · `04-modal-open.html` … 구현이 도달할 수 있는 화면 상태를 빠짐없이.
- 마크업·클래스·`data-testid`는 개발이 **글자 그대로 옮긴다**. 공용 모양은 `screens/_assets/components.css`·`tokens.css`를 쓰고, 화면 고유 모양만 `_screen.css`에.
- **예시 데이터는 고정값으로** — 오늘 날짜·"3분 전"·난수 금지. 이 값이 개발 쪽 대조의 기준 데이터가 된다.
- `policy.md`에 목업이 그리지 못하는 것(상태 전이 · 액션별 동작 · 권한 · 빈/오류 조건 · 한계값 · 동적 동작 · 문구)을 7절로 — 절 제목은 그대로 둔다. validate가 제목으로 검사한다. 답이 없는 것은 「미결」에 질문으로.
- 커밋할 때마다 검사가 돈다: `node scripts/validate.mjs`로 미리 볼 수 있다.

### 2. 확정 — 사람이 서명한다

```bash
node scripts/confirm.mjs <모듈>/<화면> --ready           # 확정 요청 (에이전트·기획자)
node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>" --note "<이번 rev에 들어간 것>"   # 확정 — rev+1, 상태 파일·폴더 css·policy.md마다 지문(해시) 기록, history에 한 줄 누적
```

- 확정 전 검사: 자산 참조가 열리는가 · 데이터가 고정값인가 · policy 7절이 있고 **비어 있지 않은가**(정한 것이 없으면 "해당 없음") · §미결에 **개발을 막는(영향 「막음」) 열린 질문이 없는가** · 확정자가 **사람인가**(에이전트 모델명 거부) — 하나라도 아니면 확정되지 않는다.
- 확정된 화면은 개발 저장소에서 `mockup-diff.mjs promote FDR-… <모듈>/<화면>`으로 가져간다.

### 3. 확정본 고치기 — 다시 확정만

```bash
node scripts/confirm.mjs <모듈>/<화면> --reopen "<사유>"   # 고칠 수 있게 연다
#  … html·policy 수정 …
node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>"      # 다시 확정 — rev+1
```

`--reopen` 없이 확정된 html·css·policy.md를 고치면 커밋이 막힌다(정책·CSS도 지문 대상 — 화면만 잠그면 규칙과 렌더가 rev 없이 바뀐다). `--ready`도 그 시점의 지문을 고정한다 — 손 뗐다고 한 뒤 고치면 커밋이 막히고, 고쳤으면 `--ready`를 다시 한다(확정자는 자기가 본 파일을 확정한다). rev.yaml `history:`에 rev마다 무엇이 들어갔는지 쌓인다. 확정 때 공용 자산(`_assets/**`) 묶음 지문도 `assets_sha`로 남는다 — 토큰·컴포넌트 css를 바꾸면 확정된 **모든** 화면이 위반으로 뜨고, 화면마다 reopen → 재확정해야 커밋된다(일괄 명령은 없다 — 확정은 화면마다 사람이). 그래서 공용 자산은 함부로 바꾸지 않는다. rev가 오르면 개발 쪽에 재승격·재대조 작업이 생긴다 — 그래서 작은 수정도 rev를 올린다.

### 4. 검수자 — 테스트 서버에서 써 보고 접수

```bash
node scripts/qa.mjs new <slug> "<증상 한 줄>" --by "<이름>" --screen <모듈>/<화면> --server <테스트 서버 주소> --capture <캡처.png>
#  → qa/QA-<날짜>-<slug>/report.md 의 「무엇을 했나 · 무엇이 나왔나 · 되어야 할 모습」을 채운다
```

검수자는 **사실만** 낸다 — 캡처 · 재현 절차 · 결과 · 되어야 할 모습(말 그대로). 심각도·유형은 정하지 않는다.

### 5. 분류 — 에이전트가, 근거와 함께

```bash
node scripts/qa.mjs classify QA-… <유형> "<근거 — 캡처 속 주소·콘솔·기획의 어느 절>" --by "<에이전트>"
```

판별 질문을 위에서부터:

1. 확정 목업·policy에 이 상황의 답이 있나? 없다 → **정책공백**
2. 답이 있는데 제품이 다르게 동작하나? → **오류**
3. 답대로 동작하는데 그 답을 바꾸고 싶나? 모습·배치 → **기획수정(UI)** · 동작 규칙 → **기획수정(정책)**

**유형이 처리 경로를 정한다:**

| 유형 | 누가·어디서 | 닫히는 조건 |
|---|---|---|
| 오류 | 개발 저장소가 가져가 고치고, 다른 사람(리뷰어)이 확인해 `qa/<ID>/resolution.md`에 회신 | 회신이 resolved·verified + 기획의 확인 |
| 기획수정(UI) | 여기서: `--reopen` → 고침 → 다시 확정 → `node scripts/qa.mjs change QA-… "<모듈>/<화면> rev N"` | 반영 근거(change) 필수 |
| 기획수정(정책) | 여기서: `--reopen` → policy.md 개정 → 다시 확정 → `qa.mjs change QA-… "<모듈>/<화면> rev N"` | 반영 근거(change) 필수 |
| 정책공백 | 사람이 결정 → `node scripts/qa.mjs decide QA-… "<결정>"` → 다시 분류 | 결정 필수 |

기획수정을 개발로 보내지 않는다 — 기획 없이 화면·정책이 코드에서 바뀌는 것을 막는 장치다. 오류와 바꾸고 싶은 것이 섞인 건은 둘로 나눠 접수한다.

### 6. 닫기 — 기획(보고자)만

```bash
node scripts/qa.mjs close QA-… --by "<이름>" "<확인 방법 — 테스트 서버에서 무엇을 봤나>"
node scripts/qa.mjs reopen QA-… "<여전히 재현되는 이유>"
```

현황은 `qa/INDEX.generated.md`의 「사람 할 일」만 보면 된다: 분류 대기 · 결정 대기 · 확인 후 닫기. "재현 불가"로 닫지 않는다 — 검수자에게 다시 묻는다.

### 명령 한눈에

| 명령 | 하는 일 |
|---|---|
| `scripts/new-screen.mjs <모듈> <화면> "<제목>"` | 화면 폴더 생성 |
| `scripts/confirm.mjs <화면> --ready · --by [--note] · --reopen` | 확정 요청(지문 고정) · 확정(rev+1 · history) · 재개 |
| `scripts/qa.mjs new · classify · decide · change · close · reopen · index` | 검수 접수 · 분류 · 결정 · 반영 근거 · 닫기 · 재열림 · 현황 |
| `scripts/validate.mjs` | 커밋 검사(pre-commit과 같음) |

---

## 구조

```
screens/<모듈>/<화면>/   NN-slug.html(상태 하나 = 파일 하나) · _screen.css · policy.md · rev.yaml(확정 스탬프)
screens/_assets/         tokens.css · components.css · fonts/   — 공용 시각 어휘 (화면이 소비만 한다)
qa/QA-<YYMMDD>-<slug>/   검수 접수 — report.md(기획 소유) · intake/(캡처) · resolution.md(개발 소유)
runbooks/                design-mockup.md(제작·확정·재개) · qa-intake.md(검수 접수·분류·닫기) — 절차 정본
scripts/                 new-screen · confirm · qa · validate(pre-commit 게이트) · 각각 --self-test
mockup.yaml              프로젝트명 · 뷰포트(개발 저장소 mockup.viewport와 같아야 한다)
AGENTS.md                에이전트 규칙 · CLAUDE.md·GEMINI.md는 입구
.claude/ .agents/ .gemini/   런북 포인터 (세 런타임의 /design-mockup · /qa-intake)
```

```
new-screen → 상태 파일·policy 채움 → confirm --ready → (사람) confirm --by → 개발 저장소 promote → 구현 → 대조 → 테스트 서버
     ↑                                                                                                        │
     └──── confirm --reopen → 고침 → confirm(rev+1) ←── 기획수정 ←── qa classify ←── qa new (검수자) ←────────┘
                                                    오류 ──→ 개발 저장소 qa-intake pull → 수정 → resolution(verified) → qa close
```

| 커밋 검사(validate) | 막는 것 |
|---|---|
| 확정본 불변 | 확정(confirmed)·요청(ready)된 화면의 html·css·policy.md가 기록된 지문과 다르면 거부 — 확정본 수정은 reopen → 다시 확정만, ready 뒤 수정은 `--ready` 다시 |
| 자산 참조 | stylesheet·script·img·`url()`이 디스크에서 안 열리면 거부(모양 없는 목업) |
| 고정 데이터 | 현재 시각·난수·상대 시각·오늘 날짜 — 확정·확정 요청 상태는 거부, 초안은 경고 |
| 경계 | 개발 저장소 경로·기록 ID가 들어오면 거부 |
| 형식 | rev.yaml · `NN-slug.html` 이름 · policy.md 7절 |
| 검수 | 닫기 조건(확인 기록 · 기획수정은 반영 근거 · 정책공백은 결정 · 오류는 개발 회신) · 캡처 실재 · 고친 사람의 자기 확인 |

## 검증

```bash
for s in scripts/*.mjs init.mjs; do node $s --self-test; done && node scripts/validate.mjs
```

## 개정

규칙이 바뀔 때마다 버전을 올리고 짝 템플릿(harnessC-template)과 같은 시점에 태그한다.

## 라이선스 · 만든 사람

- 라이선스: [MIT](LICENSE) — Copyright (c) 2026 Ubion Co., Ltd. (주식회사 유비온)
- 만든 사람: Bong Jin Jang <mathjjang@ubion.co.kr>
- 이 템플릿으로 만든 프로젝트는 자기 라이선스를 고른다 — 프로젝트 생성 때 루트 `LICENSE`는 지워지고, 복사된 도구의 MIT 고지만 `scripts/LICENSE`에 남는다(지우지 않는다 — MIT의 유일한 조건).
