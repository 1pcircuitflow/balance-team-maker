import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, Tier, SportType, BottomTabType, AppPageType } from './types';
import { Z_INDEX } from './constants';
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
import { OfflineBanner } from './components/OfflineBanner';
import { SportFilterButton } from './components/SportFilterButton';
import { SportSegmentControl } from './components/SportSegmentControl';

// Modals
import { AlertModal } from './components/modals/AlertModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { UpdateModal } from './components/modals/UpdateModal';

import { InfoModal } from './components/modals/InfoModal';
import { ReviewPrompt } from './components/modals/ReviewPrompt';
import { LoginPage } from './components/modals/LoginPage';
import { PositionLimitModal } from './components/modals/PositionLimitModal';
import { RewardAdModal } from './components/modals/RewardAdModal';
import { HostRoomModal } from './components/modals/HostRoomModal';
import { ApplyRoomModal } from './components/modals/ApplyRoomModal';
import { MemberPickerModal } from './components/modals/MemberPickerModal';
import { OnboardingModal } from './components/modals/OnboardingModal';

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
  const { user, currentUserId, userNickname, setUserNickname, isAdFree, setIsAdFree, handleGoogleLogin, handleKakaoLogin, completeKakaoLogin, handleLogout, showLoginModal, setShowLoginModal, needsOnboarding } = useAuthContext();
  const { players, setPlayers, setIsDataLoaded } = usePlayerContext();
  const { currentBottomTab, setCurrentBottomTab, currentPage, setCurrentPage, activeTab, setActiveTab, membersTab, setMembersTab } = useNavigationContext();
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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

  // Kakao login callback handler (중복 호출 방지)
  const processedKakaoCodeRef = useRef<string | null>(null);
  const handleKakaoCode = useCallback((code: string) => {
    if (processedKakaoCodeRef.current === code) return;
    processedKakaoCodeRef.current = code;
    completeKakaoLogin(code, setPlayers, setIsDataLoaded);
  }, [completeKakaoLogin, setPlayers, setIsDataLoaded]);

  // Initialization hook
  useInitialization(
    lang, setLang, user, currentUserId, setShowLoginModal, setIsAdFree,
    currentActiveRoom?.id, setAlertState, setPendingJoinRoomId,
    setShowUpdateModal, setUpdateInfo, handleRewardAdComplete, t,
    handleKakaoCode,
  );

  // Web: 카카오 로그인 콜백 (URL 파라미터 감지)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kakaoCode = params.get('kakao_code');
    if (kakaoCode) {
      window.history.replaceState({}, '', window.location.pathname);
      handleKakaoCode(kakaoCode);
    }
  }, []);

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
    alertIsOpen: alertState.isOpen, showRewardAd, showLoginModal,
    showUpgradeModal, showLimitModal, showReviewPrompt, showInfoModal, showApplyRoomModal,
    showHostRoomModal, showColorPicker, showQuotaSettings, selectionMode, currentPage,
    currentBottomTab, showMemberPickerModal,
  });
  useEffect(() => {
    modalStateRef.current = {
      alertIsOpen: alertState.isOpen, showRewardAd, showLoginModal,
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
        if (s.showLoginModal) { CapApp.exitApp(); return; }
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

  // ========= SWIPE TAB NAVIGATION =========
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const getAvailableTabs = useCallback((): SportType[] => {
    return [SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL];
  }, []);

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleSwipeTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeStartRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (currentPage !== AppPageType.HOME || currentBottomTab !== BottomTabType.MEMBERS) return;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

    const tabs = getAvailableTabs();
    const currentIdx = tabs.indexOf(membersTab);
    if (currentIdx === -1) return;

    const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0 || nextIdx >= tabs.length) return;

    setMembersTab(tabs[nextIdx]);
    setResult(null);
    AnalyticsService.logEvent('tab_change', { sport: tabs[nextIdx] });
  }, [membersTab, getAvailableTabs, setMembersTab, setResult, currentPage, currentBottomTab]);

  // ========= RENDER =========
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: isAdFree ? 'calc(120px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))' : 'calc(176px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))' }}
      onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>

      <OfflineBanner />

      {isGenerating && <LoadingOverlay lang={lang} activeTab={(currentActiveRoom?.sport as SportType) || activeTab} darkMode={darkMode} countdown={countdown} isAdFree={isPro} />}

      {/* Sticky Header: Announcement + Sport Tabs */}
      {currentPage === AppPageType.HOME && (
        <div className={`sticky w-full ${darkMode ? 'bg-slate-950' : 'bg-white'}`}
          style={{ zIndex: Z_INDEX.STICKY_HEADER, top: 'calc(env(safe-area-inset-top, 0px))' }}>
          {/* Announcement Banner */}
          {visibleAnnouncement && (
            <AnnouncementBanner
              visibleAnnouncement={visibleAnnouncement}
              getAnnouncementText={getAnnouncementText}
            />
          )}

          {/* HOME: Sport Filter Dropdown */}
          {currentBottomTab === BottomTabType.HOME && (
            <div className="w-full px-5 pb-3">
              <SportFilterButton />
            </div>
          )}

          {/* MEMBERS: Segment Control */}
          {currentBottomTab === BottomTabType.MEMBERS && (
            <SportSegmentControl />
          )}
        </div>
      )}

      {/* HOME Page */}
      {currentBottomTab === BottomTabType.HOME && (
        <div className="w-full flex-1">
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
        <div className="w-full px-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={() => { setConfirmState(prev => ({ ...prev, isOpen: false })); confirmState.onConfirm?.(); }}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} confirmText={confirmState.confirmText} cancelText={confirmState.cancelText} />
      <LoginPage isOpen={showLoginModal} onLogin={() => handleGoogleLogin(setPlayers, setIsDataLoaded)} onKakaoLogin={() => handleKakaoLogin(setPlayers, setIsDataLoaded)} />
      <PositionLimitModal isOpen={showLimitModal} onWatchAd={handleWatchRewardAd} onUpgrade={() => { setShowLimitModal(false); setShowUpgradeModal(true); }} onClose={() => setShowLimitModal(false)} />
      <RewardAdModal isOpen={showRewardAd} onComplete={handleRewardAdComplete} onClose={() => setShowRewardAd(false)} />
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
        userNickname={userNickname} currentUserId={currentUserId} showAlert={showAlert} />
      <ApplyRoomModal isOpen={showApplyRoomModal} roomId={pendingJoinRoomId}
        onClose={() => { setShowApplyRoomModal(false); setPendingJoinRoomId(null); }}
        onSuccess={() => { setShowApplyRoomModal(false); setPendingJoinRoomId(null); }} lang={lang} darkMode={darkMode} />
      {needsOnboarding && <OnboardingModal />}
      {updateInfo && (
        <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)}
          onUpdate={() => { if (updateInfo.storeUrl) window.open(updateInfo.storeUrl, '_system'); }}
          message={updateInfo.message} forceUpdate={updateInfo.forceUpdate} />
      )}

      <div className="h-px" />

      {/* Bottom Tab Bar */}
      {currentPage === AppPageType.HOME && !showHostRoomModal && !showLoginModal && <BottomTabBar />}

      <AdBanner lang={lang} darkMode={darkMode} isAdFree={isAdFree} bottomOffset="0px" />

      {/* Toast for add/delete */}
      <Toast
        isVisible={toastState.isVisible}
        message={toastState.action === 'add' ? t('playerAdded') : t('playerDeleted')}
        actionLabel={toastState.action === 'delete' ? t('undo') : undefined}
        onAction={toastState.action === 'delete' ? () => {
          if (toastState.player) {
            setPlayers(prev => [toastState.player!, ...prev]);
          }
          setToastState({ isVisible: false, player: null });
        } : undefined}
        onDismiss={() => setToastState({ isVisible: false, player: null })}
        bottom={isAdFree ? '76px' : '132px'}
      />
    </div>
  );
};

export default App;
