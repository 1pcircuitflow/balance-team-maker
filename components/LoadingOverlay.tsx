
import React from 'react';
import { SportType } from '../types';
import { TRANSLATIONS, Language } from '../translations';

export const LoadingOverlay: React.FC<{ lang: Language; activeTab: SportType; darkMode: boolean; countdown: number; isAdFree: boolean }> = ({ lang, activeTab, darkMode, countdown, isAdFree }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  const icon = activeTab === SportType.BASKETBALL ? '🏀' : activeTab === SportType.SOCCER ? '⚽' : activeTab === SportType.FUTSAL ? '🥅' : '🏆';

  return (
    <div className={`fixed inset-0 z-[5000] flex flex-col items-center justify-center ${darkMode ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-xl animate-in duration-300`}>
      <div className="relative flex flex-col items-center max-w-sm w-full px-6">
        <div className="text-5xl mb-6 animate-bounce">
          {icon}
        </div>

        <div className="text-center mb-8">
          <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-2`}>
            {countdown > 2 ? t('loadingAnalysing') : t('loadingOptimizing')}
          </h3>
          <p className={`text-xs font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('generatingTeamsLoading')}
          </p>
        </div>



        <div className="w-full space-y-4">
          <div className={`w-full h-1.5 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${darkMode ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-blue-600'} transition-all duration-1000 ease-linear`}
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{t('teamBalanceEngine')}</span>
            <span className={`text-xs font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'} font-mono`}>
              {t('loadingSecondsLeft', countdown)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
