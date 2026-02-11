import { useState, useMemo, useEffect, useCallback } from 'react';
import { Player, Tier, SportType, Position, TeamConstraint, BalanceResult } from '../types';
import { TEAM_COLORS, STORAGE_KEY } from '../constants';
import { generateBalancedTeams } from '../services/balanceService';
import { AnalyticsService } from '../services/analyticsService';

export const useTeamBalance = (
  players: Player[],
  activeTab: SportType,
  showAlert: (msg: string, title?: string) => void,
  t: (key: string, ...args: any[]) => string,
  isAdFree: boolean,
  setCurrentPage: (page: any) => void,
  AppPageType: any,
) => {
  const [teamCount, setTeamCount] = useState(2);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [pastResults, setPastResults] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Partial<Record<Position, number | null>>>({});
  const [showQuotaSettings, setShowQuotaSettings] = useState(false);
  const [isQuotaSettingsExpanded, setIsQuotaSettingsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(isAdFree ? 1 : 5);
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [useTeamColors, setUseTeamColors] = useState(() => {
    const saved = localStorage.getItem('app_default_team_colors');
    return saved !== null ? saved === 'true' : false;
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTeamColors, setSelectedTeamColors] = useState<string[]>(['#ef4444', '#3b82f6']);
  const [editingResultTeamIdx, setEditingResultTeamIdx] = useState<number | null>(null);
  const [lastGenContext, setLastGenContext] = useState<{ players: Player[]; sport?: SportType } | null>(null);
  const [showTier, setShowTier] = useState(() => {
    const saved = localStorage.getItem('app_default_show_tier');
    return saved !== null ? saved === 'true' : true;
  });
  const [sortMode, setSortMode] = useState<'name' | 'tier'>(() => {
    const saved = localStorage.getItem('app_default_sort_mode');
    return (saved === 'name' || saved === 'tier') ? saved : 'name';
  });
  const [selectionMode, setSelectionMode] = useState<'MATCH' | 'SPLIT' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teamConstraints, setTeamConstraints] = useState<TeamConstraint[]>(() => {
    const saved = localStorage.getItem(`app_constraints`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isBalanceSettingsOpen, setIsBalanceSettingsOpen] = useState(false);

  const [totalGenCount, setTotalGenCount] = useState(() => parseInt(localStorage.getItem('app_total_gen_count') || '0', 10));
  const [positionUsage, setPositionUsage] = useState<{ count: number, lastDate: string }>(() => {
    const saved = localStorage.getItem('app_position_usage');
    return saved ? JSON.parse(saved) : { count: 0, lastDate: '' };
  });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showRewardAd, setShowRewardAd] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const activePlayers = useMemo(() =>
    players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab)),
    [players, activeTab]
  );

  const memberPlayers = useMemo(() => {
    const currentPlayers = players.filter(p => activeTab === SportType.ALL || p.sportType === activeTab);
    if (sortMode === 'name') {
      return [...currentPlayers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return [...currentPlayers].sort((a, b) => {
        const tierA = isNaN(Number(a.tier)) ? (Tier as any)[a.tier] : Number(a.tier);
        const tierB = isNaN(Number(b.tier)) ? (Tier as any)[b.tier] : Number(b.tier);
        if (tierB !== tierA) return tierB - tierA;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  }, [players, activeTab, sortMode]);

  // Defaults persistence
  useEffect(() => { localStorage.setItem('app_default_show_tier', showTier.toString()); }, [showTier]);
  useEffect(() => { localStorage.setItem('app_default_sort_mode', sortMode); }, [sortMode]);
  useEffect(() => { localStorage.setItem('app_default_team_colors', useTeamColors.toString()); }, [useTeamColors]);

  // Constraints persistence
  useEffect(() => {
    localStorage.setItem(`app_constraints`, JSON.stringify(teamConstraints));
  }, [teamConstraints]);

  // Quotas auto-calculation
  useEffect(() => {
    const savedQuotasString = localStorage.getItem(`app_quotas_${activeTab}`);
    if (savedQuotasString) {
      try {
        const savedQuotas = JSON.parse(savedQuotasString);
        setQuotas(savedQuotas);
        return;
      } catch (e) {
        console.error('Failed to parse saved quotas', e);
      }
    }

    const activeCount = players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab)).length;
    const perTeam = teamCount > 0 ? Math.floor(activeCount / teamCount) : 0;

    if (activeTab === SportType.SOCCER) {
      setQuotas({ GK: 1, LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null, MF: null, LW: null, ST: null, RW: null });
    } else if (activeTab === SportType.FUTSAL) {
      setQuotas({ GK: 1, FIX: 1, ALA: null, PIV: null });
    } else if (activeTab === SportType.BASKETBALL) {
      setQuotas({ C: 1, PG: 1, SG: null, SF: null, PF: null });
    } else setQuotas({});
  }, [teamCount, activeTab]);

  // Team colors sync
  useEffect(() => {
    setSelectedTeamColors(prev => {
      const next = [...prev];
      if (next.length < teamCount) {
        const available = TEAM_COLORS.map(c => c.value).filter(v => !next.includes(v));
        while (next.length < teamCount && available.length > 0) {
          next.push(available.shift()!);
        }
        while (next.length < teamCount) {
          next.push(TEAM_COLORS[next.length % TEAM_COLORS.length].value);
        }
      } else if (next.length > teamCount) {
        return next.slice(0, teamCount);
      }
      return next;
    });
  }, [teamCount]);

  // Reset past results on player change
  useEffect(() => {
    setPastResults(new Set());
  }, [players]);

  const updateQuota = (pos: Position, delta: number) => {
    setQuotas(prev => {
      const current = typeof prev[pos] === 'number' ? (prev[pos] as number) : 0;
      const next = { ...prev, [pos]: Math.max(0, current + delta) };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleQuotaMode = (pos: Position) => {
    setQuotas(prev => {
      const next = { ...prev, [pos]: typeof prev[pos] === 'number' ? null : 1 };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const currentQuotaTotal = Object.entries(quotas).reduce<number>((acc, [pos, val]) => {
    const validPosForSport =
      activeTab === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
        activeTab === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
          activeTab === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
            ['NONE'];
    if (validPosForSport.includes(pos as any)) {
      return acc + (typeof val === 'number' ? val : 0);
    }
    return acc;
  }, 0);

  const handleUpdateResultTeamColor = (idx: number, colorValue: string, colorName: string) => {
    if (!result) return;
    const nextResult = { ...result };
    const nextTeams = [...nextResult.teams];
    nextTeams[idx] = { ...nextTeams[idx], color: colorValue, colorName: colorName };
    nextResult.teams = nextTeams;
    setResult(nextResult);
    setSelectedTeamColors(prev => {
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

  const handleGenerate = useCallback(async (manualPlayers?: Player[] | any, manualSport?: SportType) => {
    let participating: Player[] = [];
    let targetSport: SportType | undefined;

    if (Array.isArray(manualPlayers)) {
      participating = manualPlayers;
      targetSport = manualSport;
    } else if (lastGenContext && !manualPlayers?.target) {
      participating = lastGenContext.players;
      targetSport = lastGenContext.sport;
    } else {
      participating = players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab));
      targetSport = (activeTab === SportType.ALL ? undefined : activeTab);
    }

    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    const perTeamCount = Math.floor(participating.length / teamCount);
    const validPosForSport =
      targetSport === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
        targetSport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
          targetSport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
            ['NONE'];

    const filteredQuotas: Partial<Record<Position, number | null>> = {};
    Object.entries(quotas).forEach(([pos, v]) => {
      if (validPosForSport.includes(pos as any)) {
        filteredQuotas[pos as any] = v;
      }
    });

    const totalQuotaSum = Object.values(filteredQuotas).reduce((sum, v) => (sum as number) + (Number(v) || 0), 0);

    if ((totalQuotaSum as number) > perTeamCount) {
      showAlert(`팀당 인원(${perTeamCount}명)보다 설정된 포지션 합계(${totalQuotaSum}명)가 많습니다.\n설정을 확인해 주세요.`);
      return;
    }

    const isAdvanced = Object.values(filteredQuotas).some(v => v !== null);
    const isUnlimitedPos = true;

    setResult(null);
    setIsGenerating(true);
    const waitTime = isAdFree ? 1000 : 5000;
    setCountdown(isAdFree ? 1 : 5);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          const nextTotal = totalGenCount + 1;
          setTotalGenCount(nextTotal);
          localStorage.setItem('app_total_gen_count', nextTotal.toString());

          if (isAdvanced && !isUnlimitedPos && nextTotal > 10) {
            setPositionUsage(prevUsage => {
              const next = { ...prevUsage, count: prevUsage.count + 1 };
              localStorage.setItem('app_position_usage', JSON.stringify(next));
              return next;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const participatingIds = new Set(participating.map(p => p.id));
    const activeConstraints = teamConstraints
      .map(c => ({ ...c, playerIds: c.playerIds.filter(id => participatingIds.has(id)) }))
      .filter(c => c.playerIds.length >= 2);

    setTimeout(() => {
      try {
        const res = generateBalancedTeams(participating, teamCount, filteredQuotas, activeConstraints, useRandomMix, Array.from(pastResults), targetSport);

        setPastResults(prev => {
          const next = new Set(prev);
          res.teams.forEach(t => {
            const teamHash = t.players.map(p => p.id).sort().join(',');
            next.add(teamHash);
          });
          return next;
        });

        if (useTeamColors) {
          res.teams.forEach((team, idx) => {
            const colorValue = selectedTeamColors[idx] || TEAM_COLORS[idx % TEAM_COLORS.length].value;
            const colorObj = TEAM_COLORS.find(c => c.value === colorValue);
            team.color = colorValue;
            team.colorName = colorObj?.name || 'color_gray';
          });
        }

        setResult(res);
        setShowQuotaSettings(false);
        setCurrentPage(AppPageType.BALANCE);

        if (!res.isValid) {
          if (res.isConstraintViolated) {
            showAlert(t('validationErrorConstraint'));
          } else if (res.isQuotaViolated) {
            showAlert(t('validationErrorQuota'));
          }
        } else if (res.maxDiff && res.maxDiff > 10) {
          showAlert(t('balanceWarning', res.maxDiff));
        }

        const genCount = parseInt(localStorage.getItem('app_gen_count') || '0', 10) + 1;
        localStorage.setItem('app_gen_count', genCount.toString());

        if (genCount >= 10) {
          const cooldown = localStorage.getItem('app_review_cooldown');
          if (cooldown !== 'DONE') {
            const now = new Date();
            if (!cooldown || now > new Date(cooldown)) {
              setTimeout(() => setShowReviewPrompt(true), 2000);
            }
          }
        }

        setTimeout(() => {
          document.getElementById('results-capture-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        AnalyticsService.logEvent('generate_teams', {
          sport: activeTab,
          player_count: participating.length,
          team_count: teamCount
        });

        setLastGenContext({ players: participating, sport: targetSport });
      } catch (e) {
        console.error('Generation Error:', e);
        showAlert(t('errorOccurred'));
      } finally {
        setIsGenerating(false);
      }
    }, waitTime);
  }, [players, activeTab, teamCount, quotas, useRandomMix, useTeamColors, selectedTeamColors, teamConstraints, pastResults, lastGenContext, isAdFree, totalGenCount, showAlert, t, setCurrentPage, AppPageType]);

  const handleReviewLater = () => {
    const nextPromptDate = new Date();
    nextPromptDate.setDate(nextPromptDate.getDate() + 14);
    localStorage.setItem('app_review_cooldown', nextPromptDate.toISOString());
    setShowReviewPrompt(false);
  };

  const handleRateApp = () => {
    localStorage.setItem('app_review_cooldown', 'DONE');
    setShowReviewPrompt(false);
    window.open('https://play.google.com/store/apps/details?id=com.balanceteammaker', '_blank');
  };

  const expectedPerTeam = activePlayers.length > 0 ? Math.floor(activePlayers.length / teamCount) : 0;

  return {
    teamCount, setTeamCount,
    result, setResult,
    pastResults, setPastResults,
    isSharing, setIsSharing,
    quotas, setQuotas,
    showQuotaSettings, setShowQuotaSettings,
    isQuotaSettingsExpanded, setIsQuotaSettingsExpanded,
    isGenerating, setIsGenerating,
    countdown, setCountdown,
    useRandomMix, setUseRandomMix,
    useTeamColors, setUseTeamColors,
    showColorPicker, setShowColorPicker,
    selectedTeamColors, setSelectedTeamColors,
    editingResultTeamIdx, setEditingResultTeamIdx,
    lastGenContext, setLastGenContext,
    showTier, setShowTier,
    sortMode, setSortMode,
    selectionMode, setSelectionMode,
    selectedPlayerIds, setSelectedPlayerIds,
    teamConstraints, setTeamConstraints,
    isBalanceSettingsOpen, setIsBalanceSettingsOpen,
    totalGenCount, setTotalGenCount,
    positionUsage, setPositionUsage,
    showLimitModal, setShowLimitModal,
    showRewardAd, setShowRewardAd,
    showReviewPrompt, setShowReviewPrompt,
    activePlayers, memberPlayers,
    updateQuota, toggleQuotaMode,
    currentQuotaTotal,
    handleUpdateResultTeamColor,
    getSortedTeamPlayers,
    handleGenerate,
    handleReviewLater, handleRateApp,
    expectedPerTeam,
  };
};
