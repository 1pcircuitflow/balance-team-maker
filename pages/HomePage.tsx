import React from 'react';
import { AppPageType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { PlusIcon } = Icons;

export const HomePage: React.FC = () => {
  const { t, showConfirm, setConfirmState } = useAppContext();
  const { setCurrentPage } = useNavigationContext();
  const {
    filteredRooms, publicRooms, homeTab, setHomeTab,
    setCurrentActiveRoom, setShowHostRoomModal,
    handleShareRecruitLink, handleCloseRecruitRoom,
    setPendingJoinRoomId, setShowApplyRoomModal,
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
  const onApplyPublicRoom = (room: any) => {
    setPendingJoinRoomId(room.id);
    setShowApplyRoomModal(true);
  };

  return (
    <section className="w-full px-5 mb-5" data-capture-ignore="true">
      {/* 내 경기 / 공개 경기 탭 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setHomeTab('MY')}
          className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all border ${homeTab === 'MY' ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-slate-500 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'}`}
        >
          {t('myMatches' as any)}
        </button>
        <button
          onClick={() => setHomeTab('PUBLIC')}
          className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all border ${homeTab === 'PUBLIC' ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-slate-500 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'}`}
        >
          {t('publicMatches' as any)}
        </button>
      </div>

      <div className="space-y-4">
        {homeTab === 'MY' ? (
          /* ===== 내 경기 탭 (기존) ===== */
          filteredRooms.length === 0 ? (
            <button
              onClick={onCreateRoom}
              className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl group-hover:scale-110 transition-transform">
                <PlusIcon />
              </div>
              <p className="text-[12px] font-black text-slate-400 dark:text-slate-500 px-8 text-center leading-relaxed">{t('noScheduledMatch')}</p>
            </button>
          ) : (
            <>
              {filteredRooms.map((room) => (
                <RoomCard key={room.id} room={room} isPublicView={false} t={t}
                  onRoomClick={onRoomClick} onShareLink={onShareLink} onDeleteRoom={onDeleteRoom} />
              ))}

              <button
                onClick={onCreateRoom}
                className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group mt-2"
              >
                <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                  <PlusIcon />
                </div>
              </button>
            </>
          )
        ) : (
          /* ===== 공개 경기 탭 ===== */
          publicRooms.length === 0 ? (
            <div className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
              <p className="text-[12px] font-black text-slate-400 dark:text-slate-500 px-8 text-center leading-relaxed">{t('noPublicMatches' as any)}</p>
            </div>
          ) : (
            publicRooms.map((room) => (
              <RoomCard key={room.id} room={room} isPublicView={true} t={t}
                onRoomClick={() => {}} onShareLink={() => {}} onDeleteRoom={() => {}}
                onApply={onApplyPublicRoom} />
            ))
          )
        )}
      </div>
    </section>
  );
};

// 공통 방 카드 컴포넌트 (내 경기 / 공개 경기 겸용)
const RoomCard: React.FC<{
  room: any;
  isPublicView: boolean;
  t: (key: string, ...args: any[]) => string;
  onRoomClick: (room: any) => void;
  onShareLink: (room: any) => void;
  onDeleteRoom: (room: any) => void;
  onApply?: (room: any) => void;
}> = ({ room, isPublicView, t, onRoomClick, onShareLink, onDeleteRoom, onApply }) => {
  const pendingApplicants = room.applicants.filter((a: any) => !a.isApproved);
  const approvedCount = room.applicants.filter((a: any) => a.isApproved).length;
  const isFull = room.maxApplicants > 0 && approvedCount >= room.maxApplicants;

  return (
    <div
      onClick={() => !isPublicView && onRoomClick(room)}
      className={`w-full h-[120px] rounded-[24px] overflow-hidden relative group active:scale-[0.98] transition-all shadow-xl animate-in zoom-in-95 duration-500 ${!isPublicView ? 'cursor-pointer' : ''}`}
    >
      <img
        src={(() => {
          const seed = room.id ? room.id.charCodeAt(room.id.length - 1) % 2 + 1 : 1;
          const sport = room.sport.toLowerCase();
          const name = sport === 'general' ? 'tennis' : sport;
          return `/images/${name}-${seed}.jpeg`;
        })()}
        alt={room.sport}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />

      <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="bg-white/95 px-3 py-0 rounded-xl shrink-0">
              <span className="text-black text-[12px] font-medium uppercase tracking-[-0.025em] leading-none">
                {t(room.sport.toLowerCase())}
              </span>
            </div>
            <h4 className="text-[16px] font-black tracking-[-0.025em] drop-shadow-md truncate">
              {room.title}
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isPublicView && (
              <>
                <div className="relative p-1.5 transition-colors">
                  <Icons.UsersIcon size={18} className="text-white/90" />
                  {pendingApplicants.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black/50 animate-pulse">
                      {pendingApplicants.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onShareLink(room); }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Icons.ShareIcon size={18} className="text-white/90" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteRoom(room); }}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-rose-400"
                >
                  <Icons.TrashIcon size={18} className="text-white/90" />
                </button>
              </>
            )}
            {isPublicView && onApply && (
              <button
                onClick={(e) => { e.stopPropagation(); onApply(room); }}
                disabled={isFull}
                className={`px-3 py-1 rounded-xl text-[12px] font-bold transition-all active:scale-95 ${isFull ? 'bg-slate-500/50 text-white/50 cursor-not-allowed' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'}`}
              >
                {isFull ? t('recruitFull') : t('applyJoin' as any)}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between my-auto">
          <div className="flex-1 min-w-0">
            {room.venue && (
              <p className="text-[13px] font-medium text-white tracking-[-0.025em] truncate">{room.venue}</p>
            )}
          </div>
          {isPublicView ? (
            <div className="text-[11px] font-medium text-white/70 px-2 py-0.5 rounded-xl bg-white/10 shrink-0">
              {room.hostName}
            </div>
          ) : (
            <div className={`text-[12px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-xl tracking-[-0.025em] shrink-0 ${isFull ? 'bg-[#F43F5E]' : 'bg-[#53B175]'}`}>
              {isFull ? t('recruitFull') : t('recruiting')}
            </div>
          )}
        </div>

        <div className="flex justify-between items-end gap-2">
          <div className="space-y-0.5">
            <p className="text-[12px] font-medium uppercase tracking-[-0.025em]" style={{ color: '#FFFFFF' }}>{t('matchDateTimeLabel')}</p>
            <p className="text-[16px] font-medium tracking-[-0.025em] leading-none">{room.matchDate} {room.matchTime}</p>
          </div>

          <div className="text-right leading-none flex flex-col items-end">
            <span className="text-[20px] font-black tracking-[-0.025em] tabular-nums leading-none">
              {room.applicants.filter((a: any) => a.isApproved).length}
              <span className="text-white mx-1">/</span>
              <span className="text-[12px]">{room.maxApplicants > 0 ? room.maxApplicants : t('unlimited')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
