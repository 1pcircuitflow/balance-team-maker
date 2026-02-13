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
    limit
} from "firebase/firestore";
import { getRemoteConfig, fetchAndActivate, getValue, getAll } from "firebase/remote-config";
import { PushNotifications } from '@capacitor/push-notifications';
import { Player } from "../types";

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
    visibility?: 'PUBLIC' | 'PRIVATE'; // 공개/비공개 (기존 방은 undefined → PRIVATE 취급)
    region?: string; // 지역 (선택)
}


/**
 * 1. 신규 모집방 생성
 */
export const createRecruitmentRoom = async (roomData: Omit<RecruitmentRoom, 'id' | 'createdAt' | 'applicants' | 'status'>) => {
    try {
        const roomRef = collection(db, "rooms");
        const newDoc = await addDoc(roomRef, {
            ...roomData,
            status: 'OPEN',
            applicants: [],
            createdAt: new Date().toISOString()
        });
        return newDoc.id;
    } catch (error) {
        console.error("Error creating room:", error);
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

        // 최신 방 정보 조회하여 중복/정원 체크
        const snap = await getDoc(roomRef);
        if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');

        const roomData = snap.data() as Omit<RecruitmentRoom, 'id'>;
        const currentApplicants = roomData.applicants || [];

        // 중복 신청 체크 (같은 fcmToken이 이미 있으면 차단)
        if (applicant.fcmToken) {
            const duplicate = currentApplicants.find(a => a.fcmToken === applicant.fcmToken);
            if (duplicate) throw new Error('DUPLICATE_APPLICATION');
        }

        // 정원 초과 체크
        if (roomData.maxApplicants > 0 && currentApplicants.length >= roomData.maxApplicants) {
            throw new Error('ROOM_FULL');
        }

        const newApplicant: Applicant = {
            ...applicant,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            isApproved: false // 명시적으로 false 설정 (동기화 안정성)
        };
        await updateDoc(roomRef, {
            applicants: arrayUnion(newApplicant)
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
            applicants: arrayRemove(applicant)
        });
    } catch (error) {
        console.error("Error cancelling application:", error);
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
        where("status", "==", "OPEN"),
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
 * 8. 플레이어 명단 클라우드 저장
 */
export const savePlayersToCloud = async (userId: string, players: Player[]) => {
    try {
        await setDoc(doc(db, "users", userId), { players }, { merge: true });
    } catch (e) {
        console.error("Save cloud error:", e);
        throw e;
    }
};

/**
 * 9. 플레이어 명단 클라우드 로드
 */
export const loadPlayersFromCloud = async (userId: string): Promise<Player[] | null> => {
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
        remoteConfig.settings.minimumFetchIntervalMillis = 0;

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
