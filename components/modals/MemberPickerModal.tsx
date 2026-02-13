import React, { useState } from 'react';
import { Tier } from '../../types';
import { PlayerItem } from '../PlayerItem';
import { db } from '../../services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../../contexts/AppContext';
import { usePlayerContext } from '../../contexts/PlayerContext';
import { useTeamBalanceContext } from '../../contexts/TeamBalanceContext';
import { useRecruitmentContext } from '../../contexts/RecruitmentContext';
import * as Icons from '../../Icons';

const { ArrowLeftIcon, CheckIcon } = Icons;

interface MemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemberPickerModal: React.FC<MemberPickerModalProps> = React.memo(({
  isOpen, onClose,
}) => {
  const { t, lang } = useAppContext();
  const { players } = usePlayerContext();
  const { memberPlayers, showTier } = useTeamBalanceContext();
  const { currentActiveRoom } = useRecruitmentContext();
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);

  if (!isOpen) return null;

  const approvedNames = new Set((currentActiveRoom?.applicants || []).filter(a => a.isApproved).map(a => a.name));
  const pickablePlayers = memberPlayers.filter(p => !approvedNames.has(p.name));

  const addPlayerToRoom = async (id: string) => {
    const player = players.find(p => p.id === id);
    if (!player || !currentActiveRoom) return;
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const currentApps = [...(currentActiveRoom.applicants || [])];
      const exists = currentApps.find(a => a.name === player.name);
      const joinedPos = (player.primaryPositions && player.primaryPositions.length > 0) ? player.primaryPositions.join('/') : (player.primaryPosition || 'NONE');
      if (!exists) {
        currentApps.push({
          id: 'app_' + Math.random().toString(36).substr(2, 9), name: player.name,
          tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === player.tier) || 'B',
          isApproved: true, position: joinedPos,
          primaryPositions: player.primaryPositions || [], secondaryPositions: player.secondaryPositions || [],
          tertiaryPositions: player.tertiaryPositions || [], forbiddenPositions: player.forbiddenPositions || [],
          appliedAt: new Date().toISOString()
        });
      } else {
        const idx = currentApps.findIndex(a => a.name === player.name);
        currentApps[idx].isApproved = true;
        currentApps[idx].position = joinedPos;
        currentApps[idx].primaryPositions = player.primaryPositions?.map(String) || [];
        currentApps[idx].secondaryPositions = player.secondaryPositions?.map(String) || [];
        currentApps[idx].tertiaryPositions = player.tertiaryPositions?.map(String) || [];
        currentApps[idx].forbiddenPositions = player.forbiddenPositions?.map(String) || [];
      }
      await updateDoc(roomRef, { applicants: currentApps });
    } catch (e) { console.error("Add player to room error:", e); }
  };

  const handleSelectAll = async () => {
    if (selectAllConfirm) {
      if (currentActiveRoom) {
        try {
          const roomRef = doc(db, 'rooms', currentActiveRoom.id);
          const currentApps = [...(currentActiveRoom.applicants || [])];
          pickablePlayers.forEach(p => {
            const exists = currentApps.find(a => a.name === p.name);
            const joinedPos = (p.primaryPositions && p.primaryPositions.length > 0) ? p.primaryPositions.join('/') : (p.primaryPosition || 'NONE');
            if (!exists) {
              currentApps.push({ id: 'app_' + Math.random().toString(36).substr(2, 9), name: p.name,
                tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
                isApproved: true, position: joinedPos,
                primaryPositions: p.primaryPositions || [], secondaryPositions: p.secondaryPositions || [],
                tertiaryPositions: p.tertiaryPositions || [], forbiddenPositions: p.forbiddenPositions || [],
                appliedAt: new Date().toISOString()
              });
            } else {
              const idx = currentApps.findIndex(a => a.name === p.name);
              currentApps[idx].isApproved = true; currentApps[idx].position = joinedPos;
              currentApps[idx].primaryPositions = p.primaryPositions?.map(String) || [];
              currentApps[idx].secondaryPositions = p.secondaryPositions?.map(String) || [];
              currentApps[idx].tertiaryPositions = p.tertiaryPositions?.map(String) || [];
              currentApps[idx].forbiddenPositions = p.forbiddenPositions?.map(String) || [];
            }
          });
          await updateDoc(roomRef, { applicants: currentApps });
        } catch (e) { console.error("Select All sync error:", e); }
      }
      setSelectAllConfirm(false);
      onClose();
    } else {
      setSelectAllConfirm(true);
      setTimeout(() => setSelectAllConfirm(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[2500] flex flex-col bg-white dark:bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-900">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-900 dark:text-white transition-all active:scale-90"><ArrowLeftIcon size={24} /></button>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('addParticipant')}</h2>
          <span className="text-slate-400 dark:text-slate-500 text-sm font-normal">({pickablePlayers.length})</span>
        </div>
        <button
          onClick={handleSelectAll}
          className={`bg-[#4685EB] text-white px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 ${selectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
        >
          {selectAllConfirm ? <><CheckIcon /> {t('confirmRetry')}</> : t('selectAll')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {pickablePlayers.length === 0 ? (
          <div className="py-6 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>
        ) : (
          pickablePlayers.map(p => (
            <PlayerItem key={p.id} player={{ ...p, isActive: false }} isEditing={false} lang={lang}
              onToggle={addPlayerToRoom} onEditToggle={() => {}} onUpdate={() => {}} onRemove={() => {}}
              isSelectionMode={false} isSelected={false}
              onSelect={() => {}}
              showTier={showTier} readOnly={true} />
          ))
        )}
      </div>
    </div>
  );
});
