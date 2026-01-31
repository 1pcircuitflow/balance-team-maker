import React from 'react';
import { SportType, Position } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';
import { PlusIcon, MinusIcon } from '../../Icons';

interface QuotaFormationPickerProps {
    sport: SportType;
    quotas: Partial<Record<Position, number | null>>;
    lang: Language;
    onUpdate: (pos: Position, delta: number) => void;
    onToggleMode: (pos: Position) => void;
    darkMode: boolean;
}

export const QuotaFormationPicker: React.FC<QuotaFormationPickerProps> = ({ sport, quotas, lang, onUpdate, onToggleMode, darkMode }) => {
    if (sport === SportType.GENERAL) return null;

    const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;

    const positions: { id: Position; x: string; y: string }[] = sport === SportType.SOCCER
        ? [
            { id: 'GK', x: '50%', y: '85%' },
            { id: 'LB', x: '15%', y: '65%' },
            { id: 'DF', x: '50%', y: '65%' },
            { id: 'RB', x: '85%', y: '65%' },
            { id: 'MF', x: '50%', y: '42%' },
            { id: 'LW', x: '15%', y: '25%' },
            { id: 'FW', x: '50%', y: '18%' },
            { id: 'RW', x: '85%', y: '25%' },
        ]
        : sport === SportType.FUTSAL
            ? [
                { id: 'GK', x: '50%', y: '82%' },
                { id: 'FIX', x: '50%', y: '62%' },
                { id: 'ALA', x: '50%', y: '40%' },
                { id: 'PIV', x: '50%', y: '18%' },
            ]
            : [
                { id: 'PG', x: '35%', y: '72%' },
                { id: 'SG', x: '65%', y: '72%' },
                { id: 'SF', x: '25%', y: '45%' },
                { id: 'PF', x: '75%', y: '45%' },
                { id: 'C', x: '50%', y: '28%' },
            ];

    return (
        <div className="relative aspect-[3/4] w-full max-w-[340px] mx-auto mt-4 px-2">
            <div className="absolute inset-0 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-950/50">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    {sport === SportType.BASKETBALL ? (
                        <div className="w-full h-full border-2 border-slate-400 m-2 rounded-lg">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1/4 border-2 border-slate-400" />
                            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 border-2 border-slate-400 rounded-full" />
                        </div>
                    ) : (
                        <div className="w-full h-full border-2 border-slate-400 m-2 rounded-lg flex flex-col">
                            <div className="h-1/2 border-b-2 border-slate-400" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-slate-400 rounded-full" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-2 border-slate-400" />
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-2 border-slate-400" />
                        </div>
                    )}
                </div>
            </div>

            {positions.map((pos) => {
                const val = quotas[pos.id];
                const isAuto = typeof val !== 'number';

                return (
                    <div
                        key={pos.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: pos.x, top: pos.y }}
                    >
                        <div className="flex flex-col items-center gap-1.5">
                            <div className={`p-2 rounded-2xl shadow-xl border-2 transition-all flex flex-col items-center gap-1 min-w-[75px] ${isAuto
                                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                                }`}>
                                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none">{pos.id}</span>

                                <div className="flex items-center gap-1.5">
                                    {!isAuto ? (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onUpdate(pos.id, -1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-500 hover:text-white transition-colors active:scale-90"
                                            >
                                                <MinusIcon />
                                            </button>
                                            <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 min-w-[12px] text-center leading-none">{val}</span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdate(pos.id, 1)}
                                                className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-500 hover:text-white transition-colors active:scale-90"
                                            >
                                                <PlusIcon />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-[9px] font-black tracking-widest leading-none">AUTO</div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onToggleMode(pos.id)}
                                    className={`mt-0.5 px-2 py-0.5 rounded-md text-[7px] font-black tracking-tight uppercase transition-all active:scale-95 ${isAuto
                                        ? 'bg-white text-emerald-600 dark:bg-slate-900 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {isAuto ? t('fixQuota') : t('autoQuota')}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
