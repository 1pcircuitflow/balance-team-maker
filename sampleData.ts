import { Player, Tier, SportType } from './types';
import { Language } from './translations';

export const SAMPLE_PLAYERS_BY_LANG: Record<Language, Player[]> = {
    ko: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['김민수', '이지혜', '박지훈', '최서연', '정우진', '강다은', '윤준호', '한미소', '임성민', '오유진'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
                const futAll = ['PIV', 'ALA', 'FIX', 'GK'];
                const bskAll = ['PG', 'SG', 'SF', 'PF', 'C'];

                let p1: any[] = [];
                let p2: any[] = [];
                let p3: any[] = [];
                let forbidden: any[] = [];

                if (isSoccer) {
                    if (i % 4 === 0) { // 멀티 포지션 (1지망 2개)
                        p1 = [socAll[i % 8], socAll[(i + 4) % 8]];
                        p2 = [socAll[(i + 1) % 8]];
                        p3 = [socAll[(i + 2) % 8]];
                    } else if (i % 4 === 1) { // 전문가 (1지망 1개 집중, 3지망 없음)
                        p1 = [socAll[i % 8]];
                        p2 = [socAll[(i + 1) % 8]];
                        p3 = [];
                    } else if (i % 4 === 2) { // 유연한 선수 (2, 3지망 다수)
                        p1 = [socAll[i % 8]];
                        p2 = [socAll[(i + 1) % 8], socAll[(i + 3) % 8]];
                        p3 = [socAll[(i + 2) % 8], socAll[(i + 5) % 8]];
                    } else { // 표준
                        p1 = [socAll[i % 8]];
                        p2 = [socAll[(i + 1) % 8]];
                        p3 = [socAll[(i + 2) % 8]];
                    }
                    forbidden = socAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isFutsal) {
                    if (i % 4 === 0) {
                        p1 = [futAll[i % 4], futAll[(i + 2) % 4]];
                        p2 = [futAll[(i + 1) % 4]];
                    } else if (i % 4 === 1) {
                        p1 = [futAll[i % 4]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [futAll[i % 4]];
                        p2 = [futAll[(i + 1) % 4]];
                        p3 = [futAll[(i + 2) % 4]];
                    }
                    forbidden = futAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isBasket) {
                    if (i % 4 === 0) {
                        p1 = [bskAll[i % 5], bskAll[(i + 2) % 5]];
                        p2 = [bskAll[(i + 1) % 5]];
                    } else if (i % 4 === 1) {
                        p1 = [bskAll[i % 5]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [bskAll[i % 5]];
                        p2 = [bskAll[(i + 1) % 5]];
                        p3 = [bskAll[(i + 2) % 5]];
                    }
                    forbidden = bskAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                }

                return {
                    id: `ko_${st}_${i}`,
                    name,
                    tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
                    isActive: false,
                    sportType: st,
                    primaryPositions: p1,
                    secondaryPositions: p2,
                    tertiaryPositions: p3,
                    forbiddenPositions: forbidden
                };
            })
        )
    ],
    en: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['John Smith', 'Emma Wilson', 'Michael Brown', 'Olivia Taylor', 'James Davis', 'Sophia Miller', 'Robert Johnson', 'Ava Garcia', 'Chris Evans', 'Jessica Parker'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
                const futAll = ['PIV', 'ALA', 'FIX', 'GK'];
                const bskAll = ['PG', 'SG', 'SF', 'PF', 'C'];

                let p1: any[] = [];
                let p2: any[] = [];
                let p3: any[] = [];
                let forbidden: any[] = [];

                if (isSoccer) {
                    if (i % 4 === 0) {
                        p1 = [socAll[(i + 2) % 8], socAll[(i + 6) % 8]];
                        p2 = [socAll[(i + 3) % 8]];
                    } else if (i % 4 === 1) {
                        p1 = [socAll[(i + 2) % 8]];
                        p2 = [socAll[(i + 3) % 8]];
                        p3 = [];
                    } else if (i % 4 === 2) {
                        p1 = [socAll[(i + 2) % 8]];
                        p2 = [socAll[(i + 3) % 8], socAll[(i + 5) % 8]];
                        p3 = [socAll[(i + 4) % 8], socAll[(i + 7) % 8]];
                    } else {
                        p1 = [socAll[(i + 2) % 8]];
                        p2 = [socAll[(i + 3) % 8]];
                        p3 = [socAll[(i + 4) % 8]];
                    }
                    forbidden = socAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isFutsal) {
                    if (i % 4 === 0) {
                        p1 = [futAll[(i + 1) % 4], futAll[(i + 3) % 4]];
                        p2 = [futAll[(i + 2) % 4]];
                    } else if (i % 4 === 1) {
                        p1 = [futAll[(i + 1) % 4]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [futAll[(i + 1) % 4]];
                        p2 = [futAll[(i + 2) % 4]];
                        p3 = [futAll[(i + 3) % 4]];
                    }
                    forbidden = futAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isBasket) {
                    if (i % 4 === 0) {
                        p1 = [bskAll[(i + 1) % 5], bskAll[(i + 3) % 5]];
                        p2 = [bskAll[(i + 2) % 5]];
                    } else if (i % 4 === 1) {
                        p1 = [bskAll[(i + 1) % 5]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [bskAll[(i + 1) % 5]];
                        p2 = [bskAll[(i + 2) % 5]];
                        p3 = [bskAll[(i + 3) % 5]];
                    }
                    forbidden = bskAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                }

                return {
                    id: `en_${st}_${i}`,
                    name,
                    tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
                    isActive: false,
                    sportType: st,
                    primaryPositions: p1,
                    secondaryPositions: p2,
                    tertiaryPositions: p3,
                    forbiddenPositions: forbidden
                };
            })
        )
    ],
    pt: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['João Silva', 'Maria Santos', 'Lucas Pereira', 'Ana Costa', 'Gabriel Rodrigues', 'Juliana Oliveira', 'Pedro Fernandes', 'Larissa Souza', 'Rafael Almeida', 'Camila Lima'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
                const futAll = ['PIV', 'ALA', 'FIX', 'GK'];
                const bskAll = ['PG', 'SG', 'SF', 'PF', 'C'];

                let p1: any[] = [];
                let p2: any[] = [];
                let p3: any[] = [];
                let forbidden: any[] = [];

                if (isSoccer) {
                    if (i % 4 === 0) {
                        p1 = [socAll[(i + 4) % 8], socAll[(i + 0) % 8]];
                        p2 = [socAll[(i + 5) % 8]];
                    } else if (i % 4 === 1) {
                        p1 = [socAll[(i + 4) % 8]];
                        p2 = []; p3 = [];
                    } else if (i % 4 === 2) {
                        p1 = [socAll[(i + 4) % 8]];
                        p2 = [socAll[(i + 5) % 8], socAll[(i + 7) % 8]];
                        p3 = [socAll[(i + 6) % 8]];
                    } else {
                        p1 = [socAll[(i + 4) % 8]];
                        p2 = [socAll[(i + 5) % 8]];
                        p3 = [socAll[(i + 6) % 8]];
                    }
                    forbidden = socAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isFutsal) {
                    if (i % 4 === 0) {
                        p1 = [futAll[(i + 2) % 4], futAll[(i + 0) % 4]];
                        p2 = [futAll[(i + 3) % 4]];
                    } else if (i % 4 === 1) {
                        p1 = [futAll[(i + 2) % 4]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [futAll[(i + 2) % 4]];
                        p2 = [futAll[(i + 3) % 4]];
                        p3 = [futAll[(i + 0) % 4]];
                    }
                    forbidden = futAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isBasket) {
                    if (i % 4 === 0) {
                        p1 = [bskAll[(i + 2) % 5], bskAll[(i + 0) % 5]];
                        p2 = [bskAll[(i + 3) % 5]];
                    } else if (i % 4 === 1) {
                        p1 = [bskAll[(i + 2) % 5]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [bskAll[(i + 2) % 5]];
                        p2 = [bskAll[(i + 3) % 5]];
                        p3 = [bskAll[(i + 4) % 5]];
                    }
                    forbidden = bskAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                }

                return {
                    id: `pt_${st}_${i}`,
                    name,
                    tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
                    isActive: false,
                    sportType: st,
                    primaryPositions: p1,
                    secondaryPositions: p2,
                    tertiaryPositions: p3,
                    forbiddenPositions: forbidden
                };
            })
        )
    ],
    es: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['Carlos García', 'Lucía Fernández', 'Javier Rodríguez', 'Elena Martínez', 'Diego López', 'Marta Sánchez', 'Pablo Ruiz', 'Sara Morales', 'Jorge Castro', 'Paula Ortiz'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
                const futAll = ['PIV', 'ALA', 'FIX', 'GK'];
                const bskAll = ['PG', 'SG', 'SF', 'PF', 'C'];

                let p1: any[] = [];
                let p2: any[] = [];
                let p3: any[] = [];
                let forbidden: any[] = [];

                if (isSoccer) {
                    if (i % 4 === 0) {
                        p1 = [socAll[(i + 6) % 8], socAll[(i + 2) % 8]];
                        p2 = [socAll[(i + 7) % 8]];
                    } else if (i % 4 === 1) {
                        p1 = [socAll[(i + 6) % 8]];
                        p2 = [socAll[(i + 7) % 8]];
                        p3 = [];
                    } else if (i % 4 === 2) {
                        p1 = [socAll[(i + 6) % 8]];
                        p2 = [socAll[(i + 7) % 8], socAll[(i + 1) % 8]];
                        p3 = [socAll[(i + 0) % 8], socAll[(i + 3) % 8]];
                    } else {
                        p1 = [socAll[(i + 6) % 8]];
                        p2 = [socAll[(i + 7) % 8]];
                        p3 = [socAll[(i + 0) % 8]];
                    }
                    forbidden = socAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isFutsal) {
                    if (i % 4 === 0) {
                        p1 = [futAll[(i + 3) % 4], futAll[(i + 1) % 4]];
                    } else if (i % 4 === 1) {
                        p1 = [futAll[(i + 3) % 4]];
                        p2 = []; p3 = [];
                    } else {
                        p1 = [futAll[(i + 3) % 4]];
                        p2 = [futAll[(i + 0) % 4]];
                        p3 = [futAll[(i + 1) % 4]];
                    }
                    forbidden = futAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isBasket) {
                    if (i % 4 === 0) {
                        p1 = [bskAll[(i + 3) % 5], bskAll[(i + 1) % 5]];
                    } else if (i % 4 === 1) {
                        p1 = [bskAll[(i + 3) % 5]];
                    } else {
                        p1 = [bskAll[(i + 3) % 5]];
                        p2 = [bskAll[(i + 4) % 5]];
                        p3 = [bskAll[(i + 0) % 5]];
                    }
                    forbidden = bskAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                }

                return {
                    id: `es_${st}_${i}`,
                    name,
                    tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
                    isActive: false,
                    sportType: st,
                    primaryPositions: p1,
                    secondaryPositions: p2,
                    tertiaryPositions: p3,
                    forbiddenPositions: forbidden
                };
            })
        )
    ],
    ja: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['田中 太郎', '佐藤 花子', '鈴木 一郎', '高橋 健太', '伊藤 結衣', '渡辺 誠', '山本 翔太', '中村 文子', '小林 健二', '加藤 恵'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
                const futAll = ['PIV', 'ALA', 'FIX', 'GK'];
                const bskAll = ['PG', 'SG', 'SF', 'PF', 'C'];

                let p1: any[] = [];
                let p2: any[] = [];
                let p3: any[] = [];
                let forbidden: any[] = [];

                if (isSoccer) {
                    if (i % 4 === 0) {
                        p1 = [socAll[(i + 1) % 8], socAll[(i + 5) % 8]];
                    } else if (i % 4 === 1) {
                        p1 = [socAll[(i + 1) % 8]];
                        p2 = []; p3 = [];
                    } else if (i % 4 === 2) {
                        p1 = [socAll[(i + 1) % 8]];
                        p2 = [socAll[(i + 2) % 8], socAll[(i + 4) % 8]];
                        p3 = [socAll[(i + 3) % 8], socAll[(i + 6) % 8]];
                    } else {
                        p1 = [socAll[(i + 1) % 8]];
                        p2 = [socAll[(i + 2) % 8]];
                        p3 = [socAll[(i + 3) % 8]];
                    }
                    forbidden = socAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isFutsal) {
                    if (i % 4 === 0) {
                        p1 = [futAll[(i + 2) % 4], futAll[(i + 0) % 4]];
                    } else if (i % 4 === 1) {
                        p1 = [futAll[(i + 2) % 4]];
                    } else {
                        p1 = [futAll[(i + 2) % 4]];
                        p2 = [futAll[(i + 3) % 4]];
                        p3 = [futAll[(i + 0) % 4]];
                    }
                    forbidden = futAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                } else if (isBasket) {
                    if (i % 4 === 0) {
                        p1 = [bskAll[(i + 4) % 5], bskAll[(i + 2) % 5]];
                    } else if (i % 4 === 1) {
                        p1 = [bskAll[(i + 4) % 5]];
                    } else {
                        p1 = [bskAll[(i + 4) % 5]];
                        p2 = [bskAll[(i + 0) % 5]];
                        p3 = [bskAll[(i + 1) % 5]];
                    }
                    forbidden = bskAll.filter(pos => !p1.includes(pos) && !p2.includes(pos) && !p3.includes(pos));
                }

                return {
                    id: `ja_${st}_${i}`,
                    name,
                    tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
                    isActive: false,
                    sportType: st,
                    primaryPositions: p1,
                    secondaryPositions: p2,
                    tertiaryPositions: p3,
                    forbiddenPositions: forbidden
                };
            })
        )
    ],
};
