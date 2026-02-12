import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, Tier, SportType, Position } from '../types';
import {
  subscribeToUserRooms,
  updateRoomFcmToken,
  cancelApplication,
  RecruitmentRoom,
  Applicant,
  db,
} from '../services/firebaseService';
import { upsertPlayerFromApplicant } from '../utils/helpers';
import { doc, updateDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { LocalNotifications } from '@capacitor/local-notifications';

export const useRecruitmentRooms = (
  currentUserId: string,
  activeTab: SportType,
  players: Player[],
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  showAlert: (msg: string, title?: string) => void,
  t: (key: string, ...args: any[]) => string,
  lang: string,
  setActiveTab: (tab: SportType) => void,
) => {
  const [activeRooms, setActiveRooms] = useState<RecruitmentRoom[]>([]);
  const [currentActiveRoom, setCurrentActiveRoom] = useState<RecruitmentRoom | null>(null);
  const [showHostRoomModal, setShowHostRoomModal] = useState(false);
  const [showApplyRoomModal, setShowApplyRoomModal] = useState(false);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);
  const [memberSuggestion, setMemberSuggestion] = useState<{ isOpen: boolean; applicant: Applicant | null }>({ isOpen: false, applicant: null });
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);

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
  const [hostRoomTierMode, setHostRoomTierMode] = useState<'5TIER' | '3TIER'>('5TIER');
  const [hostRoomActivePicker, setHostRoomActivePicker] = useState<'START' | 'END'>('START');
  const [hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode] = useState(false);

  const prevApplicantsCount = useRef<Record<string, number>>({});

  const filteredRooms = useMemo(() => {
    return activeRooms.filter(r => {
      try {
        if (activeTab !== SportType.ALL && r.sport !== activeTab) return false;
        const [y, m, d] = r.matchDate.split('-').map(Number);
        const [hh, mm] = r.matchTime.split(':').map(Number);
        const matchTime = new Date(y, m - 1, d, hh, mm);
        const expiryLimit = new Date(matchTime.getTime() + 24 * 60 * 60 * 1000);
        return expiryLimit > new Date() && r.status !== 'DELETED';
      } catch { return true; }
    }).sort((a, b) => {
      try {
        const [ay, am, ad] = a.matchDate.split('-').map(Number);
        const [ahh, amm] = a.matchTime.split(':').map(Number);
        const aTime = new Date(ay, am - 1, ad, ahh, amm).getTime();
        const [by, bm, bd] = b.matchDate.split('-').map(Number);
        const [bhh, bmm] = b.matchTime.split(':').map(Number);
        const bTime = new Date(by, bm - 1, bd, bhh, bmm).getTime();
        return aTime - bTime;
      } catch { return 0; }
    });
  }, [activeRooms, activeTab]);

  // Subscribe to rooms
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserRooms(currentUserId, (rooms) => {
      rooms.forEach(room => {
        const pendingCount = room.applicants.filter(a => !a.isApproved).length;
        const prevPending = prevApplicantsCount.current[room.id];
        if (prevPending !== undefined && pendingCount > prevPending) {
          const newPlayer = room.applicants.filter(a => !a.isApproved).slice(-1)[0];
          if (newPlayer) {
            const msg = t('appliedMsg', newPlayer.name, room.applicants.length);
            if (Capacitor.isNativePlatform()) {
              LocalNotifications.schedule({
                notifications: [{
                  title: `[${room.title}] ${t('recruitParticipants')}`,
                  body: msg,
                  id: Math.floor(Math.random() * 1000000),
                  channelId: 'recruit_channel',
                  smallIcon: 'ic_stat_icon_config_sample',
                  sound: 'default',
                }]
              }).catch(e => console.error('Local Notification failed', e));
            } else {
              showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`);
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

        if (targetRoom) {
          const room = targetRoom as RecruitmentRoom;
          setActiveTab(room.sport as SportType);
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
      const updatedApplicants = room.applicants.map(a =>
        a.id === applicant.id ? { ...a, isApproved: true } : a
      );
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });
      setPlayers(prev => upsertPlayerFromApplicant(prev, applicant, room.sport as SportType));
    } catch (e) {
      console.error("Approval Error:", e);
    }
  };

  const handleUpdateApplicant = async (room: RecruitmentRoom, applicantId: string, updates: Partial<Applicant>) => {
    try {
      const roomRef = doc(db, 'rooms', room.id);
      const updatedApplicants = room.applicants.map(app => {
        if (app.id === applicantId) {
          const newApp = { ...app, ...updates };
          setPlayers(prev => prev.map(p => {
            if (p.name === app.name) {
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
          return newApp;
        }
        return app;
      });
      await updateDoc(roomRef, { applicants: updatedApplicants });
    } catch (e) {
      console.error("Update applicant error:", e);
    }
  };

  const handleApproveAllApplicants = async (room: RecruitmentRoom) => {
    try {
      const updatedApplicants = room.applicants.map(a => ({ ...a, isApproved: true }));
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });

      setPlayers(prev => {
        let result = prev;
        room.applicants.filter(a => !a.isApproved).forEach(a => {
          result = upsertPlayerFromApplicant(result, a, room.sport as SportType);
        });
        return result;
      });
    } catch (e) {
      console.error("Approve All Error:", e);
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
            text: t('shareRecruitMessage', room.title, room.matchDate, room.matchTime, t(room.sport.toLowerCase()), webUrl),
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
          setShowHostRoomModal(false);
          await updateDoc(doc(db, 'rooms', room.id), { status: 'DELETED' });
          setActiveRooms(prev => prev.filter(r => r.id !== room.id));
          setCurrentActiveRoom(null);
        } catch (e) {
          console.error("Delete Room Error:", e);
        }
        if (onConfirm) onConfirm();
      }
    };
  };

  const handleUpdateRoom = async (
    isProcessing: boolean,
    setIsProcessing: (v: boolean) => void,
    setCurrentPage: (page: any) => void,
    AppPageType: any,
  ) => {
    if (!currentActiveRoom) return;
    setIsProcessing(true);
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const updateData = {
        title: hostRoomTitle,
        sport: hostRoomSelectedSport,
        matchDate: hostRoomDate,
        matchTime: hostRoomTime,
        matchEndDate: hostRoomEndDate,
        matchEndTime: hostRoomEndTime,
        maxApplicants: hostRoomUseLimit ? hostRoomMaxApplicants : 0,
        tierMode: hostRoomTierMode,
        venue: hostRoomVenue.trim() || undefined,
      };
      await updateDoc(roomRef, updateData);
      setCurrentActiveRoom(prev => prev ? { ...prev, ...updateData } : null);
      setCurrentPage(AppPageType.DETAIL);
      showAlert(t('editComplete'));
    } catch (error) {
      console.error('Error updating room:', error);
      showAlert('Update failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    activeRooms, setActiveRooms,
    filteredRooms,
    currentActiveRoom, setCurrentActiveRoom,
    showHostRoomModal, setShowHostRoomModal,
    showApplyRoomModal, setShowApplyRoomModal,
    pendingJoinRoomId, setPendingJoinRoomId,
    memberSuggestion, setMemberSuggestion,
    activeActionMenuId, setActiveActionMenuId,
    editingApplicantId, setEditingApplicantId,
    hostRoomSelectedSport, setHostRoomSelectedSport,
    hostRoomTitle, setHostRoomTitle,
    hostRoomDate, setHostRoomDate,
    hostRoomTime, setHostRoomTime,
    hostRoomEndDate, setHostRoomEndDate,
    hostRoomEndTime, setHostRoomEndTime,
    hostRoomUseLimit, setHostRoomUseLimit,
    hostRoomMaxApplicants, setHostRoomMaxApplicants,
    hostRoomVenue, setHostRoomVenue,
    hostRoomTierMode, setHostRoomTierMode,
    hostRoomActivePicker, setHostRoomActivePicker,
    hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode,
    handleApproveApplicant,
    handleUpdateApplicant,
    handleApproveAllApplicants,
    handleShareRecruitLink,
    handleCloseRecruitRoom,
    handleUpdateRoom,
    cancelApplication,
  };
};
