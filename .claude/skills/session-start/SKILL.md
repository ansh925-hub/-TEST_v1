---
name: session-start
description: 세션을 시작할 때 HANDOFF.md를 읽고 저장소 상태(브랜치, main 최신 여부, 열린 PR·이슈)를 확인해 현재 상태를 요약한다. "지금 상태 알려줘", "HANDOFF 읽고 요약해줘", "이어서 하자"처럼 작업을 이어서 시작할 때 사용한다.
---

# 세션 시작: 상태 확인과 요약

1. 저장소 상태를 확인한다. 아래 명령은 읽기만 하므로 그대로 실행해도 된다:
   ```bash
   git status -sb
   git fetch -q origin
   git log --oneline -5 origin/main
   git rev-list --left-right --count HEAD...origin/main   # 왼쪽=앞선 커밋, 오른쪽=뒤처진 커밋
   gh pr list --state open
   gh issue list --state open
   ```
   - `gh`가 없거나 로그인되지 않았으면 그 사실만 알리고 git 정보로 계속한다.
2. `HANDOFF.md`를 읽는다. `ROADMAP.md`는 단계 설명이 필요할 때만 읽는다.
3. 한국어로 짧게 요약한다:
   - **지금 위치**: 브랜치 이름, `main` 대비 앞서거나 뒤처진 정도, 커밋하지 않은 변경 여부
   - **끝난 것**: HANDOFF "한 일"에서 최근 항목 위주로
   - **다음 할 일**: HANDOFF "남은 것" 1순위
   - **열린 PR·이슈**가 있으면 번호와 제목
   - HANDOFF 내용과 실제 저장소 상태가 다르면 (예: HANDOFF에는 진행 중인데 PR이 이미 Merge됨) 그 차이를 분명히 알린다.
4. 다음으로 할 일 하나를 제안하고, 진행할지 묻는다. 묻기 전에 파일을 바꾸지 않는다.
