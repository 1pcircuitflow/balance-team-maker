import React, { useState } from 'react';
import { SportType, Position } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';
import { EditIcon } from '../../Icons';

interface FormationPickerProps {
    sport: SportType;
    primaryP: Position[];
    secondaryP: Position[];
    tertiaryP: Position[];
    forbiddenP: Position[];
    lang: Language;
    onChange: (p: Position[], s: Position[], t: Position[], f: Position[]) => void;
}

export const FormationPicker: React.FC<FormationPickerProps> = ({ sport, primaryP, secondaryP, tertiaryP, forbiddenP, lang, onChange }) => {
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

    const [activeMenuPos, setActiveMenuPos] = useState<Position | null>(null);

    const handleSelectSuitability = (pos: Position, level: 1 | 2 | 3 | 'X' | 'NONE') => {
        let p = [...(primaryP || [])];
        let s = [...(secondaryP || [])];
        let t = [...(tertiaryP || [])];
        let f = [...(forbiddenP || [])];

        // 기존 할당 해제
        p = p.filter(x => x !== pos);
        s = s.filter(x => x !== pos);
        t = t.filter(x => x !== pos);
        f = f.filter(x => x !== pos);

        if (level === 1) p.push(pos);
        else if (level === 2) s.push(pos);
        else if (level === 3) t.push(pos);
        else if (level === 'X') f.push(pos);

        // 자동 불가능 처리: 1, 2, 3지망 중 하나라도 있으면 나머지를 불가능으로 자동 설정
        if (level === 1 || level === 2 || level === 3) {
            const allPosIds = positions.map(item => item.id);
            const assigned = [...p, ...s, ...t];
            f = allPosIds.filter(id => !assigned.includes(id));
        }

        onChange(p, s, t, f);
        setActiveMenuPos(null);
    };

    const getStatus = (pos: Position) => {
        if (primaryP?.includes(pos)) return { color: 'bg-emerald-500', label: '100' };
        if (secondaryP?.includes(pos)) return { color: 'bg-yellow-400', label: '75' };
        if (tertiaryP?.includes(pos)) return { color: 'bg-orange-400', label: '50' };
        if (forbiddenP?.includes(pos)) return { color: 'bg-rose-500', label: 'X' };
        return { color: 'bg-slate-300 dark:bg-slate-600', label: '' };
    };

    return (
        <div className="flex flex-col gap-2.5 mt-2">
            <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5 flex items-center gap-1">
                    <EditIcon />
                    {t('visualPositionEditor')}
                </label>
            </div>

            <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto">
                <div className="absolute inset-0 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
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

                {activeMenuPos && (
                    <div className="absolute inset-0 z-20" onClick={() => setActiveMenuPos(null)} />
                )}

                <div className="absolute inset-0 z-30">
                    {positions.map((pos) => {
                        const status = getStatus(pos.id);
                        const isMenuOpen = activeMenuPos === pos.id;

                        return (
                            <div
                                key={pos.id}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex flex-col items-center justify-center ${isMenuOpen ? 'z-[100]' : 'z-30'}`}
                                style={{ left: pos.x, top: pos.y }}
                            >
                                {isMenuOpen && (
                                    <div className="absolute bottom-full mb-3 p-1 bg-white dark:bg-slate-900 rounded-full animate-in zoom-in-50 fade-in duration-200 origin-bottom flex items-center gap-1.5 min-w-max pointer-events-auto shadow-xl border border-slate-100 dark:border-slate-800">
                                        {[
                                            { l: 1, v: '100' },
                                            { l: 2, v: '75' },
                                            { l: 3, v: '50' },
                                            { l: 'X', v: 'X' }
                                        ].map((item) => (
                                            <button
                                                key={item.v}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleSelectSuitability(pos.id, item.l as any);
                                                }}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white transition-all active:scale-90 select-none ${item.l === 1 ? 'bg-emerald-500' :
                                                    item.l === 2 ? 'bg-yellow-400' :
                                                        item.l === 3 ? 'bg-orange-400' :
                                                            'bg-rose-500'
                                                    }`}
                                            >
                                                {item.v}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setActiveMenuPos(isMenuOpen ? null : pos.id); }}
                                    className={`w-full h-full rounded-full transition-all duration-300 flex flex-col items-center justify-center gap-0.5 ${status.color} hover:scale-110 active:scale-95 shadow-md`}
                                >
                                    <span className="text-[9px] font-black text-white drop-shadow-sm">{pos.id}</span>
                                    {status.label && <span className="text-[8px] font-black text-white/90 leading-none">{status.label}</span>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 italic font-medium px-4 mt-2">
                {t('formationGuide')}
            </p>
        </div>
    );
};
