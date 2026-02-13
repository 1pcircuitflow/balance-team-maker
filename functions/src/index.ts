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
}

interface RoomData {
  hostId: string;
  title: string;
  applicants: Applicant[];
  fcmToken?: string;
}

/**
 * rooms/{roomId} 문서가 업데이트될 때 트리거.
 * applicants 배열에 새 항목이 추가되면 방장에게 FCM 푸시 알림 발송.
 */
export const onRoomUpdated = onDocumentUpdated("rooms/{roomId}", async (event) => {
  const beforeData = event.data?.before.data() as RoomData | undefined;
  const afterData = event.data?.after.data() as RoomData | undefined;

  if (!beforeData || !afterData) return;

  const prevApplicants = beforeData.applicants || [];
  const newApplicants = afterData.applicants || [];

  // applicants가 증가한 경우만 처리 (신규 참가신청)
  if (newApplicants.length <= prevApplicants.length) return;

  // 새로 추가된 신청자 찾기
  const prevIds = new Set(prevApplicants.map((a) => a.id));
  const addedApplicants = newApplicants.filter((a) => !prevIds.has(a.id));

  if (addedApplicants.length === 0) return;

  const hostId = afterData.hostId;
  const roomTitle = afterData.title;

  // 1) users/{hostId} 문서에서 fcmTokens 조회
  let tokens: string[] = [];
  try {
    const userDoc = await db.collection("users").doc(hostId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      tokens = userData?.fcmTokens || [];
    }
  } catch (e) {
    console.error("Failed to fetch user fcmTokens:", e);
  }

  // 2) fallback: room 문서의 fcmToken
  if (tokens.length === 0 && afterData.fcmToken) {
    tokens = [afterData.fcmToken];
  }

  if (tokens.length === 0) {
    console.log("No FCM tokens found for host:", hostId);
    return;
  }

  // 각 새 신청자에 대해 푸시 발송
  for (const applicant of addedApplicants) {
    const message = {
      notification: {
        title: `[${roomTitle}]`,
        body: `${applicant.name} (${newApplicants.length})`,
      },
      data: {
        type: "NEW_APPLICANT",
        roomId: event.params.roomId,
        applicantName: applicant.name,
        totalCount: String(newApplicants.length),
      },
      android: {
        notification: {
          channelId: "recruit_channel",
          icon: "ic_stat_icon_config_sample",
          sound: "default" as const,
        },
      },
      tokens: tokens,
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);

      // 만료/무효 토큰 정리
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
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
          await db
            .collection("users")
            .doc(hostId)
            .update({
              fcmTokens: FieldValue.arrayRemove(...invalidTokens),
            });
          console.log("Removed invalid tokens:", invalidTokens);
        }
      }

      console.log(
        `FCM sent for ${applicant.name}: ${response.successCount} success, ${response.failureCount} failure`
      );
    } catch (e) {
      console.error("FCM send error:", e);
    }
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
