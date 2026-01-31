import React, { useState, useEffect } from 'react';
import { Language, TRANSLATIONS } from '../../translations';

interface RewardAdModalProps {
    isOpen: boolean;
    onComplete: () => void;
    onClose: () => void;
    lang: Language;
    darkMode: boolean;
}

export const RewardAdModal: React.FC<RewardAdModalProps> = ({ isOpen, onComplete, onClose, lang, darkMode }) => {
    const [timeLeft, setTimeLeft] = useState(15);
    const [canSkip, setCanSkip] = useState(false);
    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;

    useEffect(() => {
        if (isOpen) {
            setTimeLeft(15);
            setCanSkip(false);
            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setCanSkip(true);
                        return 0;
                    }
                    if (prev <= 11) setCanSkip(true); // 15 - 10 = 5초 경과 시 스킵 활성화
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2500] bg-black flex flex-col items-center justify-center animate-in fade-in duration-500">
            {/* 상단 스킵/상태 바 */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-white text-[10px] font-black tracking-widest uppercase">
                        {timeLeft > 0 ? `Reward in ${timeLeft}s` : 'Reward Ready'}
                    </span>
                </div>

                {canSkip ? (
                    <button
                        onClick={onComplete}
                        className="bg-white text-black px-6 py-2.5 rounded-full font-black text-[11px] tracking-widest uppercase shadow-2xl active:scale-95 transition-all animate-in zoom-in-50"
                    >
                        Skip & Get Reward
                    </button>
                ) : (
                    <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                        <span className="text-white/40 text-[10px] font-black tracking-widest uppercase italic">Skip available in {timeLeft - 10}s</span>
                    </div>
                )}
            </div>

            {/* 광고 내용 시뮬레이션 */}
            <div className="flex flex-col items-center text-center px-10">
                <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] mb-8 flex items-center justify-center text-5xl shadow-2xl shadow-blue-500/30 animate-bounce">
                    🏆
                </div>
                <h2 className="text-3xl font-black text-white mb-4 tracking-tighter leading-tight">
                    Watch & Unlock<br />Premium Features
                </h2>
                <p className="text-white/50 text-sm font-medium leading-relaxed max-w-xs">
                    Thank you for supporting our free app. Your reward is being prepared!
                </p>
            </div>

            {/* 하단 진행 바 */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                <div
                    className="h-full bg-blue-500 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                    style={{ width: `${((15 - timeLeft) / 15) * 100}%` }}
                />
            </div>
        </div>
    );
};
