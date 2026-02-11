
import { Position, Tier } from '../types';
import { TRANSLATIONS, Language } from '../translations';

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
