import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { AdMob, RewardAdPluginEvents, RewardAdOptions } from '@capacitor-community/admob';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AnalyticsService } from '../services/analyticsService';
import { paymentService, PRODUCT_IDS } from '../services/paymentService';
import { checkAppVersion, updateRoomFcmToken, saveUserFcmToken, saveUserLanguage } from '../services/firebaseService';
import { compareVersions } from '../utils/helpers';
import { Language } from '../translations';
import { PendingNotification, PushNotificationType } from '../types';

export const useInitialization = (
  lang: Language,
  setLang: (lang: Language) => void,
  user: any,
  currentUserId: string,
  setShowLoginModal: (v: boolean) => void,
  setIsAdFree: (v: boolean) => void,
  currentActiveRoomId: string | undefined,
  setAlertState: (state: any) => void,
  setPendingJoinRoomId: (id: string | null) => void,
  setPendingNotification: (v: PendingNotification | null) => void,
  setShowUpdateModal: (v: boolean) => void,
  setUpdateInfo: (info: any) => void,
  handleRewardAdComplete: () => void,
  t: (key: string, ...args: any[]) => string,
  onKakaoCode?: (code: string) => void,
) => {
  // Version check
  useEffect(() => {
    const checkVersion = async () => {
      const info = await CapApp.getInfo();
      const currentVersion = info.version;
      const remoteInfo = await checkAppVersion();

      if (remoteInfo) {
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
  }, []);

  // AdMob + IAP init
  useEffect(() => {
    const initAdMob = async () => {
      try {
        await AdMob.initialize({ initializeForTesting: false });
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
        const hasAdFree = restored.includes(PRODUCT_IDS.AD_FREE) || restored.includes(PRODUCT_IDS.FULL_PACK);
        setIsAdFree(hasAdFree);
        localStorage.setItem('app_is_ad_free', hasAdFree ? 'true' : 'false');
      } catch (err) {
        console.error('IAP initialization failed', err);
      }
    };

    const initKeyboard = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
        } catch (e) {
          console.error('Keyboard init failed', e);
        }
      }
    };

    initAdMob();
    initIAP();
    initKeyboard();
  }, []);

  // System language, Analytics, Login prompt, Auth init, LocalNotifications, Daily reset
  useEffect(() => {
    const initSystemLang = async () => {
      const oldLang = localStorage.getItem('app_lang');
      if (oldLang) localStorage.removeItem('app_lang');

      const manual = localStorage.getItem('app_lang_manual');
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
    AnalyticsService.logAppOpen();

    if (!user) {
      setShowLoginModal(true);
    }

    // React 준비 완료 → 네이티브 스플래시 닫기
    if ((window as any).NativeSplash?.hide) {
      (window as any).NativeSplash.hide();
    }

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
          await LocalNotifications.createChannel({
            id: 'recruit_channel',
            name: 'Recruitment Notifications',
            importance: 5,
            sound: 'default',
            vibration: true,
          });
        } catch (e) {
          console.error('LocalNotifications init failed', e);
        }
      }
    };
    initLocalNotifications();

    // Daily position usage reset
    const today = new Date().toISOString().split('T')[0];
    const savedUsage = localStorage.getItem('app_position_usage');
    if (savedUsage) {
      let parsed;
      try { parsed = JSON.parse(savedUsage); } catch { parsed = null; }
      if (parsed && parsed.lastDate !== today) {
        const freshUsage = { count: 0, lastDate: today };
        localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
      }
    } else {
      const freshUsage = { count: 0, lastDate: today };
      localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
    }
  }, []);

  // 언어 변경 시 Firestore에 저장 (Cloud Functions 다국어 알림용)
  useEffect(() => {
    if (currentUserId) {
      saveUserLanguage(currentUserId, lang);
    }
  }, [lang, currentUserId]);

  // Push notifications & deep links
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
        localStorage.setItem('fcm_token', token.value);
        // FCM 토큰을 사용자 문서에 저장 (Cloud Functions에서 조회용)
        if (currentUserId) {
          saveUserFcmToken(currentUserId, token.value);
        }
        if (currentActiveRoomId) {
          updateRoomFcmToken(currentActiveRoomId, token.value, currentUserId);
        }
      });
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });
      PushNotifications.addListener('pushNotificationReceived', (_notification) => {
        // 포그라운드: 시스템 배너 알림(presentationOptions "alert")으로 표시
        // 인앱 AlertModal 중복 방지를 위해 여기서는 별도 처리하지 않음
      });
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        if (data?.roomId) {
          if (data.type) {
            setPendingNotification({ type: data.type as PushNotificationType, roomId: data.roomId });
          } else {
            setPendingJoinRoomId(data.roomId);
          }
        }
      });
    };

    const addDeepLinkListener = () => {
      CapApp.addListener('appUrlOpen', async (data) => {
        try {
          // 카카오 로그인 콜백 처리
          if (data.url.includes('kakao-callback')) {
            const url = new URL(data.url);
            const code = url.searchParams.get('code');
            if (code && onKakaoCode) {
              try { await Browser.close(); } catch (e) { /* ignore */ }
              onKakaoCode(code);
            }
            return;
          }

          if (data.url.includes('room=')) {
            const url = new URL(data.url);
            const roomId = url.searchParams.get('room');
            const kakaoCode = url.searchParams.get('kakao_code');

            // 카카오 코드가 있으면 자동 로그인 먼저 실행
            if (kakaoCode && onKakaoCode) {
              onKakaoCode(kakaoCode);
            }

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
    };
  }, [currentActiveRoomId, currentUserId, lang]);
};
