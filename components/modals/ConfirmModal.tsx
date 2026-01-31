import React from 'react';
import { Language, TRANSLATIONS } from '../../translations';

interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    lang: Language;
    darkMode: boolean;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel, lang, darkMode, confirmText, cancelText }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in duration-300" onClick={onCancel}>
            <div className={`w-full max-w-sm rounded-3xl p-8 text-center animate-scale-in ${darkMode ? 'bg-slate-900 border border-slate-800 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-900/10'}`} onClick={(e) => e.stopPropagation()}>
                <h3 className={`text-2xl font-bold ${darkMode ? 'text-slate-50' : 'text-slate-900'} mb-3 tracking-tight`}>
                    {title || t('infoTitle')}
                </h3>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
                    {message}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className={`flex-1 py-4 font-bold rounded-2xl transition-all duration-200 active:scale-95 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}
                    >
                        {cancelText || t('cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/30"
                    >
                        {confirmText || 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};
