import React, { useState, useRef } from 'react';
import { Language } from '../translations';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { AnalyticsService } from '../services/analyticsService';
import * as Icons from '../Icons';

const { EditIcon, CheckIcon, ExternalLinkIcon } = Icons;

const ToggleSwitch: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative w-[42px] h-[26px] rounded-full transition-colors duration-200 flex-shrink-0 ${value ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
  >
    <div className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform duration-200 ${value ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
  </button>
);

const LANGUAGES: { code: Language; flag: string; name: string }[] = [
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'pt', flag: '🇧🇷', name: 'Português' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
];

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const SettingsPage: React.FC = () => {
  const { darkMode, setDarkMode, lang, setLang: setLangRaw, t, showConfirm, showAlert, pushEnabled, setPushEnabled, recruitNotifEnabled, setRecruitNotifEnabled, setShowGuideModal } = useAppContext();
  const { user, userNickname: nickname, setUserNickname, handleLogout, setShowLoginModal, isAdFree, setIsAdFree } = useAuthContext();
  const { players, setPlayers, setIsDataLoaded } = usePlayerContext();
  const { showTier, setShowTier, sortMode, setSortMode, useTeamColors, setUseTeamColors } = useTeamBalanceContext();

  const setLang = (newLang: Language) => {
    setLangRaw(newLang);
    localStorage.setItem('app_lang_manual', newLang);
    AnalyticsService.logEvent('change_language', { language: newLang });
  };
  const onUpdateNickname = (name: string) => { setUserNickname(name); localStorage.setItem('app_user_nickname', name); };
  const onLogin = () => setShowLoginModal(true);
  const onLogout = () => showConfirm(t('logoutConfirm'), () => handleLogout(setPlayers, setIsDataLoaded), t('logoutTitle'));
  const [langOpen, setLangOpen] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(nickname);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === lang);

  const handleExport = () => {
    try {
      const data = JSON.stringify(players, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `balance_team_members_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showAlert(t('dataExportSuccess'));
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setPlayers(parsed);
          showAlert(t('dataImportSuccess'));
        } else {
          showAlert(t('dataImportError'));
        }
      } catch {
        showAlert(t('dataImportError'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    showConfirm(t('resetAllDataConfirm'), () => {
      localStorage.clear();
      setPlayers([]);
      window.location.reload();
    }, t('resetAllData'));
  };

  const handleNicknameSave = () => {
    const trimmed = nicknameInput.trim();
    if (trimmed) {
      onUpdateNickname(trimmed);
    }
    setEditingNickname(false);
  };

  const handleRateApp = () => {
    window.open('https://play.google.com/store/apps/details?id=com.balanceteammaker', '_blank');
  };

  return (
    <div className="w-full px-5 pt-3 animate-in fade-in duration-500">
      {/* Section: Account */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsAccount')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          {/* Account Type */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('accountType')}</span>
            <span className="text-[12px] text-slate-400">{user ? (user.provider === 'kakao' ? t('kakaoAccount') : t('googleAccount')) : t('guestMode')}</span>
          </div>
          {/* Nickname */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('nickname')}</span>
            {editingNickname ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={e => setNicknameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleNicknameSave(); }}
                  className="w-32 px-2 py-1 text-[14px] text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button onClick={handleNicknameSave} className="text-emerald-500 p-1">
                  <CheckIcon />
                </button>
              </div>
            ) : (
              <button type="button" className="flex items-center gap-2 cursor-pointer" onClick={() => { setNicknameInput(nickname); setEditingNickname(true); }} aria-label={t('nickname')}>
                <span className="text-[12px] text-slate-400">{nickname}</span>
                <span className="text-slate-300 dark:text-slate-600"><EditIcon /></span>
              </button>
            )}
          </div>
          {/* Login / Logout */}
          <div className="px-5 py-3">
            {user ? (
              <button
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-red-500 transition-all active:scale-[0.98]"
              >
                {t('logout')}
              </button>
            ) : (
              <button
                onClick={onLogin}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-[12px] font-medium text-white dark:text-slate-900 transition-all active:scale-[0.98]"
              >
                {t('googleLogin')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section: Appearance */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsAppearance')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          {/* Dark Mode */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('darkMode')}</span>
            <ToggleSwitch value={darkMode} onChange={setDarkMode} />
          </div>
          {/* Language */}
          <div>
            <button
              type="button"
              className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
              onClick={() => setLangOpen(!langOpen)}
              aria-expanded={langOpen}
            >
              <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('language')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-400">{currentLang?.flag} {currentLang?.name}</span>
                <ChevronIcon open={langOpen} />
              </div>
            </button>
            {langOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full px-5 py-3 flex items-center justify-between transition-all ${lang === l.code ? 'bg-slate-50 dark:bg-slate-800' : 'active:bg-slate-50 dark:active:bg-slate-800'}`}
                  >
                    <span className={`text-[14px] ${lang === l.code ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-normal text-slate-700 dark:text-slate-300'}`}>
                      {l.flag} {l.name}
                    </span>
                    {lang === l.code && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Notifications */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsNotifications')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('pushNotifications')}</span>
            <ToggleSwitch value={pushEnabled} onChange={setPushEnabled} />
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('recruitmentNotifications')}</span>
            <ToggleSwitch value={recruitNotifEnabled} onChange={setRecruitNotifEnabled} />
          </div>
        </div>
      </div>

      {/* Section: Defaults */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsDefaults')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          {/* Show Tier */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('defaultShowTier')}</span>
            <ToggleSwitch value={showTier} onChange={setShowTier} />
          </div>
          {/* Sort Mode */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('defaultSortMode')}</span>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setSortMode('name')}
                className={`px-3 py-1.5 text-[12px] font-medium transition-all ${sortMode === 'name' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {t('sortByName')}
              </button>
              <button
                onClick={() => setSortMode('tier')}
                className={`px-3 py-1.5 text-[12px] font-medium transition-all ${sortMode === 'tier' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {t('sortByTier')}
              </button>
            </div>
          </div>
          {/* Team Colors */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('defaultTeamColors')}</span>
            <ToggleSwitch value={useTeamColors} onChange={setUseTeamColors} />
          </div>
        </div>
      </div>

      {/* Section: Data Management */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsDataManagement')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          {/* Export */}
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
            onClick={handleExport}
          >
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('exportData')}</span>
            <span className="text-slate-400"><DownloadIcon /></span>
          </button>
          {/* Import */}
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('importData')}</span>
            <span className="text-slate-400"><UploadIcon /></span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          {/* Reset */}
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer active:bg-red-50 dark:active:bg-red-950/20 text-left"
            onClick={handleReset}
          >
            <span className="text-[12px] font-normal text-red-500">{t('resetAllData')}</span>
            <span className="text-red-400"><TrashIcon /></span>
          </button>
        </div>
      </div>

      {/* Section 5: About */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-[14px] font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{t('settingsAbout')}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          {/* Usage Guide */}
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
            onClick={() => setShowGuideModal(true)}
          >
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('usageGuide')}</span>
            <span className="text-slate-400"><ExternalLinkIcon /></span>
          </button>
          {/* Rate App */}
          <button
            type="button"
            className="w-full px-5 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 text-left"
            onClick={handleRateApp}
          >
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('rateApp')}</span>
            <span className="text-slate-400"><ExternalLinkIcon /></span>
          </button>
          {/* Version */}
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-[12px] font-normal text-slate-900 dark:text-white">{t('version')}</span>
            <span className="text-[12px] text-slate-400">2.1.26</span>
          </div>
        </div>
      </div>
    </div>
  );
};
