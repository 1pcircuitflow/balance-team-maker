import React, { useState, useEffect } from 'react';
import { Player, Tier, SportType, Position } from '../../types';
import { TRANSLATIONS, Language } from '../../translations';
import { CheckIcon, MinusIcon, PlusIcon, EditIcon, TrashIcon } from '../../Icons';
import { FormationPicker } from '../common/FormationPicker';
import { TIER_COLORS } from '../../constants';

interface PlayerItemProps {
    player: Player;
    isEditing: boolean;
    lang: Language;
    onToggle: (id: string) => void;
    onEditToggle: (id: string | null) => void;
    onUpdate: (id: string, updates: Partial<Player>) => void;
    onRemove: (e: React.MouseEvent, id: string) => void;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    isSelectionMode?: boolean;
    showTier?: boolean;
}

export const PlayerItem: React.FC<PlayerItemProps> = ({
    player, isEditing, lang, onToggle, onEditToggle, onUpdate, onRemove, isSelected, onSelect, isSelectionMode, showTier
}) => {
    const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
        const translation = (TRANSLATIONS[lang] as any)[key];
        if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
        return String(translation || key);
    };

    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    // 리셋 확인 상태
    useEffect(() => {
        if (isEditing) {
            setIsConfirmingDelete(false);
        }
    }, [isEditing]);

    return (
        <div
            onMouseLeave={() => {
                setIsConfirmingDelete(false);
            }}
            className={`flex flex-col p-3 rounded-2xl transition-all duration-200 bg-white dark:bg-slate-900 group hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/30 border border-slate-100 dark:border-slate-800 ${isSelectionMode && isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''} ${!isSelectionMode ? 'hover:-translate-y-0.5' : ''}`}
            onClick={() => isSelectionMode && onSelect && onSelect(player.id)}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
                {isSelectionMode && (
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-blue-500 border-blue-500 text-white scale-110' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                            {isSelected && <CheckIcon />}
                        </div>
                    )}
                    {!isEditing && !isSelectionMode && showTier && (
                        <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider ${TIER_COLORS[player.tier]} shrink-0`}>
                            {Tier[player.tier]}
                        </div>
                    )}
                    <span className={`font-semibold text-slate-900 dark:text-slate-100 text-sm truncate pt-0.5 ${player.isActive ? 'text-slate-900 dark:text-slate-100' : ''}`}>
                        {player.name}
                    </span>
                </div>
                {!isSelectionMode && (
                    <div className="flex items-center gap-0.5 shrink-0" data-capture-ignore="true">
                        <button
                            type="button"
                            title={player.isActive ? "제외" : "참가"}
                            className="p-2 rounded-xl transition-all duration-200 active:scale-90 text-slate-400 dark:text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white min-w-[32px] min-h-[32px] flex items-center justify-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggle(player.id);
                            }}
                        >
                            {player.isActive ? <MinusIcon /> : <PlusIcon />}
                        </button>
                        <button
                            type="button"
                            className={`p-2 rounded-xl transition-all duration-200 active:scale-90 min-w-[32px] min-h-[32px] flex items-center justify-center ${isEditing ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white'}`}
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEditToggle(isEditing ? null : player.id); }}
                        >
                            {isEditing ? <CheckIcon /> : <EditIcon />}
                        </button>
                        <button
                            type="button"
                            className={`p-2 rounded-xl transition-all duration-200 min-w-[32px] min-h-[32px] flex items-center justify-center ${isConfirmingDelete
                                ? 'text-white bg-rose-500 scale-110 shadow-lg shadow-rose-500/30'
                                : 'text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 active:scale-90'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isConfirmingDelete) {
                                    onRemove(e, player.id);
                                    setIsConfirmingDelete(false);
                                } else {
                                    setIsConfirmingDelete(true);
                                }
                            }}
                        >
                            {isConfirmingDelete ? <CheckIcon /> : <TrashIcon />}
                        </button>
                    </div>
                )}
            </div >

            {
                isEditing ? (
                    <div className="space-y-2.5 mt-1.5 pt-2" onClick={e => e.stopPropagation()} >
                        <div className="grid grid-cols-5 gap-1">
                            {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); onUpdate(player.id, { tier: val }); }}
                                    className={`py-2 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-200 active:scale-95 min-h-[36px] ${player.tier === val ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                        {player.sportType !== SportType.GENERAL && (
                            <FormationPicker
                                sport={player.sportType}
                                primaryP={player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : [])}
                                secondaryP={player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : [])}
                                tertiaryP={player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : [])}
                                forbiddenP={player.forbiddenPositions || []}
                                lang={lang}
                                onChange={(p, s, t, f) => onUpdate(player.id, { primaryPositions: p, secondaryPositions: s, tertiaryPositions: t, forbiddenPositions: f })}
                            />
                        )
                        }
                    </div >
                ) : (
                    player.sportType !== SportType.GENERAL && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 pt-1">
                            {(player.primaryPositions?.length || (player.primaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{(player.primaryPositions || [player.primaryPosition]).join(',')}</span>
                                </div>
                            )}
                            {(player.secondaryPositions?.length || (player.secondaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    <span>{(player.secondaryPositions || [player.secondaryPosition]).join(',')}</span>
                                </div>
                            )}
                            {(player.tertiaryPositions?.length || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                    <span>{(player.tertiaryPositions || [player.tertiaryPosition!]).join(',')}</span>
                                </div>
                            )}
                            {player.forbiddenPositions && player.forbiddenPositions.length > 0 && (
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>{player.forbiddenPositions.join(',')}</span>
                                </div>
                            )}
                        </div>
                    )
                )}
        </div >
    );
};
