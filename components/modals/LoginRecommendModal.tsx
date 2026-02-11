
import React from 'react';
import { BaseModal } from './BaseModal';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const LoginRecommendModal: React.FC<{
  isOpen: boolean; onLater: () => void; onLogin: () => void;
}> = ({ isOpen, onLater, onLogin }) => {
  const { t, darkMode } = useAppContext();

  return (
    <BaseModal isOpen={isOpen} zIndex={Z_INDEX.LOGIN_RECOMMEND}>
      <div className={`rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="w-16 h-16 bg-amber-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
          💡
        </div>

        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {t('loginRecommendTitle')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('loginRecommendMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            {t('googleLogin')}
          </button>
          <button
            onClick={onLater}
            className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('continueWithoutLogin')}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};
