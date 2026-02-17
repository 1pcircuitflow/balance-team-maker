import React, { useEffect, useState } from 'react';
import { BottomTabType } from '../types';
import { Z_INDEX } from '../constants';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { subscribeToChatRooms, RecruitmentRoom } from '../services/firebaseService';
import { getUnreadRoomIds } from '../pages/ChatListPage';
import * as Icons from '../Icons';

const { HomeIcon, HomeFilledIcon, UserPlusIcon, UserPlusFilledIcon, ChatBubbleIcon, ChatBubbleFilledIcon, MoreIcon, MoreFilledIcon } = Icons;

export const BottomTabBar: React.FC = React.memo(() => {
  const { currentBottomTab, setCurrentBottomTab } = useNavigationContext();
  const { t } = useAppContext();
  const { isAdFree, adBannerHeight, currentUserId } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);

  // 안읽은 채팅방 수 구독
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = subscribeToChatRooms(currentUserId, (rooms: RecruitmentRoom[]) => {
      setUnreadCount(getUnreadRoomIds(rooms).length);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  return (
    <div className="fixed left-0 right-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]"
      style={{ zIndex: Z_INDEX.BOTTOM_TAB, bottom: `${adBannerHeight}px`, height: 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: adBannerHeight === 0 ? 'env(safe-area-inset-bottom, 0px)' : '0px' }}>
      <div className="flex h-[60px] max-w-lg mx-auto">
        <button onClick={() => setCurrentBottomTab(BottomTabType.HOME)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.HOME ? <HomeFilledIcon /> : <HomeIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('homeTab')}</span>
        </button>
        <button onClick={() => setCurrentBottomTab(BottomTabType.MEMBERS)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.MEMBERS ? <UserPlusFilledIcon /> : <UserPlusIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('membersTab')}</span>
        </button>
        <button onClick={() => setCurrentBottomTab(BottomTabType.CHAT)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all relative">
          <div className="relative">
            <div className={currentBottomTab === BottomTabType.CHAT ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.CHAT ? <ChatBubbleFilledIcon size={18} /> : <ChatBubbleIcon size={18} />}</div>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-blue-500 text-white text-[8px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-slate-50 dark:border-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.CHAT ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('chatTab')}</span>
        </button>
        <button onClick={() => setCurrentBottomTab(BottomTabType.SETTINGS)} className="flex-1 flex flex-col items-center justify-center gap-1 transition-all">
          <div className={currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>{currentBottomTab === BottomTabType.SETTINGS ? <MoreFilledIcon /> : <MoreIcon />}</div>
          <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>{t('settingsTab')}</span>
        </button>
      </div>
    </div>
  );
});
