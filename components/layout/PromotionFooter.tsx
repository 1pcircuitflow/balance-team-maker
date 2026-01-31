import React from 'react';
import { Language, TRANSLATIONS } from '../../translations';

interface PromotionFooterProps {
    lang: Language;
    darkMode: boolean;
}

export const PromotionFooter: React.FC<PromotionFooterProps> = ({ lang, darkMode }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
    return (
        <div className={`mt-6 py-3 px-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900/40' : 'bg-slate-100/50'}`}>
            <h4 className={`text-sm font-semibold tracking-tight pt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('promoAppTitle')}</h4>
        </div>
    );
};
