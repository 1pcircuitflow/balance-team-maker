# Balance Team Maker - Project Guide

## 필수 작업 규칙 (반드시 준수)
- **언어/말투**: 모든 답변을 한국어 반말로 할 것. 코딩 초보자도 이해하기 쉽고 공부할 수 있도록 설명할 것.
- **질문과 작업 구분**: 사용자가 질문하면 절대 바로 코드 수정하지 말 것. 반드시 대답만 → 제안 → 승인 후 진행할 것
- **작업방식**: 더 좋은 방안이 있으면 반드시 3가지 이상 선택지를 제안하고, 추천안 1개를 포함할 것, 작업 난이도, 로직꼬임 위험도도 포함할 것.
- **빌드/싱크**: 코드 수정 후 바로 `npm run build && npx cap sync`까지 진행할 것 (중간에 확인 받지 말 것)
- **커밋**: 중요한 작업이 끝날때에만 물어볼것. 사소한 작업은 절대 물어보지 말것.
- **CLAUDE.md 자동 업데이트**: 파일 생성/삭제, 아키텍처 변경 시 CLAUDE.md도 함께 업데이트할 것

## Overview
Balance Team Maker (앱 이름: Belo)는 축구, 풋살, 농구 등 스포츠 팀을 실력 기반으로 공정하게 나누는 크로스플랫폼 앱이다.
React + Capacitor + Firebase 기반으로, Android/iOS/Web 모두 지원한다.

- **App ID:** `com.balanceteammaker`
- **Version:** 2.1.26
- **Languages:** ko, en, es, ja, pt (5개 언어)

## Tech Stack
- **Frontend:** React 19 + TypeScript 5.8 + Tailwind CSS (CDN)
- **Build:** Vite 6
- **Native:** Capacitor 8 (Android/iOS)
- **Backend:** Firebase (Firestore, Auth, Analytics, Crashlytics)
- **Auth:** Google Auth + Kakao Login
- **Payments:** @capgo/native-purchases
- **Ads:** @capacitor-community/admob
- **AI:** @google/genai (Gemini API)
- **Font:** Pretendard

## Directory Structure
```
balance-team-maker/
├── App.tsx                    # 메인 앱 컴포넌트 (Provider 트리 + AppContent)
├── index.tsx                  # 엔트리 포인트
├── index.html                 # HTML 템플릿 + Tailwind 설정
├── types.ts                   # 전역 타입 정의 (Player, Team, BalanceResult, VenueData 등)
├── constants.ts               # 상수 (티어, 색상, 포지션, Z-Index 등)
├── translations.ts            # 다국어 번역 (ko/en/es/ja/pt)
├── Icons.tsx                  # SVG 아이콘 컴포넌트 모음
├── sampleData.ts              # 언어별 샘플 플레이어 데이터
│
├── components/                # UI 컴포넌트
│   ├── AdBanner.tsx           # 광고 배너
│   ├── AnnouncementBanner.tsx # 공지사항 배너
│   ├── BottomTabBar.tsx       # 하단 탭 바 (HOME/MEMBERS/SETTINGS)
│   ├── DateTimePicker.tsx     # 날짜/시간 선택기
│   ├── FormationPicker.tsx    # 포메이션 시각 편집기
│   ├── LanguageMenu.tsx       # 언어 선택 메뉴
│   ├── LoadingOverlay.tsx     # 로딩 오버레이
│   ├── MembersTabContent.tsx  # MEMBERS 탭 콘텐츠
│   ├── OfflineBanner.tsx      # 오프라인 상태 배너
│   ├── PlayerItem.tsx         # 플레이어 목록 아이템
│   ├── QuotaFormationPicker.tsx # 쿼터 포메이션 편집기
│   ├── ResultOverlay.tsx      # 밸런싱 결과 오버레이
│   ├── SelectionModeBar.tsx   # 선택 모드 하단 바
│   ├── SettingsPage.tsx       # 설정 페이지
│   ├── SportFilterButton.tsx  # HOME용 종목 드롭다운 필터
│   ├── SportSegmentControl.tsx# MEMBERS용 종목 세그먼트 컨트롤
│   ├── Toast.tsx              # 토스트 알림
│   ├── ChatTab.tsx            # 모집방 채팅 탭 (메시지 목록 + 입력창)
│   ├── VenueSearchInput.tsx   # 장소 검색 (카카오맵) + 사진 업로드 통합 컴포넌트
│   └── modals/                # 모달 컴포넌트
│       ├── BaseModal.tsx      # 모달 공통 베이스
│       ├── AlertModal.tsx     # 알림 모달
│       ├── ConfirmModal.tsx   # 확인 모달
│       ├── InfoModal.tsx      # 정보/프로필 모달
│       ├── OnboardingModal.tsx # 온보딩 (종목/티어/포지션 설정)
│       ├── UpdateModal.tsx    # 앱 업데이트 모달
│       ├── ReviewPrompt.tsx   # 리뷰 요청 모달
│       ├── LoginPage.tsx      # 로그인 페이지 (Google/Kakao)
│       ├── LoginRecommendModal.tsx # 로그인 권유 모달
│       ├── PositionLimitModal.tsx  # 포지션 제한 모달
│       ├── RewardAdModal.tsx  # 보상 광고 모달
│       ├── HostRoomModal.tsx  # 모집방 생성/관리 모달
│       ├── ApplyRoomModal.tsx # 모집방 참가 모달
│       └── MemberPickerModal.tsx   # 멤버 선택 모달
│
├── contexts/                  # React Context (Provider 패턴)
│   ├── AppContext.tsx          # 앱 전역 상태 (언어, 다크모드, 알림)
│   ├── AuthContext.tsx         # 인증 상태 (Google/Kakao Auth)
│   ├── PlayerContext.tsx       # 플레이어 데이터 관리
│   ├── NavigationContext.tsx   # 네비게이션 + activeTab/membersTab 상태
│   ├── TeamBalanceContext.tsx  # 팀 밸런싱 + 결과 공유
│   ├── RecruitmentContext.tsx  # 모집방 관리
│   └── PlayerActionsContext.tsx # 플레이어 액션 (삭제/토스트)
│
├── hooks/                     # Custom Hooks
│   ├── useNavigation.ts       # 페이지 네비게이션
│   ├── useTeamBalance.ts      # 팀 밸런싱 로직
│   ├── useBalanceGeneration.ts # 밸런싱 생성 로직
│   ├── useBalanceSettings.ts  # 밸런싱 설정 (색상, 쿼터)
│   ├── useRecruitmentRooms.ts # 모집방 관리
│   ├── useChat.ts             # 모집방 채팅 (메시지 구독/전송)
│   ├── useInitialization.ts   # 앱 초기화
│   ├── useAnnouncements.ts    # 공지사항 관리
│   ├── usePlayerActions.ts    # 플레이어 CRUD 액션
│   ├── useShareCapture.ts     # 결과 이미지 캡처/공유
│   ├── useNetworkStatus.ts    # 네트워크 상태 감지
│   └── useFocusTrap.ts        # 모달 포커스 트랩
│
├── services/                  # 비즈니스 로직 서비스
│   ├── balanceService.ts      # 팀 밸런싱 알고리즘 (GA 기반)
│   ├── firebaseService.ts     # Firebase CRUD
│   ├── analyticsService.ts    # 이벤트 추적
│   ├── paymentService.ts      # 인앱 결제
│   ├── kakaoAuthService.ts    # 카카오 로그인 서비스
│   ├── kakaoMapService.ts     # 카카오맵 키워드 검색 API 래퍼
│   └── storageService.ts      # Firebase Storage 업로드/다운로드 + 이미지 리사이징
│
├── pages/                     # 페이지 컴포넌트
│   ├── HomePage.tsx           # 홈 페이지 (경기 목록)
│   ├── DetailPage.tsx         # 경기 상세 페이지
│   ├── EditRoomPage.tsx       # 모집방 편집 페이지
│   ├── BalancePage.tsx        # 밸런싱 결과 페이지
│   ├── ProfileDetailPage.tsx  # 프로필 상세 페이지 (사진 + 실력정보)
│   ├── ChatListPage.tsx       # 채팅방 목록 페이지
│   └── ChatRoomPage.tsx       # 개별 채팅방 페이지
│
├── utils/
│   └── helpers.ts             # 유틸리티 함수
├── android/                   # Capacitor Android 네이티브
├── hosting/                   # Firebase Hosting (카카오 콜백 등)
├── firestore.rules            # Firestore 보안 규칙
├── firestore.indexes.json     # Firestore 인덱스
├── storage.rules              # Storage 보안 규칙
└── capacitor.config.ts        # Capacitor 설정
```

## Context Architecture
Provider 중첩 순서 (App.tsx):
```
AppProvider → AuthProvider → PlayerProvider → NavigationProvider
  → TeamBalanceProvider → RecruitmentProvider → PlayerActionsProvider → AppContent
```

- 각 Context는 대응하는 Hook을 감싸는 구조
- 대부분의 컴포넌트가 Context를 직접 consume (props drilling 최소화)
- `DetailPage`만 `setShowMemberPickerModal`을 prop으로 받음 (AppContent 로컬 모달 상태)

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

### Color System
색상은 반드시 **Tailwind 클래스**를 사용 (커스텀 hex 금지, 특수 컴포넌트 제외).

**역할별 색상:**
| 역할 | 색상 | 다크모드 |
|---|---|---|
| UI 구조 (배경/텍스트/보더) | `slate-*` 팔레트 | `dark:slate-*` |
| 활성/성공 | `emerald-500` | — |
| 정보/액센트/CTA | `blue-500` | — |
| 위험/삭제 | `rose-500` | — |
| 경고 | `amber-*` | — |
| 수정 버튼 | `orange-300` | — |

**포지션 적합도 색상:**
| 레벨 | 색상 |
|---|---|
| 주포지션 (100%) | `emerald-500` |
| 부포지션 (75%) | `yellow-400` |
| 3차 포지션 (50%) | `orange-400` |
| 금지 포지션 (X) | `rose-500` |

**특수 색상 (hex 허용):**
- 축구/풋살 필드: `#064e3b`, 농구 코트: `#E0BA87` / `dark:#5c3d2e`
- 카카오 버튼: `#FEE500`

### Typography
글씨 크기는 반드시 **`text-[Xpx]`** 형식을 사용 (Tailwind 표준 `text-sm` 등 사용 금지).

**크기 스케일:**
| 크기 | 용도 |
|---|---|
| `text-[7px]`~`text-[9px]` | 포메이션 라벨, 뱃지, 탭 라벨 |
| `text-[10px]`~`text-[11px]` | 소형 라벨, 보조 텍스트 |
| `text-[12px]` | 본문, 포지션 태그, 일반 버튼 |
| `text-[13px]` | 설정 라벨, 필터 버튼 |
| `text-[14px]` | 표준 텍스트, 탭 헤더, 수정/삭제 버튼 |
| `text-[16px]` | 플레이어 이름, 방 제목, 폼 입력 |
| `text-[18px]`~`text-[20px]` | 큰 헤딩, 참가자 수, 스쿼드 합계 |
| `text-[24px]`~`text-[48px]` | 모달 제목, 보상 아이콘 |

**굵기 규칙:**
| 굵기 | 용도 |
|---|---|
| `font-medium` | 본문, 라벨, 포지션 태그, 플레이어 이름 |
| `font-semibold` | 섹션 헤더, 페이지 제목, 모달 제목 |
| `font-bold` | 버튼 텍스트, CTA, 탭 라벨 |
| `font-black` | 핵심 수치, 카드 제목, 포메이션 ID |

### Button & Container Styles
역할별 표준 스타일이 정의되어 있으며, 새 컴포넌트도 아래 규칙을 따른다.

**버튼:**
| 역할 | 클래스 |
|---|---|
| Primary CTA | `bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-blue-500/30` |
| Secondary CTA | `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold py-3 rounded-2xl` |
| Danger CTA | `bg-rose-500 text-white font-bold py-3 rounded-2xl` |
| Ghost | `text-slate-400 font-semibold py-3 rounded-2xl` (배경 없음) |

**컨테이너:**
| 역할 | 클래스 |
|---|---|
| 모달 | `rounded-[2.5rem] p-8` |
| 카드 (대형) | `rounded-3xl` (24px) |
| 카드 (일반) | `rounded-2xl p-4` |
| 입력 필드 | `rounded-xl px-4 py-3` |
| Pill/Chip | `rounded-full px-3 py-1.5` |

**구분선:**
| 클래스 |
|---|
| `h-px bg-slate-200 dark:bg-slate-700` |

**주의:** `rounded-[24px]` 사용 금지 → `rounded-3xl` 사용. Primary CTA에 `bg-slate-900` 사용 금지 → `bg-blue-500` 사용.

### Transition Duration
| 용도 | Duration |
|---|---|
| 호버/클릭 반응 | `duration-200` |
| 패널/탭 전환 | `duration-300` |
| 페이지/모달 진입 | `duration-500` |
| 프로그레스바 | `duration-1000` |

### Active Scale 효과
| 버튼 크기 | Scale |
|---|---|
| 전체 너비 CTA | `active:scale-[0.98]` |
| 일반 버튼 | `active:scale-95` |
| 작은 아이콘 버튼 | `active:scale-90` |

### Z-index 관리
z-index는 `constants.ts`의 `Z_INDEX` 상수를 사용. 하드코딩(`z-[XXXX]`) 금지.
`style={{ zIndex: Z_INDEX.XXX }}` 패턴으로 적용.

### 광고 배너 하단 레이아웃 규칙
네이티브 광고 배너(AdMob)가 화면 최하단에 고정 표시됨 (약 56~80px). 전체화면 오버레이 페이지를 만들 때 반드시 아래 패턴을 따를 것:

```tsx
// 컨테이너: inset-0 사용 금지 → top-0 + bottom으로 광고 영역 회피
<div className="fixed left-0 right-0 top-0 ..."
  style={{ zIndex: Z_INDEX.PAGE_OVERLAY, bottom: isAdFree ? '0px' : '80px' }}>
```

- `fixed inset-0` 사용 금지 → `fixed left-0 right-0 top-0` + `bottom` 동적 설정
- 광고 있을 때(`!isAdFree`): `bottom: '80px'` — 컨테이너가 광고 위에서 끝남
- 광고 없을 때(`isAdFree`): `bottom: '0px'` — 전체 화면 사용
- 하단 콘텐츠의 safe-area: `paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : '0px'`
- 참고 페이지: `BalancePage`, `EditRoomPage`, `HostRoomModal`, `ChatRoomPage`

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
- `TranslationKey` 타입은 `en` 블록 키에서 자동 유추

## Navigation Structure
- **BottomTab:** HOME | MEMBERS | CHAT | SETTINGS
- **Pages:** HOME → DETAIL → BALANCE / EDIT_ROOM, CHAT → CHAT_ROOM, SETTINGS → PROFILE
- **종목 탭 UX:**
  - HOME: `SportFilterButton` (드롭다운 필터, `activeTab` 상태)
  - MEMBERS: `SportSegmentControl` (세그먼트 컨트롤 + 스와이프, `membersTab` 상태)

## Build & Deploy Commands
```bash
# 개발 서버
npm run dev          # localhost:3000

# 프로덕션 빌드
npm run build        # dist/ 출력

# Android 싱크 & 열기
npx cap sync         # 웹 빌드를 Android에 동기화
npx cap open android # Android Studio 열기

# TypeScript 체크
npx tsc --noEmit

# Firebase Hosting 배포
firebase deploy --only hosting
```

## Key Business Logic
- **팀 밸런싱:** `services/balanceService.ts`의 `generateBalancedTeams()` — GA(유전 알고리즘) 기반
- **제약 조건:** MATCH(같은 팀) / SPLIT(다른 팀) 제약
- **포지션 쿼터:** 팀별 포지션 수 고정/자동 설정
- **티어 시스템:** S(5) > A(4) > B(3) > C(2) > D(1)
- **스포츠 종목:** Soccer, Futsal, Basketball, General
- **모집방:** 링크 공유 → 지원 → 승인 플로우 (Firestore 실시간)
