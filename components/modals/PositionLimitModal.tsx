
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const PositionLimitModal: React.FC<{
  isOpen: boolean; onWatchAd: () => void; onUpgrade: () => void; onClose: () => void;
}> = ({ isOpen, onWatchAd, onUpgrade, onClose }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.POSITION_LIMIT}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="w-16 h-16 bg-amber-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/20 text-[30px]">
          ⏳
        </div>

        <h3 className={`text-[24px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {t('dailyLimitReached')}
        </h3>
        <p className={`text-[14px] font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('positionLimitMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onWatchAd}
            className="w-full py-3 bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            <span>📺</span>
            {t('watchAdUnlock')}
          </button>
          <button
            onClick={onClose}
            className={`w-full py-3 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
