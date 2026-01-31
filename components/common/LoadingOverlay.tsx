import React from 'react';
import { SportType } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';

interface LoadingOverlayProps {
    lang: Language;
    activeTab: SportType;
    darkMode: boolean;
    countdown: number;
    isPro?: boolean; // App.tsx에서 isPro를 사용하고 있으므로 추가 (isAdFree와 같은 의미일 수 있음)
    isAdFree?: boolean; // App.tsx 호출부를 보면 isPro를 넘김.
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ lang, activeTab, darkMode, countdown }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
        const translation = (TRANSLATIONS[lang] as any)[key];
        if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
        return String(translation || key);
    };
    const icon = activeTab === SportType.BASKETBALL ? '🏀' : activeTab === SportType.SOCCER ? '⚽' : activeTab === SportType.FUTSAL ? '🥅' : '🏆';

    return (
        <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center ${darkMode ? 'bg-black/95' : 'bg-white/95'} backdrop-blur-xl animate-in duration-300`}>
            <div className="relative flex flex-col items-center max-w-sm w-full px-6">
                <div className="text-6xl mb-8 animate-bounce-subtle">
                    {icon}
                </div>

                <div className="text-center mb-10">
                    <h3 className={`text-2xl font-bold ${darkMode ? 'text-slate-50' : 'text-slate-900'} mb-3 tracking-tight`}>
                        {countdown > 2 ? t('loadingAnalysing') : t('loadingOptimizing')}
                    </h3>
                    <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('generatingTeamsLoading')}
                    </p>
                </div>

                <div className="w-full space-y-4">
                    <div className={`w-full h-2 ${darkMode ? 'bg-slate-900' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                        <div
                            className={`h-full bg-gradient-to-r from-blue-500 to-blue-600 ${darkMode ? 'shadow-[0_0_20px_rgba(59,130,246,0.6)]' : 'shadow-lg shadow-blue-500/30'} transition-all duration-1000 ease-out`}
                            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center px-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Team Balance Engine</span>
                        <span className={`text-sm font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'} tabular-nums`}>
                            {t('loadingSecondsLeft', countdown)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
