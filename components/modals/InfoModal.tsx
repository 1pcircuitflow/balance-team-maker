import React, { useState, useEffect } from 'react';
import { Language, TRANSLATIONS } from '../../translations';
import { CheckIcon, EditIcon, ExternalLinkIcon } from '../../Icons';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpgradeRequest: () => void;
    onRestore: () => void;
    lang: Language;
    darkMode: boolean;
    isAdFree: boolean;
    isUnlimitedPos: boolean;
    user: any;
    nickname: string;
    onUpdateNickname: (name: string) => void;
    onLogin: () => void;
    onLogout: () => void;
    showAlert: (msg: string, title?: string) => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, onUpgradeRequest, onRestore, lang, darkMode, isAdFree, isUnlimitedPos, user, nickname, onUpdateNickname, onLogin, onLogout }) => {
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
    const isPro = isAdFree;

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempNickname, setTempNickname] = useState(nickname);

    useEffect(() => {
        setTempNickname(nickname);
    }, [nickname, isOpen]);

    const onSaveNickname = () => {
        if (tempNickname.trim()) {
            onUpdateNickname(tempNickname.trim());
            setIsEditingName(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in duration-300" onClick={onClose}>
            <div className={`w-full max-w-sm rounded-3xl p-8 animate-scale-in ${darkMode ? 'bg-slate-900 border border-slate-800 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-900/10'} space-y-8`} onClick={e => e.stopPropagation()}>
                <div className="space-y-6">
                <div className="flex items-center justify-between">
                        <h3 className={`text-2xl font-bold ${darkMode ? 'text-slate-50' : 'text-slate-900'} tracking-tight`}>{t('infoTitle')}</h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors p-2 text-3xl leading-none active:scale-90">&times;</button>
                    </div>

                    {/* 프로필 섹션 */}
                    <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-black border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                    {user ? 'Google Account' : 'Guest Mode'}
                                </span>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={tempNickname}
                                            onChange={(e) => setTempNickname(e.target.value)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 outline-none focus:border-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                            placeholder={t('nicknamePlaceholder')}
                                            autoFocus
                                        />
                                        <button onClick={onSaveNickname} className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 active:scale-90"><CheckIcon /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <span className={`text-lg font-bold ${darkMode ? 'text-slate-50' : 'text-slate-900'}`}>{nickname}</span>
                                        <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-all duration-200 pointer-events-auto active:scale-90"><EditIcon /></button>
                                    </div>
                                )}
                            </div>
                            {user ? (
                                <button onClick={onLogout} className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
                                    {t('logout')}
                                </button>
                            ) : (
                                <button onClick={onLogin} className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
                                    {t('googleLogin')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <a href="https://play.google.com/store/apps/details?id=com.balanceteammaker" target="_blank" rel="noreferrer" className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all duration-200 hover:shadow-lg ${darkMode ? 'bg-black border-slate-800 hover:bg-slate-950 hover:shadow-black/30' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-slate-200/50'}`}>
                            <span className={`text-sm font-bold ${darkMode ? 'text-slate-50' : 'text-slate-900'}`}>{t('rateApp')}</span>
                            <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ExternalLinkIcon /></div>
                        </a>
                    </div>

                    <div className="pt-2 flex justify-center text-[10px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-[0.3em]">
                        {t('version')} 2.1.17
                    </div>
                </div>
            </div>
        </div>
    );
};
