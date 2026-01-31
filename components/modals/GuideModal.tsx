import React from 'react';
import { PlusIcon, ShareIcon, UserCheckIcon, ShuffleIcon, CloseIcon } from '../../Icons';
import { Language } from '../../translations';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    darkMode: boolean;
    lang: Language;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, title, content, darkMode, lang }) => {
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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 p-4" onClick={onClose}>
            <div
                className={`w-full max-w-md max-h-[85vh] flex flex-col relative overflow-hidden transition-all duration-500 rounded-3xl shadow-2xl animate-scale-in ${darkMode ? 'bg-slate-900 border border-slate-800 shadow-black/50' : 'bg-white shadow-slate-900/10'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5">
                    <h3 className={`text-xl font-bold tracking-tight ${darkMode ? 'text-slate-50' : 'text-slate-900'}`}>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-xl transition-all duration-200 active:scale-90 min-w-[36px] min-h-[36px] flex items-center justify-center ${darkMode ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
                    {/* Steps Grid */}
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

                    {/* Features Section */}
                    <div className={`p-4 rounded-2xl ${darkMode ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
                        <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                            <div className="w-1 h-1 rounded-full bg-current" />
                            추가 기능
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

                    {/* Bottom Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/30"
                    >
                        {lang === 'ko' ? '확인했습니다' : (lang === 'en' ? 'Got it' : 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
