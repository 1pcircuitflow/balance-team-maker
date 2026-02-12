import React from 'react';
import { AppPageType } from '../types';
import { SPORT_IMAGES } from '../constants';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { PlusIcon } = Icons;

export const HomePage: React.FC = () => {
  const { t, showConfirm, setConfirmState } = useAppContext();
  const { setCurrentPage } = useNavigationContext();
  const {
    filteredRooms, setCurrentActiveRoom, setShowHostRoomModal,
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
  return (
    <section className="w-full px-5 mb-5" data-capture-ignore="true">
      <div className="space-y-4">
        {filteredRooms.length === 0 ? (
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
            {filteredRooms.map((room) => {
              const pendingApplicants = room.applicants.filter(a => !a.isApproved);
              return (
                <div
                  key={room.id}
                  onClick={() => onRoomClick(room)}
                  className="w-full h-[120px] rounded-[24px] overflow-hidden relative group active:scale-[0.98] transition-all shadow-xl animate-in zoom-in-95 duration-500 cursor-pointer"
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
                      </div>
                    </div>

                    <div className="flex items-center justify-between my-auto">
                      <div className="flex-1 min-w-0">
                        {room.venue && (
                          <p className="text-[13px] font-medium text-white tracking-[-0.025em] truncate">{room.venue}</p>
                        )}
                      </div>
                      {(() => {
                        const approvedCount = room.applicants.filter(a => a.isApproved).length;
                        const isFull = room.maxApplicants > 0 && approvedCount >= room.maxApplicants;
                        return (
                          <div className={`text-[12px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-xl tracking-[-0.025em] shrink-0 ${isFull ? 'bg-[#F43F5E]' : 'bg-[#53B175]'}`}>
                            {isFull ? t('recruitFull') : t('recruiting')}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex justify-between items-end gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[12px] font-medium uppercase tracking-[-0.025em]" style={{ color: '#FFFFFF' }}>{t('matchDateTimeLabel')}</p>
                        <p className="text-[16px] font-medium tracking-[-0.025em] leading-none">{room.matchDate} {room.matchTime}</p>
                      </div>

                      <div className="text-right leading-none flex flex-col items-end">
                        <span className="text-[20px] font-black tracking-[-0.025em] tabular-nums leading-none">
                          {room.applicants.filter(a => a.isApproved).length}
                          <span className="text-white mx-1">/</span>
                          <span className="text-[12px]">{room.maxApplicants > 0 ? room.maxApplicants : t('unlimited')}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={onCreateRoom}
              className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group mt-2"
            >
              <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                <PlusIcon />
              </div>
            </button>
          </>
        )}
      </div>
    </section>
  );
};
