# CLAUDE.md

Claude Code가 이 저장소에서 작업할 때 지키는 지침입니다. 진행 상황은 이 파일이 아니라 `HANDOFF.md`에 적습니다.

## 저장소 개요
- 목적: Claude Code(휴대폰 클라우드 세션 + PC 데스크톱 앱)로 Git/GitHub 흐름을 실습하고, 마지막에는 매일 쓰는 개인 웹 도구를 만든다.
- 공개 저장소: https://github.com/ansh925-hub/-TEST_v1
- 사이트: https://ansh925-hub.github.io/-TEST_v1/ (GitHub Pages, `main` / root에서 자동 배포. `.nojekyll`은 지우지 않는다)
- 주요 파일:
  - `HANDOFF.md`: 현재 상태와 남은 일 (세션 시작 시 가장 먼저 읽는다)
  - `ROADMAP.md`: 단계 0~4 학습 계획
  - `index.html`: 실습 체크리스트 페이지 (빌드 도구 없이 HTML 한 파일)
  - `README.md`: 저장소 소개와 기록

## 사용자와 소통
- 한국어로, 쉬운 말로 설명한다. 사용자는 Git/GitHub를 배우는 중이다. 새 용어는 처음 나올 때 한 줄로 풀어 준다.
- 무엇을 했는지, 무엇이 아직 확인되지 않았는지 구분해서 말한다.

## 작업 흐름 (반드시 지킴)
1. 시작할 때: `HANDOFF.md`를 읽고 `git status`, 현재 브랜치, `main`이 최신인지 확인한다 (`/session-start` 스킬).
2. `main`에 직접 커밋하지 않는다. 작업마다 새 브랜치를 만든다 (예: `add-xxx`, `fix-xxx`).
3. **기능 1개 = PR 1개.** 작은 단위로 나눈다.
4. 이슈와 연결되는 PR은 본문에 `Closes #번호`를 넣는다.
5. 작업이 끝나면 `HANDOFF.md`를 갱신하고 커밋 → 푸시 → PR까지 한다 (`/make-pr` 스킬).
6. Merge가 끝나면 `main`을 pull하고 다 쓴 로컬 브랜치를 지운다 (`/after-merge` 스킬).
- 커밋 메시지: `docs:`, `feat:`, `fix:`, `ci:` 같은 접두어 + 짧은 영어 요약. PR 제목과 본문은 한국어로 쓴다.

## 사용자만 할 수 있는 일
- **Merge 승인**, 저장소 Settings 변경(Pages, 기본 브랜치, 권한 등)은 사용자가 GitHub 웹이나 앱에서 직접 한다. Claude는 무엇을 누르면 되는지 안내만 한다.
- 프로그램 설치(Git, GitHub CLI 등)와 로그인(`gh auth login`)도 사용자가 직접 한다.

## 보안과 개인정보 (공개 저장소)
- 비밀번호, API 키, 토큰, 개인 데이터는 절대 커밋하지 않는다. 개인 웹 도구의 데이터는 브라우저(localStorage)에만 저장한다.
- 커밋 작성자는 개인 이메일 대신 GitHub noreply 주소를 쓴다. 이 저장소의 로컬 git config에만 설정되어 있고, `--global` 설정은 바꾸지 않는다.

## 환경별 주의사항
- **클라우드 세션(휴대폰)**: 컨테이너가 임시 공간이라 푸시하지 않은 작업은 사라진다. `github.io` 접속이 막혀 있어서 사이트 확인은 사용자가 하고, Claude는 Actions 배포 기록만 확인한다.
- **PC 세션(데스크톱 앱)**: 작업 폴더는 `D:\Claude\Git_test\-TEST_v1`. Windows 10 LTSC이고 winget이 없다. Git과 `gh`가 설치되어 있고 `gh`는 로그인된 상태다. 세션은 이 폴더에서 열어야 앱의 PR 상태 표시가 연결된다.
- 새 세션은 다른 작업 브랜치에서 시작될 수 있으니 항상 브랜치부터 확인한다.

## 검사
- 아직 자동 검사(CI)는 없다. 단계 3에서 GitHub Actions로 HTML 문법과 깨진 링크 검사를 추가할 예정이다. 추가되면 이 절에 실행 방법을 적는다.
