# /fix-bug - 버그 진단 및 수정 어시스턴트

증상을 분석하고, 데이터 흐름을 추적하며, 타겟팅된 수정을 적용하여 Balance Team Maker 코드베이스의 버그를 진단하고 수정합니다.

## 사용법
```
/fix-bug <버그_설명>
```

## 인수 ($ARGUMENTS)
$ARGUMENTS

## 지침

### 1단계: 버그 이해
1. `$ARGUMENTS`에서 버그 설명을 파싱합니다.
2. 주요 증상을 식별합니다:
   - 기대되는 동작은 무엇인가?
   - 실제 동작은 무엇인가?
   - 어떤 기능/화면이 영향을 받는가?

### 2단계: 관련 코드 찾기
1. 버그 설명의 키워드를 사용하여 관련 파일을 검색합니다:
   - Grep을 사용하여 관련 코드 패턴 찾기
   - Glob을 사용하여 관련 파일 찾기
2. 앱의 아키텍처 패턴에 따라 데이터 흐름을 추적합니다:
   - **Context** (`contexts/`): 상태 관리 확인 (AppContext, AuthContext, PlayerContext)
   - **Hook** (`hooks/`): 비즈니스 로직 확인 (useTeamBalance, useNavigation, useRecruitmentRooms, useInitialization)
   - **Service** (`services/`): 백엔드 로직 확인 (balanceService, firebaseService, paymentService, analyticsService)
   - **Component** (`components/`, `pages/`, `App.tsx`): 렌더링 로직 확인
3. 버그가 데이터 타입이나 설정과 관련된 경우 `types.ts` 및 `constants.ts`를 읽습니다.

### 3단계: 근본 원인 분석
1. 식별된 파일들을 철저히 읽습니다.
2. 사용자 상호작용부터 버그 발생까지의 실행 경로를 추적합니다.
3. 일반적인 문제들을 확인합니다:
   - 상태가 업데이트되지 않음 (stale closures, missing dependencies)
   - 잘못된 타입 캐스팅 또는 누락된 null 체크
   - 비동기 작업의 레이스 컨디션
   - 번역 키 불일치
   - Capacitor 플러그인 API 오용
   - Firebase 쿼리/쓰기 오류
4. 근본 원인을 명확하게 기록합니다.

### 4단계: 수정 구현
1. 근본 원인을 해결하는 최소한의 수정을 적용합니다.
2. 수정사항이 기존 코드 패턴을 따르는지 확인합니다:
   - 동일한 상태 관리 패턴(Context + Hook) 사용
   - UI 수정 시 Tailwind CSS 컨벤션 준수
   - i18n 관련 수정 시 번역 일관성 유지
3. 부작용을 확인합니다:
   - 이 수정이 다른 기능을 망가뜨리지는 않는가?
   - 다른 곳에도 동일한 수정이 필요한 유사한 패턴이 있는가?

### 5단계: 검증
1. `npx tsc --noEmit`을 실행하여 TypeScript 에러를 확인합니다.
2. 요약합니다:
   - **근본 원인:** 버그를 유발한 원인
   - **적용된 수정:** 변경된 내용 및 이유
   - **수정된 파일:** 변경된 파일 목록
   - **부작용:** 다른 기능에 미칠 수 있는 잠재적 영향

## 주요 파일 참조
| 영역 | 파일 |
|------|-------|
| 메인 앱 | `App.tsx` |
| 타입 | `types.ts`, `constants.ts` |
| 컨텍스트 | `contexts/AppContext.tsx`, `contexts/AuthContext.tsx`, `contexts/PlayerContext.tsx` |
| 훅 | `hooks/useTeamBalance.ts`, `hooks/useNavigation.ts`, `hooks/useRecruitmentRooms.ts` |
| 서비스 | `services/balanceService.ts`, `services/firebaseService.ts` |
| 컴포넌트 | `components/PlayerItem.tsx`, `components/SettingsPage.tsx`, `components/LoadingOverlay.tsx` |
| 번역 | `translations.ts` |
| 유틸리티 | `utils/helpers.ts` |

## 중요 참고 사항
- 변경을 시작하기 전에 항상 관련 코드를 먼저 읽으십시오.
- 광범위한 리팩토링보다 최소한의 타겟팅된 수정을 선호합니다.
- 앱은 Android(Capacitor), iOS 및 웹에서 실행되므로 플랫폼 차이를 고려하십시오.
- 버그가 표시된 텍스트와 관련된 경우 `translations.ts`를 확인하십시오.
- Firebase 작업은 `services/firebaseService.ts`에 있습니다.
- 팀 밸런싱 로직은 `services/balanceService.ts`에 있습니다.
