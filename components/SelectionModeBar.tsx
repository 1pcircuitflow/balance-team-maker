import React from 'react';
import { TeamConstraint, AppPageType } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useNavigationContext } from '../contexts/NavigationContext';
import { useTeamBalanceContext } from '../contexts/TeamBalanceContext';

export const SelectionModeBar: React.FC = React.memo(() => {
  const { t } = useAppContext();
  const { isAdFree } = useAuthContext();
  const { currentPage } = useNavigationContext();
  const { selectionMode, selectedPlayerIds, setSelectionMode, setTeamConstraints } = useTeamBalanceContext();

  if (!selectionMode) return null;
  return (
    <div className="fixed left-0 right-0 z-[2100] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-300 overflow-hidden"
      style={{ bottom: currentPage === AppPageType.DETAIL ? (isAdFree ? 'env(safe-area-inset-bottom, 0px)' : 'calc(56px + env(safe-area-inset-bottom, 0px))') : 'calc(60px + env(safe-area-inset-bottom, 0px))', paddingBottom: currentPage === AppPageType.DETAIL ? (isAdFree ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '1rem') : '1rem' }}>
      <div className={`h-1 w-full ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
      <div className="max-w-4xl mx-auto flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t('selectionModeActive')}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${selectionMode === 'MATCH' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' : 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'}`}>
              {t('selectedCount', selectedPlayerIds.length)}
            </span>
          </div>
        </div>
        <p className={`text-[11px] font-medium ${selectionMode === 'MATCH' ? 'text-blue-500 dark:text-blue-400' : 'text-rose-500 dark:text-rose-400'}`}>
          {selectionMode === 'MATCH' ? t('matchDescription') : t('splitDescription')}
        </p>
        <div className="flex gap-2">
          <button disabled={selectedPlayerIds.length < 2} onClick={() => {
            const newConstraint: TeamConstraint = { id: Math.random().toString(36).substr(2, 9), playerIds: selectedPlayerIds, type: selectionMode };
            setTeamConstraints(prev => [...prev, newConstraint]); setSelectionMode(null);
          }} className={`flex-1 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all ${selectedPlayerIds.length >= 2 ? (selectionMode === 'MATCH' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20') : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>{t('apply')}</button>
          <button onClick={() => setSelectionMode(null)} className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all">{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
});
