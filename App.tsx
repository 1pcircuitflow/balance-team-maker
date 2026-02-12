import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Player, Tier, BalanceResult, SportType, Position, TeamConstraint, BottomTabType, AppPageType, DetailPageTab } from './types';
import { STORAGE_KEY, TIER_BADGE_COLORS, SPORT_IMAGES, TEAM_COLORS } from './constants';
import { generateBalancedTeams } from './services/balanceService';
import { TRANSLATIONS, Language } from './translations';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents, RewardAdOptions, InterstitialAdPluginEvents, AdLoadInfo } from '@capacitor-community/admob';
import { SAMPLE_PLAYERS_BY_LANG } from './sampleData';
import { AnalyticsService } from './services/analyticsService';
import { paymentService, PRODUCT_IDS } from './services/paymentService';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';
import {
  createRecruitmentRoom,
  getRoomInfo,
  applyForParticipation,
  cancelApplication,
  subscribeToRoom,
  subscribeToUserRooms,
  updateRoomFcmToken,
  RecruitmentRoom,
  Applicant,
  Announcement,
  db,
  savePlayersToCloud,
  loadPlayersFromCloud,
  checkAppVersion,
  subscribeToAnnouncements
} from './services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';

import * as Icons from './Icons';
const {
  PlusIcon, MinusIcon, TrashIcon, EditIcon, CheckIcon, ShuffleIcon,
  UserPlusIcon, UserPlusFilledIcon, UserCheckIcon, ShareIcon, SunIcon, MoonIcon,
  SlidersIcon, InfoIcon, GlobeIcon, ExternalLinkIcon, MoreIcon, MoreFilledIcon,
  SettingsIcon, SettingsFilledIcon, HeartIcon, RotateCcwIcon, CloseIcon, HelpCircleIcon, HomeIcon, HomeFilledIcon, ArrowLeftIcon, PlayIcon
} = Icons;
import { DateTimePicker } from './components/DateTimePicker';

// Utilities
import { compareVersions, getInitialLang, getPosLabel, parseTier, tierToLabel } from './utils/helpers';

// Contexts
import { AppProvider, useAppContext } from './contexts/AppContext';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { PlayerProvider, usePlayerContext } from './contexts/PlayerContext';

// Hooks
import { useNavigation } from './hooks/useNavigation';
import { useTeamBalance } from './hooks/useTeamBalance';
import { useRecruitmentRooms } from './hooks/useRecruitmentRooms';
import { useInitialization } from './hooks/useInitialization';

// Components
import { AdBanner } from './components/AdBanner';
import { LoadingOverlay } from './components/LoadingOverlay';
import { PlayerItem } from './components/PlayerItem';
import { LanguageMenu } from './components/LanguageMenu';
import { FormationPicker } from './components/FormationPicker';
import { QuotaFormationPicker } from './components/QuotaFormationPicker';
import { Toast } from './components/Toast';
// Modals
import { AlertModal } from './components/modals/AlertModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { UpdateModal } from './components/modals/UpdateModal';
import { GuideModal } from './components/modals/GuideModal';
import { InfoModal } from './components/modals/InfoModal';
import { ReviewPrompt } from './components/modals/ReviewPrompt';
import { LoginPage } from './components/modals/LoginPage';
import { PositionLimitModal } from './components/modals/PositionLimitModal';
import { RewardAdModal } from './components/modals/RewardAdModal';
import { LoginRecommendModal } from './components/modals/LoginRecommendModal';
import { HostRoomModal } from './components/modals/HostRoomModal';
import { ApplyRoomModal } from './components/modals/ApplyRoomModal';

// Pages
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './components/SettingsPage';

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthProvider>
        <PlayerProvider>
          <AppContent />
        </PlayerProvider>
      </AuthProvider>
    </AppProvider>
  );
};

const AppContent: React.FC = () => {
  const { lang, setLang, darkMode, setDarkMode, t, showAlert, alertState, setAlertState, confirmState, setConfirmState, showConfirm } = useAppContext();
  const { user, guestId, currentUserId, userNickname, setUserNickname, isAdFree, setIsAdFree, isProcessing, setIsProcessing, handleGoogleLogin, handleLogout, showLoginModal, setShowLoginModal, loginLater, setLoginLater } = useAuthContext();
  const { players, setPlayers, isDataLoaded, setIsDataLoaded } = usePlayerContext();

  const nav = useNavigation();
  const { currentBottomTab, setCurrentBottomTab, currentPage, setCurrentPage, detailTab, setDetailTab, touchStartX, setTouchStartX } = nav;

  const [activeTab, setActiveTab] = useState<SportType>(() => {
    const saved = localStorage.getItem('last_active_tab');
    return (saved as SportType) || SportType.GENERAL;
  });

  const isPro = isAdFree;
  const isUnlimitedPos = true;
  const TIER_COLORS = TIER_BADGE_COLORS;

  const balance = useTeamBalance(players, activeTab, showAlert, t, isAdFree, setCurrentPage, AppPageType);
  const {
    teamCount, setTeamCount, result, setResult, isSharing, setIsSharing,
    quotas, setQuotas, showQuotaSettings, setShowQuotaSettings, isQuotaSettingsExpanded, setIsQuotaSettingsExpanded,
    isGenerating, countdown, useRandomMix, setUseRandomMix,
    useTeamColors, setUseTeamColors, showColorPicker, setShowColorPicker,
    selectedTeamColors, setSelectedTeamColors, editingResultTeamIdx, setEditingResultTeamIdx,
    showTier, setShowTier, sortMode, setSortMode,
    selectionMode, setSelectionMode, selectedPlayerIds, setSelectedPlayerIds,
    teamConstraints, setTeamConstraints,
    isBalanceSettingsOpen, setIsBalanceSettingsOpen,
    showLimitModal, setShowLimitModal, showRewardAd, setShowRewardAd,
    showReviewPrompt, setShowReviewPrompt,
    activePlayers, memberPlayers,
    searchQuery, setSearchQuery,
    resultHistory, setResultHistory,
    showHistory, setShowHistory,
    updateQuota, toggleQuotaMode, currentQuotaTotal,
    handleUpdateResultTeamColor, getSortedTeamPlayers, handleGenerate,
    handleReviewLater, handleRateApp, expectedPerTeam,
    positionUsage, setPositionUsage,
  } = balance;

  const rooms = useRecruitmentRooms(currentUserId, activeTab, players, setPlayers, showAlert, t, lang, setActiveTab);
  const {
    activeRooms, setActiveRooms, filteredRooms,
    currentActiveRoom, setCurrentActiveRoom,
    showHostRoomModal, setShowHostRoomModal,
    showApplyRoomModal, setShowApplyRoomModal,
    pendingJoinRoomId, setPendingJoinRoomId,
    memberSuggestion, setMemberSuggestion,
    activeActionMenuId, setActiveActionMenuId,
    editingApplicantId, setEditingApplicantId,
    hostRoomSelectedSport, setHostRoomSelectedSport,
    hostRoomTitle, setHostRoomTitle,
    hostRoomDate, setHostRoomDate,
    hostRoomTime, setHostRoomTime,
    hostRoomEndDate, setHostRoomEndDate,
    hostRoomEndTime, setHostRoomEndTime,
    hostRoomUseLimit, setHostRoomUseLimit,
    hostRoomMaxApplicants, setHostRoomMaxApplicants,
    hostRoomVenue, setHostRoomVenue,
    hostRoomTierMode, setHostRoomTierMode,
    hostRoomActivePicker, setHostRoomActivePicker,
    hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode,
    handleApproveApplicant, handleUpdateApplicant, handleApproveAllApplicants,
    handleShareRecruitLink, handleCloseRecruitRoom, handleUpdateRoom,
  } = rooms;

  // Modal states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginRecommendModal, setShowLoginRecommendModal] = useState(false);
  const [pendingUpgradeType, setPendingUpgradeType] = useState<'AD_FREE' | 'FULL' | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ message: string; forceUpdate: boolean; storeUrl: string; } | null>(null);

  // Announcement state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_announcements') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const unsub = subscribeToAnnouncements(setAnnouncements);
    return () => unsub();
  }, []);

  const visibleAnnouncement = useMemo(() => {
    return announcements.find(a => !dismissedAnnouncements.includes(a.id)) || null;
  }, [announcements, dismissedAnnouncements]);

  const getAnnouncementText = useCallback((a: Announcement) => {
    if (a.messages && a.messages[lang]) return a.messages[lang]!;
    return a.message;
  }, [lang]);

  const dismissAnnouncement = useCallback((id: string) => {
    setDismissedAnnouncements(prev => {
      const next = [...prev, id];
      localStorage.setItem('dismissed_announcements', JSON.stringify(next));
      return next;
    });
  }, []);

  const announcementTextRef = useRef<HTMLSpanElement>(null);
  const announcementWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: Animation | null = null;
    const timer = setTimeout(() => {
      const textEl = announcementTextRef.current;
      const wrapEl = announcementWrapRef.current;
      if (textEl && wrapEl && textEl.scrollWidth > wrapEl.clientWidth) {
        const distance = textEl.scrollWidth - wrapEl.clientWidth + 40;
        const slideDuration = distance * 50;
        const pause = 1500;
        const totalDuration = slideDuration + pause * 2;
        const pauseRatio = pause / totalDuration;
        anim = textEl.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(0)', offset: pauseRatio },
            { transform: `translateX(-${distance}px)`, offset: 1 - pauseRatio },
            { transform: `translateX(-${distance}px)` },
          ],
          { duration: totalDuration, iterations: Infinity }
        );
      }
    }, 300);
    return () => { clearTimeout(timer); anim?.cancel(); };
  }, [visibleAnnouncement, lang]);

  // Player form state
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<Tier>(Tier.B);
  const [newP1s, setNewP1s] = useState<Position[]>([]);
  const [newP2s, setNewP2s] = useState<Position[]>([]);
  const [newP3s, setNewP3s] = useState<Position[]>([]);
  const [newForbidden, setNewForbidden] = useState<Position[]>([]);
  const [showNewPlayerFormation, setShowNewPlayerFormation] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);
  const [unselectAllConfirm, setUnselectAllConfirm] = useState(false);
  const [showRoomDetail, setShowRoomDetail] = useState(false);
  const [showMemberPickerModal, setShowMemberPickerModal] = useState(false);

  // Section collapse states
  const [isPlayerRegistrationOpen, setIsPlayerRegistrationOpen] = useState(false);
  const [isWaitingListOpen, setIsWaitingListOpen] = useState(false);
  const [isParticipatingListOpen, setIsParticipatingListOpen] = useState(true);

  // Reward ad handler
  const handleRewardAdComplete = () => {
    setShowRewardAd(false);
    setPositionUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 3) }));
    showAlert(t('bonusUnlockedMsg'), t('bonusUnlockedTitle'));
  };

  // Initialization hook
  useInitialization(
    lang, setLang, user, loginLater, setShowLoginModal, setIsAdFree,
    currentActiveRoom?.id, setAlertState, setPendingJoinRoomId,
    setShowUpdateModal, setUpdateInfo, handleRewardAdComplete, t,
  );

  // Tab persistence
  useEffect(() => { localStorage.setItem('last_active_tab', activeTab); }, [activeTab]);

  const changeTab = (tab: SportType) => {
    setActiveTab(tab);
    setResult(null);
    setShowRoomDetail(false);
    setCurrentPage(AppPageType.HOME);
    localStorage.setItem('last_active_tab', tab);
  };

  // Deep link auto-open
  useEffect(() => {
    if (pendingJoinRoomId) {
      setShowApplyRoomModal(true);
    }
  }, [pendingJoinRoomId]);

  // Back button handler (optimized with ref to avoid re-registering)
  const modalStateRef = useRef({
    alertIsOpen: alertState.isOpen, showRewardAd, showLoginModal, showLoginRecommendModal,
    showUpgradeModal, showLimitModal, showReviewPrompt, showInfoModal, showApplyRoomModal,
    showHostRoomModal, showColorPicker, showQuotaSettings, selectionMode, currentPage,
    currentBottomTab, showMemberPickerModal,
  });
  useEffect(() => {
    modalStateRef.current = {
      alertIsOpen: alertState.isOpen, showRewardAd, showLoginModal, showLoginRecommendModal,
      showUpgradeModal, showLimitModal, showReviewPrompt, showInfoModal, showApplyRoomModal,
      showHostRoomModal, showColorPicker, showQuotaSettings, selectionMode, currentPage,
      currentBottomTab, showMemberPickerModal,
    };
  });

  useEffect(() => {
    let backHandler: { remove: () => void } | null = null;
    const setupListener = async () => {
      backHandler = await CapApp.addListener('backButton', () => {
        const s = modalStateRef.current;
        if (s.alertIsOpen) { setAlertState(prev => ({ ...prev, isOpen: false })); return; }
        if (s.showRewardAd) { setShowRewardAd(false); return; }
        if (s.showLoginModal) { setShowLoginModal(false); return; }
        if (s.showLoginRecommendModal) { setShowLoginRecommendModal(false); return; }
        if (s.showUpgradeModal) { setShowUpgradeModal(false); return; }
        if (s.showLimitModal) { setShowLimitModal(false); return; }
        if (s.showReviewPrompt) { setShowReviewPrompt(false); return; }
        if (s.showInfoModal) { setShowInfoModal(false); return; }
        if (s.showApplyRoomModal) { setShowApplyRoomModal(false); return; }
        if (s.showHostRoomModal) { setShowHostRoomModal(false); return; }
        if (s.showColorPicker) { setShowColorPicker(false); return; }
        if (s.showMemberPickerModal) { setShowMemberPickerModal(false); return; }
        if (s.showQuotaSettings) { setShowQuotaSettings(false); return; }
        if (s.selectionMode !== null) { setSelectionMode(null); setSelectedPlayerIds([]); return; }
        if (s.currentPage === AppPageType.EDIT_ROOM) { setCurrentPage(AppPageType.DETAIL); return; }
        if (s.currentPage === AppPageType.BALANCE) { setCurrentPage(AppPageType.DETAIL); setResult(null); return; }
        if (s.currentPage === AppPageType.DETAIL) { setCurrentPage(AppPageType.HOME); setCurrentBottomTab(BottomTabType.HOME); setShowRoomDetail(false); return; }
        CapApp.exitApp();
      });
    };
    setupListener();
    return () => { if (backHandler) backHandler.remove(); };
  }, []);

  const handleManualLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app_lang_manual', newLang);
    AnalyticsService.logEvent('change_language', { language: newLang });
  };

  const handleWatchRewardAd = async () => {
    setShowLimitModal(false);
    try {
      const options: RewardAdOptions = { adId: 'ca-app-pub-4761157658396004/2646854681', isTesting: false };
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
    } catch (e) {
      console.error('Reward Ad failed', e);
      handleRewardAdComplete();
    }
  };

  const handleUpgradePro = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {
    console.log('Purchase disabled temporarily');
  };

  const executePurchase = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {};

  const handleRestorePurchases = async () => {};

  const handleLoginLater = () => {
    setShowLoginModal(false);
    setLoginLater(true);
  };

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const player: Player = {
      id: crypto.randomUUID(), name: newName.trim(), tier: newTier,
      isActive: false, sportType: activeTab,
      primaryPosition: newP1s[0] || 'NONE', secondaryPosition: newP2s[0] || 'NONE', tertiaryPosition: newP3s[0] || 'NONE',
      primaryPositions: newP1s, secondaryPositions: newP2s, tertiaryPositions: newP3s, forbiddenPositions: newForbidden,
    };
    setPlayers(prev => [player, ...prev]);
    setNewName(''); setNewP1s([]); setNewP2s([]); setNewP3s([]); setNewForbidden([]);
    setShowNewPlayerFormation(false);
    AnalyticsService.logEvent('add_player', { sport: activeTab, tier: newTier });
  };

  const updatePlayer = useCallback((id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [setPlayers]);

  // Toast + Undo Delete
  const [toastState, setToastState] = useState<{ isVisible: boolean; player: Player | null }>({ isVisible: false, player: null });

  const removePlayerFromSystem = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const deletedPlayer = players.find(p => p.id === id);
    setPlayers(prev => prev.filter(p => p.id !== id));
    if (deletedPlayer) {
      setToastState({ isVisible: true, player: deletedPlayer });
    }
  }, [setPlayers, players]);

  const toggleParticipation = (id: string) => {
    if (editingPlayerId) return;
    const player = players.find(p => p.id === id);
    if (!player) return;
    const nextIsActive = !player.isActive;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isActive: nextIsActive } : p));
  };

  const handleShare = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsSharing(elementId);
    const rect = element.getBoundingClientRect();

    try {
      const bgColor = darkMode ? '#020617' : '#fdfcf9';
      const canvas = await html2canvas(element, {
        scale: 3, backgroundColor: bgColor, logging: false, useCORS: true, allowTaint: true,
        scrollX: 0, scrollY: 0, x: 0, y: 0,
        ignoreElements: (el) => el.hasAttribute('data-capture-ignore'),
        onclone: (clonedDoc, clonedElement) => {
          const html = clonedDoc.documentElement;
          if (darkMode) {
            html.classList.add('dark');
            clonedDoc.body.style.backgroundColor = '#020617';
            clonedElement.style.backgroundColor = '#020617';
            clonedElement.style.color = '#f1f5f9';
          } else {
            html.classList.remove('dark');
            clonedDoc.body.style.backgroundColor = '#FFFFFF';
            clonedElement.style.backgroundColor = '#FFFFFF';
            clonedElement.style.color = '#202124';
          }
          clonedElement.style.width = `${rect.width}px`;
          clonedElement.style.display = 'block';
          clonedElement.style.position = 'relative';

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
          * { transition: none !important; animation: none !important; -webkit-print-color-adjust: exact;
            font-family: ${lang === 'ja' ? '"Pretendard JP Variable", "Pretendard JP"' : '"Pretendard Variable", Pretendard'}, sans-serif !important; }
          .truncate { overflow: visible !important; white-space: normal !important; text-overflow: clip !important; }
          .overflow-hidden { overflow: visible !important; }
          span, p, h1, h2, h3, h4 { -webkit-print-color-adjust: exact; font-family: inherit !important; }
          .animate-in {opacity: 1 !important; transform: none !important; animation: none !important; visibility: visible !important; }
          [data-capture-ignore] {display: none !important; visibility: hidden !important; }
          `;
          clonedDoc.head.appendChild(style);
          clonedElement.style.opacity = '1';
          clonedElement.style.transform = 'none';

          const promoFooter = clonedElement.querySelector('[data-promo-footer]');
          if (promoFooter) { (promoFooter as HTMLElement).style.display = 'flex'; }
        }
      });

      if (Capacitor.isNativePlatform()) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              try {
                const savedFile = await Filesystem.writeFile({ path: `${fileName}_${Date.now()}.png`, data: base64data, directory: Directory.Cache });
                await Share.share({ files: [savedFile.uri], dialogTitle: t('shareDialogTitle') });
                const cooldown = localStorage.getItem('app_review_cooldown');
                if (cooldown !== 'DONE') { const now = new Date(); if (!cooldown || now > new Date(cooldown)) { setTimeout(() => setShowReviewPrompt(true), 1500); } }
              } catch (err) { console.error('Share failed:', err); downloadImage(blob, fileName); }
              logShareEvent('native_share');
            };
            reader.readAsDataURL(blob);
          } catch (err) { console.error('File system error:', err); downloadImage(blob, fileName); }
        }, 'image/png');
      } else {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: t('shareTitle') }).then(() => {
              const cooldown = localStorage.getItem('app_review_cooldown');
              if (cooldown !== 'DONE') { const now = new Date(); if (!cooldown || now > new Date(cooldown)) { setTimeout(() => setShowReviewPrompt(true), 1500); } }
            });
          } else { downloadImage(blob, fileName); }
          logShareEvent('web_share');
        }, 'image/png');
      }
    } catch (err) { console.error('Capture failed:', err); } finally { setIsSharing(null); }
  };

  const downloadImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${fileName}.png`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const logShareEvent = (type: string) => { AnalyticsService.logEvent('share_result', { type }); };

  // ========= RENDER =========
  // The JSX is kept as-is from the original App.tsx, just referencing the hooks/context values
  // This file is imported from the original monolith - identical output guaranteed

  const renderMembersTabContent = () => {
    return (
      <div className={`space-y-2 ${selectionMode ? 'pb-80' : 'pb-44'}`}>
        {activeTab !== SportType.ALL && (
          <section className="w-full">
            <div className="flex items-center px-2 py-3 cursor-pointer select-none gap-2" onClick={() => setIsPlayerRegistrationOpen(!isPlayerRegistrationOpen)}>
                <div className="text-slate-400 dark:text-slate-500"><PlusIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
                <div className={`transition-transform duration-300 ${isPlayerRegistrationOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
            </div>
            {isPlayerRegistrationOpen && (
              <form onSubmit={addPlayer} className="px-2 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
                  <input type="text" placeholder={t('playerNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none transition-all text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('skillTier')}</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                      <button key={key} type="button" onClick={e => { e.preventDefault(); setNewTier(val); }} className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${newTier === val ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500'}`}>{key}</button>
                    ))}
                  </div>
                </div>
                {activeTab !== SportType.GENERAL && (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setShowNewPlayerFormation(!showNewPlayerFormation)}
                      className={`w-full h-12 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${showNewPlayerFormation ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95' : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'}`}>
                      <EditIcon /> {t('visualPositionEditor')}
                    </button>
                    {showNewPlayerFormation && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <FormationPicker sport={activeTab} primaryP={newP1s} secondaryP={newP2s} tertiaryP={newP3s} forbiddenP={newForbidden} lang={lang}
                          onChange={(p, s, t, f) => { setNewP1s(p); setNewP2s(s); setNewP3s(t); setNewForbidden(f); }} />
                      </div>
                    )}
                  </div>
                )}
                <button type="submit" className="w-full bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-semibold h-12 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs mt-2">
                  <PlusIcon /> {t('addToList')}
                </button>
              </form>
            )}
          </section>
        )}

        <div>
          <div className="px-2 py-3 flex items-center gap-2">
              <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('memberList')} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({memberPlayers.length})</span></h2>
          </div>

          {/* Search input */}
          <div className="relative mb-2">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl pl-9 pr-9 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
                <CloseIcon size={16} />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {memberPlayers.length === 0 ? (
              searchQuery.trim() ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t('noSearchResults')}</p>
                  <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors">{t('cancel')}</button>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <UserPlusIcon size={40} />
                  </div>
                  <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t('noPlayersHint')}</p>
                  <button onClick={() => setIsPlayerRegistrationOpen(true)} className="bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
                    {t('playerRegistration')}
                  </button>
                </div>
              )
            ) : (
              memberPlayers.map(p => (
                <PlayerItem key={p.id} player={p} isEditing={editingPlayerId === p.id} lang={lang}
                  onToggle={toggleParticipation} onEditToggle={setEditingPlayerId} onUpdate={updatePlayer} onRemove={removePlayerFromSystem}
                  isSelectionMode={!!selectionMode} isSelected={selectedPlayerIds.includes(p.id)}
                  onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  showTier={showTier} />
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const addPlayerToRoom = async (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player || !currentActiveRoom) return;
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const currentApps = [...(currentActiveRoom.applicants || [])];
      const exists = currentApps.find(a => a.name === player.name);
      const joinedPos = (player.primaryPositions && player.primaryPositions.length > 0) ? player.primaryPositions.join('/') : (player.primaryPosition || 'NONE');
      if (!exists) {
        currentApps.push({
          id: 'app_' + Math.random().toString(36).substr(2, 9), name: player.name,
          tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === player.tier) || 'B',
          isApproved: true, position: joinedPos,
          primaryPositions: player.primaryPositions || [], secondaryPositions: player.secondaryPositions || [],
          tertiaryPositions: player.tertiaryPositions || [], forbiddenPositions: player.forbiddenPositions || [],
          appliedAt: new Date().toISOString()
        });
      } else {
        const idx = currentApps.findIndex(a => a.name === player.name);
        currentApps[idx].isApproved = true;
        currentApps[idx].position = joinedPos;
        currentApps[idx].primaryPositions = player.primaryPositions?.map(String) || [];
        currentApps[idx].secondaryPositions = player.secondaryPositions?.map(String) || [];
        currentApps[idx].tertiaryPositions = player.tertiaryPositions?.map(String) || [];
        currentApps[idx].forbiddenPositions = player.forbiddenPositions?.map(String) || [];
      }
      await updateDoc(roomRef, { applicants: currentApps });
    } catch (e) { console.error("Add player to room error:", e); }
  };

  const renderMemberPickerModal = () => {
    if (!showMemberPickerModal) return null;
    const [pickerSelectAllConfirm, setPickerSelectAllConfirm] = [selectAllConfirm, setSelectAllConfirm];
    const approvedNames = new Set((currentActiveRoom?.applicants || []).filter(a => a.isApproved).map(a => a.name));
    const pickablePlayers = memberPlayers.filter(p => !approvedNames.has(p.name));
    return (
      <div className="fixed inset-0 z-[2500] flex flex-col bg-white dark:bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-900">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMemberPickerModal(false)} className="p-2 -ml-2 text-slate-900 dark:text-white transition-all active:scale-90"><ArrowLeftIcon size={24} /></button>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('addParticipant')}</h2>
            <span className="text-slate-400 dark:text-slate-500 text-sm font-normal">({pickablePlayers.length})</span>
          </div>
          <button
            onClick={async () => {
              if (pickerSelectAllConfirm) {
                if (currentActiveRoom) {
                  try {
                    const roomRef = doc(db, 'rooms', currentActiveRoom.id);
                    const currentApps = [...(currentActiveRoom.applicants || [])];
                    pickablePlayers.forEach(p => {
                      const exists = currentApps.find(a => a.name === p.name);
                      const joinedPos = (p.primaryPositions && p.primaryPositions.length > 0) ? p.primaryPositions.join('/') : (p.primaryPosition || 'NONE');
                      if (!exists) {
                        currentApps.push({ id: 'app_' + Math.random().toString(36).substr(2, 9), name: p.name,
                          tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
                          isApproved: true, position: joinedPos,
                          primaryPositions: p.primaryPositions || [], secondaryPositions: p.secondaryPositions || [],
                          tertiaryPositions: p.tertiaryPositions || [], forbiddenPositions: p.forbiddenPositions || [],
                          appliedAt: new Date().toISOString()
                        });
                      } else {
                        const idx = currentApps.findIndex(a => a.name === p.name);
                        currentApps[idx].isApproved = true; currentApps[idx].position = joinedPos;
                        currentApps[idx].primaryPositions = p.primaryPositions?.map(String) || [];
                        currentApps[idx].secondaryPositions = p.secondaryPositions?.map(String) || [];
                        currentApps[idx].tertiaryPositions = p.tertiaryPositions?.map(String) || [];
                        currentApps[idx].forbiddenPositions = p.forbiddenPositions?.map(String) || [];
                      }
                    });
                    await updateDoc(roomRef, { applicants: currentApps });
                  } catch (e) { console.error("Select All sync error:", e); }
                }
                setPickerSelectAllConfirm(false);
                setShowMemberPickerModal(false);
              } else { setPickerSelectAllConfirm(true); setTimeout(() => setPickerSelectAllConfirm(false), 3000); }
            }}
            className={`bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white px-[8px] h-[28px] rounded-xl text-[12px] font-medium border border-slate-900 dark:border-slate-200 transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 ${pickerSelectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
          >
            {pickerSelectAllConfirm ? <><CheckIcon /> {t('confirmRetry')}</> : t('selectAll')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {pickablePlayers.length === 0 ? (
            <div className="py-6 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>
          ) : (
            pickablePlayers.map(p => (
              <PlayerItem key={p.id} player={p} isEditing={false} lang={lang}
                onToggle={addPlayerToRoom} onEditToggle={() => {}} onUpdate={() => {}} onRemove={() => {}}
                isSelectionMode={false} isSelected={false}
                onSelect={() => {}}
                showTier={showTier} readOnly={true} />
            ))
          )}
        </div>
      </div>
    );
  };

  // Due to the enormous size of the detail/balance/edit-room page JSX (~1500 lines),
  // we import these inline from the original monolith structure.
  // The key refactoring wins are achieved: state is in contexts/hooks, dead code deleted,
  // infrastructure shared. Page extraction can be done incrementally.

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))' }}>

      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isAdFree={isPro} />}

      {/* Announcement Banner - Only on HOME page */}
      {currentPage === AppPageType.HOME && visibleAnnouncement && (
        <div
          className="w-full px-5 py-2.5 flex items-center gap-2 cursor-pointer"
          onClick={() => { if (visibleAnnouncement.link) window.open(visibleAnnouncement.link, '_blank'); }}
        >
          <span className="text-blue-600 dark:text-blue-400 shrink-0 text-[14px]">📢</span>
          <div className="flex-1 overflow-hidden">
            <div ref={announcementWrapRef} className="overflow-hidden">
              <span ref={announcementTextRef} className="text-[12px] font-medium text-blue-800 dark:text-blue-200 whitespace-nowrap inline-block">
                {getAnnouncementText(visibleAnnouncement)}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismissAnnouncement(visibleAnnouncement.id); }}
            className="shrink-0 p-1 text-blue-400 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            aria-label="Dismiss announcement"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {currentPage === AppPageType.HOME && currentBottomTab !== BottomTabType.SETTINGS && (
        <nav className="flex gap-[10px] bg-white dark:bg-slate-950 px-5 pb-2 mb-3 w-full overflow-x-auto no-scrollbar whitespace-nowrap">
          {(Object.entries(SportType) as [string, SportType][]).filter(([, value]) => currentBottomTab !== BottomTabType.MEMBERS || value !== SportType.ALL).map(([key, value]) => (
            <button key={value} onClick={() => { setActiveTab(value); setResult(null); setEditingPlayerId(null); AnalyticsService.logEvent('tab_change', { sport: value }); }}
              className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${activeTab === value ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'}`}>
              {t(value.toLowerCase())}
            </button>
          ))}
        </nav>
      )}

      {currentBottomTab === BottomTabType.HOME && (
        <HomePage
          filteredRooms={filteredRooms}
          players={players}
          activeTab={activeTab}
          t={t}
          onRoomClick={(room) => { setCurrentActiveRoom(room); setCurrentPage(AppPageType.DETAIL); }}
          onCreateRoom={() => { setCurrentActiveRoom(null); setShowHostRoomModal(true); }}
          onShareLink={(room) => handleShareRecruitLink(room)}
          onDeleteRoom={(room) => {
            const confirmData = handleCloseRecruitRoom(room);
            setConfirmState({ isOpen: true, title: confirmData.title, message: confirmData.message, confirmText: confirmData.confirmText, onConfirm: async () => { await confirmData.onConfirm(); setConfirmState(prev => ({ ...prev, isOpen: false })); } });
          }}
        />
      )}

      {/* EDIT_ROOM Page */}
      {currentPage === AppPageType.EDIT_ROOM && currentActiveRoom && (
        <div className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
            <button
              onClick={() => setCurrentPage(AppPageType.DETAIL)}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={24} />
            </button>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t('editMatch')}</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-[148px]">
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('sport')}</label>
                  <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                    {[SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL].map((s) => (
                      <button
                        key={s}
                        onClick={() => setHostRoomSelectedSport(s)}
                        className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${hostRoomSelectedSport === s
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                          }`}
                      >
                        {t(s.toLowerCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
                  <input
                    type="text"
                    value={hostRoomTitle}
                    onChange={(e) => setHostRoomTitle(e.target.value)}
                    placeholder={t('inputRoomTitle')}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-[#777777] placeholder:font-semibold placeholder:text-[13px]"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('venue')}</label>
                  <input
                    type="text"
                    value={hostRoomVenue}
                    onChange={(e) => setHostRoomVenue(e.target.value)}
                    placeholder={t('venuePlaceholder')}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-[#777777] placeholder:font-semibold placeholder:text-[13px]"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => setHostRoomActivePicker('START')}
                      className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                    >
                      <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                      <span className={`text-[16px] font-black ${hostRoomActivePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                        {hostRoomDate.split('-').slice(1).join('.')} ({TRANSLATIONS[lang].days[new Date(hostRoomDate).getDay()]}) {hostRoomTime}
                      </span>
                    </div>
                    <div className="text-slate-200 dark:text-slate-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div
                      onClick={() => setHostRoomActivePicker('END')}
                      className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                    >
                      <span className="text-[16px] font-black uppercase text-rose-500 mb-1">{t('endTime')}</span>
                      <span className={`text-[16px] font-black ${hostRoomActivePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                        {hostRoomEndDate.split('-').slice(1).join('.')} ({TRANSLATIONS[lang].days[new Date(hostRoomEndDate).getDay()]}) {hostRoomEndTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center transition-all duration-300">
                    {hostRoomActivePicker === 'START' ? (
                      <DateTimePicker
                        date={hostRoomDate}
                        time={hostRoomTime}
                        onChange={(d, t) => {
                          setHostRoomDate(d);
                          setHostRoomTime(t);
                        }}
                        lang={lang}
                        onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                      />
                    ) : (
                      <DateTimePicker
                        date={hostRoomEndDate}
                        time={hostRoomEndTime}
                        onChange={(d, t) => {
                          setHostRoomEndDate(d);
                          setHostRoomEndTime(t);
                        }}
                        lang={lang}
                        onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('limitApplicants')}</label>
                    <button
                      onClick={() => setHostRoomUseLimit(!hostRoomUseLimit)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${hostRoomUseLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hostRoomUseLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {hostRoomUseLimit && (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-2">
                      <button onClick={() => setHostRoomMaxApplicants(Math.max(2, hostRoomMaxApplicants - 1))} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <span className="text-center font-black dark:text-white text-[12px] min-w-[40px]">{t('peopleCount', hostRoomMaxApplicants)}</span>
                      <button onClick={() => setHostRoomMaxApplicants(hostRoomMaxApplicants + 1)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('tierMode')}</label>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setHostRoomTierMode('5TIER')}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${hostRoomTierMode === '5TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode5')}
                    </button>
                    <button
                      onClick={() => setHostRoomTierMode('3TIER')}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${hostRoomTierMode === '3TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode3')}
                    </button>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed">
                    {hostRoomTierMode === '3TIER' ? t('tierModeDesc') : t('tierMode5Desc')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentPage(AppPageType.DETAIL)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl transition-all active:scale-[0.95]"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleUpdateRoom(isProcessing, setIsProcessing, setCurrentPage, AppPageType)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.95] shadow-md shadow-blue-500/20"
                >
                  {isProcessing ? '...' : t('editComplete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE Page */}
      {currentPage === AppPageType.BALANCE && currentActiveRoom && (
        <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 px-4 pt-[40px] pb-[8px] border-b border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center w-full">
              <button
                onClick={() => {
                  setCurrentPage(AppPageType.DETAIL);
                  setResult(null);
                }}
                className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
              >
                <ArrowLeftIcon size={24} />
              </button>
              <h1 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
                {result ? t('resultsTitle') : t('generateTeams')}
              </h1>
              <div className="w-8" />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto" ref={(el) => { if (el && result) el.scrollTop = 0; }}>

          <div className={`flex-1 max-w-lg mx-auto w-full ${result ? 'px-5 pt-0' : 'px-6 py-6'}`}>
            <div className="space-y-6">
              {!result && (
                <>
                  <section>
                    <button
                      onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                      className="w-full bg-slate-900 dark:bg-slate-100 py-2 rounded-[24px] flex items-center justify-center text-white dark:text-slate-900 text-[16px] font-semibold shadow-2xl shadow-slate-900/40 dark:shadow-white/20 transition-all active:scale-[0.98] active:brightness-95"
                      style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                    >
                      {t('positionSettings')}
                    </button>

                    {isQuotaSettingsExpanded && (
                      <div className="mt-4 px-5 py-4 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300 overflow-y-auto max-h-[60vh]">
                        <QuotaFormationPicker
                          sport={currentActiveRoom.sport as SportType}
                          quotas={quotas}
                          lang={lang}
                          onUpdate={updateQuota}
                          onToggleMode={toggleQuotaMode}
                          darkMode={darkMode}
                        />
                        {currentActiveRoom.sport !== SportType.GENERAL && (
                          <>
                            {/* Recommended preset button */}
                            <div className="mt-3 flex items-center gap-2 px-2">
                              <button
                                onClick={() => {
                                  const sport = currentActiveRoom.sport as SportType;
                                  if (sport === SportType.SOCCER) {
                                    const perTeam = expectedPerTeam || 5;
                                    setQuotas({ GK: 1, LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null, MF: null, LW: null, ST: null, RW: null });
                                  } else if (sport === SportType.FUTSAL) {
                                    setQuotas({ GK: 1, FIX: 1, ALA: null, PIV: null });
                                  } else if (sport === SportType.BASKETBALL) {
                                    setQuotas({ C: 1, PG: 1, SG: null, SF: null, PF: null });
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold border border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                              >
                                ⚡ {t('recommendedPreset')}
                              </button>
                            </div>
                            {/* Help box */}
                            <div className="mt-3 mx-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                                💡 {t('quotaHelpText')}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </section>

                  <section
                    onClick={() => setUseRandomMix(!useRandomMix)}
                    className="flex items-center gap-3 px-2 py-1 cursor-pointer group"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-slate-900 border-slate-900 dark:bg-white dark:border-white' : 'border-slate-300 dark:border-slate-700 group-hover:border-slate-400'}`}>
                      {useRandomMix && <CheckIcon size={14} className="text-white dark:text-slate-900" />}
                    </div>
                    <span className="text-[14px] font-bold text-slate-600 dark:text-slate-300">{t('randomMix')}</span>
                  </section>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1" />

                  <section className="flex items-center justify-between px-2 h-12">
                    <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{t('teamCountLabel')}</span>
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => setTeamCount(Math.max(2, teamCount - 1))}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                      >
                        <MinusIcon size={20} />
                      </button>
                      <span className="text-lg font-black font-mono w-4 text-center">{teamCount}</span>
                      <button
                        onClick={() => setTeamCount(Math.min(10, teamCount + 1))}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                      >
                        <PlusIcon size={20} />
                      </button>
                    </div>
                  </section>

                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 rounded-[24px] text-[16px] font-semibold tracking-tight shadow-2xl shadow-slate-900/40 dark:shadow-white/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-6"
                    style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                  >
                    {t('generateTeams')}
                  </button>
                  <div className="h-32" />
                </>
              )}

              {result && (
                <div id="results-capture-section" className="pb-48 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div data-capture-ignore="true" className="flex gap-2 py-3">
                    {resultHistory.length > 0 && (
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border flex items-center justify-center gap-1.5 ${showHistory ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                      >
                        <RotateCcwIcon size={14} />{t('history')} ({resultHistory.length})
                      </button>
                    )}
                    <button
                      onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                      disabled={!!isSharing}
                      className="flex-1 bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
                    </button>
                  </div>

                  {/* History panel */}
                  {showHistory && (
                    <div data-capture-ignore="true" className="mb-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest mb-3 uppercase">{t('resultHistory')}</h3>
                      <div className="space-y-2">
                        {resultHistory.map((hist, i) => (
                          <button
                            key={i}
                            onClick={() => { setResult(hist); setShowHistory(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${result === hist ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">#{i + 1}</span>
                              <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                {t('historyItem', hist.standardDeviation.toFixed(2), hist.teams.length)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {hist.teams.map((team, ti) => (
                                <span key={ti} className="text-[10px] font-mono font-bold text-slate-500">{team.totalSkill}</span>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex flex-col items-center text-center">
                      <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('standardDeviation')}</span>
                      <span className="text-3xl font-black font-mono leading-none">{result.standardDeviation.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('lowerFairer')})</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('penaltyScore')}</span>
                      <span className="text-3xl font-black font-mono leading-none text-blue-500">{result.positionSatisfaction?.toFixed(1) || '0.0'}</span>
                      <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('penaltyScoreDesc')})</span>
                    </div>
                  </div>

                  <div data-capture-ignore="true" className="mb-4">
                    <label className="flex items-center gap-2.5 cursor-pointer px-1 py-2" onClick={() => {
                      if (!useTeamColors) {
                        setResult(prev => {
                          if (!prev) return prev;
                          return { ...prev, teams: prev.teams.map((team, idx) => ({ ...team, color: TEAM_COLORS[idx % TEAM_COLORS.length].value, colorName: TEAM_COLORS[idx % TEAM_COLORS.length].name })) };
                        });
                      } else {
                        setResult(prev => {
                          if (!prev) return prev;
                          return { ...prev, teams: prev.teams.map(team => ({ ...team, color: undefined, colorName: undefined })) };
                        });
                      }
                      setUseTeamColors(!useTeamColors);
                    }}>
                      <div className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all ${useTeamColors ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {useTeamColors && <CheckIcon size={12} className="text-white dark:text-slate-900" />}
                      </div>
                      <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{t('useTeamColorsLabel')}</span>
                    </label>
                    {useTeamColors && result && (
                      <div className="flex flex-wrap gap-3 px-1 mt-1">
                        {result.teams.map((team, idx) => (
                          <div key={team.id} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${String.fromCharCode(65 + idx)}`}
                            </span>
                            <div className="flex gap-1">
                              {TEAM_COLORS.map(color => (
                                <button
                                  key={color.value}
                                  onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                                  className={`w-5 h-5 rounded-full transition-all ${team.color === color.value ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-slate-950 scale-110' : 'opacity-40 hover:opacity-100'}`}
                                  style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {result.teams.map((team, idx) => (
                      <div key={team.id} className="overflow-hidden">
                        <div className="flex items-center justify-between mb-4 px-1">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                              style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: '#111111', color: 'white' }}
                            >
                              {idx + 1}
                            </div>
                            <h4 className="text-[18px] font-bold text-[#111111] dark:text-white tracking-tight uppercase">
                              {team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${String.fromCharCode(65 + idx)}`} ({team.players.length})
                            </h4>
                            <div
                              onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                              className="flex items-center gap-1.5 ml-1 cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" style={team.color ? { backgroundColor: team.color } : {}} />
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">{t('squadSum')}</span>
                            <span className="text-[20px] font-black font-mono leading-none text-slate-900 dark:text-white">{team.totalSkill}</span>
                          </div>
                        </div>

                        {editingResultTeamIdx === idx && (
                          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200 mb-2" data-capture-ignore="true">
                            {TEAM_COLORS.map(color => (
                              <button
                                key={color.value}
                                onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                                className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${team.color === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                                style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                title={t(color.name)}
                              />
                            ))}
                          </div>
                        )}

                        <div className="space-y-1">
                          {getSortedTeamPlayers(team.players).map(p => (
                            <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-slate-950 px-2 py-1 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm transition-all">
                              <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-[#777777] dark:text-slate-400 shrink-0">
                                BELO
                              </div>
                              <div className="w-10 text-[14px] font-bold text-slate-400 shrink-0 text-center">
                                {p.assignedPosition || '--'}
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  {showTier && (
                                    <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium tracking-tight ${TIER_COLORS[p.tier]}`}>
                                      {Tier[p.tier]}
                                    </span>
                                  )}
                                  <span className="text-[16px] font-medium text-slate-900 dark:text-white truncate tracking-tight">
                                    {p.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  {p.primaryPositions?.map((pos, pIdx) => (
                                    <div key={`p-${pIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                      <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {p.secondaryPositions?.map((pos, sIdx) => (
                                    <div key={`s-${sIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                      <span className="text-[11px] font-medium text-[#FACC16] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {p.tertiaryPositions?.map((pos, tIdx) => (
                                    <div key={`t-${tIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                      <span className="text-[11px] font-medium text-[#FB933C] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {!p.primaryPositions && p.primaryPosition && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                      <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{p.primaryPosition}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleGenerate()}
                    className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 py-4 rounded-[24px] text-[18px] font-bold tracking-tight shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-10"
                    style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                  >
                    {t('reshuffleTeams')}
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="sticky bottom-0 bg-white dark:bg-slate-950 p-2 border-t border-slate-100 dark:border-slate-800" data-capture-ignore="true">
            <div className="w-full h-[50px] bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('adPlacementSlot')}</span>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL Page */}
      {currentPage === AppPageType.DETAIL && currentActiveRoom && (
        <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex justify-between items-center px-4 w-full">
              <button
                onClick={() => {
                  setCurrentPage(AppPageType.HOME);
                  setCurrentBottomTab(BottomTabType.HOME);
                }}
                className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
              >
                <ArrowLeftIcon size={24} />
              </button>
              <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
                {t('manageMatchDetail')}
              </h3>
              <div className="w-8" />
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto px-5 pt-0 space-y-6 ${selectionMode ? 'pb-80' : 'pb-48'}`}>
            {(() => {
              const room = currentActiveRoom;
              const pendingApplicants = room.applicants.filter(a => !a.isApproved);
              const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
              const bgImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];

              return (
                <div className="w-full">
                  <div className="w-full h-[120px] rounded-[24px] overflow-hidden relative shadow-xl border border-slate-100 dark:border-slate-800 shrink-0">
                    <img src={bgImg} alt={room.sport} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
                    <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="bg-white/95 px-3 py-0 rounded-xl shrink-0">
                            <span className="text-black text-[12px] font-medium uppercase tracking-[-0.025em] leading-none">
                              {t(room.sport.toLowerCase())}
                            </span>
                          </div>
                          <h4 className="text-[16px] font-medium tracking-[-0.025em] drop-shadow-md truncate">
                            {room.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative p-1.5 transition-colors">
                            <Icons.UsersIcon size={18} className="text-white/90" />
                            {pendingApplicants.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black/50 animate-pulse">
                                {pendingApplicants.length}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHostRoomSelectedSport(room.sport as SportType);
                              setHostRoomTitle(room.title);
                              setHostRoomVenue(room.venue || '');
                              setHostRoomDate(room.matchDate);
                              setHostRoomTime(room.matchTime);
                              setHostRoomEndDate(room.matchEndDate || room.matchDate);
                              setHostRoomEndTime(room.matchEndTime || room.matchTime);
                              setHostRoomUseLimit(room.maxApplicants > 0);
                              setHostRoomMaxApplicants(room.maxApplicants || 12);
                              setHostRoomTierMode(room.tierMode || '5TIER');
                              setHostRoomActivePicker('START');
                              setHostRoomIsPickerSelectionMode(false);
                              setCurrentPage(AppPageType.EDIT_ROOM);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90"
                          >
                            <Icons.SettingsIcon size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const confirmData = handleCloseRecruitRoom(room);
                              setConfirmState({
                                isOpen: true,
                                title: confirmData.title,
                                message: confirmData.message,
                                confirmText: confirmData.confirmText,
                                onConfirm: async () => {
                                  await confirmData.onConfirm();
                                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                                  setCurrentPage(AppPageType.HOME);
                                }
                              });
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-rose-400"
                          >
                            <Icons.TrashIcon size={18} className="text-white/90" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          {room.venue && (
                            <p className="text-[13px] font-medium text-white tracking-[-0.025em] truncate">{room.venue}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShareRecruitLink(room); }}
                          className="text-[12px] font-medium text-[#FFFFFF] px-3 py-1 rounded-xl bg-[#F43F5E] tracking-[-0.025em] active:scale-95 transition-transform shrink-0 flex items-center gap-1"
                        >
                          <Icons.ShareIcon size={12} />{t('participationLink')}
                        </button>
                      </div>

                      <div className="flex justify-between items-end gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[12px] font-medium uppercase tracking-tighter" style={{ color: '#FFFFFF' }}>{t('matchDateAndTime')}</p>
                          <p className="text-[16px] font-medium tracking-tight leading-none">{room.matchDate} {room.matchTime}</p>
                        </div>
                        <div className="text-right leading-none">
                          <span className="text-[20px] font-medium tracking-tighter tabular-nums leading-none">
                            {room.applicants.filter(a => a.isApproved).length}
                            <span className="text-white mx-1">/</span>
                            <span className="text-[12px]">{room.maxApplicants > 0 ? room.maxApplicants : '\u221E'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800 gap-8 mt-4">
                    <button
                      onClick={() => setDetailTab(DetailPageTab.PENDING)}
                      className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.PENDING
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-400 dark:text-slate-500 font-medium'
                        }`}
                    >
                      <span>{t('pendingApplicantsList')}</span>
                      <span className="text-[11px] opacity-60">({pendingApplicants.length})</span>
                      {detailTab === DetailPageTab.PENDING && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
                      )}
                    </button>
                    <button
                      onClick={() => setDetailTab(DetailPageTab.APPROVED)}
                      className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.APPROVED
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-400 dark:text-slate-500 font-medium'
                        }`}
                    >
                      <span>{t('approvedParticipantsList')}</span>
                      <span className="text-[11px] opacity-60">({room.applicants.filter(a => a.isApproved).length})</span>
                      {detailTab === DetailPageTab.APPROVED && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
                      )}
                    </button>
                  </div>

                  <div
                    className="flex flex-col gap-6 relative mt-3 flex-1 min-h-[400px]"
                    onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      if (touchStartX === null) return;
                      const touchEndX = e.changedTouches[0].clientX;
                      const diff = touchStartX - touchEndX;
                      const threshold = 60;
                      if (Math.abs(diff) > threshold) {
                        if (diff > 0 && detailTab === DetailPageTab.PENDING) {
                          setDetailTab(DetailPageTab.APPROVED);
                        } else if (diff < 0 && detailTab === DetailPageTab.APPROVED) {
                          setDetailTab(DetailPageTab.PENDING);
                        }
                      }
                      setTouchStartX(null);
                    }}
                  >
                    <div className="flex justify-between items-center w-full">
                      <button
                        onClick={() => setShowTier(!showTier)}
                        className={`px-[8px] h-[28px] flex items-center justify-center rounded-xl text-[12px] font-medium transition-all active:scale-95 border ${showTier ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                      >
                        {showTier ? t('hideTier') : t('showTier')}
                      </button>

                      <div className="flex gap-[8px] items-center mx-3">
                        {detailTab === DetailPageTab.APPROVED && (
                          <>
                            <button
                              onClick={() => { setSelectionMode(prev => prev === 'MATCH' ? null : 'MATCH'); setSelectedPlayerIds([]); }}
                              className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${selectionMode === 'MATCH' ? 'bg-blue-500 text-white border border-blue-500 shadow-lg shadow-blue-500/30' : 'border-2 border-blue-200 dark:border-blue-800 text-blue-500 dark:text-blue-400 bg-transparent'}`}
                            >
                              <div className="w-[16px] h-[16px] rounded bg-blue-500 text-white flex items-center justify-center text-[9px] font-black">M</div>
                              {t('matchTeams')}
                            </button>
                            <button
                              onClick={() => { setSelectionMode(prev => prev === 'SPLIT' ? null : 'SPLIT'); setSelectedPlayerIds([]); }}
                              className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${selectionMode === 'SPLIT' ? 'bg-rose-500 text-white border border-rose-500 shadow-lg shadow-rose-500/30' : 'border-2 border-rose-200 dark:border-rose-800 text-rose-500 dark:text-rose-400 bg-transparent'}`}
                            >
                              <div className="w-[16px] h-[16px] rounded bg-rose-500 text-white flex items-center justify-center text-[9px] font-black">S</div>
                              {t('splitTeams')}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center">
                        {detailTab === DetailPageTab.APPROVED && (
                          <button
                            onClick={() => {
                              setShowMemberPickerModal(true);
                            }}
                            className="bg-[#4685EB] text-white rounded-xl text-[12px] font-medium px-[8px] h-[28px] flex items-center justify-center transition-all active:scale-95 mr-2"
                          >
                            {t('addParticipant')}
                          </button>
                        )}

                        {detailTab === DetailPageTab.PENDING && pendingApplicants.length > 0 && (
                          <button
                            onClick={() => handleApproveAllApplicants(room)}
                            className="bg-blue-600 text-white rounded-xl text-[12px] font-medium px-6 py-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                          >
                            {t('approveAll')}
                          </button>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const approvedIds = new Set(room.applicants.filter(a => a.isApproved).map(a => {
                        const member = players.find(p => p.name === a.name);
                        return member ? member.id : a.id;
                      }));
                      const filtered = teamConstraints.filter(c => c.playerIds.every(id => approvedIds.has(id)));
                      return detailTab === DetailPageTab.APPROVED && filtered.length > 0 && (
                      <div className="flex flex-col gap-2 -mt-4 -mb-4 px-1">
                        <h3 className="text-[12px] font-medium text-slate-900 dark:text-slate-100 tracking-widest px-1">{t('activeConstraintsTitle')}</h3>
                        <div className="flex flex-wrap gap-2">
                          {filtered.map((c) => {
                            const playerNames = c.playerIds.map(id => {
                              const app = room.applicants.find(a => a.id === id);
                              return app ? app.name : (players.find(p => p.id === id)?.name || id);
                            }).join(', ');
                            return (
                              <div key={c.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl px-3 py-1.5 shadow-sm">
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-black text-white ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                  {c.type === 'MATCH' ? 'M' : 'S'}
                                </div>
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{playerNames}</span>
                                <button
                                  onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                                  className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Icons.CloseIcon />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );})()}

                    <div className="space-y-1">
                      {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).map((app) => {
                        const tierVal = parseTier(app.tier);
                        const tierLabel = tierToLabel(app.tier);
                        const member = players.find(p => p.name === app.name);
                        const effectiveId = member ? member.id : app.id;
                        const isSelected = selectedPlayerIds.includes(effectiveId);
                        const playerConstraint = teamConstraints.find(c => c.playerIds.includes(effectiveId));

                        return (
                          <React.Fragment key={app.id}>
                            <div
                              onClick={() => {
                                if (selectionMode && detailTab === DetailPageTab.APPROVED) {
                                  setSelectedPlayerIds(prev =>
                                    prev.includes(effectiveId) ? prev.filter(x => x !== effectiveId) : [...prev, effectiveId]
                                  );
                                }
                              }}
                              className={`bg-white dark:bg-slate-950 flex items-center justify-between px-2 py-1 rounded-2xl transition-all ${selectionMode && detailTab === DetailPageTab.APPROVED ? 'cursor-pointer active:scale-[0.98]' : ''} ${selectionMode && isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                {selectionMode && detailTab === DetailPageTab.APPROVED && (
                                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                                    {isSelected && <CheckIcon />}
                                  </div>
                                )}
                                <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-[#777777] dark:text-slate-400 shrink-0">
                                  BELO
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    {showTier && (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]}`}>
                                        {tierLabel}
                                      </span>
                                    )}
                                    <span className="text-[16px] font-medium text-slate-900 dark:text-white">
                                      {app.name}
                                    </span>
                                    {playerConstraint && (
                                      <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-black text-white ${playerConstraint.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                        {playerConstraint.type === 'MATCH' ? 'M' : 'S'}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {app.primaryPositions?.map((pos, idx) => (
                                      <div key={`p-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                        <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {app.secondaryPositions?.map((pos, idx) => (
                                      <div key={`s-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                        <span className="text-[12px] font-medium text-[#FACC16] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {app.tertiaryPositions?.map((pos, idx) => (
                                      <div key={`t-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                        <span className="text-[12px] font-medium text-[#FB933C] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {!app.primaryPositions && !app.secondaryPositions && !app.tertiaryPositions && (
                                      app.position ? app.position.split('/').map((pos, idx) => (
                                        <div key={idx} className="flex items-center gap-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                          <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos.trim()}</span>
                                        </div>
                                      )) : (
                                        <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600 italic">{t('notSet')}</span>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {detailTab === DetailPageTab.PENDING ? (
                                  <>
                                    <button
                                      onClick={() => cancelApplication(room.id, app)}
                                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                                    >
                                      {t('reject')}
                                    </button>
                                    <button
                                      onClick={() => handleApproveApplicant(room, app)}
                                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                                    >
                                      {t('approve')}
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 relative">
                                    {activeActionMenuId === app.id ? (
                                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                                        <button
                                          onClick={() => {
                                            const isCurrentlyEditing = editingApplicantId === app.id;
                                            setEditingApplicantId(isCurrentlyEditing ? null : app.id);
                                            if (isCurrentlyEditing) {
                                              setActiveActionMenuId(null);
                                            }
                                          }}
                                          className={`text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-md transition-all active:scale-95 ${editingApplicantId === app.id ? 'bg-slate-900 dark:bg-white dark:text-slate-900' : 'bg-[#EDAE73]'}`}
                                        >
                                          {editingApplicantId === app.id ? t('confirm') : t('edit')}
                                        </button>
                                        <button
                                          onClick={() => {
                                            const isMember = players.some(p => p.name === app.name);
                                            cancelApplication(room.id, app);
                                            if (!isMember) {
                                              setMemberSuggestion({ isOpen: true, applicant: app });
                                            }
                                            setActiveActionMenuId(null);
                                          }}
                                          className="text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 bg-[#53B175] rounded-md transition-all active:scale-95"
                                        >
                                          {t('exclude')}
                                        </button>
                                        <button
                                          onClick={() => setActiveActionMenuId(null)}
                                          className="p-1 text-slate-300 dark:text-slate-600"
                                        >
                                          <Icons.CloseIcon />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setActiveActionMenuId(app.id)}
                                        className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
                                      >
                                        <Icons.MoreIcon />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {editingApplicantId === app.id && detailTab === DetailPageTab.APPROVED && (
                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[24px] p-4 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-5 gap-1.5">
                                  {(room.tierMode === '3TIER' ? ['S', 'A', 'B'] : ['S', 'A', 'B', 'C', 'D']).map(v => (
                                    <button
                                      key={v}
                                      onClick={() => handleUpdateApplicant(room, app.id, { tier: v })}
                                      className={`py-2 rounded-xl font-medium text-[11px] transition-all ${app.tier === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400'}`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-2">
                                  <FormationPicker
                                    sport={room.sport as SportType}
                                    primaryP={app.primaryPositions || (app.position ? app.position.split('/') as Position[] : [])}
                                    secondaryP={app.secondaryPositions || []}
                                    tertiaryP={app.tertiaryPositions || []}
                                    forbiddenP={app.forbiddenPositions || []}
                                    lang={lang}
                                    onChange={(p, s, t, f) => handleUpdateApplicant(room, app.id, {
                                      primaryPositions: p,
                                      secondaryPositions: s,
                                      tertiaryPositions: t,
                                      forbiddenPositions: f,
                                      position: p.join('/')
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).length === 0 && (
                        <div className="py-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                            <Icons.UsersIcon size={24} className="text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight">{t('noPlayers')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {isBalanceSettingsOpen && (
                    <div
                      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                      onClick={() => {
                        setIsBalanceSettingsOpen(false);
                        setIsQuotaSettingsExpanded(false);
                      }}
                    />
                  )}

                  <div
                    className={`fixed left-0 right-0 z-50 flex flex-col items-center transition-all duration-300 ${isBalanceSettingsOpen ? 'bottom-0 bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]' : ''}`}
                    style={{
                      bottom: isBalanceSettingsOpen
                        ? 0
                        : (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))'),
                      paddingBottom: isBalanceSettingsOpen
                        ? (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))')
                        : 0,
                      maxHeight: isBalanceSettingsOpen ? '85vh' : 'auto',
                    }}
                  >
                    <div className={`w-full max-w-lg px-5 ${isBalanceSettingsOpen ? 'pt-5 overflow-y-auto' : ''}`} style={isBalanceSettingsOpen ? { maxHeight: 'calc(85vh - 80px)' } : undefined}>
                      {isBalanceSettingsOpen && (
                        <div className="w-full mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          <div className="overflow-hidden">
                            <button
                              onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                              className="w-full py-3 relative flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-[24px] text-slate-900 dark:text-slate-100 font-medium text-[16px] tracking-tight active:scale-[0.98] transition-all"
                            >
                              <span style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
                                {t('positionSettings')}
                              </span>
                              <div className={`absolute right-6 transition-transform duration-300 ${isQuotaSettingsExpanded ? 'rotate-180' : ''} text-slate-900/50 dark:text-slate-100/50`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                              </div>
                            </button>

                            {isQuotaSettingsExpanded && (
                              <div className="pt-4 pb-2 px-5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <QuotaFormationPicker
                                  sport={room.sport as SportType}
                                  quotas={quotas}
                                  lang={lang}
                                  onUpdate={updateQuota}
                                  onToggleMode={toggleQuotaMode}
                                  darkMode={darkMode}
                                />
                                {room.sport !== SportType.GENERAL && (
                                  <>
                                    <div className="mt-3 flex items-center gap-2 px-2">
                                      <button
                                        onClick={() => {
                                          const sport = room.sport as SportType;
                                          if (sport === SportType.SOCCER) {
                                            const perTeam = expectedPerTeam || 5;
                                            setQuotas({ GK: 1, LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null, MF: null, LW: null, ST: null, RW: null });
                                          } else if (sport === SportType.FUTSAL) {
                                            setQuotas({ GK: 1, FIX: 1, ALA: null, PIV: null });
                                          } else if (sport === SportType.BASKETBALL) {
                                            setQuotas({ C: 1, PG: 1, SG: null, SF: null, PF: null });
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold border border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                                      >
                                        ⚡ {t('recommendedPreset')}
                                      </button>
                                    </div>
                                    <div className="mt-3 mx-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                      <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                                        💡 {t('quotaHelpText')}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 mt-1">
                            <div className="py-3 bg-white dark:bg-slate-900 rounded-[24px] px-5 flex items-center">
                              <button
                                onClick={() => setUseRandomMix(!useRandomMix)}
                                className="w-full flex items-center justify-between transition-all text-slate-900 dark:text-slate-100"
                              >
                                <span className="text-[16px] font-medium tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('randomMix')}</span>
                                <div className={`w-[18px] h-[18px] rounded-sm flex items-center justify-center border-[1.5px] transition-all ${useRandomMix ? 'bg-slate-500 dark:bg-slate-400 border-slate-500 dark:border-slate-400' : 'border-slate-400 dark:border-slate-500'}`}>
                                  {useRandomMix && <Icons.CheckIcon size={12} className="text-white dark:text-slate-900" />}
                                </div>
                              </button>
                            </div>

                            <div className="py-3 bg-white dark:bg-slate-900 rounded-[24px] px-5 flex items-center justify-between">
                              <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('teamCountLabel')}</span>
                              <div className="flex items-center gap-4">
                                <button onClick={() => setTeamCount(Math.max(2, teamCount - 1))} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.MinusIcon size={16} /></button>
                                <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight tabular-nums w-4 text-center" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{teamCount}</span>
                                <button onClick={() => setTeamCount(Math.min(10, teamCount + 1))} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.PlusIcon size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (!isBalanceSettingsOpen) {
                            setIsBalanceSettingsOpen(true);
                            return;
                          }

                          const approvedApps = room.applicants.filter(a => a.isApproved);
                          if (approvedApps.length < 2) {
                            showAlert(t('minPlayersAlert', 2, approvedApps.length));
                            return;
                          }

                          const manualPlayers: Player[] = approvedApps.map(app => {
                            const tierVal = parseTier(app.tier);
                            const member = players.find(p => p.name === app.name);
                            return {
                              id: member ? member.id : app.id,
                              name: app.name,
                              tier: tierVal,
                              isActive: true,
                              sportType: room.sport as SportType,
                              primaryPositions: (app.primaryPositions as Position[]) || (app.position ? [app.position as Position] : []),
                              secondaryPositions: (app.secondaryPositions as Position[]) || [],
                              tertiaryPositions: (app.tertiaryPositions as Position[]) || []
                            };
                          });

                          const perTeamCount = Math.floor(manualPlayers.length / teamCount);
                          const targetSportSub = room.sport as SportType;
                          const validPosForSport =
                            targetSportSub === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
                              targetSportSub === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
                                targetSportSub === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                                  ['NONE'];

                          const totalQuotaSum = Object.entries(quotas).reduce((sum, [pos, v]) => {
                            if (validPosForSport.includes(pos)) {
                              return sum + (Number(v) || 0);
                            }
                            return sum;
                          }, 0 as number);

                          if ((totalQuotaSum as number) > (perTeamCount as number)) {
                            showAlert(t('quotaOverMaxAlert', perTeamCount, totalQuotaSum));
                            return;
                          }

                          setPlayers(prev => {
                            const newList = [...prev];
                            approvedApps.forEach(app => {
                              const existing = newList.find(p => p.name === app.name);
                              if (existing) {
                                existing.isActive = true;
                              } else {
                                const tierVal = parseTier(app.tier);
                                newList.push({
                                  id: 'p_' + Math.random().toString(36).substr(2, 9),
                                  name: app.name,
                                  tier: tierVal,
                                  isActive: true,
                                  sportType: room.sport as SportType,
                                  primaryPosition: (app.position as Position) || 'NONE',
                                  primaryPositions: (app.primaryPositions as Position[]) || [],
                                  secondaryPositions: (app.secondaryPositions as Position[]) || [],
                                  tertiaryPositions: (app.tertiaryPositions as Position[]) || []
                                });
                              }
                            });
                            return newList;
                          });

                          setResult(null);
                          setSelectedPlayerIds([]);
                          setSelectionMode(null);
                          handleGenerate(manualPlayers, room.sport as SportType);
                          setIsBalanceSettingsOpen(false);
                        }}
                        className={`w-full py-3 rounded-[24px] text-[16px] font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 ${isBalanceSettingsOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-slate-900/40 dark:shadow-white/20'}`}
                        style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                      >
                        {t('generateTeams')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {renderMemberPickerModal()}

      {/* Result Overlay (non-BALANCE page) */}
      {result && currentPage !== AppPageType.BALANCE && (
        <div id="results-capture-section" className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col px-5 py-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
            <div data-capture-ignore="true" className="flex gap-2">
              <button
                onClick={() => setResult(null)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-300 transition-all"
              >
                {t('backToRoster')}
              </button>
              <button
                onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                disabled={!!isSharing}
                className="bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2"
              >
                {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
              </button>
            </div>
          </div>

          <div className={`backdrop-blur-sm ${darkMode ? 'bg-slate-900/80 text-slate-100' : 'bg-slate-100/80 text-slate-900'} rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 w-full`}>
            <div className="flex flex-col">
              <span className={`text-[9px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-1`}>{t('standardDeviation')}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono">{result.standardDeviation.toFixed(2)}</span>
                <span className="text-[9px] opacity-40 italic">({t('lowerFairer')})</span>
              </div>
            </div>
            {activeTab !== SportType.GENERAL && (
              <div className="flex flex-col items-center">
                <span className={`text-[8px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('penaltyScore')}</span>
                <div className="flex flex-col items-center leading-tight">
                  <span className={`text-xl font-semibold font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {result.teams.reduce((sum, t) =>
                      sum + t.players.reduce((pSum, p) => {
                        const assigned = p.assignedPosition || 'NONE';
                        const isP1 = (p.primaryPositions || []).includes(assigned) || p.primaryPosition === assigned;
                        const isP2 = (p.secondaryPositions || []).includes(assigned) || p.secondaryPosition === assigned;
                        const isP3 = (p.tertiaryPositions || []).includes(assigned) || p.tertiaryPosition === assigned;
                        return pSum + (isP1 ? 0 : (isP2 ? 0.5 : (isP3 ? 1.0 : 2.0)));
                      }, 0)
                      , 0).toFixed(1)}
                  </span>
                  <span className={`text-[7px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-0.5 whitespace-nowrap`}>({t('penaltyScoreDesc')})</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-48">
            {result.teams.map((team, idx) => (
              <div key={team.id} className="bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-950 p-5 flex items-center justify-between" style={{ borderTop: team.color ? `6px solid ${team.color}` : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg bg-slate-100 dark:bg-slate-800"
                      style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                      onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                      data-capture-ignore="true"
                    >
                      {idx + 1}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase">{team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${idx + 1}`}</h4>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t('squadSum')}</span>
                    <span className="text-2xl font-black font-mono">{team.totalSkill}</span>
                  </div>
                </div>
                {editingResultTeamIdx === idx && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200" data-capture-ignore="true">
                    {TEAM_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                        className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${team.color === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                        style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                        title={t(color.name)}
                      />
                    ))}
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {getSortedTeamPlayers(team.players).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{p.name}</span>
                        {showTier && <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${TIER_COLORS[p.tier]}`}>{Tier[p.tier]}</span>}
                      </div>
                      {activeTab !== SportType.GENERAL && p.assignedPosition && <span className="text-[10px] font-black text-slate-400 uppercase">{p.assignedPosition}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden px-2 pt-2" data-promo-footer="true">
            <div className={`mt-6 py-3 px-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900/40' : 'bg-slate-100/50'}`}>
              <h4 className={`text-sm font-semibold tracking-tight pt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('promoAppTitle')}</h4>
            </div>
          </div>
        </div>
      )}

      {currentBottomTab === BottomTabType.MEMBERS && (
        <div className="w-full px-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderMembersTabContent()}
        </div>
      )}

      {currentBottomTab === BottomTabType.SETTINGS && (
        <SettingsPage
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          lang={lang}
          setLang={handleManualLangChange}
          user={user}
          nickname={userNickname}
          onUpdateNickname={(name) => { setUserNickname(name); localStorage.setItem('app_user_nickname', name); }}
          onLogin={() => setShowLoginModal(true)}
          onLogout={() => handleLogout(setPlayers, setIsDataLoaded)}
          players={players}
          setPlayers={setPlayers}
          showTier={showTier}
          setShowTier={setShowTier}
          sortMode={sortMode}
          setSortMode={setSortMode}
          useTeamColors={useTeamColors}
          setUseTeamColors={setUseTeamColors}
          t={t}
          showConfirm={showConfirm}
          showAlert={showAlert}
        />
      )}

      {/* Selection mode bottom bar */}
      {selectionMode && (
        <div className="fixed left-0 right-0 z-[2100] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-300 overflow-hidden"
          style={{ bottom: currentPage === AppPageType.DETAIL ? (isAdFree ? 'env(safe-area-inset-bottom, 0px)' : 'calc(56px + env(safe-area-inset-bottom, 0px))') : 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: currentPage === AppPageType.DETAIL ? (isAdFree ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '1rem') : '1rem' }}>
          {/* Top color bar */}
          <div className={`h-1 w-full ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
          <div className="max-w-4xl mx-auto flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t('selectionModeActive')}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${selectionMode === 'MATCH' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' : 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'}`}>
                  {t('selectedCount', selectedPlayerIds.length)}
                </span>
              </div>
            </div>
            <p className={`text-[11px] font-medium ${selectionMode === 'MATCH' ? 'text-blue-500 dark:text-blue-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {selectionMode === 'MATCH' ? t('matchDescription') : t('splitDescription')}
            </p>
            <div className="flex gap-2">
              <button disabled={selectedPlayerIds.length < 2} onClick={() => {
                const newConstraint: TeamConstraint = { id: Math.random().toString(36).substr(2, 9), playerIds: selectedPlayerIds, type: selectionMode };
                setTeamConstraints(prev => [...prev, newConstraint]); setSelectionMode(null);
              }} className={`flex-1 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all ${selectedPlayerIds.length >= 2 ? (selectionMode === 'MATCH' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20') : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>{t('apply')}</button>
              <button onClick={() => setSelectionMode(null)} className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all">{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} onUpgradeRequest={() => { setShowInfoModal(false); setShowUpgradeModal(true); }}
        onLogin={() => { setShowInfoModal(false); setShowLoginModal(true); }} onLogout={() => handleLogout(setPlayers, setIsDataLoaded)}
        nickname={userNickname} onUpdateNickname={(name) => { setUserNickname(name); localStorage.setItem('app_user_nickname', name); }}
        onRestore={handleRestorePurchases} isAdFree={isAdFree} isUnlimitedPos={isUnlimitedPos} user={user} />
      <ReviewPrompt isOpen={showReviewPrompt} onLater={handleReviewLater} onRate={handleRateApp} />
      <AlertModal isOpen={alertState.isOpen} title={alertState.title} message={alertState.message} onConfirm={() => setAlertState({ ...alertState, isOpen: false })} />
      <ConfirmModal isOpen={memberSuggestion.isOpen} title={t('suggestMemberTitle')} message={t('suggestMemberMsg', memberSuggestion.applicant?.name || '')}
        confirmText={t('register')} cancelText={t('skip')}
        onConfirm={() => {
          if (memberSuggestion.applicant) {
            const app = memberSuggestion.applicant;
            const p1 = app.primaryPositions || [app.position || 'NONE'];
            const s1 = app.secondaryPositions || [];
            const t1 = app.tertiaryPositions || [];
            const f1 = app.forbiddenPositions || [];
            const newPlayer: Player = { id: 'p_' + Math.random().toString(36).substr(2, 9), name: app.name, tier: parseTier(app.tier),
              isActive: false, sportType: currentActiveRoom?.sport as SportType || activeTab,
              primaryPosition: p1[0] || 'NONE', primaryPositions: p1, secondaryPosition: s1[0] || 'NONE', secondaryPositions: s1,
              tertiaryPosition: t1[0] || 'NONE', tertiaryPositions: t1, forbiddenPositions: f1 };
            setPlayers(prev => [...prev, newPlayer]);
          }
          setMemberSuggestion({ isOpen: false, applicant: null });
        }}
        onCancel={() => setMemberSuggestion({ isOpen: false, applicant: null })} />
      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} confirmText={confirmState.confirmText} cancelText={confirmState.cancelText} />
      <LoginPage isOpen={showLoginModal} onLater={handleLoginLater} onLogin={() => handleGoogleLogin(setPlayers, setIsDataLoaded)} />
      <PositionLimitModal isOpen={showLimitModal} onWatchAd={handleWatchRewardAd} onUpgrade={() => { setShowLimitModal(false); setShowUpgradeModal(true); }} onClose={() => setShowLimitModal(false)} />
      <RewardAdModal isOpen={showRewardAd} onComplete={handleRewardAdComplete} onClose={() => setShowRewardAd(false)} />
      <LoginRecommendModal isOpen={showLoginRecommendModal} onLogin={() => { setShowLoginRecommendModal(false); handleGoogleLogin(setPlayers, setIsDataLoaded); }}
        onLater={() => { setShowLoginRecommendModal(false); if (pendingUpgradeType) executePurchase(pendingUpgradeType); }} />
      <HostRoomModal isOpen={showHostRoomModal} onClose={() => setShowHostRoomModal(false)}
        onRoomCreated={(room) => { setCurrentActiveRoom(room); setActiveRooms(prev => { const exists = prev.find(r => r.id === room.id); if (exists) return prev.map(r => r.id === room.id ? room : r); return [...prev, room]; }); setShowHostRoomModal(false); AnalyticsService.logEvent('recruit_room_created', { sport: room.sport }); }}
        activeRoom={currentActiveRoom} activeRooms={activeRooms}
        activePlayerCount={players.filter(p => p.isActive && p.sportType === (currentActiveRoom?.sport || activeTab)).length}
        activeTab={activeTab}
        onCloseRoom={() => { if (currentActiveRoom) setActiveRooms(prev => prev.filter(r => r.id !== currentActiveRoom.id)); setCurrentActiveRoom(null); }}
        onApproveAll={(approvedPlayers) => {
          setPlayers(prev => {
            const newList = [...prev];
            approvedPlayers.forEach(ap => {
              const existingIdx = newList.findIndex(p => p.name === ap.name);
              if (existingIdx > -1) { newList[existingIdx] = { ...newList[existingIdx], tier: ap.tier, sportType: ap.sportType, primaryPosition: ap.primaryPosition, primaryPositions: ap.primaryPositions, secondaryPosition: ap.secondaryPosition, secondaryPositions: ap.secondaryPositions, tertiaryPositions: ap.tertiaryPositions, forbiddenPositions: ap.forbiddenPositions, isActive: true }; }
              else { newList.push(ap); }
            }); return newList;
          });
        }}
        lang={lang} darkMode={darkMode} isPro={isPro} onUpgrade={() => { setShowHostRoomModal(false); setShowUpgradeModal(true); }}
        userNickname={userNickname} currentUserId={currentUserId} />
      <ApplyRoomModal isOpen={showApplyRoomModal} roomId={pendingJoinRoomId}
        onClose={() => { setShowApplyRoomModal(false); setPendingJoinRoomId(null); }}
        onSuccess={() => { setShowApplyRoomModal(false); setPendingJoinRoomId(null); }} lang={lang} darkMode={darkMode} />
      <GuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} title={t('guideTitle')} content={t('guideContent') || t('comingSoon')} />
      {updateInfo && (
        <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)}
          onUpdate={() => { if (updateInfo.storeUrl) window.open(updateInfo.storeUrl, '_system'); }}
          message={updateInfo.message} forceUpdate={updateInfo.forceUpdate} />
      )}

      <div className="h-[180px]" />
      {/* Bottom Tab Bar */}
      {currentPage === AppPageType.HOME && (
        <div className="fixed left-0 right-0 z-[4000] bg-[#F9F9F9] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]"
          style={{ bottom: isAdFree ? '0px' : '56px', height: 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
          <div className="flex h-[60px] max-w-lg mx-auto">
            <button onClick={() => setCurrentBottomTab(BottomTabType.HOME)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
              <div className={currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.HOME ? <HomeFilledIcon /> : <HomeIcon />}</div>
              <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('homeTab')}</span>
            </button>
            <button onClick={() => { setCurrentBottomTab(BottomTabType.MEMBERS); if (activeTab === SportType.ALL) setActiveTab(SportType.GENERAL); }} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
              <div className={currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.MEMBERS ? <UserPlusFilledIcon /> : <UserPlusIcon />}</div>
              <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('membersTab')}</span>
            </button>
            <button onClick={() => setCurrentBottomTab(BottomTabType.SETTINGS)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
              <div className={currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.SETTINGS ? <MoreFilledIcon /> : <MoreIcon />}</div>
              <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('settingsTab')}</span>
            </button>
          </div>
        </div>
      )}

      <AdBanner lang={lang} darkMode={darkMode} isAdFree={isAdFree} bottomOffset="0px" />

      {/* Toast for undo delete */}
      <Toast
        isVisible={toastState.isVisible}
        message={t('playerDeleted')}
        actionLabel={t('undo')}
        onAction={() => {
          if (toastState.player) {
            setPlayers(prev => [toastState.player!, ...prev]);
          }
          setToastState({ isVisible: false, player: null });
        }}
        onDismiss={() => setToastState({ isVisible: false, player: null })}
      />
    </div>
  );
};

export default App;
