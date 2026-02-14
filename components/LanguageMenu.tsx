
import React, { useState, useEffect, useRef } from 'react';
import { Language } from '../translations';
import { Z_INDEX } from '../constants';
import * as Icons from '../Icons';

const { GlobeIcon } = Icons;

export const LanguageMenu: React.FC<{
  lang: Language; onLangChange: (l: Language) => void; t: any;
}> = ({ lang, onLangChange, t }) => {
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
        <div className="absolute right-0 mt-2 w-48 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 p-2 animate-in fade-in zoom-in-95 duration-200" style={{ zIndex: Z_INDEX.LANGUAGE_MENU }}>
          <div className="p-2">
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">{t('language')}</span>
            <div className="space-y-1">
              {languages.map(l => (
                <button
                  key={l.code}
                  onClick={() => { onLangChange(l.code); setIsOpen(false); }}
                  className={`w-full h-10 px-3 rounded-xl flex items-center justify-between transition-all ${lang === l.code ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <span className="text-[14px] font-bold">{l.name}</span>
                  <span className="text-[16px]">{l.flag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
