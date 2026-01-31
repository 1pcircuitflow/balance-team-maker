
import { Tier, SportType, SoccerPosition, BasketballPosition } from './types';

export const TIER_LABELS: Record<Tier, string> = {
  [Tier.S]: 'S (Elite)',
  [Tier.A]: 'A (Pro)',
  [Tier.B]: 'B (Regular)',
  [Tier.C]: 'C (Amateur)',
  [Tier.D]: 'D (Beginner)',
};

// Updated from App.tsx - Enhanced with gradients and better contrast
export const TIER_COLORS: Record<Tier, string> = {
  [Tier.S]: 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/30',
  [Tier.A]: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/30',
  [Tier.B]: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30',
  [Tier.C]: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/30',
  [Tier.D]: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const TEAM_COLORS = [
  { name: 'color_red', value: '#EF4444' },
  { name: 'color_orange', value: '#F97316' },
  { name: 'color_yellow', value: '#EAB308' },
  { name: 'color_green', value: '#10B981' },
  { name: 'color_blue', value: '#3B82F6' },
  { name: 'color_pink', value: '#EC4899' },
  { name: 'color_purple', value: '#A855F7' },
  { name: 'color_white', value: '#FFFFFF' },
  { name: 'color_black', value: '#000000' },
  { name: 'color_gray', value: '#64748B' },
];

export const SPORT_LABELS: Record<SportType, string> = {
  [SportType.GENERAL]: '일반',
  [SportType.SOCCER]: '축구',
  [SportType.FUTSAL]: '풋살',
  [SportType.BASKETBALL]: '농구',
};

export const SOCCER_POSITIONS: Record<SoccerPosition, string> = {
  FW: '공격 (FW)',
  LW: '좌측 윙 (LW)',
  RW: '우측 윙 (RW)',
  MF: '미드필더 (MF)',
  DF: '수비 (DF)',
  LB: '좌측 풀백 (LB)',
  RB: '우측 풀백 (RB)',
  GK: '골키퍼 (GK)',
  NONE: '없음',
};

export const BASKETBALL_POSITIONS: Record<BasketballPosition, string> = {
  PG: '포인트 가드 (PG)',
  SG: '슈팅 가드 (SG)',
  SF: '스몰 포워드 (SF)',
  PF: '파워 포워드 (PF)',
  C: '센터 (C)',
  NONE: '없음',
};

export const STORAGE_KEY = 'futsal_balance_pro_players_v3';
