
import React, { useState, useEffect } from 'react';
import { SportType } from '../types';
import { Z_INDEX } from '../constants';
import { TRANSLATIONS, Language } from '../translations';

export const LoadingOverlay: React.FC<{ lang: Language; activeTab: SportType; darkMode: boolean; countdown: number; isAdFree: boolean }> = ({ lang, activeTab, darkMode, countdown, isAdFree }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  const icon = activeTab === SportType.BASKETBALL ? '🏀' : activeTab === SportType.SOCCER ? '⚽' : activeTab === SportType.FUTSAL ? '🥅' : '🏆';

  const totalTime = isAdFree ? 1 : 5;
  const elapsed = totalTime - countdown;
  const step = elapsed < totalTime * 0.4 ? 0 : elapsed < totalTime * 0.8 ? 1 : 2;

  const stepIcons = ['📊', '⚙️', '✨'];
  const stepKeys = ['loadingStep1', 'loadingStep2', 'loadingStep3'] as const;
  const tipKeys = ['loadingTip1', 'loadingTip2', 'loadingTip3', 'loadingTip4', 'loadingTip5'] as const;

  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (isAdFree) return;
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tipKeys.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isAdFree]);

  return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center ${darkMode ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-xl animate-in duration-300`} style={{ zIndex: Z_INDEX.LOADING_OVERLAY }}>
      <div className="relative flex flex-col items-center max-w-sm w-full px-6">
        <div className="text-[48px] mb-6 animate-bounce">
          {icon}
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-6 w-full max-w-[240px]">
          {stepIcons.map((si, i) => (
            <React.Fragment key={i}>
              <div className={`flex flex-col items-center gap-1.5 ${i <= step ? 'opacity-100' : 'opacity-30'} transition-opacity duration-500`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[18px] transition-all duration-500 ${
                  i < step ? (darkMode ? 'bg-blue-500/20' : 'bg-blue-100') :
                  i === step ? (darkMode ? 'bg-blue-500 shadow-lg shadow-blue-500/40' : 'bg-blue-500 shadow-lg shadow-blue-500/30') :
                  (darkMode ? 'bg-slate-800' : 'bg-slate-100')
                }`}>
                  {i < step ? '✓' : si}
                </div>
                <span className={`text-[10px] font-bold whitespace-nowrap ${
                  i === step ? (darkMode ? 'text-blue-400' : 'text-blue-500') : (darkMode ? 'text-slate-500' : 'text-slate-400')
                }`}>
                  {t(stepKeys[i] as any)}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-1 mt-[-18px] rounded-full transition-all duration-500 ${
                  i < step ? (darkMode ? 'bg-blue-500' : 'bg-blue-500') : (darkMode ? 'bg-slate-800' : 'bg-slate-200')
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className={`text-[20px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-2`}>
            {t(stepKeys[step] as any)}
          </h3>
          <p className={`text-[12px] font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('generatingTeamsLoading')}
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className={`w-full h-1.5 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${darkMode ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-blue-500'} transition-all duration-1000 ease-linear`}
              style={{ width: `${(elapsed / totalTime) * 100}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{t('teamBalanceEngine')}</span>
            <span className={`text-[12px] font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-500'} font-mono`}>
              {countdown > 0 ? t('loadingSecondsLeft', countdown) : t('loadingCalculating' as any)}
            </span>
          </div>
        </div>

        {/* Rotating tips (non-pro only) */}
        {!isAdFree && (
          <div className={`mt-6 px-4 py-3 rounded-2xl text-center ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'} transition-all duration-300`}>
            <p className={`text-[11px] font-medium leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              💡 {t(tipKeys[tipIndex] as any)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
