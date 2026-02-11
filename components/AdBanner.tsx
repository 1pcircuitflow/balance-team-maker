
import React, { useEffect } from 'react';
import { Language } from '../translations';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

export const AdBanner: React.FC<{ lang: Language; darkMode: boolean; isAdFree: boolean; bottomOffset?: string }> = ({ lang, darkMode, isAdFree, bottomOffset = '0px' }) => {
  useEffect(() => {
    let timerId: any = null;

    if (isAdFree) {
      AdMob.hideBanner().catch(() => { });
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
