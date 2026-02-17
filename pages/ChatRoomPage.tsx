import React, { useEffect } from 'react';
import { AppPageType, SportType } from '../types';
import { Z_INDEX, SPORT_IMAGES } from '../constants';
import { TRANSLATIONS } from '../translations';
import { getApplicantStatus, getApprovedCount } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import { useChat } from '../hooks/useChat';
import { ChatTab } from '../components/ChatTab';
import { markChatAsRead } from '../pages/ChatListPage';
import { ArrowLeftIcon, CalendarIcon, ClockIcon, LocationArrowIcon, UsersIcon } from '../Icons';

export const ChatRoomPage: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { currentUserId, userNickname, adBannerHeight, userProfile } = useAuthContext();
  const { navigateTo, goBack, navigateToUserProfile } = useNavigationContext();
  const { currentActiveRoom: room, setCurrentActiveRoom } = useRecruitmentContext();

  // 만료 체크
  const isExpired = React.useMemo(() => {
    if (!room) return false;
    try {
      const endDate = room.matchEndDate || room.matchDate;
      const endTimeStr = room.matchEndTime || room.matchTime;
      const [ey, em, ed] = endDate.split('-').map(Number);
      const [ehh, emm] = endTimeStr.split(':').map(Number);
      let endTime = new Date(ey, em - 1, ed, ehh, emm);
      if (!room.matchEndTime) {
        const [y, m, d] = room.matchDate.split('-').map(Number);
        endTime = new Date(y, m - 1, d, ehh, emm + 120);
      }
      const expiryLimit = new Date(endTime.getTime() + 3 * 60 * 60 * 1000);
      return expiryLimit <= new Date();
    } catch { return false; }
  }, [room?.matchDate, room?.matchTime, room?.matchEndDate, room?.matchEndTime]);

  // 승인 여부
  const isApproved = React.useMemo(() => {
    if (!room || !currentUserId) return false;
    if (room.hostId === currentUserId) return true;
    const myApp = room.applicants.find(a => a.userId === currentUserId);
    return myApp ? getApplicantStatus(myApp) === 'APPROVED' : false;
  }, [room, currentUserId]);

  const chat = useChat(room?.id, currentUserId, userNickname, true, isExpired, userProfile?.photoUrl);

  // 채팅방 진입 시 읽음 마킹
  useEffect(() => {
    if (room?.id) {
      markChatAsRead(room.id);
    }
  }, [room?.id]);

  // 새 메시지 올 때마다 읽음 마킹
  useEffect(() => {
    if (room?.id && chat.messages.length > 0) {
      markChatAsRead(room.id);
    }
  }, [room?.id, chat.messages.length]);

  if (!room) return null;

  const approvedCount = getApprovedCount(room.applicants);
  const trans = TRANSLATIONS[lang as keyof typeof TRANSLATIONS] as any;
  const venueName = room.venueData?.placeName || room.venue;

  // 날짜 포맷
  const dateDisplay = (() => {
    const [, m, d] = room.matchDate.split('-');
    const day = trans.days?.[new Date(room.matchDate).getDay()] || '';
    return `${parseInt(m)}.${parseInt(d)}(${day})`;
  })();

  const handleGoToDetail = () => {
    setCurrentActiveRoom(room);
    navigateTo(AppPageType.DETAIL);
  };

  return (
    <div className="fixed left-0 right-0 top-0 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden" style={{ zIndex: Z_INDEX.PAGE_OVERLAY, bottom: `calc(${adBannerHeight > 0 ? adBannerHeight + 24 : 0}px + ${adBannerHeight === 0 ? 'env(safe-area-inset-bottom, 0px)' : '0px'})` }}>
      {/* 헤더 */}
      <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 px-4 w-full">
          <button
            onClick={() => goBack()}
            className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90 shrink-0"
          >
            <ArrowLeftIcon size={24} />
          </button>

          {/* 썸네일 → DetailPage */}
          <button
            onClick={handleGoToDetail}
            className="w-[40px] h-[40px] rounded-xl overflow-hidden shrink-0 active:scale-95 transition-all"
          >
            <img src={(() => {
              const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
              const fallbackImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];
              return room.venueData?.thumbnailUrl || room.venueData?.photoUrl || fallbackImg;
            })()} alt="" className="w-full h-full object-cover" />
          </button>

          {/* 중앙 정보 (탭 → DetailPage) */}
          <button
            onClick={handleGoToDetail}
            className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
          >
            {/* 1행: 제목 */}
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em] truncate">
              {room.title}
            </h3>
            {/* 2행: 아이콘+정보 */}
            <div className="flex items-center gap-2 mt-0.5 text-[12px] font-medium text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-0.5">
                <CalendarIcon size={11} />
                {dateDisplay}
              </span>
              <span className="flex items-center gap-0.5">
                <ClockIcon size={11} />
                {room.matchTime}{room.matchEndTime ? ` - ${room.matchEndTime}` : ''}
              </span>
              {venueName && (
                <span className="flex items-center gap-0.5 truncate">
                  <LocationArrowIcon size={11} className="shrink-0" />
                  <span className="truncate">{venueName}</span>
                </span>
              )}
            </div>
          </button>

          {/* 우측: 참가자 수 */}
          <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 pl-1">
            <UsersIcon size={14} />
            <span className="tabular-nums">{approvedCount}{room.maxApplicants > 0 ? `/${room.maxApplicants}` : ''}</span>
          </div>
        </div>
      </header>

      {/* 채팅 콘텐츠 */}
      <div className="flex-1 flex flex-col px-4 overflow-hidden min-h-0">
        <ChatTab
          messages={chat.messages}
          inputText={chat.inputText}
          setInputText={chat.setInputText}
          sending={chat.sending}
          handleSend={chat.handleSend}
          scrollRef={chat.scrollRef}
          currentUserId={currentUserId}
          isExpired={isExpired}
          isApproved={isApproved}
          t={t}
          onAvatarPress={(userId) => navigateToUserProfile(userId)}
        />
      </div>
    </div>
  );
});
