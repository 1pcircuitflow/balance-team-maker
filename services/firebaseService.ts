import { initializeApp } from "firebase/app";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    limit,
    getDocs,
    writeBatch,
    increment,
    runTransaction
} from "firebase/firestore";
import { getRemoteConfig, fetchAndActivate, getValue, getAll } from "firebase/remote-config";
import { PushNotifications } from '@capacitor/push-notifications';
import { Player, UserProfile, SportType, VenueData, ChatMessage } from "../types";

/**
 * Firebase 재시도 래퍼 — unavailable/deadline-exceeded 또는 오프라인 시에만 재시도
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 1000): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const code = error?.code || '';
            const isRetryable = code === 'unavailable' || code === 'deadline-exceeded' || !navigator.onLine;
            if (!isRetryable || attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }
    throw lastError;
};

// Firebase 설정 (기존 설정 유지)
const firebaseConfig = {
    apiKey: "AIzaSyCX43ePWFhdIbCUZUtoMePqMdTXiAowlx0",
    authDomain: "balance-team-maker.firebaseapp.com",
    projectId: "balance-team-maker",
    storageBucket: "balance-team-maker.firebasestorage.app",
    messagingSenderId: "834065889708",
    appId: "1:834065889708:web:0fb72121f685619d406209",
    measurementId: "G-VX40BB7JZB"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface Announcement {
    id: string;
    message: string;
    messages?: { ko?: string; en?: string; ja?: string; es?: string; pt?: string };
    isActive: boolean;
    createdAt: string;
    link?: string;
    type?: 'info' | 'event' | 'update';
}

export interface Applicant {
    id: string;
    name: string;
    tier: string;
    position: string;
    primaryPositions?: string[];
    secondaryPositions?: string[];
    tertiaryPositions?: string[];
    forbiddenPositions?: string[];
    timestamp: string;
    appliedAt?: string;
    fcmToken?: string;
    isWaiting?: boolean; // 항목 9: 대기자 여부
    isApproved?: boolean; // 개별 승인 여부
    userId?: string; // 게스트 식별용
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'; // 신청 상태
    source?: 'web' | 'app' | 'host'; // 신청 출처 (host: 방장 직접 추가)
    photoUrl?: string; // 프로필 사진 URL
}

export interface RecruitmentRoom {
    id: string;
    hostId: string;
    hostName: string;
    title: string; // 항목 5: 모임명
    sport: string;
    matchDate: string;
    matchTime: string;
    matchEndDate?: string;
    matchEndTime?: string;
    status: 'OPEN' | 'CLOSED';
    maxApplicants: number; // 항목 9: 모집 인원 제한
    applicants: Applicant[];
    createdAt: string;
    tierMode?: '5TIER' | '3TIER'; // 티어 체계 (5단계 또는 3단계)
    fcmToken?: string; // 방장의 FCM 토큰
    venue?: string; // 장소
    venueData?: VenueData; // 구조화된 장소 데이터 (카카오맵 검색 결과)
    visibility?: 'PUBLIC' | 'PRIVATE'; // 공개/비공개 (기존 방은 undefined → PRIVATE 취급)
    region?: string; // 지역 (선택)
    description?: string; // 방 설명
    viewCount?: number; // 조회수
    likedBy?: string[]; // 찜한 유저 ID 목록
    latestResult?: {
        teams: any[];
        standardDeviation: number;
        positionSatisfaction?: number;
        createdAt: string;
        isPreview?: boolean;
    };
}


/**
 * 1. 신규 모집방 생성
 */
export const createRecruitmentRoom = async (roomData: Omit<RecruitmentRoom, 'id' | 'createdAt' | 'status'> & { applicants?: Applicant[] }) => {
    try {
        const { applicants, ...rest } = roomData;
        const roomRef = collection(db, "rooms");
        const memberUserIds = [rest.hostId];
        const newDoc = await addDoc(roomRef, {
            ...rest,
            status: 'OPEN',
            applicants: applicants || [],
            memberUserIds,
            createdAt: new Date().toISOString()
        });
        return newDoc.id;
    } catch (error) {
        console.error("Error creating room:", error);
        throw error;
    }
};

/**
 * 1-1. 조회수 증가
 */
export const incrementViewCount = async (roomId: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { viewCount: increment(1) });
    } catch (error) {
        console.error("Error incrementing view count:", error);
    }
};

/**
 * 1-2. 찜 토글 (추가/제거)
 */
export const toggleLikeRoom = async (roomId: string, userId: string): Promise<boolean> => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return false;
        const data = snap.data();
        const likedBy: string[] = data.likedBy || [];
        const isLiked = likedBy.includes(userId);
        if (isLiked) {
            await updateDoc(roomRef, { likedBy: arrayRemove(userId) });
        } else {
            await updateDoc(roomRef, { likedBy: arrayUnion(userId) });
        }
        return !isLiked;
    } catch (error) {
        console.error("Error toggling like:", error);
        throw error;
    }
};

/**
 * 2. 특정 방 정보 가져오기
 */
export const getRoomInfo = async (roomId: string): Promise<RecruitmentRoom | null> => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
            return { id: snap.id, ...snap.data() } as RecruitmentRoom;
        }
        return null;
    } catch (error) {
        console.error("Error getting room info:", error);
        throw error;
    }
};

/**
 * 3. 참가 신청하기 (중복 신청/정원 초과 체크 포함)
 */
export const applyForParticipation = async (roomId: string, applicant: Omit<Applicant, 'id' | 'timestamp'>) => {
    try {
        const roomRef = doc(db, "rooms", roomId);

        const newApplicant = await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(roomRef);
            if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');

            const roomData = snap.data() as Omit<RecruitmentRoom, 'id'>;
            const currentApplicants = roomData.applicants || [];

            if (roomData.status === 'CLOSED') throw new Error('ROOM_CLOSED');

            if (applicant.fcmToken) {
                const duplicate = currentApplicants.find(a => a.fcmToken === applicant.fcmToken);
                if (duplicate) throw new Error('DUPLICATE_APPLICATION');
            }

            const approvedCount = currentApplicants.filter(a => a.status === 'APPROVED' || (a.isApproved && !a.status)).length;
            if (roomData.maxApplicants > 0 && approvedCount >= roomData.maxApplicants) {
                throw new Error('ROOM_FULL');
            }

            const created: Applicant = {
                ...applicant,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toISOString(),
                isApproved: false,
                source: 'app',
                status: 'PENDING',
            };
            transaction.update(roomRef, {
                applicants: [...currentApplicants, created]
            });
            return created;
        });

        return newApplicant;
    } catch (error) {
        console.error("Error applying:", error);
        throw error;
    }
};

/**
 * 4. 참가 신청 취소하기
 */
export const cancelApplication = async (roomId: string, applicant: Applicant) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            applicants: arrayRemove(applicant),
            lastExcluded: { userId: applicant.userId || '', name: applicant.name, at: new Date().toISOString() }
        });
    } catch (error) {
        console.error("Error cancelling application:", error);
        throw error;
    }
};

/**
 * 4-1. 게스트 참가 취소 (userId 기반)
 */
export const cancelMyApplication = async (roomId: string, userId: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');

        const roomData = snap.data() as Omit<RecruitmentRoom, 'id'>;
        const applicant = (roomData.applicants || []).find(a => a.userId === userId);
        if (!applicant) throw new Error('APPLICATION_NOT_FOUND');

        await updateDoc(roomRef, {
            applicants: arrayRemove(applicant)
        });
    } catch (error) {
        console.error("Error cancelling my application:", error);
        throw error;
    }
};

/**
 * 5. 방 실시간 감시 (방장용/참가자용)
 */
export const subscribeToRoom = (roomId: string, callback: (room: RecruitmentRoom | null) => void, onError?: (error: Error) => void) => {
    const roomRef = doc(db, "rooms", roomId);
    return onSnapshot(roomRef, (snap) => {
        if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() } as RecruitmentRoom);
        } else {
            callback(null);
        }
    }, (error) => {
        console.error("Room subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 6. FCM 토큰 업데이트 (방장용) — 방장 검증 포함
 */
export const updateRoomFcmToken = async (roomId: string, token: string, currentUserId?: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        if (currentUserId) {
            const snap = await getDoc(roomRef);
            if (!snap.exists() || snap.data().hostId !== currentUserId) {
                return; // 방장이 아니면 업데이트하지 않음
            }
        }
        await updateDoc(roomRef, { fcmToken: token });
    } catch (error) {
        console.error("Error updating FCM token:", error);
    }
};
/**
 * 7. 사용자가 방장인 모든 방 실시간 감시
 */
export const subscribeToUserRooms = (hostId: string, callback: (rooms: RecruitmentRoom[]) => void, onError?: (error: Error) => void) => {
    const q = query(
        collection(db, "rooms"),
        where("hostId", "==", hostId)
        // orderBy("createdAt", "desc") // 인덱스 문제 방지를 위해 주석 처리하고 아래에서 정렬
    );

    return onSnapshot(q, (snap) => {
        const rooms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecruitmentRoom));
        // 클라이언트 사이드 정렬
        rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(rooms);
    }, (error) => {
        console.error("User rooms subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 7-1. 공개방 목록 실시간 구독
 */
export const subscribeToPublicRooms = (
    sport: string | null,
    limitCount: number,
    callback: (rooms: RecruitmentRoom[]) => void,
    onError?: (error: Error) => void
) => {
    const constraints: any[] = [
        where("visibility", "==", "PUBLIC"),
        where("status", "in", ["OPEN", "CLOSED"]),
    ];
    if (sport && sport !== 'ALL') {
        constraints.push(where("sport", "==", sport));
    }
    constraints.push(orderBy("matchDate", "asc"));
    constraints.push(limit(limitCount));

    const q = query(collection(db, "rooms"), ...constraints);

    return onSnapshot(q, (snap) => {
        const rooms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecruitmentRoom));
        callback(rooms);
    }, (error) => {
        console.error("Public rooms subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 7-2. 팀 나누기 결과 저장
 */
export const saveTeamResultToRoom = async (roomId: string, result: { teams: any[]; standardDeviation: number; positionSatisfaction?: number }, isPreview: boolean = false) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        const cleanData = JSON.parse(JSON.stringify({
            teams: result.teams,
            standardDeviation: result.standardDeviation,
            positionSatisfaction: result.positionSatisfaction,
            createdAt: new Date().toISOString(),
            isPreview,
        }));
        await updateDoc(roomRef, { latestResult: cleanData });
    } catch (error) {
        console.error("Error saving team result:", error);
    }
};

/**
 * 7-3. 모집방 상태 변경 (OPEN/CLOSED)
 */
export const updateRoomStatus = async (roomId: string, status: 'OPEN' | 'CLOSED') => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { status });
    } catch (error) {
        console.error("Error updating room status:", error);
        throw error;
    }
};

/**
 * 8. 플레이어 명단 클라우드 저장
 */
export const savePlayersToCloud = async (userId: string, players: Player[]) => {
    return withRetry(async () => {
        try {
            await setDoc(doc(db, "users", userId), { players }, { merge: true });
        } catch (e) {
            console.error("Save cloud error:", e);
            throw e;
        }
    });
};

/**
 * 9. 플레이어 명단 클라우드 로드
 */
export const loadPlayersFromCloud = async (userId: string): Promise<Player[] | null> => {
    return withRetry(async () => {
        try {
            const snap = await getDoc(doc(db, "users", userId));
            if (snap.exists() && snap.data().players) {
                return snap.data().players as Player[];
            }
            return null;
        } catch (e) {
            console.error("Load cloud error:", e);
            throw e;
        }
    });
};

/**
 * 10. FCM 토큰을 사용자 문서에 저장
 */
export const saveUserFcmToken = async (userId: string, token: string) => {
    try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            const tokens: string[] = data.fcmTokens || [];
            if (tokens.includes(token)) return; // 중복 방지
            // 최대 5개 유지
            const updatedTokens = [...tokens, token].slice(-5);
            await updateDoc(userRef, { fcmTokens: updatedTokens });
        } else {
            await setDoc(userRef, { fcmTokens: [token] }, { merge: true });
        }
    } catch (e) {
        console.error("Save FCM token error:", e);
    }
};

/**
 * 10-1. 사용자 언어 설정을 Firestore에 저장 (Cloud Functions 다국어 알림용)
 */
export const saveUserLanguage = async (userId: string, language: string) => {
    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { language }, { merge: true });
    } catch (e) {
        console.error("Save language error:", e);
    }
};

/**
 * 11. FCM 토큰을 사용자 문서에서 제거 (로그아웃 시)
 */
export const removeUserFcmToken = async (userId: string, token: string) => {
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, { fcmTokens: arrayRemove(token) });
    } catch (e) {
        console.error("Remove FCM token error:", e);
    }
};

/**
 * 12. 앱 버전 체크 (Remote Config)
 */
export const checkAppVersion = async () => {
    try {
        const remoteConfig = getRemoteConfig(app);

        // 배포용 설정: 12시간 (43200000)
        // 테스트 시에는 0으로 설정하여 즉시 반영 확인 가능
        remoteConfig.settings.minimumFetchIntervalMillis = 43200000;

        // 기본값 설정
        remoteConfig.defaultConfig = {
            latest_version: "1.0.0",
            force_update: false,
            update_message: "A new version is available.\nPlease update for a better experience.",
            store_url_android: "market://details?id=com.balanceteammaker",
            store_url_ios: ""
        };

        await fetchAndActivate(remoteConfig);

        const latestVersion = getValue(remoteConfig, "latest_version").asString();
        const forceUpdate = getValue(remoteConfig, "force_update").asBoolean();
        const updateMessage = getValue(remoteConfig, "update_message").asString();
        const storeUrlAndroid = getValue(remoteConfig, "store_url_android").asString();
        const storeUrlIos = getValue(remoteConfig, "store_url_ios").asString();

        return {
            latestVersion,
            forceUpdate,
            updateMessage,
            storeUrlAndroid,
            storeUrlIos
        };
    } catch (error) {
        console.error("Remote Config Error:", error);
        return null;
    }
};

/**
 * 11. 공지사항 실시간 구독
 */
export const subscribeToAnnouncements = (callback: (announcements: Announcement[]) => void, onError?: (error: Error) => void) => {
    const q = query(
        collection(db, "announcements"),
        where("isActive", "==", true)
    );

    return onSnapshot(q, (snap) => {
        const announcements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
        announcements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(announcements);
    }, (error) => {
        console.error("Announcements subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 13. 유저 프로필 저장
 */
export const saveUserProfile = async (userId: string, profile: UserProfile) => {
    return withRetry(async () => {
        try {
            await setDoc(doc(db, "users", userId), { profile }, { merge: true });
        } catch (e) {
            console.error("Save profile error:", e);
            throw e;
        }
    });
};

/**
 * 14-1. 유저 닉네임 Firestore 저장
 */
export const saveUserNickname = async (userId: string, nickname: string) => {
    try {
        await setDoc(doc(db, "users", userId), { nickname }, { merge: true });
    } catch (e) {
        console.error("Save nickname error:", e);
    }
};

/**
 * 14-2. 유저 닉네임 Firestore 로드
 */
export const loadUserNickname = async (userId: string): Promise<string | null> => {
    try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists() && snap.data().nickname) {
            return snap.data().nickname as string;
        }
        return null;
    } catch (e) {
        console.error("Load nickname error:", e);
        return null;
    }
};

/**
 * 14-3. 닉네임 변경 시 모집방 동기화 (Cloud Function 호출)
 */
export const updateNicknameInRooms = async (userId: string, newName: string) => {
    try {
        await fetch('https://us-central1-balance-team-maker.cloudfunctions.net/updateNickname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-App-Key': 'belo-app-2024-v2' },
            body: JSON.stringify({ userId, newName }),
        });
    } catch (error) {
        console.error("Error updating nickname in rooms:", error);
    }
};

/**
 * 14. 유저 프로필 로드
 */
export const loadUserProfile = async (userId: string): Promise<UserProfile | null> => {
    return withRetry(async () => {
        try {
            const snap = await getDoc(doc(db, "users", userId));
            if (snap.exists() && snap.data().profile) {
                return snap.data().profile as UserProfile;
            }
            return null;
        } catch (e) {
            console.error("Load profile error:", e);
            throw e;
        }
    });
};

/**
 * 15. 프로필 변경 시 참가한 모집방의 applicant 정보 동기화
 */
export const syncApplicantProfile = async (userId: string, profile: UserProfile) => {
    try {
        const roomsRef = collection(db, "rooms");
        const q = query(roomsRef, where('status', '==', 'OPEN'));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        let hasUpdates = false;

        snapshot.forEach(docSnap => {
            const room = docSnap.data() as Omit<RecruitmentRoom, 'id'>;
            const applicants = room.applicants || [];
            const myApplicant = applicants.find(a => a.userId === userId);

            if (myApplicant) {
                const sportProfile = profile.sports[room.sport as SportType];
                if (sportProfile) {
                    const updatedApplicants = applicants.map(a =>
                        a.userId === userId ? {
                            ...a,
                            tier: sportProfile.tier,
                            position: sportProfile.primaryPositions?.[0] || a.position,
                            primaryPositions: sportProfile.primaryPositions,
                            secondaryPositions: sportProfile.secondaryPositions,
                            tertiaryPositions: sportProfile.tertiaryPositions,
                            forbiddenPositions: sportProfile.forbiddenPositions,
                            photoUrl: profile.photoUrl || '',
                        } : a
                    );
                    batch.update(docSnap.ref, { applicants: updatedApplicants });
                    hasUpdates = true;
                }
            }
        });

        if (hasUpdates) await batch.commit();
    } catch (e) {
        console.error('Failed to sync applicant profile:', e);
    }
};

/**
 * 16. 장소 사진 정보 조회 (venues 컬렉션)
 */
export const getVenueInfo = async (placeId: string): Promise<VenueData | null> => {
    try {
        const snap = await getDoc(doc(db, "venues", placeId));
        if (snap.exists()) {
            return snap.data() as VenueData;
        }
        return null;
    } catch (e) {
        console.error("Get venue info error:", e);
        return null;
    }
};

/**
 * 17. 장소 사진 정보 저장 (venues 컬렉션)
 */
export const saveVenueInfo = async (placeId: string, venueData: Partial<VenueData>) => {
    try {
        await setDoc(doc(db, "venues", placeId), venueData, { merge: true });
    } catch (e) {
        console.error("Save venue info error:", e);
        throw e;
    }
};

/**
 * 18. 채팅 메시지 전송
 */
export const sendChatMessage = async (roomId: string, senderId: string, senderName: string, text: string, senderPhotoUrl?: string) => {
    try {
        const trimmedText = text.slice(0, 500);
        const createdAt = new Date().toISOString();
        const messagesRef = collection(db, "rooms", roomId, "messages");
        const msgData: any = {
            senderId,
            senderName,
            text: trimmedText,
            createdAt,
        };
        if (senderPhotoUrl) msgData.senderPhotoUrl = senderPhotoUrl;
        await addDoc(messagesRef, msgData);
        // 방 문서에 lastChatMessage 업데이트 (목록 미리보기용)
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            lastChatMessage: { text: trimmedText, senderName, createdAt },
        });
    } catch (e) {
        console.error("Send chat message error:", e);
        throw e;
    }
};

/**
 * 18-1. 시스템 메시지 전송 (참가 승인 등)
 */
export const sendSystemMessage = async (roomId: string, text: string) => {
    try {
        const createdAt = new Date().toISOString();
        const messagesRef = collection(db, "rooms", roomId, "messages");
        await addDoc(messagesRef, {
            senderId: 'SYSTEM',
            senderName: 'System',
            text,
            createdAt,
            type: 'SYSTEM',
        });
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            lastChatMessage: { text, senderName: 'System', createdAt },
        });
    } catch (e) {
        console.error("Send system message error:", e);
    }
};

/**
 * 19. 채팅 메시지 실시간 구독 (최근 100개)
 */
export const subscribeToChatMessages = (
    roomId: string,
    limitCount: number,
    callback: (messages: ChatMessage[]) => void,
    onError?: (error: Error) => void
) => {
    const q = query(
        collection(db, "rooms", roomId, "messages"),
        orderBy("createdAt", "asc"),
        limit(limitCount)
    );

    return onSnapshot(q, (snap) => {
        const messages = snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
        } as ChatMessage));
        callback(messages);
    }, (error) => {
        console.error("Chat subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 20. 채팅방 목록 실시간 구독 (내가 참여 중인 방들)
 */
export const subscribeToChatRooms = (
    userId: string,
    callback: (rooms: RecruitmentRoom[]) => void,
    onError?: (error: Error) => void
) => {
    const q = query(
        collection(db, "rooms"),
        where("memberUserIds", "array-contains", userId)
    );

    return onSnapshot(q, (snap) => {
        const rooms = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as RecruitmentRoom))
            .filter(r => r.status !== 'DELETED');
        rooms.sort((a, b) => {
            const aTime = (a as any).lastChatMessage?.createdAt || a.createdAt;
            const bTime = (b as any).lastChatMessage?.createdAt || b.createdAt;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        callback(rooms);
    }, (error) => {
        console.error("Chat rooms subscription error:", error);
        if (onError) onError(error);
    });
};

/**
 * 21. 채팅 멤버 추가 (승인 시)
 */
export const addChatMember = async (roomId: string, userId: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { memberUserIds: arrayUnion(userId) });
    } catch (e) {
        console.error("Add chat member error:", e);
    }
};

/**
 * 22. 채팅 멤버 제거 (거절/취소 시)
 */
export const removeChatMember = async (roomId: string, userId: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { memberUserIds: arrayRemove(userId) });
    } catch (e) {
        console.error("Remove chat member error:", e);
    }
};
