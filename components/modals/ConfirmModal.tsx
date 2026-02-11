
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const ConfirmModal: React.FC<{
  isOpen: boolean; title?: string; message: string; onConfirm: () => void; onCancel: () => void; confirmText?: string; cancelText?: string;
}> = ({ isOpen, title, message, onConfirm, onCancel, confirmText, cancelText }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.DEFAULT_MODAL}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {title || t('infoTitle')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-4 font-bold rounded-2xl transition-all active:scale-95 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
