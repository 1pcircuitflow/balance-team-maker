# Belo (Balance Team Maker) 앱 개선 계획서

> **작성일**: 2026-02-13
> **분석 대상**: 앱 전체 코드베이스 (v2.1.26)
> **목적**: 프로덕션 품질 향상을 위한 필수 개선 사항 도출

---

## 목차

1. [분석 요약](#1-분석-요약)
2. [🔴 Critical — 즉시 조치 필요](#2--critical--즉시-조치-필요)
3. [🟠 High — 단기 내 해결 필요](#3--high--단기-내-해결-필요)
4. [🟡 Medium — 중기 개선](#4--medium--중기-개선)
5. [🟢 Low — 장기 개선](#5--low--장기-개선)
6. [미완성 기능 정리](#6-미완성-기능-정리)
7. [기술 부채 정리](#7-기술-부채-정리)

---

## 1. 분석 요약

### 현재 잘 구현된 영역
| 영역 | 상태 | 비고 |
|------|------|------|
| 팀 밸런싱 알고리즘 | ✅ 완료 | GA + SA + Hungarian, 4단계 최적화 |
| 모집방 시스템 | ✅ 완료 | CRUD, 실시간 동기화, 딥링크 |
| 다국어 지원 | ✅ 완료 | 5개 언어, 374개 키, 누락 없음 |
| 다크모드 | ✅ 완료 | 모든 컴포넌트에 일관 적용 |
| 로딩/피드백 UX | ✅ 완료 | 3단계 프로그레스, Toast, Modal |
| 오프라인 감지 | ✅ 완료 | OfflineBanner 표시 |
| Android 빌드 | ✅ 완료 | ProGuard, AdMob, FCM 설정 완료 |

### 핵심 부족 영역
| 영역 | 상태 | 심각도 |
|------|------|--------|
| 보안 (API 키 노출) | ❌ 미흡 | Critical |
| 결제 서버 검증 | ❌ 없음 | Critical |
| 테스트 코드 | ❌ 전무 | High |
| CI/CD 파이프라인 | ❌ 없음 | High |
| ESLint/Prettier | ❌ 없음 | High |
| iOS 지원 | ❌ 미구현 | High |
| 환경변수 관리 | ❌ 없음 | High |
| 접근성 (a11y) | ⚠️ 미흡 | Medium |
| Firebase 보안 규칙 | ⚠️ 미확인 | Medium |
| PWA 지원 | ❌ 없음 | Low |

---

## 2. 🔴 Critical — 즉시 조치 필요

### 2.1 API 키 및 민감 정보 하드코딩 제거

**현재 문제**:
- Firebase API Key가 `firebaseService.ts`에 직접 노출
- Kakao Client ID가 `kakaoAuthService.ts`에 하드코딩
- Gemini API Key가 `vite.config.ts`에서 `process.env`로 주입되나 `.env` 파일 부재
- AdMob App ID가 `AndroidManifest.xml`에 하드코딩

**필요 작업**:
1. `.env` / `.env.example` 파일 생성
2. `.gitignore`에 `.env` 패턴 추가 (현재 `*.local`만 존재)
3. 모든 API 키를 `import.meta.env.VITE_*` 형태로 전환
4. Firebase config 객체를 환경변수 기반으로 변경

**대상 파일**:
- `services/firebaseService.ts` — Firebase config
- `services/kakaoAuthService.ts` — `KAKAO_CLIENT_ID`
- `vite.config.ts` — `GEMINI_API_KEY`
- `capacitor.config.ts` — Google Auth `serverClientId`

---

### 2.2 인앱 결제 서버 측 검증 구현

**현재 문제**:
```typescript
// paymentService.ts — 클라이언트 측 문자열 비교만으로 구매 검증
return String(transaction.purchaseState) === "1";
```
- 서버 측 영수증(receipt) 검증이 전혀 없음
- 결제 우회(탈옥/루팅) 공격에 무방비

**필요 작업**:
1. Firebase Cloud Functions에 영수증 검증 API 구현
2. Google Play Developer API 연동 (`purchases.products.get`)
3. 구매 완료 시 서버에서 검증 후 프리미엄 상태 부여
4. 구매 복원 시에도 서버 검증 수행

---

### 2.3 민감 정보 localStorage 보안 강화

**현재 문제**:
- `AuthContext.tsx`: 사용자 정보를 `localStorage`에 평문 JSON으로 저장
- `useInitialization.ts`: FCM 토큰을 `localStorage`에 저장
- `AuthContext.tsx`: 게스트 ID를 `Math.random()`으로 생성 (암호학적 안전성 없음)

**필요 작업**:
1. 민감 정보는 `sessionStorage` 또는 Capacitor Secure Storage 사용
2. 게스트 ID 생성 시 `crypto.randomUUID()` 사용
3. 포지션 사용량 카운트를 서버 측에서 관리 (현재 localStorage → 조작 가능)

---

## 3. 🟠 High — 단기 내 해결 필요

### 3.1 테스트 코드 작성

**현재 상태**: 단위/통합/E2E 테스트 파일이 **전무**

**필요 작업**:

| 대상 | 테스트 유형 | 우선순위 |
|------|------------|---------|
| `balanceService.ts` | 단위 테스트 | 최우선 |
| `firebaseService.ts` | 통합 테스트 (모킹) | 높음 |
| `paymentService.ts` | 단위 테스트 | 높음 |
| TeamBalance 관련 hooks | 단위 테스트 | 중간 |
| 주요 사용자 플로우 | E2E 테스트 | 중간 |

**권장 도구**:
- 단위 테스트: Vitest (Vite 네이티브 지원)
- E2E 테스트: Playwright 또는 Cypress
- 커버리지 목표: 핵심 알고리즘 80% 이상

---

### 3.2 CI/CD 파이프라인 구축

**현재 상태**: CI/CD 설정 **완전 부재**

**필요 단계** (GitHub Actions 기준):
```
PR 트리거:
  1. TypeScript 타입 체크 (npx tsc --noEmit)
  2. ESLint 검사
  3. 단위 테스트 실행
  4. 프로덕션 빌드 검증 (npm run build)

Release 트리거:
  5. Android AAB 빌드
  6. Firebase Hosting 배포
  7. 버전 태깅
```

---

### 3.3 ESLint + Prettier 설정

**현재 상태**: 코드 품질 도구 **전무**

**필요 패키지**:
```
eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin
eslint-plugin-react, eslint-plugin-react-hooks
prettier, eslint-config-prettier
husky (pre-commit hooks)
```

**기대 효과**:
- `any` 타입 사용 감지 및 제거
- 미사용 import/변수 자동 감지
- 코드 스타일 일관성 유지

---

### 3.4 iOS 프로젝트 추가

**현재 상태**: `ios/` 디렉토리 **완전 부재** (CLAUDE.md에는 "iOS 지원"으로 기재)

**필요 작업**:
1. `npx cap add ios`
2. Info.plist: Google Auth, Push Notifications, Deep Link 설정
3. Xcode: Bundle ID, 서명, Capabilities 설정
4. Apple Developer 계정 연동
5. Kakao 로그인 Native SDK 연동 (현재 Web만 지원)

---

### 3.5 Firebase 보안 규칙 점검

**현재 문제**:
- `firebase.json`에 `firestore.rules` 파일이 명시되어 있지 않음
- 클라이언트 측에서만 방장(hostId) 권한 검증 수행
- 서버 측 인가(authorization) 규칙 미확인

**필요 작업**:
1. Firestore Security Rules 작성/점검
   - 사용자 본인 데이터만 수정 가능
   - 모집방은 hostId 사용자만 수정/삭제 가능
   - 참가 신청은 인증된 사용자만 가능
2. Storage Rules (사용 시)
3. `firebase.json`에 rules 파일 경로 명시

---

### 3.6 인앱 결제 함수 빈 구현 수정

**현재 문제** (`App.tsx:214`):
```typescript
const executePurchase = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {};
const handleRestorePurchases = async () => {};
```
- 두 함수가 **빈 구현**으로 실제 결제가 동작하지 않을 가능성

**필요 작업**:
- `paymentService.ts`의 `purchase()`, `restorePurchases()`와 연결
- 또는 이미 다른 경로로 처리된다면 빈 함수 정리

---

## 4. 🟡 Medium — 중기 개선

### 4.1 접근성(a11y) 강화

**현재 상태**: 기본적인 `aria-label` 9건, `aria-expanded` 3건만 구현

**필요 작업**:
| 항목 | 설명 |
|------|------|
| 폼 레이블 | `<label htmlFor>` 명시적 연결 (모든 input 대상) |
| 모달 포커스 트랩 | `useFocusTrap.ts` 존재하나 실제 적용 확인 필요 |
| 색상 대비 | WCAG AA 기준 (4.5:1) 검증 — 특히 다크모드 |
| 스크린 리더 | 주요 상태 변경 시 `aria-live` 안내 |
| 키보드 네비게이션 | Tab 순서, 모달 Escape 닫기 일관화 |
| Reduced Motion | `prefers-reduced-motion` 미디어 쿼리 지원 |

---

### 4.2 에러 핸들링 체계화

**현재 문제**:
- 모든 `catch` 블록이 동일한 패턴: `console.error` + 단일 에러 메시지
- 네트워크 에러 vs 권한 에러 vs 데이터 에러 구분 없음
- 에러 모니터링 도구 (Sentry 등) 미사용

**필요 작업**:
1. 에러 타입별 분류 체계 구축
2. 사용자에게 구체적 원인 안내 (네트워크 재연결 유도 등)
3. Firebase Crashlytics 활용 극대화 (현재 기본 설정만)
4. 프로덕션 `console.log` 제거 (현재 17개 파일에 116개 console 호출)

---

### 4.3 balanceService.ts 리팩토링

**현재 문제**: 단일 파일 1,977줄, 매직 넘버 다수

**필요 작업**:
```
balanceService.ts (1977줄) → 분리:
├── balanceService.ts          # 메인 진입점 (generateBalancedTeams)
├── algorithms/
│   ├── geneticAlgorithm.ts    # GA 관련 로직
│   ├── simulatedAnnealing.ts  # SA 최적화
│   └── hungarian.ts           # Hungarian 알고리즘
├── positionOptimizer.ts       # 포지션 배정 최적화
└── balanceConstants.ts        # POPULATION, GENERATIONS 등 상수
```

---

### 4.4 중복 신청 체크 강화

**현재 문제** (`firebaseService.ts`):
```typescript
// FCM 토큰만으로 중복 체크 → 토큰 없으면 우회 가능
const duplicate = currentApplicants.find(a => a.fcmToken === applicant.fcmToken);
```

**필요 작업**:
- `userId` 기반 중복 체크 추가
- 게스트 사용자도 `deviceId` 등으로 중복 방지

---

### 4.5 클라우드 동기화 안정성 개선

**현재 문제**:
- `PlayerContext.tsx`: 2초 디바운스 중 앱 종료 시 데이터 손실 가능
- `useRecruitmentRooms.ts`: 1초 디바운스, 동시 수정 시 충돌 가능
- `firebaseService.ts`: 재시도 로직에 지수 백오프(Exponential Backoff) 미구현

**필요 작업**:
1. `beforeunload` / `App.addListener('appStateChange')` 이벤트에서 즉시 동기화
2. Firestore Transaction 활용 (동시 수정 충돌 방지)
3. 재시도 로직에 지수 백오프 적용

---

## 5. 🟢 Low — 장기 개선

### 5.1 TypeScript strict 모드 활성화

**현재 상태**: `strict: false`, `any` 타입 다수 사용

**단계적 적용**:
1. `noImplicitAny` 먼저 활성화
2. `strictNullChecks` 활성화
3. 전체 `strict: true` 전환

---

### 5.2 반응형 디자인 개선

**현재 상태**: 모바일 단일 컬럼 중심, 반응형 브레이크포인트 1건만 사용

**필요 작업**:
- 태블릿(md:)/데스크톱(lg:) 레이아웃 추가
- 팀 밸런싱 결과를 넓은 화면에서 그리드로 표시
- 사이드바 네비게이션 (데스크톱)

---

### 5.3 PWA 지원

**현재 상태**: Web 버전이 단순 SPA로만 작동

**필요 작업**:
- `vite-plugin-pwa` 도입
- `manifest.json` 생성
- Service Worker 캐싱 전략 설정
- 오프라인 데이터 접근 지원

---

### 5.4 Vite 빌드 최적화

**현재 문제**: 코드 스플리팅, 소스맵, 브라우저 호환성 설정 없음

**필요 작업**:
- `build.rollupOptions`으로 vendor 청크 분리
- 프로덕션 소스맵 설정 (Crashlytics 연동)
- Tailwind CSS를 CDN에서 빌드 타임으로 전환

---

### 5.5 Android 설정 보완

**현재 문제**:
- 릴리즈 서명 키 설정이 `build.gradle`에 없음
- ProGuard 규칙이 기본 Capacitor 규칙만 포함

**필요 작업**:
- `signingConfigs` 추가 (Google Play 업로드용)
- Firebase, AdMob, Purchases 플러그인 ProGuard keep 규칙 추가

---

## 6. 미완성 기능 정리

| 기능 | 현재 상태 | 필요 작업 |
|------|----------|----------|
| **인앱 결제 실행** | `executePurchase`, `handleRestorePurchases` 빈 구현 | paymentService 연결 |
| **3-Tier 모드** | `tierMode?: '5TIER' \| '3TIER'` 타입만 정의 | UI 및 로직 구현 또는 타입 제거 |
| **대기자 시스템** | `Applicant.isWaiting` 필드만 존재 | 모집 초과 시 대기열 로직 구현 |
| **Kakao 네이티브 로그인** | Web OAuth만 구현 | Android/iOS SDK 연동 |
| **Unlimited Position 상품** | Product ID 정의됨 | 결제 플로우 연결 또는 제거 |
| **Analytics (Web)** | 네이티브만 동작 | Web용 Firebase Analytics 추가 |

---

## 7. 기술 부채 정리

| 항목 | 위치 | 설명 |
|------|------|------|
| 레거시 JS 파일 | `services/services/balanceService.js` | TS 버전으로 대체됨, 삭제 필요 |
| 미사용 컴포넌트 | `LoginRecommendModal.tsx` | App.tsx에서 import 안 됨, 삭제 가능 |
| 미사용 훅 | `useNavigation.ts`, `useTeamBalance.ts`, `useBalanceSettings.ts`, `usePlayerActions.ts` | Context로 이동 완료, 삭제 가능 |
| 포지션 다중 선택 마이그레이션 | `types.ts` Player 인터페이스 | `primaryPosition` (단일) vs `primaryPositions` (다중) 공존 |
| console.log 과다 | 17개 파일, 116건 | 프로덕션 빌드에서 제거 필요 |
| `any` 타입 과다 | 번역 함수, Context 등 | 점진적 타입 강화 필요 |

---

## 우선순위 종합 로드맵

```
Phase 1 — 보안 및 안정성 (Critical)
  ├── 2.1 API 키 환경변수 분리
  ├── 2.2 결제 서버 검증
  └── 2.3 민감 정보 보안

Phase 2 — 코드 품질 기반 (High)
  ├── 3.1 테스트 코드 (balanceService 우선)
  ├── 3.2 CI/CD 파이프라인
  ├── 3.3 ESLint + Prettier
  ├── 3.5 Firebase 보안 규칙
  └── 3.6 빈 결제 함수 수정

Phase 3 — 플랫폼 확장 (High)
  ├── 3.4 iOS 프로젝트 추가
  └── 6.x 미완성 기능 완료/정리

Phase 4 — 사용자 경험 (Medium)
  ├── 4.1 접근성 강화
  ├── 4.2 에러 핸들링 체계화
  ├── 4.3 balanceService 리팩토링
  └── 4.5 클라우드 동기화 안정화

Phase 5 — 장기 개선 (Low)
  ├── 5.1 TypeScript strict 모드
  ├── 5.2 반응형 디자인
  ├── 5.3 PWA 지원
  └── 5.4 빌드 최적화
```
