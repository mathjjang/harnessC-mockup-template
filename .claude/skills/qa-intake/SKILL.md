---
name: qa-intake
description: 검수 접수·분류·닫기 — 테스트 서버에서 발견한 것을 캡처·증상·되어야 할 모습으로 접수하고, 유형(오류/기획수정/정책공백)이 처리 경로를 정한다. "검수", "버그 접수", "테스트 서버에서 이상해", "수정 지시" 요청 시.
argument-hint: "new <slug> \"<증상>\" [--capture f] | classify <ID> <유형> \"<근거>\" | close <ID> --by \"<이름>\" \"<확인>\""
---
<!-- 포인터 — 정본은 runbooks/qa-intake.md -->

# 검수 접수 — 테스트 서버에서 발견한 것의 창구

절차 정본은 `runbooks/qa-intake.md`이다. 그 파일을 읽고 그대로 따른다. 입력: $ARGUMENTS
