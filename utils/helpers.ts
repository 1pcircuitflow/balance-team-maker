
import { Player, Position, SportType, Tier } from '../types';
import { Applicant, RecruitmentRoom } from '../services/firebaseService';
import { TRANSLATIONS, Language } from '../translations';

/**
 * 신청자 상태를 일관되게 판단 (status 우선, 없으면 isApproved로 폴백)
 */
export const getApplicantStatus = (a: Applicant): 'PENDING' | 'APPROVED' | 'REJECTED' => {
  if (a.status) return a.status;
  return a.isApproved ? 'APPROVED' : 'PENDING';
};

/**
 * 승인된 인원 수를 일관되게 계산
 */
export const getApprovedCount = (applicants: Applicant[]): number => {
  return applicants.filter(a => getApplicantStatus(a) === 'APPROVED').length;
};

/**
 * 정원 초과 여부 판단
 */
export const isRoomFull = (room: RecruitmentRoom): boolean => {
  if (room.maxApplicants <= 0) return false;
  return getApprovedCount(room.applicants) >= room.maxApplicants;
};

export const compareVersions = (v1: string, v2: string) => {
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

export const getInitialLang = (): Language => {
  const manual = localStorage.getItem('app_lang_manual');
  if (manual) return manual as Language;
  const systemLang = navigator.language.split('-')[0];
  const supported: Language[] = ['ko', 'en', 'pt', 'es', 'ja'];
  return supported.includes(systemLang as any) ? systemLang as Language : 'en';
};

export const getPosLabel = (pos: Position, lang: Language): string => {
  const key = `pos_${pos.toLowerCase()}` as keyof typeof TRANSLATIONS['ko'];
  const translation = (TRANSLATIONS[lang] as any)[key];
  return typeof translation === 'string' ? translation : String(pos);
};

const TIER_NAME_TO_VALUE: Record<string, Tier> = { S: Tier.S, A: Tier.A, B: Tier.B, C: Tier.C, D: Tier.D };
const TIER_VALUE_TO_NAME: Record<number, string> = { 5: 'S', 4: 'A', 3: 'B', 2: 'C', 1: 'D' };

export const parseTier = (tierStr: string): Tier => {
  if (!isNaN(Number(tierStr))) return (Number(tierStr) as Tier) || Tier.B;
  return TIER_NAME_TO_VALUE[tierStr] ?? Tier.B;
};

export const tierToLabel = (tierStr: string): string => {
  if (!isNaN(Number(tierStr))) return TIER_VALUE_TO_NAME[Number(tierStr)] || 'B';
  return tierStr;
};

export const applicantToPlayer = (
  applicant: Applicant,
  sportType: SportType,
  options?: { isActive?: boolean; existingId?: string }
): Player => {
  const p1 = (applicant.primaryPositions as Position[])?.length > 0
    ? (applicant.primaryPositions as Position[])
    : (applicant.position ? [applicant.position as Position] : []);
  const s1 = (applicant.secondaryPositions as Position[])?.length > 0
    ? (applicant.secondaryPositions as Position[])
    : [];
  const t1 = (applicant.tertiaryPositions as Position[])?.length > 0
    ? (applicant.tertiaryPositions as Position[])
    : [];
  const f1 = (applicant.forbiddenPositions as Position[]) || [];

  return {
    id: options?.existingId || 'p_' + Math.random().toString(36).substr(2, 9),
    name: applicant.name,
    tier: parseTier(applicant.tier),
    isActive: options?.isActive ?? true,
    sportType,
    primaryPosition: (p1[0] || 'NONE') as Position,
    primaryPositions: p1,
    secondaryPosition: (s1[0] || 'NONE') as Position,
    secondaryPositions: s1,
    tertiaryPosition: (t1[0] || 'NONE') as Position,
    tertiaryPositions: t1,
    forbiddenPositions: f1,
  };
};

export const upsertPlayerFromApplicant = (
  players: Player[],
  applicant: Applicant,
  sportType: SportType,
  isActive?: boolean
): Player[] => {
  const existingIdx = players.findIndex(p => p.name === applicant.name && p.sportType === sportType);
  const newPlayer = applicantToPlayer(applicant, sportType, {
    isActive: isActive ?? true,
    existingId: existingIdx > -1 ? players[existingIdx].id : undefined,
  });

  if (existingIdx > -1) {
    const newList = [...players];
    newList[existingIdx] = { ...newList[existingIdx], ...newPlayer };
    return newList;
  }
  return [...players, newPlayer];
};
