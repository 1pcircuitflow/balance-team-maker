
import { Tier, SportType, SoccerPosition, BasketballPosition } from './types';

export const TIER_LABELS: Record<Tier, string> = {
  [Tier.S]: 'S (Elite)',
  [Tier.A]: 'A (Pro)',
  [Tier.B]: 'B (Regular)',
  [Tier.C]: 'C (Amateur)',
  [Tier.D]: 'D (Beginner)',
};

export const TIER_COLORS: Record<Tier, string> = {
  [Tier.S]: 'bg-indigo-600',
  [Tier.A]: 'bg-rose-500',
  [Tier.B]: 'bg-orange-500',
  [Tier.C]: 'bg-emerald-500',
  [Tier.D]: 'bg-slate-400',
};

export const SPORT_LABELS: Record<SportType, string> = {
  [SportType.GENERAL]: '일반',
  [SportType.SOCCER]: '축구/풋살',
  [SportType.BASKETBALL]: '농구',
};

export const SOCCER_POSITIONS: Record<SoccerPosition, string> = {
  FW: '공격 (FW)',
  MF: '미드필더 (MF)',
  DF: '수비 (DF)',
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
