
import React, { useState, useEffect } from 'react';
import { Player, Tier, SportType, Position } from '../types';
import { TIER_BADGE_COLORS } from '../constants';
import { TRANSLATIONS, Language } from '../translations';
import * as Icons from '../Icons';
import { FormationPicker } from './FormationPicker';

const { PlusIcon, MinusIcon, CheckIcon, MoreIcon, CloseIcon } = Icons;

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
  readOnly?: boolean; // 참가 토글만 허용 (수정/삭제 숨김)
}


export const PlayerItem = React.memo<any>(({
  player, isEditing, lang, onToggle, onEditToggle, onUpdate, onRemove, isSelected, onSelect, isSelectionMode, showTier, readOnly
}: any) => {
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setIsConfirmingDelete(false);
    }
  }, [isEditing]);

  return (
    <div
      role={isSelectionMode ? 'button' : undefined}
      tabIndex={isSelectionMode ? 0 : undefined}
      aria-pressed={isSelectionMode ? isSelected : undefined}
      onMouseLeave={() => {
        setIsConfirmingDelete(false);
        setShowActionMenu(false);
      }}
      className={`flex ${isEditing ? 'flex-col' : 'items-center justify-between'} px-2 py-1 rounded-2xl transition-all duration-200 group ${player.isActive ? 'bg-slate-100/80 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950'} ${isSelectionMode && isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => isSelectionMode && onSelect && onSelect(player.id)}
      onKeyDown={(e) => {
        if (isSelectionMode && onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(player.id);
        }
      }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 flex-1 overflow-hidden">
          {isSelectionMode && (
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
              {isSelected && <CheckIcon />}
            </div>
          )}
          {/* Avatar circle */}
          <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] dark:bg-slate-800 flex items-center justify-center text-[12px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
            BELO
          </div>
          {/* Name + Position vertical stack */}
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              {!isEditing && !isSelectionMode && showTier && (
                <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium ${TIER_BADGE_COLORS[player.tier]}`}>
                  {Tier[player.tier]}
                </span>
              )}
              <span className={`text-[16px] font-medium text-slate-900 dark:text-white truncate`}>
                {player.name}
              </span>
            </div>
            {!isEditing && player.sportType !== SportType.GENERAL && (
              <div className="flex items-center gap-1.5">
                {(player.primaryPositions?.length || (player.primaryPosition !== 'NONE' ? 1 : 0)) > 0 &&
                  (player.primaryPositions || [player.primaryPosition]).map((pos: string, i: number) => (
                    <div key={`p-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-[#10B982] uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                      <span>{pos}</span>
                    </div>
                  ))
                }
                {(player.secondaryPositions?.length || (player.secondaryPosition !== 'NONE' ? 1 : 0)) > 0 &&
                  (player.secondaryPositions || [player.secondaryPosition]).map((pos: string, i: number) => (
                    <div key={`s-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-[#FACC16] uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                      <span>{pos}</span>
                    </div>
                  ))
                }
                {(player.tertiaryPositions?.length || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? 1 : 0)) > 0 &&
                  (player.tertiaryPositions || [player.tertiaryPosition!]).map((pos: string, i: number) => (
                    <div key={`t-${i}`} className="flex items-center gap-1 text-[12px] font-medium text-[#FB933C] uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                      <span>{pos}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
        {!isSelectionMode && (
          <div className="flex items-center gap-1.5 shrink-0 relative" data-capture-ignore="true">
            {readOnly ? (
              <button
                type="button"
                className={`text-[12px] font-medium px-2.5 py-1 rounded-md transition-all active:scale-95 ${player.isActive ? 'bg-[#53B175] text-white' : 'bg-[#4685EB] text-white'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggle(player.id);
                }}
              >
                {player.isActive ? t('exclude') : t('addShort')}
              </button>
            ) : showActionMenu ? (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const isCurrentlyEditing = isEditing;
                    onEditToggle(isCurrentlyEditing ? null : player.id);
                    if (isCurrentlyEditing) {
                      setShowActionMenu(false);
                    }
                  }}
                  className={`text-[14px] font-medium text-white px-2 py-0.5 rounded-md transition-all active:scale-95 ${isEditing ? 'bg-slate-900 dark:bg-white dark:text-slate-900' : 'bg-[#EDAE73]'}`}
                >
                  {isEditing ? t('confirm') : t('edit')}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (isConfirmingDelete) {
                      onRemove(e, player.id);
                      setIsConfirmingDelete(false);
                      setShowActionMenu(false);
                    } else {
                      setIsConfirmingDelete(true);
                    }
                  }}
                  className={`text-[14px] font-medium text-white px-2 py-0.5 rounded-md transition-all active:scale-95 ${isConfirmingDelete ? 'bg-rose-600 ring-2 ring-rose-400 ring-offset-1 dark:ring-offset-slate-950' : 'bg-rose-500'}`}
                >
                  {isConfirmingDelete ? t('confirm') : t('delete')}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowActionMenu(false);
                    setIsConfirmingDelete(false);
                    if (isEditing) onEditToggle(null);
                  }}
                  className="p-1 text-slate-300 dark:text-slate-600"
                >
                  <CloseIcon />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowActionMenu(true);
                }}
                className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
              >
                <MoreIcon />
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing && !readOnly && (
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
          )}
        </div>
      )}
    </div>
  );
});
