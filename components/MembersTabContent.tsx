import React, { useState } from 'react';
import { Tier, SportType } from '../types';
import { PlayerItem } from './PlayerItem';
import { FormationPicker } from './FormationPicker';
import { useAppContext } from '../contexts/AppContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';
import { usePlayerActionsContext } from '../contexts/PlayerActionsContext';
import * as Icons from '../Icons';

const { PlusIcon, UserPlusIcon, EditIcon, CloseIcon } = Icons;

export const MembersTabContent: React.FC = React.memo(() => {
  const { t, lang } = useAppContext();
  const { activeTab } = useNavigationContext();
  const { memberPlayers, searchQuery, setSearchQuery, selectionMode, selectedPlayerIds, setSelectedPlayerIds, showTier } = useTeamBalanceContext();
  const {
    newName, setNewName, newTier, setNewTier,
    newP1s, setNewP1s, newP2s, setNewP2s, newP3s, setNewP3s,
    newForbidden, setNewForbidden,
    showNewPlayerFormation, setShowNewPlayerFormation,
    addPlayer, editingPlayerId, setEditingPlayerId,
    toggleParticipation, updatePlayer, removePlayerFromSystem,
  } = usePlayerActionsContext();

  const [isPlayerRegistrationOpen, setIsPlayerRegistrationOpen] = useState(false);
  return (
    <div className={`space-y-2 ${selectionMode ? 'pb-80' : 'pb-44'}`}>
      {activeTab !== SportType.ALL && (
        <section className="w-full">
          <div className="flex items-center px-2 py-3 cursor-pointer select-none gap-2" onClick={() => setIsPlayerRegistrationOpen(!isPlayerRegistrationOpen)}>
              <div className="text-slate-400 dark:text-slate-500"><PlusIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
              <div className={`transition-transform duration-300 ${isPlayerRegistrationOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
          </div>
          {isPlayerRegistrationOpen && (
            <form onSubmit={addPlayer} className="px-2 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
                <input type="text" placeholder={t('playerNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none transition-all text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
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
                    className={`w-full h-12 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${showNewPlayerFormation ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95' : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'}`}>
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
              <button type="submit" className="w-full bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-semibold h-12 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs mt-2">
                <PlusIcon /> {t('addToList')}
              </button>
            </form>
          )}
        </section>
      )}

      <div>
        <div className="px-2 py-3 flex items-center gap-2">
            <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('memberList')} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({memberPlayers.length})</span></h2>
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
            className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl pl-9 pr-9 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        <div className="space-y-1">
          {memberPlayers.length === 0 ? (
            searchQuery.trim() ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="text-slate-300 dark:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t('noSearchResults')}</p>
                <button onClick={() => setSearchQuery('')} className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors">{t('cancel')}</button>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="text-slate-300 dark:text-slate-600">
                  <UserPlusIcon size={40} />
                </div>
                <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{t('noPlayersHint')}</p>
                <button onClick={() => setIsPlayerRegistrationOpen(true)} className="bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95">
                  {t('playerRegistration')}
                </button>
              </div>
            )
          ) : (
            memberPlayers.map(p => (
              <PlayerItem key={p.id} player={p} isEditing={editingPlayerId === p.id} lang={lang}
                onToggle={toggleParticipation} onEditToggle={setEditingPlayerId} onUpdate={updatePlayer} onRemove={removePlayerFromSystem}
                isSelectionMode={!!selectionMode} isSelected={selectedPlayerIds.includes(p.id)}
                onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                showTier={showTier} />
            ))
          )}
        </div>
      </div>
    </div>
  );
});
