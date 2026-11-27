---
name: after-merge
description: 사용자가 PR을 Merge한 뒤 로컬 저장소를 정리한다. main으로 이동해 최신 내용을 받고, Merge된 작업 브랜치를 지우고, 다음 할 일을 알려 준다. "머지했어", "Merge 했어"라고 할 때 사용한다.
---

# Merge 후 정리

1. 커밋하지 않은 변경이 있는지 `git status -sb`로 확인한다. 있으면 멈추고 사용자에게 어떻게 할지 묻는다.
2. Merge 여부를 확인한다:
   ```bash
   gh pr list --state merged --limit 3
   ```
   현재 브랜치의 PR이 아직 Merge되지 않았으면 정리하지 말고 그 사실을 알린다.
3. `main`을 최신으로 만든다:
   ```bash
   git switch main
   git pull --ff-only
   git log --oneline -3
   ```
4. Merge된 로컬 작업 브랜치를 지운다. `git branch -d <브랜치>`만 쓴다 (`-D`로 강제 삭제하지 않는다). `-d`가 거부되면 그 이유를 설명하고 사용자에게 묻는다.
   - 원격 브랜치는 GitHub에서 Merge할 때 지워졌을 수 있다. 남아 있어도 사용자가 요청하지 않으면 지우지 않는다.
5. 단계 3 이후 Pages나 Actions가 있다면 `gh run list --limit 3`으로 배포·검사가 성공했는지 확인한다.
6. `HANDOFF.md`의 "남은 것" 1순위를 보고 다음 할 일을 한 줄로 제안한다.
