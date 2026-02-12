import { useState, useEffect } from 'react';
import { Player, SportType, Position, TeamConstraint } from '../types';
import { TEAM_COLORS, POSITIONS_BY_SPORT } from '../constants';

export const useBalanceSettings = (
  players: Player[],
  activeTab: SportType,
) => {
  const [teamCount, setTeamCount] = useState(2);
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [useTeamColors, setUseTeamColors] = useState(() => {
    const saved = localStorage.getItem('app_default_team_colors');
    return saved !== null ? saved === 'true' : false;
  });
  const [showTier, setShowTier] = useState(() => {
    const saved = localStorage.getItem('app_default_show_tier');
    return saved !== null ? saved === 'true' : true;
  });
  const [sortMode, setSortMode] = useState<'name' | 'tier'>(() => {
    const saved = localStorage.getItem('app_default_sort_mode');
    return (saved === 'name' || saved === 'tier') ? saved : 'name';
  });
  const [selectedTeamColors, setSelectedTeamColors] = useState<string[]>(['#ef4444', '#3b82f6']);
  const [quotas, setQuotas] = useState<Partial<Record<Position, number | null>>>({});
  const [showQuotaSettings, setShowQuotaSettings] = useState(false);
  const [isQuotaSettingsExpanded, setIsQuotaSettingsExpanded] = useState(false);
  const [teamConstraints, setTeamConstraints] = useState<TeamConstraint[]>(() => {
    const saved = localStorage.getItem(`app_constraints`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isBalanceSettingsOpen, setIsBalanceSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    const validPosForSport = POSITIONS_BY_SPORT[activeTab] || ['NONE'];
    if (validPosForSport.includes(pos as any)) {
      return acc + (typeof val === 'number' ? val : 0);
    }
    return acc;
  }, 0);

  return {
    teamCount, setTeamCount,
    useRandomMix, setUseRandomMix,
    useTeamColors, setUseTeamColors,
    showTier, setShowTier,
    sortMode, setSortMode,
    selectedTeamColors, setSelectedTeamColors,
    quotas, setQuotas,
    showQuotaSettings, setShowQuotaSettings,
    isQuotaSettingsExpanded, setIsQuotaSettingsExpanded,
    teamConstraints, setTeamConstraints,
    isBalanceSettingsOpen, setIsBalanceSettingsOpen,
    searchQuery, setSearchQuery,
    updateQuota, toggleQuotaMode,
    currentQuotaTotal,
  };
};
