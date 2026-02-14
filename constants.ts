
import { Tier, SportType, Position } from './types';

export const POSITIONS_BY_SPORT: Record<SportType, Position[]> = {
  [SportType.SOCCER]: ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'],
  [SportType.FUTSAL]: ['PIV', 'ALA', 'FIX', 'GK'],
  [SportType.BASKETBALL]: ['PG', 'SG', 'SF', 'PF', 'C'],
  [SportType.GENERAL]: ['NONE'],
  [SportType.ALL]: ['NONE'],
};

export const TIER_COLORS: Record<Tier, string> = {
  [Tier.S]: 'bg-indigo-600',
  [Tier.A]: 'bg-rose-500',
  [Tier.B]: 'bg-orange-500',
  [Tier.C]: 'bg-emerald-500',
  [Tier.D]: 'bg-slate-400',
};

export const STORAGE_KEY = 'futsal_balance_pro_players_v3';

export const TIER_BADGE_COLORS: Record<Tier, string> = {
  [Tier.S]: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  [Tier.A]: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  [Tier.B]: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [Tier.C]: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  [Tier.D]: 'bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-500',
};

export const SPORT_IMAGES: Record<SportType, string[]> = {
  [SportType.SOCCER]: ['/images/soccer-1.jpeg', '/images/soccer-2.jpeg'],
  [SportType.FUTSAL]: ['/images/futsal-1.jpeg', '/images/futsal-2.jpeg'],
  [SportType.BASKETBALL]: ['/images/basketball-1.jpeg', '/images/basketball-2.jpeg'],
  [SportType.GENERAL]: ['/images/tennis-1.jpeg', '/images/tennis-2.jpeg'],
  [SportType.ALL]: ['/images/tennis-1.jpeg', '/images/tennis-2.jpeg']
};

export const TEAM_COLORS = [
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

export const Z_INDEX = {
  INFO_MODAL: 1100,
  REVIEW_PROMPT: 1200,
  LANGUAGE_MENU: 1500,
  POSITION_LIMIT: 1600,
  DEFAULT_MODAL: 2000,
  STICKY_HEADER: 2000,
  PAGE_OVERLAY: 2000,
  SELECTION_BAR: 2100,
  LOGIN_RECOMMEND: 2500,
  MEMBER_PICKER: 2500,
  REWARD_AD: 2500,
  GUIDE_MODAL: 3000,
  RESULT_OVERLAY: 3000,
  FILTER_DROPDOWN: 3000,
  FAB_BUTTON: 3500,
  BOTTOM_TAB: 4000,
  TOAST: 4500,
  LOADING_OVERLAY: 5000,
  ALERT_MODAL: 8000,
  OFFLINE_BANNER: 9999,
  UPDATE_MODAL: 9999,
} as const;

export const FORMATION_POSITIONS: Record<SportType, { id: Position; x: string; y: string }[]> = {
  [SportType.SOCCER]: [
    { id: 'GK', x: '50%', y: '85%' },
    { id: 'LB', x: '15%', y: '65%' },
    { id: 'DF', x: '50%', y: '65%' },
    { id: 'RB', x: '85%', y: '65%' },
    { id: 'MF', x: '50%', y: '42%' },
    { id: 'LW', x: '15%', y: '25%' },
    { id: 'ST', x: '50%', y: '18%' },
    { id: 'RW', x: '85%', y: '25%' },
  ],
  [SportType.FUTSAL]: [
    { id: 'GK', x: '50%', y: '82%' },
    { id: 'FIX', x: '50%', y: '62%' },
    { id: 'ALA', x: '50%', y: '40%' },
    { id: 'PIV', x: '50%', y: '18%' },
  ],
  [SportType.BASKETBALL]: [
    { id: 'PG', x: '35%', y: '72%' },
    { id: 'SG', x: '65%', y: '72%' },
    { id: 'SF', x: '25%', y: '45%' },
    { id: 'PF', x: '75%', y: '45%' },
    { id: 'C', x: '50%', y: '28%' },
  ],
  [SportType.GENERAL]: [],
  [SportType.ALL]: [],
};
