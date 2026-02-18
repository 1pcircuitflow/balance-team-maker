import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { OAuth2Client } from "google-auth-library";

const kakaoRestApiKey = defineSecret("KAKAO_REST_API_KEY");

initializeApp();

const db = getFirestore();

const ALLOWED_ORIGINS = [
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
  "http://localhost:3000",
  "https://balance-team-maker.web.app",
  "https://balance-team-maker.firebaseapp.com",
];

const APP_API_KEY = "belo-app-2024-v2";

interface Applicant {
  id: string;
  name: string;
  tier: string;
  position: string;
  isApproved?: boolean;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  userId?: string;
  fcmToken?: string;
}

interface RoomData {
  hostId: string;
  title: string;
  applicants: Applicant[];
  fcmToken?: string;
  lastExcluded?: { userId: string; name: string; at: string };
}

type Lang = "ko" | "en" | "es" | "ja" | "pt";

const PUSH_MESSAGES: Record<
  Lang,
  { approved: string; rejected: string; excluded: string; cancelled: (name: string, count: number) => string; newChat: (name: string, text: string) => string; newApplicant: (name: string, count: number) => string }
> = {
  ko: {
    approved: "참가가 승인되었습니다",
    rejected: "참가가 거절되었습니다",
    excluded: "경기에서 제외되었습니다",
    cancelled: (name, count) => `${name}님이 참가를 취소했습니다. (현재 참가 인원 ${count}명)`,
    newChat: (name, text) => `${name}: ${text}`,
    newApplicant: (name, count) => `${name}님이 참가 신청하였습니다. (현재 참가 인원 ${count}명)`,
  },
  en: {
    approved: "Your application has been approved",
    rejected: "Your application has been rejected",
    excluded: "You have been removed from the match",
    cancelled: (name, count) => `${name} cancelled. (${count} participants)`,
    newChat: (name, text) => `${name}: ${text}`,
    newApplicant: (name, count) => `${name} has applied. (${count} participants)`,
  },
  es: {
    approved: "Tu solicitud ha sido aprobada",
    rejected: "Tu solicitud ha sido rechazada",
    excluded: "Has sido eliminado del partido",
    cancelled: (name, count) => `${name} ha cancelado. (${count} participantes)`,
    newChat: (name, text) => `${name}: ${text}`,
    newApplicant: (name, count) => `${name} ha solicitado unirse. (${count} participantes)`,
  },
  ja: {
    approved: "参加が承認されました",
    rejected: "参加が拒否されました",
    excluded: "試合から除外されました",
    cancelled: (name, count) => `${name}さんが参加をキャンセルしました。(現在 ${count}名)`,
    newChat: (name, text) => `${name}: ${text}`,
    newApplicant: (name, count) => `${name}さんが参加申請しました。(現在 ${count}名)`,
  },
  pt: {
    approved: "Sua inscrição foi aprovada",
    rejected: "Sua inscrição foi rejeitada",
    excluded: "Você foi removido da partida",
    cancelled: (name, count) => `${name} cancelou. (${count} participantes)`,
    newChat: (name, text) => `${name}: ${text}`,
    newApplicant: (name, count) => `${name} se inscreveu. (${count} participantes)`,
  },
};

/** users/{userId} 문서에서 fcmTokens + language 조회 */
async function getUserTokensAndLang(
  userId: string
): Promise<{ tokens: string[]; lang: Lang }> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        tokens: data?.fcmTokens || [],
        lang: (data?.language as Lang) || "ko",
      };
    }
  } catch (e) {
    console.error("Failed to fetch user data:", e);
  }
  return { tokens: [], lang: "ko" };
}

/** 방장 토큰 조회 (users 문서 우선, room fallback) */
async function getHostTokens(
  hostId: string,
  roomFcmToken?: string
): Promise<{ tokens: string[]; lang: Lang }> {
  const result = await getUserTokensAndLang(hostId);
  if (result.tokens.length === 0 && roomFcmToken) {
    result.tokens = [roomFcmToken];
  }
  return result;
}

/** 참가자 토큰 조회 (userId → users 문서, fallback → applicant.fcmToken) */
async function getApplicantTokens(
  applicant: Applicant
): Promise<{ tokens: string[]; lang: Lang }> {
  if (applicant.userId) {
    const result = await getUserTokensAndLang(applicant.userId);
    if (result.tokens.length > 0) return result;
  }
  if (applicant.fcmToken) {
    return { tokens: [applicant.fcmToken], lang: "ko" };
  }
  return { tokens: [], lang: "ko" };
}

/** 무효 토큰 정리 */
async function cleanupInvalidTokens(
  userId: string,
  tokens: string[],
  responses: any[]
) {
  const invalidTokens: string[] = [];
  responses.forEach((resp: any, idx: number) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });
  if (invalidTokens.length > 0) {
    try {
      await db
        .collection("users")
        .doc(userId)
        .update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
      console.log("Removed invalid tokens:", invalidTokens);
    } catch (e) {
      console.error("Failed to cleanup tokens:", e);
    }
  }
}

/** FCM 푸시 발송 */
async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
  userId?: string
) {
  if (tokens.length === 0) return;
  const message = {
    notification: { title, body },
    data,
    android: {
      notification: {
        channelId: "recruit_channel",
        icon: "ic_stat_icon_config_sample",
        sound: "default" as const,
      },
    },
    tokens,
  };
  try {
    const response = await getMessaging().sendEachForMulticast(message);
    if (response.failureCount > 0 && userId) {
      await cleanupInvalidTokens(userId, tokens, response.responses);
    }
    console.log(
      `FCM sent: ${response.successCount} success, ${response.failureCount} failure`
    );
  } catch (e) {
    console.error("FCM send error:", e);
  }
}

/**
 * rooms/{roomId} 문서가 업데이트될 때 트리거.
 * 1. 신규 참가신청 → 방장에게 알림
 * 2. 참가 취소 → 방장에게 알림
 * 3. 승인/거절 → 참가자에게 알림
 */
export const onRoomUpdated = onDocumentUpdated("rooms/{roomId}", async (event) => {
  const beforeData = event.data?.before.data() as RoomData | undefined;
  const afterData = event.data?.after.data() as RoomData | undefined;

  if (!beforeData || !afterData) return;

  const prevApplicants = beforeData.applicants || [];
  const newApplicants = afterData.applicants || [];
  const roomId = event.params.roomId;
  const roomTitle = afterData.title;
  const hostId = afterData.hostId;

  const prevMap = new Map(prevApplicants.map((a) => [a.id, a]));
  const newMap = new Map(newApplicants.map((a) => [a.id, a]));

  // 참가 인원 수 계산 (APPROVED 상태만)
  const getApprovedCount = (applicants: Applicant[]) =>
    applicants.filter((a) => a.status === "APPROVED" || (a.isApproved && !a.status)).length;

  // 1. 신규 참가신청 감지 → 방장에게 알림
  const addedApplicants = newApplicants.filter(
    (a) => !prevMap.has(a.id) && a.status !== "APPROVED"
  );
  if (addedApplicants.length > 0) {
    console.log(`[PUSH] NEW_APPLICANT: ${JSON.stringify(addedApplicants.map(a => ({ name: a.name, status: a.status, isApproved: a.isApproved })))}`);
    const approvedCount = getApprovedCount(newApplicants);
    const { tokens, lang } = await getHostTokens(hostId, afterData.fcmToken);
    for (const applicant of addedApplicants) {
      await sendPush(
        tokens,
        `[${roomTitle}]`,
        PUSH_MESSAGES[lang].newApplicant(applicant.name, approvedCount),
        {
          type: "NEW_APPLICANT",
          roomId,
          applicantName: applicant.name,
          totalCount: String(approvedCount),
        },
        hostId
      );
    }
  }

  // 2. 참가 취소/제외 감지
  const allRemoved = prevApplicants.filter((a) => !newMap.has(a.id));
  if (allRemoved.length > 0) {
    console.log(`[DEBUG] allRemoved: ${JSON.stringify(allRemoved.map(a => ({ name: a.name, status: a.status, isApproved: a.isApproved })))}`);
  }
  const removedApplicants = allRemoved.filter((a) => {
    const prevStatus = a.status || (a.isApproved ? "APPROVED" : "PENDING");
    return prevStatus === "PENDING" || prevStatus === "APPROVED";
  });
  if (removedApplicants.length > 0) {
    const approvedCount = getApprovedCount(newApplicants);
    const lastExcluded = afterData.lastExcluded;

    for (const applicant of removedApplicants) {
      const prevStatus = applicant.status || (applicant.isApproved ? "APPROVED" : "PENDING");
      const isExcludedByHost = prevStatus === "APPROVED" && lastExcluded &&
        lastExcluded.userId === (applicant.userId || '') && lastExcluded.name === applicant.name;

      if (isExcludedByHost && applicant.userId) {
        // 방장 제외 → 제외당한 유저에게 알림
        const { tokens, lang } = await getApplicantTokens(applicant);
        await sendPush(
          tokens,
          `[${roomTitle}]`,
          PUSH_MESSAGES[lang].excluded,
          { type: "APPLICATION_EXCLUDED", roomId },
          applicant.userId
        );
      } else {
        // 참가자 본인 취소 → 방장에게 알림
        const { tokens, lang } = await getHostTokens(hostId, afterData.fcmToken);
        await sendPush(
          tokens,
          `[${roomTitle}]`,
          PUSH_MESSAGES[lang].cancelled(applicant.name, approvedCount),
          {
            type: "APPLICANT_CANCELLED",
            roomId,
            applicantName: applicant.name,
          },
          hostId
        );
      }
    }
  }

  // 3. 승인/거절 감지 → 참가자에게 알림
  for (const newApp of newApplicants) {
    const prevApp = prevMap.get(newApp.id);
    if (!prevApp) continue;

    const prevStatus =
      prevApp.status || (prevApp.isApproved ? "APPROVED" : "PENDING");
    const newStatus =
      newApp.status || (newApp.isApproved ? "APPROVED" : "PENDING");

    if (prevStatus === newStatus) continue;

    console.log(`[PUSH] STATUS_CHANGE: name=${newApp.name}, prev=${prevStatus}, new=${newStatus}, prevIsApproved=${prevApp.isApproved}, newIsApproved=${newApp.isApproved}, prevStatusRaw=${prevApp.status}, newStatusRaw=${newApp.status}`);

    if (newStatus === "APPROVED") {
      const { tokens, lang } = await getApplicantTokens(newApp);
      console.log(`[PUSH] APPROVED → tokens=${tokens.length}, userId=${newApp.userId}`);
      await sendPush(
        tokens,
        `[${roomTitle}]`,
        PUSH_MESSAGES[lang].approved,
        { type: "APPLICATION_APPROVED", roomId },
        newApp.userId
      );
    }

    if (newStatus === "REJECTED") {
      const { tokens, lang } = await getApplicantTokens(newApp);
      console.log(`[PUSH] REJECTED → tokens=${tokens.length}, userId=${newApp.userId}`);
      await sendPush(
        tokens,
        `[${roomTitle}]`,
        PUSH_MESSAGES[lang].rejected,
        { type: "APPLICATION_REJECTED", roomId },
        newApp.userId
      );
    }
  }
});

/**
 * 닉네임 변경 시 모집방 동기화 (클라이언트 Firestore 읽기 절약)
 */
export const updateNickname = onRequest({ cors: ALLOWED_ORIGINS }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.headers["x-app-key"] !== APP_API_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, newName } = req.body;
  if (!userId || !newName) {
    res.status(400).json({ error: "Missing params" });
    return;
  }

  if (typeof newName !== "string" || newName.trim().length < 1 || newName.trim().length > 8) {
    res.status(400).json({ error: "Nickname must be 1-8 characters" });
    return;
  }

  try {
    const batch = db.batch();

    // 1. 방장인 방: hostName + applicants 업데이트
    const hostSnap = await db.collection("rooms").where("hostId", "==", userId).get();
    hostSnap.docs.forEach((doc) => {
      const data = doc.data();
      const updatedApplicants = (data.applicants || []).map((a: any) =>
        a.userId === userId ? { ...a, name: newName } : a
      );
      batch.update(doc.ref, { hostName: newName, applicants: updatedApplicants });
    });

    // 2. 참가자인 OPEN/CLOSED 방: applicants의 name 업데이트
    const openSnap = await db.collection("rooms").where("status", "in", ["OPEN", "CLOSED"]).get();
    openSnap.docs.forEach((doc) => {
      if (hostSnap.docs.some((h) => h.id === doc.id)) return;
      const applicants = doc.data().applicants || [];
      if (!applicants.some((a: any) => a.userId === userId)) return;
      const updated = applicants.map((a: any) =>
        a.userId === userId ? { ...a, name: newName } : a
      );
      batch.update(doc.ref, { applicants: updated });
    });

    await batch.commit();
    res.json({ success: true });
  } catch (e) {
    console.error("updateNickname error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 카카오 로그인: 인가 코드를 받아 토큰 교환 후 사용자 정보를 반환.
 */
export const kakaoAuth = onRequest(
  { secrets: [kakaoRestApiKey], cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { code, redirectUri } = req.body;
    if (!code || !redirectUri) {
      res.status(400).json({ error: "Missing code or redirectUri" });
      return;
    }

    try {
      // 1) 인가 코드로 액세스 토큰 교환
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "878d084cb95d54a3657541f72b9bbe97",
          redirect_uri: redirectUri,
          code: code.trim(),
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("Kakao token exchange failed:", tokenData);
        res.status(401).json({ error: "Token exchange failed", detail: tokenData });
        return;
      }

      // 2) 액세스 토큰으로 사용자 정보 조회
      const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      if (!userRes.ok) {
        console.error("Kakao user info failed:", userData);
        res.status(401).json({ error: "Failed to get user info" });
        return;
      }

      const kakaoAccount = userData.kakao_account || {};
      const profile = kakaoAccount.profile || {};

      const kakaoUserId = `kakao_${userData.id}`;

      // Firebase Auth 사용자 프로필 세팅 + Custom Token 생성 (실패해도 나머지 응답은 정상 반환)
      let customToken: string | undefined;
      try {
        await ensureFirebaseAuthUser(kakaoUserId, {
          displayName: profile.nickname || "",
          email: kakaoAccount.email || undefined,
          photoURL: profile.profile_image_url || undefined,
        });
        customToken = await getAuth().createCustomToken(kakaoUserId);
      } catch (e) {
        console.error("Failed to create custom token for kakao user:", e);
      }

      res.json({
        id: kakaoUserId,
        givenName: profile.nickname || "",
        imageUrl: profile.profile_image_url || "",
        email: kakaoAccount.email || "",
        provider: "kakao",
        ...(customToken ? { customToken } : {}),
      });
    } catch (e) {
      console.error("kakaoAuth error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);


/** Firebase Auth 사용자 프로필 생성/업데이트 */
async function ensureFirebaseAuthUser(
  uid: string,
  profile: { displayName?: string; email?: string; photoURL?: string }
) {
  const auth = getAuth();
  // undefined/빈 값 제거
  const clean: Record<string, string> = {};
  if (profile.displayName) clean.displayName = profile.displayName;
  if (profile.email) clean.email = profile.email;
  if (profile.photoURL) clean.photoURL = profile.photoURL;

  try {
    await auth.updateUser(uid, clean);
  } catch (e: any) {
    if (e.code === "auth/user-not-found") {
      await auth.createUser({ uid, ...clean });
    } else {
      console.error("ensureFirebaseAuthUser error:", e);
    }
  }
}

/**
 * Google 로그인용 Firebase Custom Token 발급.
 * 클라이언트에서 Google idToken을 보내면 검증 후 Firebase Custom Token을 반환.
 */
const GOOGLE_WEB_CLIENT_ID = "834065889708-h51gv3lorhvq919876lbt91mc06kblj9.apps.googleusercontent.com";
const googleOAuthClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

export const getFirebaseToken = onRequest(
  { cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { idToken, userId } = req.body;
    if (!idToken || !userId) {
      res.status(400).json({ error: "Missing idToken or userId" });
      return;
    }

    try {
      // Google idToken 검증
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken,
        audience: GOOGLE_WEB_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      // 클라이언트가 보낸 userId와 Google sub이 일치하는지 검증
      if (payload.sub !== userId) {
        res.status(403).json({ error: "userId mismatch" });
        return;
      }

      // Firebase Auth 사용자 프로필 세팅
      await ensureFirebaseAuthUser(userId, {
        displayName: payload.name,
        email: payload.email,
        photoURL: payload.picture,
      });

      // Firebase Custom Token 생성
      const customToken = await getAuth().createCustomToken(userId);
      res.json({ customToken });
    } catch (e) {
      console.error("getFirebaseToken error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * 카카오 재인증: userId로 Firebase Auth 사용자 확인 후 Custom Token 반환.
 * 앱 재시작 시 Firebase Auth 세션 복원용.
 */
export const refreshFirebaseToken = onRequest(
  { cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    if (req.headers["x-app-key"] !== APP_API_KEY) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    try {
      // Firebase Auth에 해당 유저가 존재하는지 확인
      await getAuth().getUser(userId);
      // Custom Token 생성
      const customToken = await getAuth().createCustomToken(userId);
      res.json({ customToken });
    } catch (e: any) {
      if (e.code === "auth/user-not-found") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      console.error("refreshFirebaseToken error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * 채팅 메시지 생성 시 → 방 참가자들에게 FCM 알림
 */
export const onChatMessageCreated = onDocumentCreated(
  "rooms/{roomId}/messages/{messageId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // 시스템 메시지(참가 승인/퇴장 등)는 채팅 알림 스킵 — 별도 FCM으로 처리됨
    if (data.type === "SYSTEM") return;

    const { senderId, senderName, text } = data;
    const roomId = event.params.roomId;

    // 방 정보 조회
    const roomDoc = await db.collection("rooms").doc(roomId).get();
    if (!roomDoc.exists) return;
    const roomData = roomDoc.data() as RoomData;

    // 수신 대상: 방장 + APPROVED 참가자 (발신자 제외)
    const recipientIds = new Set<string>();
    if (roomData.hostId !== senderId) {
      recipientIds.add(roomData.hostId);
    }
    for (const app of roomData.applicants || []) {
      const status = app.status || (app.isApproved ? "APPROVED" : "PENDING");
      if (status === "APPROVED" && app.userId && app.userId !== senderId) {
        recipientIds.add(app.userId);
      }
    }

    // 각 수신자에게 알림 발송
    for (const userId of recipientIds) {
      const { tokens, lang } = await getUserTokensAndLang(userId);
      if (tokens.length === 0) continue;
      await sendPush(
        tokens,
        `[${roomData.title}]`,
        PUSH_MESSAGES[lang].newChat(senderName, text || ""),
        { type: "NEW_CHAT_MESSAGE", roomId, senderName },
        userId
      );
    }
  }
);
