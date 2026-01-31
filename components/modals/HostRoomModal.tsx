import React, { useState, useEffect, useRef } from 'react';
import { Player, SportType } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';
import { CloseIcon, MinusIcon, PlusIcon } from '../../Icons';
import { DateTimePicker } from '../common/DateTimePicker';
import {
    createRecruitmentRoom,
    getRoomInfo,
    subscribeToRoom,
    updateRoomFcmToken,
    RecruitmentRoom,
    db
} from '../../services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

interface HostRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRoomCreated: (room: RecruitmentRoom) => void;
    activeRoom: RecruitmentRoom | null;
    activeRooms: RecruitmentRoom[];
    activeTab: SportType;
    onCloseRoom: () => void;
    onApproveAll: (players: Player[]) => void;
    lang: Language;
    darkMode: boolean;
    isPro?: boolean;
    onUpgrade?: () => void;
    userNickname: string;
    currentUserId: string;
    activePlayerCount: number;
    showAlert: (msg: string, title?: string) => void;
}

export const HostRoomModal: React.FC<HostRoomModalProps> = ({
    isOpen, onClose, onRoomCreated, activeRoom, activeRooms, activeTab, onCloseRoom, onApproveAll,
    lang, darkMode, isPro, onUpgrade, userNickname, currentUserId, activePlayerCount, showAlert
}) => {
    /* 날짜/시간 초기값 및 상태 관리 */
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0); // 현재 시간 + 1시간 정각
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [startTime, setStartTime] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // 종료 시간은 시작 시간 + 1시간 기본값
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 2, 0, 0, 0); // 시작 시간(현재+1) + 1시간
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [endTime, setEndTime] = useState(() => {
        const d = new Date();
        d.setHours(d.getHours() + 2, 0, 0, 0);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const [activePicker, setActivePicker] = useState<'START' | 'END'>('START');

    const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
        const translation = (TRANSLATIONS[lang] as any)[key];
        if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
        return String(translation || key);
    };

    const [title, setTitle] = useState(`${TRANSLATIONS[lang][activeTab.toLowerCase() as any]} ${t('meeting')}`);
    const [loading, setLoading] = useState(false);
    const [useLimit, setUseLimit] = useState(false);
    const [maxApplicants, setMaxApplicants] = useState(12);
    const [tierMode, setTierMode] = useState<'5TIER' | '3TIER'>('5TIER');
    const [isPickerSelectionMode, setIsPickerSelectionMode] = useState(false);

    useEffect(() => {
        if (isOpen && !activeRoom) {
            // 모달이 열릴 때(새 방 생성 모드인 경우) 날짜와 시간을 현재 기준으로 리셋
            const d = new Date();
            d.setHours(d.getHours() + 1, 0, 0, 0); // 현재 시간 + 1시간의 정각

            const newStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const newStartTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            setStartDate(newStartDate);
            setStartTime(newStartTime);

            // 종료 시간은 시작 + 1시간
            const endD = new Date(d.getTime() + 60 * 60 * 1000);
            setEndDate(`${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`);
            setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);

            // 제목도 현재 탭에 맞춰 초기화
            setTitle(`${TRANSLATIONS[lang][activeTab.toLowerCase() as any]} ${t('meeting')}`);
        }

        if (activeRoom?.id && isOpen) {
            // 실시간 방 정보 구독
            const unsub = subscribeToRoom(activeRoom.id, (room) => {
                if (room) onRoomCreated(room);
            });

            // 방장의 최신 푸시 토큰 동기화 (알림용)
            const latestToken = localStorage.getItem('fcm_token');
            if (latestToken) {
                updateRoomFcmToken(activeRoom.id, latestToken);
            }

            return () => unsub();
        }

        // 모달이 열릴 때(또는 활성 룸이 변경될 때) 만료된 방 자동 삭제 체크
        if (isOpen && activeRooms.length > 0) {
            const now = new Date();
            activeRooms.forEach(async (room) => {
                if (room.matchDate && room.matchTime) {
                    const matchStart = new Date(`${room.matchDate}T${room.matchTime}`);
                    // 30분 여유 시간
                    const expireTime = new Date(matchStart.getTime() + 30 * 60000);

                    if (now > expireTime) {
                        console.log(`Auto deleting expired room: ${room.id} (${room.title})`);
                        try {
                            await updateDoc(doc(db, "rooms", room.id), { status: 'DELETED' });
                        } catch (e) {
                            console.error("Auto delete failed:", e);
                        }
                    }
                }
            });
        }
    }, [activeRoom?.id, isOpen]);

    const handleStartTimeChange = (newDate: string, newTime: string) => {
        setStartDate(newDate);
        setStartTime(newTime);

        // 종료 시간 자동 계산 (시작 시간 + 1시간)
        const start = new Date(`${newDate}T${newTime}`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        // 날짜 포맷팅
        const eYear = end.getFullYear();
        const eMonth = String(end.getMonth() + 1).padStart(2, '0');
        const eDay = String(end.getDate()).padStart(2, '0');
        const eHours = String(end.getHours()).padStart(2, '0');
        const eMinutes = String(end.getMinutes()).padStart(2, '0');

        setEndDate(`${eYear}-${eMonth}-${eDay}`);
        setEndTime(`${eHours}:${eMinutes}`);
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            const roomId = await createRecruitmentRoom({
                hostId: currentUserId,
                hostName: userNickname,
                title: title,
                sport: activeTab,
                matchDate: startDate,
                matchTime: startTime,
                matchEndDate: endDate,
                matchEndTime: endTime,
                maxApplicants: useLimit ? maxApplicants : 0, // 0이면 무제한
                tierMode: tierMode,
                fcmToken: localStorage.getItem('fcm_token') || undefined
            });

            // 링크생성 및 자동 복사
            const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
            const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${roomId}&lang=${lang}`;

            try {
                await Clipboard.write({ string: webUrl });
                showAlert(t('linkCopied' as any), t('shareRecruitLink'));
            } catch (err) {
                console.error('Clipboard copy failed', err);
            }

            const room = await getRoomInfo(roomId);
            if (room) onRoomCreated(room);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateLimit = async (newLimit: number) => {
        if (!activeRoom) return;
        try {
            await updateDoc(doc(db, "rooms", activeRoom.id), { maxApplicants: newLimit });
        } catch (e) { console.error(e); }
    };


    const handleShare = async () => {
        if (!activeRoom) return;

        // 실제 배포된 도메인 주소
        const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
        const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${activeRoom.id}&lang=${lang}`;

        try {
            if (Capacitor.isNativePlatform()) {
                try {
                    await Share.share({
                        title: t('shareRecruitLink'),
                        text: `[${activeRoom.title}] ${activeRoom.matchDate} ${activeRoom.matchTime} ${t(activeRoom.sport.toLowerCase() as any)} ${t('joiningRequest' as any)}!\n\n👇 ${t('join' as any)} 👇\n${webUrl}`,
                        dialogTitle: t('shareRecruitLink'),
                    });
                } catch (shareError) {
                    await Clipboard.write({ string: webUrl });
                }
            } else {
                await Clipboard.write({ string: webUrl });
            }
        } catch (e) {
            try {
                await Clipboard.write({ string: webUrl });
            } catch (err) {
                // Fail silently or log
            }
        }
    };

    if (!isOpen || activeRoom) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-4">
                    <div className="flex justify-end items-center">
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 transition-colors"><CloseIcon /></button>
                    </div>

                    {!activeRoom ? (
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('roomTitle')}</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('inputRoomTitle')} className="w-full bg-slate-50 dark:bg-slate-950 rounded-2xl px-3 py-2.5 focus:outline-none dark:text-white font-bold text-sm" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-2">
                                    <div
                                        onClick={() => setActivePicker('START')}
                                        className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-50'}`}
                                    >
                                        <span className="text-[9px] font-black uppercase text-blue-500 mb-0.5">{t('startTime')}</span>
                                        <span className={`text-sm font-bold ${activePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                            {startDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(startDate).getDay()]}) {startTime}
                                        </span>
                                    </div>
                                    <div className="text-slate-300 dark:text-slate-600 pb-3">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <div
                                        onClick={() => setActivePicker('END')}
                                        className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-50'}`}
                                    >
                                        <span className="text-[9px] font-black uppercase text-rose-500 mb-0.5">{t('endTime')}</span>
                                        <span className={`text-sm font-bold ${activePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                                            {endDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(endDate).getDay()]}) {endTime}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-center transition-all duration-300">
                                    {activePicker === 'START' ? (
                                        <DateTimePicker
                                            date={startDate}
                                            time={startTime}
                                            onChange={handleStartTimeChange}
                                            lang={lang}
                                            onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                                        />
                                    ) : (
                                        <DateTimePicker
                                            date={endDate}
                                            time={endTime}
                                            onChange={(d, t) => { setEndDate(d); setEndTime(t); }}
                                            lang={lang}
                                            onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('limitApplicants')}</label>
                                    <button
                                        onClick={() => setUseLimit(!useLimit)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                                    >
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>

                                {useLimit && (
                                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('maxApplicants')}</label>
                                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-2xl px-4 py-2">
                                            <button onClick={() => setMaxApplicants(Math.max(2, maxApplicants - 1))} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400"><MinusIcon /></button>
                                            <span className="flex-1 text-center font-black dark:text-white text-sm">{t('peopleCount', maxApplicants)}</span>
                                            <button onClick={() => setMaxApplicants(maxApplicants + 1)} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400"><PlusIcon /></button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 등급 체계 선택 섹션 */}
                            <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('tierMode')}</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                                        <button
                                            onClick={() => setTierMode('5TIER')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${tierMode === '5TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                                        >
                                            {t('tierMode5')}
                                        </button>
                                        <button
                                            onClick={() => setTierMode('3TIER')}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${tierMode === '3TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                                        >
                                            {t('tierMode3')}
                                        </button>
                                    </div>
                                </div>
                                {tierMode === '3TIER' && (
                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 px-1 italic">
                                        ※ {t('tierModeDesc')}
                                    </p>
                                )}
                            </div>

                            {!isPickerSelectionMode && (
                                <div className="flex justify-end mt-2">
                                    <button onClick={handleCreate} disabled={loading} className="w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95">{loading ? '...' : t('create')}</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        null
                    )}
                </div>
            </div>
        </div >
    );
};
