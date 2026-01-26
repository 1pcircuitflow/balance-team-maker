import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { Player } from "../types";

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
const db = getFirestore(app);

/**
 * 선수 데이터를 서버에 저장합니다.
 */
export const savePlayersToCloud = async (userId: string, players: Player[]) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, {
            players,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        console.log("Data saved to cloud successfully");
    } catch (error) {
        console.error("Error saving data to cloud:", error);
    }
};

/**
 * 서버에서 선수 데이터를 불러옵니다.
 */
export const loadPlayersFromCloud = async (userId: string): Promise<Player[] | null> => {
    if (!userId) return null;
    try {
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return docSnap.data().players as Player[];
        }
        return null;
    } catch (error) {
        console.error("Error loading data from cloud:", error);
        return null;
    }
};
