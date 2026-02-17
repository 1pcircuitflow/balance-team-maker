import React, { useRef, useEffect, useState, memo } from 'react';
import { SportType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { AnalyticsService } from '../services/analyticsService';

const MEMBER_TABS: SportType[] = [SportType.ALL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL];

export const SportSegmentControl: React.FC = memo(() => {
  const { t } = useAppContext();
  const { membersTab, setMembersTab } = useNavigationContext();
  const tabRefs = useRef<Map<SportType, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // 인디케이터 위치 업데이트
  useEffect(() => {
    const el = tabRefs.current.get(membersTab);
    const container = containerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [membersTab]);

  const handleTabClick = (sport: SportType) => {
    setMembersTab(sport);
    AnalyticsService.logEvent('tab_change', { sport });
  };

  return (
    <div className="w-full px-5 pb-3">
      <div ref={containerRef} className="relative flex">
        {MEMBER_TABS.map((sport) => {
          const isActive = membersTab === sport;
          return (
            <button
              key={sport}
              ref={(el) => { if (el) tabRefs.current.set(sport, el); }}
              onClick={() => handleTabClick(sport)}
              className={`flex-1 py-2 text-center text-[14px] transition-colors duration-200 ${
                isActive
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-400 dark:text-slate-500'
              }`}
            >
              {t(sport.toLowerCase())}
            </button>
          );
        })}
        {/* 슬라이딩 인디케이터 */}
        <div
          className="absolute bottom-0 h-[2px] bg-slate-900 dark:bg-white rounded-full transition-all duration-300 ease-out"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
      </div>
    </div>
  );
});
