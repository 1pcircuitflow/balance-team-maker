import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppPageType, SportType } from '../types';
import { Z_INDEX, SPORT_IMAGES } from '../constants';
import { TRANSLATIONS } from '../translations';
import { getApplicantStatus, getApprovedCount, isRoomFull } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { PlusIcon } = Icons;

export const HomePage: React.FC = () => {
  const { t, lang, showConfirm, setConfirmState } = useAppContext();
  const { currentUserId, isAdFree, adBannerHeight, showLoginModal } = useAuthContext();
  const { currentPage, navigateTo } = useNavigationContext();
  const {
    filteredRooms, appliedRooms, likedRooms, publicRooms,
    setCurrentActiveRoom, showHostRoomModal, setShowHostRoomModal,
    handleShareRecruitLink, handleCloseRecruitRoom,
  } = useRecruitmentContext();

  const onRoomClick = (room: any) => {
    setCurrentActiveRoom(room);
    navigateTo(AppPageType.DETAIL);
  };
  const onCreateRoom = () => {
    setCurrentActiveRoom(null);
    setShowHostRoomModal(true);
  };
  const onShareLink = (room: any) => handleShareRecruitLink(room);
  const onDeleteRoom = (room: any) => {
    const confirmData = handleCloseRecruitRoom(room);
    setConfirmState({ isOpen: true, title: confirmData.title, message: confirmData.message, confirmText: confirmData.confirmText, onConfirm: async () => { await confirmData.onConfirm(); setConfirmState((prev: any) => ({ ...prev, isOpen: false })); } });
  };

  const hasMyRooms = filteredRooms.length > 0;
  const hasAppliedRooms = appliedRooms.length > 0;
  const hasLikedRooms = likedRooms.length > 0;
  const hasPublicRooms = publicRooms.length > 0;
  const hasNoRooms = !hasMyRooms && !hasAppliedRooms && !hasLikedRooms && !hasPublicRooms;

  return (
    <section className="w-full px-5" data-capture-ignore="true">
      <div className="space-y-3">
        {hasNoRooms ? (
          <div className="w-full h-[112px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-transparent flex flex-col items-center justify-center gap-2">
            <p className="text-[12px] font-black text-slate-400 dark:text-slate-500 px-8 text-center leading-relaxed">{t('noScheduledMatch')}</p>
          </div>
        ) : (
          <>
            {hasMyRooms && (
              <>
                {filteredRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isOwner t={t} lang={lang}
                    onRoomClick={onRoomClick} onShareLink={onShareLink} onDeleteRoom={onDeleteRoom} />
                ))}
              </>
            )}
            {hasAppliedRooms && (
              <>
                {appliedRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isOwner={false} isApplied currentUserId={currentUserId} t={t} lang={lang}
                    onRoomClick={onRoomClick} onShareLink={onShareLink} onDeleteRoom={onDeleteRoom} />
                ))}
              </>
            )}
            {hasLikedRooms && (
              <>
                {likedRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isOwner={false} isLiked t={t} lang={lang}
                    onRoomClick={onRoomClick} onShareLink={onShareLink} onDeleteRoom={onDeleteRoom} />
                ))}
              </>
            )}
            {hasPublicRooms && (
              <>
                {publicRooms.map((room) => (
                  <RoomCard key={room.id} room={room} isOwner={room.hostId === currentUserId} t={t} lang={lang}
                    onRoomClick={onRoomClick} onShareLink={onShareLink} onDeleteRoom={onDeleteRoom} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* 하단 고정 경기생성 버튼 */}
      {currentPage === AppPageType.HOME && !showHostRoomModal && !showLoginModal && (
        <div
          className="fixed left-0 right-0 px-5 pt-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800"
          style={{
            zIndex: Z_INDEX.FAB_BUTTON,
            bottom: `calc(${60 + adBannerHeight}px + env(safe-area-inset-bottom, 0px))`,
            paddingBottom: '12px',
          }}
        >
          <button
            onClick={onCreateRoom}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900
                       py-3 rounded-2xl shadow-lg shadow-slate-900/30 dark:shadow-white/20
                       flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <PlusIcon size={18} />
            <span className="text-[16px] font-bold">{t('recruitParticipants')}</span>
          </button>
        </div>
      )}
    </section>
  );
};

// 종목 이미지 경로 헬퍼 (썸네일 > 원본 > 폴백)
const getSportImage = (room: any, useThumbnail = false) => {
  const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
  const fallbackImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];
  if (useThumbnail) return room.venueData?.thumbnailUrl || room.venueData?.photoUrl || fallbackImg;
  return room.venueData?.photoUrl || fallbackImg;
};

// 종목 기본 이미지 (폴백용)
const getFallbackSportImage = (room: any) => {
  const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
  return sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];
};

// 당근마켓 스타일 방 카드 컴포넌트
const RoomCard: React.FC<{
  room: any;
  isOwner: boolean;
  isApplied?: boolean;
  isLiked?: boolean;
  currentUserId?: string | null;
  t: (key: string, ...args: any[]) => string;
  lang: string;
  onRoomClick: (room: any) => void;
  onShareLink: (room: any) => void;
  onDeleteRoom: (room: any) => void;
}> = ({ room, isOwner, isApplied, isLiked, currentUserId, t, lang, onRoomClick, onShareLink, onDeleteRoom }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pendingApplicants = room.applicants.filter((a: any) => getApplicantStatus(a) === 'PENDING');
  const approvedCount = getApprovedCount(room.applicants);
  const isFull = isRoomFull(room);
  const isClosed = room.status === 'CLOSED';
  const myApproved = isApplied && currentUserId && room.applicants.some((a: any) => a.userId === currentUserId && getApplicantStatus(a) === 'APPROVED');

  // 카드 외부 클릭 시 메뉴 닫기
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen, handleClickOutside]);

  return (
    <div
      onClick={() => onRoomClick(room)}
      className="w-full bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-transparent
                 flex flex-row overflow-hidden active:scale-[0.98] transition-all duration-200 cursor-pointer
                 animate-in zoom-in-95"
    >
      {/* 좌측 썸네일 */}
      <div className="w-[96px] shrink-0 relative self-stretch">
        <img
          src={getSportImage(room, true)}
          alt={room.sport}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = getFallbackSportImage(room); }}
        />
        {/* 종목 뱃지 오버레이 */}
        <div className="absolute bottom-1.5 left-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className="text-white text-[12px] font-medium uppercase tracking-[-0.025em]">
            {t(room.sport.toLowerCase())}
          </span>
        </div>
      </div>

      {/* 우측 정보 영역 */}
      <div className="flex flex-col justify-between flex-1 min-w-0 px-3 py-2">
        {/* 1행: 제목 + 더보기 */}
        <div className="flex items-center justify-between gap-2 h-[24px]">
          <h4 className="text-[16px] font-black text-slate-800 dark:text-slate-200 tracking-[-0.025em] truncate flex-1">
            {room.title}
          </h4>
          {isOwner && (
            <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
              {menuOpen ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRoomClick(room); }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
                  >
                    <Icons.UsersIcon size={18} className="text-slate-500 dark:text-slate-400" />
                    {pendingApplicants.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950">
                        {pendingApplicants.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onShareLink(room); }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Icons.ShareIcon size={18} className="text-slate-500 dark:text-slate-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteRoom(room); }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Icons.TrashIcon size={18} className="text-slate-500 dark:text-slate-400" />
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
                  className="p-0.5 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                >
                  <Icons.MoreFilledIcon />
                  {pendingApplicants.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 animate-pulse">
                      {pendingApplicants.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2행: 장소 */}
        {(room.venueData?.placeName || room.venue) && (
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 tracking-[-0.025em] truncate flex items-center gap-1">
            <Icons.LocationArrowIcon size={12} className="shrink-0" />
            {room.venueData?.placeName || room.venue}
          </p>
        )}

        {/* 3행: 날짜 + 시간 + MY/참가완료 뱃지 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-[-0.025em]">
            <span className="flex items-center gap-1">
              <Icons.CalendarIcon size={13} />
              {(() => {
                const [, m, d] = room.matchDate.split('-');
                const day = (TRANSLATIONS[lang as keyof typeof TRANSLATIONS] as any).days[new Date(room.matchDate).getDay()];
                return `${parseInt(m)}.${parseInt(d)}(${day})`;
              })()}
            </span>
            <span className="flex items-center gap-1">
              <Icons.ClockIcon size={13} />
              {room.matchTime}{room.matchEndTime ? ` - ${room.matchEndTime}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <div className="text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white bg-blue-500">
                MY
              </div>
            )}
            {isApplied && (
              <div className={`text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white ${myApproved ? 'bg-blue-500' : 'bg-amber-500'}`}>
                {myApproved ? t('participationConfirmed') : t('applied')}
              </div>
            )}
            {isLiked && (
              <div className="text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white bg-rose-500 flex items-center gap-0.5">
                <Icons.HeartIcon size={10} filled className="text-white" />
                {t('liked')}
              </div>
            )}
          </div>
        </div>

        {/* 4행: 참가자 수 + 조회수/찜수 + 모집상태 뱃지 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[20px] font-black text-slate-800 dark:text-slate-200 tabular-nums tracking-[-0.025em] leading-none">
              {approvedCount}
              <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
              <span className="text-[12px] text-slate-400 dark:text-slate-500">{room.maxApplicants > 0 ? room.maxApplicants : t('unlimited')}</span>
            </span>
            <div className="flex items-center gap-2 text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-[-0.025em]">
              <span className="flex items-center gap-1">
                <Icons.EyeIcon size={13} />
                <span className="tabular-nums">{room.viewCount || 0}</span>
              </span>
              <span className="flex items-center gap-1">
                <Icons.HeartIcon size={13} filled={(room.likedBy?.length || 0) > 0} className={(room.likedBy?.length || 0) > 0 ? 'text-rose-400' : ''} />
                <span className="tabular-nums">{room.likedBy?.length || 0}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white ${isClosed || isFull ? 'bg-slate-500' : 'bg-emerald-500'}`}>
              {isClosed || isFull ? t('recruitClosedBadge') : t('recruiting')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
