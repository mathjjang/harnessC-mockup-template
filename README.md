# harnessC-mockup-template

하네스C 개발 저장소와 함께 쓰는 목업(기획·디자인) 저장소 템플릿. 여기서 확정한 화면을 개발이 그대로 구현하고, 실제 화면과 비교한다. 테스트 서버에서 찾은 문제도 여기에 접수한다.

- 버전 0.2.1
- 짝 템플릿: [harnessC-template](https://github.com/mathjjang/harnessC-template) v0.4.1

기획·디자인 저장소와 개발 저장소는 나눈다. 개발자 혼자 목업까지 만들면 개발 저장소 안 `mockups/`에 둔다.

## 준비물

Node 22 이상, git이 필요하다. 명령은 모두 저장소 루트에서 실행한다. 개발 저장소 안 `mockups/`에 두었다면 `node mockups/scripts/…`로 실행한다.

에이전트에게는 `/design-mockup`(목업 만들기·확정)과 `/qa-intake`(검수 접수)로 시킨다.

## 0. 저장소 만들기

화면 설계를 시작할 때 개발 저장소 루트에서 실행한다.

| | 기획·디자인이 따로 할 때 | 개발자가 직접 할 때 |
|---|---|---|
| 명령 | `node .harness/scripts/mockup-diff.mjs init separate` | `node .harness/scripts/mockup-diff.mjs init embedded` |
| 위치 | 별도 GitHub 저장소 `../<프로젝트>-mockups` | 개발 저장소 안 `mockups/` |

개발 저장소 설정 때 "목업은 개발자가 직접 만든다"고 답했다면 `mockups/`가 이미 있다. 나중에 기획 담당이 생기면 `mockups/`를 새 저장소로 옮기고 개발 저장소의 등록 경로만 바꾼다.

이 템플릿에서 직접 만들 때는 GitHub의 "Use this template" 버튼으로 만든 뒤 아래를 실행한다.

```bash
node init.mjs --name <프로젝트>
git config core.hooksPath scripts/git-hooks
```

## 1. 화면 만들기 (기획자)

```bash
node scripts/new-screen.mjs <모듈> <화면> "<제목>"
```

`screens/<모듈>/<화면>/`에 `01-default.html`, `_screen.css`, `policy.md`, `rev.yaml`이 생긴다.

- 화면 상태 하나마다 파일 하나를 만든다. 예: `01-default.html`, `02-empty.html`, `03-error.html`, `04-modal-open.html`. 사용자가 볼 수 있는 상태를 모두 만든다.
- 개발은 HTML의 마크업, 클래스, `data-testid`를 그대로 옮겨 쓴다. 공통 모양은 `screens/_assets/`의 `components.css`와 `tokens.css`를 쓰고, 이 화면에만 있는 모양은 `_screen.css`에 둔다.
- 예시 데이터는 고정값으로 쓴다. 오늘 날짜, "3분 전", 무작위 값은 쓰지 않는다.
- `policy.md`에는 화면에 그릴 수 없는 것을 7개 절로 적는다: 상태 전이, 액션별 동작, 권한, 빈/오류 조건, 한계값, 동적 동작, 문구. 절 제목은 바꾸지 않는다. 정할 것이 없는 절에는 "해당 없음"이라고 적는다. 아직 답이 없는 것은 "미결" 표에 질문으로 남긴다.
- 커밋 전에 `node scripts/validate.mjs`로 미리 검사할 수 있다.

## 2. 확정하기

```bash
node scripts/confirm.mjs <모듈>/<화면> --ready
node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>" --note "<이번에 바뀐 것>"
```

`--ready`는 확정을 요청한다. 에이전트도 할 수 있다. `--by`로 확정하는 것은 사람만 할 수 있다.

다음 중 하나라도 해당하면 확정되지 않는다.

- `policy.md`의 7개 절 중 비어 있는 절이 있다.
- "미결" 표에 영향이 "막음"이고 아직 열린 질문이 있다.
- 확정자 이름이 에이전트 이름이다.
- `--ready` 뒤에 파일이 바뀌었다. 이때는 `--ready`를 다시 한다.

확정된 화면은 개발 저장소에서 `mockup-diff.mjs promote`로 가져간다.

## 3. 확정한 화면 고치기

```bash
node scripts/confirm.mjs <모듈>/<화면> --reopen "<사유>"
# HTML, CSS, policy.md를 고친다
node scripts/confirm.mjs <모듈>/<화면> --by "<확정자>"
```

확정된 화면은 `--reopen` 없이 고치면 커밋되지 않는다. 다시 확정하면 버전(rev)이 오르고, 개발은 새 버전으로 다시 구현하고 비교한다.

`screens/_assets/`의 공통 파일을 바꾸면 확정된 모든 화면을 하나씩 다시 확정해야 한다. 공통 파일은 꼭 필요할 때만 바꾼다.

## 4. 문제 접수하기 (검수자)

테스트 서버에서 써 보고 문제를 찾으면 접수한다.

```bash
node scripts/qa.mjs new <slug> "<증상 한 줄>" --by "<이름>" --screen <모듈>/<화면> --server <테스트 서버 주소> --capture <캡처.png>
```

`qa/QA-<날짜>-<slug>/report.md`에 무엇을 했는지, 무엇이 나왔는지, 어떻게 되어야 하는지를 적는다. 심각도와 유형은 검수자가 정하지 않는다.

## 5. 유형 나누기 (에이전트)

```bash
node scripts/qa.mjs classify QA-… <유형> "<근거>" --by "<에이전트>"
```

아래 순서로 판단한다.

1. 확정된 목업과 정책에 이 상황의 답이 없다 → 정책공백
2. 답이 있는데 제품이 다르게 동작한다 → 오류
3. 답대로 동작하는데 그 답을 바꾸고 싶다 → 모양·배치면 기획수정(UI), 동작 규칙이면 기획수정(정책)

| 유형 | 처리 | 닫는 조건 |
|---|---|---|
| 오류 | 개발이 가져가 고치고, 고친 사람이 아닌 리뷰어가 확인해 `qa/<ID>/resolution.md`에 답한다 | 개발의 답장과 기획자의 확인 |
| 기획수정(UI) | 이 저장소에서 화면을 다시 열어 고치고 다시 확정한 뒤 `node scripts/qa.mjs change QA-… "<모듈>/<화면> rev N"` | 반영 기록 |
| 기획수정(정책) | 이 저장소에서 화면을 다시 열어 `policy.md`를 고치고 다시 확정한 뒤 `node scripts/qa.mjs change QA-… "<모듈>/<화면> rev N"` | 반영 기록 |
| 정책공백 | 사람이 정한 뒤 `node scripts/qa.mjs decide QA-… "<결정>"`, 그리고 다시 유형을 나눈다 | 결정 기록 |

기획수정은 개발로 보내지 않는다. 오류와 바꾸고 싶은 것이 섞여 있으면 둘로 나눠 접수한다.

## 6. 닫기 (기획자)

```bash
node scripts/qa.mjs close QA-… --by "<이름>" "<테스트 서버에서 확인한 내용>"
node scripts/qa.mjs reopen QA-… "<여전히 재현되는 이유>"
```

할 일은 `qa/INDEX.generated.md`의 "사람 할 일"에 모인다. "재현 불가"로 닫지 말고 검수자에게 다시 묻는다.

## 명령 목록

| 명령 | 하는 일 |
|---|---|
| `scripts/new-screen.mjs` | 화면 폴더 만들기 |
| `scripts/confirm.mjs` | 확정 요청(`--ready`), 확정(`--by`), 다시 열기(`--reopen`) |
| `scripts/qa.mjs` | 문제 접수, 유형 나누기, 결정, 반영 기록, 닫기, 다시 열기 |
| `scripts/validate.mjs` | 커밋 전 검사 |

## 폴더 구조

```
screens/<모듈>/<화면>/   화면 상태별 HTML, _screen.css, policy.md, rev.yaml
screens/_assets/         모든 화면이 함께 쓰는 tokens.css, components.css, fonts/
qa/QA-<날짜>-<slug>/     접수 건 (report.md는 기획, resolution.md는 개발이 쓴다)
runbooks/                절차서
scripts/                 명령
mockup.yaml              프로젝트 이름, 화면 크기 (개발 저장소 설정과 같아야 한다)
```

## 검사

```bash
for s in scripts/*.mjs; do node $s --self-test; done && node scripts/validate.mjs
```

## 라이선스

[MIT](LICENSE). Copyright (c) 2026 Ubion Co., Ltd. (주식회사 유비온)

만든 사람: Bong Jin Jang <mathjjang@ubion.co.kr>
