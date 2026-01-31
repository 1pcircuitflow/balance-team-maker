import React from 'react';
import { Language, TRANSLATIONS } from '../../translations';

interface PositionLimitModalProps {
    isOpen: boolean;
    onWatchAd: () => void;
    onUpgrade: () => void;
    onClose: () => void;
    lang: Language;
    darkMode: boolean;
}

export const PositionLimitModal: React.FC<PositionLimitModalProps> = ({ isOpen, onWatchAd, onUpgrade, onClose, lang, darkMode }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
            <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
                <div className="w-16 h-16 bg-amber-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
                    ⏳
                </div>

                <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
                    {t('dailyLimitReached')}
                </h3>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
                    {t('positionLimitMsg')}
                </p>

                <div className="space-y-3">
                    <button
                        onClick={onWatchAd}
                        className="w-full py-4 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
                    >
                        <span>📺</span>
                        {t('watchAdUnlock')}
                    </button>
                    {/* 업그레이드 버튼 주석 처리
          <button
            onClick={onUpgrade}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <span>💎</span>
            {t('unlimitedUnlock')}
          </button>
          */}
                    <button
                        onClick={onClose}
                        className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
