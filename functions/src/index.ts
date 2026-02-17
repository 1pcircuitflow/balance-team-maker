import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
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

/**
 * 기존 방에 memberUserIds 필드를 채워넣는 일회성 마이그레이션
 * 호출 후 삭제해도 됨
 */
export const migrateMemberUserIds = onRequest({ cors: true }, async (req, res) => {
  try {
    const roomsSnap = await db.collection("rooms").get();
    let updated = 0;
    let skipped = 0;
    const batch = db.batch();

    for (const doc of roomsSnap.docs) {
      const data = doc.data();
      // 이미 memberUserIds가 있으면 스킵
      if (data.memberUserIds && Array.isArray(data.memberUserIds) && data.memberUserIds.length > 0) {
        skipped++;
        continue;
      }

      const memberIds = new Set<string>();
      // 방장 추가
      if (data.hostId) {
        memberIds.add(data.hostId);
      }
      // APPROVED 참가자 추가
      for (const app of data.applicants || []) {
        const status = app.status || (app.isApproved ? "APPROVED" : "PENDING");
        if (status === "APPROVED" && app.userId) {
          memberIds.add(app.userId);
        }
      }

      if (memberIds.size > 0) {
        batch.update(doc.ref, { memberUserIds: Array.from(memberIds) });
        updated++;
      }
    }

    await batch.commit();
    res.json({ success: true, updated, skipped, total: roomsSnap.size });
  } catch (e) {
    console.error("migrateMemberUserIds error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
