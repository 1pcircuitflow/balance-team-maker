import { useState, useEffect, useCallback, useRef } from 'react';
import { Player, SportType, Position, TeamConstraint, BalanceResult, AppPageType } from '../types';
import { TEAM_COLORS, POSITIONS_BY_SPORT } from '../constants';
import { generateBalancedTeams } from '../services/balanceService';
import { AnalyticsService } from '../services/analyticsService';
import { saveTeamResultToRoom } from '../services/firebaseService';

interface GenerationSettings {
  teamCount: number;
  quotas: Partial<Record<Position, number | null>>;
  useRandomMix: boolean;
  useTeamColors: boolean;
  selectedTeamColors: string[];
  teamConstraints: TeamConstraint[];
  setShowQuotaSettings: (v: boolean) => void;
}

interface GenerationDeps {
  players: Player[];
  activeTab: SportType;
  showAlert: (msg: string, title?: string) => void;
  t: (key: string, ...args: any[]) => string;
  isAdFree: boolean;
  navigateTo: (page: any, bottomTab?: any) => void;
}

export const useBalanceGeneration = (
  settings: GenerationSettings,
  deps: GenerationDeps,
) => {
  const { teamCount, quotas, useRandomMix, useTeamColors, selectedTeamColors, teamConstraints, setShowQuotaSettings } = settings;
  const { players, activeTab, showAlert, t, isAdFree, navigateTo } = deps;

  const [result, setResult] = useState<BalanceResult | null>(null);
  const [pastResults, setPastResults] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(isAdFree ? 1 : 5);
  const [lastGenContext, setLastGenContext] = useState<{ players: Player[]; sport?: SportType } | null>(null);

  const [totalGenCount, setTotalGenCount] = useState(() => parseInt(localStorage.getItem('app_total_gen_count') || '0', 10));
  const [positionUsage, setPositionUsage] = useState<{ count: number, lastDate: string }>(() => {
    try {
      const saved = localStorage.getItem('app_position_usage');
      return saved ? JSON.parse(saved) : { count: 0, lastDate: '' };
    } catch { return { count: 0, lastDate: '' }; }
  });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showRewardAd, setShowRewardAd] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [resultHistory, setResultHistory] = useState<BalanceResult[]>(() => {
    try {
      const saved = localStorage.getItem('app_result_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  // Timer refs for cleanup
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsGenerating(false);
    };
  }, []);

  // Reset past results on player change
  useEffect(() => {
    setPastResults(new Set());
  }, [players]);

  const handleGenerate = useCallback(async (manualPlayers?: Player[] | any, manualSport?: SportType, roomId?: string, roomStatus?: string) => {
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
    const validPosForSport = POSITIONS_BY_SPORT[targetSport || SportType.GENERAL] || ['NONE'];

    const filteredQuotas: Partial<Record<Position, number | null>> = {};
    Object.entries(quotas).forEach(([pos, v]) => {
      if (validPosForSport.includes(pos as any)) {
        filteredQuotas[pos as any] = v;
      }
    });

    const totalQuotaSum = Object.values(filteredQuotas).reduce((sum, v) => (sum as number) + (Number(v) || 0), 0);

    if ((totalQuotaSum as number) > perTeamCount) {
      showAlert(t('quotaOverMaxAlert', perTeamCount, totalQuotaSum));
      return;
    }

    const isAdvanced = Object.values(filteredQuotas).some(v => v !== null);
    const isUnlimitedPos = true;

    setResult(null);
    setIsGenerating(true);
    const waitTime = isAdFree ? 1000 : 5000;
    setCountdown(isAdFree ? 1 : 5);

    // 이전 타이머 정리
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          timerRef.current = null;
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
    timerRef.current = timer;

    const participatingIds = new Set(participating.map(p => p.id));
    const activeConstraints = teamConstraints
      .map(c => ({ ...c, playerIds: c.playerIds.filter(id => participatingIds.has(id)) }))
      .filter(c => c.playerIds.length >= 2);

    // countdown이 0에 도달한 뒤 React가 렌더링할 시간(200ms)을 확보
    timeoutRef.current = setTimeout(() => {
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

        res.createdAt = new Date().toISOString();
        setResult(res);

        if (roomId) {
          saveTeamResultToRoom(roomId, res, roomStatus !== 'CLOSED');
        }

        setResultHistory(prev => {
          const next = [res, ...prev].slice(0, 5);
          localStorage.setItem('app_result_history', JSON.stringify(next));
          return next;
        });
        setShowQuotaSettings(false);
        navigateTo(AppPageType.BALANCE);

        if (!res.isValid) {
          if (res.isConstraintViolated && res.isQuotaViolated) {
            showAlert(t('validationErrorBoth'));
          } else if (res.isConstraintViolated) {
            showAlert(t('validationErrorConstraint'));
          } else if (res.isQuotaViolated) {
            showAlert(t('validationErrorQuota'));
          }
        } else if (res.positionWarning && res.noneAssignedCount && res.noneAssignedCount > 0) {
          showAlert(t('positionAssignmentWarning', res.noneAssignedCount));
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
        timeoutRef.current = null;
      }
    }, waitTime + 200);
  }, [players, activeTab, teamCount, quotas, useRandomMix, useTeamColors, selectedTeamColors, teamConstraints, pastResults, lastGenContext, isAdFree, totalGenCount, showAlert, t, navigateTo, setShowQuotaSettings]);

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

  return {
    result, setResult,
    pastResults, setPastResults,
    isGenerating, setIsGenerating,
    countdown, setCountdown,
    lastGenContext, setLastGenContext,
    totalGenCount, setTotalGenCount,
    positionUsage, setPositionUsage,
    showLimitModal, setShowLimitModal,
    showRewardAd, setShowRewardAd,
    showReviewPrompt, setShowReviewPrompt,
    resultHistory, setResultHistory,
    showHistory, setShowHistory,
    handleGenerate,
    handleReviewLater, handleRateApp,
  };
};
