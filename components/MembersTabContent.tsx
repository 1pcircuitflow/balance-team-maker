import React, { useState, useMemo } from 'react';
import { Player, Tier, SportType } from '../types';
import { TIER_BADGE_COLORS } from '../constants';
import { PlayerItem } from './PlayerItem';
import { FormationPicker } from './FormationPicker';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { usePlayerActionsContext } from '../contexts/PlayerActionsContext';
import { usePlayerContext } from '../contexts/PlayerContext';
import * as Icons from '../Icons';

const { PlusIcon, UserPlusIcon, EditIcon, CloseIcon } = Icons;

interface GroupedPlayer {
  name: string;
  highestTier: Tier;
  sportTypes: SportType[];
}

export const MembersTabContent: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { membersTab: activeTab, setMembersTab } = useNavigationContext();
  const { memberPlayers, searchQuery, setSearchQuery, selectionMode, selectedPlayerIds, setSelectedPlayerIds, showTier } = useTeamBalanceContext();
  const { players } = usePlayerContext();
  const {
    newName, setNewName, newTier, setNewTier,
    newP1s, setNewP1s, newP2s, setNewP2s, newP3s, setNewP3s,
    newForbidden, setNewForbidden,
    showNewPlayerFormation, setShowNewPlayerFormation,
    addPlayer, editingPlayerId, setEditingPlayerId,
    toggleParticipation, updatePlayer, removePlayerFromSystem,
  } = usePlayerActionsContext();

  const [isPlayerRegistrationOpen, setIsPlayerRegistrationOpen] = useState(false);

  // 전체 탭: 이름 기준 그룹핑 (모든 종목의 플레이어를 이름별로 묶음)
  const groupedPlayers = useMemo((): GroupedPlayer[] => {
    if (activeTab !== SportType.ALL) return [];
    const q = searchQuery.trim().toLowerCase();
    const allPlayers = q ? players.filter(p => p.name.toLowerCase().includes(q)) : players;
    const map = new Map<string, { tiers: Tier[]; sports: Set<SportType> }>();
    allPlayers.forEach(p => {
      const existing = map.get(p.name);
      if (existing) {
        existing.tiers.push(p.tier);
        existing.sports.add(p.sportType);
      } else {
        map.set(p.name, { tiers: [p.tier], sports: new Set([p.sportType]) });
      }
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      highestTier: Math.max(...data.tiers) as Tier,
      sportTypes: Array.from(data.sports),
    }));
  }, [activeTab, players, searchQuery]);
  return (
    <div className={`${selectionMode ? 'pb-20' : ''}`}>
      <p className="px-2 text-[12px] text-slate-400 dark:text-slate-500">{t('membersTabDesc')}</p>
      {activeTab !== SportType.ALL && (
        <section className="w-full">
          <button
            type="button"
            className="flex items-center px-2 py-3 cursor-pointer select-none gap-2 w-full text-left"
            onClick={() => setIsPlayerRegistrationOpen(!isPlayerRegistrationOpen)}
            aria-expanded={isPlayerRegistrationOpen}
          >
              <div className="text-slate-500 dark:text-slate-400"><PlusIcon /></div>
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
              <div className={`transition-transform duration-300 ${isPlayerRegistrationOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
          </button>
          {isPlayerRegistrationOpen && (
            <form onSubmit={addPlayer} className="px-2 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
                <input type="text" placeholder={t('playerNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none transition-all text-[14px] font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('skillTier')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                    <button key={key} type="button" onClick={e => { e.preventDefault(); setNewTier(val); }} className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${newTier === val ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500'}`}>{key}</button>
                  ))}
                </div>
              </div>
              {activeTab !== SportType.GENERAL && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setShowNewPlayerFormation(!showNewPlayerFormation)}
                    className={`w-full h-12 rounded-2xl text-[12px] font-semibold transition-all flex items-center justify-center gap-2 ${showNewPlayerFormation ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95' : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'}`}>
                    <EditIcon /> {t('visualPositionEditor')}
                  </button>
                  {showNewPlayerFormation && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <FormationPicker sport={activeTab} primaryP={newP1s} secondaryP={newP2s} tertiaryP={newP3s} forbiddenP={newForbidden} lang={lang}
                        onChange={(p, s, t, f) => { setNewP1s(p); setNewP2s(s); setNewP3s(t); setNewForbidden(f); }} />
                    </div>
                  )}
                </div>
              )}
              <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-[16px] mt-2 shadow-lg shadow-slate-900/30 dark:shadow-white/20">
                <PlusIcon /> {t('addToList')}
              </button>
            </form>
          )}
        </section>
      )}

      <div>
        <div className="px-2 py-3 flex items-center gap-2">
            <div className="text-slate-500 dark:text-slate-400"><UserPlusIcon /></div>
            <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{t('memberList')} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({activeTab === SportType.ALL ? groupedPlayers.length : memberPlayers.length})</span></h2>
        </div>

        <div className="relative mb-2">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl pl-9 pr-9 py-2.5 text-[14px] font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div className="space-y-1">
          {activeTab === SportType.ALL ? (
            /* 전체 탭: 이름별 그룹핑 + 종목 표시 */
            groupedPlayers.length === 0 ? (
              searchQuery.trim() ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <p className="text-[14px] font-semibold text-slate-400 dark:text-slate-500">{t('noSearchResults')}</p>
                  <button onClick={() => setSearchQuery('')} className="text-[12px] font-bold text-blue-500 hover:text-blue-500 transition-colors">{t('cancel')}</button>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <UserPlusIcon size={40} />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-400 dark:text-slate-500">{t('noPlayersHint')}</p>
                </div>
              )
            ) : (
              groupedPlayers.map(g => (
                <button
                  key={g.name}
                  type="button"
                  className="flex items-center px-2 py-1 rounded-2xl transition-all duration-200 bg-slate-100/80 dark:bg-slate-900/40 w-full text-left active:scale-[0.98]"
                  onClick={() => {
                    if (g.sportTypes.length === 1) {
                      setMembersTab(g.sportTypes[0]);
                    } else {
                      setMembersTab(g.sportTypes[0]);
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5 flex-1 overflow-hidden">
                    <div className="w-[52px] h-[52px] rounded-full bg-[#eaeef4] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-400 dark:text-slate-400 shrink-0">
                      BELO
                    </div>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-2">
                        {showTier && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium ${TIER_BADGE_COLORS[g.highestTier]}`}>
                            {Tier[g.highestTier]}
                          </span>
                        )}
                        <span className="text-[16px] font-medium text-slate-900 dark:text-white truncate">
                          {g.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {g.sportTypes.map(sport => (
                          <span key={sport} className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {t(sport.toLowerCase())}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-300 dark:text-slate-600 shrink-0 pr-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </button>
              ))
            )
          ) : (
            /* 종목별 탭: 기존 PlayerItem */
            memberPlayers.length === 0 ? (
              searchQuery.trim() ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <p className="text-[14px] font-semibold text-slate-400 dark:text-slate-500">{t('noSearchResults')}</p>
                  <button onClick={() => setSearchQuery('')} className="text-[12px] font-bold text-blue-500 hover:text-blue-500 transition-colors">{t('cancel')}</button>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="text-slate-300 dark:text-slate-600">
                    <UserPlusIcon size={40} />
                  </div>
                  <p className="text-[14px] font-semibold text-slate-400 dark:text-slate-500">{t('noPlayersHint')}</p>
                  <button onClick={() => setIsPlayerRegistrationOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-[12px] font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
                    {t('playerRegistration')}
                  </button>
                </div>
              )
            ) : (
              memberPlayers.map(p => (
                <PlayerItem key={p.id} player={p} isEditing={editingPlayerId === p.id} lang={lang}
                  onToggle={toggleParticipation} onEditToggle={setEditingPlayerId} onUpdate={updatePlayer} onRemove={removePlayerFromSystem}
                  isSelectionMode={!!selectionMode} isSelected={selectedPlayerIds.includes(p.id)}
                  onSelect={(id: string) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  showTier={showTier} />
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
});
