import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { AdMob, RewardAdPluginEvents, RewardAdOptions } from '@capacitor-community/admob';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AnalyticsService } from '../services/analyticsService';
import { paymentService, PRODUCT_IDS } from '../services/paymentService';
import { checkAppVersion, updateRoomFcmToken } from '../services/firebaseService';
import { compareVersions } from '../utils/helpers';
import { Language } from '../translations';

export const useInitialization = (
  lang: Language,
  setLang: (lang: Language) => void,
  user: any,
  loginLater: boolean,
  setShowLoginModal: (v: boolean) => void,
  setIsAdFree: (v: boolean) => void,
  currentActiveRoomId: string | undefined,
  setAlertState: (state: any) => void,
  setPendingJoinRoomId: (id: string | null) => void,
  setShowUpdateModal: (v: boolean) => void,
  setUpdateInfo: (info: any) => void,
  handleRewardAdComplete: () => void,
  t: (key: string, ...args: any[]) => string,
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

    initAdMob();
    initIAP();
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

    if (!user && !loginLater) {
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
      const parsed = JSON.parse(savedUsage);
      if (parsed.lastDate !== today) {
        const freshUsage = { count: 0, lastDate: today };
        localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
      }
    } else {
      const freshUsage = { count: 0, lastDate: today };
      localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
    }
  }, []);

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
        console.log('Push registration success, token: ' + token.value);
        localStorage.setItem('fcm_token', token.value);
        if (currentActiveRoomId) {
          updateRoomFcmToken(currentActiveRoomId, token.value);
        }
      });
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
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
    };
  }, [currentActiveRoomId, lang]);
};
