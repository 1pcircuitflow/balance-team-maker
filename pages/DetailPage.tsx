import React from 'react';
import { Player, Tier, SportType, AppPageType, DetailPageTab, Position, BalanceResult } from '../types';
import { TIER_BADGE_COLORS, SPORT_IMAGES, POSITIONS_BY_SPORT, Z_INDEX } from '../constants';
import { cancelApplication, cancelMyApplication, applyForParticipation, incrementViewCount, toggleLikeRoom, removeChatMember, sendSystemMessage } from '../services/firebaseService';
import { FormationPicker } from '../components/FormationPicker';
import { QuotaFormationPicker } from '../components/QuotaFormationPicker';
import { parseTier, tierToLabel, applicantToPlayer, upsertPlayerFromApplicant, getApplicantStatus, getApprovedCount, isRoomFull } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import * as Icons from '../Icons';

const { ArrowLeftIcon, CheckIcon, CrownIcon } = Icons;

interface DetailPageProps {
  setShowMemberPickerModal: (v: boolean) => void;
}

export const DetailPage: React.FC<DetailPageProps> = React.memo(({
  setShowMemberPickerModal,
}) => {
  const [processingApplicantId, setProcessingApplicantId] = React.useState<string | null>(null);
  const { t, lang, darkMode, showAlert, setConfirmState } = useAppContext();
  const { isAdFree, adBannerHeight, currentUserId, userNickname, userProfile } = useAuthContext();
  const { players, setPlayers } = usePlayerContext();
  const { navigateToHome, detailTab, setDetailTab, touchStartX, setTouchStartX, navigateToUserProfile, navigateToApplicantProfile, navigateTo, goBack } = useNavigationContext();
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
    currentActiveRoom: room, setCurrentActiveRoom,
    setHostRoomSelectedSport, setHostRoomTitle, setHostRoomVenue, setHostRoomVenueData, setHostRoomDescription,
    setHostRoomDate, setHostRoomTime, setHostRoomEndDate, setHostRoomEndTime,
    setHostRoomUseLimit, setHostRoomMaxApplicants,
    setHostRoomVisibility,
    setHostRoomActivePicker, setHostRoomIsPickerSelectionMode,
    handleShareRecruitLink, handleCloseRecruitRoom, handleToggleRoomStatus,
    handleApproveApplicant, handleRejectApplicant, handleRestoreApplicant, handleApproveAllApplicants, handleUpdateApplicant,
    activeActionMenuId, setActiveActionMenuId,
    editingApplicantId, setEditingApplicantId,
    setMemberSuggestion,
  } = useRecruitmentContext();

  // 게스트용 참가신청 상태 (userProfile에서 자동 채움)
  const roomSport = room?.sport as SportType | undefined;
  const sportProfile = roomSport ? userProfile?.sports?.[roomSport] : undefined;
  const [isApplyFormOpen, setIsApplyFormOpen] = React.useState(false);
  const [applyName, setApplyName] = React.useState(userNickname);
  const [applyTier, setApplyTier] = React.useState(sportProfile?.tier || 'B');
  const [applyPrimaryPos, setApplyPrimaryPos] = React.useState<string[]>(sportProfile?.primaryPositions || []);
  const [applySecondaryPos, setApplySecondaryPos] = React.useState<string[]>(sportProfile?.secondaryPositions || []);
  const [applyTertiaryPos, setApplyTertiaryPos] = React.useState<string[]>(sportProfile?.tertiaryPositions || []);
  const [applyForbiddenPos, setApplyForbiddenPos] = React.useState<string[]>(sportProfile?.forbiddenPositions || []);

  React.useEffect(() => { setApplyName(userNickname); }, [userNickname]);
  React.useEffect(() => {
    if (sportProfile) {
      setApplyTier(sportProfile.tier || 'B');
      setApplyPrimaryPos(sportProfile.primaryPositions || []);
      setApplySecondaryPos(sportProfile.secondaryPositions || []);
      setApplyTertiaryPos(sportProfile.tertiaryPositions || []);
      setApplyForbiddenPos(sportProfile.forbiddenPositions || []);
    }
  }, [sportProfile]);
  const [applyLoading, setApplyLoading] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);
  const [likeLoading, setLikeLoading] = React.useState(false);
  const [optimisticLiked, setOptimisticLiked] = React.useState<boolean | null>(null);

  // 하단 바 높이 측정 (채팅 FAB + 스크롤 패딩 동적 계산용)
  const bottomBarRef = React.useRef<HTMLDivElement>(null);
  const [bottomBarH, setBottomBarH] = React.useState(160);

  React.useEffect(() => {
    if (isBalanceSettingsOpen || isApplyFormOpen) return;
    const el = bottomBarRef.current;
    if (!el) return;
    const measure = () => setBottomBarH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isBalanceSettingsOpen, isApplyFormOpen, room?.hostId, currentUserId]);

  // 조회수 증가 (상세페이지 진입 시 1회)
  React.useEffect(() => {
    if (room?.id) {
      incrementViewCount(room.id);
    }
  }, [room?.id]);

  // Firestore 데이터가 실제로 갱신되면 optimistic 상태 리셋
  React.useEffect(() => {
    setOptimisticLiked(null);
  }, [room?.likedBy]);

  const isLiked = optimisticLiked !== null
    ? optimisticLiked
    : (currentUserId ? (room?.likedBy || []).includes(currentUserId) : false);
  const handleToggleLike = async () => {
    if (!currentUserId || !room?.id || likeLoading) return;
    setLikeLoading(true);
    setOptimisticLiked(!isLiked);
    try {
      await toggleLikeRoom(room.id, currentUserId);
    } catch {
      setOptimisticLiked(null);
    } finally {
      setLikeLoading(false);
    }
  };

  if (!room) return null;
  const isHost = room.hostId === currentUserId;
  const TIER_COLORS = TIER_BADGE_COLORS;
  const isFull = isRoomFull(room);
  const pendingApplicants = room.applicants.filter(a => getApplicantStatus(a) === 'PENDING');
  const rejectedApplicants = room.applicants.filter(a => getApplicantStatus(a) === 'REJECTED');
  const approvedApplicants = room.applicants.filter(a => getApplicantStatus(a) === 'APPROVED');
  const myApplication = !isHost ? room.applicants.find(a => a.userId === currentUserId) : null;
  const myStatus = myApplication ? getApplicantStatus(myApplication) : null;
  const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
  const fallbackImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];
  const bgImg = room.venueData?.photoUrl || fallbackImg;

  return (
    <div className="fixed left-0 right-0 top-0 bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden" style={{
      zIndex: Z_INDEX.PAGE_OVERLAY,
      bottom: `calc(${adBannerHeight > 0 ? adBannerHeight + 24 : 0}px + ${adBannerHeight === 0 ? 'env(safe-area-inset-bottom, 0px)' : '0px'})`,
    }}>
      <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-950 shrink-0">
        <div className="flex justify-between items-center px-4 w-full">
          <button
            onClick={() => goBack()}
            className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
          >
            <ArrowLeftIcon size={24} />
          </button>
          <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
            {isHost ? t('manageMatchDetail') : t('matchDetail')}
          </h3>
          {currentUserId ? (
            <button
              onClick={handleToggleLike}
              disabled={likeLoading}
              className="p-1 -mr-1 transition-all active:scale-90 disabled:opacity-50"
            >
              <Icons.HeartIcon size={22} filled={isLiked} className={isLiked ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'} />
            </button>
          ) : (
            <div className="w-8" />
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-0 space-y-6" style={{ paddingBottom: '24px' }}>
        <div className="w-full">
          {/* Room banner */}
          <div className="w-full h-[120px] rounded-3xl overflow-hidden relative shadow-xl border border-slate-100 dark:border-transparent shrink-0">
            <img src={bgImg} alt={room.sport} className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }} />
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

                {isHost && (
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
                      setHostRoomVenue(room.venueData?.placeName || room.venue || '');
                      setHostRoomVenueData(room.venueData || null);
                      setHostRoomDescription(room.description || '');
                      setHostRoomDate(room.matchDate);
                      setHostRoomTime(room.matchTime);
                      setHostRoomEndDate(room.matchEndDate || room.matchDate);
                      setHostRoomEndTime(room.matchEndTime || room.matchTime);
                      setHostRoomUseLimit(room.maxApplicants > 0);
                      setHostRoomMaxApplicants(room.maxApplicants || 12);
                      setHostRoomVisibility(room.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE');
                      setHostRoomActivePicker('START');
                      setHostRoomIsPickerSelectionMode(false);
                      navigateTo(AppPageType.EDIT_ROOM);
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
                          navigateToHome();
                        }
                      });
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-rose-400"
                  >
                    <Icons.TrashIcon size={18} className="text-white/90" />
                  </button>
                </div>
                )}
              </div>

              <div className="flex items-center justify-between my-auto">
                <div className="flex-1 min-w-0">
                  {(room.venueData?.placeName || room.venue) && (
                    <p className="text-[13px] font-medium text-white tracking-[-0.025em] truncate">{room.venueData?.placeName || room.venue}</p>
                  )}
                </div>
                {(isHost || room.visibility !== 'PRIVATE') && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleShareRecruitLink(room); }}
                  className="text-[12px] font-medium text-white px-2 py-0.5 rounded-xl bg-rose-500 tracking-[-0.025em] active:scale-95 transition-transform shrink-0 flex items-center gap-1"
                >
                  <Icons.ShareIcon size={12} />{t('participationLink')}
                </button>
                )}
              </div>

              <div className="flex justify-between items-end gap-2">
                <div className="space-y-0.5">
                  <p className="text-[12px] font-medium uppercase tracking-tighter text-white">{t('matchDateAndTime')}</p>
                  <p className="text-[16px] font-medium tracking-tight leading-none">{room.matchDate} {room.matchTime}</p>
                </div>
                <div className="text-right leading-none">
                  <span className="text-[20px] font-medium tracking-tighter tabular-nums leading-none">
                    {getApprovedCount(room.applicants)}
                    <span className="text-white mx-1">/</span>
                    <span className="text-[12px]">{room.maxApplicants > 0 ? room.maxApplicants : '\u221E'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 위치 정보 바 */}
          {room.venueData?.address && (
            <div className="mt-3 flex items-center gap-2 bg-white dark:bg-slate-950 px-4 py-0 rounded-2xl border border-slate-100/50 dark:border-transparent">
              <span className="text-[16px] font-semibold text-slate-900 dark:text-white shrink-0">{t('address' as any)}</span>
              <p className="flex-1 text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate">{room.venueData.address}</p>
              <button
                onClick={async () => {
                  const addressText = `${room.venueData!.placeName}\n${room.venueData!.address}`;
                  try {
                    if (Capacitor.isNativePlatform()) {
                      await Share.share({ text: addressText });
                    } else {
                      await Clipboard.write({ string: addressText });
                      showAlert(t('addressCopied' as any));
                    }
                  } catch {
                    try {
                      await Clipboard.write({ string: addressText });
                      showAlert(t('addressCopied' as any));
                    } catch { /* silent */ }
                  }
                }}
                className="shrink-0 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-90 transition-transform"
              >
                <Icons.ShareIcon size={18} />
              </button>
            </div>
          )}

          {/* 방장 프로필 카드 */}
          {room.hostName && (() => {
            const hostApp = room.applicants.find(a => a.userId === room.hostId);
            return (
            <div className="mt-3">
              <div
                onClick={() => room.hostId && navigateToUserProfile(room.hostId)}
                className="flex items-center justify-between bg-white dark:bg-slate-950 px-2 py-1 rounded-2xl border border-slate-100/50 dark:border-transparent cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="w-[52px] h-[52px] rounded-full bg-[#eaeef4] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-400 dark:text-slate-400 shrink-0 overflow-hidden">
                    {hostApp?.photoUrl ? (
                      <img src={hostApp.photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : 'BELO'}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[16px] font-medium text-slate-900 dark:text-white">{room.hostName}</span>
                      <CrownIcon size={14} className="text-amber-400" />
                    </div>
                    {room.sport !== SportType.GENERAL && (
                    <div className="flex items-center gap-1.5">
                      {hostApp?.primaryPositions?.map((pos, idx) => (
                        <div key={`p-${idx}`} className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[12px] font-medium text-emerald-500 uppercase">{pos}</span>
                        </div>
                      ))}
                      {hostApp?.secondaryPositions?.map((pos, idx) => (
                        <div key={`s-${idx}`} className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          <span className="text-[12px] font-medium text-yellow-400 uppercase">{pos}</span>
                        </div>
                      ))}
                      {hostApp?.tertiaryPositions?.map((pos, idx) => (
                        <div key={`t-${idx}`} className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <span className="text-[12px] font-medium text-orange-400 uppercase">{pos}</span>
                        </div>
                      ))}
                      {!hostApp?.primaryPositions && !hostApp?.secondaryPositions && !hostApp?.tertiaryPositions && hostApp?.position && (
                        hostApp.position.split('/').map((pos, idx) => (
                          <div key={idx} className="flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[12px] font-medium text-emerald-500 uppercase">{pos.trim()}</span>
                          </div>
                        ))
                      )}
                    </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 pr-2">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[14px] font-black text-emerald-500">36.5°C</span>
                    <span className="text-[14px]">😊</span>
                  </div>
                  <span className="text-[12px] font-medium text-slate-400">{t('mannerTemperature')}</span>
                </div>
              </div>
            </div>
            );
          })()}

          {/* 내용 (description) */}
          {room.description && (
            <div className="mt-4 px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <p className={`text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap ${!isDescExpanded ? 'line-clamp-3' : ''}`}>{room.description}</p>
              {room.description.length > 80 && (
                <button
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-1.5 text-[12px] font-medium text-blue-500 transition-all active:scale-95"
                >
                  {isDescExpanded ? t('collapse') : t('showMore')}
                </button>
              )}
            </div>
          )}

          {/* Tabs */}
          {isHost ? (
          <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800 gap-6 mt-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setDetailTab(DetailPageTab.PENDING)}
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.PENDING
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
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.APPROVED
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('approvedParticipantsList')}</span>
              <span className="text-[11px] opacity-60">({approvedApplicants.length})</span>
              {detailTab === DetailPageTab.APPROVED && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
            <button
              onClick={() => setDetailTab(DetailPageTab.TEAM_RESULT)}
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.TEAM_RESULT
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('teamResultTab')}</span>
              {detailTab === DetailPageTab.TEAM_RESULT && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
            <button
              onClick={() => setDetailTab(DetailPageTab.REJECTED)}
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.REJECTED
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('rejectedApplicantsList')}</span>
              <span className="text-[11px] opacity-60">({rejectedApplicants.length})</span>
              {detailTab === DetailPageTab.REJECTED && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
          </div>
          ) : (
          <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800 gap-6 mt-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setDetailTab(DetailPageTab.APPROVED)}
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.APPROVED
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('approvedParticipantsList')}</span>
              <span className="text-[11px] opacity-60">({approvedApplicants.length})</span>
              {detailTab === DetailPageTab.APPROVED && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
            <button
              onClick={() => setDetailTab(DetailPageTab.TEAM_RESULT)}
              className={`relative shrink-0 whitespace-nowrap px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.TEAM_RESULT
                ? 'text-slate-900 dark:text-white font-bold'
                : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}
            >
              <span>{t('teamResultTab')}</span>
              {detailTab === DetailPageTab.TEAM_RESULT && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
              )}
            </button>
          </div>
          )}

          {/* 게스트: 내 신청 상태 배지 */}
          {!isHost && myApplication && myStatus && myStatus !== 'APPROVED' && (
            <div className={`mt-3 px-4 py-2.5 rounded-2xl flex items-center justify-between ${
              myStatus === 'PENDING' ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' :
              'bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  myStatus === 'PENDING' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <span className={`text-[13px] font-medium ${
                  myStatus === 'PENDING' ? 'text-emerald-700 dark:text-emerald-400' :
                  'text-rose-700 dark:text-rose-400'
                }`}>
                  {myStatus === 'PENDING' ? t('statusPending') : t('statusRejected')}
                </span>
              </div>
            </div>
          )}

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
                const tabOrder = isHost
                  ? [DetailPageTab.PENDING, DetailPageTab.APPROVED, DetailPageTab.TEAM_RESULT, DetailPageTab.REJECTED]
                  : [DetailPageTab.APPROVED, DetailPageTab.TEAM_RESULT];
                const currentIdx = tabOrder.indexOf(detailTab);
                if (diff > 0 && currentIdx < tabOrder.length - 1) {
                  setDetailTab(tabOrder[currentIdx + 1]);
                } else if (diff < 0 && currentIdx > 0) {
                  setDetailTab(tabOrder[currentIdx - 1]);
                }
              }
              setTouchStartX(null);
            }}
          >
            {detailTab === DetailPageTab.TEAM_RESULT ? (
              /* 팀 결과 콘텐츠 */
              <div className="animate-in fade-in duration-300">
                {room.latestResult ? (() => {
                  const lr = room.latestResult;
                  const createdDate = new Date(lr.createdAt);
                  const timeStr = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}-${String(createdDate.getDate()).padStart(2, '0')} ${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          lr.isPreview
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {lr.isPreview ? t('previewResult') : t('finalResult')}
                        </span>
                        <span className="text-[11px] text-slate-400">{timeStr}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center text-center">
                          <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('standardDeviation')}</span>
                          <span className="text-[30px] font-black font-mono leading-none">{lr.standardDeviation.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('lowerFairer')})</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('penaltyScore')}</span>
                          <span className="text-[30px] font-black font-mono leading-none text-blue-500">{lr.positionSatisfaction?.toFixed(1) || '0.0'}</span>
                          <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('penaltyScoreDesc')})</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                        {lr.teams.map((team: any, idx: number) => (
                          <div key={team.id || idx} className="overflow-hidden">
                            <div className="flex items-center justify-between mb-4 px-1">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[14px]"
                                  style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: '#0f172a', color: 'white' }}
                                >
                                  {idx + 1}
                                </div>
                                <h4 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                                  {team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${String.fromCharCode(65 + idx)}`} ({team.players.length})
                                </h4>
                              </div>
                              <div className="text-right">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">{t('squadSum')}</span>
                                <span className="text-[20px] font-black font-mono leading-none text-slate-900 dark:text-white">{(team.totalSkill / team.players.length).toFixed(1)}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              {team.players.map((p: any) => {
                                const tierVal = typeof p.tier === 'number' ? p.tier : parseInt(p.tier) || 3;
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => {
                                      const matchedApp = room.applicants.find(a => a.name === p.name);
                                      if (matchedApp?.userId) navigateToUserProfile(matchedApp.userId);
                                    }}
                                    className={`flex items-center gap-4 bg-white dark:bg-slate-950 px-2 py-1 rounded-2xl border border-slate-100/50 dark:border-transparent ${room.applicants.find(a => a.name === p.name)?.userId ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                                  >
                                    <div className="w-[52px] h-[52px] rounded-full bg-[#eaeef4] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-400 dark:text-slate-400 shrink-0 overflow-hidden">
                                      {(() => {
                                        const matchedApp = room.applicants.find(a => a.name === p.name);
                                        return matchedApp?.photoUrl ? (
                                          <img src={matchedApp.photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : 'BELO';
                                      })()}
                                    </div>
                                    {room.sport !== SportType.GENERAL && (
                                      <div className="w-10 text-[14px] font-bold text-slate-400 shrink-0 text-center">
                                        {p.assignedPosition || '--'}
                                      </div>
                                    )}
                                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                      <div className="flex items-center gap-2">
                                        {showTier && (
                                          <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium tracking-tight ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]}`}>
                                            {Tier[tierVal as Tier] || 'B'}
                                          </span>
                                        )}
                                        <span className="text-[16px] font-medium text-slate-900 dark:text-white truncate tracking-tight">
                                          {p.name}
                                        </span>
                                      </div>
                                      {room.sport !== SportType.GENERAL && (
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                          {p.primaryPositions?.map((pos: string, pIdx: number) => (
                                            <div key={`p-${pIdx}`} className="flex items-center gap-0.5 shrink-0">
                                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                              <span className="text-[11px] font-medium text-emerald-500 uppercase tracking-tight">{pos}</span>
                                            </div>
                                          ))}
                                          {p.secondaryPositions?.map((pos: string, sIdx: number) => (
                                            <div key={`s-${sIdx}`} className="flex items-center gap-0.5 shrink-0">
                                              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                              <span className="text-[11px] font-medium text-yellow-400 uppercase tracking-tight">{pos}</span>
                                            </div>
                                          ))}
                                          {p.tertiaryPositions?.map((pos: string, tIdx: number) => (
                                            <div key={`t-${tIdx}`} className="flex items-center gap-0.5 shrink-0">
                                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                              <span className="text-[11px] font-medium text-orange-400 uppercase tracking-tight">{pos}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 text-center mt-2">
                        {t('resultGeneratedAt', timeStr)}
                      </p>
                    </div>
                  );
                })() : (
                  <div className="py-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                      <Icons.UsersIcon size={24} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight whitespace-pre-line">{t('noTeamResultYet')}</p>
                  </div>
                )}
              </div>
            ) : (<>
            {/* Action buttons row */}
            <div className="flex items-center w-full gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setShowTier(!showTier)}
                className={`px-[8px] h-[28px] flex items-center justify-center rounded-xl text-[12px] font-medium transition-all active:scale-95 border whitespace-nowrap shrink-0 ${showTier ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
              >
                {showTier ? t('hideTier') : t('showTier')}
              </button>

              {isHost && (
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
              )}

              {isHost && (
              <div className="flex items-center shrink-0 ml-auto">
                {detailTab === DetailPageTab.APPROVED && (
                  <button
                    onClick={() => setShowMemberPickerModal(true)}
                    className="bg-blue-500 text-white rounded-xl text-[12px] font-medium px-[8px] h-[28px] flex items-center justify-center transition-all active:scale-95 mr-2 whitespace-nowrap shrink-0"
                  >
                    {t('addParticipant')}
                  </button>
                )}

                {detailTab === DetailPageTab.PENDING && pendingApplicants.length > 0 && (
                  <button
                    onClick={() => handleApproveAllApplicants(room)}
                    className="bg-blue-500 text-white rounded-xl text-[12px] font-medium px-6 py-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
                  >
                    {t('approveAll')}
                  </button>
                )}
              </div>
              )}
            </div>

            {/* Constraints display */}
            {isHost && (() => {
              const approvedIds = new Set(room.applicants.filter(a => getApplicantStatus(a) === 'APPROVED').map(a => {
                const member = players.find(p => p.name === a.name && p.sportType === room.sport);
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
              {(!isHost ? approvedApplicants : (detailTab === DetailPageTab.PENDING ? pendingApplicants : detailTab === DetailPageTab.REJECTED ? rejectedApplicants : approvedApplicants)).map((app) => {
                const tierVal = parseTier(app.tier);
                const tierLabel = tierToLabel(app.tier);
                const member = players.find(p => p.name === app.name && p.sportType === room.sport);
                const effectiveId = member ? member.id : app.id;
                const isSelected = selectedPlayerIds.includes(effectiveId);
                const playerConstraint = teamConstraints.find(c => c.playerIds.includes(effectiveId));

                return (
                  <React.Fragment key={app.id}>
                    <div
                      role={selectionMode && detailTab === DetailPageTab.APPROVED ? 'button' : undefined}
                      tabIndex={selectionMode && detailTab === DetailPageTab.APPROVED ? 0 : undefined}
                      aria-pressed={selectionMode && detailTab === DetailPageTab.APPROVED ? isSelected : undefined}
                      onClick={() => {
                        if (selectionMode && detailTab === DetailPageTab.APPROVED) {
                          setSelectedPlayerIds(prev =>
                            prev.includes(effectiveId) ? prev.filter(x => x !== effectiveId) : [...prev, effectiveId]
                          );
                        } else {
                          const applicantData = {
                            name: app.name,
                            tier: app.tier,
                            primaryPositions: app.primaryPositions,
                            secondaryPositions: app.secondaryPositions,
                            tertiaryPositions: app.tertiaryPositions,
                            source: app.source,
                            userId: app.userId,
                            sportType: room.sport as SportType,
                          };
                          if (app.userId) {
                            navigateToUserProfile(app.userId, applicantData);
                          } else {
                            navigateToApplicantProfile(applicantData);
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (selectionMode && detailTab === DetailPageTab.APPROVED && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setSelectedPlayerIds(prev =>
                            prev.includes(effectiveId) ? prev.filter(x => x !== effectiveId) : [...prev, effectiveId]
                          );
                        }
                      }}
                      className={`bg-white dark:bg-slate-950 flex items-center justify-between px-2 py-1 rounded-2xl transition-all cursor-pointer active:scale-[0.98] ${selectionMode && isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        {selectionMode && detailTab === DetailPageTab.APPROVED && (
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                            {isSelected && <CheckIcon />}
                          </div>
                        )}
                        <div className="w-[52px] h-[52px] rounded-full bg-[#eaeef4] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-400 dark:text-slate-400 shrink-0 overflow-hidden">
                          {app.photoUrl ? (
                            <img src={app.photoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : 'BELO'}
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
                            {app.userId === room.hostId && (
                              <CrownIcon size={14} className="text-amber-400" />
                            )}
                            {playerConstraint && (
                              <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-black text-white ${playerConstraint.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                {playerConstraint.type === 'MATCH' ? 'M' : 'S'}
                              </div>
                            )}
                          </div>
                          {room.sport !== SportType.GENERAL && (
                          <div className="flex items-center gap-1.5">
                            {app.primaryPositions?.map((pos, idx) => (
                              <div key={`p-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[12px] font-medium text-emerald-500 uppercase">{pos}</span>
                              </div>
                            ))}
                            {app.secondaryPositions?.map((pos, idx) => (
                              <div key={`s-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                <span className="text-[12px] font-medium text-yellow-400 uppercase">{pos}</span>
                              </div>
                            ))}
                            {app.tertiaryPositions?.map((pos, idx) => (
                              <div key={`t-${idx}`} className="flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                <span className="text-[12px] font-medium text-orange-400 uppercase">{pos}</span>
                              </div>
                            ))}
                            {!app.primaryPositions && !app.secondaryPositions && !app.tertiaryPositions && (
                              app.position ? app.position.split('/').map((pos, idx) => (
                                <div key={idx} className="flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-[12px] font-medium text-emerald-500 uppercase">{pos.trim()}</span>
                                </div>
                              )) : (
                                <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600 italic">{t('notSet')}</span>
                              )
                            )}
                          </div>
                          )}
                        </div>
                      </div>

                      {isHost && app.userId !== room.hostId && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {detailTab === DetailPageTab.PENDING ? (
                          <>
                            <button
                              onClick={async () => {
                                setProcessingApplicantId(app.id);
                                try { await handleRejectApplicant(room, app); } finally { setProcessingApplicantId(null); }
                              }}
                              disabled={processingApplicantId === app.id}
                              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                            >
                              {processingApplicantId === app.id ? (
                                <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              ) : t('rejectApplicant')}
                            </button>
                            <button
                              onClick={async () => {
                                setProcessingApplicantId(app.id);
                                try { await handleApproveApplicant(room, app); } finally { setProcessingApplicantId(null); }
                              }}
                              disabled={processingApplicantId === app.id}
                              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-xl text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                            >
                              {processingApplicantId === app.id ? (
                                <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              ) : t('approve')}
                            </button>
                          </>
                        ) : detailTab === DetailPageTab.REJECTED ? (
                          <button
                            onClick={async () => {
                              setProcessingApplicantId(app.id);
                              try { await handleRestoreApplicant(room, app); } finally { setProcessingApplicantId(null); }
                            }}
                            disabled={processingApplicantId === app.id}
                            className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                          >
                            {processingApplicantId === app.id ? (
                              <span className="inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            ) : t('restoreApplicant')}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 relative" onClick={(e) => e.stopPropagation()}>
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
                                  className={`text-[14px] font-medium text-white px-2 py-0.5 rounded-md transition-all active:scale-95 ${editingApplicantId === app.id ? 'bg-slate-900 dark:bg-white dark:text-slate-900' : 'bg-orange-300'}`}
                                >
                                  {editingApplicantId === app.id ? t('confirm') : t('edit')}
                                </button>
                                <button
                                  onClick={() => {
                                    const isMember = players.some(p => p.name === app.name);
                                    cancelApplication(room.id, app.id, { userId: app.userId, name: app.name });
                                    if (getApplicantStatus(app) === 'APPROVED' && app.userId) {
                                      removeChatMember(room.id, app.userId);
                                      sendSystemMessage(room.id, t('chatSystemExcluded', app.name));
                                    }
                                    if (!isMember) {
                                      setMemberSuggestion({ isOpen: true, applicant: app });
                                    }
                                    setActiveActionMenuId(null);
                                  }}
                                  className="text-[14px] font-medium text-white px-2 py-0.5 bg-emerald-500 rounded-md transition-all active:scale-95"
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
                      )}
                    </div>

                    {editingApplicantId === app.id && detailTab === DetailPageTab.APPROVED && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-4 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-5 gap-1.5">
                          {['S', 'A', 'B', 'C', 'D'].map(v => (
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

              {(!isHost ? approvedApplicants : (detailTab === DetailPageTab.PENDING ? pendingApplicants : detailTab === DetailPageTab.REJECTED ? rejectedApplicants : approvedApplicants)).length === 0 ? (
                <div className="py-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                    <Icons.UsersIcon size={24} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 tracking-tight whitespace-pre-line">{!isHost ? t('noPlayers') : (detailTab === DetailPageTab.PENDING ? t('noPendingApplicants') : detailTab === DetailPageTab.REJECTED ? t('noRejectedApplicants') : t('noPlayersHost'))}</p>
                </div>
              ) : (
                <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 pt-3 pl-1">
                  {isHost
                    ? detailTab === DetailPageTab.PENDING ? t('guidePending')
                    : detailTab === DetailPageTab.REJECTED ? t('guideRejected')
                    : t('guideApproved')
                    : t('guideApprovedGuest')
                  }
                </p>
              )}
            </div>
          </>)}
            {/* 스크롤 여백은 상위 div의 동적 paddingBottom으로 처리 */}
          </div>
        </div>
      </div>

      {/* Host: Balance settings overlay backdrop */}
          {isHost && isBalanceSettingsOpen && (
            <div
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => {
                setIsBalanceSettingsOpen(false);
                setIsQuotaSettingsExpanded(false);
              }}
            />
          )}

          {/* Host: Balance settings bottom sheet */}
          {isHost && (
          <div
            ref={bottomBarRef}
            className={`shrink-0 relative z-50 flex flex-col items-center transition-all duration-300 ${isBalanceSettingsOpen ? 'bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]' : 'bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800'}`}
            style={{
              paddingBottom: '12px',
              paddingTop: isBalanceSettingsOpen ? undefined : '12px',
              maxHeight: isBalanceSettingsOpen ? '85vh' : 'auto',
            }}
          >
            <div className={`w-full max-w-lg px-5 ${isBalanceSettingsOpen ? 'pt-5 overflow-y-auto' : ''}`} style={isBalanceSettingsOpen ? { maxHeight: 'calc(85vh - 80px)' } : undefined}>
              {isBalanceSettingsOpen && (
                <div className="w-full mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {room.sport !== SportType.GENERAL && (
                  <div className="overflow-hidden">
                    <button
                      onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                      className="w-full py-3 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-700 dark:text-slate-200 font-semibold text-[16px] tracking-tight active:scale-[0.98] transition-all"
                    >
                      <span>
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
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 rounded-xl text-[11px] font-bold border border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                              >
                                ⚡ {t('recommendedPreset')}
                              </button>
                            </div>
                            <div className="mt-3 mx-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                              <p className="text-[11px] text-blue-500 dark:text-blue-400 font-medium leading-relaxed">
                                💡 {t('quotaHelpText')}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  <div className="space-y-3 mt-1">
                    <div className="py-3 bg-white dark:bg-slate-900 rounded-3xl px-5 flex items-center">
                      <button
                        onClick={() => setUseRandomMix(!useRandomMix)}
                        className="w-full flex items-center justify-between transition-all text-slate-900 dark:text-slate-100"
                      >
                        <span className="text-[16px] font-medium tracking-tight">{t('randomMix')}</span>
                        <div className={`w-[18px] h-[18px] rounded-sm flex items-center justify-center border-[1.5px] transition-all ${useRandomMix ? 'bg-slate-500 dark:bg-slate-400 border-slate-500 dark:border-slate-400' : 'border-slate-400 dark:border-slate-500'}`}>
                          {useRandomMix && <Icons.CheckIcon size={12} className="text-white dark:text-slate-900" />}
                        </div>
                      </button>
                    </div>

                    <div className="py-3 bg-white dark:bg-slate-900 rounded-3xl px-5 flex items-center justify-between">
                      <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight">{t('teamCountLabel')}</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setTeamCount(Math.max(2, teamCount - 1))} aria-label={t('decreaseTeamCount')} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.MinusIcon size={16} /></button>
                        <span className="text-[16px] font-medium text-slate-900 dark:text-slate-100 tracking-tight tabular-nums w-4 text-center">{teamCount}</span>
                        <button onClick={() => setTeamCount(Math.min(10, teamCount + 1))} aria-label={t('increaseTeamCount')} className="p-1 text-slate-900 dark:text-slate-100 hover:opacity-60 active:scale-90 transition-all"><Icons.PlusIcon size={16} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 w-full">
                {isFull ? (
                  <button
                    disabled
                    className="px-4 py-3 rounded-2xl text-[14px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shrink-0"
                  >
                    {room.status === 'CLOSED' ? t('reopenRecruitment') : t('closeRecruitment')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleRoomStatus(room)}
                    className={`px-4 py-3 rounded-2xl text-[14px] font-bold transition-all active:scale-95 shrink-0 ${
                      room.status === 'CLOSED'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                    }`}
                  >
                    {room.status === 'CLOSED' ? t('reopenRecruitment') : t('closeRecruitment')}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!isBalanceSettingsOpen) {
                      setIsBalanceSettingsOpen(true);
                      return;
                    }

                    const approvedApps = room.applicants.filter(a => getApplicantStatus(a) === 'APPROVED');
                    if (approvedApps.length < 2) {
                      showAlert(t('minPlayersAlert', 2, approvedApps.length));
                      return;
                    }

                    const executeBalance = () => {
                      const manualPlayers: Player[] = approvedApps.map(app => {
                        const member = players.find(p => p.name === app.name && p.sportType === room.sport);
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
                        let newList = [...prev];
                        approvedApps.forEach(app => {
                          newList = upsertPlayerFromApplicant(newList, app, room.sport as SportType, true);
                        });
                        return newList;
                      });

                      setResult(null);
                      setSelectedPlayerIds([]);
                      setSelectionMode(null);
                      handleGenerate(manualPlayers, room.sport as SportType, room.id, room.status);
                      setIsBalanceSettingsOpen(false);
                    };

                    if (room.status !== 'CLOSED') {
                      setConfirmState({
                        isOpen: true,
                        message: t('recruitNotClosedConfirm'),
                        onConfirm: () => {
                          setConfirmState((prev: any) => ({ ...prev, isOpen: false }));
                          executeBalance();
                        },
                      });
                      return;
                    }

                    executeBalance();
                  }}
                  className={`flex-1 py-3 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 bg-slate-900 dark:bg-white text-white dark:text-slate-900 ${isBalanceSettingsOpen ? 'shadow-xl' : 'shadow-lg shadow-slate-900/30 dark:shadow-white/20'}`}
                >
                  {t('generateTeams')}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Guest: Apply form overlay backdrop */}
          {!isHost && isApplyFormOpen && (
            <div
              className="absolute inset-0 z-40 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
              onClick={() => setIsApplyFormOpen(false)}
            />
          )}

          {/* Guest: Apply bottom sheet */}
          {!isHost && (
          <div
            ref={bottomBarRef}
            className={`shrink-0 relative z-50 flex flex-col items-center transition-all duration-300 ${isApplyFormOpen ? 'bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]' : 'bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800'}`}
            style={{
              paddingBottom: '12px',
              paddingTop: isApplyFormOpen ? undefined : '12px',
              maxHeight: isApplyFormOpen ? '85vh' : 'auto',
            }}
          >
            <div className={`w-full max-w-lg px-5 ${isApplyFormOpen ? 'pt-5 overflow-y-auto' : ''}`} style={isApplyFormOpen ? { maxHeight: 'calc(85vh - 80px)' } : undefined}>
              {isApplyFormOpen && (
                <div className="w-full mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Name input */}
                  <div className="py-3 bg-white dark:bg-slate-900 rounded-3xl px-5">
                    <input
                      type="text"
                      value={applyName}
                      onChange={(e) => setApplyName(e.target.value)}
                      placeholder={t('inputNamePlaceholder')}
                      className="w-full bg-transparent text-[16px] font-medium text-slate-900 dark:text-white tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    />
                  </div>

                  {/* Tier selection */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {['S', 'A', 'B', 'C', 'D'].map(v => (
                      <button
                        key={v}
                        onClick={() => setApplyTier(v)}
                        className={`py-2 rounded-xl font-medium text-[11px] transition-all ${applyTier === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400'}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* Position picker (hide for GENERAL sport) */}
                  {room.sport !== SportType.GENERAL && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-2">
                      <FormationPicker
                        sport={room.sport as SportType}
                        primaryP={applyPrimaryPos as Position[]}
                        secondaryP={applySecondaryPos as Position[]}
                        tertiaryP={applyTertiaryPos as Position[]}
                        forbiddenP={applyForbiddenPos as Position[]}
                        lang={lang}
                        onChange={(p, s, tr, f) => {
                          setApplyPrimaryPos(p);
                          setApplySecondaryPos(s);
                          setApplyTertiaryPos(tr);
                          setApplyForbiddenPos(f);
                        }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {applyError && (
                    <p className="text-rose-500 text-[13px] font-medium text-center">{applyError}</p>
                  )}
                </div>
              )}

              {myApplication ? (
                <button
                  onClick={() => {
                    if (!currentUserId) return;
                    setConfirmState({
                      isOpen: true,
                      message: t('cancelApplicationConfirm'),
                      onConfirm: async () => {
                        try {
                          if (myStatus === 'APPROVED') {
                            await removeChatMember(room.id, currentUserId);
                            await sendSystemMessage(room.id, t('chatSystemLeft', userNickname));
                          }
                          await cancelMyApplication(room.id, currentUserId);
                          setCurrentActiveRoom(prev => prev ? {
                            ...prev,
                            applicants: prev.applicants.filter(a => a.userId !== currentUserId),
                          } : null);
                          showAlert(t('applicationCancelled'));
                          setConfirmState(prev => ({ ...prev, isOpen: false }));
                        } catch (err: any) {
                          if (err?.message === 'APPLICATION_NOT_FOUND') {
                            showAlert(t('applicationNotFound'));
                          } else {
                            showAlert(t('errorOccurred'));
                          }
                          setConfirmState(prev => ({ ...prev, isOpen: false }));
                        }
                      },
                    });
                  }}
                  className="w-full py-3 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30"
                >
                  {t('cancelMyApplication')}
                </button>
              ) : room.status === 'CLOSED' || isFull ? (
                <button
                  disabled
                  className="w-full py-3 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-3 bg-slate-300 dark:bg-slate-700 text-white cursor-not-allowed"
                >
                  {room.status === 'CLOSED' ? t('recruitClosedStatus') : t('recruitFull')}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!isApplyFormOpen) {
                      setIsApplyFormOpen(true);
                      return;
                    }
                    // Submit apply
                    if (!applyName.trim()) return;
                    setApplyLoading(true);
                    setApplyError(null);
                    try {
                      const fcmToken = localStorage.getItem('fcm_token') || undefined;
                      await applyForParticipation(room.id, {
                        name: applyName.trim(),
                        tier: applyTier,
                        position: applyPrimaryPos[0] || 'NONE',
                        primaryPositions: applyPrimaryPos,
                        secondaryPositions: applySecondaryPos,
                        tertiaryPositions: applyTertiaryPos,
                        forbiddenPositions: applyForbiddenPos,
                        ...(fcmToken ? { fcmToken } : {}),
                        ...(currentUserId ? { userId: currentUserId } : {}),
                        ...(userProfile?.photoUrl ? { photoUrl: userProfile.photoUrl } : {}),
                      });
                      const newApplicant = {
                        id: '', // Firestore에서 생성된 ID는 다음 구독 시 동기화됨
                        name: applyName.trim(),
                        tier: applyTier,
                        position: applyPrimaryPos[0] || 'NONE',
                        primaryPositions: applyPrimaryPos,
                        secondaryPositions: applySecondaryPos,
                        tertiaryPositions: applyTertiaryPos,
                        forbiddenPositions: applyForbiddenPos,
                        timestamp: new Date().toISOString(),
                        isApproved: false,
                        source: 'app' as const,
                        status: 'PENDING' as const,
                        ...(currentUserId ? { userId: currentUserId } : {}),
                        ...(userProfile?.photoUrl ? { photoUrl: userProfile.photoUrl } : {}),
                      };
                      setCurrentActiveRoom(prev => prev ? {
                        ...prev,
                        applicants: [...prev.applicants, newApplicant],
                      } : null);
                      setIsApplyFormOpen(false);
                      showAlert(
                        room.visibility !== 'PRIVATE'
                          ? `${t('applicationComplete')}\n\n${t('shareRecruitTip' as any)}`
                          : t('applicationComplete')
                      );
                    } catch (err: any) {
                      if (err?.message === 'DUPLICATE_APPLICATION') {
                        setApplyError(t('duplicateApplicationMsg'));
                      } else if (err?.message === 'ROOM_FULL') {
                        setApplyError(t('roomFullMsg'));
                      } else if (err?.message === 'ROOM_NOT_FOUND') {
                        setApplyError(t('roomNotFoundMsg'));
                      } else if (err?.message === 'ROOM_CLOSED') {
                        setApplyError(t('roomClosedMsg'));
                      } else {
                        setApplyError(t('networkErrorMsg'));
                      }
                    } finally {
                      setApplyLoading(false);
                    }
                  }}
                  disabled={applyLoading}
                  className={`w-full py-3 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 disabled:opacity-50 bg-blue-500 hover:bg-blue-600 text-white ${isApplyFormOpen ? 'shadow-xl' : 'shadow-lg shadow-blue-500/30'}`}
                >
                  {applyLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : isApplyFormOpen ? t('completeApplication') : t('applyJoin')}
                </button>
              )}
            </div>
          </div>
          )}

          {/* 플로팅 채팅 버튼 */}
          {!isBalanceSettingsOpen && !isApplyFormOpen && !selectionMode && (
            <button
              onClick={() => navigateTo(AppPageType.CHAT_ROOM)}
              className="absolute right-5 w-[52px] h-[52px] rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition-all hover:bg-blue-600"
              style={{
                bottom: `${bottomBarH + 8}px`,
                zIndex: Z_INDEX.FAB_BUTTON,
              }}
            >
              <Icons.ChatBubbleFilledIcon size={22} />
            </button>
          )}
    </div>
  );
});
