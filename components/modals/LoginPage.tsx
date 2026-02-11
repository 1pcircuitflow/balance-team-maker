
import React from 'react';
import { useAppContext } from '../../contexts/AppContext';

export const LoginPage: React.FC<{
  isOpen: boolean; onLater: () => void; onLogin: () => void;
}> = ({ isOpen, onLater, onLogin }) => {
  const { t } = useAppContext();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-end bg-white dark:bg-slate-950 px-5" style={{ paddingBottom: '180px' }}>
      <div className="flex flex-col items-center w-full max-w-sm">
        <div className="flex flex-col items-center" style={{ marginBottom: '8vh' }}>
          <img
            src="/assets/logo.png"
            alt="BELO Logo"
            style={{ width: '150px', height: '180px', objectFit: 'contain' }}
          />
          <div className="text-center" style={{ marginTop: '-30px' }}>
            <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
              {t('loginSlogan')}
            </p>
            <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 mt-1" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
              BELO
            </p>
          </div>
        </div>

        <div className="w-full text-center" style={{ marginBottom: '4vh' }}>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
            {t('loginDescription')}
          </p>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          <button
            onClick={onLogin}
            className="w-full max-w-[295px] h-[56px] flex items-center justify-center gap-3 active:scale-[0.98] transition-transform bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md text-[16px] font-semibold text-slate-900 dark:text-slate-100"
            style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            {t('googleLogin')}
          </button>

          <button
            onClick={onLater}
            className="w-full max-w-[295px] h-[56px] flex items-center justify-center active:scale-[0.98] transition-transform bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md text-[16px] font-semibold text-slate-500 dark:text-slate-400"
            style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}
          >
            {t('loginLater')}
          </button>
        </div>
      </div>
    </div>
  );
};
