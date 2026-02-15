import React, { createContext, useContext, useState, useCallback } from 'react';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { TRANSLATIONS } from '../translations';
import { useAppContext } from './AppContext';
import { loadPlayersFromCloud, removeUserFcmToken, loadUserProfile, saveUserProfile, loadUserNickname, syncApplicantProfile } from '../services/firebaseService';
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
}

const AuthContext = createContext<AuthContextValue>(null!);

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, showAlert, t } = useAppContext();

  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('app_user');
    return saved ? JSON.parse(saved) : null;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('app_user_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const needsOnboarding = !!user && (!userProfile || !userProfile.onboardingComplete);

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
      setUser(googleUser);
      localStorage.setItem('app_user', JSON.stringify(googleUser));

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
      isAdFree, setIsAdFree, isProcessing, setIsProcessing,
      handleGoogleLogin, handleKakaoLogin, completeKakaoLogin, handleLogout,
      showLoginModal, setShowLoginModal,
      userProfile, setUserProfile, needsOnboarding, updateAndSaveProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
