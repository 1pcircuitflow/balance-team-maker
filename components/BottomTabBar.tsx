import React from 'react';
import { BottomTabType, SportType } from '../types';
import { Z_INDEX } from '../constants';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import * as Icons from '../Icons';

const { HomeIcon, HomeFilledIcon, UserPlusIcon, UserPlusFilledIcon, MoreIcon, MoreFilledIcon } = Icons;

export const BottomTabBar: React.FC = React.memo(() => {
  const { currentBottomTab, setCurrentBottomTab, activeTab, setMembersTab } = useNavigationContext();
  const { t } = useAppContext();
  const { isAdFree } = useAuthContext();

  return (
    <div className="fixed left-0 right-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]"
      style={{ zIndex: Z_INDEX.BOTTOM_TAB, bottom: isAdFree ? '0px' : '56px', height: 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
      <div className="flex h-[60px] max-w-lg mx-auto">
        <button onClick={() => setCurrentBottomTab(BottomTabType.HOME)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.HOME ? <HomeFilledIcon /> : <HomeIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('homeTab')}</span>
        </button>
        <button onClick={() => { setCurrentBottomTab(BottomTabType.MEMBERS); setMembersTab(activeTab === SportType.ALL ? SportType.GENERAL : activeTab); }} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.MEMBERS ? <UserPlusFilledIcon /> : <UserPlusIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('membersTab')}</span>
        </button>
        <button onClick={() => setCurrentBottomTab(BottomTabType.SETTINGS)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.SETTINGS ? <MoreFilledIcon /> : <MoreIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('settingsTab')}</span>
        </button>
      </div>
    </div>
  );
});
