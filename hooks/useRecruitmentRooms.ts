import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, Tier, SportType, Position, BottomTabType, VenueData, PendingNotification } from '../types';
import {
  subscribeToUserRooms,
  subscribeToPublicRooms,
  updateRoomFcmToken,
  cancelApplication,
  updateRoomStatus,
  updateApplicantStatus,
  approveAllApplicants,
  addChatMember,
  removeChatMember,
  sendSystemMessage,
  RecruitmentRoom,
  Applicant,
  db,
} from '../services/firebaseService';
import { upsertPlayerFromApplicant, getApplicantStatus, getApprovedCount } from '../utils/helpers';
import { doc, updateDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';

export const useRecruitmentRooms = (
  currentUserId: string,
  activeTab: SportType,
  currentBottomTab: BottomTabType,
  players: Player[],
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  showAlert: (msg: string, title?: string) => void,
  showConfirm: (message: string, onConfirm: () => void, title?: string, confirmText?: string, cancelText?: string) => void,
  t: (key: string, ...args: any[]) => string,
  lang: string,
  setActiveTab: (tab: SportType) => void,
) => {
  const [activeRooms, setActiveRooms] = useState<RecruitmentRoom[]>([]);
  const [publicRooms, setPublicRooms] = useState<RecruitmentRoom[]>([]);
  const [currentActiveRoom, setCurrentActiveRoom] = useState<RecruitmentRoom | null>(null);
  const [showHostRoomModal, setShowHostRoomModal] = useState(false);
  const [showApplyRoomModal, setShowApplyRoomModal] = useState(false);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [memberSuggestion, setMemberSuggestion] = useState<{ isOpen: boolean; applicant: Applicant | null }>({ isOpen: false, applicant: null });
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);
  const [pendingNotification, setPendingNotification] = useState<PendingNotification | null>(null);

  // Host room form state
  const [hostRoomSelectedSport, setHostRoomSelectedSport] = useState<SportType>(SportType.GENERAL);
  const [hostRoomTitle, setHostRoomTitle] = useState('');
  const [hostRoomDate, setHostRoomDate] = useState('');
  const [hostRoomTime, setHostRoomTime] = useState('');
  const [hostRoomEndDate, setHostRoomEndDate] = useState('');
  const [hostRoomEndTime, setHostRoomEndTime] = useState('');
  const [hostRoomUseLimit, setHostRoomUseLimit] = useState(false);
  const [hostRoomMaxApplicants, setHostRoomMaxApplicants] = useState(0);
  const [hostRoomVenue, setHostRoomVenue] = useState('');
  const [hostRoomDescription, setHostRoomDescription] = useState('');
  const [hostRoomVisibility, setHostRoomVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [hostRoomActivePicker, setHostRoomActivePicker] = useState<'START' | 'END'>('START');
  const [hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode] = useState(false);
  const [hostRoomVenueData, setHostRoomVenueData] = useState<VenueData | null>(null);

  const prevApplicantsCount = useRef<Record<string, number>>({});
  const initialTabSynced = useRef(false);

  // 경기 종료 후 3시간 뒤 만료 (종료시간 없으면 시작시간 + 2시간을 종료로 간주)
  const isRoomExpired = useCallback((r: any) => {
    try {
      const [y, m, d] = r.matchDate.split('-').map(Number);
      const endDate = r.matchEndDate || r.matchDate;
      const endTimeStr = r.matchEndTime || r.matchTime;
      const [ey, em, ed] = endDate.split('-').map(Number);
      const [ehh, emm] = endTimeStr.split(':').map(Number);
      let endTime = new Date(ey, em - 1, ed, ehh, emm);
      if (!r.matchEndTime) endTime = new Date(y, m - 1, d, ehh, emm + 120);
      const expiryLimit = new Date(endTime.getTime() + 3 * 60 * 60 * 1000);
      return expiryLimit <= new Date() || r.status === 'DELETED';
    } catch { return false; }
  }, []);

  const sortByMatchTime = useCallback((a: any, b: any) => {
    try {
      const [ay, am, ad] = a.matchDate.split('-').map(Number);
      const [ahh, amm] = a.matchTime.split(':').map(Number);
      const aTime = new Date(ay, am - 1, ad, ahh, amm).getTime();
      const [by, bm, bd] = b.matchDate.split('-').map(Number);
      const [bhh, bmm] = b.matchTime.split(':').map(Number);
      const bTime = new Date(by, bm - 1, bd, bhh, bmm).getTime();
      return aTime - bTime;
    } catch { return 0; }
  }, []);

  const filteredRooms = useMemo(() => {
    return activeRooms.filter(r => {
      if (activeTab !== SportType.ALL && r.sport !== activeTab) return false;
      return !isRoomExpired(r);
    }).sort(sortByMatchTime);
  }, [activeRooms, activeTab, isRoomExpired, sortByMatchTime]);

  // 공개방 필터링 (만료된 방 제거 + 본인 방 제외)
  const filteredPublicRooms = useMemo(() => {
    return publicRooms.filter(r => {
      if (r.hostId === currentUserId) return false;
      if (activeTab !== SportType.ALL && r.sport !== activeTab) return false;
      return !isRoomExpired(r);
    }).sort(sortByMatchTime);
  }, [publicRooms, activeTab, currentUserId]);

  // 내가 신청한 방 (공개방 중 내 userId가 applicants에 포함된 방)
  const appliedRooms = useMemo(() => {
    if (!currentUserId) return [];
    return filteredPublicRooms.filter(r =>
      r.applicants.some(a => a.userId === currentUserId)
    );
  }, [filteredPublicRooms, currentUserId]);

  // 찜한 공개방 (내가 신청하지 않은 것 중 찜한 것)
  const likedRooms = useMemo(() => {
    if (!currentUserId) return [];
    return filteredPublicRooms.filter(r =>
      !r.applicants.some(a => a.userId === currentUserId) &&
      (r.likedBy || []).includes(currentUserId)
    );
  }, [filteredPublicRooms, currentUserId]);

  // 신청하지 않은 공개방 (찜한 방 제외)
  const generalPublicRooms = useMemo(() => {
    if (!currentUserId) return filteredPublicRooms;
    return filteredPublicRooms.filter(r =>
      !r.applicants.some(a => a.userId === currentUserId) &&
      !(r.likedBy || []).includes(currentUserId)
    );
  }, [filteredPublicRooms, currentUserId]);

  // Subscribe to public rooms — HOME 탭일 때만 구독
  useEffect(() => {
    if (currentBottomTab !== BottomTabType.HOME) {
      setPublicRooms([]);
      return;
    }
    const sportFilter = activeTab === SportType.ALL ? null : activeTab;
    const unsubscribe = subscribeToPublicRooms(sportFilter, 20, (rooms) => {
      setPublicRooms(rooms);
    });
    return () => unsubscribe();
  }, [activeTab, currentBottomTab]);

  // Subscribe to rooms
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserRooms(currentUserId, (rooms) => {
      rooms.forEach(room => {
        const pendingCount = room.applicants.filter(a => getApplicantStatus(a) === 'PENDING').length;
        const prevPending = prevApplicantsCount.current[room.id];
        if (prevPending !== undefined && pendingCount > prevPending) {
          const recruitEnabled = localStorage.getItem('app_recruit_notif_enabled') !== 'false';
          if (recruitEnabled) {
            const newPlayer = room.applicants.filter(a => getApplicantStatus(a) === 'PENDING').slice(-1)[0];
            if (newPlayer) {
              const msg = t('appliedMsg', newPlayer.name, room.applicants.length);
              // 네이티브: FCM이 백그라운드/포그라운드 모두 처리
              // 웹: showAlert로 인앱 알림
              if (!Capacitor.isNativePlatform()) {
                showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`);
              }
            }
          }
        }
        prevApplicantsCount.current[room.id] = pendingCount;
      });

      setActiveRooms(rooms);

      if (rooms.length > 0) {
        const savedRoomId = localStorage.getItem('last_active_room_id');
        let targetRoom: RecruitmentRoom | null = null;

        setCurrentActiveRoom(prev => {
          const stillExists = rooms.find(r => r.id === prev?.id);
          if (stillExists) { targetRoom = stillExists; return stillExists; }
          const savedRoom = rooms.find(r => r.id === savedRoomId);
          if (savedRoom) { targetRoom = savedRoom; return savedRoom; }
          targetRoom = rooms[0];
          return rooms[0];
        });

        if (targetRoom && !initialTabSynced.current) {
          const room = targetRoom as RecruitmentRoom;
          setActiveTab(room.sport as SportType);
          initialTabSynced.current = true;
        }
      } else {
        setCurrentActiveRoom(null);
      }
    });

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    if (currentActiveRoom) {
      localStorage.setItem('last_active_room_id', currentActiveRoom.id);
    }
  }, [currentActiveRoom]);

  // Sync participants
  useEffect(() => {
    if (!currentActiveRoom) return;
    const syncParticipants = async () => {
      try {
        const activeParticipants = players
          .filter(p => p.isActive && p.sportType === currentActiveRoom.sport)
          .map(p => ({
            name: p.name,
            tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
            isApproved: true
          }));
        const roomRef = doc(db, 'rooms', currentActiveRoom.id);
        await updateDoc(roomRef, { activeParticipants });
      } catch (error) {
        console.error('Failed to sync participants:', error);
      }
    };
    const timer = setTimeout(syncParticipants, 1000);
    return () => clearTimeout(timer);
  }, [players, currentActiveRoom]);

  const handleApproveApplicant = async (room: RecruitmentRoom, applicant: Applicant) => {
    try {
      const updatedApplicants = await updateApplicantStatus(room.id, applicant.id, { isApproved: true, status: 'APPROVED' });
      if (applicant.userId) addChatMember(room.id, applicant.userId);
      sendSystemMessage(room.id, t('chatSystemJoined', applicant.name));

      // 자동 마감: 승인 후 정원 초과 체크
      const newApprovedCount = getApprovedCount(updatedApplicants);
      if (room.maxApplicants > 0 && newApprovedCount >= room.maxApplicants && room.status === 'OPEN') {
        await updateRoomStatus(room.id, 'CLOSED');
        showAlert(t('autoClosedMsg'));
      }
    } catch (e) {
      console.error("Approval Error:", e);
      showAlert(t('approveErrorMsg'));
    }
  };

  const handleUpdateApplicant = async (room: RecruitmentRoom, applicantId: string, updates: Partial<Applicant>) => {
    try {
      const roomRef = doc(db, 'rooms', room.id);
      const targetApp = room.applicants.find(a => a.id === applicantId);
      const updatedApplicants = room.applicants.map(app =>
        app.id === applicantId ? { ...app, ...updates } : app
      );
      await updateDoc(roomRef, { applicants: updatedApplicants });
      // Firebase 성공 후에만 로컬 상태 업데이트
      if (targetApp) {
        setPlayers(prev => prev.map(p => {
          if (p.name === targetApp.name && p.sportType === room.sport) {
            const playerUpdates: Partial<Player> = {};
            if (updates.tier !== undefined) {
              playerUpdates.tier = (Tier as any)[updates.tier] || Tier.B;
            }
            if (updates.primaryPositions !== undefined) {
              playerUpdates.primaryPositions = updates.primaryPositions as Position[];
              playerUpdates.primaryPosition = (updates.primaryPositions[0] || 'NONE') as Position;
            }
            if (updates.secondaryPositions !== undefined) {
              playerUpdates.secondaryPositions = updates.secondaryPositions as Position[];
              playerUpdates.secondaryPosition = (updates.secondaryPositions[0] || 'NONE') as Position;
            }
            if (updates.tertiaryPositions !== undefined) {
              playerUpdates.tertiaryPositions = updates.tertiaryPositions as Position[];
              playerUpdates.tertiaryPosition = (updates.tertiaryPositions[0] || 'NONE') as Position;
            }
            if (updates.position !== undefined) {
              const posArr = updates.position.split('/') as Position[];
              if (!updates.primaryPositions) {
                playerUpdates.primaryPositions = posArr;
                playerUpdates.primaryPosition = posArr[0] || 'NONE';
              }
            }
            return { ...p, ...playerUpdates };
          }
          return p;
        }));
      }
    } catch (e) {
      console.error("Update applicant error:", e);
      showAlert(t('saveErrorMsg'));
    }
  };

  const handleRejectApplicant = async (room: RecruitmentRoom, applicant: Applicant) => {
    // 방장 자신은 거절 불가
    if (applicant.userId && applicant.userId === room.hostId) return;
    try {
      await updateApplicantStatus(room.id, applicant.id, { isApproved: false, status: 'REJECTED' });
      if (applicant.userId) removeChatMember(room.id, applicant.userId);
    } catch (e) {
      console.error("Reject Error:", e);
      showAlert(t('saveErrorMsg'));
    }
  };

  const handleRestoreApplicant = async (room: RecruitmentRoom, applicant: Applicant) => {
    try {
      await updateApplicantStatus(room.id, applicant.id, { isApproved: false, status: 'PENDING' });
    } catch (e) {
      console.error("Restore Error:", e);
      showAlert(t('saveErrorMsg'));
    }
  };

  const handleApproveAllApplicants = async (room: RecruitmentRoom) => {
    try {
      const updatedApplicants = await approveAllApplicants(room.id);

      // memberUserIds에 모든 참가자 추가 + 시스템 메시지
      for (const a of room.applicants) {
        if (a.userId && getApplicantStatus(a) !== 'APPROVED') {
          addChatMember(room.id, a.userId);
          sendSystemMessage(room.id, t('chatSystemJoined', a.name));
        }
      }

      // 내선수단에 추가할지 확인 (기존에 없는 선수만)
      const newApplicants = room.applicants.filter(a =>
        getApplicantStatus(a) !== 'APPROVED' && !players.some(p => p.name === a.name && p.sportType === room.sport)
      );
      if (newApplicants.length > 0) {
        showConfirm(
          t('addToSquadBatchMsg', newApplicants.length),
          () => setPlayers(prev => {
            let result = prev;
            newApplicants.forEach(a => {
              result = upsertPlayerFromApplicant(result, a, room.sport as SportType);
            });
            return result;
          }),
          t('addToSquadTitle'),
          t('addParticipant'),
          t('skip'),
        );
      }

      // 자동 마감: 전체 승인 후 정원 초과 체크
      const newApprovedCount = getApprovedCount(updatedApplicants);
      if (room.maxApplicants > 0 && newApprovedCount >= room.maxApplicants && room.status === 'OPEN') {
        await updateRoomStatus(room.id, 'CLOSED');
        showAlert(t('autoClosedMsg'));
      }
    } catch (e) {
      console.error("Approve All Error:", e);
      showAlert(t('approveErrorMsg'));
    }
  };

  const handleToggleRoomStatus = async (room: RecruitmentRoom) => {
    try {
      const newStatus = room.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      await updateRoomStatus(room.id, newStatus);
      showAlert(newStatus === 'CLOSED' ? t('recruitmentClosedMsg') : t('recruitmentReopenedMsg'));
    } catch (e) {
      console.error("Toggle Room Status Error:", e);
      showAlert(t('saveErrorMsg'));
    }
  };

  const handleShareRecruitLink = async (room: RecruitmentRoom) => {
    const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
    const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${room.id}&lang=${lang}`;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: t('shareRecruitLink'),
            text: t('shareRecruitMessage', room.title, room.matchDate, room.matchTime, t(room.sport.toLowerCase()), webUrl, room.venue),
            dialogTitle: t('shareRecruitLink'),
          });
        } catch (shareError) {
          await Clipboard.write({ string: webUrl });
        }
      } else {
        await Clipboard.write({ string: webUrl });
      }
    } catch (e) {
      console.error("Share Link Error:", e);
    }
  };

  const handleCloseRecruitRoom = (room: RecruitmentRoom, onConfirm?: () => void) => {
    return {
      title: t('deleteRoomTitle'),
      message: t('confirm_delete_room'),
      confirmText: t('delete'),
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'rooms', room.id), { status: 'DELETED' });
          // Firebase 성공 후에만 UI 상태 업데이트
          setShowHostRoomModal(false);
          setActiveRooms(prev => prev.filter(r => r.id !== room.id));
          setCurrentActiveRoom(null);
        } catch (e) {
          console.error("Delete Room Error:", e);
          showAlert(t('saveErrorMsg'));
        }
        if (onConfirm) onConfirm();
      }
    };
  };

  const handleUpdateRoom = async (
    isProcessing: boolean,
    setIsProcessing: (v: boolean) => void,
    goBack: () => void,
  ) => {
    if (!currentActiveRoom) return;
    if (!hostRoomTitle.trim()) { showAlert(t('inputTitle')); return; }
    setIsProcessing(true);
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const updateData: Record<string, any> = {
        title: hostRoomTitle.trim(),
        sport: hostRoomSelectedSport,
        matchDate: hostRoomDate,
        matchTime: hostRoomTime,
        matchEndDate: hostRoomEndDate,
        matchEndTime: hostRoomEndTime,
        maxApplicants: hostRoomUseLimit ? hostRoomMaxApplicants : 0,
        tierMode: '5TIER',
        venue: hostRoomVenue.trim() || undefined,
        description: hostRoomDescription.trim() || undefined,
        visibility: hostRoomVisibility,
      };
      if (hostRoomVenueData) {
        updateData.venueData = hostRoomVenueData;
      }
      await updateDoc(roomRef, updateData);
      setCurrentActiveRoom(prev => prev ? { ...prev, ...updateData } : null);
      goBack();
      showAlert(t('editComplete'));
    } catch (error) {
      console.error('Error updating room:', error);
      showAlert(t('saveErrorMsg'));
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    activeRooms, setActiveRooms,
    filteredRooms,
    publicRooms: generalPublicRooms,
    appliedRooms,
    likedRooms,
    currentActiveRoom, setCurrentActiveRoom,
    showHostRoomModal, setShowHostRoomModal,
    showApplyRoomModal, setShowApplyRoomModal,
    pendingJoinRoomId, setPendingJoinRoomId,
    memberSuggestion, setMemberSuggestion,
    activeActionMenuId, setActiveActionMenuId,
    editingApplicantId, setEditingApplicantId,
    pendingNotification, setPendingNotification,
    hostRoomSelectedSport, setHostRoomSelectedSport,
    hostRoomTitle, setHostRoomTitle,
    hostRoomDate, setHostRoomDate,
    hostRoomTime, setHostRoomTime,
    hostRoomEndDate, setHostRoomEndDate,
    hostRoomEndTime, setHostRoomEndTime,
    hostRoomUseLimit, setHostRoomUseLimit,
    hostRoomMaxApplicants, setHostRoomMaxApplicants,
    hostRoomVenue, setHostRoomVenue,
    hostRoomVenueData, setHostRoomVenueData,
    hostRoomDescription, setHostRoomDescription,
    hostRoomVisibility, setHostRoomVisibility,
    hostRoomActivePicker, setHostRoomActivePicker,
    hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode,
    handleApproveApplicant,
    handleRejectApplicant,
    handleRestoreApplicant,
    handleUpdateApplicant,
    handleApproveAllApplicants,
    handleToggleRoomStatus,
    handleShareRecruitLink,
    handleCloseRecruitRoom,
    handleUpdateRoom,
    cancelApplication,
  };
};
