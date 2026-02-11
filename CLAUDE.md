# Balance Team Maker - Project Guide

## Overview
Balance Team Maker (앱 이름: Belo)는 축구, 풋살, 농구 등 스포츠 팀을 실력 기반으로 공정하게 나누는 크로스플랫폼 앱이다.
React + Capacitor + Firebase 기반으로, Android/iOS/Web 모두 지원한다.

- **App ID:** `com.balanceteammaker`
- **Version:** `package.json` 참조 (현재 2.x)
- **Languages:** ko, en, es, ja, pt (5개 언어)

## Tech Stack
- **Frontend:** React 19 + TypeScript 5.8 + Tailwind CSS (CDN)
- **Build:** Vite 6
- **Native:** Capacitor 8 (Android/iOS)
- **Backend:** Firebase (Firestore, Auth, Analytics, Crashlytics)
- **Payments:** @capgo/native-purchases
- **Ads:** @capacitor-community/admob
- **AI:** @google/genai (Gemini API)
- **Font:** Pretendard

## Directory Structure
```
balance-team-maker/
├── App.tsx                  # 메인 앱 컴포넌트 (대규모 파일)
├── index.tsx                # 엔트리 포인트
├── index.html               # HTML 템플릿 + Tailwind 설정
├── types.ts                 # 전역 타입 정의 (Player, Team, BalanceResult 등)
├── constants.ts             # 상수 (티어, 색상, 포지션, Z-Index 등)
├── translations.ts          # 다국어 번역 (ko/en/es/ja/pt)
├── Icons.tsx                # SVG 아이콘 컴포넌트 모음
├── sampleData.ts            # 언어별 샘플 플레이어 데이터
├── components/              # UI 컴포넌트
│   ├── SettingsPage.tsx     # 설정 페이지
│   ├── PlayerItem.tsx       # 플레이어 목록 아이템
│   ├── AdBanner.tsx         # 광고 배너
│   ├── DateTimePicker.tsx   # 날짜/시간 선택기
│   ├── FormationPicker.tsx  # 포메이션 시각 편집기
│   ├── QuotaFormationPicker.tsx # 쿼터 포메이션 편집기
│   ├── LoadingOverlay.tsx   # 로딩 오버레이
│   └── LanguageMenu.tsx     # 언어 선택 메뉴
├── contexts/                # React Context
│   ├── AppContext.tsx        # 앱 전역 상태 (언어, 다크모드, 알림)
│   ├── AuthContext.tsx       # 인증 상태 (Google Auth)
│   └── PlayerContext.tsx     # 플레이어 데이터 관리
├── hooks/                   # Custom Hooks
│   ├── useNavigation.ts     # 페이지 네비게이션
│   ├── useTeamBalance.ts    # 팀 밸런싱 로직
│   ├── useRecruitmentRooms.ts # 모집방 관리
│   └── useInitialization.ts # 앱 초기화
├── services/                # 비즈니스 로직 서비스
│   ├── balanceService.ts    # 팀 밸런싱 알고리즘
│   ├── firebaseService.ts   # Firebase CRUD
│   ├── analyticsService.ts  # 이벤트 추적
│   └── paymentService.ts    # 인앱 결제
├── pages/                   # 페이지 컴포넌트
│   └── HomePage.tsx         # 홈 페이지
├── utils/
│   └── helpers.ts           # 유틸리티 함수
├── android/                 # Capacitor Android 네이티브
├── hosting/                 # Firebase Hosting 빌드 결과
└── capacitor.config.ts      # Capacitor 설정
```

## Coding Conventions

### Component Pattern
- 함수형 컴포넌트 + React.memo 사용
- Props는 interface로 정의
- 상태 관리: Context + Custom Hook 패턴
- 데이터 흐름: Context → Hook → Service → Component

### Tailwind CSS
- CDN 방식 (`<script src="https://cdn.tailwindcss.com">`)
- 다크모드: `class` 전략 (`dark:` 접두사)
- 커스텀 색상: slate 팔레트 오버라이드 (index.html에 정의)
- 자주 쓰는 패턴:
  - 카드: `bg-white dark:bg-slate-950 rounded-2xl p-4`
  - 텍스트: `text-slate-800 dark:text-slate-200`
  - 보더: `border border-slate-200 dark:border-slate-800`
  - 버튼: `bg-emerald-500 text-white rounded-xl px-4 py-2`
  - 전환: `transition-all duration-200`

### TypeScript
- 타겟: ES2022
- strict mode 아님 (noEmit만 설정)
- 경로 별칭: `@/*` → 프로젝트 루트
- 타입: `types.ts`에 중앙 관리

### Translation Pattern
`translations.ts`에서 5개 언어 블록을 관리:
```typescript
export const TRANSLATIONS = {
  en: { key: 'value', funcKey: (n: number) => `text ${n}` },
  es: { ... },
  ja: { ... },
  ko: { ... },
  pt: { ... },
};
```
- 언어 블록 순서: en → es → ja → ko → pt (알파벳순)
- 각 블록 내 키도 기존 순서 유지
- 함수형 번역 지원: `(param) => \`template ${param}\``

## Build & Deploy Commands
```bash
# 개발 서버
npm run dev          # localhost:3000

# 프로덕션 빌드
npm run build        # dist/ 출력

# Android
npx cap sync         # 웹 빌드를 Android에 동기화
npx cap open android # Android Studio 열기

# TypeScript 체크
npx tsc --noEmit

# Firebase Hosting 배포
firebase deploy --only hosting
```

## Key Business Logic
- **팀 밸런싱:** `services/balanceService.ts`의 `generateBalancedTeams()` 함수
- **제약 조건:** MATCH(같은 팀) / SPLIT(다른 팀) 제약
- **포지션 쿼터:** 팀별 포지션 수 고정/자동 설정
- **티어 시스템:** S(5) > A(4) > B(3) > C(2) > D(1)
- **스포츠 종목:** Soccer, Futsal, Basketball, General
