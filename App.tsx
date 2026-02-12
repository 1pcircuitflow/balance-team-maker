import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, Tier, SportType, BottomTabType, AppPageType } from './types';
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdOptions } from '@capacitor-community/admob';
import { AnalyticsService } from './services/analyticsService';
import { App as CapApp } from '@capacitor/app';
import { parseTier, applicantToPlayer } from './utils/helpers';

// Contexts
import { AppProvider, useAppContext } from './contexts/AppContext';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { PlayerProvider, usePlayerContext } from './contexts/PlayerContext';
import { NavigationProvider, useNavigationContext } from './contexts/NavigationContext';
import { TeamBalanceProvider, useTeamBalanceContext } from './contexts/TeamBalanceContext';
import { RecruitmentProvider, useRecruitmentContext } from './contexts/RecruitmentContext';
import { PlayerActionsProvider, usePlayerActionsContext } from './contexts/PlayerActionsContext';

// Hooks
import { useInitialization } from './hooks/useInitialization';
import { useAnnouncements } from './hooks/useAnnouncements';

// Components
import { AdBanner } from './components/AdBanner';
import { LoadingOverlay } from './components/LoadingOverlay';
import { Toast } from './components/Toast';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { BottomTabBar } from './components/BottomTabBar';
import { SelectionModeBar } from './components/SelectionModeBar';
import { MembersTabContent } from './components/MembersTabContent';
import { ResultOverlay } from './components/ResultOverlay';

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
import { MemberPickerModal } from './components/modals/MemberPickerModal';

// Pages
import { HomePage } from './pages/HomePage';
import { EditRoomPage } from './pages/EditRoomPage';
import { BalancePage } from './pages/BalancePage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './components/SettingsPage';

const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthProvider>
        <PlayerProvider>
          <NavigationProvider>
            <TeamBalanceProvider>
              <RecruitmentProvider>
                <PlayerActionsProvider>
                  <AppContent />
                </PlayerActionsProvider>
              </RecruitmentProvider>
            </TeamBalanceProvider>
          </NavigationProvider>
        </PlayerProvider>
      </AuthProvider>
    </AppProvider>
  );
};

const AppContent: React.FC = () => {
  const { lang, setLang, darkMode, t, showAlert, alertState, setAlertState, confirmState, setConfirmState } = useAppContext();
  const { user, currentUserId, userNickname, setUserNickname, isAdFree, setIsAdFree, handleGoogleLogin, handleLogout, showLoginModal, setShowLoginModal, loginLater, setLoginLater } = useAuthContext();
  const { players, setPlayers, setIsDataLoaded } = usePlayerContext();
  const { currentBottomTab, setCurrentBottomTab, currentPage, setCurrentPage, activeTab, setActiveTab } = useNavigationContext();
  const {
    result, setResult, isSharing, isGenerating, countdown,
    showColorPicker, setShowColorPicker, showQuotaSettings, setShowQuotaSettings,
    selectionMode, setSelectionMode, selectedPlayerIds, setSelectedPlayerIds,
    showLimitModal, setShowLimitModal, showRewardAd, setShowRewardAd,
    showReviewPrompt, setShowReviewPrompt,
    handleReviewLater, handleRateApp, positionUsage, setPositionUsage,
  } = useTeamBalanceContext();
  const {
    activeRooms, setActiveRooms, currentActiveRoom, setCurrentActiveRoom,
    showHostRoomModal, setShowHostRoomModal, showApplyRoomModal, setShowApplyRoomModal,
    pendingJoinRoomId, setPendingJoinRoomId, memberSuggestion, setMemberSuggestion,
  } = useRecruitmentContext();
  const { toastState, setToastState } = usePlayerActionsContext();

  const isPro = isAdFree;

  // Modal states
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginRecommendModal, setShowLoginRecommendModal] = useState(false);
  const [pendingUpgradeType, setPendingUpgradeType] = useState<'AD_FREE' | 'FULL' | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ message: string; forceUpdate: boolean; storeUrl: string; } | null>(null);
  const [showMemberPickerModal, setShowMemberPickerModal] = useState(false);

  // Announcements
  const { visibleAnnouncement, getAnnouncementText } = useAnnouncements(lang);

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

  // Reset result when activeTab changes
  useEffect(() => {
    setResult(null);
    localStorage.setItem('last_active_tab', activeTab);
  }, [activeTab]);

  // Deep link auto-open
  useEffect(() => {
    if (pendingJoinRoomId) setShowApplyRoomModal(true);
  }, [pendingJoinRoomId]);

  // Back button handler
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
        if (s.currentPage === AppPageType.DETAIL) { setCurrentPage(AppPageType.HOME); setCurrentBottomTab(BottomTabType.HOME); return; }
        CapApp.exitApp();
      });
    };
    setupListener();
    return () => { if (backHandler) backHandler.remove(); };
  }, []);

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

  const executePurchase = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {};
  const handleRestorePurchases = async () => {};

  const handleLoginLater = () => {
    setShowLoginModal(false);
    setLoginLater(true);
  };

  // ========= SWIPE TAB NAVIGATION =========
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const getAvailableTabs = useCallback((): SportType[] => {
    const all = Object.values(SportType) as SportType[];
    if (currentBottomTab === BottomTabType.MEMBERS) return all.filter(v => v !== SportType.ALL);
    return all;
  }, [currentBottomTab]);

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleSwipeTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

    const tabs = getAvailableTabs();
    const currentIdx = tabs.indexOf(activeTab);
    if (currentIdx === -1) return;

    const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= tabs.length) return;

    setActiveTab(tabs[nextIdx]);
    setResult(null);
    AnalyticsService.logEvent('tab_change', { sport: tabs[nextIdx] });
  }, [activeTab, getAvailableTabs, setActiveTab, setResult]);

  // ========= RENDER =========
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))' }}>

      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isAdFree={isPro} />}

      {/* Announcement Banner */}
      {currentPage === AppPageType.HOME && visibleAnnouncement && (
        <AnnouncementBanner
          visibleAnnouncement={visibleAnnouncement}
          getAnnouncementText={getAnnouncementText}
        />
      )}

      {/* Sport Tabs */}
      {currentPage === AppPageType.HOME && currentBottomTab !== BottomTabType.SETTINGS && (
        <nav className="flex gap-[10px] bg-white dark:bg-slate-950 px-5 pb-2 mb-3 w-full overflow-x-auto no-scrollbar whitespace-nowrap">
          {(Object.entries(SportType) as [string, SportType][]).filter(([, value]) => currentBottomTab !== BottomTabType.MEMBERS || value !== SportType.ALL).map(([key, value]) => (
            <button key={value} onClick={() => { setActiveTab(value); setResult(null); AnalyticsService.logEvent('tab_change', { sport: value }); }}
              className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${activeTab === value ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'}`}>
              {t(value.toLowerCase())}
            </button>
          ))}
        </nav>
      )}

      {/* HOME Page */}
      {currentBottomTab === BottomTabType.HOME && (
        <div className="w-full flex-1" onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
          <HomePage />
        </div>
      )}

      {/* EDIT_ROOM Page */}
      {currentPage === AppPageType.EDIT_ROOM && currentActiveRoom && <EditRoomPage />}

      {/* BALANCE Page */}
      {currentPage === AppPageType.BALANCE && currentActiveRoom && <BalancePage />}

      {/* DETAIL Page */}
      {currentPage === AppPageType.DETAIL && currentActiveRoom && (
        <DetailPage setShowMemberPickerModal={setShowMemberPickerModal} />
      )}

      {/* Member Picker Modal */}
      <MemberPickerModal
        isOpen={showMemberPickerModal}
        onClose={() => setShowMemberPickerModal(false)}
      />

      {/* Result Overlay (non-BALANCE page) */}
      {result && currentPage !== AppPageType.BALANCE && <ResultOverlay />}

      {/* MEMBERS Tab */}
      {currentBottomTab === BottomTabType.MEMBERS && (
        <div className="w-full px-5 animate-in fade-in slide-in-from-bottom-4 duration-500" onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
          <MembersTabContent />
        </div>
      )}

      {/* SETTINGS Tab */}
      {currentBottomTab === BottomTabType.SETTINGS && <SettingsPage />}

      {/* Selection mode bottom bar */}
      <SelectionModeBar />

      {/* Modals */}
      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} onUpgradeRequest={() => { setShowInfoModal(false); setShowUpgradeModal(true); }}
        onLogin={() => { setShowInfoModal(false); setShowLoginModal(true); }} onLogout={() => handleLogout(setPlayers, setIsDataLoaded)}
        nickname={userNickname} onUpdateNickname={(name) => { setUserNickname(name); localStorage.setItem('app_user_nickname', name); }}
        onRestore={handleRestorePurchases} isAdFree={isAdFree} isUnlimitedPos={true} user={user} />
      <ReviewPrompt isOpen={showReviewPrompt} onLater={handleReviewLater} onRate={handleRateApp} />
      <AlertModal isOpen={alertState.isOpen} title={alertState.title} message={alertState.message} onConfirm={() => setAlertState({ ...alertState, isOpen: false })} />
      <ConfirmModal isOpen={memberSuggestion.isOpen} title={t('suggestMemberTitle')} message={t('suggestMemberMsg', memberSuggestion.applicant?.name || '')}
        confirmText={t('register')} cancelText={t('skip')}
        onConfirm={() => {
          if (memberSuggestion.applicant) {
            const newPlayer = applicantToPlayer(memberSuggestion.applicant, currentActiveRoom?.sport as SportType || activeTab, { isActive: false });
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
      {currentPage === AppPageType.HOME && <BottomTabBar />}

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
