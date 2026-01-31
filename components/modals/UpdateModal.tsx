import React from 'react';
import { Language } from '../../translations';
import { RotateCcwIcon } from '../../Icons';

interface UpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
    message: string;
    forceUpdate: boolean;
    lang: Language;
    darkMode: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, onUpdate, message, forceUpdate, lang, darkMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
            <div className={`w-full max-w-[320px] rounded-3xl p-6 shadow-2xl transform transition-all scale-100 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <RotateCcwIcon size={24} />
                    </div>

                    <div className="space-y-2">
                        <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {lang === 'ko' ? '업데이트 알림' : (lang === 'en' ? 'Update Available' : 'Actualización disponible')}
                        </h3>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {message}
                        </p>
                    </div>

                    <div className="flex flex-col w-full gap-2 mt-2">
                        <button
                            onClick={onUpdate}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
                        >
                            {lang === 'ko' ? '지금 업데이트' : (lang === 'en' ? 'Update Now' : 'Actualizar ahora')}
                        </button>

                        {!forceUpdate && (
                            <button
                                onClick={onClose}
                                className={`w-full py-3.5 font-bold rounded-xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                {lang === 'ko' ? '나중에 하기' : (lang === 'en' ? 'Later' : 'Más tarde')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
