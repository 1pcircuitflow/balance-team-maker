import React from 'react';
import { Player, Tier, SportType, AppPageType, BottomTabType, DetailPageTab, Position } from '../types';
import { TIER_BADGE_COLORS, SPORT_IMAGES, POSITIONS_BY_SPORT } from '../constants';
import { cancelApplication } from '../services/firebaseService';
import { FormationPicker } from '../components/FormationPicker';
import { QuotaFormationPicker } from '../components/QuotaFormationPicker';
import { parseTier, tierToLabel, applicantToPlayer } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { ArrowLeftIcon, CheckIcon } = Icons;

interface DetailPageProps {
  setShowMemberPickerModal: (v: boolean) => void;
}

export const DetailPage: React.FC<DetailPageProps> = React.memo(({
  setShowMemberPickerModal,
}) => {
  const { t, lang, darkMode, showAlert, setConfirmState } = useAppContext();
  const { isAdFree } = useAuthContext();
  const { players, setPlayers } = usePlayerContext();
  const { setCurrentPage, setCurrentBottomTab, detailTab, setDetailTab, touchStartX, setTouchStartX } = useNavigationContext();
  const {
    showTier, setShowTier, selectionMode, setSelectionMode,
    selectedPlayerIds, setSelectedPlayerIds, teamConstraints, setTeamConstraints,
    isBalanceSettingsOpen, setIsBalanceSettingsOpen,
    isQuotaSettingsExpanded, setIsQuotaSettingsExpanded,
    quotas, setQuotas, useRandomMix, setUseRandomMix,
    teamCount, setTeamCount, expectedPerTeam, updateQuota, toggleQuotaMode,
    handleGenerate, setResult,
  } = useTeamBalanceContext();
  const {
    currentActiveRoom: room,
    setHostRoomSelectedSport, setHostRoomTitle, setHostRoomVenue,
    setHostRoomDate, setHostRoomTime, setHostRoomEndDate, setHostRoomEndTime,
    setHostRoomUseLimit, setHostRoomMaxApplicants, setHostRoomTierMode,
    setHostRoomActivePicker, setHostRoomIsPickerSelectionMode,
    handleShareRecruitLink, handleCloseRecruitRoom,
    handleApproveApplicant, handleApproveAllApplicants, handleUpdateApplicant,
    activeActionMenuId, setActiveActionMenuId,
    editingApplicantId, setEditingApplicantId,
    setMemberSuggestion,
  } = useRecruitmentContext();

  if (!room) return null;
  const TIER_COLORS = TIER_BADGE_COLORS;
  const pendingApplicants = room.applicants.filter(a => !a.isApproved);
  const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
  const bgImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];

  return (
    <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex justify-between items-center px-4 w-full">
          <button
            onClick={() => {
              setCurrentPage(AppPageType.HOME);
              setCurrentBottomTab(BottomTabType.HOME);
            }}
            className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
          >
            <ArrowLeftIcon size={24} />
          </button>
          <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
            {t('manageMatchDetail')}
          </h3>
          <div className="w-8" />
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto px-5 pt-0 space-y-6 ${selectionMode ? 'pb-80' : 'pb-48'}`}>
        <div className="w-full">
          {/* Room banner */}
          <div className="w-full h-[120px] rounded-[24px] overflow-hidden relative shadow-xl border border-slate-100 dark:border-slate-800 shrink-0">
            <img src={bgImg} alt={room.sport} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
            <div className="absolute inset-0 p-3 flex flex-col justify-between text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-white/95 px-3 py-0 rounded-xl shrink-0">
                    <span className="text-black text-[12px] font-medium uppercase tracking-[-0.025em] leading-none">
                      {t(room.sport.toLowerCase())}
                    </span>
                  </div>
                  <h4 className="text-[16px] font-medium tracking-[-0.025em] drop-shadow-md truncate">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setHostRoomSelectedSport(room.sport as SportType);
                      setHostRoomTitle(room.title);
                      setHostRoomVenue(room.venue || '');
                      setHostRoomDate(room.matchDate);
                      setHostRoomTime(room.matchTime);
                      setHostRoomEndDate(room.matchEndDate || room.matchDate);
                      setHostRoomEndTime(room.matchEndTime || room.matchTime);
                      setHostRoomUseLimit(room.maxApplicants > 0);
                      setHostRoomMaxApplicants(room.maxApplicants || 12);
                      setHostRoomTierMode(room.tierMode || '5TIER');
                      setHostRoomActivePicker('START');
                      setHostRoomIsPickerSelectionMode(false);
                      setCurrentPage(AppPageType.EDIT_ROOM);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90"
                  >
                    <Icons.SettingsIcon size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const confirmData = handleCloseRecruitRoom(room);
                      setConfirmState({
                        isOpen: true,
                        title: confirmData.title,
                        message: confirmData.message,
                        confirmText: confirmData.confirmText,
                        onConfirm: async () => {
                          await confirmData.onConfirm();
                          setConfirmState((prev: any) => ({ ...prev, isOpen: false }));
                          setCurrentPage(AppPageType.HOME);
                        }
                      });
                    }}
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
                <button
                  onClick={(e) => { e.stopPropagation(); handleShareRecruitLink(room); }}
                  className="text-[12px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-xl bg-[#F43F5E] tracking-[-0.025em] active:scale-95 transition-transform shrink-0 flex items-center gap-1"
                >
                  <Icons.ShareIcon size={12} />{t('participationLink')}
                </button>
              </div>

              <div className="flex justify-between items-end gap-2">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium uppercase tracking-tighter" style={{ color: '#FFFFFF' }}>{t('matchDateAndTime')}</p>
                  <p className="text-[16px] font-medium tracking-tight leading-none">{room.matchDate} {room.matchTime}</p>
                </div>
                <div className="text-right leading-none">
                  <span className="text-[20px] font-medium tracking-tighter tabular-nums leading-none">
                    {room.applicants.filter(a => a.isApproved).length}
                    <span className="text-white mx-1">/</span>
                    <span className="text-[12px]">{room.maxApplicants > 0 ? room.maxApplicants : '\u221E'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800 gap-8 mt-4">
            <button
              onClick={() => setDetailTab(DetailPageTab.PENDING)}
              className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.PENDING
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('pendingApplicantsList')}</span>
              <span className="text-[11px] opacity-60">({pendingApplicants.length})</span>
              {detailTab === DetailPageTab.PENDING && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
            <button
              onClick={() => setDetailTab(DetailPageTab.APPROVED)}
              className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.APPROVED
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('approvedParticipantsList')}</span>
              <span className="text-[11px] opacity-60">({room.applicants.filter(a => a.isApproved).length})</span>
              {detailTab === DetailPageTab.APPROVED && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
          </div>

          {/* Swipeable content */}
          <div
            className="flex flex-col gap-6 relative mt-3 flex-1 min-h-[400px]"
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null) return;
              const touchEndX = e.changedTouches[0].clientX;
              const diff = touchStartX - touchEndX;
              const threshold = 60;
              if (Math.abs(diff) > threshold) {
                if (diff > 0 && detailTab === DetailPageTab.PENDING) {
                  setDetailTab(DetailPageTab.APPROVED);
                } else if (diff < 0 && detailTab === DetailPageTab.APPROVED) {
                  setDetailTab(DetailPageTab.PENDING);
                }
              }
              setTouchStartX(null);
            }}
          >
            {/* Action buttons row */}
            <div className="flex items-center w-full gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setShowTier(!showTier)}
                className={`px-[8px] h-[28px] flex items-center justify-center rounded-xl text-[12px] font-medium transition-all active:scale-95 border whitespace-nowrap shrink-0 ${showTier ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
              >
                {showTier ? t('hideTier') : t('showTier')}
              </button>

              <div className="flex gap-[8px] items-center shrink-0">
                {detailTab === DetailPageTab.APPROVED && (
                  <>
                    <button
                      onClick={() => { setSelectionMode(selectionMode === 'MATCH' ? null : 'MATCH'); setSelectedPlayerIds([]); }}
                      className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${selectionMode === 'MATCH' ? 'bg-blue-500 text-white border border-blue-500 shadow-lg shadow-blue-500/30' : 'border-2 border-blue-200 dark:border-blue-800 text-blue-500 dark:text-blue-400 bg-transparent'}`}
                    >
                      <div className="w-[16px] h-[16px] rounded bg-blue-500 text-white flex items-center justify-center text-[9px] font-black">M</div>
                      {t('matchTeams')}
                    </button>
                    <button
                      onClick={() => { setSelectionMode(selectionMode === 'SPLIT' ? null : 'SPLIT'); setSelectedPlayerIds([]); }}
                      className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${selectionMode === 'SPLIT' ? 'bg-rose-500 text-white border border-rose-500 shadow-lg shadow-rose-500/30' : 'border-2 border-rose-200 dark:border-rose-800 text-rose-500 dark:text-rose-400 bg-transparent'}`}
                    >
                      <div className="w-[16px] h-[16px] rounded bg-rose-500 text-white flex items-center justify-center text-[9px] font-black">S</div>
                      {t('splitTeams')}
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center shrink-0 ml-auto">
                {detailTab === DetailPageTab.APPROVED && (
                  <button
                    onClick={() => setShowMemberPickerModal(true)}
                    className="bg-[#4685EB] text-white rounded-xl text-[12px] font-medium px-[8px] h-[28px] flex items-center justify-center transition-all active:scale-95 mr-2 whitespace-nowrap shrink-0"
                  >
                    {t('addParticipant')}
                  </button>
                )}

                {detailTab === DetailPageTab.PENDING && pendingApplicants.length > 0 && (
                  <button
                    onClick={() => handleApproveAllApplicants(room)}
                    className="bg-blue-600 text-white rounded-xl text-[12px] font-medium px-6 py-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
                  >
                    {t('approveAll')}
                  </button>
                )}
              </div>
            </div>

            {/* Constraints display */}
            {(() => {
              const approvedIds = new Set(room.applicants.filter(a => a.isApproved).map(a => {
                const member = players.find(p => p.name === a.name);
                return member ? member.id : a.id;
              }));
              const filtered = teamConstraints.filter(c => c.playerIds.every(id => approvedIds.has(id)));
              return detailTab === DetailPageTab.APPROVED && filtered.length > 0 && (
              <div className="flex flex-col gap-2 -mt-4 -mb-4 px-1">
                <h3 className="text-[12px] font-medium text-slate-900 dark:text-slate-100 tracking-widest px-1">{t('activeConstraintsTitle')}</h3>
                <div className="flex flex-wrap gap-2">
                  {filtered.map((c) => {
                    const playerNames = c.playerIds.map(id => {
                      const app = room.applicants.find(a => a.id === id);
                      return app ? app.name : (players.find(p => p.id === id)?.name || id);
                    }).join(', ');
                    return (
                      <div key={c.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl px-3 py-1.5 shadow-sm">
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-black text-white ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                          {c.type === 'MATCH' ? 'M' : 'S'}
                        </div>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{playerNames}</span>
                        <button
                          onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Icons.CloseIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );})()}

            {/* Applicant list */}
            <div className="space-y-1">
              {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).map((app) => {
                const tierVal = parseTier(app.tier);
                const tierLabel = tierToLabel(app.tier);
                const member = players.find(p => p.name === app.name);
                const effectiveId = member ? member.id : app.id;
                const isSelected = selectedPlayerIds.includes(effectiveId);
                const playerConstraint = teamConstraints.find(c => c.playerIds.includes(effectiveId));

                return (
                  <React.Fragment key={app.id}>
                    <div
                      onClick={() => {
                        if (selectionMode && detailTab === DetailPageTab.APPROVED) {
                          setSelectedPlayerIds(prev =>
                            prev.includes(effectiveId) ? prev.filter(x => x !== effectiveId) : [...prev, effectiveId]
                          );
                        }
                      }}
                      className={`bg-white dark:bg-slate-950 flex items-center justify-between px-2 py-1 rounded-2xl transition-all ${selectionMode && detailTab === DetailPageTab.APPROVED ? 'cursor-pointer active:scale-[0.98]' : ''} ${selectionMode && isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        {selectionMode && detailTab === DetailPageTab.APPROVED && (
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            {isSelected && <CheckIcon />}
                          </div>
                        )}
                        <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                          BELO
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            {showTier && (
                              <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]}`}>
                                {tierLabel}
                              </span>
                            )}
                            <span className="text-[16px] font-medium text-slate-900 dark:text-white">
                              {app.name}
                            </span>
                            {playerConstraint && (
                              <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-black text-white ${playerConstraint.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                {playerConstraint.type === 'MATCH' ? 'M' : 'S'}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {app.primaryPositions?.map((pos, idx) => (
                              <div key={`p-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos}</span>
                              </div>
                            ))}
                            {app.secondaryPositions?.map((pos, idx) => (
                              <div key={`s-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                <span className="text-[12px] font-medium text-[#FACC16] uppercase">{pos}</span>
                              </div>
                            ))}
                            {app.tertiaryPositions?.map((pos, idx) => (
                              <div key={`t-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                <span className="text-[12px] font-medium text-[#FB933C] uppercase">{pos}</span>
                              </div>
                            ))}
                            {!app.primaryPositions && !app.secondaryPositions && !app.tertiaryPositions && (
                              app.position ? app.position.split('/').map((pos, idx) => (
                                <div key={idx} className="flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                  <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos.trim()}</span>
                                </div>
                              )) : (
                                <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600 italic">{t('notSet')}</span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {detailTab === DetailPageTab.PENDING ? (
                          <>
                            <button
                              onClick={() => cancelApplication(room.id, app)}
                              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                            >
                              {t('reject')}
                            </button>
                            <button
                              onClick={() => handleApproveApplicant(room, app)}
                              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                            >
                              {t('approve')}
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 relative">
                            {activeActionMenuId === app.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                                <button
                                  onClick={() => {
                                    const isCurrentlyEditing = editingApplicantId === app.id;
                                    setEditingApplicantId(isCurrentlyEditing ? null : app.id);
                                    if (isCurrentlyEditing) {
                                      setActiveActionMenuId(null);
                                    }
                                  }}
                                  className={`text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-md transition-all active:scale-95 ${editingApplicantId === app.id ? 'bg-slate-900 dark:bg-white dark:text-slate-900' : 'bg-[#EDAE73]'}`}
                                >
                                  {editingApplicantId === app.id ? t('confirm') : t('edit')}
                                </button>
                                <button
                                  onClick={() => {
                                    const isMember = players.some(p => p.name === app.name);
                                    cancelApplication(room.id, app);
                                    if (!isMember) {
                                      setMemberSuggestion({ isOpen: true, applicant: app });
                                    }
                                    setActiveActionMenuId(null);
                                  }}
                                  className="text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 bg-[#53B175] rounded-md transition-all active:scale-95"
                                >
                                  {t('exclude')}
                                </button>
                                <button
                                  onClick={() => setActiveActionMenuId(null)}
                                  className="p-1 text-slate-300 dark:text-slate-600"
                                >
                                  <Icons.CloseIcon />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveActionMenuId(app.id)}
                                className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
                              >
                                <Icons.MoreIcon />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {editingApplicantId === app.id && detailTab === DetailPageTab.APPROVED && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[24px] p-4 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-5 gap-1.5">
                          {(room.tierMode === '3TIER' ? ['S', 'A', 'B'] : ['S', 'A', 'B', 'C', 'D']).map(v => (
                            <button
                              key={v}
                              onClick={() => handleUpdateApplicant(room, app.id, { tier: v })}
                              className={`py-2 rounded-xl font-medium text-[11px] transition-all ${app.tier === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400'}`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-2">
                          <FormationPicker
                            sport={room.sport as SportType}
                            primaryP={app.primaryPositions || (app.position ? app.position.split('/') as Position[] : [])}
                            secondaryP={app.secondaryPositions || []}
                            tertiaryP={app.tertiaryPositions || []}
                            forbiddenP={app.forbiddenPositions || []}
                            lang={lang}
                            onChange={(p, s, t, f) => handleUpdateApplicant(room, app.id, {
                              primaryPositions: p,
                              secondaryPositions: s,
                              tertiaryPositions: t,
                              forbiddenPositions: f,
                              position: p.join('/')
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).length === 0 && (
                <div className="py-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <Icons.UsersIcon size={24} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight">{detailTab === DetailPageTab.PENDING ? t('noPendingApplicants') : t('noPlayers')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Balance settings overlay backdrop */}
          {isBalanceSettingsOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => {
                setIsBalanceSettingsOpen(false);
                setIsQuotaSettingsExpanded(false);
              }}
            />
          )}

          {/* Balance settings bottom sheet */}
          <div
            className={`fixed left-0 right-0 z-50 flex flex-col items-center transition-all duration-300 ${isBalanceSettingsOpen ? 'bottom-0 bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]' : ''}`}
            style={{
              bottom: isBalanceSettingsOpen
                ? 0
                : (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))'),
              paddingBottom: isBalanceSettingsOpen
                ? (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))')
                : 0,
              maxHeight: isBalanceSettingsOpen ? '85vh' : 'auto',
            }}
          >
            <div className={`w-full max-w-lg px-5 ${isBalanceSettingsOpen ? 'pt-5 overflow-y-auto' : ''}`} style={isBalanceSettingsOpen ? { maxHeight: 'calc(85vh - 80px)' } : undefined}>
              {isBalanceSettingsOpen && (
                <div className="w-full mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="overflow-hidden">
                    <button
                      onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                      className="w-full py-3 relative flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded-[24px] text-slate-900 dark:text-slate-100 font-medium text-[16px] tracking-tight active:scale-[0.98] transition-all"
                    >
                      <span style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
                        {t('positionSettings')}
                      </span>
                      <div className={`absolute right-6 transition-transform duration-300 ${isQuotaSettingsExpanded ? 'rotate-180' : ''} text-slate-900/50 dark:text-slate-100/50`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </button>

                    {isQuotaSettingsExpanded && (
                      <div className="pt-4 pb-2 px-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <QuotaFormationPicker
                          sport={room.sport as SportType}
                          quotas={quotas}
                          lang={lang}
                          onUpdate={updateQuota}
                          onToggleMode={toggleQuotaMode}
                          darkMode={darkMode}
                        />
                        {room.sport !== SportType.GENERAL && (
                          <>
                            <div className="mt-3 flex items-center gap-2 px-2">
                              <button
                                onClick={() => {
                                  const sport = room.sport as SportType;
                                  if (sport === SportType.SOCCER) {
                                    const perTeam = expectedPerTeam || 5;
                                    setQuotas({ GK: 1, LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null, MF: null, LW: null, ST: null, RW: null });
                                  } else if (sport === SportType.FUTSAL) {
                                    setQuotas({ GK: 1, FIX: 1, ALA: null, PIV: null });
                                  } else if (sport === SportType.BASKETBALL) {
                                    setQuotas({ C: 1, PG: 1, SG: null, SF: null, PF: null });
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold border border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                              >
                                ⚡ {t('recommendedPreset')}
                              </button>
                            </div>
                            <div className="mt-3 mx-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                                💡 {t('quotaHelpText')}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mt-1">
                    <div className="py-3 bg-white dark:bg-slate-900 rounded-[24px] px-5 flex items-center">
                      <button
                        onClick={() => setUseRandomMix(!useRandomMix)}
                        className="w-full flex items-center justify-between transition-all text-slate-900 dark:text-slate-100"
                      >
                        <span className="text-[16px] font-medium tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('randomMix')}</span>
                        <div className={`w-[18px] h-[18px] rounded-sm flex items-center justify-center border-[1.5px] transition-all ${useRandomMix ? 'bg-slate-500 dark:bg-slate-400 border-slate-500 dark:border-slate-400' : 'border-slate-400 dark:border-slate-500'}`}>
                          {useRandomMix && <Icons.CheckIcon size={12} className="text-white dark:text-slate-900" />}
                        </div>
                      </button>
                    </div>

                    <div className="py-3 bg-white dark:bg-slate-900 rounded-[24px] px-5 flex items-center justify-between">
                      <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('teamCountLabel')}</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setTeamCount(Math.max(2, teamCount - 1))} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.MinusIcon size={16} /></button>
                        <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight tabular-nums w-4 text-center" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{teamCount}</span>
                        <button onClick={() => setTeamCount(Math.min(10, teamCount + 1))} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.PlusIcon size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!isBalanceSettingsOpen) {
                    setIsBalanceSettingsOpen(true);
                    return;
                  }

                  const approvedApps = room.applicants.filter(a => a.isApproved);
                  if (approvedApps.length < 2) {
                    showAlert(t('minPlayersAlert', 2, approvedApps.length));
                    return;
                  }

                  const manualPlayers: Player[] = approvedApps.map(app => {
                    const member = players.find(p => p.name === app.name);
                    return applicantToPlayer(app, room.sport as SportType, { existingId: member?.id || app.id });
                  });

                  const perTeamCount = Math.floor(manualPlayers.length / teamCount);
                  const targetSportSub = room.sport as SportType;
                  const validPosForSport = POSITIONS_BY_SPORT[targetSportSub] || ['NONE'];

                  const totalQuotaSum = Object.entries(quotas).reduce((sum, [pos, v]) => {
                    if (validPosForSport.includes(pos as Position)) {
                      return sum + (Number(v) || 0);
                    }
                    return sum;
                  }, 0 as number);

                  if ((totalQuotaSum as number) > (perTeamCount as number)) {
                    showAlert(t('quotaOverMaxAlert', perTeamCount, totalQuotaSum));
                    return;
                  }

                  setPlayers(prev => {
                    const newList = [...prev];
                    approvedApps.forEach(app => {
                      const existing = newList.find(p => p.name === app.name);
                      if (existing) {
                        existing.isActive = true;
                      } else {
                        const tierVal = parseTier(app.tier);
                        newList.push({
                          id: 'p_' + Math.random().toString(36).substr(2, 9),
                          name: app.name,
                          tier: tierVal,
                          isActive: true,
                          sportType: room.sport as SportType,
                          primaryPosition: (app.position as Position) || 'NONE',
                          primaryPositions: (app.primaryPositions as Position[]) || [],
                          secondaryPositions: (app.secondaryPositions as Position[]) || [],
                          tertiaryPositions: (app.tertiaryPositions as Position[]) || []
                        });
                      }
                    });
                    return newList;
                  });

                  setResult(null);
                  setSelectedPlayerIds([]);
                  setSelectionMode(null);
                  handleGenerate(manualPlayers, room.sport as SportType);
                  setIsBalanceSettingsOpen(false);
                }}
                className={`w-full py-3 rounded-[24px] text-[16px] font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 ${isBalanceSettingsOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-slate-900/40 dark:shadow-white/20'}`}
                style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
              >
                {t('generateTeams')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
