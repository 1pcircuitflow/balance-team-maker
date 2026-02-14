import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppPageType } from '../types';
import { Z_INDEX } from '../constants';
import { TRANSLATIONS } from '../translations';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { PlusIcon } = Icons;

export const HomePage: React.FC = () => {
  const { t, lang, showConfirm, setConfirmState } = useAppContext();
  const { currentUserId, isAdFree, showLoginModal } = useAuthContext();
  const { currentPage, setCurrentPage } = useNavigationContext();
  const {
    filteredRooms, publicRooms,
    setCurrentActiveRoom, showHostRoomModal, setShowHostRoomModal,
    handleShareRecruitLink, handleCloseRecruitRoom,
  } = useRecruitmentContext();

  const onRoomClick = (room: any) => {
    setCurrentActiveRoom(room);
    setCurrentPage(AppPageType.DETAIL);
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
  const hasPublicRooms = publicRooms.length > 0;
  const hasNoRooms = !hasMyRooms && !hasPublicRooms;

  return (
    <section className="w-full px-5" data-capture-ignore="true">
      <div className="space-y-3">
        {hasNoRooms ? (
          <div className="w-full h-[112px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
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

      {/* FAB 경기생성 버튼 */}
      {currentPage === AppPageType.HOME && !showHostRoomModal && !showLoginModal && <button
        onClick={onCreateRoom}
        className="fixed right-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900
                   rounded-full px-5 h-[48px] shadow-2xl shadow-slate-900/30 dark:shadow-white/20
                   flex items-center gap-2 transition-all active:scale-95 hover:shadow-3xl"
        style={{ zIndex: Z_INDEX.FAB_BUTTON, bottom: isAdFree ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 'calc(136px + env(safe-area-inset-bottom, 0px))' }}
      >
        <PlusIcon size={18} />
        <span className="text-[14px] font-bold">{t('recruitParticipants')}</span>
      </button>}
    </section>
  );
};

// 종목 이미지 경로 헬퍼
const getSportImage = (room: any) => {
  const seed = room.id ? room.id.charCodeAt(room.id.length - 1) % 2 + 1 : 1;
  const sport = room.sport.toLowerCase();
  const name = sport === 'general' ? 'tennis' : sport;
  return `/images/${name}-${seed}.jpeg`;
};

// 당근마켓 스타일 방 카드 컴포넌트
const RoomCard: React.FC<{
  room: any;
  isOwner: boolean;
  t: (key: string, ...args: any[]) => string;
  lang: string;
  onRoomClick: (room: any) => void;
  onShareLink: (room: any) => void;
  onDeleteRoom: (room: any) => void;
}> = ({ room, isOwner, t, lang, onRoomClick, onShareLink, onDeleteRoom }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pendingApplicants = room.applicants.filter((a: any) => !a.isApproved);
  const approvedCount = room.applicants.filter((a: any) => a.isApproved).length;
  const isFull = room.maxApplicants > 0 && approvedCount >= room.maxApplicants;

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
      className="w-full bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800
                 flex flex-row overflow-hidden active:scale-[0.98] transition-all duration-200 cursor-pointer
                 animate-in zoom-in-95"
    >
      {/* 좌측 썸네일 */}
      <div className="w-[96px] shrink-0 relative self-stretch">
        <img
          src={getSportImage(room)}
          alt={room.sport}
          className="w-full h-full object-cover"
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
            <div className="flex items-center gap-1 shrink-0" ref={menuRef}>
              {menuOpen ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRoomClick(room); }}
                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
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
                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Icons.ShareIcon size={18} className="text-slate-500 dark:text-slate-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDeleteRoom(room); }}
                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
        {room.venue && (
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 tracking-[-0.025em] truncate flex items-center gap-1">
            <Icons.LocationArrowIcon size={12} className="shrink-0" />
            {room.venue}
          </p>
        )}

        {/* 3행: 날짜 + 시간 */}
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

        {/* 4행: 참가자 수 + 상태 뱃지 */}
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-black text-slate-800 dark:text-slate-200 tabular-nums tracking-[-0.025em] leading-none">
            {approvedCount}
            <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
            <span className="text-[12px] text-slate-400 dark:text-slate-500">{room.maxApplicants > 0 ? room.maxApplicants : t('unlimited')}</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <div className="text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white bg-blue-500">
                MY
              </div>
            )}
            <div className={`text-[12px] font-medium px-2 py-0.5 rounded-xl tracking-[-0.025em] text-white ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}>
              {isFull ? t('recruitFull') : t('recruiting')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
