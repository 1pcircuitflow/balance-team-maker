import React, { useState } from 'react';
import { Tier, Position, SportType, Player } from '../../types';
import { Z_INDEX } from '../../constants';
import { PlayerItem } from '../PlayerItem';
import { FormationPicker } from '../FormationPicker';
import { db } from '../../services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppContext } from '../../contexts/AppContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { usePlayerContext } from '../../contexts/PlayerContext';
import { useTeamBalanceContext } from '../../contexts/TeamBalanceContext';
import { useRecruitmentContext } from '../../contexts/RecruitmentContext';
import * as Icons from '../../Icons';

const { ArrowLeftIcon, CheckIcon, PlusIcon, EditIcon } = Icons;

interface MemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemberPickerModal: React.FC<MemberPickerModalProps> = React.memo(({
  isOpen, onClose,
}) => {
  const { t, lang } = useAppContext();
  const { adBannerHeight } = useAuthContext();
  const { players, setPlayers } = usePlayerContext();
  const { showTier } = useTeamBalanceContext();
  const { currentActiveRoom } = useRecruitmentContext();
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);

  // 선수등록 폼 로컬 상태
  const [isRegFormOpen, setIsRegFormOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regTier, setRegTier] = useState<Tier>(Tier.B);
  const [regP1s, setRegP1s] = useState<Position[]>([]);
  const [regP2s, setRegP2s] = useState<Position[]>([]);
  const [regP3s, setRegP3s] = useState<Position[]>([]);
  const [regForbidden, setRegForbidden] = useState<Position[]>([]);
  const [showFormation, setShowFormation] = useState(false);

  if (!isOpen) return null;

  const roomSport = currentActiveRoom?.sport;
  const approvedNames = new Set((currentActiveRoom?.applicants || []).filter(a => a.isApproved).map(a => a.name));
  const pickablePlayers = players
    .filter(p => roomSport ? p.sportType === roomSport : true)
    .filter(p => !approvedNames.has(p.name));

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
          isApproved: true, status: 'APPROVED' as const, position: joinedPos,
          primaryPositions: player.primaryPositions || [], secondaryPositions: player.secondaryPositions || [],
          tertiaryPositions: player.tertiaryPositions || [], forbiddenPositions: player.forbiddenPositions || [],
          appliedAt: new Date().toISOString(), source: 'host'
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

  const handleRegisterAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = regName.trim();
    if (!trimmed || !currentActiveRoom) return;

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: trimmed,
      tier: regTier,
      isActive: false,
      sportType: roomSport || SportType.GENERAL,
      primaryPositions: regP1s,
      secondaryPositions: regP2s,
      tertiaryPositions: regP3s,
      forbiddenPositions: regForbidden,
    };

    // 회원목록에 추가
    setPlayers(prev => [newPlayer, ...prev]);

    // Firestore applicants에 즉시 추가
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const currentApps = [...(currentActiveRoom.applicants || [])];
      const joinedPos = (newPlayer.primaryPositions && newPlayer.primaryPositions.length > 0) ? newPlayer.primaryPositions.join('/') : 'NONE';
      currentApps.push({
        id: 'app_' + Math.random().toString(36).substr(2, 9),
        name: newPlayer.name,
        tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === newPlayer.tier) || 'B',
        isApproved: true, status: 'APPROVED' as const,
        position: joinedPos,
        primaryPositions: newPlayer.primaryPositions || [],
        secondaryPositions: newPlayer.secondaryPositions || [],
        tertiaryPositions: newPlayer.tertiaryPositions || [],
        forbiddenPositions: newPlayer.forbiddenPositions || [],
        appliedAt: new Date().toISOString(), source: 'host'
      });
      await updateDoc(roomRef, { applicants: currentApps });
    } catch (e) { console.error("Register and add player error:", e); }

    // 폼 초기화
    setRegName('');
    setRegTier(Tier.B);
    setRegP1s([]);
    setRegP2s([]);
    setRegP3s([]);
    setRegForbidden([]);
    setShowFormation(false);
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
                isApproved: true, status: 'APPROVED' as const, position: joinedPos,
                primaryPositions: p.primaryPositions || [], secondaryPositions: p.secondaryPositions || [],
                tertiaryPositions: p.tertiaryPositions || [], forbiddenPositions: p.forbiddenPositions || [],
                appliedAt: new Date().toISOString(), source: 'host'
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
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-slate-950" style={{ zIndex: Z_INDEX.MEMBER_PICKER, paddingTop: 'env(safe-area-inset-top)', paddingBottom: `calc(${adBannerHeight}px + env(safe-area-inset-bottom))` }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-900">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-900 dark:text-white transition-all active:scale-90"><ArrowLeftIcon size={24} /></button>
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{t('addParticipant')}</h2>
          <span className="text-slate-400 dark:text-slate-500 text-[14px] font-normal">({pickablePlayers.length})</span>
        </div>
        <button
          onClick={handleSelectAll}
          className={`bg-blue-500 text-white px-[8px] h-[28px] rounded-xl text-[12px] font-medium transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 ${selectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
        >
          {selectAllConfirm ? <><CheckIcon /> {t('confirmRetry')}</> : t('selectAll')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 pb-20 space-y-1">
        {/* 접이식 선수등록 폼 */}
        <section className="w-full">
          <button
            type="button"
            className="flex items-center px-2 py-3 cursor-pointer select-none gap-2 w-full text-left"
            onClick={() => setIsRegFormOpen(!isRegFormOpen)}
            aria-expanded={isRegFormOpen}
          >
            <div className="text-slate-500 dark:text-slate-400"><PlusIcon /></div>
            <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
            <div className={`transition-transform duration-300 ${isRegFormOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </button>
          {isRegFormOpen && (
            <form onSubmit={handleRegisterAndAdd} className="px-2 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
                <input type="text" placeholder={t('playerNamePlaceholder')} value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 rounded-xl px-4 py-3 focus:outline-none transition-all text-[14px] font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('skillTier')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                    <button key={key} type="button" onClick={e => { e.preventDefault(); setRegTier(val); }} className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${regTier === val ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500'}`}>{key}</button>
                  ))}
                </div>
              </div>
              {roomSport && roomSport !== SportType.GENERAL && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setShowFormation(!showFormation)}
                    className={`w-full h-12 rounded-2xl text-[12px] font-semibold transition-all flex items-center justify-center gap-2 ${showFormation ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95' : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'}`}>
                    <EditIcon /> {t('visualPositionEditor')}
                  </button>
                  {showFormation && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <FormationPicker sport={roomSport} primaryP={regP1s} secondaryP={regP2s} tertiaryP={regP3s} forbiddenP={regForbidden} lang={lang}
                        onChange={(p, s, tr, f) => { setRegP1s(p); setRegP2s(s); setRegP3s(tr); setRegForbidden(f); }} />
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

        {pickablePlayers.length === 0 ? (
          <div className="py-6 opacity-20 text-center text-[12px] font-black uppercase tracking-widest">{t('noPlayers')}</div>
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
