import React, { useState, useRef, useEffect, memo } from 'react';
import { SportType } from '../types';
import { Z_INDEX } from '../constants';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { AnalyticsService } from '../services/analyticsService';

const SPORT_OPTIONS: SportType[] = [SportType.ALL, SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL];

export const SportFilterButton: React.FC = memo(() => {
  const { t, darkMode } = useAppContext();
  const { activeTab, setActiveTab } = useNavigationContext();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen]);

  const isFiltered = activeTab !== SportType.ALL;

  const handleSelect = (sport: SportType) => {
    setActiveTab(sport);
    setIsOpen(false);
    AnalyticsService.logEvent('tab_change', { sport });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(SportType.ALL);
    setIsOpen(false);
    AnalyticsService.logEvent('tab_change', { sport: SportType.ALL });
  };

  const label = isFiltered ? t(activeTab.toLowerCase()) : t('allSports');

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* 필터 버튼 */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        >
          <span>{label}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {isFiltered && (
          <button
            onClick={handleClear}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && (
        <div className={`absolute top-full left-0 mt-1.5 min-w-[160px] rounded-xl shadow-lg border overflow-hidden ${
          darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`} style={{ zIndex: Z_INDEX.FILTER_DROPDOWN }}>
          {SPORT_OPTIONS.map((sport) => {
            const isSelected = activeTab === sport;
            return (
              <button
                key={sport}
                onClick={() => handleSelect(sport)}
                className={`w-full px-4 py-2.5 text-left text-[13px] flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>{sport === SportType.ALL ? t('allSports') : t(sport.toLowerCase())}</span>
                {isSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
