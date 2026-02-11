
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const AlertModal: React.FC<{
  isOpen: boolean; title?: string; message: string; onConfirm: () => void;
}> = ({ isOpen, title, message, onConfirm }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.DEFAULT_MODAL}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {title || t('validationErrorTitle')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {message}
        </p>
        <button
          onClick={onConfirm}
          className="w-full py-4 bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
        >
          OK
        </button>
      </div>
    </BaseModal>
  );
};
