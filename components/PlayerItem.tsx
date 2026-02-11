
import React, { useState, useEffect } from 'react';
import { Player, Tier, SportType, Position } from '../types';
import { TIER_BADGE_COLORS } from '../constants';
import { TRANSLATIONS, Language } from '../translations';
import * as Icons from '../Icons';
import { FormationPicker } from './FormationPicker';

const { PlusIcon, MinusIcon, TrashIcon, EditIcon, CheckIcon } = Icons;

interface PlayerItemProps {
  player: Player;
  isEditing: boolean;
  lang: Language;
  onToggle: (id: string) => void;
  onEditToggle: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<Player>) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
  isSelectionMode?: boolean;
  showTier?: boolean; // 항목 2: 티어 숨기기
}


export const PlayerItem = React.memo<any>(({
  player, isEditing, lang, onToggle, onEditToggle, onUpdate, onRemove, isSelected, onSelect, isSelectionMode, showTier
}: any) => {
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
      className={`flex flex-col p-2.5 rounded-2xl transition-all duration-200 group ${player.isActive ? 'bg-slate-100/80 dark:bg-slate-900/40 opacity-80' : 'bg-white dark:bg-slate-950'} ${isSelectionMode && isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => isSelectionMode && onSelect && onSelect(player.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {isSelectionMode && (
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
              {isSelected && <CheckIcon />}
            </div>
          )}
          {!isEditing && !isSelectionMode && showTier && (
            <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TIER_BADGE_COLORS[player.tier]} pt-1 shrink-0`}>
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
              title={player.isActive ? t('exclude') : t('addToList')}
              className="p-1.5 rounded-lg transition-all active:scale-95 text-slate-400 dark:text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-950"
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
              className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'text-slate-900 bg-slate-100 dark:text-slate-100 dark:bg-slate-950' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-950'}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEditToggle(isEditing ? null : player.id); }}
            >
              {isEditing ? <CheckIcon /> : <EditIcon />}
            </button>
            <button
              type="button"
              className={`p-1.5 rounded-lg transition-all duration-200 ${isConfirmingDelete
                ? 'text-rose-600 bg-rose-100 dark:bg-rose-900/40 scale-110'
                : 'text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
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
                  className={`py-1.5 rounded-lg text-[9px] font-semibold transition-all ${player.tier === val ? 'bg-slate-900 text-slate-100 dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-400 dark:bg-slate-800 dark:text-slate-500'
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 pt-1">
              {(player.primaryPositions?.length || (player.primaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{(player.primaryPositions || [player.primaryPosition]).join(',')}</span>
                </div>
              )}
              {(player.secondaryPositions?.length || (player.secondaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-extrabold text-yellow-600 dark:text-yellow-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <span>{(player.secondaryPositions || [player.secondaryPosition]).join(',')}</span>
                </div>
              )}
              {(player.tertiaryPositions?.length || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-semibold text-orange-500 dark:text-orange-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  <span>{(player.tertiaryPositions || [player.tertiaryPosition!]).join(',')}</span>
                </div>
              )}
              {player.forbiddenPositions && player.forbiddenPositions.length > 0 && (
                <div className="flex items-center gap-1 text-[8px] font-semibold text-rose-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{player.forbiddenPositions.join(',')}</span>
                </div>
              )}
            </div>
          )
        )}
    </div >
  );
});
