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
  UserPlusIcon, UserPlusFilledIcon, UserCheckIcon, ShareIcon, SunIcon, MoonIcon,
  SlidersIcon, InfoIcon, GlobeIcon, ExternalLinkIcon, MoreIcon, MoreFilledIcon,
  SettingsIcon, SettingsFilledIcon, HeartIcon, RotateCcwIcon, CloseIcon, HelpCircleIcon, HomeIcon, HomeFilledIcon, ArrowLeftIcon, PlayIcon
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
            adId: 'ca-app-pub-3940256099942544/6300978111',
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: true
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

  return null;
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

const SPORT_IMAGES: Record<SportType, string[]> = {
  [SportType.SOCCER]: ['/images/soccer-1.jpeg', '/images/soccer-2.jpeg'],
  [SportType.FUTSAL]: ['/images/futsal-1.jpeg', '/images/futsal-2.jpeg'],
  [SportType.BASKETBALL]: ['/images/basketball-1.jpeg', '/images/basketball-2.jpeg'],
  [SportType.GENERAL]: ['/images/tennis-1.jpeg', '/images/tennis-2.jpeg'],
  [SportType.ALL]: ['/images/tennis-1.jpeg', '/images/tennis-2.jpeg']
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
      { id: 'ST', x: '50%', y: '18%' },
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
      { id: 'ST', x: '50%', y: '18%' },
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

      <div className="relative aspect-[3/4] w-full max-w-[280px] mx-auto rounded-3xl overflow-hidden">
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

        {/* Inner Court Container: Fixed the layout by removing redundant 'relative' */}
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

          {/* Position Menu Backdrop */}
          {activeMenuPos && (
            <div className="absolute inset-0 z-20" onClick={() => setActiveMenuPos(null)} />
          )}

          {/* Player Position Dots */}
          <div className="absolute inset-0 z-30">
            {positions.map((pos) => {
              const status = getStatus(pos.id);
              const isMenuOpen = activeMenuPos === pos.id;

              return (
                <div
                  key={pos.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex flex-col items-center justify-center transition-all ${isMenuOpen ? 'z-[100]' : 'z-30'}`}
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
                    className={`w-full h-full rounded-full transition-all duration-300 flex flex-col items-center justify-center gap-0.5 ${status.color} hover:scale-110 active:scale-95 shadow-md border border-white/30`}
                  >
                    <span className="text-[9px] font-black text-white drop-shadow-sm">{pos.id}</span>
                    {status.label && <span className="text-[8px] font-black text-white/90 leading-none">{status.label}</span>}
                  </button>
                </div>
              );
            })}
          </div>
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
    <div className={`fixed inset-0 z-[5000] flex flex-col items-center justify-center ${darkMode ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-xl animate-in duration-300`}>
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

const LoginPage: React.FC<{
  isOpen: boolean; onLater: () => void; onLogin: () => void; lang: Language; darkMode: boolean;
}> = ({ isOpen, onLater, onLogin, lang, darkMode }) => {
  const t = (key: keyof typeof TRANSLATIONS['ko']): string => (TRANSLATIONS[lang] as any)[key] || key;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-end bg-white dark:bg-slate-950 px-5" style={{ paddingBottom: '180px' }}>
      {/* 메인 콘텐츠 컨테이너 - 하단에서 60px 위에 배치 (광고배너 높이 약 60px 고려) */}
      <div className="flex flex-col items-center w-full max-w-sm">
        {/* 로고 + 타이틀 영역 */}
        <div className="flex flex-col items-center" style={{ marginBottom: '8vh' }}>
          {/* 로고 */}
          <img
            src="/assets/logo.png"
            alt="BELO Logo"
            style={{ width: '150px', height: '180px', objectFit: 'contain' }}
          />
          {/* 타이틀 */}
          <div className="text-center" style={{ marginTop: '-30px' }}>
            <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
              편하게, 공정하게, 재미있게
            </p>
            <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 mt-1" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
              BELO
            </p>
          </div>
        </div>

        {/* 설명 영역 */}
        <div className="w-full text-center" style={{ marginBottom: '4vh' }}>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
            로그인을 하면 선수 데이터와 설정을 모든 기기에서
            <br />
            안전하게 동기화 할 수 있습니다.
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="w-full flex flex-col items-center gap-4">
          {/* 구글로 로그인 버튼 */}
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
            style={{
              maxWidth: '295px',
              height: '56px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E5EC',
              borderRadius: '12px',
              boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
              fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              color: '#111111',
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            {t('googleLogin')}
          </button>

          {/* 다음에 하기 버튼 */}
          <button
            onClick={onLater}
            className="w-full flex items-center justify-center active:scale-[0.98] transition-transform"
            style={{
              maxWidth: '295px',
              height: '56px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E5EC',
              borderRadius: '12px',
              boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
              fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              color: '#777777',
            }}
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
    d.setHours(d.getHours() + 1, 0, 0, 0); // 현재+1시간 정각
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  // 종료 시간은 시작 시간 + 2시간 기본값
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0); // Start(+1h) + 2 hours = Current + 3h
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  const [activePicker, setActivePicker] = useState<'START' | 'END'>('START');

  const t = (key: keyof typeof TRANSLATIONS['ko'], ...args: any[]): string => {
    const translation = (TRANSLATIONS[lang] as any)[key];
    if (typeof translation === 'function') return (translation as (...args: any[]) => string)(...args);
    return String(translation || key);
  };

  const [selectedSport, setSelectedSport] = useState<SportType>(activeTab === SportType.ALL ? SportType.GENERAL : activeTab);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [useLimit, setUseLimit] = useState(false);
  const [maxApplicants, setMaxApplicants] = useState(12);
  const [tierMode, setTierMode] = useState<'5TIER' | '3TIER'>('5TIER');
  const [isPickerSelectionMode, setIsPickerSelectionMode] = useState(false);

  useEffect(() => {
    if (isOpen && !activeRoom) {
      // 모달이 열릴 때(새 방 생성 모드인 경우) 날짜와 시간을 현재 기준으로 리셋
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0); // 현재 시간+1의 정각

      const newStartDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const newStartTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      setStartDate(newStartDate);
      setStartTime(newStartTime);

      // 종료 시간은 시작 + 2시간
      const endD = new Date(d.getTime() + 2 * 60 * 60 * 1000); // 2 hours after start
      setEndDate(`${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`);
      setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);

      const initialSport = activeTab === SportType.ALL ? SportType.GENERAL : activeTab;
      setSelectedSport(initialSport);
      // 제목 자동 초기화 제거하여 플레이스홀더 노출 유도
      setTitle("");
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

    // 종료 시간 자동 계산 (시작 시간 + 2시간)
    const start = new Date(`${newDate}T${newTime}`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

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
        sport: selectedSport,
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
    <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
      {/* 상단 바 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 className="text-base font-black text-slate-900 dark:text-white">{activeRoom ? t('manageMatchDetail' as any) : t('recruitParticipants')}</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-[148px]">
        {!activeRoom ? (
          <div className="space-y-4">
            <div className="space-y-4">
              {/* 종목 선택 */}
              <div className="flex items-center gap-4">
                <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('sport' as any)}</label>
                <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                  {[SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSport(s);
                        // 종목 변경 시 제목 자동 입력 제거 (플레이스홀더 노출용)
                      }}
                      className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border shrink-0 ${selectedSport === s
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                        : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                        }`}
                    >
                      {t(s.toLowerCase() as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 팀명 입력 */}
              <div className="flex items-center gap-4">
                <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('inputRoomTitle')}
                  className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-[#777777] placeholder:font-semibold placeholder:text-[13px]"
                />
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* ... 일정 렌더링 유지 ... */}
                  <div
                    onClick={() => setActivePicker('START')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                  >
                    <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                    <span className={`text-[16px] font-black ${activePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                      {startDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(startDate).getDay()]}) {startTime}
                    </span>
                  </div>
                  <div className="text-slate-200 dark:text-slate-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <div
                    onClick={() => setActivePicker('END')}
                    className={`flex flex-col items-center cursor-pointer transition-all ${activePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                  >
                    <span className="text-[16px] font-black uppercase text-rose-500 mb-1">{t('endTime')}</span>
                    <span className={`text-[16px] font-black ${activePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
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
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-700" />

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('limitApplicants')}</label>
                  <button
                    onClick={() => setUseLimit(!useLimit)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {useLimit && (
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-2">
                    <button onClick={() => setMaxApplicants(Math.max(2, maxApplicants - 1))} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                    </button>
                    <span className="text-center font-black dark:text-white text-[12px] min-w-[40px]">{t('peopleCount', maxApplicants)}</span>
                    <button onClick={() => setMaxApplicants(maxApplicants + 1)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('tierMode')}</label>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setTierMode('5TIER')}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${tierMode === '5TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                  >
                    {t('tierMode5')}
                  </button>
                  <button
                    onClick={() => setTierMode('3TIER')}
                    className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${tierMode === '3TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                  >
                    {t('tierMode3')}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed">
                  💡 {tierMode === '3TIER' ? t('tierModeDesc') : t('tierMode5Desc' as any)}
                </p>
              </div>

              {/* 추가된 즉시 생성 버튼: 오른쪽 하단 정렬, 소형화 */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.95] shadow-md shadow-blue-500/20"
                >
                  {loading ? '...' : t('create' as any)}
                </button>
              </div>
            </div>

            {!isPickerSelectionMode && (
              <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-base rounded-3xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center"
                >
                  {loading ? '...' : t('completeRegistration' as any)}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
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

enum AppPageType {
  HOME = 'HOME',
  DETAIL = 'DETAIL',
  EDIT_ROOM = 'EDIT_ROOM',
  BALANCE = 'BALANCE'
}

enum DetailPageTab {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED'
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
  const [currentPage, setCurrentPage] = useState<AppPageType>(AppPageType.HOME);
  const [detailTab, setDetailTab] = useState<DetailPageTab>(DetailPageTab.PENDING);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [isNavigatingFromDetail, setIsNavigatingFromDetail] = useState<boolean>(false);
  const changeTab = (tab: SportType) => {
    setActiveTab(tab);
    setResult(null);
    setShowRoomDetail(false); // 기존 상태 유지(호환성)
    setCurrentPage(AppPageType.HOME);
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
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'name' | 'tier'>('name');

  const [quotas, setQuotas] = useState<Partial<Record<Position, number | null>>>({});
  const [showQuotaSettings, setShowQuotaSettings] = useState(false);
  const [isQuotaSettingsExpanded, setIsQuotaSettingsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdFree, setIsAdFree] = useState(() => localStorage.getItem('app_is_ad_free') === 'true');
  const [countdown, setCountdown] = useState(isAdFree ? 1 : 5);

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

  const activePlayers = useMemo(() => players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab)), [players, activeTab]);
  const memberPlayers = useMemo(() => {
    const currentPlayers = players.filter(p => activeTab === SportType.ALL || p.sportType === activeTab);
    if (sortMode === 'name') {
      return [...currentPlayers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    } else {
      return [...currentPlayers].sort((a, b) => {
        const tierA = isNaN(Number(a.tier)) ? (Tier as any)[a.tier] : Number(a.tier);
        const tierB = isNaN(Number(b.tier)) ? (Tier as any)[b.tier] : Number(b.tier);
        if (tierB !== tierA) return tierB - tierA;
        return a.name.localeCompare(b.name, 'ko');
      });
    }
  }, [players, activeTab, sortMode]);
  const [useRandomMix, setUseRandomMix] = useState(false);
  const [editingResultTeamIdx, setEditingResultTeamIdx] = useState<number | null>(null);
  const [lastGenContext, setLastGenContext] = useState<{ players: Player[]; sport?: SportType } | null>(null);

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

  const handleUpdateRoom = async () => {
    if (!currentActiveRoom) return;
    setIsProcessing(true);
    try {
      const roomRef = doc(db, 'rooms', currentActiveRoom.id);
      const updateData = {
        title: hostRoomTitle,
        sport: hostRoomSelectedSport,
        matchDate: hostRoomDate,
        matchTime: hostRoomTime,
        matchEndDate: hostRoomEndDate,
        matchEndTime: hostRoomEndTime,
        maxApplicants: hostRoomUseLimit ? hostRoomMaxApplicants : 0,
        tierMode: hostRoomTierMode
      };
      await updateDoc(roomRef, updateData);

      // 로컬 상태 즉시 갱신
      setCurrentActiveRoom(prev => prev ? {
        ...prev,
        ...updateData
      } : null);

      setCurrentPage(AppPageType.DETAIL);
      showAlert(t('editComplete' as any));
    } catch (error) {
      console.error('Error updating room:', error);
      showAlert('Update failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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

  const isUnlimitedPos = true; // 항목 4: 전면 무료화
  const isPro = isAdFree;

  const [showTier, setShowTier] = useState(false); // 항목 2: 티어 숨기기/보이기
  const [activeRooms, setActiveRooms] = useState<RecruitmentRoom[]>([]); // 항목 7: 멀티 모임 관리
  const filteredRooms = useMemo(() => {
    return activeRooms.filter(r => {
      try {
        // 종목 필터링 추가
        if (activeTab !== SportType.ALL && r.sport !== activeTab) return false;

        const [y, m, d] = r.matchDate.split('-').map(Number);
        const [hh, mm] = r.matchTime.split(':').map(Number);
        const matchTime = new Date(y, m - 1, d, hh, mm);
        // 필터링 완화: 경기 종료 후 24시간까지 보임
        const expiryLimit = new Date(matchTime.getTime() + 24 * 60 * 60 * 1000);
        return expiryLimit > new Date() && r.status !== 'DELETED';
      } catch { return true; }
    }).sort((a, b) => {
      // 날짜 임박순 정렬 (가까운 경기가 먼저)
      try {
        const [ay, am, ad] = a.matchDate.split('-').map(Number);
        const [ahh, amm] = a.matchTime.split(':').map(Number);
        const aTime = new Date(ay, am - 1, ad, ahh, amm).getTime();

        const [by, bm, bd] = b.matchDate.split('-').map(Number);
        const [bhh, bmm] = b.matchTime.split(':').map(Number);
        const bTime = new Date(by, bm - 1, bd, bhh, bmm).getTime();

        return aTime - bTime; // 오름차순: 임박한 경기가 먼저
      } catch { return 0; }
    });
  }, [activeRooms, activeTab]);

  const [currentActiveRoom, setCurrentActiveRoom] = useState<RecruitmentRoom | null>(null);
  const [memberSuggestion, setMemberSuggestion] = useState<{ isOpen: boolean; applicant: Applicant | null }>({ isOpen: false, applicant: null });

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
  const [hostRoomSelectedSport, setHostRoomSelectedSport] = useState<SportType>(SportType.GENERAL);
  const [hostRoomTitle, setHostRoomTitle] = useState('');
  const [hostRoomDate, setHostRoomDate] = useState('');
  const [hostRoomTime, setHostRoomTime] = useState('');
  const [hostRoomEndDate, setHostRoomEndDate] = useState('');
  const [hostRoomEndTime, setHostRoomEndTime] = useState('');
  const [hostRoomUseLimit, setHostRoomUseLimit] = useState(false);
  const [hostRoomMaxApplicants, setHostRoomMaxApplicants] = useState(0);
  const [hostRoomTierMode, setHostRoomTierMode] = useState<'5TIER' | '3TIER'>('5TIER');
  const [hostRoomActivePicker, setHostRoomActivePicker] = useState<'START' | 'END'>('START');
  const [hostRoomIsPickerSelectionMode, setHostRoomIsPickerSelectionMode] = useState(false);
  const [showApplyRoomModal, setShowApplyRoomModal] = useState(false);
  const [isBalanceSettingsOpen, setIsBalanceSettingsOpen] = useState(false);
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
    };
  }, [currentActiveRoom?.id, lang]);

  useEffect(() => {
    let backHandler: any = null;

    const setupListener = async () => {
      backHandler = await CapApp.addListener('backButton', ({ canGoBack }) => {
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

        // 4순위: 상세 페이지 닫기 (홈으로 이동)
        if (currentPage === AppPageType.EDIT_ROOM) {
          setCurrentPage(AppPageType.DETAIL);
          return;
        }
        if (currentPage === AppPageType.BALANCE) { // BALANCE 페이지에서 뒤로가기 시 상세 페이지로 이동
          setCurrentPage(AppPageType.DETAIL);
          return;
        }
        if (currentPage === AppPageType.DETAIL) {
          setCurrentPage(AppPageType.HOME);
          setCurrentBottomTab(BottomTabType.HOME); // 하단 탭도 함께 복구
          setShowRoomDetail(false);
          setIsNavigatingFromDetail(false);
          return;
        }

        // 5순위: 상세페이지에서 참가자 추가하러 왔을 때 경기정보로 복귀
        if (isNavigatingFromDetail && currentBottomTab === BottomTabType.MEMBERS) {
          setCurrentPage(AppPageType.DETAIL);
          setIsNavigatingFromDetail(false);
          return;
        }

        // 6순위: 앱 종료
        CapApp.exitApp();
      });
    };

    setupListener();

    return () => {
      if (backHandler) {
        backHandler.remove();
      }
    };
  }, [
    alertState.isOpen,
    showRewardAd, showLoginModal, showLoginRecommendModal, showUpgradeModal, showLimitModal, showReviewPrompt,
    showInfoModal, showApplyRoomModal, showHostRoomModal,
    showColorPicker, showQuotaSettings, selectionMode,
    currentPage, isNavigatingFromDetail, currentBottomTab
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
    const SAMPLE_DATA_VERSION = 'v4';
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

    const activeCount = players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab)).length;
    const perTeam = teamCount > 0 ? Math.floor(activeCount / teamCount) : 0;

    if (activeTab === SportType.SOCCER) {
      setQuotas({
        GK: 1,
        LB: null, DF: Math.max(1, Math.round((perTeam - 1) * 0.4)), RB: null,
        MF: null,
        LW: null, ST: null, RW: null
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
    if (activeTab === SportType.ALL) return null;
    return (
      <div className="space-y-6">
        <section id="participation-capture-section" className="bg-slate-50 dark:bg-slate-900 flex flex-col rounded-2xl overflow-hidden min-h-[100px]">
          <div className="px-5 py-4 border-b border-transparent flex justify-between items-center bg-transparent">
            <div className="flex items-center gap-2">
              <div className="text-emerald-500"><UserCheckIcon /></div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('participantList' as any)} <span className="text-slate-900 dark:text-slate-100 font-normal ml-1">({activePlayers.length})</span></h2>
            </div>
            <button
              onClick={() => {
                if (unselectAllConfirm) {
                  setPlayers(prev => prev.map(p => (activeTab === SportType.ALL || p.sportType === activeTab) ? { ...p, isActive: false } : p));
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

          {/* Active Team Constraints List */}
          {teamConstraints.length > 0 && (
            <div className="px-5 py-2 space-y-2">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">{t('activeConstraints' as any)}</h3>
              <div className="flex flex-wrap gap-2">
                {teamConstraints.map((c) => {
                  const playerNames = c.playerIds.map(id => players.find(p => p.id === id)?.name || id).join(', ');
                  return (
                    <div key={c.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-black text-white ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                        {c.type === 'MATCH' ? 'M' : 'S'}
                      </div>
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{playerNames}</span>
                      <button
                        onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Icons.CloseIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-5 pb-2 flex gap-1.5">
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
          <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
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
                  className="px-10 h-14 bg-white dark:bg-slate-900 text-slate-950 dark:text-white font-black rounded-2xl transition-all active:scale-95 text-sm tracking-tight shadow-xl shadow-white/5 disabled:opacity-30 disabled:pointer-events-none"
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
        {/* 선수 등록 - 전체 탭에서는 숨김 */}
        {activeTab !== SportType.ALL && (
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
              <form onSubmit={addPlayer} className="px-5 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
        )}

        {/* 회원 목록 및 참가 목록 */}
        <div className="grid grid-cols-1 gap-6 items-start">
          <section className="bg-slate-50 dark:bg-slate-900 flex flex-col rounded-2xl overflow-hidden min-h-[100px]">
            <div className="px-5 py-4 border-b border-transparent flex justify-between items-center bg-transparent">
              <div className="flex items-center gap-2">
                <div className="text-slate-400 dark:text-slate-500"><UserPlusIcon /></div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('memberList' as any)} <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({memberPlayers.length})</span></h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (selectAllConfirm) {
                      const updatedPlayers = players.map(p => (activeTab === SportType.ALL || p.sportType === activeTab) ? { ...p, isActive: true } : p);
                      setPlayers(updatedPlayers);

                      // Sync with Match if needed
                      if (isNavigatingFromDetail && currentActiveRoom) {
                        try {
                          const roomRef = doc(db, 'rooms', currentActiveRoom.id);
                          const currentApps = [...(currentActiveRoom.applicants || [])];
                          const targetPlayers = updatedPlayers.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab));

                          targetPlayers.forEach(p => {
                            const exists = currentApps.find(a => a.name === p.name);
                            const joinedPos = (p.primaryPositions && p.primaryPositions.length > 0)
                              ? p.primaryPositions.join('/')
                              : (p.primaryPosition || 'NONE');

                            if (!exists) {
                              currentApps.push({
                                id: 'app_' + Math.random().toString(36).substr(2, 9),
                                name: p.name,
                                tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === p.tier) || 'B',
                                isApproved: true,
                                position: joinedPos,
                                primaryPositions: p.primaryPositions || [],
                                secondaryPositions: p.secondaryPositions || [],
                                tertiaryPositions: p.tertiaryPositions || [],
                                forbiddenPositions: p.forbiddenPositions || [],
                                appliedAt: new Date().toISOString()
                              });
                            } else {
                              const idx = currentApps.findIndex(a => a.name === p.name);
                              currentApps[idx].isApproved = true;
                              currentApps[idx].position = joinedPos;
                              (currentApps[idx] as any).primaryPositions = p.primaryPositions || [];
                              (currentApps[idx] as any).secondaryPositions = p.secondaryPositions || [];
                              (currentApps[idx] as any).tertiaryPositions = p.tertiaryPositions || [];
                              (currentApps[idx] as any).forbiddenPositions = p.forbiddenPositions || [];
                            }
                          });
                          await updateDoc(roomRef, { applicants: currentApps });
                        } catch (e) {
                          console.error("Select All sync error:", e);
                        }
                      }
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
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[100px]">
              {memberPlayers.length === 0 ? (
                <div className="col-span-full py-6 opacity-20 text-center text-xs font-black uppercase tracking-widest">{t('noPlayers')}</div>
              ) : (
                memberPlayers.map(p => (
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

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // In "Add Participant" flow, new players should be active by default and synced
    const shouldBeActive = isNavigatingFromDetail && !!currentActiveRoom;

    const player: Player = {
      id: crypto.randomUUID(), name: newName.trim(), tier: newTier,
      isActive: shouldBeActive,
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

    if (shouldBeActive && currentActiveRoom) {
      try {
        const roomRef = doc(db, 'rooms', currentActiveRoom.id);
        const currentApps = [...(currentActiveRoom.applicants || [])];

        const joinedPos = (player.primaryPositions && player.primaryPositions.length > 0)
          ? player.primaryPositions.join('/')
          : (player.primaryPosition || 'NONE');

        currentApps.push({
          id: 'app_' + Math.random().toString(36).substr(2, 9),
          name: player.name,
          tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === player.tier) || 'B',
          isApproved: true,
          position: joinedPos,
          primaryPositions: player.primaryPositions || [],
          secondaryPositions: player.secondaryPositions || [],
          tertiaryPositions: player.tertiaryPositions || [],
          forbiddenPositions: player.forbiddenPositions || [],
          appliedAt: new Date().toISOString()
        });
        await updateDoc(roomRef, { applicants: currentApps });
      } catch (e) {
        console.error("Add player sync error:", e);
      }
    }

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

  const toggleParticipation = async (id: string) => {
    if (editingPlayerId) return;
    const player = players.find(p => p.id === id);
    if (!player) return;

    const nextIsActive = !player.isActive;
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, isActive: nextIsActive } : p));

    // Sync with Recruitment Room if in "Add Participant" flow
    if (isNavigatingFromDetail && currentActiveRoom) {
      try {
        const roomRef = doc(db, 'rooms', currentActiveRoom.id);
        const currentApps = [...(currentActiveRoom.applicants || [])];
        const joinedPos = (player.primaryPositions && player.primaryPositions.length > 0)
          ? player.primaryPositions.join('/')
          : (player.primaryPosition || 'NONE');

        if (nextIsActive) {
          const exists = currentApps.find(a => a.name === player.name);
          if (!exists) {
            currentApps.push({
              id: 'app_' + Math.random().toString(36).substr(2, 9),
              name: player.name,
              tier: (Object.keys(Tier) as (keyof typeof Tier)[]).find(key => Tier[key] === player.tier) || 'B',
              isApproved: true,
              position: joinedPos,
              primaryPositions: player.primaryPositions || [],
              secondaryPositions: player.secondaryPositions || [],
              tertiaryPositions: player.tertiaryPositions || [],
              forbiddenPositions: player.forbiddenPositions || [],
              appliedAt: new Date().toISOString()
            });
          } else {
            const idx = currentApps.findIndex(a => a.name === player.name);
            currentApps[idx].isApproved = true;
            currentApps[idx].position = joinedPos;
            (currentApps[idx] as any).primaryPositions = player.primaryPositions || [];
            (currentApps[idx] as any).secondaryPositions = player.secondaryPositions || [];
            (currentApps[idx] as any).tertiaryPositions = player.tertiaryPositions || [];
            (currentApps[idx] as any).forbiddenPositions = player.forbiddenPositions || [];
          }
        } else {
          const idx = currentApps.findIndex(a => a.name === player.name);
          if (idx > -1) currentApps.splice(idx, 1);
        }
        await updateDoc(roomRef, { applicants: currentApps });
      } catch (e) {
        console.error("Sync match player error:", e);
      }
    }
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
            tertiaryPosition: t1[0] || 'NONE',
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
          tertiaryPosition: t1[0] || 'NONE',
          tertiaryPositions: t1,
          forbiddenPositions: f1
        };
        return [...prev, newPlayer];
      });
    } catch (e) {
      console.error("Approval Error:", e);
    }
  };

  const handleUpdateApplicant = async (room: RecruitmentRoom, applicantId: string, updates: Partial<Applicant>) => {
    try {
      const roomRef = doc(db, 'rooms', room.id);
      const updatedApplicants = room.applicants.map(app => {
        if (app.id === applicantId) {
          const newApp = { ...app, ...updates };

          // Sync with local players if exists
          setPlayers(prev => prev.map(p => {
            if (p.name === app.name) {
              const playerUpdates: Partial<Player> = {};
              if (updates.tier !== undefined) {
                playerUpdates.tier = (Tier as any)[updates.tier] || Tier.B;
              }
              if (updates.primaryPositions !== undefined) {
                playerUpdates.primaryPositions = updates.primaryPositions as Position[];
                playerUpdates.primaryPosition = (updates.primaryPositions[0] || 'NONE') as Position;
              }
              if (updates.secondaryPositions !== undefined) {
                playerUpdates.secondaryPositions = updates.secondaryPositions as Position[];
                playerUpdates.secondaryPosition = (updates.secondaryPositions[0] || 'NONE') as Position;
              }
              if (updates.tertiaryPositions !== undefined) {
                playerUpdates.tertiaryPositions = updates.tertiaryPositions as Position[];
                playerUpdates.tertiaryPosition = (updates.tertiaryPositions[0] || 'NONE') as Position;
              }
              if (updates.position !== undefined) {
                // For backward compatibility (summary string)
                const posArr = updates.position.split('/') as Position[];
                if (!updates.primaryPositions) {
                  playerUpdates.primaryPositions = posArr;
                  playerUpdates.primaryPosition = posArr[0] || 'NONE';
                }
              }
              return { ...p, ...playerUpdates };
            }
            return p;
          }));

          return newApp;
        }
        return app;
      });
      await updateDoc(roomRef, { applicants: updatedApplicants });
    } catch (e) {
      console.error("Update applicant error:", e);
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
              tertiaryPosition: t1[0] || 'NONE',
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
              tertiaryPosition: t1[0] || 'NONE',
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

  const handleGenerate = async (manualPlayers?: Player[] | any, manualSport?: SportType) => {
    let participating: Player[] = [];
    let targetSport: SportType | undefined;

    // 인자가 배열이면 수동 전달(모집방 등), 아니면(이벤트 객체 등) 기존/마지막 문맥 사용
    if (Array.isArray(manualPlayers)) {
      participating = manualPlayers;
      targetSport = manualSport;
    } else if (lastGenContext && !manualPlayers?.target) {
      // '다시 나누기' 등에서 인자 없이 호출된 경우 마지막 성공 문맥 재사용
      participating = lastGenContext.players;
      targetSport = lastGenContext.sport;
    } else {
      // 일반 메인 화면 생성
      participating = players.filter(p => p.isActive && (activeTab === SportType.ALL || p.sportType === activeTab));
      targetSport = (activeTab === SportType.ALL ? undefined : activeTab);
    }

    if (participating.length < teamCount) {
      showAlert(t('minPlayersAlert', teamCount, participating.length));
      return;
    }

    // [CRITICAL] 쿼터 정합성 체크 (사후 알림)
    const perTeamCount = Math.floor(participating.length / teamCount);
    const validPosForSport =
      targetSport === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
        targetSport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
          targetSport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
            ['NONE'];

    const filteredQuotas: Partial<Record<Position, number | null>> = {};
    Object.entries(quotas).forEach(([pos, v]) => {
      if (validPosForSport.includes(pos as any)) {
        filteredQuotas[pos as any] = v;
      }
    });

    const totalQuotaSum = Object.values(filteredQuotas).reduce((sum, v) => (sum as number) + (Number(v) || 0), 0);

    if (totalQuotaSum > perTeamCount) {
      showAlert(`팀당 인원(${perTeamCount}명)보다 설정된 포지션 합계(${totalQuotaSum}명)가 많습니다.\n설정을 확인해 주세요.`);
      return;
    }

    // 포지션 인원 설정이 하나라도 있는지 확인 (있으면 고급 기능 사용)
    const isAdvanced = Object.values(filteredQuotas).some(v => v !== null);

    // 항목 4: 포지션 인원 설정 유료 제한 삭제 (X)

    setResult(null);
    setIsGenerating(true);
    // 광고 제거 전은 5초(연출), 광고 제거 후는 1초(빠름)
    const waitTime = isAdFree ? 1000 : 5000;
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

    // 밸런스 생성 시 제약 조건 포함 (targetSport에 해당하는 제약만 필터링)
    const activeConstraints = teamConstraints.filter(c => {
      const p = players.find(p => c.playerIds.includes(p.id));
      return p && (!targetSport || p.sportType === targetSport);
    });



    setTimeout(() => {
      try {
        const res = generateBalancedTeams(participating, teamCount, filteredQuotas, activeConstraints, useRandomMix, Array.from(pastResults), targetSport);

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
        setShowQuotaSettings(false);
        setCurrentPage(AppPageType.BALANCE);

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

        // 성공한 생성 문맥 저장 (다시 나누기용)
        setLastGenContext({ players: participating, sport: targetSport });
      } catch (e) {
        console.error('Generation Error:', e);
        showAlert(t('errorOccurred' as any));
      } finally {
        setIsGenerating(false);
      }
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
      ? { GK: 1, DF: 2, MF: 3, ST: 4, NONE: 5 }
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

  const currentQuotaTotal = Object.entries(quotas).reduce<number>((acc, [pos, val]) => {
    const validPosForSport =
      activeTab === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
        activeTab === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
          activeTab === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
            ['NONE'];
    if (validPosForSport.includes(pos as any)) {
      return acc + (typeof val === 'number' ? val : 0);
    }
    return acc;
  }, 0);
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
      }}
    >
      {isGenerating && <LoadingOverlay lang={lang} activeTab={activeTab} darkMode={darkMode} countdown={countdown} isPro={isPro} />}

      {/* Header - Only on HOME page */}
      {currentPage === AppPageType.HOME && (
        <header className="w-full flex flex-col items-center mb-0">
          <div className="w-full flex justify-between items-center bg-white dark:bg-slate-950 px-5 py-1.5 min-h-[56px]">
            <div className="flex gap-2">
              {isNavigatingFromDetail && currentBottomTab === BottomTabType.MEMBERS && (
                <button
                  onClick={() => {
                    setCurrentPage(AppPageType.DETAIL);
                    setIsNavigatingFromDetail(false);
                  }}
                  className="p-2 -ml-2 text-slate-900 dark:text-white transition-all active:scale-90"
                >
                  <ArrowLeftIcon size={24} />
                </button>
              )}
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
      )}

      {currentPage === AppPageType.HOME && (
        <nav className="flex gap-[10px] bg-white dark:bg-slate-950 px-5 pb-2 mb-3 w-full overflow-x-auto no-scrollbar whitespace-nowrap">
          {(Object.entries(SportType) as [string, SportType][]).map(([key, value]) => (
            <button
              key={value}
              onClick={() => {
                setActiveTab(value);
                setResult(null);
                setEditingPlayerId(null);
                AnalyticsService.logEvent('tab_change', { sport: value });
              }}
              className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${activeTab === value
                ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                }`}
            >
              {t(value.toLowerCase() as any)}
            </button>
          ))}
        </nav>
      )}

      {currentBottomTab === BottomTabType.HOME && (
        <section className="w-full px-5 mb-5" data-capture-ignore="true">
          <div className="space-y-4">
            {filteredRooms.length === 0 ? (
              <button
                onClick={() => { setCurrentActiveRoom(null); setShowHostRoomModal(true); }}
                className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl group-hover:scale-110 transition-transform">
                  <PlusIcon />
                </div>
                <p className="text-[12px] font-black text-slate-400 dark:text-slate-500 px-8 text-center leading-relaxed">{t('noScheduledMatch' as any)}</p>
              </button>
            ) : (
              <>
                {/* Match Cards List */}
                {filteredRooms.map((room) => {
                  const pendingApplicants = room.applicants.filter(a => !a.isApproved);
                  return (
                    <div
                      key={room.id}
                      onClick={() => { setCurrentActiveRoom(room); setCurrentPage(AppPageType.DETAIL); }}
                      className="w-full h-[120px] rounded-[24px] overflow-hidden relative group active:scale-[0.98] transition-all shadow-xl animate-in zoom-in-95 duration-500 cursor-pointer"
                    >
                      {/* Full Background Image */}
                      <img
                        src={(() => {
                          const seed = room.id ? room.id.charCodeAt(room.id.length - 1) % 2 + 1 : 1;
                          const sport = room.sport.toLowerCase();
                          const name = sport === 'general' ? 'tennis' : sport;
                          return `/images/${name}-${seed}.jpeg`;
                        })()}
                        alt={room.sport}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* Dark Overlay for Readability */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />

                      {/* Content Overlay */}
                      <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
                        {/* Top Row: Sport Badge, Title & Actions */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="bg-white/95 px-3 py-0 rounded-xl shrink-0">
                              <span className="text-black text-[12px] font-medium uppercase tracking-[-0.025em] leading-none">
                                {t(room.sport.toLowerCase() as any)}
                              </span>
                            </div>
                            <h4 className="text-[16px] font-black tracking-[-0.025em] drop-shadow-md truncate">
                              {room.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Pending Applicants Badge/Icon */}
                            <div className="relative p-1.5 transition-colors">
                              <Icons.UsersIcon size={18} className="text-white/90" />
                              {pendingApplicants.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black/50 animate-pulse">
                                  {pendingApplicants.length}
                                </span>
                              )}
                            </div>
                            {/* Share Action */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleShareRecruitLink(room); }}
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Icons.ShareIcon size={18} className="text-white/90" />
                            </button>
                            {/* Delete Action */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCloseRecruitRoom(room); }}
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-rose-400"
                            >
                              <Icons.TrashIcon size={18} className="text-white/90" />
                            </button>
                          </div>
                        </div>


                        {/* Middle Row: Recruitment Badge (Centering for balance) */}
                        <div className="flex-1 flex flex-col justify-center items-end">
                          {(() => {
                            const activeCount = players.filter(p => p.isActive && p.sportType === room.sport).length;
                            const isFull = room.maxApplicants > 0 && activeCount >= room.maxApplicants;
                            return (
                              <div className={`text-[12px] font-medium text-[#FFFFFF] px-3 py-1 rounded-xl tracking-[-0.025em] ${isFull ? 'bg-[#F43F5E]' : 'bg-[#53B175]'}`}>
                                {isFull ? '모집마감' : '모집중'}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bottom Row: Date/Time & Count */}
                        <div className="flex justify-between items-end gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[12px] font-medium uppercase tracking-[-0.025em]" style={{ color: '#FFFFFF' }}>경기 날짜 & 시간</p>
                            <p className="text-[16px] font-medium tracking-[-0.025em] leading-none">{room.matchDate} {room.matchTime}</p>
                          </div>

                          <div className="text-right leading-none flex flex-col items-end">
                            <span className="text-[20px] font-black tracking-[-0.025em] tabular-nums leading-none">
                              {players.filter(p => p.isActive && p.sportType === room.sport).length}
                              <span className="text-white/40 mx-1 text-[16px]">/</span>
                              {room.maxApplicants > 0 ? room.maxApplicants : '무제한'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Always Show "Create Match" button at the bottom of the list */}
                <button
                  onClick={() => { setCurrentActiveRoom(null); setShowHostRoomModal(true); }}
                  className="w-full h-[120px] rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.98] group mt-2"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                    <PlusIcon />
                  </div>
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {currentPage === AppPageType.EDIT_ROOM && currentActiveRoom && (
        <div className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          {/* 상단 바 */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
            <button
              onClick={() => setCurrentPage(AppPageType.DETAIL)}
              className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={24} />
            </button>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t('editMatch' as any)}</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 pb-[148px]">
            <div className="space-y-4">
              <div className="space-y-4">
                {/* 종목 선택 (수정 모드에서도 변경 가능하도록 유지) */}
                <div className="flex items-center gap-4">
                  <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('sport' as any)}</label>
                  <div className="flex-1 flex overflow-x-auto no-scrollbar gap-2 py-1">
                    {[SportType.GENERAL, SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL].map((s) => (
                      <button
                        key={s}
                        onClick={() => setHostRoomSelectedSport(s)}
                        className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-all border ${hostRoomSelectedSport === s
                          ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                          : 'bg-white text-[#2E2C2C] border-[#606060] dark:bg-slate-900 dark:text-white dark:border-slate-700'
                          }`}
                      >
                        {t(s.toLowerCase() as any)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 팀명 입력 */}
                <div className="flex items-center gap-4">
                  <label className="w-12 text-sm font-medium text-slate-900 dark:text-white shrink-0">{t('roomTitle')}</label>
                  <input
                    type="text"
                    value={hostRoomTitle}
                    onChange={(e) => setHostRoomTitle(e.target.value)}
                    placeholder={t('inputRoomTitle')}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 rounded-2xl px-5 py-3 focus:outline-none dark:text-white font-semibold text-[13px] placeholder:text-[#777777] placeholder:font-semibold placeholder:text-[13px]"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => setHostRoomActivePicker('START')}
                      className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'START' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                    >
                      <span className="text-[16px] font-black uppercase text-blue-500 mb-1">{t('startTime')}</span>
                      <span className={`text-[16px] font-black ${hostRoomActivePicker === 'START' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                        {hostRoomDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(hostRoomDate).getDay()]}) {hostRoomTime}
                      </span>
                    </div>
                    <div className="text-slate-200 dark:text-slate-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div
                      onClick={() => setHostRoomActivePicker('END')}
                      className={`flex flex-col items-center cursor-pointer transition-all ${hostRoomActivePicker === 'END' ? 'opacity-100 scale-105' : 'opacity-40'}`}
                    >
                      <span className="text-[16px] font-black uppercase text-rose-500 mb-1">{t('endTime')}</span>
                      <span className={`text-[16px] font-black ${hostRoomActivePicker === 'END' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                        {hostRoomEndDate.split('-').slice(1).join('.')} ({(TRANSLATIONS[lang] as any).days[new Date(hostRoomEndDate).getDay()]}) {hostRoomEndTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center transition-all duration-300">
                    {hostRoomActivePicker === 'START' ? (
                      <DateTimePicker
                        date={hostRoomDate}
                        time={hostRoomTime}
                        onChange={(d, t) => {
                          setHostRoomDate(d);
                          setHostRoomTime(t);
                          // 수정 페이지에서는 자동 연동 로직 제거 (독립적으로 수정 가능)
                        }}
                        lang={lang}
                        onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                      />
                    ) : (
                      <DateTimePicker
                        date={hostRoomEndDate}
                        time={hostRoomEndTime}
                        onChange={(d, t) => {
                          setHostRoomEndDate(d);
                          setHostRoomEndTime(t);
                        }}
                        lang={lang}
                        onViewModeChange={(mode) => setHostRoomIsPickerSelectionMode(mode === 'YEAR_MONTH_SELECT')}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3">
                    <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('limitApplicants')}</label>
                    <button
                      onClick={() => setHostRoomUseLimit(!hostRoomUseLimit)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${hostRoomUseLimit ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${hostRoomUseLimit ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {hostRoomUseLimit && (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 rounded-xl px-2 py-1 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-right-2">
                      <button onClick={() => setHostRoomMaxApplicants(Math.max(2, hostRoomMaxApplicants - 1))} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      <span className="text-center font-black dark:text-white text-[12px] min-w-[40px]">{t('peopleCount', hostRoomMaxApplicants)}</span>
                      <button onClick={() => setHostRoomMaxApplicants(hostRoomMaxApplicants + 1)} className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-400 active:scale-90 transition-transform">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800" />

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[16px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{t('tierMode')}</label>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setHostRoomTierMode('5TIER')}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${hostRoomTierMode === '5TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode5')}
                    </button>
                    <button
                      onClick={() => setHostRoomTierMode('3TIER')}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-black transition-all ${hostRoomTierMode === '3TIER' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t('tierMode3')}
                    </button>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed">
                    💡 {hostRoomTierMode === '3TIER' ? t('tierModeDesc') : t('tierMode5Desc' as any)}
                  </p>
                </div>
              </div>

              {/* 추가된 즉시 수정/취소 버튼: 오른쪽 하단 정렬, 소형화 (HostRoomModal과 동일) */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setCurrentPage(AppPageType.DETAIL)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm rounded-xl transition-all active:scale-[0.95]"
                >
                  {t('cancel' as any)}
                </button>
                <button
                  onClick={handleUpdateRoom}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.95] shadow-md shadow-blue-500/20"
                >
                  {isProcessing ? '...' : t('editComplete' as any)}
                </button>
              </div>
            </div>
          </div>

          {/* 고정 하단 버튼 제거 (사용자 요청) */}
        </div>
      )}

      {currentPage === AppPageType.BALANCE && currentActiveRoom && (
        <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-y-auto">
          <header className="sticky top-0 z-50 bg-white dark:bg-slate-950 px-4 pt-[40px] pb-[8px] border-b border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center w-full">
              <button
                onClick={() => {
                  setCurrentPage(AppPageType.DETAIL);
                  setResult(null);
                }}
                className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
              >
                <ArrowLeftIcon size={24} />
              </button>
              <h1 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
                {result ? t('resultsTitle' as any) : t('generateTeams' as any)}
              </h1>
              <div className="w-8" />
            </div>
          </header>

          <div className="flex-1 px-6 py-6 max-w-lg mx-auto w-full">
            <div className="space-y-6">
              {!result && (
                <>
                  {/* 포지션별 인원 설정 버튼 */}
                  <section>
                    <button
                      onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                      className="w-full bg-slate-900 dark:bg-slate-100 py-2 rounded-[24px] flex items-center justify-center text-white dark:text-slate-900 text-[16px] font-semibold shadow-2xl shadow-slate-900/40 dark:shadow-white/20 transition-all active:scale-[0.98] active:brightness-95"
                      style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                    >
                      {t('positionSettings')}
                    </button>

                    {isQuotaSettingsExpanded && (
                      <div className="mt-4 p-4 rounded-[24px] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                        <QuotaFormationPicker
                          sport={currentActiveRoom.sport as SportType}
                          quotas={quotas}
                          lang={lang}
                          onUpdate={updateQuota}
                          onToggleMode={toggleQuotaMode}
                          darkMode={darkMode}
                        />
                        {currentActiveRoom.sport !== SportType.GENERAL && (
                          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed italic px-2">
                            {t('quotaInfoMsg')}
                          </p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* 티어무시 무작위 팀 나누기 */}
                  <section
                    onClick={() => setUseRandomMix(!useRandomMix)}
                    className="flex items-center gap-3 px-2 py-1 cursor-pointer group"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${useRandomMix ? 'bg-slate-900 border-slate-900 dark:bg-white dark:border-white' : 'border-slate-300 dark:border-slate-700 group-hover:border-slate-400'}`}>
                      {useRandomMix && <CheckIcon size={14} className="text-white dark:text-slate-900" />}
                    </div>
                    <span className="text-[14px] font-bold text-slate-600 dark:text-slate-300">{t('randomMix')}</span>
                  </section>

                  <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1" />

                  {/* 팀수 설정 */}
                  <section className="flex items-center justify-between px-2 h-12">
                    <span className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{t('teamCountLabel')}</span>
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => setTeamCount(Math.max(2, teamCount - 1))}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                      >
                        <MinusIcon size={20} />
                      </button>
                      <span className="text-lg font-black font-mono w-4 text-center">{teamCount}</span>
                      <button
                        onClick={() => setTeamCount(Math.min(10, teamCount + 1))}
                        className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 active:scale-90 transition-all"
                      >
                        <PlusIcon size={20} />
                      </button>
                    </div>
                  </section>

                  {/* 팀나누기 실행 버튼 */}
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 rounded-[24px] text-[16px] font-semibold tracking-tight shadow-2xl shadow-slate-900/40 dark:shadow-white/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-6"
                    style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                  >
                    {t('generateTeams')}
                  </button>
                </>
              )}

              {result && (
                <div id="results-capture-section" className="mt-8 pb-32 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t('resultsTitle')}</h2>
                    <div data-capture-ignore="true" className="flex gap-2">
                      <button
                        onClick={() => handleShare('results-capture-section', 'team-balance-result')}
                        disabled={!!isSharing}
                        className="bg-slate-950 dark:bg-white text-white dark:text-slate-900 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2"
                      >
                        {isSharing ? t('generatingImage') : <><ShareIcon /> {t('shareResult')}</>}
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid - 2 Columns as per image */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} rounded-[24px] p-4 flex flex-col items-center text-center shadow-sm`}>
                      <span className={`text-[10px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-1`}>{t('standardDeviation')}</span>
                      <span className="text-3xl font-black font-mono leading-none">{result.standardDeviation.toFixed(2)}</span>
                      <span className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-1`}>({t('lowerFairer')})</span>
                    </div>
                    <div className={`${darkMode ? 'bg-slate-800' : 'bg-slate-50'} rounded-[24px] p-4 flex flex-col items-center text-center shadow-sm`}>
                      <span className={`text-[10px] font-bold uppercase ${darkMode ? 'text-slate-500' : 'text-slate-400'} mb-1`}>{t('penaltyScore')}</span>
                      <span className="text-3xl font-black font-mono leading-none text-blue-500">{(result as any).positionSatisfaction?.toFixed(1) || '0.0'}</span>
                      <span className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'} mt-1`}>({t('penaltyScoreDesc')})</span>
                    </div>
                  </div>

                  {/* Auto Color Checkbox as per image */}
                  <div className="flex items-center gap-2 mb-6 px-2 group cursor-pointer">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                      {/* Unchecked box */}
                    </div>
                    <span className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight">전체 팀색 자동 설정</span>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {result.teams.map((team, idx) => (
                      <div key={team.id} className="overflow-hidden">
                        <div className="flex items-center justify-between mb-4 px-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#111111] text-white flex items-center justify-center font-bold text-sm">
                              {idx + 1}
                            </div>
                            <h4 className="text-[18px] font-bold text-[#111111] dark:text-white tracking-tight uppercase">
                              {team.colorName ? t('teamNameWithColor', t(team.colorName as any)) : `TEAM ${String.fromCharCode(65 + idx)}`} ({team.players.length})
                            </h4>

                            {/* Team Color Setting - Moved next to the team name */}
                            <div
                              onClick={() => setEditingResultTeamIdx(editingResultTeamIdx === idx ? null : idx)}
                              className="flex items-center gap-1.5 ml-1 cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <div className="w-4 h-4 rounded border border-slate-300 bg-white" style={team.color ? { backgroundColor: team.color } : {}} />
                              <span className="text-[12px] font-medium text-slate-400">팀색 설정</span>
                            </div>
                          </div>

                          {/* Team Total Skill - Positioned on the right */}
                          <div className="text-right">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">{t('squadSum')}</span>
                            <span className="text-[20px] font-black font-mono leading-none text-slate-900 dark:text-white">{team.totalSkill}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {getSortedTeamPlayers(team.players).map(p => (
                            <div key={p.id} className="flex items-center gap-4 bg-white dark:bg-slate-950 px-2 py-1 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 shadow-sm transition-all">
                              {/* Profile Circle - Same as Participant List */}
                              <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] flex items-center justify-center text-[12px] font-medium text-[#777777] shrink-0">
                                BELO
                              </div>

                              {/* Assigned Position - SINGLE Label between profile and name */}
                              <div className="w-10 text-[14px] font-bold text-slate-400 shrink-0 text-center">
                                {p.assignedPosition || '--'}
                              </div>

                              {/* Player Info Area */}
                              <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                {/* Tier + Name Row - Matches Participant List */}
                                <div className="flex items-center gap-2">
                                  {showTier && (
                                    <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium tracking-tight ${TIER_COLORS[p.tier]}`}>
                                      {Tier[p.tier]}
                                    </span>
                                  )}
                                  <span className="text-[16px] font-medium text-slate-900 dark:text-white truncate tracking-tight">
                                    {p.name}
                                  </span>
                                </div>

                                {/* Preferred Positions (Dots) - Plural Arrays from Mapping */}
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  {/* Primary Positions (Emerald) */}
                                  {p.primaryPositions?.map((pos, pIdx) => (
                                    <div key={`p-${pIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                      <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {/* Secondary Positions (Amber) */}
                                  {p.secondaryPositions?.map((pos, sIdx) => (
                                    <div key={`s-${sIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                      <span className="text-[11px] font-medium text-[#FACC16] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {/* Tertiary Positions (Orange) */}
                                  {p.tertiaryPositions?.map((pos, tIdx) => (
                                    <div key={`t-${tIdx}`} className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                      <span className="text-[11px] font-medium text-[#FB933C] uppercase tracking-tight">{pos}</span>
                                    </div>
                                  ))}
                                  {/* Fallback for legacy items */}
                                  {!p.primaryPositions && p.primaryPosition && (
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                      <span className="text-[11px] font-medium text-[#10B982] uppercase tracking-tight">{p.primaryPosition}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Re-generate Button - Black as per image */}
                  <button
                    onClick={() => handleGenerate()}
                    className="w-full bg-[#111111] text-white py-4 rounded-[24px] text-[18px] font-bold tracking-tight shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 mt-10"
                    style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                  >
                    팀 다시 나누기
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Ad Space for Balance Page */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-950 p-2 border-t border-slate-100 dark:border-slate-800" data-capture-ignore="true">
            <div className="w-full h-[50px] bg-slate-50 dark:bg-slate-900/50 rounded-xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('adPlacementSlot')}</span>
            </div>
          </div>
        </div>
      )}

      {currentPage === AppPageType.DETAIL && currentActiveRoom && (
        <div className="fixed inset-0 z-[2000] bg-white dark:bg-slate-950 flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
          {/* 상세 화면 상단 바 - 여백 정밀 조정 (상단 40px, 하단 8px) */}
          <header className="w-full pt-[40px] pb-[8px] bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex justify-between items-center px-4 w-full">
              <button
                onClick={() => {
                  setCurrentPage(AppPageType.HOME);
                  setCurrentBottomTab(BottomTabType.HOME); // 하단 탭도 함께 복구
                }}
                className="p-1 -ml-1 text-slate-900 dark:text-white transition-all active:scale-90"
              >
                <ArrowLeftIcon size={24} />
              </button>
              <h3 className="text-[20px] font-semibold text-slate-900 dark:text-white tracking-[-0.025em]">
                {t('manageMatchDetail' as any)}
              </h3>
              <div className="w-8" /> {/* Spacer for centering */}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 pt-0 pb-4 space-y-6 pb-40">
            {(() => {
              const room = currentActiveRoom;
              const pendingApplicants = room.applicants.filter(a => !a.isApproved);
              const sportImgs = SPORT_IMAGES[room.sport as SportType] || SPORT_IMAGES[SportType.GENERAL];
              const bgImg = sportImgs[room.id ? (room.id.charCodeAt(0) % sportImgs.length) : 0];

              return (
                <div className="w-full">
                  {/* Styled Match Card (Same as Home Screen) */}
                  <div className="w-full h-[120px] rounded-[24px] overflow-hidden relative shadow-xl border border-slate-100 dark:border-slate-800 shrink-0">
                    <img src={bgImg} alt={room.sport} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
                    <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
                      {/* Top Row: Sport Badge, Title & Actions */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="bg-white/95 px-3 py-0 rounded-xl shrink-0">
                            <span className="text-black text-[12px] font-medium uppercase tracking-[-0.025em] leading-none">
                              {t(room.sport.toLowerCase() as any)}
                            </span>
                          </div>
                          <h4 className="text-[16px] font-medium tracking-[-0.025em] drop-shadow-md truncate">
                            {room.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative p-1.5 transition-colors">
                            <Icons.UsersIcon size={18} className="text-white/90" />
                            {pendingApplicants.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-black/50 animate-pulse">
                                {pendingApplicants.length}
                              </span>
                            )}
                          </div>
                          {/* Share Icon removed from here as it's now a button below */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHostRoomSelectedSport(room.sport as SportType);
                              setHostRoomTitle(room.title);
                              setHostRoomDate(room.matchDate);
                              setHostRoomTime(room.matchTime);
                              setHostRoomEndDate(room.matchEndDate || room.matchDate);
                              setHostRoomEndTime(room.matchEndTime || room.matchTime);
                              setHostRoomUseLimit(room.maxApplicants > 0);
                              setHostRoomMaxApplicants(room.maxApplicants || 12);
                              setHostRoomTierMode(room.tierMode || '5TIER');
                              setHostRoomActivePicker('START');
                              setHostRoomIsPickerSelectionMode(false);
                              setCurrentPage(AppPageType.EDIT_ROOM);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90"
                          >
                            <Icons.SettingsIcon size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseRecruitRoom(room);
                              setCurrentPage(AppPageType.HOME);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/90 hover:text-rose-400"
                          >
                            <Icons.TrashIcon size={18} className="text-white/90" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Row: Join Link Button (Centered for balance like home card) */}
                      <div className="flex-1 flex flex-col justify-center items-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShareRecruitLink(room); }}
                          className="text-[12px] font-medium text-[#FFFFFF] px-3 py-1 rounded-xl bg-[#53B175] tracking-[-0.025em] active:scale-95 transition-transform"
                        >
                          참가링크
                        </button>
                      </div>

                      {/* Bottom Row: Date/Time & Count */}
                      <div className="flex justify-between items-end gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[12px] font-medium uppercase tracking-tighter" style={{ color: '#FFFFFF' }}>경기 날짜 & 시간</p>
                          <p className="text-[16px] font-medium tracking-tight leading-none">{room.matchDate} {room.matchTime}</p>
                        </div>

                        <div className="text-right leading-none">
                          <span className="text-[20px] font-medium tracking-tighter tabular-nums leading-none">
                            {room.applicants.filter(a => a.isApproved).length}
                            <span className="text-white/40 mx-1 text-[16px]">/</span>
                            {room.maxApplicants > 0 ? room.maxApplicants : '∞'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Bar (Refined - Underline Style) */}
                  <div className="flex shrink-0 border-b border-slate-100 dark:border-slate-800 gap-8 mt-4">
                    <button
                      onClick={() => setDetailTab(DetailPageTab.PENDING)}
                      className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.PENDING
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-400 dark:text-slate-500 font-medium'
                        }`}
                    >
                      <span>{t('pendingApplicantsList' as any)}</span>
                      <span className="text-[11px] opacity-60">({pendingApplicants.length})</span>
                      {detailTab === DetailPageTab.PENDING && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
                      )}
                    </button>
                    <button
                      onClick={() => setDetailTab(DetailPageTab.APPROVED)}
                      className={`relative px-0 py-3 text-[14px] transition-all duration-300 flex items-center gap-1.5 ${detailTab === DetailPageTab.APPROVED
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-400 dark:text-slate-500 font-medium'
                        }`}
                    >
                      <span>{t('approvedParticipantsList' as any)}</span>
                      <span className="text-[11px] opacity-60">({room.applicants.filter(a => a.isApproved).length})</span>
                      {detailTab === DetailPageTab.APPROVED && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 dark:bg-white animate-in fade-in duration-300" />
                      )}
                    </button>
                  </div>

                  {/* Unified List Container (Simplified - No Background) */}
                  <div
                    className="flex flex-col gap-6 relative mt-3 flex-1 min-h-[400px]"
                    onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                      if (touchStartX === null) return;
                      const touchEndX = e.changedTouches[0].clientX;
                      const diff = touchStartX - touchEndX;
                      const threshold = 60; // 스와이프 민감도 조정

                      if (Math.abs(diff) > threshold) {
                        if (diff > 0 && detailTab === DetailPageTab.PENDING) {
                          // -> (오른쪽으로 스와이프 하는 감각이지만 손가락은 왼쪽으로 이동) : 다음 탭 (APPROVED)
                          setDetailTab(DetailPageTab.APPROVED);
                        } else if (diff < 0 && detailTab === DetailPageTab.APPROVED) {
                          // <- : 이전 탭 (PENDING)
                          setDetailTab(DetailPageTab.PENDING);
                        }
                      }
                      setTouchStartX(null);
                    }}
                  >
                    {/* Action Bar inside Container - Updated Alignment & Styles */}
                    <div className="flex justify-between items-center w-full">
                      <button
                        onClick={() => setShowTier(!showTier)}
                        className={`px-[8px] h-[28px] flex items-center justify-center rounded-xl text-[12px] font-medium transition-all active:scale-95 border ${showTier ? 'bg-[#111111] text-[#FFFFFF] border-[#111111]' : 'bg-[#FFFFFF] dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                      >
                        {showTier ? t('hideTier' as any) : t('showTier' as any)}
                      </button>

                      <div className="flex gap-[8px] items-center mx-3">
                        {detailTab === DetailPageTab.APPROVED && (
                          <>
                            <button
                              onClick={() => { setSelectionMode(prev => prev === 'MATCH' ? null : 'MATCH'); setSelectedPlayerIds([]); }}
                              className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium hover:brightness-95 transition-all flex items-center justify-center gap-1.5 border ${selectionMode === 'MATCH' ? 'bg-[#111111] text-[#FFFFFF] border-[#111111]' : 'bg-[#FFFFFF] dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                            >
                              <div className="w-[16px] h-[16px] rounded bg-blue-500 text-white flex items-center justify-center text-[9px] font-black">M</div>
                              {t('matchTeams' as any)}
                            </button>
                            <button
                              onClick={() => { setSelectionMode(prev => prev === 'SPLIT' ? null : 'SPLIT'); setSelectedPlayerIds([]); }}
                              className={`px-[8px] h-[28px] rounded-xl text-[12px] font-medium hover:brightness-95 transition-all flex items-center justify-center gap-1.5 border ${selectionMode === 'SPLIT' ? 'bg-[#111111] text-[#FFFFFF] border-[#111111]' : 'bg-[#FFFFFF] dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                            >
                              <div className="w-[16px] h-[16px] rounded bg-rose-500 text-white flex items-center justify-center text-[9px] font-black">S</div>
                              {t('splitTeams' as any)}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center">
                        {detailTab === DetailPageTab.APPROVED && (
                          <button
                            onClick={() => {
                              setCurrentPage(AppPageType.HOME);
                              setCurrentBottomTab(BottomTabType.MEMBERS);
                              setIsNavigatingFromDetail(true);
                            }}
                            className="bg-[#4685EB] text-white rounded-xl text-[12px] font-medium px-[8px] h-[28px] flex items-center justify-center transition-all active:scale-95 mr-2"
                          >
                            {t('addParticipant' as any)}
                          </button>
                        )}

                        {detailTab === DetailPageTab.PENDING && pendingApplicants.length > 0 && (
                          <button
                            onClick={() => handleApproveAllApplicants(room)}
                            className="bg-blue-600 text-white rounded-xl text-[12px] font-medium px-6 py-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                          >
                            {t('approveAll' as any)}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Active Team Constraints List (Detail Page) */}
                    {teamConstraints.length > 0 && (
                      <div className="flex flex-col gap-2 mb-2 p-1">
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">{t('activeConstraints' as any)}</h3>
                        <div className="flex flex-wrap gap-2">
                          {teamConstraints.map((c) => {
                            const playerNames = c.playerIds.map(id => {
                              const app = room.applicants.find(a => a.id === id);
                              return app ? app.name : (players.find(p => p.id === id)?.name || id);
                            }).join(', ');
                            return (
                              <div key={c.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl px-3 py-1.5 shadow-sm">
                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-black text-white ${c.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                  {c.type === 'MATCH' ? 'M' : 'S'}
                                </div>
                                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{playerNames}</span>
                                <button
                                  onClick={() => setTeamConstraints(prev => prev.filter(x => x.id !== c.id))}
                                  className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Icons.CloseIcon />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Member List */}
                    <div className="space-y-1">
                      {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).map((app) => {
                        const tierVal = isNaN(Number(app.tier)) ? (Tier as any)[app.tier] : Number(app.tier);
                        const tierLabel = isNaN(Number(app.tier)) ? app.tier : (Tier as any)[Number(app.tier)];

                        // Use canonical ID (from master players list if match exists) to avoid constraint mismatch
                        const member = players.find(p => p.name === app.name);
                        const effectiveId = member ? member.id : app.id;
                        const isSelected = selectedPlayerIds.includes(effectiveId);
                        const playerConstraint = teamConstraints.find(c => c.playerIds.includes(effectiveId));

                        return (
                          <React.Fragment key={app.id}>
                            <div
                              onClick={() => {
                                if (selectionMode && detailTab === DetailPageTab.APPROVED) {
                                  setSelectedPlayerIds(prev =>
                                    prev.includes(effectiveId) ? prev.filter(x => x !== effectiveId) : [...prev, effectiveId]
                                  );
                                }
                              }}
                              className={`bg-white dark:bg-slate-950 flex items-center justify-between px-2 py-1 rounded-2xl transition-all ${selectionMode && detailTab === DetailPageTab.APPROVED ? 'cursor-pointer active:scale-[0.98]' : ''} ${selectionMode && isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                {selectionMode && detailTab === DetailPageTab.APPROVED && (
                                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                                    {isSelected && <CheckIcon />}
                                  </div>
                                )}
                                {/* Profile Circle - Updated to #EEEEEE, #777777, 12px, 'BELO' */}
                                <div className="w-[52px] h-[52px] rounded-full bg-[#EEEEEE] flex items-center justify-center text-[12px] font-medium text-[#777777] shrink-0">
                                  BELO
                                </div>

                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    {showTier && (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[12px] font-medium ${TIER_COLORS[tierVal as Tier] || TIER_COLORS[Tier.B]}`}>
                                        {tierLabel}
                                      </span>
                                    )}
                                    <span className="text-[16px] font-medium text-slate-900 dark:text-white">
                                      {app.name}
                                    </span>
                                    {/* 제약 조건 뱃지 표시 */}
                                    {playerConstraint && (
                                      <div className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-black text-white ${playerConstraint.type === 'MATCH' ? 'bg-blue-500' : 'bg-rose-500'}`}>
                                        {playerConstraint.type === 'MATCH' ? 'M' : 'S'}
                                      </div>
                                    )}
                                  </div>
                                  {/* Position Dots & Labels */}
                                  <div className="flex items-center gap-1.5">
                                    {/* Primary Positions (100% - #10B982) */}
                                    {app.primaryPositions?.map((pos, idx) => (
                                      <div key={`p-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                        <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {/* Secondary Positions (75% - #FACC16) */}
                                    {app.secondaryPositions?.map((pos, idx) => (
                                      <div key={`s-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FACC16]" />
                                        <span className="text-[12px] font-medium text-[#FACC16] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {/* Tertiary Positions (50% - #FB933C) */}
                                    {app.tertiaryPositions?.map((pos, idx) => (
                                      <div key={`t-${idx}`} className="flex items-center gap-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FB933C]" />
                                        <span className="text-[12px] font-medium text-[#FB933C] uppercase">{pos}</span>
                                      </div>
                                    ))}
                                    {/* Fallback for old data or simpler summary - Updated to use #10B982 instead of gray */}
                                    {!app.primaryPositions && !app.secondaryPositions && !app.tertiaryPositions && (
                                      app.position ? app.position.split('/').map((pos, idx) => (
                                        <div key={idx} className="flex items-center gap-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B982]" />
                                          <span className="text-[12px] font-medium text-[#10B982] uppercase">{pos.trim()}</span>
                                        </div>
                                      )) : (
                                        <span className="text-[10px] font-medium text-slate-300 italic">{t('notSet' as any)}</span>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {detailTab === DetailPageTab.PENDING ? (
                                  <>
                                    <button
                                      onClick={() => cancelApplication(room.id, app)}
                                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                                    >
                                      {t('reject' as any)}
                                    </button>
                                    <button
                                      onClick={() => handleApproveApplicant(room, app)}
                                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[12px] font-medium transition-all active:scale-95"
                                    >
                                      {t('approve' as any)}
                                    </button>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2 relative">
                                    {activeActionMenuId === app.id ? (
                                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                                        <button
                                          onClick={() => {
                                            const isCurrentlyEditing = editingApplicantId === app.id;
                                            setEditingApplicantId(isCurrentlyEditing ? null : app.id);
                                            if (isCurrentlyEditing) {
                                              setActiveActionMenuId(null);
                                            }
                                          }}
                                          className={`text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 rounded-md transition-all active:scale-95 ${editingApplicantId === app.id ? 'bg-slate-900 dark:bg-white dark:text-slate-900' : 'bg-[#EDAE73]'}`}
                                        >
                                          {editingApplicantId === app.id ? t('confirm' as any) : '수정'}
                                        </button>
                                        <button
                                          onClick={() => {
                                            const isMember = players.some(p => p.name === app.name);
                                            cancelApplication(room.id, app);
                                            if (!isMember) {
                                              setMemberSuggestion({ isOpen: true, applicant: app });
                                            }
                                            setActiveActionMenuId(null);
                                          }}
                                          className="text-[14px] font-medium text-[#FFFFFF] px-2 py-0.5 bg-[#53B175] rounded-md transition-all active:scale-95"
                                        >
                                          제외
                                        </button>
                                        <button
                                          onClick={() => setActiveActionMenuId(null)}
                                          className="p-1 text-slate-300 dark:text-slate-600"
                                        >
                                          <Icons.CloseIcon />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setActiveActionMenuId(app.id)}
                                        className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-full transition-colors"
                                      >
                                        <Icons.MoreIcon />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Inline Editor for Approved Participants */}
                            {editingApplicantId === app.id && detailTab === DetailPageTab.APPROVED && (
                              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[24px] p-4 mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-5 gap-1.5">
                                  {(room.tierMode === '3TIER' ? ['S', 'A', 'B'] : ['S', 'A', 'B', 'C', 'D']).map(v => (
                                    <button
                                      key={v}
                                      onClick={() => handleUpdateApplicant(room, app.id, { tier: v })}
                                      className={`py-2 rounded-xl font-medium text-[11px] transition-all ${app.tier === v ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-950 text-slate-400'}`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-2">
                                  <FormationPicker
                                    sport={room.sport as SportType}
                                    primaryP={app.primaryPositions || (app.position ? app.position.split('/') as Position[] : [])}
                                    secondaryP={app.secondaryPositions || []}
                                    tertiaryP={app.tertiaryPositions || []}
                                    forbiddenP={app.forbiddenPositions || []}
                                    lang={lang}
                                    onChange={(p, s, t, f) => handleUpdateApplicant(room, app.id, {
                                      primaryPositions: p,
                                      secondaryPositions: s,
                                      tertiaryPositions: t,
                                      forbiddenPositions: f,
                                      position: p.join('/') // Keep for backward compatibility
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Empty State */}
                      {(detailTab === DetailPageTab.PENDING ? pendingApplicants : room.applicants.filter(a => a.isApproved)).length === 0 && (
                        <div className="py-16 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto">
                            <Icons.UsersIcon size={24} className="text-slate-200 dark:text-slate-800" />
                          </div>
                          <p className="text-[13px] font-medium text-slate-300 dark:text-slate-700 tracking-tight">{t('noPlayers' as any)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Backdrop for Balance Settings Overlay */}
                  {isBalanceSettingsOpen && (
                    <div
                      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                      onClick={() => {
                        setIsBalanceSettingsOpen(false);
                        setIsQuotaSettingsExpanded(false);
                      }}
                    />
                  )}

                  <div
                    className={`fixed left-0 right-0 z-50 flex flex-col items-center transition-all duration-300 ${isBalanceSettingsOpen ? 'bottom-0 bg-white dark:bg-slate-900 rounded-t-[32px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.15)]' : ''}`}
                    style={{
                      bottom: isBalanceSettingsOpen
                        ? 0
                        : (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))'),
                      paddingBottom: isBalanceSettingsOpen
                        ? (isAdFree ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 'calc(56px + 20px + env(safe-area-inset-bottom, 0px))')
                        : 0
                    }}
                  >
                    <div className={`w-full max-w-lg px-5 ${isBalanceSettingsOpen ? 'pt-5' : ''}`}>
                      {/* Settings Overlay - Content inside the Bottom Sheet */}
                      {isBalanceSettingsOpen && (
                        <div className="w-full mb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          {/* Position Quotas Accordion */}
                          <div className="overflow-hidden">
                            <button
                              onClick={() => setIsQuotaSettingsExpanded(!isQuotaSettingsExpanded)}
                              className="w-full py-3 relative flex items-center justify-center bg-[#eeeeee] rounded-[24px] text-[#111111] font-medium text-[16px] tracking-tight active:scale-[0.98] transition-all"
                            >
                              <span style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
                                {t('positionSettings')}
                              </span>
                              <div className={`absolute right-6 transition-transform duration-300 ${isQuotaSettingsExpanded ? 'rotate-180' : ''} text-[#111111]/50`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                              </div>
                            </button>

                            {isQuotaSettingsExpanded && (
                              <div className="pt-4 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <QuotaFormationPicker
                                  sport={room.sport as SportType}
                                  quotas={quotas}
                                  lang={lang}
                                  onUpdate={updateQuota}
                                  onToggleMode={toggleQuotaMode}
                                  darkMode={darkMode}
                                />
                              </div>
                            )}
                          </div>

                          {/* Random Mix & Team Count Divided Rows */}
                          <div className="space-y-3 mt-1">
                            <div className="py-3 bg-white rounded-[24px] px-5 flex items-center">
                              <button
                                onClick={() => setUseRandomMix(!useRandomMix)}
                                className="w-full flex items-center justify-between transition-all text-[#111111]"
                              >
                                <span className="text-[16px] font-medium tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('randomMix')}</span>
                                <div className={`w-[18px] h-[18px] rounded-sm flex items-center justify-center border-[1.5px] transition-all ${useRandomMix ? 'bg-[#777777] border-[#777777]' : 'border-[#777777]'}`}>
                                  {useRandomMix && <Icons.CheckIcon size={12} className="text-white" />}
                                </div>
                              </button>
                            </div>

                            <div className="py-3 bg-white rounded-[24px] px-5 flex items-center justify-between">
                              <span className="text-[16px] font-medium text-[#111111] tracking-tight" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{t('teamCountLabel')}</span>
                              <div className="flex items-center gap-4">
                                <button onClick={() => setTeamCount(Math.max(2, teamCount - 1))} className="p-1 text-[#111111] hover:opacity-60 active:scale-90 transition-all"><Icons.MinusIcon size={16} /></button>
                                <span className="text-[16px] font-medium text-[#111111] tracking-tight tabular-nums w-4 text-center" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>{teamCount}</span>
                                <button onClick={() => setTeamCount(Math.min(10, teamCount + 1))} className="p-1 text-[#111111] hover:opacity-60 active:scale-90 transition-all"><Icons.PlusIcon size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (!isBalanceSettingsOpen) {
                            setIsBalanceSettingsOpen(true);
                            return;
                          }

                          const approvedApps = room.applicants.filter(a => a.isApproved);
                          if (approvedApps.length < 2) {
                            showAlert(t('minPlayersAlert', 2, approvedApps.length));
                            return;
                          }

                          // Prepare manual players list for immediate generation
                          const manualPlayers: Player[] = approvedApps.map(app => {
                            const tierVal = isNaN(Number(app.tier)) ? (Tier as any)[app.tier] : Number(app.tier);
                            return {
                              id: 'temp_' + app.name + '_' + Math.random().toString(36).substr(2, 5),
                              name: app.name,
                              tier: tierVal,
                              isActive: true,
                              sportType: room.sport as SportType,
                              primaryPositions: (app.primaryPositions as Position[]) || (app.position ? [app.position as Position] : []),
                              secondaryPositions: (app.secondaryPositions as Position[]) || [],
                              tertiaryPositions: (app.tertiaryPositions as Position[]) || []
                            };
                          });

                          // [CRITICAL] 쿼터 정합성 체크 (사후 알림)
                          const perTeamCount = Math.floor(manualPlayers.length / teamCount);

                          // 현재 종목의 유효 포지션만 필터링하여 쿼터 합계 계산
                          const targetSportSub = room.sport as SportType;
                          const validPosForSport =
                            targetSportSub === SportType.SOCCER ? ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
                              targetSportSub === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
                                targetSportSub === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                                  ['NONE'];

                          const totalQuotaSum = Object.entries(quotas).reduce((sum, [pos, v]) => {
                            if (validPosForSport.includes(pos as any)) {
                              return (sum as number) + (Number(v) || 0);
                            }
                            return sum as number;
                          }, 0);

                          if ((totalQuotaSum as number) > (perTeamCount as number)) {
                            showAlert(t('quotaOverMaxAlert' as any, perTeamCount, totalQuotaSum));
                            return;
                          }

                          // Update main state in background
                          setPlayers(prev => {
                            const newList = [...prev];
                            approvedApps.forEach(app => {
                              const existing = newList.find(p => p.name === app.name);
                              if (existing) {
                                existing.isActive = true;
                              } else {
                                const tierVal = isNaN(Number(app.tier)) ? (Tier as any)[app.tier] : Number(app.tier);
                                newList.push({
                                  id: 'p_' + Math.random().toString(36).substr(2, 9),
                                  name: app.name,
                                  tier: tierVal,
                                  isActive: true,
                                  sportType: room.sport as SportType,
                                  primaryPosition: (app.position as Position) || 'NONE',
                                  primaryPositions: (app.primaryPositions as Position[]) || [],
                                  secondaryPositions: (app.secondaryPositions as Position[]) || [],
                                  tertiaryPositions: (app.tertiaryPositions as Position[]) || []
                                });
                              }
                            });
                            return newList;
                          });

                          setResult(null);
                          setSelectedPlayerIds([]);
                          setSelectionMode(null);

                          // Execute generation with direct data to avoid async state issues
                          handleGenerate(manualPlayers, room.sport as SportType);

                          setIsBalanceSettingsOpen(false);
                        }}
                        className={`w-full py-3 rounded-[24px] text-[16px] font-semibold flex items-center justify-center gap-3 transition-all active:scale-[0.98] active:brightness-95 ${isBalanceSettingsOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-slate-900/40 dark:shadow-white/20'}`}
                        style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}
                      >
                        {t('generateTeams' as any)}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )
      }

      {/* Bottom Tabs Content (Home page context) */}

      {/* 회원목록 탭 내용 */}
      {
        currentBottomTab === BottomTabType.MEMBERS && (
          <div className="w-full px-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('memberList' as any)}</h3>
            </div>
            {renderMembersTabContent()}
          </div>
        )
      }

      {/* 설정 탭 (추후 구현) */}
      {
        currentBottomTab === BottomTabType.SETTINGS && (
          <div className="w-full px-5 py-20 text-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300">
              <SettingsIcon />
            </div>
            <p className="text-sm font-bold text-slate-400">{t('comingSoon')}</p>
          </div>
        )
      }

      {
        result && currentPage !== AppPageType.BALANCE && (
          <div id="results-capture-section" className="fixed inset-0 z-[3000] bg-white dark:bg-slate-950 flex flex-col px-5 py-4 animate-in fade-in duration-300 overflow-y-auto">
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
        )
      }

      {/* 선택 모드 하단 제어 바 */}
      {
        selectionMode && (
          <div
            className="fixed left-0 right-0 z-[2100] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 animate-in slide-in-from-bottom duration-300"
            style={{
              bottom: currentPage === AppPageType.DETAIL
                ? (isAdFree ? 'env(safe-area-inset-bottom, 0px)' : 'calc(90px + env(safe-area-inset-bottom, 0px))')
                : 'calc(60px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: currentPage === AppPageType.DETAIL
                ? (isAdFree ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '1rem')
                : '1rem'
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
        )
      }


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
        isOpen={memberSuggestion.isOpen}
        title={t('suggestMemberTitle' as any)}
        message={t('suggestMemberMsg' as any, memberSuggestion.applicant?.name || '')}
        confirmText={t('register' as any)}
        cancelText={t('skip' as any)}
        onConfirm={() => {
          if (memberSuggestion.applicant) {
            const app = memberSuggestion.applicant;
            const p1 = (app as any).primaryPositions || [app.position || 'NONE'];
            const s1 = (app as any).secondaryPositions || [];
            const t1 = (app as any).tertiaryPositions || [];
            const f1 = (app as any).forbiddenPositions || [];

            const newPlayer: Player = {
              id: 'p_' + Math.random().toString(36).substr(2, 9),
              name: app.name,
              tier: (Tier as any)[app.tier] || Tier.B,
              isActive: false, // Don't make them active in match sense, just in list
              sportType: currentActiveRoom?.sport as SportType || activeTab,
              primaryPosition: p1[0] || 'NONE',
              primaryPositions: p1,
              secondaryPosition: s1[0] || 'NONE',
              secondaryPositions: s1,
              tertiaryPosition: t1[0] || 'NONE',
              tertiaryPositions: t1,
              forbiddenPositions: f1
            };
            setPlayers(prev => [...prev, newPlayer]);
          }
          setMemberSuggestion({ isOpen: false, applicant: null });
        }}
        onCancel={() => setMemberSuggestion({ isOpen: false, applicant: null })}
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
      <LoginPage
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
      <div className="h-[180px]" />
      {/* Bottom Tab Bar - Positioned above the Ad Banner */}
      {
        currentPage === AppPageType.HOME && (
          <div className="fixed left-0 right-0 z-[4000] bg-[#F9F9F9] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]"
            style={{
              bottom: isAdFree ? '0px' : '56px',
              height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: isAdFree ? 'env(safe-area-inset-bottom, 0px)' : '0px'
            }}
          >
            <div className="flex h-[60px] max-w-lg mx-auto">
              <button
                onClick={() => setCurrentBottomTab(BottomTabType.HOME)}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
              >
                <div className={currentBottomTab === BottomTabType.HOME ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                  {currentBottomTab === BottomTabType.HOME ? <HomeFilledIcon /> : <HomeIcon />}
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
                  {currentBottomTab === BottomTabType.MEMBERS ? <UserPlusFilledIcon /> : <UserPlusIcon />}
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
                  {currentBottomTab === BottomTabType.SETTINGS ? <MoreFilledIcon /> : <MoreIcon />}
                </div>
                <span className={`text-[10px] font-bold ${currentBottomTab === BottomTabType.SETTINGS ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                  {t('settingsTab' as any)}
                </span>
              </button>
            </div>
          </div>
        )
      }

      {/* AdBanner placed above Bottom Tab Bar */}
      <AdBanner
        lang={lang}
        darkMode={darkMode}
        isAdFree={isAdFree}
        bottomOffset="0px"
      />
    </div >
  );
};

export default App;