import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Player, Tier, BalanceResult, SportType, Position, TeamConstraint } from './types';
import { STORAGE_KEY, TIER_COLORS, TEAM_COLORS } from './constants';
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
  db,
  savePlayersToCloud,
  loadPlayersFromCloud,
  checkAppVersion
} from './services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';

import * as Icons from './Icons';
const {
  PlusIcon, MinusIcon, TrashIcon, EditIcon, CheckIcon, ShuffleIcon,
  UserPlusIcon, UserCheckIcon, ShareIcon, SunIcon, MoonIcon,
  SlidersIcon, InfoIcon, GlobeIcon, ExternalLinkIcon, MoreIcon,
  SettingsIcon, HeartIcon, RotateCcwIcon, CloseIcon, HelpCircleIcon
} = Icons;

// 분리된 컴포넌트 임포트
import { PromotionFooter } from './components/layout/PromotionFooter';
import { LoadingOverlay } from './components/common/LoadingOverlay';
import { FormationPicker } from './components/common/FormationPicker';
import { ReviewPrompt } from './components/modals/ReviewPrompt';
import { LoginModal } from './components/modals/LoginModal';
import { AlertModal } from './components/modals/AlertModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { PositionLimitModal } from './components/modals/PositionLimitModal';
import { LanguageMenu } from './components/common/LanguageMenu';
import { RewardAdModal } from './components/modals/RewardAdModal';
import { LoginRecommendModal } from './components/modals/LoginRecommendModal';
import { RecruitmentStatusBadge } from './components/common/RecruitmentStatusBadge';
import { HostRoomModal } from './components/modals/HostRoomModal';
import { ApplyRoomModal } from './components/modals/ApplyRoomModal';
import { GuideModal } from './components/modals/GuideModal';
import { UpdateModal } from './components/modals/UpdateModal';
import { InfoModal } from './components/modals/InfoModal';
import { DateTimePicker } from './components/common/DateTimePicker';
import { QuotaFormationPicker } from './components/common/QuotaFormationPicker';
import { PlayerItem } from './components/features/PlayerItem';
import { AdBanner } from './components/common/AdBanner';

// 유틸리티 함수 임포트
import { compareVersions, getInitialLang, getPosLabel } from './src/utils/common';


















const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(getInitialLang());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [activeTab, setActiveTab] = useState<SportType>(() => {
    const saved = localStorage.getItem('last_active_tab');
    return (saved as SportType) || SportType.GENERAL;
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<Tier>(Tier.B);
  const [newP1s, setNewP1s] = useState<Position[]>([]);
  const [newP2s, setNewP2s] = useState<Position[]>([]);
  const [newP3s, setNewP3s] = useState<Position[]>([]);
  const [newForbidden, setNewForbidden] = useState<Position[]>([]);
  const [teamCount, setTeamCount] = useState(2);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [pastResults, setPastResults] = useState<Set<string>>(new Set()); // 이력 관리
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'name' | 'tier'>('name');

  const [quotas, setQuotas] = useState<Partial<Record<Position, number | null>>>({});
  const [showQuotaSettings, setShowQuotaSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showNewPlayerFormation, setShowNewPlayerFormation] = useState(false);
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);
  const [unselectAllConfirm, setUnselectAllConfirm] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [selectionMode, setSelectionMode] = useState<'MATCH' | 'SPLIT' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teamConstraints, setTeamConstraints] = useState<TeamConstraint[]>(() => {
    const saved = localStorage.getItem(`app_constraints`);
    return saved ? JSON.parse(saved) : [];
  });

  const [useTeamColors, setUseTeamColors] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTeamColors, setSelectedTeamColors] = useState<string[]>(['#ef4444', '#3b82f6']);
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [editingResultTeamIdx, setEditingResultTeamIdx] = useState<number | null>(null);

  const [alertState, setAlertState] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    message: '',
  });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title?: string; message: string; onConfirm: () => void; confirmText?: string; cancelText?: string }>({
    isOpen: false,
    message: '',
    onConfirm: () => { },
  });

  const showAlert = (message: string, title?: string) => {
    setAlertState({ isOpen: true, message, title });
  };


  const [isDataLoaded, setIsDataLoaded] = useState(false); // 초기 데이터 로드 완료 여부

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

  const [guestId, setGuestId] = useState(() => {
    const saved = localStorage.getItem('app_guest_id');
    if (saved) return saved;
    const newId = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('app_guest_id', newId);
    return newId;
  });

  // 최종 유저 식별자 (로그인 정보가 있으면 id, 없으면 guestId)
  const currentUserId = user?.id || guestId;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginLater, setLoginLater] = useState(false); // 앱 실행 시마다 초기화 (localStorage 제거)

  const [positionUsage, setPositionUsage] = useState<{ count: number, lastDate: string }>(() => {
    const saved = localStorage.getItem('app_position_usage');
    return saved ? JSON.parse(saved) : { count: 0, lastDate: '' };
  });
  const [totalGenCount, setTotalGenCount] = useState(() => parseInt(localStorage.getItem('app_total_gen_count') || '0', 10));
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showRewardAd, setShowRewardAd] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLoginRecommendModal, setShowLoginRecommendModal] = useState(false);

  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);

  // 업데이트 관련 상태
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    message: string;
    forceUpdate: boolean;
    storeUrl: string;
  } | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      // 1. 현재 앱 버전 가져오기
      const info = await CapApp.getInfo();
      const currentVersion = info.version; // 예: "2.1.26"

      // 2. Remote Config 버전 정보 가져오기
      const remoteInfo = await checkAppVersion();

      if (remoteInfo) {
        // 3. 버전 비교 (Remote > Current 이면 업데이트 필요)
        if (compareVersions(remoteInfo.latestVersion, currentVersion) > 0) {
          const isAndroid = Capacitor.getPlatform() === 'android';
          setUpdateInfo({
            message: remoteInfo.updateMessage,
            forceUpdate: remoteInfo.forceUpdate,
            storeUrl: isAndroid ? remoteInfo.storeUrlAndroid : remoteInfo.storeUrlIos
          });
          setShowUpdateModal(true);
        }
      }
    };

    checkVersion();
  }, []); // 앱 시작 시 1회 실행

  const [isAdFree, setIsAdFree] = useState(() => localStorage.getItem('app_is_ad_free') === 'true');
  const isUnlimitedPos = true; // 항목 4: 전면 무료화
  const isPro = isAdFree;

  const [showTier, setShowTier] = useState(false); // 항목 2: 티어 숨기기/보이기
  const [activeRooms, setActiveRooms] = useState<RecruitmentRoom[]>([]); // 항목 7: 멀티 모임 관리
  const filteredRooms = useMemo(() => {
    return activeRooms.filter(r => {
      try {
        const [y, m, d] = r.matchDate.split('-').map(Number);
        const [hh, mm] = r.matchTime.split(':').map(Number);
        const matchTime = new Date(y, m - 1, d, hh, mm);
        // 필터링 완화: 경기 종료 후 24시간까지 보임
        const expiryLimit = new Date(matchTime.getTime() + 24 * 60 * 60 * 1000);
        return expiryLimit > new Date() && r.status !== 'DELETED';
      } catch { return true; }
    });
  }, [activeRooms]);

  const [currentActiveRoom, setCurrentActiveRoom] = useState<RecruitmentRoom | null>(null);

  const [pendingUpgradeType, setPendingUpgradeType] = useState<'AD_FREE' | 'FULL' | null>(null);

  // 섹션 펼치기/접기 상태
  const [isPlayerRegistrationOpen, setIsPlayerRegistrationOpen] = useState(false);
  const [isWaitingListOpen, setIsWaitingListOpen] = useState(false);
  const [isParticipatingListOpen, setIsParticipatingListOpen] = useState(true);

  // 일본어 폰트 적용
  useEffect(() => {
    if (lang === 'ja') {
      document.body.style.fontFamily = '"Pretendard JP Variable", "Pretendard JP", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    } else {
      document.body.style.fontFamily = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
    }
  }, [lang]);

  // 마지막 탭 기억
  useEffect(() => {
    localStorage.setItem('last_active_tab', activeTab);
  }, [activeTab]);

  // 참가자 목록 동기화 (앱 -> 웹)
  useEffect(() => {
    if (!currentActiveRoom) return;

    const syncParticipants = async () => {
      try {
        const activeParticipants = players
          .filter(p => p.isActive && p.sportType === currentActiveRoom.sport)
          .map(p => ({
            name: p.name,
            tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
            isApproved: true // 앱에 있는 선수는 모두 승인된 것으로 간주
          }));

        const roomRef = doc(db, 'rooms', currentActiveRoom.id);
        await updateDoc(roomRef, { activeParticipants });
      } catch (error) {
        console.error('Failed to sync participants:', error);
      }
    };

    const timer = setTimeout(syncParticipants, 1000); // Debounce 1s
    return () => clearTimeout(timer);
  }, [players, currentActiveRoom]);

  const [isProcessing, setIsProcessing] = useState(false); // 결제/로그인 중복 클릭 방지

  const [showHostRoomModal, setShowHostRoomModal] = useState(false);
  const [showApplyRoomModal, setShowApplyRoomModal] = useState(false);
  const prevApplicantsCount = useRef<Record<string, number>>({});

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };




  useEffect(() => {
    const initAdMob = async () => {
      try {
        await AdMob.initialize({
          initializeForTesting: false,
        });

        if (Capacitor.getPlatform() === 'ios') {
          await AdMob.requestTrackingAuthorization();
        }

        AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: any) => {
          console.log('User earned reward', reward);
          handleRewardAdComplete();
        });
      } catch (e) {
        console.error('AdMob init failed', e);
      }
    };

    const initIAP = async () => {
      try {
        await paymentService.initialize();
        const restored = await paymentService.restorePurchases();

        // 광고 제거 상태 동기화
        const hasAdFree = restored.includes(PRODUCT_IDS.AD_FREE) || restored.includes(PRODUCT_IDS.FULL_PACK);
        setIsAdFree(hasAdFree);
        localStorage.setItem('app_is_ad_free', hasAdFree ? 'true' : 'false');

        console.log('IAP Sync completed:', { hasAdFree });
      } catch (err) {
        console.error('IAP initialization failed', err);
      }
    };

    initAdMob();
    initIAP();
  }, []); // 마운트 시 1회만 실행

  useEffect(() => {
    const initSystemLang = async () => {
      // 레거시 키 제거 (새 로직 적용을 위해)
      const oldLang = localStorage.getItem('app_lang');
      if (oldLang) localStorage.removeItem('app_lang');

      const manual = localStorage.getItem('app_lang_manual');
      // 사용자가 직접 언어를 선택한 적이 없을 때만 시스템 언어 실시간 확인
      if (!manual && Capacitor.isNativePlatform()) {
        try {
          const info = await Device.getLanguageCode();
          const systemLang = info.value.split('-')[0] as Language;
          const supported: Language[] = ['ko', 'en', 'pt', 'es', 'ja'];
          if (supported.includes(systemLang) && systemLang !== lang) {
            setLang(systemLang);
          }
        } catch (e) {
          console.error('Failed to get device language', e);
        }
      }
    };
    initSystemLang();
    AnalyticsService.logAppOpen(); // 앱 실행 기록

    if (!user && !loginLater) {
      setShowLoginModal(true);
    }

    // 자동 로그인 시 클라우드 데이터 로드 (로그인만 하면 무료)
    if (user?.id) {
      loadPlayersFromCloud(user.id).then(cloudPlayers => {
        if (cloudPlayers && cloudPlayers.length > 0) {
          setPlayers(cloudPlayers);
        }
        setIsDataLoaded(true);
      }).catch(() => {
        setIsDataLoaded(true);
      });
    } else {
      // 비로그인 상태면 로컬 데이터 로딩 useEffect에서 처리하므로 여기선 대기하거나 true 설정 (상황에 따라 다름)
      // 일단 로그인 체크 완료 의미로 사용
    }

    // Google Auth 초기화 (웹 환경 대응 포함)
    const initAuth = async () => {
      try {
        await GoogleAuth.initialize();
      } catch (e) {
        console.error('Auth init failed', e);
      }
    };
    initAuth();

    const initLocalNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.requestPermissions();
        } catch (e) {
          console.error('LocalNotifications permissions failed', e);
        }
      }
    };
    initLocalNotifications();

    // 일일 제한 초기화 체크
    const today = new Date().toISOString().split('T')[0];
    const savedUsage = localStorage.getItem('app_position_usage');
    if (savedUsage) {
      const parsed = JSON.parse(savedUsage);
      if (parsed.lastDate !== today) {
        const freshUsage = { count: 0, lastDate: today };
        setPositionUsage(freshUsage);
        localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
      }
    } else {
      const freshUsage = { count: 0, lastDate: today };
      setPositionUsage(freshUsage);
      localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
    }
  }, []);

  // 모집 방 실시간 동기화 (인원수 등)
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserRooms(currentUserId, (rooms) => {
      // 새 신청자 감지 및 인앱 알림
      rooms.forEach(room => {
        const prevCount = prevApplicantsCount.current[room.id];
        if (prevCount !== undefined && room.applicants.length > prevCount) {
          const newPlayer = room.applicants[room.applicants.length - 1];
          const msg = t('appliedMsg', newPlayer.name, room.applicants.length);
          // showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`); 
          // 상단바 알림으로 대체 (확인 버튼 필요 없게)
          if (Capacitor.isNativePlatform()) {
            LocalNotifications.schedule({
              notifications: [
                {
                  title: `[${room.title}] ${t('recruitParticipants')}`,
                  body: msg,
                  id: Math.floor(Math.random() * 1000000),
                  smallIcon: 'ic_stat_icon_config_sample', // 안드로이드 아이콘 설정 필요할 수 있음
                  sound: 'default',
                }
              ]
            }).catch(e => console.error('Local Notification failed', e));
          } else {
            showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`);
          }
        }
        prevApplicantsCount.current[room.id] = room.applicants.length;
      });

      setActiveRooms(rooms);

      // 1계정 1방 정책: 마지막으로 보던 방 기억
      if (rooms.length > 0) {
        const savedRoomId = localStorage.getItem('last_active_room_id');
        let targetRoom: RecruitmentRoom | null = null;

        // 1. 현재 선택된 상태에서 목록 동기화 (기존 선택 유지)
        setCurrentActiveRoom(prev => {
          const stillExists = rooms.find(r => r.id === prev?.id);
          if (stillExists) {
            targetRoom = stillExists;
            return stillExists;
          }
          const savedRoom = rooms.find(r => r.id === savedRoomId);
          if (savedRoom) {
            targetRoom = savedRoom;
            return savedRoom;
          }
          targetRoom = rooms[0];
          return rooms[0];
        });

        // 활성 방이 결정되면 해당 종목 탭으로 자동 전환 (UX 개선)
        if (targetRoom) {
          const room = targetRoom as RecruitmentRoom;
          setActiveTab(room.sport as SportType);
        }
      } else {
        setCurrentActiveRoom(null);
      }
    });

    return () => unsubscribe();
  }, [currentUserId]); // currentActiveRoom?.id 의존성 제거 (불필요한 재구독 방지)


  useEffect(() => {
    if (currentActiveRoom) {
      localStorage.setItem('last_active_room_id', currentActiveRoom.id);
    }
  }, [currentActiveRoom]);

  // V3.0 푸시 알림 및 딥링크 초기화
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (e) {
        console.error('Push init failed', e);
      }
    };

    const addPushListeners = () => {
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        localStorage.setItem('fcm_token', token.value);
        // 특정 활성 방이 있다면 토큰 업데이트
        if (currentActiveRoom?.id) {
          updateRoomFcmToken(currentActiveRoom.id, token.value);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
        // 인앱 팝업 알림
        if (notification.body) {
          setAlertState({
            isOpen: true,
            message: notification.body,
            title: notification.title || t('appTitle')
          });
        }
      });
    };

    const addDeepLinkListener = () => {
      CapApp.addListener('appUrlOpen', (data) => {
        try {
          console.log('App opened with URL:', data.url);
          // balanceteam://join?room=ABC 형태 처리
          if (data.url.includes('room=')) {
            const url = new URL(data.url);
            const roomId = url.searchParams.get('room');
            if (roomId) {
              setPendingJoinRoomId(roomId);
            }
          }
        } catch (e) {
          console.error('Deep link parsing failed', e);
        }
      });
    };

    initPush();
    addPushListeners();
    addDeepLinkListener();

    return () => {
      PushNotifications.removeAllListeners();
      CapApp.removeAllListeners();
    };
  }, [currentActiveRoom?.id, lang]);

  // 뒤로 가기 버튼 핸들링
  useEffect(() => {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1순위: 알림/메시지 창 닫기
      if (alertState.isOpen) {
        setAlertState(prev => ({ ...prev, isOpen: false }));
        return;
      }

      // 2순위: 각종 모달형 팝업 닫기 (우선순위에 따라 배치)
      if (showRewardAd) { setShowRewardAd(false); return; }
      if (showLoginModal) { setShowLoginModal(false); return; }
      if (showLoginRecommendModal) { setShowLoginRecommendModal(false); return; }
      if (showUpgradeModal) { setShowUpgradeModal(false); return; }
      if (showLimitModal) { setShowLimitModal(false); return; }
      if (showReviewPrompt) { setShowReviewPrompt(false); return; }
      if (showInfoModal) { setShowInfoModal(false); return; }
      if (showApplyRoomModal) { setShowApplyRoomModal(false); return; }
      if (showHostRoomModal) { setShowHostRoomModal(false); return; }

      // 3순위: 화면 내 모드/설정 창 닫기
      if (showColorPicker) { setShowColorPicker(false); return; }
      if (showQuotaSettings) { setShowQuotaSettings(false); return; }
      if (selectionMode !== null) { setSelectionMode(null); setSelectedPlayerIds([]); return; }

      // 4순위: 앱 종료
      // 웹 히스토리가 있다면 뒤로가기를 시도하고 싶을 수도 있지만, 
      // 현재 단일 페이지 앱(SPA) 구조이므로 바로 종료가 자연스러울 수 있음.
      // 만약 라우터 사용 시 history.goBack() 등을 고려해야 함.
      // 여기서는 즉시 종료 또는 사용자 확인 후 종료 처리.
      CapApp.exitApp();
    });

    return () => {
      // Remove specifically if possible or rely on global removeAllListeners in cleanup above if conflicts arise.
      // But typically safely adding/removing here is good practice.
      // Since removeAllListeners is called in another effect, we should be careful.
      // Let's just rely on the fact that this effect won't re-run often.
      // But to be safe, we don't remove all listeners here to avoid clearing Push/Url listeners.
      // CapApp.removeAllListeners(); // DON'T do this here if it clears others.
    };
  }, [
    alertState.isOpen,
    showRewardAd, showLoginModal, showLoginRecommendModal, showUpgradeModal, showLimitModal, showReviewPrompt,
    showInfoModal, showApplyRoomModal, showHostRoomModal,
    showColorPicker, showQuotaSettings, selectionMode
  ]);

  // 딥링크 진입 시 신청 모달 자동 오픈
  useEffect(() => {
    if (pendingJoinRoomId) {
      setShowApplyRoomModal(true);
    }
  }, [pendingJoinRoomId]);

  const handleWatchRewardAd = async () => {
    setShowLimitModal(false);

    try {
      const options: RewardAdOptions = {
        adId: 'ca-app-pub-4761157658396004/2646854681',
        isTesting: false
      };
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
      console.log('Reward Ad shown successfully');
    } catch (e) {
      console.error('Reward Ad failed', e);
      // 광고 실패 시에도 일단 혜택 제공 (UX 차원)
      handleRewardAdComplete();
    }
  };

  const handleRewardAdComplete = () => {
    setShowRewardAd(false);
    // 보너스 사용권 3회 제공 (오늘 날짜 유지하며 카운트를 -3하여 다음 3회 시도 통과)
    setPositionUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 3) }));
    showAlert(t('bonusUnlockedMsg'), t('bonusUnlockedTitle'));
  };

  const handleUpgradePro = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {
    /* 결제 로직 임시 중단
    if (isProcessing) return;
 
    // 로그인이 안 되어 있다면 권장 팝업 표시
    if (!user) {
      setPendingUpgradeType(type);
      setShowLoginRecommendModal(true);
      return;
    }
 
    await executePurchase(type);
    */
    console.log('Purchase disabled temporarily');
  };

  const executePurchase = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {
    /* 결제 실행 임시 중단
    setIsProcessing(true);
    try {
      let productId: string = '';
      if (type === 'AD_FREE') productId = PRODUCT_IDS.AD_FREE;
      else if (type === 'UNLIMITED_POS') productId = PRODUCT_IDS.UNLIMITED_POS;
      else if (type === 'FULL') productId = PRODUCT_IDS.FULL_PACK;
 
      console.log('Starting purchase for:', productId);
      const success = await paymentService.purchase(productId as any);
 
      if (success) {
        if (type === 'AD_FREE' || type === 'FULL') {
          setIsAdFree(true);
          localStorage.setItem('app_is_ad_free', 'true');
        }
 
        setShowLimitModal(false);
        setShowUpgradeModal(false);
        setShowLoginRecommendModal(false);
        showAlert(t('upgradeSuccessMsg'), t('upgradeSuccessTitle'));
      } else {
        // 결제 실패 또는 취소 시 알림 (무반응 해결)
        // showAlert(t('restoreFailed' as any), t('validationErrorTitle')); 
        // -> 보통 취소는 무시하지만 오류일 수 있으므로 로그를 남기거나 간단한 알림이 필요할 수 있음
        console.log('Purchase failed or cancelled');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      showAlert(t('restoreFailed' as any), t('validationErrorTitle'));
    } finally {
      setIsProcessing(false);
    }
    */
  };



  const handleRestorePurchases = async () => {
    /* 복구 로직 임시 중단
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const restored = await paymentService.restorePurchases();
      let restoredAny = false;
 
      if (restored.includes(PRODUCT_IDS.AD_FREE) || restored.includes(PRODUCT_IDS.FULL_PACK)) {
        setIsAdFree(true);
        localStorage.setItem('app_is_ad_free', 'true');
        restoredAny = true;
      }
 
      if (restoredAny) {
        showAlert(t('upgradeSuccessMsg'), t('upgradeSuccessTitle'));
      } else {
        showAlert(t('noPurchasesFound' as any), t('infoTitle'));
      }
    } catch (err) {
      console.error('Restore failed', err);
      showAlert(t('restoreFailed' as any), t('validationErrorTitle'));
    } finally {
      setIsProcessing(false);
    }
    */
  };

  const handleGoogleLogin = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const googleUser = await GoogleAuth.signIn();
      console.log('Google User:', googleUser);
      setUser(googleUser);
      localStorage.setItem('app_user', JSON.stringify(googleUser));

      // 로그인 성공 시 닉네임을 구글 이름으로 자동 설정 (기존 닉네임이 게스트일 경우에만)
      if (userNickname.startsWith(TRANSLATIONS[lang].guest)) {
        setUserNickname(googleUser.givenName);
        localStorage.setItem('app_user_nickname', googleUser.givenName);
      }

      setShowLoginModal(false);
      showAlert(t('welcomeMsg', googleUser.givenName), t('loginSuccessMsg'));

      // 클라우드에서 데이터 가져오기
      setIsDataLoaded(false); // 로드 시작 전 플래그 리셋
      const cloudPlayers = await loadPlayersFromCloud(googleUser.id);

      setPlayers(prev => {
        const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
        // 현재 로컬 선수들 중 샘플이 아닌 실제 추가된 선수들만 필터링
        const actualLocalPlayers = prev.filter(p => !sampleIdPattern.test(p.id));

        if (!cloudPlayers || cloudPlayers.length === 0) {
          // 클라우드에 데이터가 없으면 현재 로컬의 실제 데이터만 유지 (샘플 제거 효과)
          return actualLocalPlayers.length > 0 ? actualLocalPlayers : prev;
        }

        // 병합: 클라우드 데이터를 기본으로 하되, 로컬에만 있는 새로운 선수를 추가 (이름 기준)
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
  };

  const handleLogout = async () => {
    try {
      await GoogleAuth.signOut();
    } catch (e) {
      console.error('Sign out error', e);
    }

    setUser(null);
    localStorage.removeItem('app_user');

    // 닉네임 초기화 (게스트로 복구)
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newGuestName = `${TRANSLATIONS[lang].guest}(${rand})`;
    setUserNickname(newGuestName);
    localStorage.setItem('app_user_nickname', newGuestName);

    // 명단 데이터 샘플로 초기화
    setIsDataLoaded(false);
    setPlayers(SAMPLE_PLAYERS_BY_LANG[lang] || []);
    localStorage.removeItem(STORAGE_KEY);
    setIsDataLoaded(true);

    showAlert(t('logoutMsg'), t('logoutTitle'));
  };

  const handleLoginLater = () => {
    setShowLoginModal(false);
    setLoginLater(true);
    // localStorage.setItem('app_login_later', 'true'); // 저장하지 않음 (앱 껐다 키면 다시 나오게)
  };

  const handleManualLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app_lang_manual', newLang);
    AnalyticsService.logEvent('change_language', { language: newLang });
  };


  useEffect(() => {
    const SAMPLE_DATA_VERSION = 'v3';
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem('app_sample_version');

    const isSampleData = (playerList: Player[]) => {
      if (!playerList || playerList.length === 0) return true;
      const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
      // 모든 선수의 ID가 샘플 패턴(언어코드_)으로 시작해야 샘플로 간주
      return playerList.every(p => sampleIdPattern.test(p.id));
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.length > 0) {
          if (isSampleData(parsed)) {
            // 샘플 데이터인 경우: 버전이 바뀌었거나, 저장된 언어와 현재 언어가 다른 경우에만 업데이트
            if (storedVersion !== SAMPLE_DATA_VERSION) {
              setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
              localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
            } else {
              setPlayers(parsed);
            }
          } else {
            // 사용자 데이터인 경우(한 명이라도 직접 추가했거나 ID가 바뀜): 무조건 유지
            setPlayers(parsed);
          }
        } else {
          setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
          localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
        }
      } catch (e) {
        setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      }
    } else {
      setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
      setIsDataLoaded(true);
    }
  }, []); // 마운트 시 1회만 실행하여 유저 데이터 보존

  // useEffect(() => {localStorage.setItem('app_lang', lang); }, [lang]); // 더 이상 매번 저장하지 않음
  useEffect(() => { localStorage.setItem('app_dark_mode', darkMode.toString()); if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem(`app_constraints`, JSON.stringify(teamConstraints)); }, [teamConstraints]);

  // 선수 데이터가 변경될 때마다 클라우드에 자동 저장 (로그인 시 무료)
  useEffect(() => {
    if (isDataLoaded && user?.id && players.length > 0) {
      savePlayersToCloud(user.id, players);
    }
  }, [players, user, isDataLoaded]);

  useEffect(() => {
    // 수동으로 저장된 쿼터가 있는지 먼저 확인
    const savedQuotasString = localStorage.getItem(`app_quotas_${activeTab}`);
    if (savedQuotasString) {
      try {
        const savedQuotas = JSON.parse(savedQuotasString);
        setQuotas(savedQuotas);
        return; // 저장된 게 있으면 자동 계산 로직 건너뜀
      } catch (e) {
        console.error('Failed to parse saved quotas', e);
      }
    }

    const activeCount = players.filter(p => p.isActive && p.sportType === activeTab).length;
    const perTeam = teamCount > 0 ? Math.floor(activeCount / teamCount) : 0;

    if (activeTab === SportType.SOCCER) {
      setQuotas({
        GK: 1,
        LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null,
        MF: null,
        LW: null, FW: null, RW: null
      });
    } else if (activeTab === SportType.FUTSAL) {
      setQuotas({
        GK: 1,
        FIX: 1,
        ALA: null,
        PIV: null
      });
    } else if (activeTab === SportType.BASKETBALL) {
      setQuotas({
        C: 1, PG: 1,
        SG: null, SF: null, PF: null
      });
    } else setQuotas({});
  }, [teamCount, activeTab]); // 인원 변동 시 자동 초기화 방지 위해 players 제거

  useEffect(() => {
    // 팀 수가 바뀌면 선택된 색상 배열 크기를 맞춤
    setSelectedTeamColors(prev => {
      const next = [...prev];
      if (next.length < teamCount) {
        // 모자라면 남은 색상 중 안 쓴 것을 채움
        const available = TEAM_COLORS.map(c => c.value).filter(v => !next.includes(v));
        while (next.length < teamCount && available.length > 0) {
          next.push(available.shift()!);
        }
        // 그래도 모자라면 그냥 기본 색상 추가
        while (next.length < teamCount) {
          next.push(TEAM_COLORS[next.length % TEAM_COLORS.length].value);
        }
      } else if (next.length > teamCount) {
        return next.slice(0, teamCount);
      }
      return next;
    });
  }, [teamCount]);

  // 참가자 구성이 바뀌면 이력 초기화 (새로운 조합 가능)
  useEffect(() => {
    setPastResults(new Set());
  }, [players]);

  const handleReviewLater = () => {
    const nextPromptDate = new Date();
    nextPromptDate.setDate(nextPromptDate.getDate() + 14);
    localStorage.setItem('app_review_cooldown', nextPromptDate.toISOString());
    setShowReviewPrompt(false);
  };

  const handleRateApp = () => {
    localStorage.setItem('app_review_cooldown', 'DONE');
    setShowReviewPrompt(false);
    window.open('https://play.google.com/store/apps/details?id=com.balanceteammaker', '_blank');
  };

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const player: Player = {
      id: crypto.randomUUID(), name: newName.trim(), tier: newTier, isActive: false,
      sportType: activeTab,
      primaryPosition: newP1s[0] || 'NONE',
      secondaryPosition: newP2s[0] || 'NONE',
      tertiaryPosition: newP3s[0] || 'NONE',
      primaryPositions: newP1s,
      secondaryPositions: newP2s,
      tertiaryPositions: newP3s,
      forbiddenPositions: newForbidden,
    };
    setPlayers(prev => [player, ...prev]);
    setNewName(''); setNewP1s([]); setNewP2s([]); setNewP3s([]); setNewForbidden([]);
    setShowNewPlayerFormation(false);
    AnalyticsService.logEvent('add_player', { sport: activeTab, tier: newTier });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePlayerFromSystem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const toggleParticipation = (id: string) => {
    if (editingPlayerId) return;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  // --- 통합 모집 관리 로직 ---
  const handleApproveApplicant = async (room: RecruitmentRoom, applicant: Applicant) => {
    try {
      const updatedApplicants = room.applicants.map(a =>
        a.id === applicant.id ? { ...a, isApproved: true } : a
      );
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });

      const p1 = (applicant as any).primaryPositions || [applicant.position || 'NONE'];
      const s1 = (applicant as any).secondaryPositions || [];
      const t1 = (applicant as any).tertiaryPositions || [];
      const f1 = (applicant as any).forbiddenPositions || [];

      setPlayers(prev => {
        const existingIdx = prev.findIndex(p => p.name === applicant.name);
        if (existingIdx > -1) {
          // 이름이 같은 선수가 있는 경우: 티어와 포지션을 최신 신청 정보로 업데이트하고 참가 상태로 만듦
          const newList = [...prev];
          newList[existingIdx] = {
            ...newList[existingIdx],
            tier: (Tier as any)[applicant.tier] || Tier.B,
            isActive: true,
            sportType: room.sport as SportType,
            primaryPosition: p1[0] || 'NONE',
            primaryPositions: p1,
            secondaryPosition: s1[0] || 'NONE',
            secondaryPositions: s1,
            tertiaryPositions: t1,
            forbiddenPositions: f1
          };
          return newList;
        }

        // 명단에 없는 경우 새로 추가
        const newPlayer: Player = {
          id: 'p_' + Math.random().toString(36).substr(2, 9),
          name: applicant.name,
          tier: (Tier as any)[applicant.tier] || Tier.B,
          isActive: true,
          sportType: room.sport as SportType,
          primaryPosition: p1[0] || 'NONE',
          primaryPositions: p1,
          secondaryPosition: s1[0] || 'NONE',
          secondaryPositions: s1,
          tertiaryPositions: t1,
          forbiddenPositions: f1
        };
        return [...prev, newPlayer];
      });
    } catch (e) {
      console.error("Approval Error:", e);
    }
  };

  const handleApproveAllApplicants = async (room: RecruitmentRoom) => {
    try {
      const updatedApplicants = room.applicants.map(a => ({ ...a, isApproved: true }));
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });

      setPlayers(prev => {
        const newList = [...prev];
        room.applicants.filter(a => !a.isApproved).forEach(a => {
          const existingIdx = newList.findIndex(p => p.name === a.name);
          const p1 = (a as any).primaryPositions || [a.position || 'NONE'];
          const s1 = (a as any).secondaryPositions || [];
          const t1 = (a as any).tertiaryPositions || [];
          const f1 = (a as any).forbiddenPositions || [];

          if (existingIdx > -1) {
            // 이름이 같은 선수가 있는 경우 최신 정보로 업데이트
            newList[existingIdx] = {
              ...newList[existingIdx],
              tier: (Tier as any)[a.tier] || Tier.B,
              isActive: true,
              sportType: room.sport as SportType,
              primaryPosition: p1[0] || 'NONE',
              primaryPositions: p1,
              secondaryPosition: s1[0] || 'NONE',
              secondaryPositions: s1,
              tertiaryPositions: t1,
              forbiddenPositions: f1
            };
          } else {
            // 명단에 없는 경우 새로 추가
            newList.push({
              id: 'p_' + Math.random().toString(36).substr(2, 9),
              name: a.name,
              tier: (Tier as any)[a.tier] || Tier.B,
              isActive: true,
              sportType: room.sport as SportType,
              primaryPosition: p1[0] || 'NONE',
              primaryPositions: p1,
              secondaryPosition: s1[0] || 'NONE',
              secondaryPositions: s1,
              tertiaryPositions: t1,
              forbiddenPositions: f1
            });
          }
        });
        return newList;
      });
    } catch (e) {
      console.error("Approve All Error:", e);
    }
  };

  const handleShareRecruitLink = async (room: RecruitmentRoom) => {
    // 실제 배포된 도메인 주소
    const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
    // 항상 운영 주소를 사용하도록 고정
    const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${room.id}&lang=${lang}`;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: t('shareRecruitLink'),
            text: `[${room.title}] ${room.matchDate} ${room.matchTime} ${t(room.sport.toLowerCase() as any)} 참여자를 모집합니다!\n\n👇 참가하기 👇\n${webUrl}`,
            dialogTitle: t('shareRecruitLink'),
          });
        } catch (shareError) {
          await Clipboard.write({ string: webUrl });
        }
      } else {
        await Clipboard.write({ string: webUrl });
      }
    } catch (e) {
      console.error("Share Link Error:", e);
    }
  };

  const handleCloseRecruitRoom = (room: RecruitmentRoom) => {
    setConfirmState({
      isOpen: true,
      title: t('deleteRoomTitle' as any), // 번역 키 필요
      message: t('confirm_delete_room' as any),
      confirmText: t('delete' as any),
      onConfirm: async () => {
        try {
          setShowHostRoomModal(false); // 강제로 모달 닫기
          await updateDoc(doc(db, 'rooms', room.id), { status: 'DELETED' });
          setActiveRooms(prev => prev.filter(r => r.id !== room.id));
          setCurrentActiveRoom(null);
        } catch (e) {
          console.error("Delete Room Error:", e);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleGenerate = async () => {
    const participating = players.filter(p => p.isActive && p.sportType === activeTab);
    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    // 포지션 인원 설정이 하나라도 있는지 확인 (있으면 고급 기능 사용)
    const isAdvanced = Object.values(quotas).some(v => v !== null);

    // 항목 4: 포지션 인원 설정 유료 제한 삭제 (X)

    setIsGenerating(true);
    // 광고 제거 전은 1.5초(연출), 광고 제거 후는 0.5초(빠름)
    const waitTime = isAdFree ? 500 : 1500;
    setCountdown(isAdFree ? 1 : 5);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);

          // 전체 생성 횟수 기록
          const nextTotal = totalGenCount + 1;
          setTotalGenCount(nextTotal);
          localStorage.setItem('app_total_gen_count', nextTotal.toString());

          // 포지션 사용 횟수 기록 (10회 이후부터 카운트)
          if (isAdvanced && !isUnlimitedPos && nextTotal > 10) {
            setPositionUsage(prevUsage => {
              const next = { ...prevUsage, count: prevUsage.count + 1 };
              localStorage.setItem('app_position_usage', JSON.stringify(next));
              return next;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 밸런스 생성 시 제약 조건 포함 (activeTab에 해당하는 제약만 필터링)
    const activeConstraints = teamConstraints.filter(c => {
      const p = players.find(p => c.playerIds.includes(p.id)); // Check if any player in constraint belongs to activeTab
      return p && p.sportType === activeTab;
    });



    setTimeout(() => {
      const res = generateBalancedTeams(participating, teamCount, quotas, activeConstraints, useRandomMix, Array.from(pastResults));

      setResult(res);

      // 개별 팀 해시 저장 (중복 방지용)
      setPastResults(prev => {
        const next = new Set(prev);
        res.teams.forEach(t => {
          const teamHash = t.players.map(p => p.id).sort().join(',');
          next.add(teamHash);
        });
        return next;
      });

      // 팀 색상 할당
      if (useTeamColors) {
        res.teams.forEach((team, idx) => {
          const colorValue = selectedTeamColors[idx] || TEAM_COLORS[idx % TEAM_COLORS.length].value;
          const colorObj = TEAM_COLORS.find(c => c.value === colorValue);
          team.color = colorValue;
          team.colorName = colorObj?.name || 'color_gray';
        });
      }

      setResult(res);
      setIsGenerating(false);
      setShowQuotaSettings(false);

      // 제약 조건 준수 여부 및 실력 차이 알림
      if (!res.isValid) {
        if (res.isConstraintViolated) {
          showAlert(t('validationErrorConstraint'));
        } else if (res.isQuotaViolated) {
          showAlert(t('validationErrorQuota'));
        }
      } else if (res.maxDiff && res.maxDiff > 10) {
        // 실력 격차가 10점(필터링 기준) 이상인 경우 하드 제약 준수로 인한 밸런스 붕괴 경고
        showAlert(t('balanceWarning', res.maxDiff));
      }

      // 팀 생성 횟수 기반 리뷰 유도 (10회 이상)
      const genCount = parseInt(localStorage.getItem('app_gen_count') || '0', 10) + 1;
      localStorage.setItem('app_gen_count', genCount.toString());

      if (genCount >= 10) {
        const cooldown = localStorage.getItem('app_review_cooldown');
        if (cooldown !== 'DONE') {
          const now = new Date();
          if (!cooldown || now > new Date(cooldown)) {
            setTimeout(() => setShowReviewPrompt(true), 2000);
          }
        }
      }

      setTimeout(() => {
        document.getElementById('results-capture-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      AnalyticsService.logEvent('generate_teams', {
        sport: activeTab,
        player_count: participating.length,
        team_count: teamCount
      });
    }, waitTime);
  };

  const handleShare = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsSharing(elementId);

    const rect = element.getBoundingClientRect();

    try {
      const bgColor = darkMode ? '#020617' : '#fdfcf9';

      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: bgColor,
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
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
                            * {
                              transition: none !important;
                            animation: none !important;
                            -webkit-print-color-adjust: exact;
                            font-family: ${lang === 'ja' ? '"Pretendard JP Variable", "Pretendard JP"' : '"Pretendard Variable", Pretendard'}, sans-serif !important;
            }
                            .truncate {
                              overflow: visible !important;
                            white-space: normal !important;
                            text-overflow: clip !important; 
            }
                            .overflow-hidden {
                              overflow: visible !important; 
            }
                            span, p, h1, h2, h3, h4 {
                              -webkit - print - color - adjust: exact;
                            font-family: inherit !important;
            }
                            .animate-in {opacity: 1 !important; transform: none !important; animation: none !important; visibility: visible !important; }
                            [data-capture-ignore] {display: none !important; visibility: hidden !important; }
                            .bg-slate-950 {background - color: #020617 !important; }
                            .bg-\\[\\#fdfcf9\\] {background - color: #fdfcf9 !important; }
                            .flex {display: flex !important; }
                            .items-center {align - items: center !important; }
                            .justify-between {justify - content: space-between !important; }
                            .flex-col {flex - direction: column !important; }
                            .text-sm {font - size: 14px !important; }
                            .font-semibold {font - weight: 600 !important; }
                            `;
          clonedDoc.head.appendChild(style);

          clonedElement.style.opacity = '1';
          clonedElement.style.transform = 'none';

          // 홍보 푸터 강제 노출
          const promoFooter = clonedElement.querySelector('[data-promo-footer]');
          if (promoFooter) {
            (promoFooter as HTMLElement).style.display = 'flex';
          }
        }
      });

      // Capacitor 플랫폼에서 네이티브 공유 사용
      if (Capacitor.isNativePlatform()) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          try {
            // Blob을 Base64로 변환
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1]; // data:image/png;base64, 부분 제거

              try {
                // 파일 시스템에 임시 저장
                const savedFile = await Filesystem.writeFile({
                  path: `${fileName}_${Date.now()}.png`,
                  data: base64data,
                  directory: Directory.Cache
                });

                // 저장된 파일의 URI를 사용하여 공유 (이미지만 전송하여 호환성 확보)
                await Share.share({
                  files: [savedFile.uri],
                  dialogTitle: t('shareDialogTitle')
                });

                // 공유 성공 후 리뷰 유도 로직 (쿨다운 확인)
                const cooldown = localStorage.getItem('app_review_cooldown');
                if (cooldown !== 'DONE') {
                  const now = new Date();
                  if (!cooldown || now > new Date(cooldown)) {
                    setTimeout(() => setShowReviewPrompt(true), 1500);
                  }
                }
              } catch (err) {
                console.error('Share failed:', err);
                // 실패 시 다운로드로 fallback
                downloadImage(blob, fileName);
              }
              logShareEvent('native_share');
            };
            reader.readAsDataURL(blob);
          } catch (err) {
            console.error('File system error:', err);
            downloadImage(blob, fileName);
          }
        }, 'image/png');
      } else {
        // 웹 브라우저에서는 기존 Web Share API 또는 다운로드 사용
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: t('shareTitle')
            }).then(() => {
              // 웹에서도 공유 성공 시 리뷰 유도 시도
              const cooldown = localStorage.getItem('app_review_cooldown');
              if (cooldown !== 'DONE') {
                const now = new Date();
                if (!cooldown || now > new Date(cooldown)) {
                  setTimeout(() => setShowReviewPrompt(true), 1500);
                }
              }
            });
          } else {
            downloadImage(blob, fileName);
          }
          logShareEvent('web_share');
        }, 'image/png');
      }
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsSharing(null);
    }
  };

  // 다운로드 헬퍼 함수
  const downloadImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const logShareEvent = (type: string) => {
    AnalyticsService.logEvent('share_result', { type });
  };


  const currentPlayers = players.filter(p => p.sportType === activeTab);

  const getInactiveSortedPlayers = () => {
    const inactive = currentPlayers.filter(p => !p.isActive);
    if (sortMode === 'name') {
      return inactive.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return inactive.sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  };

  const activePlayers = currentPlayers.filter(p => p.isActive).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const inactivePlayers = getInactiveSortedPlayers();

  const getSortedTeamPlayers = (teamPlayers: Player[]) => {
    if (activeTab === SportType.GENERAL) return teamPlayers;
    const priority: any = activeTab === SportType.SOCCER
      ? { GK: 1, DF: 2, MF: 3, FW: 4, NONE: 5 }
      : activeTab === SportType.FUTSAL
        ? { GK: 1, FIX: 2, ALA: 3, PIV: 4, NONE: 5 }
        : { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, NONE: 6 };
    return [...teamPlayers].sort((a, b) => (priority[a.assignedPosition || 'NONE'] || 99) - (priority[b.assignedPosition || 'NONE'] || 99));
  };

  const updateQuota = (pos: Position, delta: number) => {
    setQuotas(prev => {
      const current = typeof prev[pos] === 'number' ? (prev[pos] as number) : 0;
      const next = { ...prev, [pos]: Math.max(0, current + delta) };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleQuotaMode = (pos: Position) => {
    setQuotas(prev => {
      const next = {
        ...prev,
        [pos]: typeof prev[pos] === 'number' ? null : 1
      };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const currentQuotaTotal = Object.values(quotas).reduce<number>((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
  const handleUpdateResultTeamColor = (idx: number, colorValue: string, colorName: string) => {
    if (!result) return;
    const nextResult = { ...result };
    const nextTeams = [...nextResult.teams];
    nextTeams[idx] = { ...nextTeams[idx], color: colorValue, colorName: colorName };
    nextResult.teams = nextTeams;
    setResult(nextResult);
    setEditingResultTeamIdx(null);
  };

  const expectedPerTeam = activePlayers.length > 0 ? Math.floor(activePlayers.length / teamCount) : 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))'
      }}>
      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isPro={isPro} />}

      <header className="w-full flex flex-col items-center mb-0">
        <div className="w-full flex justify-between items-center mb-1 bg-white dark:bg-slate-950 p-1.5">
          <div className="flex gap-2">
            {/* 광고 제거 버튼 주석 처리
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 group relative ${isPro
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30'}`}
            >
              <div className="relative">
                <span className={`text-sm block transition-transform group-active:scale-90 ${isPro ? 'animate-pulse' : ''}`}>
                  {isPro ? '✨' : '💎'}
                </span>
                {!isPro && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white dark:border-slate-950" />
                )}
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">
                {isPro ? 'PRO' : t('removeAds' as any)}
              </span>
            </button>
            */}
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <LanguageMenu
              lang={lang}
              onLangChange={handleManualLangChange}
              t={t}
            />
            <button
              onClick={() => setShowGuideModal(true)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Show app Help"
            >
              <HelpCircleIcon />
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Show app Info"
            >
              <InfoIcon />
            </button>
          </div>
        </div>
        <div
          className="flex justify-center w-full px-4 mb-2"
        >
          <img src="/images/title_banner.png" alt="Team Mate" className="w-full max-w-[320px] object-contain rounded-2xl" />
        </div>
      </header>

      <nav className="flex gap-1.5 bg-white dark:bg-slate-950 p-1.5 mb-3 w-full">
        {(Object.entries(SportType) as [string, SportType][]).map(([key, value]) => (
          <button key={value} onClick={() => {
            setActiveTab(value);
            setResult(null);
            setEditingPlayerId(null);
            AnalyticsService.logEvent('tab_change', { sport: value });
          }} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === value ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
            {t(value.toLowerCase() as any)}
          </button>
        ))}
      </nav>

      <section className="w-full px-4 mb-3" data-capture-ignore="true">
        <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('recruitParticipants')}</h3>
          {filteredRooms.length === 0 && (
            <button
              onClick={() => { setCurrentActiveRoom(null); setShowHostRoomModal(true); }}
              className="text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
            >
              <PlusIcon /> {t('createRecruitRoom')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(() => {
            if (filteredRooms.length === 0) return null;

            // 가장 최신 방 하나만 노출
            const room = filteredRooms[0];
            const pendingApplicants = room.applicants.filter(a => !a.isApproved);

            return (
              <div key={room.id} className="space-y-2">
                <div
                  className={`w-full rounded-2xl py-2.5 px-4 shadow-md border transition-all text-left flex items-center justify-between ${currentActiveRoom?.id === room.id ? 'bg-blue-600 border-blue-500 shadow-blue-500/20 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'}`}
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden flex-1 mr-3">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${currentActiveRoom?.id === room.id ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>{room.title}</p>
                    <p className="text-sm font-black truncate">{room.matchDate} {room.matchTime}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-lg font-black leading-none">
                        {players.filter(p => p.isActive && p.sportType === room.sport).length}명
                      </span>
                      <span className="text-[9px] font-bold opacity-60">
                        / {room.maxApplicants > 0 ? `${room.maxApplicants}${t('peopleSuffix')}` : t('unlimited')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 통합 관리 관리 UI */}
                <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  {pendingApplicants.length > 0 ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <div className="w-1 h-3 bg-blue-600 rounded-full" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('pendingApplicants' as any)} ({pendingApplicants.length})</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {pendingApplicants.map(app => {
                          // 티어 값/라벨 정규화
                          const tierVal = isNaN(Number(app.tier)) ? (Tier as any)[app.tier] : Number(app.tier);
                          const tierLabel = isNaN(Number(app.tier)) ? app.tier : (Tier as any)[Number(app.tier)];

                          return (
                            <div key={app.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                              <div className="flex flex-col gap-1 justify-center pt-0.5 w-full">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]} pt-1`}>
                                    {tierLabel}
                                  </span>
                                  <span className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate">{app.name}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 opacity-95">
                                  {room.sport !== SportType.GENERAL && (
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                      {((app as any).primaryPositions?.length || (app.position ? 1 : 0)) > 0 && (
                                        <div className="flex items-center gap-1 text-[8px] font-semibold text-emerald-600 dark:text-emerald-400">
                                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          <span>{((app as any).primaryPositions || [app.position]).join(',')}</span>
                                        </div>
                                      )}
                                      {((app as any).secondaryPositions?.length > 0) && (
                                        <div className="flex items-center gap-1 text-[8px] font-extrabold text-yellow-600 dark:text-yellow-400">
                                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                          <span>{(app as any).secondaryPositions.join(',')}</span>
                                        </div>
                                      )}
                                      {((app as any).tertiaryPositions?.length > 0) && (
                                        <div className="flex items-center gap-1 text-[8px] font-semibold text-orange-500 dark:text-orange-400">
                                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                          <span>{(app as any).tertiaryPositions.join(',')}</span>
                                        </div>
                                      )}
                                      {((app as any).forbiddenPositions?.length > 0) && (
                                        <div className="flex items-center gap-1 text-[8px] font-semibold text-rose-500 dark:text-rose-400">
                                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                          <span>{(app as any).forbiddenPositions.join(',')}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <button onClick={() => cancelApplication(room.id, app)} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><TrashIcon /></button>
                                <button onClick={() => handleApproveApplicant(room, app)} className="bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg active:scale-95 transition-all w-max whitespace-nowrap">{t('approve' as any)}</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex grid grid-cols-3 gap-px bg-slate-100 dark:bg-slate-800">
                    <button onClick={() => handleShareRecruitLink(room)} className="bg-white dark:bg-slate-950 py-0.5 text-[8px] font-black text-slate-600 dark:text-slate-400 flex flex-col items-center gap-0 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                      <div className="scale-75 h-3 flex items-center justify-center"><ShareIcon /></div>
                      {t('shareRecruitLink' as any)}
                    </button>
                    <button
                      onClick={() => handleApproveAllApplicants(room)}
                      disabled={pendingApplicants.length === 0}
                      className={`bg-white dark:bg-slate-950 py-0.5 text-[8px] font-black flex flex-col items-center gap-0 transition-all ${pendingApplicants.length > 0 ? 'text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900' : 'text-slate-300 dark:text-slate-700 opacity-50'}`}
                    >
                      <div className="scale-75 h-3 flex items-center justify-center"><UserCheckIcon /></div>
                      {t('approveAll' as any)}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleCloseRecruitRoom(room); }} className="bg-white dark:bg-slate-950 py-0.5 text-[8px] font-black text-slate-600 dark:text-slate-400 flex flex-col items-center gap-0 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                      <div className="scale-75 h-3 flex items-center justify-center"><TrashIcon /></div>
                      {t('delete_recruit_room' as any)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      <main className="w-full space-y-3">
        <section className="bg-slate-50 dark:bg-slate-900 w-full relative">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none"
            onClick={() => setIsPlayerRegistrationOpen(!isPlayerRegistrationOpen)}
          >
            <div className="flex items-center gap-2">
              <div className="text-slate-400 dark:text-slate-500"><PlusIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
              <div className={`transition-transform duration-300 ${isPlayerRegistrationOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
          </div>
          {isPlayerRegistrationOpen && (
            <form onSubmit={addPlayer} className="px-6 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
                <input type="text" placeholder={t('playerNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-white dark:bg-slate-950 rounded-xl px-4 py-3 focus:outline-none transition-all text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('skillTier')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                    <button key={key} type="button" onClick={e => { e.preventDefault(); setNewTier(val); }} className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${newTier === val ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500'}`}>
                      {key}
                    </button>
                  ))}
                </div>
              </div>
              {activeTab !== SportType.GENERAL && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowNewPlayerFormation(!showNewPlayerFormation)}
                    className={`w-full h-12 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${showNewPlayerFormation
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95'
                      : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'
                      }`}
                  >
                    <EditIcon /> {t('visualPositionEditor')}
                  </button>
                  {showNewPlayerFormation && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <FormationPicker
                        sport={activeTab}
                        primaryP={newP1s}
                        secondaryP={newP2s}
                        tertiaryP={newP3s}
                        forbiddenP={newForbidden}
                        lang={lang}
                        onChange={(p, s, t, f) => { setNewP1s(p); setNewP2s(s); setNewP3s(t); setNewForbidden(f); }}
                      />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
          <section className="bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden w-full">
            <div
              className="p-4 border-b border-transparent flex justify-between items-center bg-transparent cursor-pointer select-none"
              onClick={() => setIsWaitingListOpen(!isWaitingListOpen)}
            >
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('memberList' as any)} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({inactivePlayers.length})</span></h2>
                <div className={`transition-transform duration-300 ${isWaitingListOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <div className="flex bg-slate-50 dark:bg-slate-950 p-0.5 rounded-lg border border-transparent">
                  <button onClick={() => setSortMode('name')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${sortMode === 'name' ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-400 hover:text-slate-900 dark:bg-transparent dark:hover:text-slate-300'}`}>
                    {t('sortByName')}
                  </button>
                  <button onClick={() => setSortMode('tier')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${sortMode === 'tier' ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-400 hover:text-slate-900 dark:bg-transparent dark:hover:text-slate-300'}`}>
                    {t('sortByTier')}
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (selectAllConfirm) {
                      setPlayers(prev => prev.map(p => p.sportType === activeTab ? { ...p, isActive: true } : p));
                      setSelectAllConfirm(false);
                    } else {
                      setSelectAllConfirm(true);
                      setTimeout(() => setSelectAllConfirm(false), 3000);
                    }
                  }}
                  className={`bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white px-2 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 ${selectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                >
                  {selectAllConfirm ? <><CheckIcon /> {t('confirmRetry' as any)}</> : t('selectAll')}
                </button>
              </div>
            </div>
            {isWaitingListOpen && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[120px] animate-in slide-in-from-top-2 duration-200">
                {inactivePlayers.length === 0 ? (<div className="col-span-full py-10 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>) :
                  inactivePlayers.map(p => (
                    <PlayerItem
                      key={p.id}
                      player={p}
                      isEditing={editingPlayerId === p.id}
                      lang={lang}
                      onToggle={toggleParticipation}
                      onEditToggle={setEditingPlayerId}
                      onUpdate={updatePlayer}
                      onRemove={removePlayerFromSystem}
                      isSelectionMode={!!selectionMode}
                      isSelected={selectedPlayerIds.includes(p.id)}
                      onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      showTier={showTier}
                    />
                  ))
                }
              </div>
            )}
          </section>
          <section id="participation-capture-section" className="bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden w-full h-fit">
            <div
              className="p-4 border-b border-transparent flex justify-between items-center bg-transparent cursor-pointer select-none"
              onClick={() => setIsParticipatingListOpen(!isParticipatingListOpen)}
            >
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserCheckIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('participantList' as any)} <span className="text-slate-900 dark:text-slate-100 font-normal ml-1">({activePlayers.length})</span></h2>
                <div className={`transition-transform duration-300 ${isParticipatingListOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="flex items-center gap-2" data-capture-ignore="true" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleShare('participation-capture-section', 'participating-list')}
                  disabled={!!isSharing}
                  className={`bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold px-2 py-1 rounded-md text-[10px] flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all active:scale-95 ${isSharing === 'participation-capture-section' ? 'opacity-50' : ''}`}
                >
                  {isSharing === 'participation-capture-section' ? t('generatingImage') : <><ShareIcon /> {t('shareList')}</>}
                </button>
                <button
                  onClick={() => {
                    if (unselectAllConfirm) {
                      setPlayers(prev => prev.map(p => p.sportType === activeTab ? { ...p, isActive: false } : p));
                      setUnselectAllConfirm(false);
                    } else {
                      setUnselectAllConfirm(true);
                      setTimeout(() => setUnselectAllConfirm(false), 3000);
                    }
                  }}
                  className={`bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white px-2 py-1 rounded-md text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1 ${unselectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                >
                  {unselectAllConfirm ? <><CheckIcon /> {t('confirmRetry' as any)}</> : t('unselectAll')}
                </button>
              </div>
            </div>
            {isParticipatingListOpen && (
              <div className="animate-in slide-in-from-top-2 duration-200">

                {/* 팀 묶기 / 나누기 버튼 추가 구역 */}
                {/* 팀 묶기 / 나누기 / 티어 토글 버튼 추가 구역 */}
                <div className="px-4 pb-2 flex gap-1.5" data-capture-ignore="true">
                  <button
                    onClick={() => {
                      setPendingJoinRoomId(null);
                      setShowHostRoomModal(true);
                    }}
                    className={`py-1.5 px-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 group shadow-lg ${currentActiveRoom
                      ? 'bg-blue-600 text-white shadow-blue-900/20'
                      : 'bg-blue-600 text-white shadow-blue-900/20 ring-1 ring-blue-400/30'
                      }`}
                  >
                    <div className="relative">
                      <UserPlusIcon />
                      {players.filter(p => p.isActive && p.sportType === activeTab).length > 0 && (
                        <div className="absolute -top-1.5 -right-1.5">
                          <RecruitmentStatusBadge count={players.filter(p => p.isActive && p.sportType === activeTab).length} darkMode={darkMode} />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 티어 숨기기/보이기 토글 (텍스트로 변경) */}
                  <button
                    onClick={() => setShowTier(!showTier)}
                    className={`px-3 py-1.5 rounded-xl border transition-all flex items-center justify-center text-[11px] font-black ${showTier ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'}`}
                  >
                    {showTier ? t('hideTier' as any) : t('showTier' as any)}
                  </button>

                  <button
                    onClick={() => { setSelectionMode('MATCH'); setSelectedPlayerIds([]); }}
                    className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-1.5 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
                  >
                    <div className="w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">M</div>
                    {t('matchTeams' as any)}
                  </button>
                  <button
                    onClick={() => { setSelectionMode('SPLIT'); setSelectedPlayerIds([]); }}
                    className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-1.5 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
                  >
                    <div className="w-4 h-4 rounded bg-rose-500 text-white flex items-center justify-center text-[8px] font-black">S</div>
                    {t('splitTeams' as any)}
                  </button>
                </div>

                {/* 설정된 제약 조건 리스트 표시 */}
                {teamConstraints.filter(c => {
                  const p = players.find(p => c.playerIds.includes(p.id));
                  return p && p.sportType === activeTab;
                }).length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-3 bg-slate-400 dark:bg-slate-600 rounded-full" />
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('activeConstraintsTitle' as any)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {teamConstraints.filter(c => {
                          const p = players.find(p => c.playerIds.includes(p.id));
                          return p && p.sportType === activeTab;
                        }).map(c => (
                          <div key={c.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm animate-in fade-in zoom-in-95">
                            <div className={`w-2 h-2 rounded-full ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {c.playerIds.map(id => players.find(p => p.id === id)?.name || id).join(', ')}
                            </span>
                            <button
                              onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                              className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[120px]">
                  {activePlayers.length === 0 ? (<div className="col-span-full py-10 opacity-40 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('selectParticipating')}</div>) :
                    activePlayers.map(p => (
                      <PlayerItem
                        key={p.id}
                        player={p}
                        isEditing={editingPlayerId === p.id}
                        lang={lang}
                        onToggle={toggleParticipation}
                        onEditToggle={setEditingPlayerId}
                        onUpdate={updatePlayer}
                        onRemove={removePlayerFromSystem}
                        isSelectionMode={!!selectionMode}
                        isSelected={selectedPlayerIds.includes(p.id)}
                        onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        showTier={showTier}
                      />
                    ))
                  }
                </div>
                <div className="hidden px-4 pb-6" data-promo-footer="true">
                  <PromotionFooter lang={lang} darkMode={darkMode} />
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="bg-slate-50 dark:bg-slate-900 p-6 flex flex-col items-center w-full gap-4">
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-slate-900 dark:text-white">
              <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-200 flex items-center justify-center text-white dark:text-slate-900"><ShuffleIcon /></div>
              <div>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-[0.2em] mb-0.5">{t('teamGenerator')}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(activeTab.toLowerCase() as any)} • {t('playersParticipating', activePlayers.length)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {activeTab !== SportType.GENERAL && (
                <button
                  onClick={() => setShowQuotaSettings(!showQuotaSettings)}
                  className={`w-full flex items-center justify-center gap-2 h-10 rounded-2xl transition-all font-semibold text-xs ${showQuotaSettings
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-950 text-slate-100 hover:bg-black dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white'}`}
                >
                  <SlidersIcon /> {t('positionSettings')}
                </button>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 bg-slate-950 dark:bg-slate-100 h-10 px-4 rounded-2xl border border-transparent flex-1 md:none overflow-hidden transition-all group">
                  <span className="text-xs font-semibold text-slate-100 dark:text-slate-950 uppercase whitespace-nowrap">{t('teamCountLabel')}</span>
                  <select
                    value={teamCount}
                    onChange={e => setTeamCount(Number(e.target.value))}
                    className="bg-transparent text-slate-100 dark:text-slate-950 font-semibold text-xs focus:outline-none cursor-pointer flex-1 appearance-none text-center outline-none border-none py-0 marker:hidden"
                    style={{ backgroundColor: 'transparent', WebkitAppearance: 'none', appearance: 'none' }}
                  >
                    {[2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 uppercase font-semibold">
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleGenerate} disabled={activePlayers.length < teamCount || isGenerating} className="px-6 h-10 bg-slate-950 text-slate-100 dark:bg-slate-100 dark:text-slate-950 font-semibold rounded-2xl transition-all active:scale-[0.98] text-xs whitespace-nowrap flex-1 md:none disabled:opacity-50 hover:bg-black dark:hover:bg-white">
                  {t('generateTeams')}
                </button>
              </div>

              {/* 팀 색상 지정 섹션 */}
              <div className="w-full mt-2">
                <div className="flex items-center justify-between mb-3 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${useTeamColors ? 'bg-slate-900 border-slate-900 dark:bg-slate-200 dark:border-slate-200 text-white dark:text-slate-900 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                      {useTeamColors && <CheckIcon />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={useTeamColors}
                      onChange={e => {
                        const checked = e.target.checked;
                        setUseTeamColors(checked);
                        if (checked) setShowColorPicker(true);
                      }}
                    />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors uppercase tracking-wider">{t('useTeamColorsLabel')}</span>
                  </label>

                  {/* 무작위 섞기 추가 */}
                  <label className="flex items-center gap-2 cursor-pointer group ml-auto mr-4">
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                      {useRandomMix && <CheckIcon />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={useRandomMix}
                      onChange={e => setUseRandomMix(e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors uppercase tracking-wider">{t('randomMix')}</span>
                  </label>

                  {/* 창이 닫혀있을 때의 요약 UI */}
                  {useTeamColors && !showColorPicker && (
                    <div
                      onClick={() => setShowColorPicker(true)}
                      className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                    >
                      {selectedTeamColors.map((color, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-700" style={{ backgroundColor: color }} />
                      ))}
                      <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">EDIT</span>
                    </div>
                  )}
                </div>

                {useTeamColors && showColorPicker && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from({ length: teamCount }).map((_, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 rounded-2xl bg-white dark:bg-slate-950 shadow-sm border border-slate-100/50 dark:border-slate-800/50 transition-all">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-0.5">TEAM {idx + 1}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {TEAM_COLORS.map(color => (
                              <button
                                key={color.value}
                                onClick={() => {
                                  const next = [...selectedTeamColors];
                                  next[idx] = color.value;
                                  setSelectedTeamColors(next);
                                }}
                                className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${selectedTeamColors[idx] === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                                style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                title={t(color.name as any)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowColorPicker(false)}
                      className="w-full h-11 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                    >
                      {t('apply')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {
            showQuotaSettings && activeTab !== SportType.GENERAL && (
              <div className={`w-full pt-4 border-t ${darkMode ? 'border-white/5' : 'border-white/20'} animate-in`}>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('quotaSettingsTitle')}</h3>
                  <div className={`px-2 py-1 rounded text-[10px] font-semibold ${currentQuotaTotal === expectedPerTeam
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                    {t('fixedPlayersStatus', currentQuotaTotal, expectedPerTeam)}
                  </div>
                </div>
                <QuotaFormationPicker
                  sport={activeTab}
                  quotas={quotas}
                  lang={lang}
                  onUpdate={updateQuota}
                  onToggleMode={toggleQuotaMode}
                  darkMode={darkMode}
                />
                <p className="mt-4 text-[9px] text-slate-400 italic text-center opacity-70">{t('quotaInfoMsg')}</p>
              </div>
            )
          }
        </section >

        {result && (
          <div id="results-capture-section" className="space-y-3 pt-3 animate-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
              <div data-capture-ignore="true" className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="bg-slate-950 dark:bg-slate-100 text-slate-100 dark:text-slate-950 font-black px-3 py-1 rounded-md text-[10px] flex items-center gap-1 hover:bg-slate-800 dark:hover:bg-white transition-all"
                >
                  ← {t('backToRoster')}
                </button>
                <button
                  onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                  disabled={!!isSharing}
                  className={`bg-slate-950 dark:bg-slate-100 text-slate-100 dark:text-slate-950 font-black px-2 py-1 rounded-md text-[10px] flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all ${isSharing ? 'opacity-50' : ''}`}
                >
                  {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
                </button>
              </div>
            </div>

            <div className={`backdrop-blur-sm ${darkMode ? 'bg-slate-900/80 text-slate-100' : 'bg-slate-100/80 text-slate-900'} rounded-2xl p-3 px-5 flex flex-wrap items-center justify-between gap-y-3 gap-x-4 max-w-lg mx-auto w-full`}>
              <div className="flex flex-col">
                <span className={`text-[8px] font-semibold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('standardDeviation')}</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold font-mono ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{result.standardDeviation.toFixed(2)}</span>
                  <span className={`text-[8px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>({t('lowerFairer')})</span>
                </div>
              </div>
              {/* DEBUG INFO - 페널티 합계 표시 (일반 탭이 아닐 때만) */}
              {activeTab !== SportType.GENERAL && (
                <div className="flex flex-col items-center">
                  <span className={`text-[8px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('penaltyScore' as any)}</span>
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
                    <span className={`text-[7px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-0.5 whitespace-nowrap`}>({t('penaltyScoreDesc' as any)})</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.teams.map((team, idx) => (
                <div key={team.id} className="bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] flex flex-col h-full hover:border-transparent transition-all overflow-hidden">
                  <div className="bg-white dark:bg-slate-950 px-5 py-4 flex flex-col gap-3" style={{ borderTop: team.color ? `4px solid ${team.color}` : 'none' }}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm pt-0.5 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all relative group"
                          style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                          onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                          data-capture-ignore="true"
                        >
                          {idx + 1}
                          <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditIcon />
                          </div>
                        </div>
                        {/* 캡처용 (보이는 것과 동일하지만 클릭 불가) */}
                        <div
                          className="hidden w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm pt-0.5 shadow-sm"
                          style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                          data-capture-only="true"
                        >
                          {idx + 1}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-0.5">
                          {team.colorName ? t('teamNameWithColor', t(team.colorName as any)) : `TEAM ${String.fromCharCode(65 + idx)}`}
                        </h4>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                        <span className="block text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5 pt-0.5">{t('squadSum')}</span>
                        <span className="text-xl font-semibold font-mono text-slate-900 dark:text-slate-100">{team.totalSkill}</span>
                      </div>
                    </div>

                    {/* 결과용 색상 피커 */}
                    {editingResultTeamIdx === idx && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200" data-capture-ignore="true">
                        {TEAM_COLORS.map(color => (
                          <button
                            key={color.value}
                            onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                            className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${team.color === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                            style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                            title={t(color.name as any)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 flex-1 space-y-2">
                    {getSortedTeamPlayers(team.players).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-950 hover:border-transparent transition-all">
                        <div className="flex flex-col gap-1 justify-center pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{p.name}</span>
                            {showTier && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TIER_COLORS[p.tier]} pt-1`}>
                                {Tier[p.tier]}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 opacity-95">
                            {activeTab !== SportType.GENERAL && p.assignedPosition && p.assignedPosition !== 'NONE' && (
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md pt-0.5 inline-flex items-center justify-center">{p.assignedPosition}</span>
                            )}
                            {activeTab !== SportType.GENERAL && (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {(p.primaryPositions?.length || (p.primaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{(p.primaryPositions || [p.primaryPosition]).join(',')}</span>
                                  </div>
                                )}
                                {(p.secondaryPositions?.length || (p.secondaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-yellow-600 dark:text-yellow-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                    <span>{(p.secondaryPositions || [p.secondaryPosition]).join(',')}</span>
                                  </div>
                                )}
                                {(p.tertiaryPositions?.length || (p.tertiaryPosition && p.tertiaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-orange-500 dark:text-orange-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    <span>{(p.tertiaryPositions || [p.tertiaryPosition!]).join(',')}</span>
                                  </div>
                                )}
                                {p.forbiddenPositions && p.forbiddenPositions.length > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-rose-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>{p.forbiddenPositions.join(',')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* DEBUG SCORE - 테스트용 점수 표시 (일반 탭이 아닐 때만)
                        {activeTab !== SportType.GENERAL && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                              {(() => {
                                const assigned = p.assignedPosition || 'NONE';
                                const isP1 = (p.primaryPositions || []).includes(assigned) || p.primaryPosition === assigned;
                                const isP2 = (p.secondaryPositions || []).includes(assigned) || p.secondaryPosition === assigned;
                                const isP3 = (p.tertiaryPositions || []).includes(assigned) || p.tertiaryPosition === assigned;
                                const penalty = isP1 ? 0 : (isP2 ? 0.5 : (isP3 ? 1.0 : 2.0));
                                return `${p.tier} - ${penalty} = ${(p.tier - penalty).toFixed(1)}`;
                              })()}
                            </span>
                          </div>
                        )}
                        */}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden px-2 pt-2" data-promo-footer="true">
              <PromotionFooter lang={lang} darkMode={darkMode} />
            </div>
          </div>
        )}
      </main >


      {/* 선택 모드 하단 제어 바 */}
      {selectionMode && (
        <div
          className="fixed left-0 right-0 z-[1001] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 animate-in slide-in-from-bottom duration-300"
          style={{
            bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: '1rem'
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t('selectionModeActive' as any)}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">({selectedPlayerIds.length})</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{t('constraintDescription' as any)}</p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={selectedPlayerIds.length < 2}
                onClick={() => {
                  const newConstraint: TeamConstraint = {
                    id: Math.random().toString(36).substr(2, 9),
                    playerIds: selectedPlayerIds,
                    type: selectionMode
                  };
                  setTeamConstraints(prev => [...prev, newConstraint]);
                  setSelectionMode(null);
                }}
                className={`flex-1 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all ${selectedPlayerIds.length >= 2 ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}
              >
                {t('apply' as any)}
              </button>
              <button
                onClick={() => setSelectionMode(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all"
              >
                {t('cancel' as any)}
              </button>
            </div>
          </div>
        </div>
      )}


      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onUpgradeRequest={() => { setShowInfoModal(false); setShowUpgradeModal(true); }}
        onLogin={() => { setShowInfoModal(false); setShowLoginModal(true); }}
        onLogout={handleLogout}
        nickname={userNickname}
        onUpdateNickname={(name) => {
          setUserNickname(name);
          localStorage.setItem('app_user_nickname', name);
        }}
        onRestore={handleRestorePurchases}
        lang={lang}
        darkMode={darkMode}
        isAdFree={isAdFree}
        isUnlimitedPos={isUnlimitedPos}
        user={user}
        showAlert={showAlert}
      />
      <ReviewPrompt isOpen={showReviewPrompt} onLater={handleReviewLater} onRate={handleRateApp} lang={lang} darkMode={darkMode} />
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => setAlertState({ ...alertState, isOpen: false })}
        lang={lang}
        darkMode={darkMode}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        lang={lang}
        darkMode={darkMode}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
      />
      <LoginModal
        isOpen={showLoginModal}
        onLater={handleLoginLater}
        onLogin={handleGoogleLogin}
        lang={lang}
        darkMode={darkMode}
      />
      <PositionLimitModal
        isOpen={showLimitModal}
        onWatchAd={handleWatchRewardAd}
        onUpgrade={() => { setShowLimitModal(false); setShowUpgradeModal(true); }}
        onClose={() => setShowLimitModal(false)}
        lang={lang}
        darkMode={darkMode}
      />
      <RewardAdModal
        isOpen={showRewardAd}
        onComplete={handleRewardAdComplete}
        onClose={() => setShowRewardAd(false)}
        lang={lang}
        darkMode={darkMode}
      />

      {/* 업그레이드 모달 주석 처리
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgradePro}
        isAdFree={isAdFree}
        isUnlimitedPos={isUnlimitedPos}
        lang={lang}
        darkMode={darkMode}
      />
      */}
      <LoginRecommendModal
        isOpen={showLoginRecommendModal}
        onLogin={() => {
          setShowLoginRecommendModal(false);
          handleGoogleLogin();
        }}
        onLater={() => {
          setShowLoginRecommendModal(false);
          if (pendingUpgradeType) {
            executePurchase(pendingUpgradeType);
          }
        }}
        lang={lang}
        darkMode={darkMode}
      />
      <HostRoomModal
        isOpen={showHostRoomModal}
        onClose={() => setShowHostRoomModal(false)}
        onRoomCreated={(room) => {
          setCurrentActiveRoom(room);
          setActiveRooms(prev => {
            const exists = prev.find(r => r.id === room.id);
            if (exists) return prev.map(r => r.id === room.id ? room : r);
            return [...prev, room];
          });
          setShowHostRoomModal(false);
          AnalyticsService.logEvent('recruit_room_created', { sport: room.sport });
        }}
        activeRoom={currentActiveRoom}
        activeRooms={activeRooms}
        activePlayerCount={players.filter(p => p.isActive && p.sportType === (currentActiveRoom?.sport || activeTab)).length}
        activeTab={activeTab}
        onCloseRoom={() => {
          if (currentActiveRoom) {
            setActiveRooms(prev => prev.filter(r => r.id !== currentActiveRoom.id));
          }
          setCurrentActiveRoom(null);
        }}
        onApproveAll={(approvedPlayers) => {
          setPlayers(prev => {
            const newList = [...prev];
            approvedPlayers.forEach(ap => {
              const existingIdx = newList.findIndex(p => p.name === ap.name);
              if (existingIdx > -1) {
                // 이름이 같은 선수가 있는 경우 최신 신청 정보로 업데이트하고 참가 상태로 만듦
                newList[existingIdx] = {
                  ...newList[existingIdx],
                  tier: ap.tier,
                  sportType: ap.sportType,
                  primaryPosition: ap.primaryPosition,
                  primaryPositions: ap.primaryPositions,
                  secondaryPosition: ap.secondaryPosition,
                  secondaryPositions: ap.secondaryPositions,
                  tertiaryPositions: ap.tertiaryPositions,
                  forbiddenPositions: ap.forbiddenPositions,
                  isActive: true
                };
              } else {
                // 새로운 이름이면 명단에 새로 추가
                newList.push(ap);
              }
            });
            return newList;
          });
        }}
        lang={lang}
        darkMode={darkMode}
        isPro={isPro}
        onUpgrade={() => { setShowHostRoomModal(false); setShowUpgradeModal(true); }}
        userNickname={userNickname}
        currentUserId={currentUserId}
      />
      <ApplyRoomModal
        isOpen={showApplyRoomModal}
        roomId={pendingJoinRoomId}
        onClose={() => {
          setShowApplyRoomModal(false);
          setPendingJoinRoomId(null);
        }}
        onSuccess={() => {
          setShowApplyRoomModal(false);
          setPendingJoinRoomId(null);
          // 팝업 알림 (t 함수 접근 문제 처리 필요시 showAlert 등 활용)
        }}
        lang={lang}
        darkMode={darkMode}
      />
      <GuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        title={t('guideTitle')}
        content={t('guideContent') || t('comingSoon')}
        darkMode={darkMode}
        lang={lang}
      />
      {updateInfo && (
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={() => {
            if (updateInfo.storeUrl) {
              window.open(updateInfo.storeUrl, '_system');
            }
          }}
          message={updateInfo.message}
          forceUpdate={updateInfo.forceUpdate}
          lang={lang}
          darkMode={darkMode}
        />
      )}

      <div className="h-[calc(10px+env(safe-area-inset-bottom))]" />
      <AdBanner lang={lang} darkMode={darkMode} isAdFree={isAdFree} />
    </div>
  );
};

export default App;