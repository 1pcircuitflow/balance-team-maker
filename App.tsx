import React, { useState, useEffect } from 'react';
import { Player, Tier, BalanceResult, SportType, Position, TeamConstraint } from './types';
import { STORAGE_KEY } from './constants';
import { generateBalancedTeams } from './services/balanceService';
import { TRANSLATIONS, Language } from './translations';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { SAMPLE_PLAYERS_BY_LANG } from './sampleData';
import { AnalyticsService } from './services/analyticsService';

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
const ShuffleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18L22 6" /><path d="M2 6l20 12" /><path d="M11 11l2 2" /></svg>;
const UserPlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></svg>;
const UserCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>;
const SunIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
const MoonIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
const SlidersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="2" y1="14" x2="6" y2="14" /><line x1="10" y1="8" x2="14" y2="8" /><line x1="18" y1="16" x2="22" y2="16" /></svg>;
const InfoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
const ExternalLinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
const HeartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;

const TIER_COLORS: Record<Tier, string> = {
  [Tier.S]: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  [Tier.A]: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  [Tier.B]: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [Tier.C]: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  [Tier.D]: 'bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500',
};

const TEAM_COLORS = [
  { name: 'color_red', value: '#ef4444' },
  { name: 'color_orange', value: '#f97316' },
  { name: 'color_yellow', value: '#eab308' },
  { name: 'color_green', value: '#22c55e' },
  { name: 'color_blue', value: '#3b82f6' },
  { name: 'color_pink', value: '#ec4899' },
  { name: 'color_purple', value: '#a855f7' },
  { name: 'color_white', value: '#ffffff' },
  { name: 'color_black', value: '#000000' },
  { name: 'color_gray', value: '#64748b' },
];

const QuotaFormationPicker: React.FC<{
  sport: SportType;
  quotas: Partial<Record<Position, number | null>>;
  lang: Language;
  onUpdate: (pos: Position, delta: number) => void;
  onToggleMode: (pos: Position) => void;
  darkMode: boolean;
}> = ({ sport, quotas, lang, onUpdate, onToggleMode, darkMode }) => {
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

  const getPosLabelLocal = (pos: Position) => {
    const key = `pos_${pos.toLowerCase()}` as keyof typeof TRANSLATIONS['ko'];
    return (TRANSLATIONS[lang] as any)[key] || pos;
  };

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

const FormationPicker: React.FC<{
  sport: SportType;
  primaryP: Position[];
  secondaryP: Position[];
  tertiaryP: Position[];
  forbiddenP: Position[];
  lang: Language;
  onChange: (p: Position[], s: Position[], t: Position[], f: Position[]) => void;
}> = ({ sport, primaryP, secondaryP, tertiaryP, forbiddenP, lang, onChange }) => {
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
    // 단, NONE이나 X를 고른 상황이 아닌 '지망'을 확정한 경우에만 트리거
    if (level === 1 || level === 2 || level === 3) {
      const allPosIds = positions.map(item => item.id);
      const assigned = [...p, ...s, ...t];
      f = allPosIds.filter(id => !assigned.includes(id));
    }

    onChange(p, s, t, f);
    setActiveMenuPos(null);
  };

  const handleAllOthersForbidden = () => {
    const allPos = positions.map(pos => pos.id);
    const assigned = [...primaryP, ...secondaryP, ...tertiaryP];
    const newForbidden = allPos.filter(pos => !assigned.includes(pos));
    onChange(primaryP, secondaryP, tertiaryP, newForbidden);
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

const getInitialLang = (): Language => {
  // 사용자가 명시적으로 선택한 언어가 있는지 확인 (자동 감지된 것은 저장 안 함)
  const manual = localStorage.getItem('app_lang_manual');
  if (manual) return manual as Language;

  // 없는 경우 브라우저/시스템 기본값 (나중에 useEffect에서 Device 플러그인으로 보완)
  const systemLang = navigator.language.split('-')[0];
  const supported: Language[] = ['ko', 'en', 'pt', 'es', 'ja'];
  return supported.includes(systemLang as any) ? systemLang as Language : 'en';
};

const getPosLabel = (pos: Position, lang: Language): string => {
  const key = `pos_${pos.toLowerCase()}` as keyof typeof TRANSLATIONS['ko'];
  const translation = (TRANSLATIONS[lang] as any)[key];
  return typeof translation === 'string' ? translation : String(pos);
};

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
}

const PlayerItem: React.FC<PlayerItemProps> = ({
  player, isEditing, lang, onToggle, onEditToggle, onUpdate, onRemove, isSelected, onSelect, isSelectionMode
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
      className={`flex flex-col p-2.5 rounded-2xl transition-all duration-200 bg-white dark:bg-slate-950 group ${isSelectionMode && isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => isSelectionMode && onSelect && onSelect(player.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-1 overflow-hidden">
          {isSelectionMode && (
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
              {isSelected && <CheckIcon />}
            </div>
          )}
          {!isEditing && !player.isActive && !isSelectionMode && (
            <div className={`w-5 h-5 rounded-lg ${TIER_COLORS[player.tier]} flex items-center justify-center text-[10px] font-semibold shrink-0 pt-0.5`}>
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
};

const PromotionFooter: React.FC<{ lang: Language; darkMode: boolean }> = ({ lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  return (
    <div className={`mt-6 py-3 px-4 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900/40' : 'bg-slate-100/50'}`}>
      <h4 className={`text-sm font-semibold tracking-tight pt-0.5 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('promoAppTitle')}</h4>
    </div>
  );
};

const LoadingOverlay: React.FC<{ lang: Language; activeTab: SportType; darkMode: boolean; countdown: number }> = ({ lang, activeTab, darkMode, countdown }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  const icon = activeTab === SportType.BASKETBALL ? '🏀' : activeTab === SportType.SOCCER ? '⚽' : activeTab === SportType.FUTSAL ? '🥅' : '🏆';
  const isGeneratingAdVisible = false; // 출시 버전에서는 광고 영역을 숨깁니다.

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center ${darkMode ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-xl animate-in duration-300`}>
      <div className="relative flex flex-col items-center max-w-sm w-full px-6">
        <div className="text-5xl mb-6 animate-bounce">
          {icon}
        </div>

        <div className="text-center mb-8">
          <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-2`}>
            {countdown > 2 ? t('loadingAnalysing') : t('loadingOptimizing')}
          </h3>
          <p className={`text-xs font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('generatingTeamsLoading')}
          </p>
        </div>

        {/* 광고 영역 Placeholder */}
        {isGeneratingAdVisible && (
          <div className={`w-full aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center mb-8 transition-all ${darkMode ? 'bg-slate-900/50 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-300'
            }`}>
            <div className="w-12 h-12 rounded-2xl bg-current opacity-10 mb-3" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{t('adPlacementSlot')}</span>
            <p className="text-[11px] font-bold mt-1 opacity-60 px-6 text-center">{t('loadingAdMessage')}</p>
          </div>
        )}

        <div className="w-full space-y-4">
          <div className={`w-full h-1.5 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${darkMode ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-blue-600'} transition-all duration-1000 ease-linear`}
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Team Balance Engine</span>
            <span className={`text-xs font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-600'} font-mono`}>
              {t('loadingSecondsLeft', countdown)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoModal: React.FC<{
  isOpen: boolean; onClose: () => void; lang: Language; darkMode: boolean; showAlert: (message: string, title?: string) => void;
}> = ({ isOpen, onClose, lang, darkMode, showAlert }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm animate-in duration-200" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-[2rem] p-6 ${darkMode ? 'bg-slate-900' : 'bg-white'} space-y-6`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className={`text-xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('infoTitle')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 text-2xl leading-none">&times;</button>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:1p.circuitflow@gmail.com?subject=Team Balance Pro Feedback"
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${darkMode ? 'bg-slate-950 hover:bg-black' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('contactUs')}</span>
            <ExternalLinkIcon />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.balanceteammaker"
            target="_blank"
            rel="noreferrer"
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${darkMode ? 'bg-slate-950 hover:bg-black' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-blue-600'}`}>{t('rateApp')}</span>
            <ExternalLinkIcon />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText('1p.circuitflow@gmail.com');
              showAlert(lang === 'ko' ? '이메일 주소가 복사되었습니다.' : 'Email address copied to clipboard.', lang === 'ko' ? '알림' : 'Notice');
            }}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${darkMode ? 'bg-slate-950 hover:bg-black' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            <span className={`text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-400'}`}>1p.circuitflow@gmail.com</span>
            <span className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500">Copy</span>
          </button>
        </div>

        <div className="pt-2 flex justify-center text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          {t('version')} 2.0.0
        </div>
      </div>
    </div>
  );
};

const ReviewPrompt: React.FC<{
  isOpen: boolean; onLater: () => void; onRate: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, onLater, onRate, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>{t('reviewTitle')}</h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-8 px-2 leading-relaxed opacity-90`}>
          {t('reviewMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onRate}
            className="w-full py-4 bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-semibold rounded-2xl transition-all active:scale-95"
          >
            {t('now')}
          </button>
          <button
            onClick={onLater}
            className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 hover:text-slate-100' : 'text-slate-400 hover:text-slate-900'}`}
          >
            {t('later')}
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertModal: React.FC<{
  isOpen: boolean; title?: string; message: string; onConfirm: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, title, message, onConfirm, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {title || t('validationErrorTitle' as any)}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {message}
        </p>
        <button
          onClick={onConfirm}
          className="w-full py-4 bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
        >
          OK
        </button>
      </div>
    </div>
  );
};

const AdBanner: React.FC<{ lang: Language; darkMode: boolean }> = ({ lang, darkMode }) => {
  const isAdVisible = false; // 출시 버전에서는 광고 배너를 숨깁니다.

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[900] transition-colors duration-300 flex flex-col ${darkMode ? 'bg-slate-950' : 'bg-white'}`}
      style={{
        height: `calc(${isAdVisible ? '60px' : '0px'} + env(safe-area-inset-bottom, 0px))`
      }}
    >
      {isAdVisible && (
        <div className="h-[60px] flex items-center justify-center">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] animate-pulse">
            Ad Space (Testing)
          </span>
        </div>
      )}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
};


const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(getInitialLang());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [activeTab, setActiveTab] = useState<SportType>(SportType.GENERAL);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<Tier>(Tier.B);
  const [newP1s, setNewP1s] = useState<Position[]>([]);
  const [newP2s, setNewP2s] = useState<Position[]>([]);
  const [newP3s, setNewP3s] = useState<Position[]>([]);
  const [newForbidden, setNewForbidden] = useState<Position[]>([]);
  const [teamCount, setTeamCount] = useState(2);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'name' | 'tier'>('name');

  const [quotas, setQuotas] = useState<Partial<Record<Position, number | null>>>({});
  const [showQuotaSettings, setShowQuotaSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showNewPlayerFormation, setShowNewPlayerFormation] = useState(false);
  const [selectAllConfirm, setSelectAllConfirm] = useState(false);
  const [unselectAllConfirm, setUnselectAllConfirm] = useState(false);

  const [selectionMode, setSelectionMode] = useState<'MATCH' | 'SPLIT' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teamConstraints, setTeamConstraints] = useState<TeamConstraint[]>(() => {
    const saved = localStorage.getItem(`app_constraints`);
    return saved ? JSON.parse(saved) : [];
  });

  const [useTeamColors, setUseTeamColors] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTeamColors, setSelectedTeamColors] = useState<string[]>(['#ef4444', '#3b82f6']);

  const [alertState, setAlertState] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    message: '',
  });

  const showAlert = (message: string, title?: string) => {
    setAlertState({ isOpen: true, message, title });
  };

  useEffect(() => {
    const initSystemLang = async () => {
      // 레거시 키 제거 (새 로직 적용을 위해)
      const oldLang = localStorage.getItem('app_lang');
      if (oldLang) localStorage.removeItem('app_lang');

      const manual = localStorage.getItem('app_lang_manual');
      // 사용자가 직접 언어를 선택한 적이 없을 때만 시스템 언어 실시간 확인
      if (!manual && Capacitor.isNativePlatform()) {
        try {
          const info = await Device.getLanguageCode();
          const systemLang = info.value.split('-')[0] as Language;
          const supported: Language[] = ['ko', 'en', 'pt', 'es', 'ja'];
          if (supported.includes(systemLang) && systemLang !== lang) {
            setLang(systemLang);
          }
        } catch (e) {
          console.error('Failed to get device language', e);
        }
      }
    };
    initSystemLang();
    AnalyticsService.logAppOpen(); // 앱 실행 기록
  }, []);

  const handleManualLangChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app_lang_manual', newLang);
    AnalyticsService.logEvent('change_language', { language: newLang });
  };

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };

  useEffect(() => {
    const SAMPLE_DATA_VERSION = 'v2'; // 포지션 다양화 반영 버전
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem('app_sample_version');

    const isSampleData = (playerList: Player[]) => {
      if (!playerList || playerList.length === 0) return true;
      const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
      return playerList.every(p => sampleIdPattern.test(p.id));
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.length > 0) {
          // 샘플 데이터 형식이면서 버전이 낮거나 없다면 강제 업데이트
          if (isSampleData(parsed) && storedVersion !== SAMPLE_DATA_VERSION) {
            setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
            localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
          } else if (isSampleData(parsed)) {
            // 버전은 맞지만 언어가 바뀌었을 때를 위한 처리
            setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
          } else {
            // 사용자 데이터인 경우 그대로 유지
            setPlayers(parsed);
          }
        } else {
          setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
          localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
        }
      } catch (e) {
        setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      }
    } else {
      setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
      localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
    }
  }, [lang]);

  // useEffect(() => { localStorage.setItem('app_lang', lang); }, [lang]); // 더 이상 매번 저장하지 않음
  useEffect(() => { localStorage.setItem('app_dark_mode', darkMode.toString()); if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem(`app_constraints`, JSON.stringify(teamConstraints)); }, [teamConstraints]);

  useEffect(() => {
    // 수동으로 저장된 쿼터가 있는지 먼저 확인
    const savedQuotasString = localStorage.getItem(`app_quotas_${activeTab}`);
    if (savedQuotasString) {
      try {
        const savedQuotas = JSON.parse(savedQuotasString);
        setQuotas(savedQuotas);
        return; // 저장된 게 있으면 자동 계산 로직 건너뜀
      } catch (e) {
        console.error('Failed to parse saved quotas', e);
      }
    }

    const activeCount = players.filter(p => p.isActive && p.sportType === activeTab).length;
    const perTeam = teamCount > 0 ? Math.floor(activeCount / teamCount) : 0;

    if (activeTab === SportType.SOCCER) {
      setQuotas({
        GK: 1,
        LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null,
        MF: null,
        LW: null, FW: null, RW: null
      });
    } else if (activeTab === SportType.FUTSAL) {
      setQuotas({
        GK: 1,
        FIX: 1,
        ALA: null,
        PIV: null
      });
    } else if (activeTab === SportType.BASKETBALL) {
      setQuotas({
        C: 1, PG: 1,
        SG: null, SF: null, PF: null
      });
    } else setQuotas({});
  }, [teamCount, activeTab]); // 인원 변동 시 자동 초기화 방지 위해 players 제거

  useEffect(() => {
    // 팀 수가 바뀌면 선택된 색상 배열 크기를 맞춤
    setSelectedTeamColors(prev => {
      const next = [...prev];
      if (next.length < teamCount) {
        // 모자라면 남은 색상 중 안 쓴 것을 채움
        const available = TEAM_COLORS.map(c => c.value).filter(v => !next.includes(v));
        while (next.length < teamCount && available.length > 0) {
          next.push(available.shift()!);
        }
        // 그래도 모자라면 그냥 기본 색상 추가
        while (next.length < teamCount) {
          next.push(TEAM_COLORS[next.length % TEAM_COLORS.length].value);
        }
      } else if (next.length > teamCount) {
        return next.slice(0, teamCount);
      }
      return next;
    });
  }, [teamCount]);

  const handleReviewLater = () => {
    const nextPromptDate = new Date();
    nextPromptDate.setDate(nextPromptDate.getDate() + 7);
    localStorage.setItem('app_review_cooldown', nextPromptDate.toISOString());
    setShowReviewPrompt(false);
  };

  const handleRateApp = () => {
    localStorage.setItem('app_review_cooldown', 'DONE');
    setShowReviewPrompt(false);
    window.open('https://play.google.com/store/apps/details?id=com.balanceteammaker', '_blank');
  };

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const player: Player = {
      id: crypto.randomUUID(), name: newName.trim(), tier: newTier, isActive: false,
      sportType: activeTab,
      primaryPosition: newP1s[0] || 'NONE',
      secondaryPosition: newP2s[0] || 'NONE',
      tertiaryPosition: newP3s[0] || 'NONE',
      primaryPositions: newP1s,
      secondaryPositions: newP2s,
      tertiaryPositions: newP3s,
      forbiddenPositions: newForbidden,
    };
    setPlayers(prev => [player, ...prev]);
    setNewName(''); setNewP1s([]); setNewP2s([]); setNewP3s([]); setNewForbidden([]);
    setShowNewPlayerFormation(false);
    AnalyticsService.logEvent('add_player', { sport: activeTab, tier: newTier });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePlayerFromSystem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const toggleParticipation = (id: string) => {
    if (editingPlayerId) return;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleGenerate = () => {
    const participating = players.filter(p => p.isActive && p.sportType === activeTab);
    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    setIsGenerating(true);
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 밸런스 생성 시 제약 조건 포함 (activeTab에 해당하는 제약만 필터링)
    const activeConstraints = teamConstraints.filter(c => {
      const p = players.find(p => c.playerIds.includes(p.id)); // Check if any player in constraint belongs to activeTab
      return p && p.sportType === activeTab;
    });

    setTimeout(() => {
      const res = generateBalancedTeams(participating, teamCount, quotas, activeConstraints);

      // 팀 색상 할당
      if (useTeamColors) {
        res.teams.forEach((team, idx) => {
          const colorValue = selectedTeamColors[idx] || TEAM_COLORS[idx % TEAM_COLORS.length].value;
          const colorObj = TEAM_COLORS.find(c => c.value === colorValue);
          team.color = colorValue;
          team.colorName = colorObj?.name || 'color_gray';
        });
      }

      setResult(res);
      setIsGenerating(false);
      setShowQuotaSettings(false);

      // 제약 조건 준수 여부 및 실력 차이 알림
      if (!res.isValid) {
        if (res.isConstraintViolated) {
          showAlert(t('validationErrorConstraint'));
        } else if (res.isQuotaViolated) {
          showAlert(t('validationErrorQuota'));
        }
      } else if (res.maxDiff && res.maxDiff > 10) {
        // 실력 격차가 10점(필터링 기준) 이상인 경우 하드 제약 준수로 인한 밸런스 붕괴 경고
        showAlert(t('balanceWarning', res.maxDiff));
      }

      // 팀 생성 횟수 기반 리뷰 유도 (3회 이상)
      const genCount = parseInt(localStorage.getItem('app_gen_count') || '0', 10) + 1;
      localStorage.setItem('app_gen_count', genCount.toString());

      if (genCount >= 3) {
        const cooldown = localStorage.getItem('app_review_cooldown');
        if (cooldown !== 'DONE') {
          const now = new Date();
          if (!cooldown || now > new Date(cooldown)) {
            setTimeout(() => setShowReviewPrompt(true), 2000);
          }
        }
      }

      setTimeout(() => {
        document.getElementById('results-capture-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      AnalyticsService.logEvent('generate_teams', {
        sport: activeTab,
        player_count: participating.length,
        team_count: teamCount
      });
    }, 5000);
  };

  const handleShare = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsSharing(elementId);

    const rect = element.getBoundingClientRect();

    try {
      const bgColor = darkMode ? '#020617' : '#fdfcf9';

      const canvas = await html2canvas(element, {
        scale: 3,
        backgroundColor: bgColor,
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        ignoreElements: (el) => el.hasAttribute('data-capture-ignore'),
        onclone: (clonedDoc, clonedElement) => {
          const html = clonedDoc.documentElement;
          if (darkMode) {
            html.classList.add('dark');
            clonedDoc.body.style.backgroundColor = '#020617';
            clonedElement.style.backgroundColor = '#020617';
            clonedElement.style.color = '#f1f5f9';
          } else {
            html.classList.remove('dark');
            clonedDoc.body.style.backgroundColor = '#FFFFFF';
            clonedElement.style.backgroundColor = '#FFFFFF';
            clonedElement.style.color = '#202124';
          }

          clonedElement.style.width = `${rect.width}px`;
          clonedElement.style.display = 'block';
          clonedElement.style.position = 'relative';

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { 
              transition: none !important; 
              animation: none !important; 
              -webkit-print-color-adjust: exact; 
              font-family: "Pretendard Variable", Pretendard, sans-serif !important;
            }
            .truncate { 
              overflow: visible !important; 
              white-space: normal !important; 
              text-overflow: clip !important; 
            }
            .overflow-hidden { 
              overflow: visible !important; 
            }
            span, p, h1, h2, h3, h4 { 
              -webkit-print-color-adjust: exact; 
              font-family: inherit !important;
            }
            .animate-in { opacity: 1 !important; transform: none !important; animation: none !important; visibility: visible !important; }
            [data-capture-ignore] { display: none !important; visibility: hidden !important; }
            .bg-slate-950 { background-color: #020617 !important; }
            .bg-\\[\\#fdfcf9\\] { background-color: #fdfcf9 !important; }
            .flex { display: flex !important; }
            .items-center { align-items: center !important; }
            .justify-between { justify-content: space-between !important; }
            .flex-col { flex-direction: column !important; }
            .text-sm { font-size: 14px !important; }
            .font-semibold { font-weight: 600 !important; }
          `;
          clonedDoc.head.appendChild(style);

          clonedElement.style.opacity = '1';
          clonedElement.style.transform = 'none';

          // 홍보 푸터 강제 노출
          const promoFooter = clonedElement.querySelector('[data-promo-footer]');
          if (promoFooter) {
            (promoFooter as HTMLElement).style.display = 'flex';
          }
        }
      });

      // Capacitor 플랫폼에서 네이티브 공유 사용
      if (Capacitor.isNativePlatform()) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          try {
            // Blob을 Base64로 변환
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1]; // data:image/png;base64, 부분 제거

              try {
                // 파일 시스템에 임시 저장
                const savedFile = await Filesystem.writeFile({
                  path: `${fileName}_${Date.now()}.png`,
                  data: base64data,
                  directory: Directory.Cache
                });

                // 저장된 파일의 URI를 사용하여 공유 (이미지만 전송하여 호환성 확보)
                await Share.share({
                  files: [savedFile.uri],
                  dialogTitle: t('shareDialogTitle')
                });

                // 공유 성공 후 리뷰 유도 로직 (쿨다운 확인)
                const cooldown = localStorage.getItem('app_review_cooldown');
                if (cooldown !== 'DONE') {
                  const now = new Date();
                  if (!cooldown || now > new Date(cooldown)) {
                    setTimeout(() => setShowReviewPrompt(true), 1500);
                  }
                }
              } catch (err) {
                console.error('Share failed:', err);
                // 실패 시 다운로드로 fallback
                downloadImage(blob, fileName);
              }
              logShareEvent('native_share');
            };
            reader.readAsDataURL(blob);
          } catch (err) {
            console.error('File system error:', err);
            downloadImage(blob, fileName);
          }
        }, 'image/png');
      } else {
        // 웹 브라우저에서는 기존 Web Share API 또는 다운로드 사용
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: t('shareTitle')
            }).then(() => {
              // 웹에서도 공유 성공 시 리뷰 유도 시도
              const cooldown = localStorage.getItem('app_review_cooldown');
              if (cooldown !== 'DONE') {
                const now = new Date();
                if (!cooldown || now > new Date(cooldown)) {
                  setTimeout(() => setShowReviewPrompt(true), 1500);
                }
              }
            });
          } else {
            downloadImage(blob, fileName);
          }
          logShareEvent('web_share');
        }, 'image/png');
      }
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsSharing(null);
    }
  };

  // 다운로드 헬퍼 함수
  const downloadImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const logShareEvent = (type: string) => {
    AnalyticsService.logEvent('share_result', { type });
  };


  const currentPlayers = players.filter(p => p.sportType === activeTab);

  const getInactiveSortedPlayers = () => {
    const inactive = currentPlayers.filter(p => !p.isActive);
    if (sortMode === 'name') {
      return inactive.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return inactive.sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  };

  const activePlayers = currentPlayers.filter(p => p.isActive).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const inactivePlayers = getInactiveSortedPlayers();

  const getSortedTeamPlayers = (teamPlayers: Player[]) => {
    if (activeTab === SportType.GENERAL) return teamPlayers;
    const priority: any = activeTab === SportType.SOCCER
      ? { GK: 1, DF: 2, MF: 3, FW: 4, NONE: 5 }
      : activeTab === SportType.FUTSAL
        ? { GK: 1, FIX: 2, ALA: 3, PIV: 4, NONE: 5 }
        : { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, NONE: 6 };
    return [...teamPlayers].sort((a, b) => (priority[a.assignedPosition || 'NONE'] || 99) - (priority[b.assignedPosition || 'NONE'] || 99));
  };

  const updateQuota = (pos: Position, delta: number) => {
    setQuotas(prev => {
      const current = typeof prev[pos] === 'number' ? (prev[pos] as number) : 0;
      const next = { ...prev, [pos]: Math.max(0, current + delta) };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleQuotaMode = (pos: Position) => {
    setQuotas(prev => {
      const next = {
        ...prev,
        [pos]: typeof prev[pos] === 'number' ? null : 1
      };
      localStorage.setItem(`app_quotas_${activeTab}`, JSON.stringify(next));
      return next;
    });
  };

  const currentQuotaTotal = Object.values(quotas).reduce<number>((acc, val) => acc + (typeof val === 'number' ? val : 0), 0);
  const expectedPerTeam = activePlayers.length > 0 ? Math.floor(activePlayers.length / teamCount) : 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))'
      }}>
      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} />}

      <header className="w-full flex flex-col items-center mb-0">
        <div className="w-full flex justify-between items-center mb-4 bg-white dark:bg-slate-950 p-1.5">
          <div className="flex gap-2">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 transition-all hover:border-transparent" aria-label="Toggle dark mode">
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setShowInfoModal(true)} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 transition-all hover:border-transparent" aria-label="Show app Info">
              <InfoIcon />
            </button>
          </div>
          <div className="flex gap-1.5">
            {(['ko', 'en', 'pt', 'es', 'ja'] as Language[]).map(l => {
              const flags = { ko: '🇰🇷', en: '🇺🇸', pt: '🇧🇷', es: '🇪🇸', ja: '🇯🇵' };
              return (
                <button
                  key={l}
                  onClick={() => handleManualLangChange(l)}
                  className={`p-2 rounded-lg transition-all flex items-center justify-center ${lang === l
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-white text-slate-400 dark:bg-slate-900 hover:border-transparent'
                    }`}
                  title={l}
                >
                  <span className="text-xs leading-none">{flags[l]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 w-9 h-9 rounded-xl flex items-center justify-center text-xl">⚽</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{t('appTitle')}</h1>
        </div>
        <p className="text-slate-400 dark:text-slate-500 font-medium text-xs mt-2 tracking-[0.2em]">{t('appTagline')}</p>
      </header>

      <nav className="flex gap-1.5 bg-white dark:bg-slate-950 p-1.5 mb-3 w-full">
        {(Object.entries(SportType) as [string, SportType][]).map(([key, value]) => (
          <button key={value} onClick={() => {
            setActiveTab(value);
            setResult(null);
            setEditingPlayerId(null);
            AnalyticsService.logEvent('tab_change', { sport: value });
          }} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === value ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
            {t(value.toLowerCase() as any)}
          </button>
        ))}
      </nav>

      <main className="w-full space-y-3">
        <section className="bg-slate-50 dark:bg-slate-900 p-6 w-full relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center"><PlusIcon /></div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
          </div>
          <form onSubmit={addPlayer} className="space-y-3">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('playerName')}</label>
              <input type="text" placeholder={t('playerNamePlaceholder')} value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-white dark:bg-slate-950 rounded-xl px-4 py-3 focus:outline-none transition-all text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-0.5">{t('skillTier')}</label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.entries(Tier).filter(([k]) => isNaN(Number(k))) as [string, Tier][]).map(([key, val]) => (
                  <button key={key} type="button" onClick={e => { e.preventDefault(); setNewTier(val); }} className={`py-2 rounded-xl text-[11px] font-semibold transition-all ${newTier === val ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500'}`}>
                    {key}
                  </button>
                ))}
              </div>
            </div>
            {activeTab !== SportType.GENERAL && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowNewPlayerFormation(!showNewPlayerFormation)}
                  className={`w-full h-12 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${showNewPlayerFormation
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 active:scale-95'
                    : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-500 dark:hover:bg-slate-900'
                    }`}
                >
                  <EditIcon /> {t('visualPositionEditor')}
                </button>
                {showNewPlayerFormation && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <FormationPicker
                      sport={activeTab}
                      primaryP={newP1s}
                      secondaryP={newP2s}
                      tertiaryP={newP3s}
                      forbiddenP={newForbidden}
                      lang={lang}
                      onChange={(p, s, t, f) => { setNewP1s(p); setNewP2s(s); setNewP3s(t); setNewForbidden(f); }}
                    />
                  </div>
                )}
              </div>
            )}
            <button type="submit" className="w-full bg-slate-900 dark:bg-slate-200 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 font-semibold h-12 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs mt-2">
              <PlusIcon /> {t('addToList')}
            </button>
          </form>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
          <section className="bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-transparent flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('waitingList')} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({inactivePlayers.length})</span></h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-50 dark:bg-slate-950 p-0.5 rounded-lg border border-transparent">
                  <button onClick={() => setSortMode('name')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${sortMode === 'name' ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-400 hover:text-slate-900 dark:bg-transparent dark:hover:text-slate-300'}`}>
                    {t('sortByName')}
                  </button>
                  <button onClick={() => setSortMode('tier')} className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${sortMode === 'tier' ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-400 hover:text-slate-900 dark:bg-transparent dark:hover:text-slate-300'}`}>
                    {t('sortByTier')}
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (selectAllConfirm) {
                      setPlayers(prev => prev.map(p => p.sportType === activeTab ? { ...p, isActive: true } : p));
                      setSelectAllConfirm(false);
                    } else {
                      setSelectAllConfirm(true);
                      setTimeout(() => setSelectAllConfirm(false), 3000);
                    }
                  }}
                  className={`bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white px-2 py-1 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1 ${selectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                >
                  {selectAllConfirm ? <><CheckIcon /> {t('confirmRetry' as any)}</> : t('selectAll')}
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[120px]">
              {inactivePlayers.length === 0 ? (<div className="col-span-full py-10 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>) :
                inactivePlayers.map(p => (
                  <PlayerItem
                    key={p.id}
                    player={p}
                    isEditing={editingPlayerId === p.id}
                    lang={lang}
                    onToggle={toggleParticipation}
                    onEditToggle={setEditingPlayerId}
                    onUpdate={updatePlayer}
                    onRemove={removePlayerFromSystem}
                    isSelectionMode={!!selectionMode}
                    isSelected={selectedPlayerIds.includes(p.id)}
                    onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  />
                ))
              }
            </div>
          </section>
          <section id="participation-capture-section" className="bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-transparent flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserCheckIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('participatingList')} <span className="text-slate-900 dark:text-slate-100 font-normal ml-1">({activePlayers.length})</span></h2>
              </div>
              <div className="flex items-center gap-2" data-capture-ignore="true">
                <button
                  onClick={() => handleShare('participation-capture-section', 'participating-list')}
                  disabled={!!isSharing}
                  className={`bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold px-2 py-1 rounded-md text-[10px] flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all active:scale-95 ${isSharing === 'participation-capture-section' ? 'opacity-50' : ''}`}
                >
                  {isSharing === 'participation-capture-section' ? t('generatingImage') : <><ShareIcon /> {t('shareList')}</>}
                </button>
                <button
                  onClick={() => {
                    if (unselectAllConfirm) {
                      setPlayers(prev => prev.map(p => p.sportType === activeTab ? { ...p, isActive: false } : p));
                      setUnselectAllConfirm(false);
                    } else {
                      setUnselectAllConfirm(true);
                      setTimeout(() => setUnselectAllConfirm(false), 3000);
                    }
                  }}
                  className={`bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white px-2 py-1 rounded-md text-[10px] font-semibold transition-all active:scale-95 flex items-center gap-1 ${unselectAllConfirm ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                >
                  {unselectAllConfirm ? <><CheckIcon /> {t('confirmRetry' as any)}</> : t('unselectAll')}
                </button>
              </div>
            </div>

            {/* 팀 묶기 / 나누기 버튼 추가 구역 */}
            <div className="px-4 pb-2 flex gap-1.5" data-capture-ignore="true">
              <button
                onClick={() => { setSelectionMode('MATCH'); setSelectedPlayerIds([]); }}
                className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
              >
                <div className="w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">M</div>
                {t('matchTeams' as any)}
              </button>
              <button
                onClick={() => { setSelectionMode('SPLIT'); setSelectedPlayerIds([]); }}
                className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
              >
                <div className="w-4 h-4 rounded bg-rose-500 text-white flex items-center justify-center text-[8px] font-black">S</div>
                {t('splitTeams' as any)}
              </button>
            </div>

            {/* 설정된 제약 조건 리스트 표시 */}
            {teamConstraints.filter(c => {
              const p = players.find(p => c.playerIds.includes(p.id));
              return p && p.sportType === activeTab;
            }).length > 0 && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-3 bg-slate-400 dark:bg-slate-600 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('activeConstraintsTitle' as any)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {teamConstraints.filter(c => {
                      const p = players.find(p => c.playerIds.includes(p.id));
                      return p && p.sportType === activeTab;
                    }).map(c => (
                      <div key={c.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm animate-in fade-in zoom-in-95">
                        <div className={`w-2 h-2 rounded-full ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {c.playerIds.map(id => players.find(p => p.id === id)?.name || id).join(', ')}
                        </span>
                        <button
                          onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                          className="text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[120px]">
              {activePlayers.length === 0 ? (<div className="col-span-full py-10 opacity-40 text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('selectParticipating')}</div>) :
                activePlayers.map(p => (
                  <PlayerItem
                    key={p.id}
                    player={p}
                    isEditing={editingPlayerId === p.id}
                    lang={lang}
                    onToggle={toggleParticipation}
                    onEditToggle={setEditingPlayerId}
                    onUpdate={updatePlayer}
                    onRemove={removePlayerFromSystem}
                    isSelectionMode={!!selectionMode}
                    isSelected={selectedPlayerIds.includes(p.id)}
                    onSelect={(id) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  />
                ))
              }
            </div>
            <div className="hidden px-4 pb-6" data-promo-footer="true">
              <PromotionFooter lang={lang} darkMode={darkMode} />
            </div>
          </section>
        </div>

        <section className="bg-slate-50 dark:bg-slate-900 p-6 flex flex-col items-center w-full gap-4">
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-slate-900 dark:text-white">
              <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-200 flex items-center justify-center text-white dark:text-slate-900"><ShuffleIcon /></div>
              <div>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-[0.2em] mb-0.5">{t('teamGenerator')}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t(activeTab.toLowerCase() as any)} • {t('playersParticipating', activePlayers.length)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              {activeTab !== SportType.GENERAL && (
                <button
                  onClick={() => setShowQuotaSettings(!showQuotaSettings)}
                  className={`w-full flex items-center justify-center gap-2 h-12 rounded-2xl transition-all font-semibold text-xs ${showQuotaSettings
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-950 text-slate-100 hover:bg-black dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white'}`}
                >
                  <SlidersIcon /> {t('positionSettings')}
                </button>
              )}

              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-2 bg-slate-950 dark:bg-slate-100 h-12 px-4 rounded-2xl border border-transparent flex-1 md:none overflow-hidden transition-all group">
                  <span className="text-xs font-semibold text-slate-100 dark:text-slate-950 uppercase whitespace-nowrap">{t('teamCountLabel')}</span>
                  <select
                    value={teamCount}
                    onChange={e => setTeamCount(Number(e.target.value))}
                    className="bg-transparent text-slate-100 dark:text-slate-950 font-semibold text-xs focus:outline-none cursor-pointer flex-1 appearance-none text-center outline-none border-none py-0 marker:hidden"
                    style={{ backgroundColor: 'transparent', WebkitAppearance: 'none', appearance: 'none' }}
                  >
                    {[2, 3, 4, 5, 6].map(num => (
                      <option key={num} value={num} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 uppercase font-semibold">
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleGenerate} disabled={activePlayers.length < teamCount || isGenerating} className="px-6 h-12 bg-slate-950 text-slate-100 dark:bg-slate-100 dark:text-slate-950 font-semibold rounded-2xl transition-all active:scale-[0.98] text-xs whitespace-nowrap flex-1 md:none disabled:opacity-50 hover:bg-black dark:hover:bg-white">
                  {t('generateTeams')}
                </button>
              </div>

              {/* 팀 색상 지정 섹션 */}
              <div className="w-full mt-2">
                <div className="flex items-center justify-between mb-3 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${useTeamColors ? 'bg-slate-900 border-slate-900 dark:bg-slate-200 dark:border-slate-200 text-white dark:text-slate-900 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                      {useTeamColors && <CheckIcon />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={useTeamColors}
                      onChange={e => {
                        const checked = e.target.checked;
                        setUseTeamColors(checked);
                        if (checked) setShowColorPicker(true);
                      }}
                    />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors uppercase tracking-wider">{t('useTeamColorsLabel')}</span>
                  </label>

                  {/* 창이 닫혀있을 때의 요약 UI */}
                  {useTeamColors && !showColorPicker && (
                    <div
                      onClick={() => setShowColorPicker(true)}
                      className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95"
                    >
                      {selectedTeamColors.map((color, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-700" style={{ backgroundColor: color }} />
                      ))}
                      <span className="text-[9px] font-bold text-slate-400 ml-1 uppercase">EDIT</span>
                    </div>
                  )}
                </div>

                {useTeamColors && showColorPicker && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Array.from({ length: teamCount }).map((_, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 rounded-2xl bg-white dark:bg-slate-950 shadow-sm border border-slate-100/50 dark:border-slate-800/50 transition-all">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-0.5">TEAM {idx + 1}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {TEAM_COLORS.map(color => (
                              <button
                                key={color.value}
                                onClick={() => {
                                  const next = [...selectedTeamColors];
                                  next[idx] = color.value;
                                  setSelectedTeamColors(next);
                                }}
                                className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${selectedTeamColors[idx] === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                                style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                                title={t(color.name as any)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowColorPicker(false)}
                      className="w-full h-11 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-[11px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                    >
                      {t('apply')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {
            showQuotaSettings && activeTab !== SportType.GENERAL && (
              <div className={`w-full pt-4 border-t ${darkMode ? 'border-white/5' : 'border-white/20'} animate-in`}>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('quotaSettingsTitle')}</h3>
                  <div className={`px-2 py-1 rounded text-[10px] font-semibold ${currentQuotaTotal === expectedPerTeam
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                    {t('fixedPlayersStatus', currentQuotaTotal, expectedPerTeam)}
                  </div>
                </div>
                <QuotaFormationPicker
                  sport={activeTab}
                  quotas={quotas}
                  lang={lang}
                  onUpdate={updateQuota}
                  onToggleMode={toggleQuotaMode}
                  darkMode={darkMode}
                />
                <p className="mt-4 text-[9px] text-slate-400 italic text-center opacity-70">{t('quotaInfoMsg')}</p>
              </div>
            )
          }
        </section >

        {result && (
          <div id="results-capture-section" className="space-y-3 pt-3 animate-in duration-500">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
              <div data-capture-ignore="true">
                <button
                  onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                  disabled={!!isSharing}
                  className={`bg-slate-950 dark:bg-slate-100 text-slate-100 dark:text-slate-950 font-black px-2 py-1 rounded-md text-[10px] flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white transition-all ${isSharing ? 'opacity-50' : ''}`}
                >
                  {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
                </button>
              </div>
            </div>

            <div className={`backdrop-blur-sm ${darkMode ? 'bg-slate-900/80 text-slate-100' : 'bg-slate-100/80 text-slate-900'} rounded-2xl p-3 px-5 flex flex-wrap items-center justify-between gap-y-3 gap-x-4 max-w-lg mx-auto w-full`}>
              <div className="flex flex-col">
                <span className={`text-[8px] font-semibold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('standardDeviation')}</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-semibold font-mono ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{result.standardDeviation.toFixed(2)}</span>
                  <span className={`text-[8px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`}>({t('lowerFairer')})</span>
                </div>
              </div>
              {/* DEBUG INFO - 페널티 합계 표시 (일반 탭이 아닐 때만) */}
              {activeTab !== SportType.GENERAL && (
                <div className="flex flex-col items-center">
                  <span className={`text-[8px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-0.5 tracking-widest`}>{t('penaltyScore' as any)}</span>
                  <div className="flex flex-col items-center leading-tight">
                    <span className={`text-xl font-semibold font-mono ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {result.teams.reduce((sum, t) =>
                        sum + t.players.reduce((pSum, p) => {
                          const assigned = p.assignedPosition || 'NONE';
                          const isP1 = (p.primaryPositions || []).includes(assigned) || p.primaryPosition === assigned;
                          const isP2 = (p.secondaryPositions || []).includes(assigned) || p.secondaryPosition === assigned;
                          const isP3 = (p.tertiaryPositions || []).includes(assigned) || p.tertiaryPosition === assigned;
                          return pSum + (isP1 ? 0 : (isP2 ? 0.5 : (isP3 ? 1.0 : 2.0)));
                        }, 0)
                        , 0).toFixed(1)}
                    </span>
                    <span className={`text-[7px] font-medium italic ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-0.5 whitespace-nowrap`}>({t('penaltyScoreDesc' as any)})</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.teams.map((team, idx) => (
                <div key={team.id} className="bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] flex flex-col h-full hover:border-transparent transition-all overflow-hidden">
                  <div className="bg-white dark:bg-slate-950 px-5 py-4 flex items-center justify-between" style={{ borderTop: team.color ? `4px solid ${team.color}` : 'none' }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm pt-0.5 shadow-sm"
                        style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                      >
                        {idx + 1}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider pt-0.5">
                        {team.colorName ? t('teamNameWithColor', t(team.colorName as any)) : `TEAM ${String.fromCharCode(65 + idx)}`}
                      </h4>
                    </div>
                    <div className="text-right flex flex-col items-end justify-center">
                      <span className="block text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-0.5 pt-0.5">{t('squadSum')}</span>
                      <span className="text-xl font-semibold font-mono text-slate-900 dark:text-slate-100">{team.totalSkill}</span>
                    </div>
                  </div>
                  <div className="p-3.5 flex-1 space-y-2">
                    {getSortedTeamPlayers(team.players).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-950 hover:border-transparent transition-all">
                        <div className="flex flex-col gap-1 justify-center pt-0.5">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{p.name}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 opacity-95">
                            {activeTab !== SportType.GENERAL && p.assignedPosition && p.assignedPosition !== 'NONE' && (
                              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md pt-0.5 inline-flex items-center justify-center">{p.assignedPosition}</span>
                            )}
                            {activeTab !== SportType.GENERAL && (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {(p.primaryPositions?.length || (p.primaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{(p.primaryPositions || [p.primaryPosition]).join(',')}</span>
                                  </div>
                                )}
                                {(p.secondaryPositions?.length || (p.secondaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-yellow-600 dark:text-yellow-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                    <span>{(p.secondaryPositions || [p.secondaryPosition]).join(',')}</span>
                                  </div>
                                )}
                                {(p.tertiaryPositions?.length || (p.tertiaryPosition && p.tertiaryPosition !== 'NONE' ? 1 : 0)) > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-orange-500 dark:text-orange-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    <span>{(p.tertiaryPositions || [p.tertiaryPosition!]).join(',')}</span>
                                  </div>
                                )}
                                {p.forbiddenPositions && p.forbiddenPositions.length > 0 && (
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-rose-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>{p.forbiddenPositions.join(',')}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* DEBUG SCORE - 테스트용 점수 표시 (일반 탭이 아닐 때만)
                        {activeTab !== SportType.GENERAL && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">
                              {(() => {
                                const assigned = p.assignedPosition || 'NONE';
                                const isP1 = (p.primaryPositions || []).includes(assigned) || p.primaryPosition === assigned;
                                const isP2 = (p.secondaryPositions || []).includes(assigned) || p.secondaryPosition === assigned;
                                const isP3 = (p.tertiaryPositions || []).includes(assigned) || p.tertiaryPosition === assigned;
                                const penalty = isP1 ? 0 : (isP2 ? 0.5 : (isP3 ? 1.0 : 2.0));
                                return `${p.tier} - ${penalty} = ${(p.tier - penalty).toFixed(1)}`;
                              })()}
                            </span>
                          </div>
                        )}
                        */}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden px-2 pt-2" data-promo-footer="true">
              <PromotionFooter lang={lang} darkMode={darkMode} />
            </div>
          </div>
        )}
      </main >
      <footer className="mt-8 py-6 text-slate-400 dark:text-slate-500 text-[10px] font-semibold w-full text-center max-w-4xl pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="uppercase tracking-[0.3em] opacity-80">{t('footerTagline')}</p>
      </footer>

      {/* 선택 모드 하단 제어 바 */}
      {selectionMode && (
        <div
          className="fixed left-0 right-0 z-[1001] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 animate-in slide-in-from-bottom duration-300"
          style={{
            bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: '1rem'
          }}
        >
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${selectionMode === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{t('selectionModeActive' as any)}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">({selectedPlayerIds.length})</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{t('constraintDescription' as any)}</p>
            </div>
            <div className="flex gap-2">
              <button
                disabled={selectedPlayerIds.length < 2}
                onClick={() => {
                  const newConstraint: TeamConstraint = {
                    id: Math.random().toString(36).substr(2, 9),
                    playerIds: selectedPlayerIds,
                    type: selectionMode
                  };
                  setTeamConstraints(prev => [...prev, newConstraint]);
                  setSelectionMode(null);
                }}
                className={`flex-1 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all ${selectedPlayerIds.length >= 2 ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}
              >
                {t('apply' as any)}
              </button>
              <button
                onClick={() => setSelectionMode(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold py-3 rounded-xl text-xs active:scale-95 transition-all"
              >
                {t('cancel' as any)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* <AdBanner lang={lang} darkMode={darkMode} /> */}

      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} lang={lang} darkMode={darkMode} showAlert={showAlert} />
      <ReviewPrompt isOpen={showReviewPrompt} onLater={handleReviewLater} onRate={handleRateApp} lang={lang} darkMode={darkMode} />
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => setAlertState({ ...alertState, isOpen: false })}
        lang={lang}
        darkMode={darkMode}
      />
    </div >
  );
};

export default App;