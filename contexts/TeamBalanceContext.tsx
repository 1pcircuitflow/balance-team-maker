import React, { createContext, useContext } from 'react';
import { Player, BalanceResult, SportType, Position, TeamConstraint } from '../types';
import { useTeamBalance } from '../hooks/useTeamBalance';
import { useShareCapture } from '../hooks/useShareCapture';
import { useAppContext } from './AppContext';
import { useAuthContext } from './AuthContext';
import { usePlayerContext } from './PlayerContext';
import { useNavigationContext } from './NavigationContext';
import { AppPageType } from '../types';

interface TeamBalanceContextValue {
  teamCount: number;
  setTeamCount: (v: number) => void;
  result: BalanceResult | null;
  setResult: (v: BalanceResult | null) => void;
  isSharing: string | null;
  setIsSharing: (v: string | null) => void;
  quotas: Partial<Record<Position, number | null>>;
  setQuotas: (v: any) => void;
  showQuotaSettings: boolean;
  setShowQuotaSettings: (v: boolean) => void;
  isQuotaSettingsExpanded: boolean;
  setIsQuotaSettingsExpanded: (v: boolean) => void;
  isGenerating: boolean;
  countdown: number;
  useRandomMix: boolean;
  setUseRandomMix: (v: boolean) => void;
  useTeamColors: boolean;
  setUseTeamColors: (v: boolean) => void;
  showColorPicker: boolean;
  setShowColorPicker: (v: boolean) => void;
  selectedTeamColors: string[];
  setSelectedTeamColors: (v: string[]) => void;
  editingResultTeamIdx: number | null;
  setEditingResultTeamIdx: (v: number | null) => void;
  showTier: boolean;
  setShowTier: (v: boolean) => void;
  sortMode: 'name' | 'tier';
  setSortMode: (v: 'name' | 'tier') => void;
  selectionMode: 'MATCH' | 'SPLIT' | null;
  setSelectionMode: (v: 'MATCH' | 'SPLIT' | null) => void;
  selectedPlayerIds: string[];
  setSelectedPlayerIds: React.Dispatch<React.SetStateAction<string[]>>;
  teamConstraints: TeamConstraint[];
  setTeamConstraints: React.Dispatch<React.SetStateAction<TeamConstraint[]>>;
  isBalanceSettingsOpen: boolean;
  setIsBalanceSettingsOpen: (v: boolean) => void;
  showLimitModal: boolean;
  setShowLimitModal: (v: boolean) => void;
  showRewardAd: boolean;
  setShowRewardAd: (v: boolean) => void;
  showReviewPrompt: boolean;
  setShowReviewPrompt: (v: boolean) => void;
  activePlayers: Player[];
  memberPlayers: Player[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  resultHistory: BalanceResult[];
  setResultHistory: React.Dispatch<React.SetStateAction<BalanceResult[]>>;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  updateQuota: (pos: Position, delta: number) => void;
  toggleQuotaMode: (pos: Position) => void;
  currentQuotaTotal: number;
  handleUpdateResultTeamColor: (idx: number, colorValue: string, colorName: string) => void;
  getSortedTeamPlayers: (teamPlayers: Player[]) => Player[];
  handleGenerate: (manualPlayers?: Player[] | any, manualSport?: SportType) => void;
  handleReviewLater: () => void;
  handleRateApp: () => void;
  expectedPerTeam: number;
  positionUsage: { count: number; lastDate: string };
  setPositionUsage: React.Dispatch<React.SetStateAction<{ count: number; lastDate: string }>>;
  // Share
  handleShare: (elementId: string, fileName: string) => void;
}

const TeamBalanceContext = createContext<TeamBalanceContextValue>(null!);

export const useTeamBalanceContext = () => useContext(TeamBalanceContext);

export const TeamBalanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, showAlert, darkMode, lang } = useAppContext();
  const { isAdFree } = useAuthContext();
  const { players } = usePlayerContext();
  const { activeTab, setCurrentPage, membersTab } = useNavigationContext();

  const balance = useTeamBalance(players, activeTab, showAlert, t, isAdFree, setCurrentPage, AppPageType, membersTab);

  const { handleShare } = useShareCapture({
    darkMode,
    lang,
    t,
    setIsSharing: balance.setIsSharing,
    setShowReviewPrompt: balance.setShowReviewPrompt,
  });

  return (
    <TeamBalanceContext.Provider value={{
      teamCount: balance.teamCount,
      setTeamCount: balance.setTeamCount,
      result: balance.result,
      setResult: balance.setResult,
      isSharing: balance.isSharing,
      setIsSharing: balance.setIsSharing,
      quotas: balance.quotas,
      setQuotas: balance.setQuotas,
      showQuotaSettings: balance.showQuotaSettings,
      setShowQuotaSettings: balance.setShowQuotaSettings,
      isQuotaSettingsExpanded: balance.isQuotaSettingsExpanded,
      setIsQuotaSettingsExpanded: balance.setIsQuotaSettingsExpanded,
      isGenerating: balance.isGenerating,
      countdown: balance.countdown,
      useRandomMix: balance.useRandomMix,
      setUseRandomMix: balance.setUseRandomMix,
      useTeamColors: balance.useTeamColors,
      setUseTeamColors: balance.setUseTeamColors,
      showColorPicker: balance.showColorPicker,
      setShowColorPicker: balance.setShowColorPicker,
      selectedTeamColors: balance.selectedTeamColors,
      setSelectedTeamColors: balance.setSelectedTeamColors,
      editingResultTeamIdx: balance.editingResultTeamIdx,
      setEditingResultTeamIdx: balance.setEditingResultTeamIdx,
      showTier: balance.showTier,
      setShowTier: balance.setShowTier,
      sortMode: balance.sortMode,
      setSortMode: balance.setSortMode,
      selectionMode: balance.selectionMode,
      setSelectionMode: balance.setSelectionMode,
      selectedPlayerIds: balance.selectedPlayerIds,
      setSelectedPlayerIds: balance.setSelectedPlayerIds,
      teamConstraints: balance.teamConstraints,
      setTeamConstraints: balance.setTeamConstraints,
      isBalanceSettingsOpen: balance.isBalanceSettingsOpen,
      setIsBalanceSettingsOpen: balance.setIsBalanceSettingsOpen,
      showLimitModal: balance.showLimitModal,
      setShowLimitModal: balance.setShowLimitModal,
      showRewardAd: balance.showRewardAd,
      setShowRewardAd: balance.setShowRewardAd,
      showReviewPrompt: balance.showReviewPrompt,
      setShowReviewPrompt: balance.setShowReviewPrompt,
      activePlayers: balance.activePlayers,
      memberPlayers: balance.memberPlayers,
      searchQuery: balance.searchQuery,
      setSearchQuery: balance.setSearchQuery,
      resultHistory: balance.resultHistory,
      setResultHistory: balance.setResultHistory,
      showHistory: balance.showHistory,
      setShowHistory: balance.setShowHistory,
      updateQuota: balance.updateQuota,
      toggleQuotaMode: balance.toggleQuotaMode,
      currentQuotaTotal: balance.currentQuotaTotal,
      handleUpdateResultTeamColor: balance.handleUpdateResultTeamColor,
      getSortedTeamPlayers: balance.getSortedTeamPlayers,
      handleGenerate: balance.handleGenerate,
      handleReviewLater: balance.handleReviewLater,
      handleRateApp: balance.handleRateApp,
      expectedPerTeam: balance.expectedPerTeam,
      positionUsage: balance.positionUsage,
      setPositionUsage: balance.setPositionUsage,
      handleShare,
    }}>
      {children}
    </TeamBalanceContext.Provider>
  );
};
