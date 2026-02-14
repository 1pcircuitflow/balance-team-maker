
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';
import * as Icons from '../../Icons';

export const UpdateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  message: string;
  forceUpdate: boolean;
}> = ({ isOpen, onClose, onUpdate, message, forceUpdate }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.UPDATE_MODAL} maxWidth="max-w-[320px]">
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
            <Icons.RotateCcwIcon size={24} />
          </div>

          <div className="space-y-2">
            <h3 className={`text-[24px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} tracking-tight`}>
              {t('updateAvailable')}
            </h3>
            <p className={`text-[14px] font-medium leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {message}
            </p>
          </div>

          <div className="flex flex-col w-full space-y-3">
            <button
              onClick={onUpdate}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
            >
              {t('updateNow')}
            </button>

            {!forceUpdate && (
              <button
                onClick={onClose}
                className={`w-full py-3 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 dark:text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t('later')}
              </button>
            )}
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
