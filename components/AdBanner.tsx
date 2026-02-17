
import React, { useEffect } from 'react';
import { Language } from '../translations';
import { AdMob, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdMobBannerSize } from '@capacitor-community/admob';
import { useAuthContext } from '../contexts/AuthContext';

export const AdBanner: React.FC<{ lang: Language; darkMode: boolean; isAdFree: boolean; bottomOffset?: string }> = ({ lang, darkMode, isAdFree, bottomOffset = '0px' }) => {
  const { setAdBannerHeight } = useAuthContext();

  // SizeChanged 이벤트 리스너 — 광고 높이를 동적으로 추적
  useEffect(() => {
    const listener = AdMob.addListener(
      BannerAdPluginEvents.SizeChanged,
      (info: AdMobBannerSize) => {
        setAdBannerHeight(info.height);
        localStorage.setItem('ad_banner_height', String(info.height));
      }
    );
    return () => { listener.then(l => l.remove()); };
  }, []);

  useEffect(() => {
    let timerId: any = null;

    if (isAdFree) {
      AdMob.hideBanner().catch(() => { });
      setAdBannerHeight(0);
      localStorage.setItem('ad_banner_height', '0');
      return;
    }

    const showBanner = async () => {
      timerId = setTimeout(async () => {
        try {
          const options = {
            adId: 'ca-app-pub-3940256099942544/6300978111',
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true
          };
          await AdMob.showBanner(options);
        } catch (e) {
          console.error('Show Banner Failed', e);
        }
      }, 1500);
    };

    showBanner();

    return () => {
      if (timerId) clearTimeout(timerId);
      AdMob.hideBanner().catch(() => { });
    };
  }, [isAdFree]);

  if (isAdFree) return null;

  return null;
};
