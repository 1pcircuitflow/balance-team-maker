
import { TRANSLATIONS, Language } from '../../translations';
import { Position } from '../../types';

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
