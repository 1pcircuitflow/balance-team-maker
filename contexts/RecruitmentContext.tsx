import React, { createContext, useContext } from 'react';
import { Player, SportType } from '../types';
import { RecruitmentRoom, Applicant } from '../services/firebaseService';
import { useRecruitmentRooms } from '../hooks/useRecruitmentRooms';
import { useAppContext } from './AppContext';
import { useAuthContext } from './AuthContext';
import { usePlayerContext } from './PlayerContext';
import { useNavigationContext } from './NavigationContext';

interface RecruitmentContextValue {
  activeRooms: RecruitmentRoom[];
  setActiveRooms: React.Dispatch<React.SetStateAction<RecruitmentRoom[]>>;
  filteredRooms: RecruitmentRoom[];
  publicRooms: RecruitmentRoom[];
  currentActiveRoom: RecruitmentRoom | null;
  setCurrentActiveRoom: React.Dispatch<React.SetStateAction<RecruitmentRoom | null>>;
  showHostRoomModal: boolean;
  setShowHostRoomModal: (v: boolean) => void;
  showApplyRoomModal: boolean;
  setShowApplyRoomModal: (v: boolean) => void;
  pendingJoinRoomId: string | null;
  setPendingJoinRoomId: (v: string | null) => void;
  memberSuggestion: { isOpen: boolean; applicant: Applicant | null };
  setMemberSuggestion: (v: { isOpen: boolean; applicant: Applicant | null }) => void;
  activeActionMenuId: string | null;
  setActiveActionMenuId: (v: string | null) => void;
  editingApplicantId: string | null;
  setEditingApplicantId: (v: string | null) => void;
  // Host room form state
  hostRoomSelectedSport: SportType;
  setHostRoomSelectedSport: (v: SportType) => void;
  hostRoomTitle: string;
  setHostRoomTitle: (v: string) => void;
  hostRoomDate: string;
  setHostRoomDate: (v: string) => void;
  hostRoomTime: string;
  setHostRoomTime: (v: string) => void;
  hostRoomEndDate: string;
  setHostRoomEndDate: (v: string) => void;
  hostRoomEndTime: string;
  setHostRoomEndTime: (v: string) => void;
  hostRoomUseLimit: boolean;
  setHostRoomUseLimit: (v: boolean) => void;
  hostRoomMaxApplicants: number;
  setHostRoomMaxApplicants: (v: number) => void;
  hostRoomVenue: string;
  setHostRoomVenue: (v: string) => void;
  hostRoomDescription: string;
  setHostRoomDescription: (v: string) => void;
  hostRoomVisibility: 'PUBLIC' | 'PRIVATE';
  setHostRoomVisibility: (v: 'PUBLIC' | 'PRIVATE') => void;
  hostRoomActivePicker: 'START' | 'END';
  setHostRoomActivePicker: (v: 'START' | 'END') => void;
  hostRoomIsPickerSelectionMode: boolean;
  setHostRoomIsPickerSelectionMode: (v: boolean) => void;
  // Handlers
  handleApproveApplicant: (room: RecruitmentRoom, applicant: Applicant) => void;
  handleRejectApplicant: (room: RecruitmentRoom, applicant: Applicant) => void;
  handleRestoreApplicant: (room: RecruitmentRoom, applicant: Applicant) => void;
  handleUpdateApplicant: (room: RecruitmentRoom, applicantId: string, updates: Partial<Applicant>) => void;
  handleApproveAllApplicants: (room: RecruitmentRoom) => void;
  handleShareRecruitLink: (room: RecruitmentRoom) => void;
  handleCloseRecruitRoom: (room: RecruitmentRoom, onConfirm?: () => void) => {
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  };
  handleUpdateRoom: (isProcessing: boolean, setIsProcessing: (v: boolean) => void, setCurrentPage: (page: any) => void, AppPageType: any) => void;
}

const RecruitmentContext = createContext<RecruitmentContextValue>(null!);

export const useRecruitmentContext = () => useContext(RecruitmentContext);

export const RecruitmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, showAlert, lang } = useAppContext();
  const { currentUserId } = useAuthContext();
  const { players, setPlayers } = usePlayerContext();
  const { activeTab, setActiveTab, currentBottomTab } = useNavigationContext();

  const rooms = useRecruitmentRooms(currentUserId, activeTab, currentBottomTab, players, setPlayers, showAlert, t, lang, setActiveTab);

  return (
    <RecruitmentContext.Provider value={rooms}>
      {children}
    </RecruitmentContext.Provider>
  );
};
