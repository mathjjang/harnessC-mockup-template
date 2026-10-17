# screens/ — 화면 폴더 = 기획의 원자 단위

`<모듈>/<화면>/` 에 상태 파일(`NN-slug.html`) · `_screen.css` · `policy.md` · `rev.yaml`. 생성은 `node scripts/new-screen.mjs <모듈> <화면> "<제목>"`, 확정은 `node scripts/confirm.mjs <모듈>/<화면> --by "<이름>"`. 절차 `runbooks/design-mockup.md`.

`_assets/`는 공용 시각 어휘(토큰·컴포넌트·폰트). 화면은 소비만 하고 재정의하지 않는다.
