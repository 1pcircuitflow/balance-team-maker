import React, { useEffect } from 'react';
import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Language } from '../../translations';

interface AdBannerProps {
    lang: Language;
    darkMode: boolean;
    isAdFree: boolean;
}

export const AdBanner: React.FC<AdBannerProps> = ({ lang, darkMode, isAdFree }) => {
    useEffect(() => {
        let timerId: any = null;

        if (isAdFree) {
            AdMob.hideBanner().catch(() => { });
            return;
        }

        const showBanner = async () => {
            // Bridge 초기화 시간을 확보하기 위해 약간의 딜레이 추가 (크래시 방지)
            timerId = setTimeout(async () => {
                try {
                    const options = {
                        adId: 'ca-app-pub-4761157658396004/6797378026',
                        adSize: BannerAdSize.ADAPTIVE_BANNER,
                        position: BannerAdPosition.BOTTOM_CENTER,
                        margin: 0,
                        isTesting: false
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

    if (isAdFree) return <div className="fixed bottom-0 left-0 w-full h-[env(safe-area-inset-bottom)] bg-white dark:bg-black z-[2000] transition-colors duration-300" />;

    return (
        <div className={`fixed bottom-0 left-0 w-full bg-white dark:bg-black pb-[env(safe-area-inset-bottom)] z-[2000] transition-colors duration-300 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.5)] border-t ${darkMode ? 'border-slate-900' : 'border-slate-200'}`}>
            <div className={`h-[56px] w-full flex items-center justify-center text-[8px] font-bold tracking-[0.2em] uppercase ${darkMode ? 'text-slate-800' : 'text-slate-300'}`}>
                {/* AdMob Banner will be overlaid here */}
            </div>
        </div>
    );
};
