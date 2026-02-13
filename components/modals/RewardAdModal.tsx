
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { Z_INDEX } from '../../constants';

export const RewardAdModal: React.FC<{
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
}> = ({ isOpen, onComplete, onClose }) => {
  const { t } = useAppContext();
  const [timeLeft, setTimeLeft] = useState(15);
  const [canSkip, setCanSkip] = useState(false);

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
          if (prev <= 11) setCanSkip(true);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center animate-in fade-in duration-500" style={{ zIndex: Z_INDEX.REWARD_AD }}>
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          <span className="text-white text-[10px] font-black tracking-widest uppercase">
            {timeLeft > 0 ? t('rewardCountdown', timeLeft) : t('rewardReady')}
          </span>
        </div>

        {canSkip ? (
          <button
            onClick={onComplete}
            className="bg-white text-black px-6 py-2.5 rounded-full font-black text-[11px] tracking-widest uppercase shadow-2xl active:scale-95 transition-all animate-in zoom-in-50"
          >
            {t('skipAndGetReward')}
          </button>
        ) : (
          <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="text-white/70 text-[10px] font-black tracking-widest uppercase italic">{t('skipAvailableIn', timeLeft - 10)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center text-center px-10">
        <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] mb-8 flex items-center justify-center text-5xl shadow-2xl shadow-blue-500/30 animate-bounce">
          🏆
        </div>
        <h2 className="text-3xl font-black text-white mb-4 tracking-tighter leading-tight whitespace-pre-line">
          {t('watchAndUnlock')}
        </h2>
        <p className="text-white/70 text-sm font-medium leading-relaxed max-w-xs">
          {t('thankYouSupport')}
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
        <div
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(59,130,246,0.8)]"
          style={{ width: `${((15 - timeLeft) / 15) * 100}%` }}
        />
      </div>
    </div>
  );
};
