
import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';
import * as Icons from '../../Icons';

const { PlusIcon, ShareIcon, UserCheckIcon, ShuffleIcon, CloseIcon } = Icons;

export const GuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}> = ({ isOpen, onClose, title, content }) => {
  const { t, darkMode } = useAppContext();

  if (!isOpen) return null;

  const parts = content.split('|');
  const steps = parts.slice(0, 4);
  const features = parts.slice(4);

  const stepIcons = [
    <PlusIcon />,
    <ShareIcon />,
    <UserCheckIcon />,
    <ShuffleIcon />
  ];

  const stepColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500'
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-4" style={{ zIndex: Z_INDEX.GUIDE_MODAL }} onClick={onClose}>
      <div
        className={`w-full max-w-md max-h-[85vh] flex flex-col relative overflow-hidden transition-all duration-500 rounded-[2rem] shadow-2xl animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className={`text-[20px] font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-2xl transition-all active:scale-90 ${darkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
          <div className="grid grid-cols-1 gap-2.5">
            {steps.map((step, idx) => (
              <div key={idx} className={`group relative p-3 rounded-2xl border transition-all duration-300 ${darkMode ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 ${stepColors[idx]}`}>
                    {stepIcons[idx]}
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-black uppercase tracking-widest opacity-40">Step {idx + 1}</span>
                    <p className={`text-[13px] font-bold leading-snug ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      {step}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`p-4 rounded-2xl ${darkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>
              <div className="w-1 h-1 rounded-full bg-current" />
              {t('additionalFeatures')}
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`w-1 h-1 rounded-full ${darkMode ? 'bg-blue-500/40' : 'bg-blue-300'}`} />
                  <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[14px] rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
          >
            {t('gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};
