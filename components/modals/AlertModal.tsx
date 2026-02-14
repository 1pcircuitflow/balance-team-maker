
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const AlertModal: React.FC<{
  isOpen: boolean; title?: string; message: string; onConfirm: () => void;
}> = ({ isOpen, title, message, onConfirm }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.ALERT_MODAL}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-[24px] font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {title || t('validationErrorTitle')}
        </h3>
        <p className={`text-[14px] font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {message}
        </p>
        <button
          onClick={onConfirm}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
        >
          OK
        </button>
      </div>
    </BaseModal>
  );
};
