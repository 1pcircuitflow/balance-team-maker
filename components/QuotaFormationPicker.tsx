
import React from 'react';
import { SportType, Position } from '../types';
import { TRANSLATIONS, Language } from '../translations';
import { FORMATION_POSITIONS } from '../constants';
import * as Icons from '../Icons';

const { MinusIcon, PlusIcon } = Icons;

export const QuotaFormationPicker: React.FC<{
  sport: SportType;
  quotas: Partial<Record<Position, number | null>>;
  lang: Language;
  onUpdate: (pos: Position, delta: number) => void;
  onToggleMode: (pos: Position) => void;
  darkMode: boolean;
}> = ({ sport, quotas, lang, onUpdate, onToggleMode, darkMode }) => {
  if (sport === SportType.GENERAL) return null;

  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;

  const positions = FORMATION_POSITIONS[sport];

  const getPosLabelLocal = (pos: Position) => {
    const key = `pos_${pos.toLowerCase()}` as keyof typeof TRANSLATIONS['ko'];
    return (TRANSLATIONS[lang] as any)[key] || pos;
  };

  return (
    <div className="relative aspect-[3/4] w-full max-w-[340px] mx-auto mt-4 px-2">
      <div className="absolute inset-0 rounded-3xl overflow-hidden">
        {/* Stadium Backgrounds */}
        {sport === SportType.BASKETBALL ? (
          <div className="absolute inset-0 bg-[#E0BA87] dark:bg-[#5c3d2e]" />
        ) : (
          <div className="absolute inset-0 bg-[#064e3b]">
            <div className="absolute inset-0 opacity-20"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 40px, transparent 40px, transparent 80px)'
              }}
            />
          </div>
        )}

        {/* Inner Court Container */}
        <div className="absolute inset-4">
          {/* Court Lines */}
          <div className="absolute inset-0 pointer-events-none">
            {sport === SportType.BASKETBALL ? (
              <div className="w-full h-full border-2 border-white/60 rounded-lg overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160%] aspect-square border-2 border-white/40 rounded-full" style={{ top: '-40%' }} />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1/3 border-x-2 border-b-2 border-white/50" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-24 h-24 border-2 border-white/50 rounded-full" />
              </div>
            ) : (
              <div className="w-full h-full border-2 border-white/50 rounded-lg flex flex-col relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40 -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border-2 border-white/50 rounded-full" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-x-2 border-b-2 border-white/50 rounded-b-sm" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-x-2 border-t-2 border-white/50 rounded-t-sm" />
              </div>
            )}
          </div>
        </div>
      </div>

      {positions.map((pos) => {
        const val = quotas[pos.id];
        const isAuto = typeof val !== 'number';

        const handleMinus = () => {
          if (isAuto) return;
          if (val === 1) {
            onToggleMode(pos.id);
          } else {
            onUpdate(pos.id, -1);
          }
        };

        const handlePlus = () => {
          if (isAuto) {
            onToggleMode(pos.id);
          } else {
            onUpdate(pos.id, 1);
          }
        };

        return (
          <div
            key={pos.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.x, top: pos.y }}
          >
            <div
              className={`backdrop-blur-sm rounded-xl shadow-lg px-2 py-1.5 flex flex-col items-center gap-1 min-w-[65px] transition-all duration-300 border ${isAuto
                ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-400/60 dark:border-emerald-500/40'
                : 'bg-white/95 dark:bg-slate-900/95 border-slate-200/50 dark:border-slate-800/50'
                }`}
              style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
            >
              <span className="text-[12px] font-semibold uppercase tracking-tight leading-none mb-1 transition-colors text-black dark:text-white">
                {pos.id}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleMinus}
                  className={`w-[14px] h-[14px] flex items-center justify-center rounded transition-all active:scale-75 ${isAuto
                    ? 'opacity-20 cursor-not-allowed bg-white/50 dark:bg-slate-800/50 text-slate-400'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-500 hover:text-white active:bg-rose-600 active:text-white'
                    }`}
                >
                  <MinusIcon size={8} />
                </button>

                <span className={`text-[12px] font-medium min-w-[20px] text-center leading-none tracking-tight transition-colors ${isAuto ? 'text-emerald-600 dark:text-emerald-400' : 'text-black dark:text-white'
                  }`}>
                  {isAuto ? t('autoQuota') : val}
                </span>

                <button
                  type="button"
                  onClick={handlePlus}
                  className={`w-[14px] h-[14px] flex items-center justify-center rounded transition-all active:scale-75 ${isAuto
                    ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white active:bg-emerald-600 active:text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white active:bg-emerald-600 active:text-white'
                    }`}
                >
                  <PlusIcon size={8} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
