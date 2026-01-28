# Task List

- [x] 모집 관리 메인 UI 통합
  - [x] 신청자 승인/거절 기능 메인 뷰로 이동
  - [x] 모두 승인 / 링크 복사 / 방 삭제 기능 메인 뷰로 이동
  - [x] HostRoomModal 단순화 (생성/설정 전용)
  - [x] 방 삭제 시 생성창 재오픈 버그 수정
- [x] Update `translations.ts`
    - [x] Add missing keys (`roomTitle`, `inputRoomTitle`, `startTime`, `endTime`, `limitApplicants`, `maxApplicants`, `peopleCount`, `applyTitle`, `inputNamePlaceholder`, `completeApplication`, `welcomeMsg`, `logoutMsg`, `confirmDeleteRoom`, etc.)
    - [x] Add `days` array for day of week translation
    - [x] Ensure translations are provided for all supported languages (KO, EN, ES, JA, PT)
- [x] Refactor `App.tsx`
    - [x] Replace hardcoded strings in `HostRoomModal`
    - [x] Replace hardcoded strings in `ApplyRoomModal`
    - [x] Replace hardcoded strings in alert messages and main UI
- [x] 안드로이드 에뮬레이터 공유 링크 접속 문제 해결 (localhost -> 10.0.2.2 변환)
