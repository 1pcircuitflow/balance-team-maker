# 기능 기획서: 4가지 신규 기능

> 작성일: 2026-02-15

---

## 전체 기능 우선순위

| 순위 | 기능 | 난이도 | 예상 효과 | 이유 |
|------|------|--------|----------|------|
| 1 | 팀나누기 포메이션화 | ⭐⭐ (낮음) | 높음 | 프론트엔드만으로 구현 가능, 기존 FormationPicker 패턴 재사용, 시각적 임팩트 큼 |
| 2 | 매너온도 | ⭐⭐⭐ (중간) | 높음 | Firebase 컬렉션 추가 필요하지만 로직 단순, 커뮤니티 활성화 효과 |
| 3 | 지도 (Google Maps) | ⭐⭐⭐ (중간) | 중간 | 외부 API 연동 필요, API 키 관리/비용 발생, UX 개선 효과 |
| 4 | 채팅 | ⭐⭐⭐⭐ (높음) | 중간 | Firestore 비용/보안 규칙/키보드 UX 등 복잡도 높음, 대체재(카톡) 존재 |

---

## 1. 매너온도

### 기능 이해
- **문제:** 실력(티어)만으로는 알 수 없는 플레이어의 매너/인성을 평가할 방법이 없음
- **타겟:** 모집방 호스트 및 참가자
- **핵심 흐름:** 경기 후 → 상대/팀원 평가 → 매너온도 누적 → 프로필에 표시

### 데이터 모델 변경

**types.ts 추가:**
```typescript
export interface MannerRating {
  id: string;                    // 평가 ID
  fromUserId: string;           // 평가자 UID
  toUserId: string;             // 피평가자 UID
  roomId: string;               // 경기방 ID
  score: number;                // -1 (비매너) | 0 (보통) | 1 (매너)
  timestamp: string;            // ISO
}
```

**UserProfile 확장:**
```typescript
// UserProfile에 추가
mannerScore?: number;           // 누적 점수 (기본 36.5)
mannerCount?: number;           // 평가 횟수
```

**constants.ts 추가:**
```typescript
export const MANNER_DEFAULT = 36.5;
export const MANNER_MIN = 0;
export const MANNER_MAX = 99;
export const MANNER_COLORS = {
  hot: 'text-rose-500',      // 80+
  warm: 'text-orange-400',   // 60-79
  normal: 'text-emerald-500', // 36.5-59
  cool: 'text-blue-400',     // 20-35
  cold: 'text-slate-400',    // 0-19
};
```

### 백엔드/서비스

**Firebase 컬렉션:**
- `mannerRatings/{ratingId}` — 개별 평가 기록
- `users/{uid}` — `mannerScore`, `mannerCount` 필드 추가

**services/mannerService.ts (신규):**
- `submitMannerRating(fromUid, toUid, roomId, score)` — 평가 제출 + 점수 갱신
- `getMannerScore(uid)` — 매너온도 조회
- `hasRated(fromUid, toUid, roomId)` — 중복 평가 방지
- 온도 계산: `newScore = prevScore + (score * weight)` (weight는 평가 횟수에 반비례)

### 상태 관리
- 별도 Context 불필요 — `AuthContext`의 UserProfile에 포함
- `useMannerRating` 훅: 평가 제출/조회 로직

### UI 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| `MannerBadge` | components/ | 온도 표시 뱃지 (🌡 36.5°) |
| `MannerRatingModal` | components/modals/ | 경기 후 평가 모달 (👍/😐/👎) |

**진입점:**
- 경기방 상세 → 경기 종료 후 → "매너 평가하기" 버튼 → MannerRatingModal
- 프로필/InfoModal → MannerBadge 표시
- 모집방 참가자 목록 → 이름 옆 매너온도 표시

### 번역 키 (예시)
```
mannerTemperature: '매너온도'
mannerRate: '매너 평가하기'
mannerGood: '매너 좋아요'
mannerNormal: '보통이에요'
mannerBad: '비매너예요'
mannerRated: '이미 평가했어요'
```

### 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| types.ts | MODIFY | MannerRating 인터페이스, UserProfile 확장 |
| constants.ts | MODIFY | 매너 상수 추가 |
| services/mannerService.ts | CREATE | 매너 평가 서비스 |
| hooks/useMannerRating.ts | CREATE | 매너 평가 훅 |
| components/MannerBadge.tsx | CREATE | 온도 표시 뱃지 |
| components/modals/MannerRatingModal.tsx | CREATE | 평가 모달 |
| components/modals/InfoModal.tsx | MODIFY | 매너온도 뱃지 표시 |
| pages/DetailPage.tsx | MODIFY | 평가 진입점 추가 |
| translations.ts | MODIFY | 매너 관련 키 추가 |

### 구현 순서
1. types.ts + constants.ts (타입/상수)
2. services/mannerService.ts (Firebase 로직)
3. hooks/useMannerRating.ts (상태)
4. MannerBadge.tsx (UI)
5. MannerRatingModal.tsx (UI)
6. DetailPage/InfoModal 통합
7. translations.ts (번역)

### 고려 사항
- **어뷰징 방지:** 같은 경기방에서 같은 상대에게 1회만 평가 가능
- **익명성:** 누가 평가했는지는 피평가자에게 노출하지 않음
- **수익화:** 무료 기능 (활성 사용자 유지 목적)
- **마이그레이션:** 기존 유저는 `mannerScore: 36.5`로 초기화

---

## 2. 지도 (Google Maps)

### 기능 이해
- **문제:** 모집방에 "장소"를 텍스트로만 입력 → 정확한 위치 파악 어려움
- **타겟:** 모집방 참가자 (길찾기 필요)
- **핵심 흐름:** 방 생성 시 → 지도에서 장소 검색/선택 → 좌표 저장 → 참가자가 지도로 확인

### 데이터 모델 변경

**types.ts / firebaseService.ts 확장:**
```typescript
// RecruitmentRoom에 추가
venueLocation?: {
  lat: number;
  lng: number;
  address: string;          // 주소
  placeName: string;        // 장소명
};
```

### 백엔드/서비스

**Google Maps API 사용:**
- Places API (장소 검색/자동완성)
- Maps JavaScript API (지도 표시)
- Geocoding API (주소 → 좌표)

**services/mapService.ts (신규):**
- `searchPlaces(query)` — 장소 검색
- `getPlaceDetails(placeId)` — 장소 상세 정보
- `openNativeMap(lat, lng, name)` — 네이티브 지도 앱 열기 (길찾기)

### 상태 관리
- `RecruitmentContext`에 `venueLocation` 필드 추가
- 별도 Context/Hook 불필요 (mapService 직접 호출)

### UI 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| `MapPicker` | components/ | 장소 검색 + 지도 선택 UI |
| `MapPreview` | components/ | 읽기 전용 지도 미리보기 + 길찾기 버튼 |

**진입점:**
- 모집방 생성/편집(HostRoomModal, EditRoomPage) → 장소 입력 옆 "지도에서 선택" 버튼 → MapPicker
- 모집방 상세(DetailPage) / 참가 모달(ApplyRoomModal) → MapPreview (위치 확인 + 길찾기)

### 번역 키 (예시)
```
selectOnMap: '지도에서 선택'
searchPlace: '장소 검색'
getDirections: '길찾기'
noLocationSet: '장소가 설정되지 않았어요'
```

### 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| types.ts | MODIFY | VenueLocation 타입 추가 |
| services/mapService.ts | CREATE | 지도 서비스 |
| components/MapPicker.tsx | CREATE | 장소 선택 컴포넌트 |
| components/MapPreview.tsx | CREATE | 지도 미리보기 |
| components/modals/HostRoomModal.tsx | MODIFY | 지도 선택 연동 |
| pages/EditRoomPage.tsx | MODIFY | 지도 선택 연동 |
| pages/DetailPage.tsx | MODIFY | 지도 미리보기 표시 |
| components/modals/ApplyRoomModal.tsx | MODIFY | 지도 미리보기 표시 |
| contexts/RecruitmentContext.tsx | MODIFY | venueLocation 상태 추가 |
| index.html | MODIFY | Google Maps SDK 스크립트 추가 |
| translations.ts | MODIFY | 지도 관련 키 추가 |

### 구현 순서
1. Google Maps API 키 발급 + index.html에 SDK 추가
2. types.ts (VenueLocation 타입)
3. services/mapService.ts
4. MapPicker.tsx (장소 검색/선택)
5. MapPreview.tsx (읽기 전용 미리보기)
6. HostRoomModal/EditRoomPage 통합
7. DetailPage/ApplyRoomModal 통합
8. translations.ts

### 고려 사항
- **비용:** Google Maps API는 월 $200 무료 크레딧 → 초과 시 과금. Places API 요청 제한 필요
- **플랫폼:** 네이티브(Android/iOS)에서 "길찾기" 클릭 시 Google Maps/Apple Maps 앱으로 이동 (`Capacitor.isNativePlatform()` 분기)
- **오프라인:** 지도 로드 실패 시 텍스트 주소만 표시하는 폴백 필요
- **API 키 보안:** 키를 프론트엔드에 노출해야 하므로 HTTP 리퍼러 제한 + API 제한 설정 필수
- **수익화:** 기본 기능으로 제공 (모집방 UX 향상 목적)

---

## 3. 채팅 구현

### 기능 이해
- **문제:** 모집방 참가자 간 소통 수단이 없음 (별도 메신저 필요)
- **타겟:** 모집방 호스트 + 참가자
- **핵심 흐름:** 모집방 상세 → 채팅 탭 → 실시간 메시지 송수신

### 데이터 모델 변경

**types.ts 추가:**
```typescript
export interface ChatMessage {
  id: string;
  roomId: string;               // 모집방 ID
  senderId: string;             // 발신자 UID
  senderName: string;           // 발신자 이름
  message: string;              // 메시지 내용
  timestamp: string;            // ISO
  type: 'TEXT' | 'SYSTEM';      // 일반 메시지 / 시스템 메시지
}
```

### 백엔드/서비스

**Firebase 컬렉션:**
- `rooms/{roomId}/messages/{messageId}` — 서브컬렉션
- Firestore 실시간 리스너 사용 (기존 모집방 패턴과 동일)

**services/chatService.ts (신규):**
- `sendMessage(roomId, senderId, senderName, message)` — 메시지 전송
- `subscribeToMessages(roomId, callback)` — 실시간 메시지 구독
- `getRecentMessages(roomId, limit)` — 최근 메시지 조회

### 상태 관리
- `useChatMessages(roomId)` 훅: 메시지 구독/전송 로직
- 별도 Context 불필요 — DetailPage 내에서 훅으로 관리

### UI 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| `ChatPanel` | components/ | 채팅 메시지 목록 + 입력 UI |
| `ChatBubble` | components/ | 개별 메시지 버블 |

**진입점:**
- DetailPage → 참가자 목록 아래 또는 별도 탭으로 채팅 영역 → ChatPanel

### 번역 키 (예시)
```
chat: '채팅'
typeMessage: '메시지를 입력하세요'
sendMessage: '전송'
noMessages: '아직 메시지가 없어요'
chatJoined: '{name}님이 참가했어요'
chatLeft: '{name}님이 나갔어요'
```

### 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| types.ts | MODIFY | ChatMessage 인터페이스 추가 |
| services/chatService.ts | CREATE | 채팅 서비스 |
| hooks/useChatMessages.ts | CREATE | 채팅 메시지 훅 |
| components/ChatPanel.tsx | CREATE | 채팅 패널 |
| components/ChatBubble.tsx | CREATE | 메시지 버블 |
| pages/DetailPage.tsx | MODIFY | 채팅 영역 통합 |
| translations.ts | MODIFY | 채팅 관련 키 추가 |

### 구현 순서
1. types.ts (ChatMessage 타입)
2. services/chatService.ts (Firestore 실시간)
3. hooks/useChatMessages.ts
4. ChatBubble.tsx (개별 메시지)
5. ChatPanel.tsx (목록 + 입력)
6. DetailPage 통합
7. translations.ts

### 고려 사항
- **Firestore 비용:** 메시지가 많아지면 읽기 비용 급증 → 메시지 최대 100개 제한 + 오래된 메시지 자동 삭제 고려
- **보안 규칙:** 해당 방 참가자(승인된 applicant 또는 host)만 읽기/쓰기 가능하도록 Firestore Rules 설정
- **푸시 알림:** FCM과 연동하면 앱 백그라운드에서도 새 메시지 알림 가능 (추후 확장)
- **키보드 UX:** 모바일에서 키보드가 올라올 때 채팅 영역이 밀려나지 않도록 처리
- **수익화:** Pro 기능으로 검토 가능 (채팅은 서버 비용 발생)

---

## 4. 팀 나누기 결과 포메이션화

### 기능 이해
- **문제:** 팀 밸런싱 결과가 텍스트 리스트로만 표시됨 → 포메이션 시각화 부재
- **타겟:** 모든 사용자 (결과 공유 시 시각적 임팩트)
- **핵심 흐름:** 팀 밸런싱 완료 → 결과 페이지에서 "포메이션 보기" 토글 → 경기장 위에 선수 배치 시각화

### 데이터 모델 변경
- 새로운 타입 불필요 — 기존 `BalanceResult.teams[].players[].assignedPosition`과 `FORMATION_POSITIONS` 활용

**constants.ts 추가 (선택):**
```typescript
// 같은 포지션에 여러 선수가 배정될 경우의 오프셋 좌표
export const FORMATION_MULTI_OFFSET: Record<number, { dx: string; dy: string }[]> = {
  2: [{ dx: '-12%', dy: '0%' }, { dx: '12%', dy: '0%' }],
  3: [{ dx: '-15%', dy: '0%' }, { dx: '0%', dy: '0%' }, { dx: '15%', dy: '0%' }],
};
```

### 백엔드/서비스
- 추가 서비스 불필요 — 순수 프론트엔드 시각화

### 상태 관리
- `BalancePage` 로컬 상태: `showFormation: boolean` (리스트/포메이션 토글)
- 기존 `TeamBalanceContext`의 `result` 데이터 그대로 사용

### UI 컴포넌트

| 컴포넌트 | 위치 | 설명 |
|---------|------|------|
| `TeamFormationView` | components/ | 팀별 포메이션 시각화 (경기장 + 선수 배치) |

**렌더링 로직:**
1. `result.teams` 순회
2. 각 팀의 `players`를 `assignedPosition`으로 그룹핑
3. `FORMATION_POSITIONS[sportType]`에서 좌표 매핑
4. 같은 포지션에 복수 선수 → `FORMATION_MULTI_OFFSET`으로 분산
5. 경기장 배경 (기존 FormationPicker의 배경 로직 재사용)
6. 선수 이름 + 티어 뱃지를 포지션 좌표에 표시

**진입점:**
- BalancePage → 결과 표시 영역 상단에 리스트/포메이션 토글 버튼
- 포메이션 모드에서 팀별 카드 대신 TeamFormationView 표시

### UI/UX 흐름
```
BalancePage (결과 생성 후)
  ├─ [리스트 | 포메이션] 토글
  │
  ├─ 리스트 모드 (기존)
  │   └─ 팀별 카드 + 선수 리스트
  │
  └─ 포메이션 모드 (신규)
      └─ 팀별 경기장 뷰
          ├─ 경기장 배경 (축구: 초록, 농구: 나무)
          ├─ 팀 헤더 (팀명 + 색상 + 실력합)
          └─ 선수 원형 노드 (포지션 좌표에 배치)
              ├─ 선수 이름 (text-[9px])
              ├─ 배정 포지션 (text-[7px])
              └─ 티어 뱃지 (컬러)
```

### 번역 키 (예시)
```
viewFormation: '포메이션'
viewList: '리스트'
```

### 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| constants.ts | MODIFY | 다중 선수 오프셋 좌표 추가 |
| components/TeamFormationView.tsx | CREATE | 팀별 포메이션 시각화 |
| pages/BalancePage.tsx | MODIFY | 리스트/포메이션 토글 + TeamFormationView 연동 |
| components/ResultOverlay.tsx | MODIFY | (사용 중이라면) 동일 토글 추가 |
| translations.ts | MODIFY | 포메이션 관련 키 추가 |

### 구현 순서
1. constants.ts (다중 선수 오프셋)
2. TeamFormationView.tsx (경기장 + 선수 배치)
3. BalancePage.tsx 통합 (토글 버튼)
4. translations.ts

### 고려 사항
- **General 종목:** 포지션이 없으므로 포메이션 뷰 비활성화 (리스트만 표시)
- **공유 이미지:** 포메이션 뷰도 `useShareCapture`로 이미지 캡처 가능해야 함
- **반응형:** 모바일에서 경기장이 너무 작으면 선수 이름이 겹침 → 적절한 max-width + 오프셋 조정
- **수익화:** 무료 기능 (결과 공유 활성화 → 앱 홍보 효과)
