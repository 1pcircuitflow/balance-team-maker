import React from 'react';
import { Tier, SportType, AppPageType } from '../types';
import { TIER_BADGE_COLORS, TEAM_COLORS } from '../constants';
import { QuotaFormationPicker } from '../components/QuotaFormationPicker';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { useRecruitmentContext } from '../contexts/RecruitmentContext';
import * as Icons from '../Icons';

const { ArrowLeftIcon, ShareIcon, RotateCcwIcon, CheckIcon, MinusIcon, PlusIcon } = Icons;

export const BalancePage: React.FC = React.memo(() => {
  const { t, lang, darkMode } = useAppContext();
  const { setCurrentPage } = useNavigationContext();
  const {
    teamCount, setTeamCount, result, setResult, isSharing,
    quotas, setQuotas, isQuotaSettingsExpanded, setIsQuotaSettingsExpanded,
    isGenerating, useRandomMix, setUseRandomMix,
    useTeamColors, setUseTeamColors, showTier,
    editingResultTeamIdx, setEditingResultTeamIdx,
    resultHistory, showHistory, setShowHistory,
    expectedPerTeam, updateQuota, toggleQuotaMode,
    handleUpdateResultTeamColor, getSortedTeamPlayers, handleGenerate, handleShare,
  } = useTeamBalanceContext();
  const { currentActiveRoom } = useRecruitmentContext();
  const TIER_COLORS = TIER_BADGE_COLORS;

  return (
    <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 px-4 pt-[40px] pb-[8px] border-b border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center w-full">
          <button
            onClick={() => {
              setCurrentPage(AppPageType.DETAIL);
              setResult(null);
            }}
            className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
          >
            <ArrowLeftIcon size={24} />
          </button>
          <h1 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
            {result ? t('resultsTitle') : t('generateTeams')}
          </h1>
          <div className="w-8" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto" ref={(el) => { if (el && result) el.scrollTop = 0; }}>

      <div className={`flex-1 max-w-lg mx-auto w-full ${result ? 'px-5 pt-0' : 'px-6 py-6'}`}>
        <div className="space-y-6">
          {!result && (
            <>
              <section>
                <button
                  onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                  className="w-full bg-slate-900 dark:bg-slate-100 py-2 rounded-[24px] flex items-center justify-center text-white dark:text-slate-900 text-[16px] font-semibold shadow-2xl shadow-slate-900/40 dark:shadow-white/20 transition-all active:scale-[0.98] active:brightness-95"
                  style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                >
                  {t('positionSettings')}
                </button>

                {isQuotaSettingsExpanded && (
                  <div className="mt-4 px-5 py-4 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300 overflow-y-auto max-h-[60vh]">
                    <QuotaFormationPicker
                      sport={currentActiveRoom.sport as SportType}
                      quotas={quotas}
                      lang={lang}
                      onUpdate={updateQuota}
                      onToggleMode={toggleQuotaMode}
                      darkMode={darkMode}
                    />
                    {currentActiveRoom.sport !== SportType.GENERAL && (
                      <>
                        <div className="mt-3 flex items-center gap-2 px-2">
                          <button
                            onClick={() => {
                              const sport = currentActiveRoom.sport as SportType;
                              if (sport === SportType.SOCCER) {
                                const perTeam = expectedPerTeam || 5;
                                setQuotas({ GK: 1, LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null, MF: null, LW: null, ST: null, RW: null });
                              } else if (sport === SportType.FUTSAL) {
                                setQuotas({ GK: 1, FIX: 1, ALA: null, PIV: null });
                              } else if (sport === SportType.BASKETBALL) {
                                setQuotas({ C: 1, PG: 1, SG: null, SF: null, PF: null });
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold border border-blue-100 dark:border-blue-900/30 transition-all active:scale-95 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                          >
                            ⚡ {t('recommendedPreset')}
                          </button>
                        </div>
                        <div className="mt-3 mx-2 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                            💡 {t('quotaHelpText')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>

              <section
                onClick={() => setUseRandomMix(!useRandomMix)}
                className="flex items-center gap-3 px-2 py-1 cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-slate-900 border-slate-900 dark:bg-white dark:border-white' : 'border-slate-300 dark:border-slate-700 group-hover:border-slate-400'}`}>
                  {useRandomMix && <CheckIcon size={14} className="text-white dark:text-slate-900" />}
                </div>
                <span className="text-[14px] font-bold text-slate-600 dark:text-slate-300">{t('randomMix')}</span>
              </section>

              <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1" />

              <section className="flex items-center justify-between px-2 h-12">
                <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{t('teamCountLabel')}</span>
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => setTeamCount(Math.max(2, teamCount - 1))}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                  >
                    <MinusIcon size={20} />
                  </button>
                  <span className="text-lg font-black font-mono w-4 text-center">{teamCount}</span>
                  <button
                    onClick={() => setTeamCount(Math.min(10, teamCount + 1))}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                  >
                    <PlusIcon size={20} />
                  </button>
                </div>
              </section>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 rounded-[24px] text-[16px] font-semibold tracking-tight shadow-2xl shadow-slate-900/40 dark:shadow-white/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-6"
                style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
              >
                {t('generateTeams')}
              </button>
              <div className="h-32" />
            </>
          )}

          {result && (
            <div id="results-capture-section" className="pb-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div data-capture-ignore="true" className="flex gap-2 py-3">
                {resultHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border flex items-center justify-center gap-1.5 whitespace-nowrap ${showHistory ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                  >
                    <RotateCcwIcon size={14} />{t('history')} ({resultHistory.length})
                  </button>
                )}
                <button
                  onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                  disabled={!!isSharing}
                  className="flex-1 bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all whitespace-nowrap"
                >
                  {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
                </button>
              </div>

              {showHistory && (
                <div data-capture-ignore="true" className="mb-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest mb-3 uppercase">{t('resultHistory')}</h3>
                  <div className="space-y-2">
                    {resultHistory.map((hist, i) => (
                      <button
                        key={i}
                        onClick={() => { setResult(hist); setShowHistory(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${result === hist ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">#{i + 1}</span>
                          <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                            {t('historyItem', hist.standardDeviation.toFixed(2), hist.teams.length)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {hist.teams.map((team, ti) => (
                            <span key={ti} className="text-[10px] font-mono font-bold text-slate-500">{team.totalSkill}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col items-center text-center">
                  <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('standardDeviation')}</span>
                  <span className="text-3xl font-black font-mono leading-none">{result.standardDeviation.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('lowerFairer')})</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="text-[12px] font-bold uppercase text-slate-900 dark:text-slate-100 mb-1">{t('penaltyScore')}</span>
                  <span className="text-3xl font-black font-mono leading-none text-blue-500">{result.positionSatisfaction?.toFixed(1) || '0.0'}</span>
                  <span className="text-[10px] text-slate-900 dark:text-slate-100 mt-1">({t('penaltyScoreDesc')})</span>
                </div>
              </div>

              <div data-capture-ignore="true" className="mb-4">
                <label className="flex items-center gap-2.5 cursor-pointer px-1 py-2" onClick={() => {
                  if (!useTeamColors) {
                    setResult({ ...result, teams: result.teams.map((team, idx) => ({ ...team, color: TEAM_COLORS[idx % TEAM_COLORS.length].value, colorName: TEAM_COLORS[idx % TEAM_COLORS.length].name })) });
                  } else {
                    setResult({ ...result, teams: result.teams.map(team => ({ ...team, color: undefined, colorName: undefined })) });
                  }
                  setUseTeamColors(!useTeamColors);
                }}>
                  <div className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all ${useTeamColors ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {useTeamColors && <CheckIcon size={12} className="text-white dark:text-slate-900" />}
                  </div>
                  <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{t('useTeamColorsLabel')}</span>
                </label>
                {useTeamColors && result && (
                  <div className="flex flex-wrap gap-3 px-1 mt-1">
                    {result.teams.map((team, idx) => (
                      <div key={team.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${String.fromCharCode(65 + idx)}`}
                        </span>
                        <div className="flex gap-1">
                          {TEAM_COLORS.map(color => (
                            <button
                              key={color.value}
                              onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                              className={`w-5 h-5 rounded-full transition-all ${team.color === color.value ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-slate-950 scale-110' : 'opacity-40 hover:opacity-100'}`}
                              style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {result.teams.map((team, idx) => (
                  <div key={team.id} className="overflow-hidden">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                          style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: '#111111', color: 'white' }}
                        >
                          {idx + 1}
                        </div>
                        <h4 className="text-[18px] font-bold text-[#111111] dark:text-white tracking-tight uppercase">
                          {team.colorName ? t('teamNameWithColor', t(team.colorName || '')) : `TEAM ${String.fromCharCode(65 + idx)}`} ({team.players.length})
                        </h4>
                        <div
                          onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                          className="flex items-center gap-1.5 ml-1 cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          <div className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" style={team.color ? { backgroundColor: team.color } : {}} />
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">{t('squadSum')}</span>
                        <span className="text-[20px] font-black font-mono leading-none text-slate-900 dark:text-white">{team.totalSkill}</span>
                      </div>
                    </div>

                    {editingResultTeamIdx === idx && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200 mb-2" data-capture-ignore="true">
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

                    <div className="space-y-1">
                      {getSortedTeamPlayers(team.players).map(p => (
                        <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-slate-950 px-2 py-1 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm transition-all">
                          <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                            BELO
                          </div>
                          <div className="w-10 text-[14px] font-bold text-slate-400 shrink-0 text-center">
                            {p.assignedPosition || '--'}
                          </div>
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              {showTier && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium tracking-tight ${TIER_COLORS[p.tier]}`}>
                                  {Tier[p.tier]}
                                </span>
                              )}
                              <span className="text-[16px] font-medium text-slate-900 dark:text-white truncate tracking-tight">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              {p.primaryPositions?.map((pos, pIdx) => (
                                <div key={`p-${pIdx}`} className="flex items-center gap-0.5 shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                  <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{pos}</span>
                                </div>
                              ))}
                              {p.secondaryPositions?.map((pos, sIdx) => (
                                <div key={`s-${sIdx}`} className="flex items-center gap-0.5 shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                  <span className="text-[11px] font-medium text-[#FACC16] uppercase tracking-tight">{pos}</span>
                                </div>
                              ))}
                              {p.tertiaryPositions?.map((pos, tIdx) => (
                                <div key={`t-${tIdx}`} className="flex items-center gap-0.5 shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                  <span className="text-[11px] font-medium text-[#FB933C] uppercase tracking-tight">{pos}</span>
                                </div>
                              ))}
                              {!p.primaryPositions && p.primaryPosition && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                  <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{p.primaryPosition}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                data-capture-ignore="true"
                onClick={() => handleGenerate()}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 rounded-[24px] text-[16px] font-semibold tracking-tight shadow-2xl shadow-slate-900/40 dark:shadow-white/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-6"
                style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
              >
                {t('reshuffleTeams')}
              </button>
              <div className="hidden px-2 pt-2" data-promo-footer="true">
                <div className={`mt-6 py-3 px-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900/40' : 'bg-slate-100/50'}`}>
                  <h4 className={`text-sm font-semibold tracking-tight pt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('promoAppTitle')}</h4>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-slate-950 p-2 border-t border-slate-100 dark:border-slate-800" data-capture-ignore="true">
        <div className="w-full h-[50px] bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('adPlacementSlot')}</span>
        </div>
      </div>
    </div>
  );
});
