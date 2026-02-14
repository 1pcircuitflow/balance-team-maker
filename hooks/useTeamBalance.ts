import { useState, useMemo } from 'react';
import { Player, Tier, SportType } from '../types';
import { TEAM_COLORS } from '../constants';
import { useBalanceSettings } from './useBalanceSettings';
import { useBalanceGeneration } from './useBalanceGeneration';

export const useTeamBalance = (
  players: Player[],
  activeTab: SportType,
  showAlert: (msg: string, title?: string) => void,
  t: (key: string, ...args: any[]) => string,
  isAdFree: boolean,
  setCurrentPage: (page: any) => void,
  AppPageType: any,
  membersTab?: SportType,
) => {
  const settings = useBalanceSettings(players, activeTab);
  const generation = useBalanceGeneration(
    {
      teamCount: settings.teamCount,
      quotas: settings.quotas,
      useRandomMix: settings.useRandomMix,
      useTeamColors: settings.useTeamColors,
      selectedTeamColors: settings.selectedTeamColors,
      teamConstraints: settings.teamConstraints,
      setShowQuotaSettings: settings.setShowQuotaSettings,
    },
    { players, activeTab, showAlert, t, isAdFree, setCurrentPage, AppPageType },
  );

  // Remaining UI state
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingResultTeamIdx, setEditingResultTeamIdx] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState<'MATCH' | 'SPLIT' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Derived data
  const activePlayers = useMemo(() =>
    players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab)),
    [players, activeTab]
  );

  const memberPlayers = useMemo(() => {
    const tab = membersTab ?? activeTab;
    let currentPlayers = players.filter(p => tab === SportType.ALL || p.sportType === tab);
    if (settings.searchQuery.trim()) {
      const q = settings.searchQuery.trim().toLowerCase();
      currentPlayers = currentPlayers.filter(p => p.name.toLowerCase().includes(q));
    }
    if (settings.sortMode === 'name') {
      return [...currentPlayers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return [...currentPlayers].sort((a, b) => {
        const tierA = isNaN(Number(a.tier)) ? (Tier as any)[a.tier] : Number(a.tier);
        const tierB = isNaN(Number(b.tier)) ? (Tier as any)[b.tier] : Number(b.tier);
        if (tierB !== tierA) return tierB - tierA;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  }, [players, activeTab, membersTab, settings.sortMode, settings.searchQuery]);

  const handleUpdateResultTeamColor = (idx: number, colorValue: string, colorName: string) => {
    if (!generation.result) return;
    const nextResult = { ...generation.result };
    const nextTeams = [...nextResult.teams];
    nextTeams[idx] = { ...nextTeams[idx], color: colorValue, colorName: colorName };
    nextResult.teams = nextTeams;
    generation.setResult(nextResult);
    settings.setSelectedTeamColors(prev => {
      const next = [...prev];
      next[idx] = colorValue;
      return next;
    });
    setEditingResultTeamIdx(null);
  };

  const getSortedTeamPlayers = (teamPlayers: Player[]) => {
    if (activeTab === SportType.GENERAL) return teamPlayers;
    const priority: any = activeTab === SportType.SOCCER
      ? { GK: 1, DF: 2, MF: 3, ST: 4, NONE: 5 }
      : activeTab === SportType.FUTSAL
        ? { GK: 1, FIX: 2, ALA: 3, PIV: 4, NONE: 5 }
        : { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, NONE: 6 };
    return [...teamPlayers].sort((a, b) => (priority[a.assignedPosition || 'NONE'] || 99) - (priority[b.assignedPosition || 'NONE'] || 99));
  };

  const expectedPerTeam = activePlayers.length > 0 ? Math.floor(activePlayers.length / settings.teamCount) : 0;

  return {
    // Settings
    teamCount: settings.teamCount, setTeamCount: settings.setTeamCount,
    useRandomMix: settings.useRandomMix, setUseRandomMix: settings.setUseRandomMix,
    useTeamColors: settings.useTeamColors, setUseTeamColors: settings.setUseTeamColors,
    showTier: settings.showTier, setShowTier: settings.setShowTier,
    sortMode: settings.sortMode, setSortMode: settings.setSortMode,
    selectedTeamColors: settings.selectedTeamColors, setSelectedTeamColors: settings.setSelectedTeamColors,
    quotas: settings.quotas, setQuotas: settings.setQuotas,
    showQuotaSettings: settings.showQuotaSettings, setShowQuotaSettings: settings.setShowQuotaSettings,
    isQuotaSettingsExpanded: settings.isQuotaSettingsExpanded, setIsQuotaSettingsExpanded: settings.setIsQuotaSettingsExpanded,
    teamConstraints: settings.teamConstraints, setTeamConstraints: settings.setTeamConstraints,
    isBalanceSettingsOpen: settings.isBalanceSettingsOpen, setIsBalanceSettingsOpen: settings.setIsBalanceSettingsOpen,
    searchQuery: settings.searchQuery, setSearchQuery: settings.setSearchQuery,
    updateQuota: settings.updateQuota, toggleQuotaMode: settings.toggleQuotaMode,
    currentQuotaTotal: settings.currentQuotaTotal,

    // Generation
    result: generation.result, setResult: generation.setResult,
    pastResults: generation.pastResults, setPastResults: generation.setPastResults,
    isGenerating: generation.isGenerating, setIsGenerating: generation.setIsGenerating,
    countdown: generation.countdown, setCountdown: generation.setCountdown,
    lastGenContext: generation.lastGenContext, setLastGenContext: generation.setLastGenContext,
    totalGenCount: generation.totalGenCount, setTotalGenCount: generation.setTotalGenCount,
    positionUsage: generation.positionUsage, setPositionUsage: generation.setPositionUsage,
    showLimitModal: generation.showLimitModal, setShowLimitModal: generation.setShowLimitModal,
    showRewardAd: generation.showRewardAd, setShowRewardAd: generation.setShowRewardAd,
    showReviewPrompt: generation.showReviewPrompt, setShowReviewPrompt: generation.setShowReviewPrompt,
    resultHistory: generation.resultHistory, setResultHistory: generation.setResultHistory,
    showHistory: generation.showHistory, setShowHistory: generation.setShowHistory,
    handleGenerate: generation.handleGenerate,
    handleReviewLater: generation.handleReviewLater, handleRateApp: generation.handleRateApp,

    // Local UI state
    isSharing, setIsSharing,
    showColorPicker, setShowColorPicker,
    editingResultTeamIdx, setEditingResultTeamIdx,
    selectionMode, setSelectionMode,
    selectedPlayerIds, setSelectedPlayerIds,

    // Derived
    activePlayers, memberPlayers,
    handleUpdateResultTeamColor,
    getSortedTeamPlayers,
    expectedPerTeam,
  };
};
