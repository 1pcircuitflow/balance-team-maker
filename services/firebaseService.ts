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
    deleteDoc
} from "firebase/firestore";
import { PushNotifications } from '@capacitor/push-notifications';

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

export interface Applicant {
    id: string;
    name: string;
    tier: string;
    position: string;
    timestamp: string;
    fcmToken?: string;
}

export interface RecruitmentRoom {
    id: string;
    hostId: string;
    hostName: string;
    sport: string;
    matchDate: string;
    matchTime: string;
    status: 'OPEN' | 'CLOSED';
    applicants: Applicant[];
    createdAt: string;
    fcmToken?: string; // 방장의 FCM 토큰
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
        return null;
    }
};

/**
 * 3. 참가 신청하기
 */
export const applyForParticipation = async (roomId: string, applicant: Omit<Applicant, 'id' | 'timestamp'>) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        const newApplicant: Applicant = {
            ...applicant,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString()
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
export const subscribeToRoom = (roomId: string, callback: (room: RecruitmentRoom | null) => void) => {
    const roomRef = doc(db, "rooms", roomId);
    return onSnapshot(roomRef, (snap) => {
        if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() } as RecruitmentRoom);
        } else {
            callback(null);
        }
    });
};

/**
 * 6. FCM 토큰 업데이트 (방장용)
 */
export const updateRoomFcmToken = async (roomId: string, token: string) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { fcmToken: token });
    } catch (error) {
        console.error("Error updating FCM token:", error);
    }
};
