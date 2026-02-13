import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, Language } from '../translations';
import { getInitialLang } from '../utils/helpers';

interface AlertState {
  isOpen: boolean;
  title?: string;
  message: string;
}

interface ConfirmState {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface AppContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  pushEnabled: boolean;
  setPushEnabled: (v: boolean) => void;
  recruitNotifEnabled: boolean;
  setRecruitNotifEnabled: (v: boolean) => void;
  t: (key: string, ...args: any[]) => string;
  showAlert: (message: string, title?: string) => void;
  alertState: AlertState;
  setAlertState: React.Dispatch<React.SetStateAction<AlertState>>;
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
  showConfirm: (message: string, onConfirm: () => void, title?: string, confirmText?: string, cancelText?: string) => void;
}

const AppContext = createContext<AppContextValue>(null!);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(getInitialLang());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_push_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [recruitNotifEnabled, setRecruitNotifEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_recruit_notif_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  });

  const t = useCallback((key: string, ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  }, [lang]);

  const showAlert = useCallback((message: string, title?: string) => {
    setAlertState({ isOpen: true, message, title });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, title?: string, confirmText?: string, cancelText?: string) => {
    setConfirmState({ isOpen: true, message, onConfirm, title, confirmText, cancelText });
  }, []);

  // Dark mode class sync
  useEffect(() => {
    localStorage.setItem('app_dark_mode', darkMode.toString());
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Notification settings sync
  useEffect(() => {
    localStorage.setItem('app_push_enabled', pushEnabled.toString());
  }, [pushEnabled]);

  useEffect(() => {
    localStorage.setItem('app_recruit_notif_enabled', recruitNotifEnabled.toString());
  }, [recruitNotifEnabled]);

  // Font sync for Japanese
  useEffect(() => {
    if (lang === 'ja') {
      document.body.style.fontFamily = '"Pretendard JP Variable", "Pretendard JP", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    } else {
      document.body.style.fontFamily = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
    }
  }, [lang]);

  return (
    <AppContext.Provider value={{ lang, setLang, darkMode, setDarkMode, pushEnabled, setPushEnabled, recruitNotifEnabled, setRecruitNotifEnabled, t, showAlert, alertState, setAlertState, confirmState, setConfirmState, showConfirm }}>
      {children}
    </AppContext.Provider>
  );
};
