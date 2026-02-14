
import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';
import * as Icons from '../../Icons';

const { EditIcon, CheckIcon, ExternalLinkIcon } = Icons;

export const InfoModal: React.FC<{
  isOpen: boolean; onClose: () => void; onUpgradeRequest: () => void; onRestore: () => void;
  isAdFree: boolean; isUnlimitedPos: boolean; user: any;
  nickname: string; onUpdateNickname: (name: string) => void; onLogin: () => void; onLogout: () => void;
}> = ({ isOpen, onClose, onUpgradeRequest, onRestore, isAdFree, isUnlimitedPos, user, nickname, onUpdateNickname, onLogin, onLogout }) => {
  const { t, darkMode } = useAppContext();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);

  useEffect(() => {
    setTempNickname(nickname);
  }, [nickname, isOpen]);

  const onSaveNickname = () => {
    if (tempNickname.trim()) {
      onUpdateNickname(tempNickname.trim());
      setIsEditingName(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={Z_INDEX.INFO_MODAL}>
      <div className={`rounded-[2.5rem] p-8 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'} space-y-8`}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className={`text-[24px] font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'} tracking-tight`}>{t('infoTitle')}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 text-[30px] leading-none">&times;</button>
          </div>

          <div className={`p-5 rounded-[2rem] border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {user?.provider === 'kakao' ? 'Kakao Account' : 'Google Account'}
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg text-[14px] font-bold border-2 outline-none focus:border-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      placeholder={t('nicknamePlaceholder')}
                      autoFocus
                    />
                    <button onClick={onSaveNickname} className="p-2 bg-blue-500 text-white rounded-lg shadow-lg active:scale-90"><CheckIcon /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className={`text-[18px] font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{nickname}</span>
                    <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors pointer-events-auto"><EditIcon /></button>
                  </div>
                )}
              </div>
              <button onClick={onLogout} className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
                {t('logout')}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <a href="https://play.google.com/store/apps/details?id=com.balanceteammaker" target="_blank" rel="noreferrer" className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
              <span className={`text-[14px] font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('rateApp')}</span>
              <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ExternalLinkIcon /></div>
            </a>
          </div>

          <div className="pt-2 flex justify-center text-[10px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-[0.3em]">
            {t('version')} 2.1.17
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
