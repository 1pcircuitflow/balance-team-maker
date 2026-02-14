
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const ReviewPrompt: React.FC<{
  isOpen: boolean; onLater: () => void; onRate: () => void;
}> = ({ isOpen, onLater, onRate }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.REVIEW_PROMPT}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-[24px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>{t('reviewTitle')}</h3>
        <p className={`text-[14px] font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('reviewMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onRate}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
          >
            {t('now')}
          </button>
          <button
            onClick={onLater}
            className={`w-full py-3 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 dark:text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('later')}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
