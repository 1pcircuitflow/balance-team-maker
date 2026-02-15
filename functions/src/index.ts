import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const kakaoRestApiKey = defineSecret("KAKAO_REST_API_KEY");

initializeApp();

const db = getFirestore();

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
}

type Lang = "ko" | "en" | "es" | "ja" | "pt";

const PUSH_MESSAGES: Record<
  Lang,
  { approved: string; rejected: string; cancelled: (name: string) => string }
> = {
  ko: {
    approved: "참가가 승인되었습니다",
    rejected: "참가가 거절되었습니다",
    cancelled: (name) => `${name}님이 참가를 취소했습니다`,
  },
  en: {
    approved: "Your application has been approved",
    rejected: "Your application has been rejected",
    cancelled: (name) => `${name} cancelled the application`,
  },
  es: {
    approved: "Tu solicitud ha sido aprobada",
    rejected: "Tu solicitud ha sido rechazada",
    cancelled: (name) => `${name} ha cancelado la solicitud`,
  },
  ja: {
    approved: "参加が承認されました",
    rejected: "参加が拒否されました",
    cancelled: (name) => `${name}さんが参加をキャンセルしました`,
  },
  pt: {
    approved: "Sua inscrição foi aprovada",
    rejected: "Sua inscrição foi rejeitada",
    cancelled: (name) => `${name} cancelou a inscrição`,
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

  // 1. 신규 참가신청 감지 → 방장에게 알림
  const addedApplicants = newApplicants.filter(
    (a) => !prevMap.has(a.id) && a.status !== "APPROVED"
  );
  if (addedApplicants.length > 0) {
    const { tokens } = await getHostTokens(hostId, afterData.fcmToken);
    for (const applicant of addedApplicants) {
      await sendPush(
        tokens,
        `[${roomTitle}]`,
        `${applicant.name} (${newApplicants.length})`,
        {
          type: "NEW_APPLICANT",
          roomId,
          applicantName: applicant.name,
          totalCount: String(newApplicants.length),
        },
        hostId
      );
    }
  }

  // 2. 참가 취소 감지 → 방장에게 알림
  const removedApplicants = prevApplicants.filter((a) => !newMap.has(a.id));
  if (removedApplicants.length > 0) {
    const { tokens, lang } = await getHostTokens(hostId, afterData.fcmToken);
    for (const applicant of removedApplicants) {
      await sendPush(
        tokens,
        `[${roomTitle}]`,
        PUSH_MESSAGES[lang].cancelled(applicant.name),
        {
          type: "APPLICANT_CANCELLED",
          roomId,
          applicantName: applicant.name,
        },
        hostId
      );
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

    if (newStatus === "APPROVED") {
      const { tokens, lang } = await getApplicantTokens(newApp);
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
export const updateNickname = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { userId, newName } = req.body;
  if (!userId || !newName) {
    res.status(400).json({ error: "Missing params" });
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

    // 2. 참가자인 OPEN 방: applicants의 name 업데이트
    const openSnap = await db.collection("rooms").where("status", "==", "OPEN").get();
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
  { secrets: [kakaoRestApiKey], cors: true },
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

      res.json({
        id: `kakao_${userData.id}`,
        givenName: profile.nickname || "",
        imageUrl: profile.profile_image_url || "",
        email: kakaoAccount.email || "",
        provider: "kakao",
      });
    } catch (e) {
      console.error("kakaoAuth error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
