
import React, { useState, useEffect } from 'react';
import { Z_INDEX } from '../../constants';
import { TRANSLATIONS, Language } from '../../translations';
import {
  getRoomInfo,
  applyForParticipation,
  RecruitmentRoom,
} from '../../services/firebaseService';

// 참가 신청 모달
export const ApplyRoomModal: React.FC<{
  isOpen: boolean;
  roomId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  lang: Language;
  darkMode: boolean;
}> = ({ isOpen, roomId, onClose, onSuccess, lang, darkMode }) => {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<string>('B');
  const [pos, setPos] = useState<string>('MF');
  const [room, setRoom] = useState<RecruitmentRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  useEffect(() => {
    if (roomId && isOpen) {
      getRoomInfo(roomId).then(setRoom);
      setErrorMsg(null);
    }
  }, [roomId, isOpen]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!roomId || !name) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const fcmToken = localStorage.getItem('fcm_token') || undefined;
      await applyForParticipation(roomId, { name, tier, position: pos, ...(fcmToken ? { fcmToken } : {}) });
      onSuccess();
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_APPLICATION') {
        setErrorMsg(t('duplicateApplicationMsg' as any));
      } else if (err?.message === 'ROOM_FULL') {
        setErrorMsg(t('roomFullMsg' as any));
      } else if (err?.message === 'ROOM_NOT_FOUND') {
        setErrorMsg(t('roomNotFoundMsg' as any));
      } else {
        setErrorMsg(t('networkErrorMsg'));
      }
    } finally { setLoading(false); }
  };
  if (!isOpen || !room) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_INDEX.RESULT_OVERLAY }}>
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 space-y-6">
        <div className="text-center space-y-2"><h3 className="text-[20px] font-black text-slate-900 dark:text-white">{t('applyTitle', room.sport)}</h3><p className="text-blue-500 font-bold text-[14px]">{room.matchDate} {room.matchTime}</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('inputNamePlaceholder')} className="w-full bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 dark:text-white font-bold" />
          <div className="grid grid-cols-5 gap-1.5">
            {['S', 'A', 'B', 'C', 'D'].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setTier(v)}
                className={`py-3 rounded-xl font-black text-[12px] ${tier === v ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 border-2 border-slate-900 dark:border-slate-200' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-2 border-transparent'}`}
              >
                {v}
              </button>
            ))}
          </div>
          {errorMsg && (
            <p className="text-rose-500 text-[14px] font-bold text-center">{errorMsg}</p>
          )}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl mt-4 shadow-lg shadow-blue-500/30">{loading ? '...' : t('completeApplication')}</button>
          <button type="button" onClick={onClose} className="w-full py-3 text-slate-400 font-semibold text-[14px] rounded-2xl transition-all active:scale-95">{t('cancel')}</button>
        </form>
      </div>
    </div>
  );
};
