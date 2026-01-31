import React, { useState, useRef, useEffect } from 'react';
import { GlobeIcon } from '../../Icons';
import { Language, TRANSLATIONS } from '../../translations';

interface LanguageMenuProps {
    lang: Language;
    onLangChange: (l: Language) => void;
    // t 함수는 내부에서 TRANSLATIONS를 사용하므로 props로 받을 필요 없이 내부 구현하거나, 
    // 상위에서 전달받는 경우 그대로 사용. App.tsx에서는 t를 넘겨주고 있음.
    // 여기서는 내부에서 구현하거나 t를 받도록 유지. 
    // App.tsx 코드를 그대로 쓰려면 t를 받는 게 낫지만, t 함수 타입 정의가 귀찮을 수 있음.
    // 여기서는 간단히 t를 any로 받거나 직접 구현. 원본 유지.
    t: (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]) => string;
}

export const LanguageMenu: React.FC<LanguageMenuProps> = ({ lang, onLangChange, t }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const languages: { code: Language; flag: string; name: string }[] = [
        { code: 'ko', flag: '🇰🇷', name: '한국어' },
        { code: 'en', flag: '🇺🇸', name: 'English' },
        { code: 'pt', flag: '🇧🇷', name: 'Português' },
        { code: 'es', flag: '🇪🇸', name: 'Español' },
        { code: 'ja', flag: '🇯🇵', name: '日本語' },
    ];

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                aria-label="Change Language"
            >
                <GlobeIcon />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-[1500] animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">{t('language')}</span>
                        <div className="space-y-1">
                            {languages.map(l => (
                                <button
                                    key={l.code}
                                    onClick={() => { onLangChange(l.code); setIsOpen(false); }}
                                    className={`w-full h-10 px-3 rounded-xl flex items-center justify-between transition-all ${lang === l.code ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                >
                                    <span className="text-sm font-bold">{l.name}</span>
                                    <span className="text-base">{l.flag}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
