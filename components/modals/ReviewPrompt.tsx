import React from 'react';
import { Language, TRANSLATIONS } from '../../translations';

interface ReviewPromptProps {
    isOpen: boolean;
    onLater: () => void;
    onRate: () => void;
    lang: Language;
    darkMode: boolean;
}

export const ReviewPrompt: React.FC<ReviewPromptProps> = ({ isOpen, onLater, onRate, lang, darkMode }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
            <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>{t('reviewTitle')}</h3>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-8 px-2 leading-relaxed opacity-90`}>
                    {t('reviewMsg')}
                </p>

                <div className="space-y-3">
                    <button
                        onClick={onRate}
                        className="w-full py-4 bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-semibold rounded-2xl transition-all active:scale-95"
                    >
                        {t('now')}
                    </button>
                    <button
                        onClick={onLater}
                        className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 hover:text-slate-100' : 'text-slate-400 hover:text-slate-900'}`}
                    >
                        {t('later')}
                    </button>
                </div>
            </div>
        </div>
    );
};
