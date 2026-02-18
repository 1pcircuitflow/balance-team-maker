import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { TRANSLATIONS } from '../translations';
import { useAppContext } from './AppContext';
import { auth, loadPlayersFromCloud, removeUserFcmToken, loadUserProfile, saveUserProfile, loadUserNickname, syncApplicantProfile, getFirebaseCustomToken, firebaseSignInWithCustomToken, firebaseSignOutUser, subscribeToAuthState, refreshFirebaseTokenForUser } from '../services/firebaseService';
import { SAMPLE_PLAYERS_BY_LANG } from '../sampleData';
import { Player, UserProfile } from '../types';
import { openKakaoAuth, exchangeKakaoCode } from '../services/kakaoAuthService';

interface AuthContextValue {
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  guestId: string;
  currentUserId: string;
  userNickname: string;
  setUserNickname: React.Dispatch<React.SetStateAction<string>>;
  isAdFree: boolean;
  setIsAdFree: React.Dispatch<React.SetStateAction<boolean>>;
  adBannerHeight: number;
  setAdBannerHeight: React.Dispatch<React.SetStateAction<number>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  handleGoogleLogin: (setPlayers: React.Dispatch<React.SetStateAction<Player[]>>, setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>) => Promise<void>;
  handleKakaoLogin: (setPlayers: React.Dispatch<React.SetStateAction<Player[]>>, setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>) => Promise<void>;
  completeKakaoLogin: (code: string, setPlayers: React.Dispatch<React.SetStateAction<Player[]>>, setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>) => Promise<void>;
  handleLogout: (setPlayers: React.Dispatch<React.SetStateAction<Player[]>>, setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>) => void;
  showLoginModal: boolean;
  setShowLoginModal: React.Dispatch<React.SetStateAction<boolean>>;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  needsOnboarding: boolean;
  updateAndSaveProfile: (profile: UserProfile) => Promise<void>;
  firebaseAuthReady: boolean;
  isReauthenticating: boolean;
}

const AuthContext = createContext<AuthContextValue>(null!);

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, showAlert, t } = useAppContext();

  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('app_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [userNickname, setUserNickname] = useState(() => {
    const saved = localStorage.getItem('app_user_nickname');
    if (saved) return saved;
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newName = `${TRANSLATIONS[lang].guest}(${rand})`;
    localStorage.setItem('app_user_nickname', newName);
    return newName;
  });

  const [guestId] = useState(() => {
    const saved = localStorage.getItem('app_guest_id');
    if (saved) return saved;
    const newId = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('app_guest_id', newId);
    return newId;
  });

  const currentUserId = user?.id || guestId;

  const [isAdFree, setIsAdFree] = useState(() => localStorage.getItem('app_is_ad_free') === 'true');
  const [adBannerHeight, setAdBannerHeight] = useState(() => {
    const cached = localStorage.getItem('ad_banner_height');
    return cached ? parseInt(cached, 10) : 0;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('app_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const needsOnboarding = !!user && (!userProfile || !userProfile.onboardingComplete);

  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const reauthAttemptedRef = useRef(false);

  // Firebase Auth 상태 감시 + 자동 재인증
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase Auth 세션이 이미 있음 → 준비 완료
        setFirebaseAuthReady(true);
        reauthAttemptedRef.current = false;
        return;
      }

      // firebaseUser가 null — 아직 IndexedDB 복원 중일 수 있으니 1.5초 대기 후 재확인
      if (!user) {
        // 로그인한 유저 자체가 없으면 재인증 불필요
        setFirebaseAuthReady(true);
        return;
      }

      // 중복 재인증 방지
      if (reauthAttemptedRef.current) return;

      // 1.5초 후 다시 확인 (Firebase SDK IndexedDB 복원 시간)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 이미 복원되었으면 스킵 (onAuthStateChanged가 다시 호출됐을 수 있음)
      if (auth.currentUser) {
        setFirebaseAuthReady(true);
        return;
      }

      // Firebase Auth 세션이 없는데 localStorage에 유저가 있음 → 재인증 시도
      reauthAttemptedRef.current = true;
      setIsReauthenticating(true);

      try {
        const provider = user.provider;

        if (provider === 'kakao') {
          // 카카오: Cloud Function으로 새 Custom Token 발급
          const customToken = await refreshFirebaseTokenForUser(user.id);
          await firebaseSignInWithCustomToken(customToken);
          console.log('Firebase Auth (Kakao) re-authenticated successfully');
        } else {
          // Google: GoogleAuth.refresh()로 새 idToken → getFirebaseCustomToken → signIn
          try {
            const refreshResult = await GoogleAuth.refresh();
            const idToken = refreshResult?.idToken || refreshResult?.accessToken;
            if (idToken) {
              const customToken = await getFirebaseCustomToken(idToken, user.id);
              await firebaseSignInWithCustomToken(customToken);
              console.log('Firebase Auth (Google) re-authenticated successfully');
            } else {
              throw new Error('No idToken from GoogleAuth.refresh()');
            }
          } catch (googleErr) {
            // Google refresh 실패 시 Kakao 방식으로 fallback (이미 Firebase Auth 유저가 있을 수 있음)
            console.warn('Google refresh failed, trying refreshFirebaseToken fallback:', googleErr);
            const customToken = await refreshFirebaseTokenForUser(user.id);
            await firebaseSignInWithCustomToken(customToken);
            console.log('Firebase Auth (Google fallback) re-authenticated successfully');
          }
        }

        setFirebaseAuthReady(true);
      } catch (e) {
        console.error('Firebase re-authentication failed:', e);
        // 재인증 실패 → 세션 만료 알림
        showAlert(t('sessionExpiredMsg'), t('sessionExpiredTitle'));
        setFirebaseAuthReady(false);
      } finally {
        setIsReauthenticating(false);
      }
    });

    return () => unsubscribe();
  }, [user?.id, user?.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateAndSaveProfile = useCallback(async (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('app_user_profile', JSON.stringify(profile));
    if (currentUserId && user) {
      try {
        await saveUserProfile(currentUserId, profile);
        syncApplicantProfile(currentUserId, profile);
      } catch (e) {
        console.error('Failed to save profile to cloud:', e);
      }
    }
  }, [currentUserId, user]);

  const handleGoogleLogin = useCallback(async (
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const googleUser = await GoogleAuth.signIn();
      const googleUserWithProvider = { ...googleUser, provider: 'google' };
      setUser(googleUserWithProvider);
      localStorage.setItem('app_user', JSON.stringify(googleUserWithProvider));

      // Firebase Auth 세션 생성 (non-blocking — 실패해도 기존 플로우 계속)
      try {
        const idToken = googleUser.authentication?.idToken;
        if (idToken) {
          const customToken = await getFirebaseCustomToken(idToken, googleUser.id);
          await firebaseSignInWithCustomToken(customToken);
        }
      } catch (e) {
        console.warn('Firebase Auth (Google) failed — continuing without auth session:', e);
      }

      setShowLoginModal(false);
      showAlert(t('welcomeMsg', googleUser.givenName), t('loginSuccessMsg'));

      setIsDataLoaded(false);
      const [cloudPlayers, cloudProfile, cloudNickname] = await Promise.all([
        loadPlayersFromCloud(googleUser.id),
        loadUserProfile(googleUser.id),
        loadUserNickname(googleUser.id),
      ]);

      if (cloudNickname) {
        setUserNickname(cloudNickname);
        localStorage.setItem('app_user_nickname', cloudNickname);
      } else if (userNickname.startsWith(TRANSLATIONS[lang].guest)) {
        setUserNickname(googleUser.givenName);
        localStorage.setItem('app_user_nickname', googleUser.givenName);
      }

      if (cloudProfile) {
        setUserProfile(cloudProfile);
        localStorage.setItem('app_user_profile', JSON.stringify(cloudProfile));
      }

      setPlayers(prev => {
        const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
        const actualLocalPlayers = prev.filter(p => !sampleIdPattern.test(p.id));

        if (!cloudPlayers || cloudPlayers.length === 0) {
          return actualLocalPlayers.length > 0 ? actualLocalPlayers : prev;
        }

        const merged = [...cloudPlayers];
        actualLocalPlayers.forEach(lp => {
          const isDuplicate = merged.some(cp => cp.name === lp.name);
          if (!isDuplicate) {
            merged.push(lp);
          }
        });

        return merged;
      });
      setIsDataLoaded(true);
    } catch (e: any) {
      console.error('Login failed', e);
      if (e.error !== 'user_cancelled') {
        showAlert(`Login failed: ${e.message || 'Unknown error'}`, 'Error');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, userNickname, lang, showAlert, t]);

  const handleKakaoLogin = useCallback(async (
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await openKakaoAuth();
      // 네이티브에서는 딥링크 콜백으로, 웹에서는 리다이렉트로 코드 수신
      // 실제 코드 교환은 App.tsx의 딥링크/URL 핸들러에서 처리
    } catch (e: any) {
      console.error('Kakao login failed', e);
      showAlert(`Login failed: ${e.message || 'Unknown error'}`, 'Error');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, showAlert]);

  const completeKakaoLogin = useCallback(async (
    code: string,
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setIsProcessing(true);
    try {
      const kakaoUser = await exchangeKakaoCode(code);
      const userObj = { id: kakaoUser.id, givenName: kakaoUser.givenName, imageUrl: kakaoUser.imageUrl, email: kakaoUser.email, provider: 'kakao' };
      setUser(userObj);
      localStorage.setItem('app_user', JSON.stringify(userObj));

      // Firebase Auth 세션 생성 (non-blocking — 실패해도 기존 플로우 계속)
      if (kakaoUser.customToken) {
        try {
          await firebaseSignInWithCustomToken(kakaoUser.customToken);
        } catch (e) {
          console.warn('Firebase Auth (Kakao) failed — continuing without auth session:', e);
        }
      }

      setShowLoginModal(false);
      showAlert(t('welcomeMsg', kakaoUser.givenName), t('loginSuccessMsg'));

      setIsDataLoaded(false);
      const [cloudPlayers, cloudProfile, cloudNickname] = await Promise.all([
        loadPlayersFromCloud(kakaoUser.id),
        loadUserProfile(kakaoUser.id),
        loadUserNickname(kakaoUser.id),
      ]);

      if (cloudNickname) {
        setUserNickname(cloudNickname);
        localStorage.setItem('app_user_nickname', cloudNickname);
      } else if (userNickname.startsWith(TRANSLATIONS[lang].guest)) {
        setUserNickname(kakaoUser.givenName);
        localStorage.setItem('app_user_nickname', kakaoUser.givenName);
      }

      if (cloudProfile) {
        setUserProfile(cloudProfile);
        localStorage.setItem('app_user_profile', JSON.stringify(cloudProfile));
      }

      setPlayers(prev => {
        const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
        const actualLocalPlayers = prev.filter(p => !sampleIdPattern.test(p.id));

        if (!cloudPlayers || cloudPlayers.length === 0) {
          return actualLocalPlayers.length > 0 ? actualLocalPlayers : prev;
        }

        const merged = [...cloudPlayers];
        actualLocalPlayers.forEach(lp => {
          const isDuplicate = merged.some(cp => cp.name === lp.name);
          if (!isDuplicate) {
            merged.push(lp);
          }
        });

        return merged;
      });
      setIsDataLoaded(true);
    } catch (e: any) {
      console.error('Kakao code exchange failed', e);
      showAlert(`Login failed: ${e.message || 'Unknown error'}`, 'Error');
    } finally {
      setIsProcessing(false);
    }
  }, [userNickname, lang, showAlert, t]);

  const handleLogout = useCallback((
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    (async () => {
      try {
        const fcmToken = localStorage.getItem('fcm_token');
        if (fcmToken && currentUserId) {
          await removeUserFcmToken(currentUserId, fcmToken);
        }
        // provider에 따라 분기 (카카오는 별도 signOut 불필요)
        if (!user?.provider || user.provider !== 'kakao') {
          await GoogleAuth.signOut();
        }
        // Firebase Auth 세션 종료
        await firebaseSignOutUser();
      } catch (e) {
        console.error('Sign out error', e);
      }
    })();

    setUser(null);
    localStorage.removeItem('app_user');
    setUserProfile(null);
    localStorage.removeItem('app_user_profile');

    const rand = Math.floor(1000 + Math.random() * 9000);
    const newGuestName = `${TRANSLATIONS[lang].guest}(${rand})`;
    setUserNickname(newGuestName);
    localStorage.setItem('app_user_nickname', newGuestName);

    setIsDataLoaded(false);
    setPlayers(SAMPLE_PLAYERS_BY_LANG[lang] || []);
    localStorage.removeItem('futsal_balance_pro_players_v3');
    setIsDataLoaded(true);

    showAlert(t('logoutMsg'), t('logoutTitle'));
    setShowLoginModal(true);
  }, [lang, showAlert, t, user, currentUserId]);

  return (
    <AuthContext.Provider value={{
      user, setUser, guestId, currentUserId, userNickname, setUserNickname,
      isAdFree, setIsAdFree, adBannerHeight, setAdBannerHeight, isProcessing, setIsProcessing,
      handleGoogleLogin, handleKakaoLogin, completeKakaoLogin, handleLogout,
      showLoginModal, setShowLoginModal,
      userProfile, setUserProfile, needsOnboarding, updateAndSaveProfile,
      firebaseAuthReady, isReauthenticating
    }}>
      {children}
    </AuthContext.Provider>
  );
};
