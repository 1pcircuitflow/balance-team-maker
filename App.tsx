import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Player, Tier, BalanceResult, SportType, Position, TeamConstraint } from './types';
import { STORAGE_KEY } from './constants';
import { generateBalancedTeams } from './services/balanceService';
import { TRANSLATIONS, Language } from './translations';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents, RewardAdOptions, InterstitialAdPluginEvents, AdLoadInfo } from '@capacitor-community/admob';
import { SAMPLE_PLAYERS_BY_LANG } from './sampleData';
import { AnalyticsService } from './services/analyticsService';
import { savePlayersToCloud, loadPlayersFromCloud } from './services/firebase.ts';
import { paymentService, PRODUCT_IDS } from './services/paymentService';

import * as Icons from './Icons';
const {
  PlusIcon, MinusIcon, TrashIcon, EditIcon, CheckIcon, ShuffleIcon,
  UserPlusIcon, UserCheckIcon, ShareIcon, SunIcon, MoonIcon,
  SlidersIcon, InfoIcon, GlobeIcon, ExternalLinkIcon, MoreIcon,
  SettingsIcon, HeartIcon
} = Icons;

const AdBanner: React.FC<{ lang: Language; darkMode: boolean; isAdFree: boolean }> = ({ lang, darkMode, isAdFree }) => {
  useEffect(() => {
    let timerId: any = null;

    if (isAdFree) {
      AdMob.hideBanner().catch(() => { });
      return;
    }

    const showBanner = async () => {
      // Bridge 초기화 시간을 확보하기 위해 약간의 딜레이 추가 (크래시 방지)
      timerId = setTimeout(async () => {
        try {
          const options = {
            adId: 'ca-app-pub-4761157658396004/6797378026',
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: false
          };
          await AdMob.showBanner(options);
        } catch (e) {
          console.error('Show Banner Failed', e);
        }
      }, 1500);
    };

    showBanner();

    return () => {
      if (timerId) clearTimeout(timerId);
      AdMob.hideBanner().catch(() => { });
    };
  }, [isAdFree]);

  if (isAdFree) return <div className="fixed bottom-0 left-0 w-full h-[env(safe-area-inset-bottom)] bg-white dark:bg-slate-950 z-[2000] transition-colors duration-300" />;

  return (
    <div className={`fixed bottom-0 left-0 w-full bg-white dark:bg-slate-950 pb-[env(safe-area-inset-bottom)] z-[2000] transition-colors duration-300 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]`}>
      <div className={`h-[56px] w-full flex items-center justify-center text-[8px] font-black tracking-[0.2em] uppercase ${darkMode ? 'text-slate-800' : 'text-slate-200'}`}>
        {/* AdMob Banner will be overlaid here */}
      </div>
    </div>
  );
};


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

const LoadingOverlay: React.FC<{ lang: Language; activeTab: SportType; darkMode: boolean; countdown: number; isAdFree: boolean }> = ({ lang, activeTab, darkMode, countdown, isAdFree }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  const icon = activeTab === SportType.BASKETBALL ? '🏀' : activeTab === SportType.SOCCER ? '⚽' : activeTab === SportType.FUTSAL ? '🥅' : '🏆';

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

const UpgradeModal: React.FC<{
  isOpen: boolean; onClose: () => void; onUpgrade: (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => void; isAdFree: boolean; isUnlimitedPos: boolean; lang: Language; darkMode: boolean;
}> = ({ isOpen, onClose, onUpgrade, isAdFree, isUnlimitedPos, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  const products = [
    { type: 'AD_FREE' as const, title: t('buyAdFree' as any), desc: t('adFreeDesc' as any), icon: '🚫', active: isAdFree, color: 'from-blue-500 to-cyan-500', price: t('price_adfree' as any), original: '12,900' },
    { type: 'UNLIMITED_POS' as const, title: t('buyUnlimitedPos' as any), icon: '♾️', desc: t('unlimitedPosDesc' as any), active: isUnlimitedPos, color: 'from-indigo-500 to-purple-500', price: t('price_unlimited' as any), original: '12,900' },
    { type: 'FULL' as const, title: t('buyFullPack' as any), desc: t('fullPackDesc' as any), icon: '💎', active: isAdFree && isUnlimitedPos, color: 'from-amber-400 to-orange-600', highlight: true, price: t('price_full' as any), original: '25,800' },
  ];

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300" onClick={onClose}>
      <div
        className={`w-full max-w-sm rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'} space-y-4`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center pb-2">
          <div className={`inline-block px-4 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] font-black uppercase tracking-tighter mb-3 shadow-sm`}>
            <span>🎁 {t('limitedOfferTime' as any)}</span>
          </div>
          <h3 className={`text-xl font-black ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>{t('proUpgradeTitle')}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Select your upgrade</p>
        </div>

        <div className="space-y-3">
          {products.map((p, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-3xl border transition-all ${p.highlight ? 'ring-2 ring-amber-500/20' : ''} ${p.active ? 'opacity-60 grayscale-[0.5]' : 'hover:scale-[1.02] shadow-sm'} ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
            >
              <div className="p-5 flex items-center gap-4 relative z-10">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl shadow-lg`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-black truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{p.title}</h4>
                    {!p.active && (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 line-through font-bold">₩{p.original}</span>
                        <span className={`text-[11px] font-black ${p.highlight ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>₩{p.price}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">{p.desc}</p>
                </div>
              </div>

              <button
                disabled={p.active}
                onClick={() => onUpgrade(p.type)}
                className={`w-full py-4 text-xs font-black transition-all ${p.active
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-default'
                  : `bg-gradient-to-r ${p.color} text-white shadow-lg active:scale-95 hover:brightness-110`}`}
              >
                {p.active ? '✓ ' + t('proStatusActive') : t('buy' as any)}
              </button>

              {p.highlight && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-[7px] font-black px-3 py-1 text-white rounded-bl-xl uppercase tracking-tighter shadow-sm">
                  🔥 {t('mostPopularTag' as any)}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[9px] text-center text-slate-400 font-bold px-4 leading-relaxed italic opacity-80">
          " {t('supportDevNote' as any)} "
        </p>

        <button
          onClick={onClose}
          className={`w-full py-4 text-xs font-bold rounded-2xl transition-all ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
};

const InfoModal: React.FC<{
  isOpen: boolean; onClose: () => void; lang: Language; darkMode: boolean; isAdFree: boolean; isUnlimitedPos: boolean; isLoggedIn: boolean; onUpgradeRequest: () => void; onRestore: () => void; showAlert: (message: string, title?: string) => void;
}> = ({ isOpen, onClose, lang, darkMode, isAdFree, isUnlimitedPos, isLoggedIn, onUpgradeRequest, onRestore, showAlert }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  const isPro = isAdFree && isUnlimitedPos;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm animate-in duration-200" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'} space-y-8`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className={`text-2xl font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'} tracking-tight`}>{t('infoTitle')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 text-3xl leading-none">&times;</button>
        </div>

        {/* 프리미엄 섹션 */}
        <div className={`relative overflow-hidden p-6 rounded-3xl border ${isPro
          ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-300'
          : 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-500 shadow-lg shadow-blue-500/20'}`}>

          <div className="relative z-10">
            <h4 className="text-white font-black text-lg mb-4 flex items-center gap-2">
              {isPro ? '✨ ' + t('proStatusActive') : '💎 ' + t('proUpgradeTitle')}
            </h4>

            <ul className="space-y-4 mb-8">
              {[
                { label: t('proBenefitAds'), active: isAdFree },
                { label: t('proBenefitPos'), active: isUnlimitedPos },
              ].map((benefit, i) => (
                <li key={i} className={`flex items-center gap-3 text-[13px] font-black transition-all ${benefit.active ? 'text-white' : 'text-white/70'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-inner ${benefit.active ? 'bg-white text-blue-600' : 'bg-white/20 text-white'}`}>
                    ✓
                  </div>
                  {benefit.label}
                </li>
              ))}
            </ul>

            {!isPro && (
              <button
                onClick={onUpgradeRequest}
                className="w-full py-3 bg-white text-blue-700 font-black rounded-xl text-xs shadow-xl active:scale-95 transition-all"
              >
                {t('viewUpgradeOptions' as any)}
              </button>
            )}
          </div>

          {/* 장식용 배경 */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        <div className="space-y-3">
          <a
            href="mailto:1p.circuitflow@gmail.com?subject=Team Balance Pro Feedback"
            className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
          >
            <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('contactUs')}</span>
            <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ExternalLinkIcon /></div>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.balanceteammaker"
            target="_blank"
            rel="noreferrer"
            className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
          >
            <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('rateApp')}</span>
            <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ExternalLinkIcon /></div>
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText('1p.circuitflow@gmail.com');
              showAlert(t('emailCopiedMsg'), t('validationErrorTitle'));
            }}
            className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
          >
            <span className={`text-[12px] font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>1p.circuitflow@gmail.com</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Copy</span>
          </button>

          <button
            onClick={onRestore}
            className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
          >
            <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('restorePurchases' as any)}</span>
            <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ShuffleIcon /></div>
          </button>

        </div>

        <div className="pt-2 flex justify-center text-[10px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-[0.3em]">
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

const LoginModal: React.FC<{
  isOpen: boolean; onLater: () => void; onLogin: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, onLater, onLogin, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 shadow-2xl border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="w-16 h-16 bg-blue-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        </div>

        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {t('loginTitle')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('loginMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-3 border border-slate-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            {t('googleLogin')}
          </button>
          <button
            onClick={onLater}
            className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('loginLater')}
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

const PositionLimitModal: React.FC<{
  isOpen: boolean; onWatchAd: () => void; onUpgrade: () => void; onClose: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, onWatchAd, onUpgrade, onClose, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="w-16 h-16 bg-amber-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
          ⏳
        </div>

        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {t('dailyLimitReached')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('positionLimitMsg')}
        </p>

        <div className="space-y-3">
          <button
            onClick={onWatchAd}
            className="w-full py-4 bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <span>📺</span>
            {t('watchAdUnlock')}
          </button>
          <button
            onClick={onUpgrade}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <span>💎</span>
            {t('unlimitedUnlock')}
          </button>
          <button
            onClick={onClose}
            className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

const LanguageMenu: React.FC<{
  lang: Language; onLangChange: (l: Language) => void; t: any;
}> = ({ lang, onLangChange, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages: { code: Language; flag: string; name: string }[] = [
    { code: 'ko', flag: '🇰🇷', name: '한국어' },
    { code: 'en', flag: '🇺🇸', name: 'English' },
    { code: 'pt', flag: '🇧🇷', name: 'Português' },
    { code: 'es', flag: '🇪🇸', name: 'Español' },
    { code: 'ja', flag: '🇯🇵', name: '日本語' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
        aria-label="Change Language"
      >
        <GlobeIcon />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-[1.5rem] bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-[1500] animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2">
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">{t('language')}</span>
            <div className="space-y-1">
              {languages.map(l => (
                <button
                  key={l.code}
                  onClick={() => { onLangChange(l.code); setIsOpen(false); }}
                  className={`w-full h-10 px-3 rounded-xl flex items-center justify-between transition-all ${lang === l.code ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  <span className="text-sm font-bold">{l.name}</span>
                  <span className="text-base">{l.flag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RewardAdModal: React.FC<{
  isOpen: boolean;
  onComplete: () => void;
  onClose: () => void;
  lang: Language;
  darkMode: boolean;
}> = ({ isOpen, onComplete, onClose, lang, darkMode }) => {
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
  const [useRandomMix, setUseRandomMix] = useState(false);

  const [alertState, setAlertState] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    message: '',
  });

  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('app_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginLater, setLoginLater] = useState(false); // 앱 실행 시마다 초기화 (localStorage 제거)

  const [positionUsage, setPositionUsage] = useState<{ count: number, lastDate: string }>(() => {
    const saved = localStorage.getItem('app_position_usage');
    return saved ? JSON.parse(saved) : { count: 0, lastDate: '' };
  });
  const [totalGenCount, setTotalGenCount] = useState(() => parseInt(localStorage.getItem('app_total_gen_count') || '0', 10));
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showRewardAd, setShowRewardAd] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isAdFree, setIsAdFree] = useState(() => localStorage.getItem('app_is_ad_free') === 'true');
  const [isUnlimitedPos, setIsUnlimitedPos] = useState(() => localStorage.getItem('app_is_unlimited_pos') === 'true');
  const isPro = isAdFree && isUnlimitedPos;

  const [isProcessing, setIsProcessing] = useState(false); // 결제/로그인 중복 클릭 방지

  const showAlert = (message: string, title?: string) => {
    setAlertState({ isOpen: true, message, title });
  };


  useEffect(() => {
    const initAdMob = async () => {
      try {
        await AdMob.initialize({
          initializeForTesting: false,
        });

        if (Capacitor.getPlatform() === 'ios') {
          await AdMob.requestTrackingAuthorization();
        }

        AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: any) => {
          console.log('User earned reward', reward);
          handleRewardAdComplete();
        });
      } catch (e) {
        console.error('AdMob init failed', e);
      }
    };

    const initIAP = async () => {
      try {
        await paymentService.initialize();
        const restored = await paymentService.restorePurchases();

        // 광고 제거 상태 동기화
        const hasAdFree = restored.includes(PRODUCT_IDS.AD_FREE) || restored.includes(PRODUCT_IDS.FULL_PACK);
        setIsAdFree(hasAdFree);
        localStorage.setItem('app_is_ad_free', hasAdFree ? 'true' : 'false');

        // 무제한 포지션 상태 동기화
        const hasUnlimited = restored.includes(PRODUCT_IDS.UNLIMITED_POS) || restored.includes(PRODUCT_IDS.FULL_PACK);
        setIsUnlimitedPos(hasUnlimited);
        localStorage.setItem('app_is_unlimited_pos', hasUnlimited ? 'true' : 'false');

        console.log('IAP Sync completed:', { hasAdFree, hasUnlimited });
      } catch (err) {
        console.error('IAP initialization failed', err);
      }
    };

    initAdMob();
    initIAP();
  }, []); // 마운트 시 1회만 실행

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

    if (!user && !loginLater) {
      setShowLoginModal(true);
    }

    // 자동 로그인 시 클라우드 데이터 로드 (로그인만 하면 무료)
    if (user?.id) {
      loadPlayersFromCloud(user.id).then(cloudPlayers => {
        if (cloudPlayers && cloudPlayers.length > 0) {
          setPlayers(cloudPlayers);
        }
      });
    }

    // Google Auth 초기화 (웹 환경 대응 포함)
    const initAuth = async () => {
      try {
        await GoogleAuth.initialize();
      } catch (e) {
        console.error('Auth init failed', e);
      }
    };
    initAuth();

    // 일일 제한 초기화 체크
    const today = new Date().toISOString().split('T')[0];
    const savedUsage = localStorage.getItem('app_position_usage');
    if (savedUsage) {
      const parsed = JSON.parse(savedUsage);
      if (parsed.lastDate !== today) {
        const freshUsage = { count: 0, lastDate: today };
        setPositionUsage(freshUsage);
        localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
      }
    } else {
      const freshUsage = { count: 0, lastDate: today };
      setPositionUsage(freshUsage);
      localStorage.setItem('app_position_usage', JSON.stringify(freshUsage));
    }
  }, []);

  const handleWatchRewardAd = async () => {
    setShowLimitModal(false);

    try {
      const options: RewardAdOptions = {
        adId: 'ca-app-pub-4761157658396004/2646854681',
        isTesting: false
      };
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
      console.log('Reward Ad shown successfully');
    } catch (e) {
      console.error('Reward Ad failed', e);
      // 광고 실패 시에도 일단 혜택 제공 (UX 차원)
      handleRewardAdComplete();
    }
  };

  const handleRewardAdComplete = () => {
    setShowRewardAd(false);
    // 보너스 사용권 3회 제공 (오늘 날짜 유지하며 카운트를 -3하여 다음 3회 시도 통과)
    setPositionUsage(prev => ({ ...prev, count: Math.max(0, prev.count - 3) }));
    showAlert(t('bonusUnlockedMsg'), t('bonusUnlockedTitle'));
  };

  const handleUpgradePro = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      let productId: string = '';
      if (type === 'AD_FREE') productId = PRODUCT_IDS.AD_FREE;
      else if (type === 'UNLIMITED_POS') productId = PRODUCT_IDS.UNLIMITED_POS;
      else if (type === 'FULL') productId = PRODUCT_IDS.FULL_PACK;

      const success = await paymentService.purchase(productId as any);

      if (success) {
        if (type === 'AD_FREE' || type === 'FULL') {
          setIsAdFree(true);
          localStorage.setItem('app_is_ad_free', 'true');
        }
        if (type === 'UNLIMITED_POS' || type === 'FULL') {
          setIsUnlimitedPos(true);
          localStorage.setItem('app_is_unlimited_pos', 'true');
        }

        setShowLimitModal(false);
        setShowUpgradeModal(false);
        showAlert(t('upgradeSuccessMsg'), t('upgradeSuccessTitle'));
      }
    } finally {
      setIsProcessing(false);
    }
  };



  const handleRestorePurchases = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const restored = await paymentService.restorePurchases();
      let restoredAny = false;

      if (restored.includes(PRODUCT_IDS.AD_FREE) || restored.includes(PRODUCT_IDS.FULL_PACK)) {
        setIsAdFree(true);
        localStorage.setItem('app_is_ad_free', 'true');
        restoredAny = true;
      }
      if (restored.includes(PRODUCT_IDS.UNLIMITED_POS) || restored.includes(PRODUCT_IDS.FULL_PACK)) {
        setIsUnlimitedPos(true);
        localStorage.setItem('app_is_unlimited_pos', 'true');
        restoredAny = true;
      }

      if (restoredAny) {
        showAlert(t('upgradeSuccessMsg'), t('upgradeSuccessTitle'));
      } else {
        showAlert(t('noPurchasesFound' as any), t('infoTitle'));
      }
    } catch (err) {
      console.error('Restore failed', err);
      showAlert(t('restoreFailed' as any), t('validationErrorTitle'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const googleUser = await GoogleAuth.signIn();
      console.log('Google User:', googleUser);
      setUser(googleUser);
      localStorage.setItem('app_user', JSON.stringify(googleUser));
      setShowLoginModal(false);
      showAlert(`${googleUser.givenName}님, 환영합니다!`, 'Login Success');

      // 클라우드에서 데이터 가져오기 (전면 무료)
      const cloudPlayers = await loadPlayersFromCloud(googleUser.id);
      if (cloudPlayers && cloudPlayers.length > 0) {
        setPlayers(cloudPlayers);
        // showAlert('클라우드에서 명단을 불러왔습니다.', 'Sync Success'); 
      }
    } catch (e: any) {
      console.error('Login failed', e);
      if (e.error !== 'user_cancelled') {
        showAlert(`Login failed: ${e.message || 'Unknown error'}`, 'Error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginLater = () => {
    setShowLoginModal(false);
    setLoginLater(true);
    // localStorage.setItem('app_login_later', 'true'); // 저장하지 않음 (앱 껐다 키면 다시 나오게)
  };

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
    const SAMPLE_DATA_VERSION = 'v2';
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedVersion = localStorage.getItem('app_sample_version');

    const isSampleData = (playerList: Player[]) => {
      if (!playerList || playerList.length === 0) return true;
      const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
      // 모든 선수의 ID가 샘플 패턴(언어코드_)으로 시작해야 샘플로 간주
      return playerList.every(p => sampleIdPattern.test(p.id));
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.length > 0) {
          if (isSampleData(parsed)) {
            // 샘플 데이터인 경우: 버전이 바뀌었거나, 저장된 언어와 현재 언어가 다른 경우에만 업데이트
            if (storedVersion !== SAMPLE_DATA_VERSION) {
              setPlayers(SAMPLE_PLAYERS_BY_LANG[lang]);
              localStorage.setItem('app_sample_version', SAMPLE_DATA_VERSION);
            } else {
              setPlayers(parsed);
            }
          } else {
            // 사용자 데이터인 경우(한 명이라도 직접 추가했거나 ID가 바뀜): 무조건 유지
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
  }, []); // 마운트 시 1회만 실행하여 유저 데이터 보존

  // useEffect(() => {localStorage.setItem('app_lang', lang); }, [lang]); // 더 이상 매번 저장하지 않음
  useEffect(() => { localStorage.setItem('app_dark_mode', darkMode.toString()); if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem(`app_constraints`, JSON.stringify(teamConstraints)); }, [teamConstraints]);

  // 선수 데이터가 변경될 때마다 클라우드에 자동 저장 (로그인 시 무료)
  useEffect(() => {
    if (user?.id && players.length > 0) {
      savePlayersToCloud(user.id, players);
    }
  }, [players, user]);

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
    nextPromptDate.setDate(nextPromptDate.getDate() + 14);
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

  const handleGenerate = async () => {
    const participating = players.filter(p => p.isActive && p.sportType === activeTab);
    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    // 포지션 인원 설정이 하나라도 있는지 확인 (있으면 고급 기능 사용)
    const isAdvanced = Object.values(quotas).some(v => v !== null);

    // 광고 정책: 가입 후 최초 10회는 무조건 통과, 이후 일일 3회 제한
    if (isAdvanced && !isUnlimitedPos && totalGenCount > 10 && positionUsage.count >= 3) {
      setShowLimitModal(true);
      return;
    }

    setIsGenerating(true);
    // 광고 제거 전은 1.5초(연출), 광고 제거 후는 0.5초(빠름)
    const waitTime = isAdFree ? 500 : 1500;
    setCountdown(isAdFree ? 1 : 5);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);

          // 전체 생성 횟수 기록
          const nextTotal = totalGenCount + 1;
          setTotalGenCount(nextTotal);
          localStorage.setItem('app_total_gen_count', nextTotal.toString());

          // 포지션 사용 횟수 기록 (10회 이후부터 카운트)
          if (isAdvanced && !isUnlimitedPos && nextTotal > 10) {
            setPositionUsage(prevUsage => {
              const next = { ...prevUsage, count: prevUsage.count + 1 };
              localStorage.setItem('app_position_usage', JSON.stringify(next));
              return next;
            });
          }
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
      const res = generateBalancedTeams(participating, teamCount, quotas, activeConstraints, useRandomMix);

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

      // 팀 생성 횟수 기반 리뷰 유도 (10회 이상)
      const genCount = parseInt(localStorage.getItem('app_gen_count') || '0', 10) + 1;
      localStorage.setItem('app_gen_count', genCount.toString());

      if (genCount >= 10) {
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
    }, waitTime);
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
                          -webkit - print - color - adjust: exact;
                        font-family: inherit !important;
            }
                        .animate-in {opacity: 1 !important; transform: none !important; animation: none !important; visibility: visible !important; }
                        [data-capture-ignore] {display: none !important; visibility: hidden !important; }
                        .bg-slate-950 {background - color: #020617 !important; }
                        .bg-\\[\\#fdfcf9\\] {background - color: #fdfcf9 !important; }
                        .flex {display: flex !important; }
                        .items-center {align - items: center !important; }
                        .justify-between {justify - content: space-between !important; }
                        .flex-col {flex - direction: column !important; }
                        .text-sm {font - size: 14px !important; }
                        .font-semibold {font - weight: 600 !important; }
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
      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isPro={isPro} />}

      <header className="w-full flex flex-col items-center mb-0">
        <div className="w-full flex justify-between items-center mb-4 bg-white dark:bg-slate-950 p-1.5">
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`p-2.5 rounded-xl transition-all flex items-center gap-2 group relative ${isPro
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30'}`}
            >
              <div className="relative">
                <span className={`text-lg block transition-transform group-active:scale-90 ${isPro ? 'animate-pulse' : ''}`}>
                  {isPro ? '✨' : '💎'}
                </span>
                {!isPro && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950" />
                )}
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase pt-0.5">
                {isPro ? 'PRO' : 'SALE'}
              </span>
            </button>
          </div>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <LanguageMenu
              lang={lang}
              onLangChange={handleManualLangChange}
              t={t}
            />
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Show app Info"
            >
              <InfoIcon />
            </button>
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

                  {/* 무작위 섞기 추가 */}
                  <label className="flex items-center gap-2 cursor-pointer group ml-auto mr-4">
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>
                      {useRandomMix && <CheckIcon />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={useRandomMix}
                      onChange={e => setUseRandomMix(e.target.checked)}
                    />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors uppercase tracking-wider">{t('randomMix')}</span>
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
              <div data-capture-ignore="true" className="flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="bg-slate-950 dark:bg-slate-100 text-slate-100 dark:text-slate-950 font-black px-3 py-1 rounded-md text-[10px] flex items-center gap-1 hover:bg-slate-800 dark:hover:bg-white transition-all"
                >
                  ← {t('backToRoster')}
                </button>
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


      <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} lang={lang} darkMode={darkMode} isAdFree={isAdFree} isUnlimitedPos={isUnlimitedPos} isLoggedIn={!!user} onUpgradeRequest={() => { setShowInfoModal(false); setShowUpgradeModal(true); }}
        onRestore={handleRestorePurchases}
        showAlert={showAlert}
      />
      <ReviewPrompt isOpen={showReviewPrompt} onLater={handleReviewLater} onRate={handleRateApp} lang={lang} darkMode={darkMode} />
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onConfirm={() => setAlertState({ ...alertState, isOpen: false })}
        lang={lang}
        darkMode={darkMode}
      />
      <LoginModal
        isOpen={showLoginModal}
        onLater={handleLoginLater}
        onLogin={handleGoogleLogin}
        lang={lang}
        darkMode={darkMode}
      />
      <PositionLimitModal
        isOpen={showLimitModal}
        onWatchAd={handleWatchRewardAd}
        onUpgrade={() => { setShowLimitModal(false); setShowUpgradeModal(true); }}
        onClose={() => setShowLimitModal(false)}
        lang={lang}
        darkMode={darkMode}
      />
      <RewardAdModal
        isOpen={showRewardAd}
        onComplete={handleRewardAdComplete}
        onClose={() => setShowRewardAd(false)}
        lang={lang}
        darkMode={darkMode}
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgradePro}
        isAdFree={isAdFree}
        isUnlimitedPos={isUnlimitedPos}
        lang={lang}
        darkMode={darkMode}
      />

      {/* 하단 고정 배너 광고 및 고정 영역 (스크롤 콘텐츠 가림 방지 여백 포함) */}
      <div className="h-[calc(60px+env(safe-area-inset-bottom))]" />
      <AdBanner lang={lang} darkMode={darkMode} isAdFree={isAdFree} />
    </div>
  );
};

export default App;