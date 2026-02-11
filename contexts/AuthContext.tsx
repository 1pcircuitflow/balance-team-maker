import React, { createContext, useContext, useState, useCallback } from 'react';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { TRANSLATIONS } from '../translations';
import { useAppContext } from './AppContext';
import { loadPlayersFromCloud } from '../services/firebaseService';
import { SAMPLE_PLAYERS_BY_LANG } from '../sampleData';
import { Player } from '../types';

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
  handleLogout: (setPlayers: React.Dispatch<React.SetStateAction<Player[]>>, setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>) => void;
  showLoginModal: boolean;
  setShowLoginModal: React.Dispatch<React.SetStateAction<boolean>>;
  loginLater: boolean;
  setLoginLater: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [loginLater, setLoginLater] = useState(false);

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

      if (userNickname.startsWith(TRANSLATIONS[lang].guest)) {
        setUserNickname(googleUser.givenName);
        localStorage.setItem('app_user_nickname', googleUser.givenName);
      }

      setShowLoginModal(false);
      showAlert(t('welcomeMsg', googleUser.givenName), t('loginSuccessMsg'));

      setIsDataLoaded(false);
      const cloudPlayers = await loadPlayersFromCloud(googleUser.id);

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

  const handleLogout = useCallback((
    setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
    setIsDataLoaded: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    (async () => {
      try {
        await GoogleAuth.signOut();
      } catch (e) {
        console.error('Sign out error', e);
      }
    })();

    setUser(null);
    localStorage.removeItem('app_user');

    const rand = Math.floor(1000 + Math.random() * 9000);
    const newGuestName = `${TRANSLATIONS[lang].guest}(${rand})`;
    setUserNickname(newGuestName);
    localStorage.setItem('app_user_nickname', newGuestName);

    setIsDataLoaded(false);
    setPlayers(SAMPLE_PLAYERS_BY_LANG[lang] || []);
    localStorage.removeItem('futsal_balance_pro_players_v3');
    setIsDataLoaded(true);

    showAlert(t('logoutMsg'), t('logoutTitle'));
  }, [lang, showAlert, t]);

  return (
    <AuthContext.Provider value={{
      user, setUser, guestId, currentUserId, userNickname, setUserNickname,
      isAdFree, setIsAdFree, isProcessing, setIsProcessing,
      handleGoogleLogin, handleLogout,
      showLoginModal, setShowLoginModal, loginLater, setLoginLater
    }}>
      {children}
    </AuthContext.Provider>
  );
};
