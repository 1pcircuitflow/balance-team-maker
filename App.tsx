import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Player, Tier, BalanceResult, SportType, Position, TeamConstraint } from './types';
import { STORAGE_KEY } from './constants';
import { generateBalancedTeams } from './services/balanceService';
import { TRANSLATIONS, Language } from './translations';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents, RewardAdOptions, InterstitialAdPluginEvents, AdLoadInfo } from '@capacitor-community/admob';
import { SAMPLE_PLAYERS_BY_LANG } from './sampleData';
import { AnalyticsService } from './services/analyticsService';
import { paymentService, PRODUCT_IDS } from './services/paymentService';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';
import {
  createRecruitmentRoom,
  getRoomInfo,
  applyForParticipation,
  cancelApplication,
  subscribeToRoom,
  subscribeToUserRooms,
  updateRoomFcmToken,
  RecruitmentRoom,
  Applicant,
  db,
  savePlayersToCloud,
  loadPlayersFromCloud,
  checkAppVersion
} from './services/firebaseService';
import { doc, updateDoc } from 'firebase/firestore';

import * as Icons from './Icons';
const {
  PlusIcon, MinusIcon, TrashIcon, EditIcon, CheckIcon, ShuffleIcon,
  UserPlusIcon, UserCheckIcon, ShareIcon, SunIcon, MoonIcon,
  SlidersIcon, InfoIcon, GlobeIcon, ExternalLinkIcon, MoreIcon,
  SettingsIcon, HeartIcon, RotateCcwIcon, CloseIcon, HelpCircleIcon, HomeIcon
} = Icons;
import { DateTimePicker } from './components/DateTimePicker';

const AdBanner: React.FC<{ lang: Language; darkMode: boolean; isAdFree: boolean; bottomOffset?: string }> = ({ lang, darkMode, isAdFree, bottomOffset = '0px' }) => {
  useEffect(() => {
    let timerId: any = null;

    if (isAdFree) {
      AdMob.hideBanner().catch(() => { });
      return;
    }

    const showBanner = async () => {
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

  if (isAdFree) return null;

  return (
    <div
      className={`fixed left-0 right-0 bg-white dark:bg-slate-950 z-[4000] transition-colors duration-300 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]`}
      style={{ bottom: bottomOffset }}
    >
      <div className={`h-[56px] w-full flex items-center justify-center text-[8px] font-black tracking-[0.2em] uppercase ${darkMode ? 'text-slate-800' : 'text-slate-200'}`}>
        {/* AdMob Banner will be overlaid here */}
      </div>
    </div>
  );
};


const compareVersions = (v1: string, v2: string) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
};

const UpdateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  message: string;
  forceUpdate: boolean;
  lang: Language;
  darkMode: boolean;
}> = ({ isOpen, onClose, onUpdate, message, forceUpdate, lang, darkMode }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]">
      <div className={`w-full max-w-[320px] rounded-3xl p-6 shadow-2xl transform transition-all scale-100 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <Icons.RotateCcwIcon size={24} />
          </div>

          <div className="space-y-2">
            <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'ko' ? '업데이트 알림' : (lang === 'en' ? 'Update Available' : 'Actualización disponible')}
            </h3>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {message}
            </p>
          </div>

          <div className="flex flex-col w-full gap-2 mt-2">
            <button
              onClick={onUpdate}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/30"
            >
              {lang === 'ko' ? '지금 업데이트' : (lang === 'en' ? 'Update Now' : 'Actualizar ahora')}
            </button>

            {!forceUpdate && (
              <button
                onClick={onClose}
                className={`w-full py-3.5 font-bold rounded-xl transition-all active:scale-95 ${darkMode ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {lang === 'ko' ? '나중에 하기' : (lang === 'en' ? 'Later' : 'Más tarde')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  darkMode: boolean;
  lang: Language;
}> = ({ isOpen, onClose, title, content, darkMode, lang }) => {
  if (!isOpen) return null;

  const parts = content.split('|');
  const steps = parts.slice(0, 4);
  const features = parts.slice(4);

  const stepIcons = [
    <PlusIcon />,
    <ShareIcon />,
    <UserCheckIcon />,
    <ShuffleIcon />
  ];

  const stepColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500'
  ];

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-4" onClick={onClose}>
      <div
        className={`w-full max-w-md max-h-[85vh] flex flex-col relative overflow-hidden transition-all duration-500 rounded-[2rem] shadow-2xl animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className={`text-xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-2xl transition-all active:scale-90 ${darkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
          {/* Steps Grid */}
          <div className="grid grid-cols-1 gap-2.5">
            {steps.map((step, idx) => (
              <div key={idx} className={`group relative p-3 rounded-2xl border transition-all duration-300 ${darkMode ? 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0 ${stepColors[idx]}`}>
                    {stepIcons[idx]}
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-black uppercase tracking-widest opacity-40">Step {idx + 1}</span>
                    <p className={`text-[13px] font-bold leading-snug ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                      {step}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Features Section */}
          <div className={`p-4 rounded-2xl ${darkMode ? 'bg-blue-600/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'}`}>
            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              <div className="w-1 h-1 rounded-full bg-current" />
              추가 기능
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className={`w-1 h-1 rounded-full ${darkMode ? 'bg-blue-500/40' : 'bg-blue-300'}`} />
                  <p className={`text-[11px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-sm rounded-2xl transition-all active:scale-95 shadow-2xl shadow-slate-900/20 dark:shadow-none"
          >
            {lang === 'ko' ? '확인했습니다' : (lang === 'en' ? 'Got it' : 'Close')}
          </button>
        </div>
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
  isSelectionMode?: boolean;
  showTier?: boolean; // 항목 2: 티어 숨기기
}


const PlayerItem: React.FC<PlayerItemProps> = ({
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
          {!isEditing && !isSelectionMode && showTier && (
            <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TIER_COLORS[player.tier]} pt-1 shrink-0`}>
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
  /* 
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  const products = [
    { type: 'AD_FREE' as const, title: t('buyAdFree' as any), desc: t('adFreeDesc' as any), icon: '🚫', active: isAdFree, color: 'from-blue-500 to-cyan-500', price: t('price_adfree' as any), original: '4,900', highlight: false },
  ];

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300" onClick={onClose}>
      <div
        className={`w-full max-w-sm rounded-[2.5rem] p-6 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'} space-y-4`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center pb-1">
          <div className={`inline-block px-4 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[10px] font-black uppercase tracking-tighter mb-2 shadow-sm`}>
            <span>🎁 {t('limitedOfferTime' as any)}</span>
          </div>
          <h3 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>{t('proUpgradeTitle')}</h3>
        </div>

        <div className="space-y-3">
          {products.map((p, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-3xl border transition-all ${p.highlight ? 'ring-2 ring-amber-500/20' : ''} ${p.active ? 'opacity-60 grayscale-[0.5]' : 'hover:scale-[1.02] shadow-sm'} ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
            >
              <div className="p-4 flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center text-xl shadow-lg`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-black truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{p.title}</h4>
                    {!p.active && (
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-400 line-through font-bold">₩{p.original}</span>
                        <span className={`text-[12px] font-black ${p.highlight ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>₩{p.price}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-medium text-slate-500 leading-tight mt-0.5">{p.desc}</p>
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
  */
  return null;
};

const InfoModal: React.FC<{
  isOpen: boolean; onClose: () => void; onUpgradeRequest: () => void; onRestore: () => void;
  lang: Language; darkMode: boolean; isAdFree: boolean; isUnlimitedPos: boolean; user: any;
  nickname: string; onUpdateNickname: (name: string) => void; onLogin: () => void; onLogout: () => void;
}> = ({ isOpen, onClose, onUpgradeRequest, onRestore, lang, darkMode, isAdFree, isUnlimitedPos, user, nickname, onUpdateNickname, onLogin, onLogout }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  const isPro = isAdFree;

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);

  useEffect(() => {
    setTempNickname(nickname);
  }, [nickname, isOpen]);

  const onSaveNickname = () => {
    if (tempNickname.trim()) {
      onUpdateNickname(tempNickname.trim());
      setIsEditingName(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm animate-in duration-200" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'} space-y-8`} onClick={e => e.stopPropagation()}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className={`text-2xl font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'} tracking-tight`}>{t('infoTitle')}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 text-3xl leading-none">&times;</button>
          </div>

          {/* 프로필 섹션 */}
          <div className={`p-5 rounded-[2rem] border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {user ? 'Google Account' : 'Guest Mode'}
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 outline-none focus:border-blue-500 transition-all ${darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      placeholder={t('nicknamePlaceholder')}
                      autoFocus
                    />
                    <button onClick={onSaveNickname} className="p-2 bg-blue-600 text-white rounded-lg shadow-lg active:scale-90"><CheckIcon /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{nickname}</span>
                    <button onClick={() => setIsEditingName(true)} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors pointer-events-auto"><EditIcon /></button>
                  </div>
                )}
              </div>
              {user ? (
                <button onClick={onLogout} className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
                  {t('logout')}
                </button>
              ) : (
                <button onClick={onLogin} className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[11px] font-black uppercase tracking-wider active:scale-95 transition-all">
                  {t('googleLogin')}
                </button>
              )}
            </div>
          </div>

          {/* 프리미엄 섹션 */}
          {/* 프리미엄 섹션 주석 처리
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
                <button onClick={onUpgradeRequest} className="w-full py-3 bg-white text-blue-700 font-black rounded-xl text-xs shadow-xl active:scale-95 transition-all">
                  {t('viewUpgradeOptions' as any)}
                </button>
              )}
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          </div>
          */}

          <div className="space-y-3">
            <a href="https://play.google.com/store/apps/details?id=com.balanceteammaker" target="_blank" rel="noreferrer" className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
              <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('rateApp')}</span>
              <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><ExternalLinkIcon /></div>
            </a>
            {/* 구매 복구 버튼 주석 처리
            <button onClick={onRestore} className={`w-full flex items-center justify-between px-6 py-4 rounded-[1.5rem] border transition-all ${darkMode ? 'bg-slate-950 border-slate-800 hover:bg-black' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
              <span className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t('restorePurchases' as any)}</span>
              <div className={darkMode ? 'text-slate-500' : 'text-slate-400'}><RotateCcwIcon /></div>
            </button>
            */}
          </div>

          <div className="pt-2 flex justify-center text-[10px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-[0.3em]">
            {t('version')} 2.1.17
          </div>
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

const ConfirmModal: React.FC<{
  isOpen: boolean; title?: string; message: string; onConfirm: () => void; onCancel: () => void; lang: Language; darkMode: boolean; confirmText?: string; cancelText?: string;
}> = ({ isOpen, title, message, onConfirm, onCancel, lang, darkMode, confirmText, cancelText }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {title || t('infoTitle')}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 py-4 font-bold rounded-2xl transition-all active:scale-95 ${darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {cancelText || t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            {confirmText || 'OK'}
          </button>
        </div>
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
          {/* 업그레이드 버튼 주석 처리
          <button
            onClick={onUpgrade}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <span>💎</span>
            {t('unlimitedUnlock')}
          </button>
          */}
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





const LoginRecommendModal: React.FC<{
  isOpen: boolean; onLater: () => void; onLogin: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, onLater, onLogin, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-md animate-in duration-300">
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 text-center ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-2xl'}`}>
        <div className="w-16 h-16 bg-amber-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl">
          💡
        </div>

        <h3 className={`text-2xl font-semibold ${darkMode ? 'text-slate-100' : 'text-slate-900'} mb-3 tracking-tight`}>
          {t('loginRecommendTitle' as any)}
        </h3>
        <p className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 px-2 leading-relaxed`}>
          {t('loginRecommendMsg' as any)}
        </p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            {t('googleLogin')}
          </button>
          <button
            onClick={onLater}
            className={`w-full py-4 font-semibold rounded-2xl transition-all active:scale-95 ${darkMode ? 'text-slate-400 hover:text-slate-100' : 'text-slate-500 hover:text-slate-900'}`}
          >
            {t('continueWithoutLogin' as any)}
          </button>
        </div>
      </div>
    </div>
  );
};
// V3.0 모집 현황 배지
const RecruitmentStatusBadge: React.FC<{ count: number; darkMode: boolean }> = ({ count, darkMode }) => {
  if (count === 0) return null;
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-2 ring-white dark:ring-slate-950 animate-bounce">
      {count}
    </span>
  );
};

// 방장용 모집 관리 모달
const HostRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: RecruitmentRoom) => void;
  activeRoom: RecruitmentRoom | null;
  activeRooms: RecruitmentRoom[];
  activeTab: SportType;
  onCloseRoom: () => void;
  onApproveAll: (players: Player[]) => void;
  lang: Language;
  darkMode: boolean;
  isPro: boolean;
  onUpgrade: () => void;
  userNickname: string;
  currentUserId: string;
  activePlayerCount: number;
  showAlert: (msg: string, title?: string) => void;
}> = ({ isOpen, onClose, onRoomCreated, activeRoom, activeRooms, activeTab, onCloseRoom, onApproveAll, lang, darkMode, isPro, onUpgrade, userNickname, currentUserId, activePlayerCount, showAlert }) => {
  /* 날짜/시간 초기값 및 상태 관리 */
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours(), 0, 0, 0); // 현재 시간 정각
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours(), 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // 종료 시간은 시작 시간 + 1시간 기본값
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0); // Start + 1 hour
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [activePicker, setActivePicker] = useState<'START' | 'END'>('START');

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };

  const [title, setTitle] = useState(`${TRANSLATIONS[lang][activeTab.toLowerCase() as any]} ${t('meeting')}`);
  const [loading, setLoading] = useState(false);
  const [useLimit, setUseLimit] = useState(false);
  const [maxApplicants, setMaxApplicants] = useState(12);
  const [tierMode, setTierMode] = useState<'5TIER' | '3TIER'>('5TIER');
  const [isPickerSelectionMode, setIsPickerSelectionMode] = useState(false);

  useEffect(() => {
    if (isOpen && !activeRoom) {
      // 모달이 열릴 때(새 방 생성 모드인 경우) 날짜와 시간을 현재 기준으로 리셋
      const d = new Date();
      d.setHours(d.getHours(), 0, 0, 0); // 현재 시간의 정각

      const newStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const newStartTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      setStartDate(newStartDate);
      setStartTime(newStartTime);

      // 종료 시간은 시작 + 1시간
      const endD = new Date(d.getTime() + 60 * 60 * 1000);
      setEndDate(`${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`);
      setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);

      // 제목도 현재 탭에 맞춰 초기화
      setTitle(`${TRANSLATIONS[lang][activeTab.toLowerCase() as any]} ${t('meeting')}`);
    }

    if (activeRoom?.id && isOpen) {
      // 실시간 방 정보 구독
      const unsub = subscribeToRoom(activeRoom.id, (room) => {
        if (room) onRoomCreated(room);
      });

      // 방장의 최신 푸시 토큰 동기화 (알림용)
      const latestToken = localStorage.getItem('fcm_token');
      if (latestToken) {
        updateRoomFcmToken(activeRoom.id, latestToken);
      }

      return () => unsub();
    }

    // 모달이 열릴 때(또는 활성 룸이 변경될 때) 만료된 방 자동 삭제 체크
    if (isOpen && activeRooms.length > 0) {
      const now = new Date();
      activeRooms.forEach(async (room) => {
        if (room.matchDate && room.matchTime) {
          const matchStart = new Date(`${room.matchDate}T${room.matchTime}`);
          // 30분 여유 시간
          const expireTime = new Date(matchStart.getTime() + 30 * 60000);

          if (now > expireTime) {
            console.log(`Auto deleting expired room: ${room.id} (${room.title})`);
            try {
              await updateDoc(doc(db, "rooms", room.id), { status: 'DELETED' });
              // 모달이 열려있는 동안에만 UI 갱신을 위해 상위 컴포넌트 알림 등은 생략하고
              // 다음 렌더링 때 activeRooms에서 빠지기를 기대하거나 강제로 닫을 수 있음.
              // 여기서는 조용히 백그라운드 삭제만 진행.
            } catch (e) {
              console.error("Auto delete failed:", e);
            }
          }
        }
      });
    }
  }, [activeRoom?.id, isOpen]);

  const handleStartTimeChange = (newDate: string, newTime: string) => {
    setStartDate(newDate);
    setStartTime(newTime);

    // 종료 시간 자동 계산 (시작 시간 + 1시간)
    const start = new Date(`${newDate}T${newTime}`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // 날짜 포맷팅
    const eYear = end.getFullYear();
    const eMonth = String(end.getMonth() + 1).padStart(2, '0');
    const eDay = String(end.getDate()).padStart(2, '0');
    const eHours = String(end.getHours()).padStart(2, '0');
    const eMinutes = String(end.getMinutes()).padStart(2, '0');

    setEndDate(`${eYear}-${eMonth}-${eDay}`);
    setEndTime(`${eHours}:${eMinutes}`);
  };



  const handleCreate = async () => {
    setLoading(true);
    try {
      const roomId = await createRecruitmentRoom({
        hostId: currentUserId,
        hostName: userNickname,
        title: title,
        sport: activeTab,
        matchDate: startDate,
        matchTime: startTime,
        matchEndDate: endDate,
        matchEndTime: endTime,
        maxApplicants: useLimit ? maxApplicants : 0, // 0이면 무제한
        tierMode: tierMode,
        fcmToken: localStorage.getItem('fcm_token') || undefined
      });

      // 링크생성 및 자동 복사
      const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
      const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${roomId}&lang=${lang}`;

      try {
        await Clipboard.write({ string: webUrl });
        showAlert(t('linkCopied' as any), t('shareRecruitLink'));
      } catch (err) {
        console.error('Clipboard copy failed', err);
      }

      const room = await getRoomInfo(roomId);
      if (room) onRoomCreated(room);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLimit = async (newLimit: number) => {
    if (!activeRoom) return;
    try {
      await updateDoc(doc(db, "rooms", activeRoom.id), { maxApplicants: newLimit });
    } catch (e) { console.error(e); }
  };


  const handleShare = async () => {
    if (!activeRoom) return;

    // 실제 배포된 도메인 주소
    const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";

    // 공유 링크는 어떤 환경에서든 항상 운영 주소를 사용하도록 고정합니다.
    // (로컬 주소를 공유할 일이 없으므로 판별 로직 생략)
    const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${activeRoom.id}&lang=${lang}`;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: t('shareRecruitLink'),
            text: `[${activeRoom.title}] ${activeRoom.matchDate} ${activeRoom.matchTime} ${t(activeRoom.sport.toLowerCase())} 참여자를 모집합니다!\n\n👇 참가하기 👇\n${webUrl}`,
            dialogTitle: t('shareRecruitLink'),
          });
        } catch (shareError) {
          await Clipboard.write({ string: webUrl });
        }
      } else {
        await Clipboard.write({ string: webUrl });
      }
    } catch (e) {
      try {
        await Clipboard.write({ string: webUrl });
      } catch (err) {
        // Fail silently or log
      }
    }
  };

  if (!isOpen || activeRoom) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <div className="flex justify-end items-center">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 transition-colors"><CloseIcon /></button>
          </div>



          {!activeRoom ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('roomTitle')}</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('inputRoomTitle')} className="w-full bg-slate-50 dark:bg-slate-950 rounded-2xl px-3 py-2.5 focus:outline-none dark:text-white font-bold text-sm" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2">
                  <div
                    onClick={() => setActivePicker('START')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-50'}`}
                  >
                    <span className="text-[9px] font-black uppercase text-blue-500 mb-0.5">{t('startTime')}</span>
                    <span className={`text-sm font-bold ${activePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                      {startDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(startDate).getDay()]}) {startTime}
                    </span>
                  </div>
                  <div className="text-slate-300 dark:text-slate-600 pb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <div
                    onClick={() => setActivePicker('END')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-50'}`}
                  >
                    <span className="text-[9px] font-black uppercase text-rose-500 mb-0.5">{t('endTime')}</span>
                    <span className={`text-sm font-bold ${activePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                      {endDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(endDate).getDay()]}) {endTime}
                    </span>
                  </div>
                </div>

                <div className="flex justify-center transition-all duration-300">
                  {activePicker === 'START' ? (
                    <DateTimePicker
                      date={startDate}
                      time={startTime}
                      onChange={handleStartTimeChange}
                      lang={lang}
                      onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                    />
                  ) : (
                    <DateTimePicker
                      date={endDate}
                      time={endTime}
                      onChange={(d, t) => { setEndDate(d); setEndTime(t); }}
                      lang={lang}
                      onViewModeChange={(mode) => setIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('limitApplicants')}</label>
                  <button
                    onClick={() => setUseLimit(!useLimit)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {useLimit && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('maxApplicants')}</label>
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-2xl px-4 py-2">
                      <button onClick={() => setMaxApplicants(Math.max(2, maxApplicants - 1))} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400"><MinusIcon /></button>
                      <span className="flex-1 text-center font-black dark:text-white text-sm">{t('peopleCount', maxApplicants)}</span>
                      <button onClick={() => setMaxApplicants(maxApplicants + 1)} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400"><PlusIcon /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* 등급 체계 선택 섹션 */}
              <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('tierMode')}</label>
                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                    <button
                      onClick={() => setTierMode('5TIER')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${tierMode === '5TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode5')}
                    </button>
                    <button
                      onClick={() => setTierMode('3TIER')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${tierMode === '3TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode3')}
                    </button>
                  </div>
                </div>
                {tierMode === '3TIER' && (
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 px-1 italic">
                    ※ {t('tierModeDesc')}
                  </p>
                )}
              </div>

              {!isPickerSelectionMode && (
                <div className="flex justify-end mt-2">
                  <button onClick={handleCreate} disabled={loading} className="w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95">{loading ? '...' : t('create')}</button>
                </div>
              )}
            </div>
          ) : (
            null
          )}
        </div>
      </div>
    </div >
  );
};

// 참가 신청 모달
const ApplyRoomModal: React.FC<{
  isOpen: boolean;
  roomId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  lang: Language;
  darkMode: boolean;
}> = ({ isOpen, roomId, onClose, onSuccess, lang, darkMode }) => {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<string>('B');
  const [pos, setPos] = useState<string>('MF');
  const [room, setRoom] = useState<RecruitmentRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };
  useEffect(() => { if (roomId && isOpen) getRoomInfo(roomId).then(setRoom); }, [roomId, isOpen]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!roomId || !name) return;
    setLoading(true);
    try { await applyForParticipation(roomId, { name, tier, position: pos }); onSuccess(); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  if (!isOpen || !room) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 space-y-6">
        <div className="text-center space-y-2"><h3 className="text-xl font-black text-slate-900 dark:text-white">{t('applyTitle', room.sport)}</h3><p className="text-blue-500 font-bold text-sm">{room.matchDate} {room.matchTime}</p></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('inputNamePlaceholder')} className="w-full bg-slate-50 dark:bg-slate-950 rounded-2xl px-5 py-4 dark:text-white font-bold" />
          <div className="grid grid-cols-5 gap-1.5">
            {(room.tierMode === '3TIER' ? ['S', 'A', 'B'] : ['S', 'A', 'B', 'C', 'D']).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setTier(v)}
                className={`py-3 rounded-xl font-black text-xs ${tier === v ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 border-2 border-slate-900 dark:border-slate-200' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-2 border-transparent'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white font-black rounded-3xl mt-4 shadow-xl shadow-blue-500/20">{loading ? '...' : t('completeApplication')}</button>
          <button type="button" onClick={onClose} className="w-full py-3 text-slate-400 font-bold text-sm">{t('cancel')}</button>
        </form>
      </div>
    </div>
  );
};

enum BottomTabType {
  HOME = 'HOME',
  MEMBERS = 'MEMBERS',
  SETTINGS = 'SETTINGS'
}

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(getInitialLang());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [activeTab, setActiveTab] = useState<SportType>(() => {
    const saved = localStorage.getItem('last_active_tab');
    return (saved as SportType) || SportType.GENERAL;
  });
  const [currentBottomTab, setCurrentBottomTab] = useState<BottomTabType>(BottomTabType.HOME);
  const changeTab = (tab: SportType) => {
    setActiveTab(tab);
    setResult(null);
    setShowRoomDetail(false);
    localStorage.setItem('last_active_tab', tab);
  };
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<Tier>(Tier.B);
  const [newP1s, setNewP1s] = useState<Position[]>([]);
  const [newP2s, setNewP2s] = useState<Position[]>([]);
  const [newP3s, setNewP3s] = useState<Position[]>([]);
  const [newForbidden, setNewForbidden] = useState<Position[]>([]);
  const [teamCount, setTeamCount] = useState(2);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [pastResults, setPastResults] = useState<Set<string>>(new Set()); // 이력 관리
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
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [selectionMode, setSelectionMode] = useState<'MATCH' | 'SPLIT' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [teamConstraints, setTeamConstraints] = useState<TeamConstraint[]>(() => {
    const saved = localStorage.getItem(`app_constraints`);
    return saved ? JSON.parse(saved) : [];
  });

  const [useTeamColors, setUseTeamColors] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedTeamColors, setSelectedTeamColors] = useState<string[]>(['#ef4444', '#3b82f6']);

  const activePlayers = useMemo(() => players.filter(p => p.isActive && p.sportType === activeTab), [players, activeTab]);
  const inactivePlayers = useMemo(() => {
    const currentPlayers = players.filter(p => p.sportType === activeTab);
    const inactive = currentPlayers.filter(p => !p.isActive);
    if (sortMode === 'name') {
      return [...inactive].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return [...inactive].sort((a, b) => {
        const tierA = isNaN(Number(a.tier)) ? (Tier as any)[a.tier] : Number(a.tier);
        const tierB = isNaN(Number(b.tier)) ? (Tier as any)[b.tier] : Number(b.tier);
        if (tierB !== tierA) return tierB - tierA;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  }, [players, activeTab, sortMode]);
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [editingResultTeamIdx, setEditingResultTeamIdx] = useState<number | null>(null);

  const [alertState, setAlertState] = useState<{ isOpen: boolean; title?: string; message: string }>({
    isOpen: false,
    message: '',
  });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title?: string; message: string; onConfirm: () => void; confirmText?: string; cancelText?: string }>({
    isOpen: false,
    message: '',
    onConfirm: () => { },
  });

  const showAlert = (message: string, title?: string) => {
    setAlertState({ isOpen: true, message, title });
  };


  const [isDataLoaded, setIsDataLoaded] = useState(false); // 초기 데이터 로드 완료 여부

  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('app_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [showRoomDetail, setShowRoomDetail] = useState(false);

  const [userNickname, setUserNickname] = useState(() => {
    const saved = localStorage.getItem('app_user_nickname');
    if (saved) return saved;
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newName = `${TRANSLATIONS[lang].guest}(${rand})`;
    localStorage.setItem('app_user_nickname', newName);
    return newName;
  });

  const [guestId, setGuestId] = useState(() => {
    const saved = localStorage.getItem('app_guest_id');
    if (saved) return saved;
    const newId = 'guest_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('app_guest_id', newId);
    return newId;
  });

  // 최종 유저 식별자 (로그인 정보가 있으면 id, 없으면 guestId)
  const currentUserId = user?.id || guestId;

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
  const [showLoginRecommendModal, setShowLoginRecommendModal] = useState(false);

  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);

  // 업데이트 관련 상태
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    message: string;
    forceUpdate: boolean;
    storeUrl: string;
  } | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      // 1. 현재 앱 버전 가져오기
      const info = await CapApp.getInfo();
      const currentVersion = info.version; // 예: "2.1.26"

      // 2. Remote Config 버전 정보 가져오기
      const remoteInfo = await checkAppVersion();

      if (remoteInfo) {
        // 3. 버전 비교 (Remote > Current 이면 업데이트 필요)
        if (compareVersions(remoteInfo.latestVersion, currentVersion) > 0) {
          const isAndroid = Capacitor.getPlatform() === 'android';
          setUpdateInfo({
            message: remoteInfo.updateMessage,
            forceUpdate: remoteInfo.forceUpdate,
            storeUrl: isAndroid ? remoteInfo.storeUrlAndroid : remoteInfo.storeUrlIos
          });
          setShowUpdateModal(true);
        }
      }
    };

    checkVersion();
  }, []); // 앱 시작 시 1회 실행

  const [isAdFree, setIsAdFree] = useState(() => localStorage.getItem('app_is_ad_free') === 'true');
  const isUnlimitedPos = true; // 항목 4: 전면 무료화
  const isPro = isAdFree;

  const [showTier, setShowTier] = useState(false); // 항목 2: 티어 숨기기/보이기
  const [activeRooms, setActiveRooms] = useState<RecruitmentRoom[]>([]); // 항목 7: 멀티 모임 관리
  const filteredRooms = useMemo(() => {
    return activeRooms.filter(r => {
      try {
        const [y, m, d] = r.matchDate.split('-').map(Number);
        const [hh, mm] = r.matchTime.split(':').map(Number);
        const matchTime = new Date(y, m - 1, d, hh, mm);
        // 필터링 완화: 경기 종료 후 24시간까지 보임
        const expiryLimit = new Date(matchTime.getTime() + 24 * 60 * 60 * 1000);
        return expiryLimit > new Date() && r.status !== 'DELETED';
      } catch { return true; }
    });
  }, [activeRooms]);

  const [currentActiveRoom, setCurrentActiveRoom] = useState<RecruitmentRoom | null>(null);

  const [pendingUpgradeType, setPendingUpgradeType] = useState<'AD_FREE' | 'FULL' | null>(null);

  // 섹션 펼치기/접기 상태
  const [isPlayerRegistrationOpen, setIsPlayerRegistrationOpen] = useState(false);
  const [isWaitingListOpen, setIsWaitingListOpen] = useState(false);
  const [isParticipatingListOpen, setIsParticipatingListOpen] = useState(true);

  // 일본어 폰트 적용
  useEffect(() => {
    if (lang === 'ja') {
      document.body.style.fontFamily = '"Pretendard JP Variable", "Pretendard JP", "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    } else {
      document.body.style.fontFamily = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
    }
  }, [lang]);

  // 마지막 탭 기억
  useEffect(() => {
    localStorage.setItem('last_active_tab', activeTab);
  }, [activeTab]);

  // 참가자 목록 동기화 (앱 -> 웹)
  useEffect(() => {
    if (!currentActiveRoom) return;

    const syncParticipants = async () => {
      try {
        const activeParticipants = players
          .filter(p => p.isActive && p.sportType === currentActiveRoom.sport)
          .map(p => ({
            name: p.name,
            tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
            isApproved: true // 앱에 있는 선수는 모두 승인된 것으로 간주
          }));

        const roomRef = doc(db, 'rooms', currentActiveRoom.id);
        await updateDoc(roomRef, { activeParticipants });
      } catch (error) {
        console.error('Failed to sync participants:', error);
      }
    };

    const timer = setTimeout(syncParticipants, 1000); // Debounce 1s
    return () => clearTimeout(timer);
  }, [players, currentActiveRoom]);

  const [isProcessing, setIsProcessing] = useState(false); // 결제/로그인 중복 클릭 방지

  const [showHostRoomModal, setShowHostRoomModal] = useState(false);
  const [showApplyRoomModal, setShowApplyRoomModal] = useState(false);
  const prevApplicantsCount = useRef<Record<string, number>>({});

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
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

        console.log('IAP Sync completed:', { hasAdFree });
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
        setIsDataLoaded(true);
      }).catch(() => {
        setIsDataLoaded(true);
      });
    } else {
      // 비로그인 상태면 로컬 데이터 로딩 useEffect에서 처리하므로 여기선 대기하거나 true 설정 (상황에 따라 다름)
      // 일단 로그인 체크 완료 의미로 사용
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

    const initLocalNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.requestPermissions();
        } catch (e) {
          console.error('LocalNotifications permissions failed', e);
        }
      }
    };
    initLocalNotifications();

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

  // 모집 방 실시간 동기화 (인원수 등)
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserRooms(currentUserId, (rooms) => {
      // 새 신청자 감지 및 인앱 알림
      rooms.forEach(room => {
        const prevCount = prevApplicantsCount.current[room.id];
        if (prevCount !== undefined && room.applicants.length > prevCount) {
          const newPlayer = room.applicants[room.applicants.length - 1];
          const msg = t('appliedMsg', newPlayer.name, room.applicants.length);
          // showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`); 
          // 상단바 알림으로 대체 (확인 버튼 필요 없게)
          if (Capacitor.isNativePlatform()) {
            LocalNotifications.schedule({
              notifications: [
                {
                  title: `[${room.title}] ${t('recruitParticipants')}`,
                  body: msg,
                  id: Math.floor(Math.random() * 1000000),
                  smallIcon: 'ic_stat_icon_config_sample', // 안드로이드 아이콘 설정 필요할 수 있음
                  sound: 'default',
                }
              ]
            }).catch(e => console.error('Local Notification failed', e));
          } else {
            showAlert(msg, `[${room.title}] ${t('recruitParticipants')}`);
          }
        }
        prevApplicantsCount.current[room.id] = room.applicants.length;
      });

      setActiveRooms(rooms);

      // 1계정 1방 정책: 마지막으로 보던 방 기억
      if (rooms.length > 0) {
        const savedRoomId = localStorage.getItem('last_active_room_id');
        let targetRoom: RecruitmentRoom | null = null;

        // 1. 현재 선택된 상태에서 목록 동기화 (기존 선택 유지)
        setCurrentActiveRoom(prev => {
          const stillExists = rooms.find(r => r.id === prev?.id);
          if (stillExists) {
            targetRoom = stillExists;
            return stillExists;
          }
          const savedRoom = rooms.find(r => r.id === savedRoomId);
          if (savedRoom) {
            targetRoom = savedRoom;
            return savedRoom;
          }
          targetRoom = rooms[0];
          return rooms[0];
        });

        // 활성 방이 결정되면 해당 종목 탭으로 자동 전환 (UX 개선)
        if (targetRoom) {
          const room = targetRoom as RecruitmentRoom;
          setActiveTab(room.sport as SportType);
        }
      } else {
        setCurrentActiveRoom(null);
      }
    });

    return () => unsubscribe();
  }, [currentUserId]); // currentActiveRoom?.id 의존성 제거 (불필요한 재구독 방지)


  useEffect(() => {
    if (currentActiveRoom) {
      localStorage.setItem('last_active_room_id', currentActiveRoom.id);
    }
  }, [currentActiveRoom]);

  // V3.0 푸시 알림 및 딥링크 초기화
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }
      } catch (e) {
        console.error('Push init failed', e);
      }
    };

    const addPushListeners = () => {
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token: ' + token.value);
        localStorage.setItem('fcm_token', token.value);
        // 특정 활성 방이 있다면 토큰 업데이트
        if (currentActiveRoom?.id) {
          updateRoomFcmToken(currentActiveRoom.id, token.value);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
        // 인앱 팝업 알림
        if (notification.body) {
          setAlertState({
            isOpen: true,
            message: notification.body,
            title: notification.title || t('appTitle')
          });
        }
      });
    };

    const addDeepLinkListener = () => {
      CapApp.addListener('appUrlOpen', (data) => {
        try {
          console.log('App opened with URL:', data.url);
          // balanceteam://join?room=ABC 형태 처리
          if (data.url.includes('room=')) {
            const url = new URL(data.url);
            const roomId = url.searchParams.get('room');
            if (roomId) {
              setPendingJoinRoomId(roomId);
            }
          }
        } catch (e) {
          console.error('Deep link parsing failed', e);
        }
      });
    };

    initPush();
    addPushListeners();
    addDeepLinkListener();

    return () => {
      PushNotifications.removeAllListeners();
      CapApp.removeAllListeners();
    };
  }, [currentActiveRoom?.id, lang]);

  // 뒤로 가기 버튼 핸들링
  useEffect(() => {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1순위: 알림/메시지 창 닫기
      if (alertState.isOpen) {
        setAlertState(prev => ({ ...prev, isOpen: false }));
        return;
      }

      // 2순위: 각종 모달형 팝업 닫기 (우선순위에 따라 배치)
      if (showRewardAd) { setShowRewardAd(false); return; }
      if (showLoginModal) { setShowLoginModal(false); return; }
      if (showLoginRecommendModal) { setShowLoginRecommendModal(false); return; }
      if (showUpgradeModal) { setShowUpgradeModal(false); return; }
      if (showLimitModal) { setShowLimitModal(false); return; }
      if (showReviewPrompt) { setShowReviewPrompt(false); return; }
      if (showInfoModal) { setShowInfoModal(false); return; }
      if (showApplyRoomModal) { setShowApplyRoomModal(false); return; }
      if (showHostRoomModal) { setShowHostRoomModal(false); return; }

      // 3순위: 화면 내 모드/설정 창 닫기
      if (showColorPicker) { setShowColorPicker(false); return; }
      if (showQuotaSettings) { setShowQuotaSettings(false); return; }
      if (selectionMode !== null) { setSelectionMode(null); setSelectedPlayerIds([]); return; }

      // 4순위: 앱 종료
      // 웹 히스토리가 있다면 뒤로가기를 시도하고 싶을 수도 있지만, 
      // 현재 단일 페이지 앱(SPA) 구조이므로 바로 종료가 자연스러울 수 있음.
      // 만약 라우터 사용 시 history.goBack() 등을 고려해야 함.
      // 여기서는 즉시 종료 또는 사용자 확인 후 종료 처리.
      CapApp.exitApp();
    });

    return () => {
      // Remove specifically if possible or rely on global removeAllListeners in cleanup above if conflicts arise.
      // But typically safely adding/removing here is good practice.
      // Since removeAllListeners is called in another effect, we should be careful.
      // Let's just rely on the fact that this effect won't re-run often.
      // But to be safe, we don't remove all listeners here to avoid clearing Push/Url listeners.
      // CapApp.removeAllListeners(); // DON'T do this here if it clears others.
    };
  }, [
    alertState.isOpen,
    showRewardAd, showLoginModal, showLoginRecommendModal, showUpgradeModal, showLimitModal, showReviewPrompt,
    showInfoModal, showApplyRoomModal, showHostRoomModal,
    showColorPicker, showQuotaSettings, selectionMode
  ]);

  // 딥링크 진입 시 신청 모달 자동 오픈
  useEffect(() => {
    if (pendingJoinRoomId) {
      setShowApplyRoomModal(true);
    }
  }, [pendingJoinRoomId]);

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
    /* 결제 로직 임시 중단
    if (isProcessing) return;

    // 로그인이 안 되어 있다면 권장 팝업 표시
    if (!user) {
      setPendingUpgradeType(type);
      setShowLoginRecommendModal(true);
      return;
    }

    await executePurchase(type);
    */
    console.log('Purchase disabled temporarily');
  };

  const executePurchase = async (type: 'AD_FREE' | 'UNLIMITED_POS' | 'FULL') => {
    /* 결제 실행 임시 중단
    setIsProcessing(true);
    try {
      let productId: string = '';
      if (type === 'AD_FREE') productId = PRODUCT_IDS.AD_FREE;
      else if (type === 'UNLIMITED_POS') productId = PRODUCT_IDS.UNLIMITED_POS;
      else if (type === 'FULL') productId = PRODUCT_IDS.FULL_PACK;

      console.log('Starting purchase for:', productId);
      const success = await paymentService.purchase(productId as any);

      if (success) {
        if (type === 'AD_FREE' || type === 'FULL') {
          setIsAdFree(true);
          localStorage.setItem('app_is_ad_free', 'true');
        }

        setShowLimitModal(false);
        setShowUpgradeModal(false);
        setShowLoginRecommendModal(false);
        showAlert(t('upgradeSuccessMsg'), t('upgradeSuccessTitle'));
      } else {
        // 결제 실패 또는 취소 시 알림 (무반응 해결)
        // showAlert(t('restoreFailed' as any), t('validationErrorTitle')); 
        // -> 보통 취소는 무시하지만 오류일 수 있으므로 로그를 남기거나 간단한 알림이 필요할 수 있음
        console.log('Purchase failed or cancelled');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      showAlert(t('restoreFailed' as any), t('validationErrorTitle'));
    } finally {
      setIsProcessing(false);
    }
    */
  };



  const handleRestorePurchases = async () => {
    /* 복구 로직 임시 중단
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
    */
  };

  const handleGoogleLogin = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const googleUser = await GoogleAuth.signIn();
      console.log('Google User:', googleUser);
      setUser(googleUser);
      localStorage.setItem('app_user', JSON.stringify(googleUser));

      // 로그인 성공 시 닉네임을 구글 이름으로 자동 설정 (기존 닉네임이 게스트일 경우에만)
      if (userNickname.startsWith(TRANSLATIONS[lang].guest)) {
        setUserNickname(googleUser.givenName);
        localStorage.setItem('app_user_nickname', googleUser.givenName);
      }

      setShowLoginModal(false);
      showAlert(t('welcomeMsg', googleUser.givenName), t('loginSuccessMsg'));

      // 클라우드에서 데이터 가져오기
      setIsDataLoaded(false); // 로드 시작 전 플래그 리셋
      const cloudPlayers = await loadPlayersFromCloud(googleUser.id);

      setPlayers(prev => {
        const sampleIdPattern = /^(ko|en|pt|es|ja)_/;
        // 현재 로컬 선수들 중 샘플이 아닌 실제 추가된 선수들만 필터링
        const actualLocalPlayers = prev.filter(p => !sampleIdPattern.test(p.id));

        if (!cloudPlayers || cloudPlayers.length === 0) {
          // 클라우드에 데이터가 없으면 현재 로컬의 실제 데이터만 유지 (샘플 제거 효과)
          return actualLocalPlayers.length > 0 ? actualLocalPlayers : prev;
        }

        // 병합: 클라우드 데이터를 기본으로 하되, 로컬에만 있는 새로운 선수를 추가 (이름 기준)
        const merged = [...cloudPlayers];
        actualLocalPlayers.forEach(lp => {
          const isDuplicate = merged.some(cp => cp.name === lp.name);
          if (!isDuplicate) {
            merged.push(lp);
          }
        });

        return merged;
      });
      setIsDataLoaded(true);
    } catch (e: any) {
      console.error('Login failed', e);
      if (e.error !== 'user_cancelled') {
        showAlert(`Login failed: ${e.message || 'Unknown error'}`, 'Error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await GoogleAuth.signOut();
    } catch (e) {
      console.error('Sign out error', e);
    }

    setUser(null);
    localStorage.removeItem('app_user');

    // 닉네임 초기화 (게스트로 복구)
    const rand = Math.floor(1000 + Math.random() * 9000);
    const newGuestName = `${TRANSLATIONS[lang].guest}(${rand})`;
    setUserNickname(newGuestName);
    localStorage.setItem('app_user_nickname', newGuestName);

    // 명단 데이터 샘플로 초기화
    setIsDataLoaded(false);
    setPlayers(SAMPLE_PLAYERS_BY_LANG[lang] || []);
    localStorage.removeItem(STORAGE_KEY);
    setIsDataLoaded(true);

    showAlert(t('logoutMsg'), t('logoutTitle'));
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


  useEffect(() => {
    const SAMPLE_DATA_VERSION = 'v3';
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
      setIsDataLoaded(true);
    }
  }, []); // 마운트 시 1회만 실행하여 유저 데이터 보존

  // useEffect(() => {localStorage.setItem('app_lang', lang); }, [lang]); // 더 이상 매번 저장하지 않음
  useEffect(() => { localStorage.setItem('app_dark_mode', darkMode.toString()); if (darkMode) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }, [darkMode]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem(`app_constraints`, JSON.stringify(teamConstraints)); }, [teamConstraints]);

  // 선수 데이터가 변경될 때마다 클라우드에 자동 저장 (로그인 시 무료)
  useEffect(() => {
    if (isDataLoaded && user?.id && players.length > 0) {
      savePlayersToCloud(user.id, players);
    }
  }, [players, user, isDataLoaded]);

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

  // 참가자 구성이 바뀌면 이력 초기화 (새로운 조합 가능)
  useEffect(() => {
    setPastResults(new Set());
  }, [players]);

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

  /* 팀 생성 및 참가 선수 목록 렌더링 함수 */
  const renderTeamGenerationSection = () => {
    return (
      <div className="space-y-6">
        <section id="participation-capture-section" className="bg-slate-50 dark:bg-slate-900 flex flex-col rounded-2xl overflow-hidden min-h-[100px]">
          <div className="p-4 border-b border-transparent flex justify-between items-center bg-transparent">
            <div className="flex items-center gap-2">
              <div className="text-emerald-500"><UserCheckIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('participantList' as any)} <span className="text-slate-900 dark:text-slate-100 font-normal ml-1">({activePlayers.length})</span></h2>
            </div>
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
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${unselectAllConfirm ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
            >
              {unselectAllConfirm ? t('confirmRetry' as any) : t('unselectAll' as any)}
            </button>
          </div>
          <div className="px-4 pb-2 flex gap-1.5">
            <button
              onClick={() => setShowTier(!showTier)}
              className={`px-3 py-1.5 rounded-xl border transition-all flex items-center justify-center text-[11px] font-black ${showTier ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'}`}
            >
              {showTier ? t('hideTier' as any) : t('showTier' as any)}
            </button>
            <button
              onClick={() => { setSelectionMode('MATCH'); setSelectedPlayerIds([]); }}
              className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-1.5 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
            >
              <div className="w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center text-[8px] font-black">M</div>
              {t('matchTeams' as any)}
            </button>
            <button
              onClick={() => { setSelectionMode('SPLIT'); setSelectedPlayerIds([]); }}
              className="flex-1 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 py-1.5 rounded-xl text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5"
            >
              <div className="w-4 h-4 rounded bg-rose-500 text-white flex items-center justify-center text-[8px] font-black">S</div>
              {t('splitTeams' as any)}
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
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
                  showTier={showTier}
                />
              ))
            }
          </div>
        </section>

        {/* 팀 생성기 */}
        <section className="bg-slate-950 dark:bg-white rounded-[2rem] p-8 flex flex-col items-center w-full gap-6 shadow-2xl">
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-white dark:text-slate-900">
              <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900"><ShuffleIcon /></div>
              <div>
                <p className="text-[10px] text-white/40 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-1">{t('teamGenerator')}</p>
                <p className="text-lg font-black">{t(activeTab.toLowerCase() as any)} • {t('playersParticipating', activePlayers.length)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto">
              <div className="flex items-center gap-3 w-full">
                <div className="flex items-center gap-3 bg-white/5 dark:bg-slate-50 h-14 px-5 rounded-2xl border border-white/10 dark:border-slate-200 flex-1 group">
                  <span className="text-[11px] font-black text-white/40 dark:text-slate-400 uppercase tracking-widest">{t('teamCountLabel')}</span>
                  <select
                    value={teamCount}
                    onChange={e => setTeamCount(Number(e.target.value))}
                    className="bg-transparent text-white dark:text-slate-900 font-black text-sm focus:outline-none flex-1 appearance-none text-right outline-none"
                  >
                    {[2, 3, 4, 5, 6].map(num => (<option key={num} value={num} className="bg-slate-900 dark:bg-white">{num}</option>))}
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={activePlayers.length < teamCount || isGenerating}
                  className="px-10 h-14 bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-black rounded-2xl transition-all active:scale-95 text-sm shadow-xl shadow-white/5 disabled:opacity-30 disabled:pointer-events-none"
                >
                  {t('generateTeams')}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full border-t border-white/5 dark:border-slate-100 pt-6">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${useTeamColors ? 'bg-white border-white dark:bg-slate-900 dark:border-slate-900 text-slate-950 dark:text-white' : 'border-white/10 dark:border-slate-200'}`}>
                  {useTeamColors && <CheckIcon />}
                </div>
                <input type="checkbox" className="hidden" checked={useTeamColors} onChange={e => { setUseTeamColors(e.target.checked); if (e.target.checked) setShowColorPicker(true); }} />
                <span className="text-[11px] font-black text-white/40 dark:text-slate-400 group-hover:text-white dark:group-hover:text-slate-900 tracking-widest uppercase">{t('useTeamColorsLabel')}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-rose-500 border-rose-500 text-white' : 'border-white/10 dark:border-slate-200'}`}>
                  {useRandomMix && <CheckIcon />}
                </div>
                <input type="checkbox" className="hidden" checked={useRandomMix} onChange={e => setUseRandomMix(e.target.checked)} />
                <span className="text-[11px] font-black text-white/40 dark:text-slate-400 group-hover:text-rose-500 tracking-widest uppercase">{t('randomMix')}</span>
              </label>
            </div>
          </div>
        </section>
      </div>
    );
  };

  /* 회원목록 탭 전용 렌더링 함수 */
  const renderMembersTabContent = () => {
    return (
      <div className="space-y-8 pb-32">
        {/* 선수 등록 */}
        <section className="bg-slate-50 dark:bg-slate-900 w-full rounded-2xl overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none"
            onClick={() => setIsPlayerRegistrationOpen(!isPlayerRegistrationOpen)}
          >
            <div className="flex items-center gap-2">
              <div className="text-slate-400 dark:text-slate-500"><PlusIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('playerRegistration')}</h2>
              <div className={`transition-transform duration-300 ${isPlayerRegistrationOpen ? 'rotate-180' : ''} text-slate-400 ml-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
          </div>
          {isPlayerRegistrationOpen && (
            <form onSubmit={addPlayer} className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
          )}
        </section>

        {/* 회원 목록 및 참가 목록 */}
        <div className="grid grid-cols-1 gap-6 items-start">
          <section className="bg-slate-50 dark:bg-slate-900 flex flex-col rounded-2xl overflow-hidden min-h-[100px]">
            <div className="p-4 border-b border-transparent flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('memberList' as any)} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({inactivePlayers.length})</span></h2>
              </div>
              <div className="flex items-center gap-2">
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
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
              {inactivePlayers.length === 0 ? (
                <div className="col-span-full py-6 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>
              ) : (
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
                    showTier={showTier}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    );
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

  // --- 통합 모집 관리 로직 ---
  const handleApproveApplicant = async (room: RecruitmentRoom, applicant: Applicant) => {
    try {
      const updatedApplicants = room.applicants.map(a =>
        a.id === applicant.id ? { ...a, isApproved: true } : a
      );
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });

      const p1 = (applicant as any).primaryPositions || [applicant.position || 'NONE'];
      const s1 = (applicant as any).secondaryPositions || [];
      const t1 = (applicant as any).tertiaryPositions || [];
      const f1 = (applicant as any).forbiddenPositions || [];

      setPlayers(prev => {
        const existingIdx = prev.findIndex(p => p.name === applicant.name);
        if (existingIdx > -1) {
          // 이름이 같은 선수가 있는 경우: 티어와 포지션을 최신 신청 정보로 업데이트하고 참가 상태로 만듦
          const newList = [...prev];
          newList[existingIdx] = {
            ...newList[existingIdx],
            tier: (Tier as any)[applicant.tier] || Tier.B,
            isActive: true,
            sportType: room.sport as SportType,
            primaryPosition: p1[0] || 'NONE',
            primaryPositions: p1,
            secondaryPosition: s1[0] || 'NONE',
            secondaryPositions: s1,
            tertiaryPositions: t1,
            forbiddenPositions: f1
          };
          return newList;
        }

        // 명단에 없는 경우 새로 추가
        const newPlayer: Player = {
          id: 'p_' + Math.random().toString(36).substr(2, 9),
          name: applicant.name,
          tier: (Tier as any)[applicant.tier] || Tier.B,
          isActive: true,
          sportType: room.sport as SportType,
          primaryPosition: p1[0] || 'NONE',
          primaryPositions: p1,
          secondaryPosition: s1[0] || 'NONE',
          secondaryPositions: s1,
          tertiaryPositions: t1,
          forbiddenPositions: f1
        };
        return [...prev, newPlayer];
      });
    } catch (e) {
      console.error("Approval Error:", e);
    }
  };

  const handleApproveAllApplicants = async (room: RecruitmentRoom) => {
    try {
      const updatedApplicants = room.applicants.map(a => ({ ...a, isApproved: true }));
      await updateDoc(doc(db, 'rooms', room.id), { applicants: updatedApplicants });

      setPlayers(prev => {
        const newList = [...prev];
        room.applicants.filter(a => !a.isApproved).forEach(a => {
          const existingIdx = newList.findIndex(p => p.name === a.name);
          const p1 = (a as any).primaryPositions || [a.position || 'NONE'];
          const s1 = (a as any).secondaryPositions || [];
          const t1 = (a as any).tertiaryPositions || [];
          const f1 = (a as any).forbiddenPositions || [];

          if (existingIdx > -1) {
            // 이름이 같은 선수가 있는 경우 최신 정보로 업데이트
            newList[existingIdx] = {
              ...newList[existingIdx],
              tier: (Tier as any)[a.tier] || Tier.B,
              isActive: true,
              sportType: room.sport as SportType,
              primaryPosition: p1[0] || 'NONE',
              primaryPositions: p1,
              secondaryPosition: s1[0] || 'NONE',
              secondaryPositions: s1,
              tertiaryPositions: t1,
              forbiddenPositions: f1
            };
          } else {
            // 명단에 없는 경우 새로 추가
            newList.push({
              id: 'p_' + Math.random().toString(36).substr(2, 9),
              name: a.name,
              tier: (Tier as any)[a.tier] || Tier.B,
              isActive: true,
              sportType: room.sport as SportType,
              primaryPosition: p1[0] || 'NONE',
              primaryPositions: p1,
              secondaryPosition: s1[0] || 'NONE',
              secondaryPositions: s1,
              tertiaryPositions: t1,
              forbiddenPositions: f1
            });
          }
        });
        return newList;
      });
    } catch (e) {
      console.error("Approve All Error:", e);
    }
  };

  const handleShareRecruitLink = async (room: RecruitmentRoom) => {
    // 실제 배포된 도메인 주소
    const DEPLOYED_HOSTING_URL = "https://belo-apply.web.app";
    // 항상 운영 주소를 사용하도록 고정
    const webUrl = `${DEPLOYED_HOSTING_URL}/index.html?room=${room.id}&lang=${lang}`;

    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: t('shareRecruitLink'),
            text: `[${room.title}] ${room.matchDate} ${room.matchTime} ${t(room.sport.toLowerCase() as any)} 참여자를 모집합니다!\n\n👇 참가하기 👇\n${webUrl}`,
            dialogTitle: t('shareRecruitLink'),
          });
        } catch (shareError) {
          await Clipboard.write({ string: webUrl });
        }
      } else {
        await Clipboard.write({ string: webUrl });
      }
    } catch (e) {
      console.error("Share Link Error:", e);
    }
  };

  const handleCloseRecruitRoom = (room: RecruitmentRoom) => {
    setConfirmState({
      isOpen: true,
      title: t('deleteRoomTitle' as any), // 번역 키 필요
      message: t('confirm_delete_room' as any),
      confirmText: t('delete' as any),
      onConfirm: async () => {
        try {
          setShowHostRoomModal(false); // 강제로 모달 닫기
          await updateDoc(doc(db, 'rooms', room.id), { status: 'DELETED' });
          setActiveRooms(prev => prev.filter(r => r.id !== room.id));
          setCurrentActiveRoom(null);
        } catch (e) {
          console.error("Delete Room Error:", e);
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleGenerate = async () => {
    const participating = players.filter(p => p.isActive && p.sportType === activeTab);
    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    // 포지션 인원 설정이 하나라도 있는지 확인 (있으면 고급 기능 사용)
    const isAdvanced = Object.values(quotas).some(v => v !== null);

    // 항목 4: 포지션 인원 설정 유료 제한 삭제 (X)

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
      const res = generateBalancedTeams(participating, teamCount, quotas, activeConstraints, useRandomMix, Array.from(pastResults));

      setResult(res);

      // 개별 팀 해시 저장 (중복 방지용)
      setPastResults(prev => {
        const next = new Set(prev);
        res.teams.forEach(t => {
          const teamHash = t.players.map(p => p.id).sort().join(',');
          next.add(teamHash);
        });
        return next;
      });

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
          font-family: ${lang === 'ja' ? '"Pretendard JP Variable", "Pretendard JP"' : '"Pretendard Variable", Pretendard'}, sans-serif !important;
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


  // activePlayers, inactivePlayers는 이제 상단에서 useMemo로 관리됨

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
  const handleUpdateResultTeamColor = (idx: number, colorValue: string, colorName: string) => {
    if (!result) return;
    const nextResult = { ...result };
    const nextTeams = [...nextResult.teams];
    nextTeams[idx] = { ...nextTeams[idx], color: colorValue, colorName: colorName };
    nextResult.teams = nextTeams;
    setResult(nextResult);
    setEditingResultTeamIdx(null);
  };

  const expectedPerTeam = activePlayers.length > 0 ? Math.floor(activePlayers.length / teamCount) : 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'} font-sans p-0 flex flex-col items-center`}
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)))'
      }}>
      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isPro={isPro} />}

      <header className="w-full flex flex-col items-center mb-0">
        <div className="w-full flex justify-between items-center mb-1 bg-white dark:bg-slate-950 p-1.5">
          <div className="flex gap-2">
            {/* 광고 제거 버튼 주석 처리
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 group relative ${isPro
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30'}`}
            >
              <div className="relative">
                <span className={`text-sm block transition-transform group-active:scale-90 ${isPro ? 'animate-pulse' : ''}`}>
                  {isPro ? '✨' : '💎'}
                </span>
                {!isPro && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white dark:border-slate-950" />
                )}
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">
                {isPro ? 'PRO' : t('removeAds' as any)}
              </span>
            </button>
            */}
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
              onClick={() => setShowGuideModal(true)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Show app Help"
            >
              <HelpCircleIcon />
            </button>
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
              aria-label="Show app Info"
            >
              <InfoIcon />
            </button>
          </div>
        </div>
      </header>

      <nav className="flex gap-1.5 bg-white dark:bg-slate-950 p-1.5 mb-3 w-full">
        {(Object.entries(SportType) as [string, SportType][]).map(([key, value]) => (
          <button key={value} onClick={() => {
            setActiveTab(value);
            setResult(null);
            setEditingPlayerId(null);
            AnalyticsService.logEvent('tab_change', { sport: value });
          }} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === value ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}>
            {t(value.toLowerCase() as any)}
          </button>
        ))}
      </nav>

      {currentBottomTab === BottomTabType.HOME && (
        <section className="w-full px-4 mb-5" data-capture-ignore="true">
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('recruitParticipants')}</h3>
          </div>
          <div className="space-y-4">
            {filteredRooms.length === 0 ? (
              <button
                onClick={() => { setCurrentActiveRoom(null); setShowHostRoomModal(true); }}
                className="w-full aspect-[2/1] min-h-[160px] rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group"
              >
                <div className="w-16 h-16 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl group-hover:scale-110 transition-transform">
                  <PlusIcon />
                </div>
                <p className="text-sm font-black text-slate-400 dark:text-slate-500">{t('noScheduledMatch' as any)}</p>
              </button>
            ) : (
              (() => {
                const room = filteredRooms[0];
                const pendingApplicants = room.applicants.filter(a => !a.isApproved);

                if (!showRoomDetail) {
                  return (
                    <button
                      onClick={() => setShowRoomDetail(true)}
                      className={`w-full rounded-3xl py-6 px-8 shadow-2xl border transition-all text-left flex items-center justify-between animate-in zoom-in-95 duration-300 ${currentActiveRoom?.id === room.id ? 'bg-blue-600 border-blue-500 shadow-blue-500/20 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'}`}
                    >
                      <div className="flex flex-col gap-2 overflow-hidden flex-1 mr-4">
                        <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentActiveRoom?.id === room.id ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>{room.title}</p>
                        <p className="text-2xl font-black truncate">{room.matchDate} {room.matchTime}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`px-2 py-0.5 rounded text-[9px] font-bold border ${currentActiveRoom?.id === room.id ? 'bg-blue-500/30 border-blue-400/30 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}>
                            {t('clickForDetail' as any)}
                          </div>
                          {pendingApplicants.length > 0 && (
                            <div className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black animate-pulse">
                              NEW {pendingApplicants.length}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 border-l border-white/20 dark:border-slate-800 pl-6">
                        <div className="flex flex-col items-end">
                          <span className="text-4xl font-black leading-none tracking-tighter">
                            {players.filter(p => p.isActive && p.sportType === room.sport).length}
                          </span>
                          <span className="text-[11px] font-black opacity-60 mt-1">
                            / {room.maxApplicants > 0 ? `${room.maxApplicants}${t('peopleSuffix')}` : t('unlimited')}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }

                return (
                  <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
                    {/* 상세 화면 상단 바 */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
                      <button onClick={() => setShowRoomDetail(false)} className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                      </button>
                      <h2 className="text-base font-black text-slate-900 dark:text-white">{t('manageMatchDetail' as any)}</h2>
                      <div className="w-10" /> {/* 밸런스용 */}
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-40">
                      {/* 카드 요약 정보 (상세 화면 내) */}
                      <div className={`w-full rounded-3xl py-5 px-6 shadow-lg border ${currentActiveRoom?.id === room.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${currentActiveRoom?.id === room.id ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'} mb-1`}>{room.title}</p>
                        <p className="text-xl font-black">{room.matchDate} {room.matchTime}</p>
                      </div>

                      {/* 공유 버튼 */}
                      <button
                        onClick={() => handleShareRecruitLink(room)}
                        className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
                      >
                        <ShareIcon />
                        {t('shareRecruitLink' as any)}
                      </button>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button
                          onClick={() => handleApproveAllApplicants(room)}
                          disabled={pendingApplicants.length === 0}
                          className={`py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border-2 transition-all ${pendingApplicants.length > 0 ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400' : 'border-slate-100 text-slate-300 dark:border-slate-700 opacity-50'}`}
                        >
                          <UserCheckIcon />
                          {t('approveAll' as any)}
                          {pendingApplicants.length > 0 && <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">{pendingApplicants.length}</span>}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseRecruitRoom(room);
                            setShowRoomDetail(false);
                          }}
                          className="py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 dark:hover:bg-rose-950/20 dark:hover:border-rose-900/30 transition-all"
                        >
                          <TrashIcon />
                          {t('deleteRoomTitle' as any)}
                        </button>
                      </div>

                      {pendingApplicants.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-2 mb-1 px-1">
                              <div className="w-1 h-3 bg-blue-600 rounded-full" />
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('pendingApplicants' as any)}</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 max-h-none overflow-visible">
                              {pendingApplicants.map(app => {
                                const tierVal = isNaN(Number(app.tier)) ? (Tier as any)[app.tier] : Number(app.tier);
                                const tierLabel = isNaN(Number(app.tier)) ? app.tier : (Tier as any)[Number(app.tier)];

                                return (
                                  <div key={app.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]} pt-1 shrink-0`}>
                                          {tierLabel}
                                        </span>
                                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">{app.name}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                      <button onClick={() => cancelApplication(room.id, app)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><TrashIcon /></button>
                                      <button onClick={() => handleApproveApplicant(room, app)} className="bg-blue-600 text-white text-[10px] font-black px-3 py-2 rounded-lg active:scale-95 transition-all whitespace-nowrap">{t('approve' as any)}</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 명단 관리 및 팀 생성 섹션 - 상세 화면 복원 */}
                      <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                        {renderTeamGenerationSection()}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </section>
      )}

      {/* 회원목록 탭 내용 */}
      {currentBottomTab === BottomTabType.MEMBERS && (
        <div className="w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('memberList' as any)}</h3>
          </div>
          {renderMembersTabContent()}
        </div>
      )}

      {/* 설정 탭 (추후 구현) */}
      {currentBottomTab === BottomTabType.SETTINGS && (
        <div className="w-full px-4 py-20 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
            <SettingsIcon />
          </div>
          <p className="text-sm font-bold text-slate-400">{t('comingSoon')}</p>
        </div>
      )}

      {result && (
        <div id="results-capture-section" className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
            <div data-capture-ignore="true" className="flex gap-2">
              <button
                onClick={() => setResult(null)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-300 transition-all"
              >
                {t('backToRoster')}
              </button>
              <button
                onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                disabled={!!isSharing}
                className="bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2"
              >
                {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
              </button>
            </div>
          </div>

          <div className={`backdrop-blur-sm ${darkMode ? 'bg-slate-900/80 text-slate-100' : 'bg-slate-100/80 text-slate-900'} rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 w-full`}>
            <div className="flex flex-col">
              <span className={`text-[9px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-1`}>{t('standardDeviation')}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono">{result.standardDeviation.toFixed(2)}</span>
                <span className="text-[9px] opacity-40 italic">({t('lowerFairer')})</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-48">
            {result.teams.map((team, idx) => (
              <div key={team.id} className="bg-slate-50 dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="bg-white dark:bg-slate-950 p-5 flex items-center justify-between" style={{ borderTop: team.color ? `6px solid ${team.color}` : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg bg-slate-100 dark:bg-slate-800"
                      style={team.color ? { backgroundColor: team.color, color: (team.color === '#ffffff' || team.color === '#eab308') ? '#0f172a' : 'white', border: team.color === '#ffffff' ? '1px solid #e2e8f0' : 'none' } : { backgroundColor: darkMode ? '#e2e8f0' : '#0f172a', color: darkMode ? '#0f172a' : 'white' }}
                      onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                      data-capture-ignore="true"
                    >
                      {idx + 1}
                    </div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase">{team.colorName ? t('teamNameWithColor', t(team.colorName as any)) : `TEAM ${idx + 1}`}</h4>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">{t('squadSum')}</span>
                    <span className="text-2xl font-black font-mono">{team.totalSkill}</span>
                  </div>
                </div>
                {/* 결과용 색상 피커 */}
                {editingResultTeamIdx === idx && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200" data-capture-ignore="true">
                    {TEAM_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => handleUpdateResultTeamColor(idx, color.value, color.name)}
                        className={`w-6 h-6 rounded-lg transition-all ring-offset-2 dark:ring-offset-slate-950 ${team.color === color.value ? 'ring-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
                        style={{ backgroundColor: color.value, border: color.value === '#ffffff' ? '1px solid #e2e8f0' : 'none' }}
                        title={t(color.name as any)}
                      />
                    ))}
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {getSortedTeamPlayers(team.players).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{p.name}</span>
                        {showTier && <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${TIER_COLORS[p.tier]}`}>{Tier[p.tier]}</span>}
                      </div>
                      {activeTab !== SportType.GENERAL && p.assignedPosition && <span className="text-[10px] font-black text-slate-400 uppercase">{p.assignedPosition}</span>}
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


      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        onUpgradeRequest={() => { setShowInfoModal(false); setShowUpgradeModal(true); }}
        onLogin={() => { setShowInfoModal(false); setShowLoginModal(true); }}
        onLogout={handleLogout}
        nickname={userNickname}
        onUpdateNickname={(name) => {
          setUserNickname(name);
          localStorage.setItem('app_user_nickname', name);
        }}
        onRestore={handleRestorePurchases}
        lang={lang}
        darkMode={darkMode}
        isAdFree={isAdFree}
        isUnlimitedPos={isUnlimitedPos}
        user={user}
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
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        lang={lang}
        darkMode={darkMode}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
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

      {/* 업그레이드 모달 주석 처리
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgradePro}
        isAdFree={isAdFree}
        isUnlimitedPos={isUnlimitedPos}
        lang={lang}
        darkMode={darkMode}
      />
      */}
      <LoginRecommendModal
        isOpen={showLoginRecommendModal}
        onLogin={() => {
          setShowLoginRecommendModal(false);
          handleGoogleLogin();
        }}
        onLater={() => {
          setShowLoginRecommendModal(false);
          if (pendingUpgradeType) {
            executePurchase(pendingUpgradeType);
          }
        }}
        lang={lang}
        darkMode={darkMode}
      />
      <HostRoomModal
        isOpen={showHostRoomModal}
        onClose={() => setShowHostRoomModal(false)}
        onRoomCreated={(room) => {
          setCurrentActiveRoom(room);
          setActiveRooms(prev => {
            const exists = prev.find(r => r.id === room.id);
            if (exists) return prev.map(r => r.id === room.id ? room : r);
            return [...prev, room];
          });
          setShowHostRoomModal(false);
          AnalyticsService.logEvent('recruit_room_created', { sport: room.sport });
        }}
        activeRoom={currentActiveRoom}
        activeRooms={activeRooms}
        activePlayerCount={players.filter(p => p.isActive && p.sportType === (currentActiveRoom?.sport || activeTab)).length}
        activeTab={activeTab}
        onCloseRoom={() => {
          if (currentActiveRoom) {
            setActiveRooms(prev => prev.filter(r => r.id !== currentActiveRoom.id));
          }
          setCurrentActiveRoom(null);
        }}
        onApproveAll={(approvedPlayers) => {
          setPlayers(prev => {
            const newList = [...prev];
            approvedPlayers.forEach(ap => {
              const existingIdx = newList.findIndex(p => p.name === ap.name);
              if (existingIdx > -1) {
                // 이름이 같은 선수가 있는 경우 최신 신청 정보로 업데이트하고 참가 상태로 만듦
                newList[existingIdx] = {
                  ...newList[existingIdx],
                  tier: ap.tier,
                  sportType: ap.sportType,
                  primaryPosition: ap.primaryPosition,
                  primaryPositions: ap.primaryPositions,
                  secondaryPosition: ap.secondaryPosition,
                  secondaryPositions: ap.secondaryPositions,
                  tertiaryPositions: ap.tertiaryPositions,
                  forbiddenPositions: ap.forbiddenPositions,
                  isActive: true
                };
              } else {
                // 새로운 이름이면 명단에 새로 추가
                newList.push(ap);
              }
            });
            return newList;
          });
        }}
        lang={lang}
        darkMode={darkMode}
        isPro={isPro}
        onUpgrade={() => { setShowHostRoomModal(false); setShowUpgradeModal(true); }}
        userNickname={userNickname}
        currentUserId={currentUserId}
      />
      <ApplyRoomModal
        isOpen={showApplyRoomModal}
        roomId={pendingJoinRoomId}
        onClose={() => {
          setShowApplyRoomModal(false);
          setPendingJoinRoomId(null);
        }}
        onSuccess={() => {
          setShowApplyRoomModal(false);
          setPendingJoinRoomId(null);
          // 팝업 알림 (t 함수 접근 문제 처리 필요시 showAlert 등 활용)
        }}
        lang={lang}
        darkMode={darkMode}
      />
      <GuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        title={t('guideTitle')}
        content={t('guideContent') || t('comingSoon')}
        darkMode={darkMode}
        lang={lang}
      />
      {
        updateInfo && (
          <UpdateModal
            isOpen={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            onUpdate={() => {
              if (updateInfo.storeUrl) {
                window.open(updateInfo.storeUrl, '_system');
              }
            }}
            message={updateInfo.message}
            forceUpdate={updateInfo.forceUpdate}
            lang={lang}
            darkMode={darkMode}
          />
        )
      }
      <div className="h-[160px]" />
      {/* Bottom Tab Bar (KakaoTalk Style) - Always visible at the bottom */}
      <div className="fixed left-0 right-0 bottom-0 z-[4000] bg-[#F9F9F9] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_10px_rgba(0,0,0,0.05)]"
        style={{
          height: 'calc(50px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div className="flex h-[50px] max-w-lg mx-auto">
          <button
            onClick={() => setCurrentBottomTab(BottomTabType.HOME)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <div className={currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
              <HomeIcon />
            </div>
            <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
              {t('homeTab' as any)}
            </span>
          </button>

          <button
            onClick={() => setCurrentBottomTab(BottomTabType.MEMBERS)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <div className={currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
              <Icons.UserPlusIcon />
            </div>
            <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.MEMBERS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
              {t('membersTab' as any)}
            </span>
          </button>

          <button
            onClick={() => setCurrentBottomTab(BottomTabType.SETTINGS)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
          >
            <div className={currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
              <SettingsIcon />
            </div>
            <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
              {t('settingsTab' as any)}
            </span>
          </button>
        </div>
      </div>

      {/* AdBanner placed above Bottom Tab Bar */}
      <AdBanner
        lang={lang}
        darkMode={darkMode}
        isAdFree={isAdFree}
        bottomOffset="calc(50px + env(safe-area-inset-bottom, 0px))"
      />
    </div >
  );
};

export default App;