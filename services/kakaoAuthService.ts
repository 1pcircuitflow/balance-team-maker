import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const KAKAO_CLIENT_ID = '878d084cb95d54a3657541f72b9bbe97';
const KAKAO_AUTH_FUNCTION_URL = 'https://us-central1-balance-team-maker.cloudfunctions.net/kakaoAuth';

const KAKAO_AUTH_BASE = 'https://kauth.kakao.com/oauth/authorize';

const KAKAO_CALLBACK_URL = 'https://belo-apply.web.app/kakao-callback';

function getRedirectUri(): string {
  // 네이티브/웹 모두 동일한 웹 URL 사용 (카카오 콘솔에 등록된 URI)
  // 네이티브의 경우 콜백 페이지에서 커스텀 스킴으로 다시 리다이렉트
  return KAKAO_CALLBACK_URL;
}

export async function openKakaoAuth(): Promise<void> {
  const redirectUri = getRedirectUri();
  const authUrl = `${KAKAO_AUTH_BASE}?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;

  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url: authUrl });
  } else {
    window.location.href = authUrl;
  }
}

export async function exchangeKakaoCode(code: string): Promise<{
  id: string;
  givenName: string;
  imageUrl: string;
  email: string;
  provider: string;
}> {
  const redirectUri = getRedirectUri();
  const res = await fetch(KAKAO_AUTH_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Kakao auth failed');
  }

  return res.json();
}
