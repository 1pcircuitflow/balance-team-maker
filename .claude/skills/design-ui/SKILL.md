# /design-ui - UI/UX 디자인 어시스턴트

프로젝트의 Tailwind CSS 디자인 시스템을 사용하여 UI 컴포넌트를 설계하고 구현하며, 기존 앱 스타일과의 일관성을 보장합니다.

## 사용법
```
/design-ui <컴포넌트_또는_화면_설명>
```

## 인수 ($ARGUMENTS)
$ARGUMENTS

## 지침

### 1단계: 디자인 요청 이해
1. `$ARGUMENTS`에서 컴포넌트/화면 설명을 파싱합니다.
2. 다음을 결정합니다:
   - 새로운 컴포넌트인가 아니면 기존 컴포넌트의 수정인가?
   - 컨텍스트는 무엇인가 (모달, 페이지, 카드, 리스트 아이템 등)?
   - 어떤 데이터를 표시하거나 상호작용하는가?

### 2단계: 기존 디자인 시스템 분석
현재 디자인 패턴을 이해하기 위해 다음 파일들을 읽습니다:
1. `index.html` - Tailwind 설정, 글로벌 스타일, 애니메이션
2. `components/SettingsPage.tsx` - 설정 UI 패턴 (토글, 섹션, 리스트 아이템)
3. `components/PlayerItem.tsx` - 리스트 아이템 패턴 (배지, 액션, 편집 모드)
4. `App.tsx` - 레이아웃 구조, 하단 탭, 모달, 오버레이
5. `constants.ts` - 컬러 스키마 (TIER_BADGE_COLORS, TEAM_COLORS, Z_INDEX)

### 3단계: 디자인 시스템 적용

#### 컬러 팔레트
- **배경:** `bg-white dark:bg-slate-950` (카드), `bg-slate-50 dark:bg-slate-900` (페이지)
- **기본 텍스트:** `text-slate-800 dark:text-slate-200`
- **보조 텍스트:** `text-slate-500 dark:text-slate-400`
- **비활성 텍스트:** `text-slate-400 dark:text-slate-600`
- **강조:** `bg-emerald-500` (기본 액션), `bg-blue-500` (정보)
- **위험:** `bg-red-500` 또는 `text-red-500`
- **테두리:** `border-slate-200 dark:border-slate-800`
- **구분선:** `border-t border-slate-100 dark:border-slate-800`

#### 간격 및 크기
- **카드 패딩:** `p-4` 또는 `px-4 py-3`
- **섹션 간격:** `space-y-3` 또는 `gap-3`
- **테두리 반경:** `rounded-2xl` (카드), `rounded-xl` (버튼), `rounded-full` (필/아바타)
- **페이지 패딩:** `px-4`

#### 타이포그래피
- **폰트:** Pretendard (글로벌 설정)
- **헤딩:** `text-lg font-bold` 또는 `text-xl font-bold`
- **본문:** `text-sm` (기본), `text-xs` (캡션)
- **자간:** `letter-spacing: -0.025em` (글로벌)

#### 상호작용 요소
- **버튼 (기본):** `bg-emerald-500 text-white rounded-xl px-4 py-2.5 font-semibold`
- **버튼 (보조):** `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl px-4 py-2.5`
- **토글 스위치:** `SettingsPage.tsx`의 ToggleSwitch 패턴 참조
- **터치 피드백:** `active:scale-[0.98]` 또는 `active:opacity-80`

#### 애니메이션 및 트랜지션
- **진입 애니메이션:** `animate-in` (slideInUp 0.4s)
- **트랜지션:** `transition-all duration-200`
- **로딩:** `animate-spin-slow` (3s 회전)
- **프로그레스:** `animate-progress` (바 채우기)

#### 모달 패턴
```
z-index: Z_INDEX 상수 (constants.ts 내의 타입)
배경(Backdrop): fixed inset-0 bg-black/60 z-[X]
컨테이너: fixed inset-x-0 bottom-0 (바텀 시트) 또는 중앙 정렬
콘텐츠: bg-white dark:bg-slate-900 rounded-t-3xl (바텀 시트)
```

#### 다크 모드
- 모든 컬러 클래스에는 `dark:` 변형이 있어야 합니다.
- `class` 전략을 사용합니다 (`<html>` 요소에 토글됨).
- 라이트 모드와 다크 모드 모두 시각적으로 테스트합니다.

### 4단계: 컴포넌트 코드 생성
1. TypeScript를 사용하는 React 함수형 컴포넌트를 생성합니다.
2. 위의 패턴에 따라 Tailwind 클래스를 사용합니다.
3. 적절한 다크 모드 지원을 포함합니다.
4. 반응형 고려 사항(모바일 우선)을 추가합니다.
5. 적절한 곳에 애니메이션/트랜지션을 포함합니다.
6. 모바일의 안전 영역 인셋을 처리합니다: `env(safe-area-inset-bottom)`

### 5단계: 디자인 제시
다음을 제공합니다:
1. 전체 컴포넌트 코드
2. 디자인 결정 사항에 대한 간략한 설명
3. 주요 요소에 대한 Tailwind 클래스 분석
4. 다크 모드 미리보기 참고 사항
5. 필요한 모든 Props/인터페이스

## 디자인 원칙
- **모바일 우선:** 휴대폰 화면(너비 360-414px)을 기준으로 디자인합니다.
- **일관성:** 기존 앱의 느낌과 정확히 일치시킵니다.
- **접근성:** 충분한 대비, 터치 대상 크기 44px 이상을 확보합니다.
- **성능:** 리스트 아이템에 무거운 애니메이션을 피합니다.
- **안전 영역:** 장치의 노치 및 홈 인디케이터를 고려합니다.

## 중요 참고 사항
- Tailwind는 PostCSS가 아닌 CDN을 통해 로드됩니다 (@apply 사용 불가).
- 커스텀 컬러는 `index.html`의 tailwind.config에 정의되어 있습니다.
- 앱은 Pretendard 폰트 시스템을 사용합니다 (한글/일어 최적화).
- 하단 네비게이션 탭의 높이는 약 60px이며 안전 영역이 추가됩니다.
- 모달은 `constants.ts`의 Z_INDEX 상수를 사용합니다.
