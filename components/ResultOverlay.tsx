import React from 'react';
import { Tier, SportType } from '../types';
import { TIER_BADGE_COLORS, TEAM_COLORS } from '../constants';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import * as Icons from '../Icons';

const { ShareIcon } = Icons;

export const ResultOverlay: React.FC = React.memo(() => {
  const { t, darkMode } = useAppContext();
  const { activeTab } = useNavigationContext();
  const {
    result, isSharing, editingResultTeamIdx, setEditingResultTeamIdx,
    setResult, handleShare, handleUpdateResultTeamColor, getSortedTeamPlayers, showTier,
  } = useTeamBalanceContext();

  if (!result) return null;
  const TIER_COLORS = TIER_BADGE_COLORS;

  return (
    <div id="results-capture-section" className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col px-5 py-4 animate-in fade-in duration-300 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
        <div data-capture-ignore="true" className="flex gap-2">
          <button
            onClick={() => setResult(null)}
            className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-300 transition-all"
          >
            {t('backToRoster')}
          </button>
          <button
            onClick={() => handleShare('results-capture-section', 'team-balance-result')}
            disabled={!!isSharing}
            className="bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2"
          >
            {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
          </button>
        </div>
      </div>

      <div className={`backdrop-blur-sm ${darkMode ? 'bg-slate-900/80 text-slate-100' : 'bg-slate-100/80 text-slate-900'} rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 w-full`}>
        <div className="flex flex-col">
          <span className={`text-[9px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-1`}>{t('standardDeviation')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono">{result.standardDeviation.toFixed(2)}</span>
            <span className="text-[9px] opacity-40 italic">({t('lowerFairer')})</span>
          </div>
        </div>
        {activeTab !== SportType.GENERAL && (
          <div className="flex flex-col items-center">
            <span className={`text-[8px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('penaltyScore')}</span>
            <div className="flex flex-col items-center leading-tight">
              <span className={`text-xl font-semibold font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {result.teams.reduce((sum, t) =>
                  sum + t.players.reduce((pSum, p) => {
                    const assigned = p.assignedPosition || 'NONE';
                    const isP1 = (p.primaryPositions || []).includes(assigned) || p.primaryPosition === assigned;
                    const isP2 = (p.secondaryPositions || []).includes(assigned) || p.secondaryPosition === assigned;
                    const isP3 = (p.tertiaryPositions || []).includes(assigned) || p.tertiaryPosition === assigned;
                    return pSum + (isP1 ? 0 : (isP2 ? 0.5 : (isP3 ? 1.0 : 2.0)));
                  }, 0)
                  , 0).toFixed(1)}
              </span>
              <span className={`text-[7px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-0.5 whitespace-nowrap`}>({t('penaltyScoreDesc')})</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-48">
        {result.teams.map((team, idx) => (
          <div key={team.id} className="bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="bg-white dark:bg-slate-950 p-5 flex items-center justify-between" style={{ borderTop: team.color ? `6px solid ${team.color}` : 'none' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg bg-slate-100 dark:bg-slate-800"
                  style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                  onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                  data-capture-ignore="true"
                >
                  {idx + 1}
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase">{team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${idx + 1}`}</h4>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t('squadSum')}</span>
                <span className="text-2xl font-black font-mono">{team.totalSkill}</span>
              </div>
            </div>
            {editingResultTeamIdx === idx && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200" data-capture-ignore="true">
                {TEAM_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                    className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${team.color === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                    style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                    title={t(color.name)}
                  />
                ))}
              </div>
            )}
            <div className="p-4 space-y-2">
              {getSortedTeamPlayers(team.players).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{p.name}</span>
                    {showTier && <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${TIER_COLORS[p.tier as Tier]}`}>{Tier[p.tier as Tier]}</span>}
                  </div>
                  {activeTab !== SportType.GENERAL && p.assignedPosition && <span className="text-[10px] font-black text-slate-400 uppercase">{p.assignedPosition}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden px-2 pt-2" data-promo-footer="true">
        <div className={`mt-6 py-3 px-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900/40' : 'bg-slate-100/50'}`}>
          <h4 className={`text-sm font-semibold tracking-tight pt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('promoAppTitle')}</h4>
        </div>
      </div>
    </div>
  );
});
