import React, { useEffect, useState, useCallback } from 'react';
import { AppPageType, BottomTabType } from '../types';
import { SPORT_IMAGES } from '../constants';
import { TRANSLATIONS } from '../translations';
import { SportType } from '../types';
import { subscribeToChatRooms, RecruitmentRoom } from '../services/firebaseService';
import { getApprovedCount } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import { ChatBubbleIcon, CalendarIcon, ClockIcon, UsersIcon } from '../Icons';

const LAST_READ_KEY = 'belo_chat_lastRead';

/** localStorage에서 lastReadAt 맵 로드 */
const getLastReadMap = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
  } catch { return {}; }
};

/** 특정 방의 읽음 시간 마킹 */
export const markChatAsRead = (roomId: string) => {
  const map = getLastReadMap();
  map[roomId] = new Date().toISOString();
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(map));
};

/** 안읽은 방 ID 목록 반환 */
export const getUnreadRoomIds = (rooms: RecruitmentRoom[]): string[] => {
  const map = getLastReadMap();
  return rooms.filter(room => {
    const lastMsg = (room as any).lastChatMessage as { createdAt: string } | undefined;
    if (!lastMsg?.createdAt) return false;
    const lastRead = map[room.id];
    if (!lastRead) return true;
    return new Date(lastMsg.createdAt).getTime() > new Date(lastRead).getTime();
  }).map(r => r.id);
};

const formatLastTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);

  if (diffDays === 0) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const ChatListPage: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { currentUserId } = useAuthContext();
  const { setCurrentBottomTab, navigateTo } = useNavigationContext();
  const { setCurrentActiveRoom } = useRecruitmentContext();
  const [chatRooms, setChatRooms] = useState<RecruitmentRoom[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = subscribeToChatRooms(currentUserId, (rooms) => {
      setChatRooms(rooms);
      setUnreadIds(new Set(getUnreadRoomIds(rooms)));
    });
    return () => unsubscribe();
  }, [currentUserId]);

  const handleOpenChatRoom = useCallback((room: RecruitmentRoom) => {
    markChatAsRead(room.id);
    setUnreadIds(prev => {
      const next = new Set(prev);
      next.delete(room.id);
      return next;
    });
    setCurrentActiveRoom(room);
    navigateTo(AppPageType.CHAT_ROOM);
  }, [setCurrentActiveRoom, navigateTo]);

  if (chatRooms.length === 0) {
    return (
      <div className="w-full px-5 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5">
            <ChatBubbleIcon size={32} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-[16px] font-semibold text-slate-600 dark:text-slate-300 mb-2">
            {t('chatListEmptyTitle')}
          </h3>
          <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight text-center whitespace-pre-line mb-6">
            {t('chatListEmptyDesc')}
          </p>
          <button
            onClick={() => setCurrentBottomTab(BottomTabType.HOME)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-[14px] px-6 py-2.5 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
          >
            {t('goToHome')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-5 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        {chatRooms.map((room) => {
          const lastMsg = (room as any).lastChatMessage as { text: string; senderName: string; createdAt: string } | undefined;
          const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
          const bgImg = room.venueData?.photoUrl || sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];
          const approvedCount = getApprovedCount(room.applicants);
          const isUnread = unreadIds.has(room.id);
          const trans = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] as any;

          return (
            <button
              key={room.id}
              onClick={() => handleOpenChatRoom(room)}
              className="w-full flex items-center gap-2.5 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition-all active:scale-[0.98] text-left"
            >
              {/* 방 썸네일 */}
              <div className="w-[72px] h-[72px] rounded-xl overflow-hidden shrink-0 relative">
                <img src={bgImg} alt={room.sport} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = sportImgs[0]; }} />
                <div className="absolute inset-0 bg-black/20" />
                {/* 종목 뱃지 오버레이 */}
                <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                  <span className="text-white text-[10px] font-medium uppercase">
                    {t(room.sport.toLowerCase() as any)}
                  </span>
                </div>
              </div>

              {/* 방 정보 */}
              <div className="flex-1 min-w-0">
                {/* 1행: 제목 + 시간 */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">
                    {room.title}
                  </span>
                  {lastMsg && (
                    <span className="text-[11px] font-medium text-slate-300 dark:text-slate-600 shrink-0">
                      {formatLastTime(lastMsg.createdAt)}
                    </span>
                  )}
                </div>

                {/* 2행: 날짜 + 시간 + 참가자 */}
                <div className="flex items-center gap-2.5 mb-1 text-[12px] font-medium text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-0.5">
                    <CalendarIcon size={11} />
                    {(() => {
                      const [, m, d] = room.matchDate.split('-');
                      const day = trans.days?.[new Date(room.matchDate).getDay()] || '';
                      return `${parseInt(m)}.${parseInt(d)}(${day})`;
                    })()}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <ClockIcon size={11} />
                    {room.matchTime}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <UsersIcon size={11} />
                    {approvedCount}{room.maxApplicants > 0 ? `/${room.maxApplicants}` : ''}
                  </span>
                </div>

                {/* 3행: 마지막 메시지 + NEW 뱃지 */}
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[13px] font-medium text-slate-400 dark:text-slate-500 truncate">
                    {lastMsg
                      ? `${lastMsg.senderName}: ${lastMsg.text}`
                      : t('noChatMessages')
                    }
                  </p>
                  {isUnread && (
                    <span className="shrink-0 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
