import { Player, Tier, SportType } from './types';
import { Language } from './translations';

export const SAMPLE_PLAYERS_BY_LANG: Record<Language, Player[]> = {
    ko: [
        // 축구 (10명)
        ...[
            { name: '손흥민', p1: ['LW', 'ST'], p2: ['RW'], p3: ['MF'], tier: Tier.S },
            { name: '김민재', p1: ['DF'], p2: ['LB', 'RB'], p3: ['MF'], tier: Tier.S },
            { name: '이강인', p1: ['MF', 'RW'], p2: ['LW'], p3: ['ST'], tier: Tier.S },
            { name: '황희찬', p1: ['LW', 'ST'], p2: ['RW'], p3: ['MF'], tier: Tier.A },
            { name: '조규성', p1: ['ST'], p2: ['LW', 'RW'], p3: ['MF'], tier: Tier.A },
            { name: '이재성', p1: ['MF'], p2: ['LW', 'RW'], p3: ['ST'], tier: Tier.A },
            { name: '황인범', p1: ['MF'], p2: ['DF'], p3: [], tier: Tier.A },
            { name: '설영우', p1: ['LB', 'RB'], p2: ['DF'], p3: ['MF'], tier: Tier.B },
            { name: '김영권', p1: ['DF'], p2: ['LB'], p3: [], tier: Tier.B },
            { name: '조현우', p1: ['GK'], p2: [], p3: [], tier: Tier.A },
        ].map((p, i) => ({
            id: `ko_soccer_${i}`,
            name: p.name,
            tier: p.tier,
            isActive: false,
            sportType: SportType.SOCCER,
            primaryPositions: p.p1,
            secondaryPositions: p.p2,
            tertiaryPositions: p.p3,
            forbiddenPositions: ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'].filter(pos => !p.p1.includes(pos) && !p.p2.includes(pos) && !p.p3.includes(pos))
        })),
        // 풋살 (10명)
        ...[
            { name: '박지성', p1: ['FIX'], p2: ['ALA'], p3: ['PIV'], tier: Tier.S },
            { name: '이영표', p1: ['ALA'], p2: ['FIX'], p3: [], tier: Tier.A },
            { name: '김병지', p1: ['GK'], p2: ['PIV'], p3: ['ALA'], tier: Tier.A },
            { name: '안정환', p1: ['PIV'], p2: ['ALA'], p3: [], tier: Tier.A },
            { name: '이동국', p1: ['PIV'], p2: ['ALA'], p3: [], tier: Tier.A },
            { name: '구자철', p1: ['ALA'], p2: ['FIX'], p3: ['PIV'], tier: Tier.B },
            { name: '기성용', p1: ['FIX'], p2: ['ALA'], p3: [], tier: Tier.A },
            { name: '차두리', p1: ['ALA'], p2: ['FIX'], p3: [], tier: Tier.B },
            { name: '최용수', p1: ['PIV'], p2: [], p3: [], tier: Tier.B },
            { name: '김동진', p1: ['FIX'], p2: ['ALA'], p3: [], tier: Tier.B },
        ].map((p, i) => ({
            id: `ko_futsal_${i}`,
            name: p.name,
            tier: p.tier,
            isActive: false,
            sportType: SportType.FUTSAL,
            primaryPositions: p.p1,
            secondaryPositions: p.p2,
            tertiaryPositions: p.p3,
            forbiddenPositions: ['PIV', 'ALA', 'FIX', 'GK'].filter(pos => !p.p1.includes(pos) && !p.p2.includes(pos) && !p.p3.includes(pos))
        })),
        // 농구 (10명)
        ...[
            { name: '허웅', p1: ['SG'], p2: ['PG'], p3: ['SF'], tier: Tier.S },
            { name: '허훈', p1: ['PG'], p2: ['SG'], p3: ['SF'], tier: Tier.S },
            { name: '김선형', p1: ['PG'], p2: ['SG'], p3: [], tier: Tier.A },
            { name: '이대성', p1: ['SG'], p2: ['PG'], p3: ['SF'], tier: Tier.A },
            { name: '최준용', p1: ['SF', 'PF'], p2: ['PG'], p3: ['SG'], tier: Tier.S },
            { name: '송교창', p1: ['SF'], p2: ['PF'], p3: ['SG'], tier: Tier.A },
            { name: '강상재', p1: ['PF'], p2: ['C'], p3: ['SF'], tier: Tier.A },
            { name: '라건아', p1: ['C'], p2: ['PF'], p3: [], tier: Tier.S },
            { name: '하윤기', p1: ['C'], p2: ['PF'], p3: [], tier: Tier.A },
            { name: '이정현', p1: ['PG'], p2: ['SG'], p3: [], tier: Tier.B },
        ].map((p, i) => ({
            id: `ko_basketball_${i}`,
            name: p.name,
            tier: p.tier,
            isActive: false,
            sportType: SportType.BASKETBALL,
            primaryPositions: p.p1,
            secondaryPositions: p.p2,
            tertiaryPositions: p.p3,
            forbiddenPositions: ['PG', 'SG', 'SF', 'PF', 'C'].filter(pos => !p.p1.includes(pos) && !p.p2.includes(pos) && !p.p3.includes(pos))
        })),
        // 일반 (10명)
        ...['김민수', '이지혜', '박지훈', '최서연', '정우진', '강다은', '윤준호', '한미소', '임성민', '오유진'].map((name, i) => ({
            id: `ko_general_${i}`,
            name,
            tier: (i % 5 === 0) ? Tier.S : (i % 3 === 0) ? Tier.A : (i % 2 === 0) ? Tier.B : Tier.C,
            isActive: false,
            sportType: SportType.GENERAL,
            primaryPositions: [],
            secondaryPositions: [],
            tertiaryPositions: [],
            forbiddenPositions: []
        }))
    ],
    en: [
        ...[SportType.SOCCER, SportType.FUTSAL, SportType.BASKETBALL, SportType.GENERAL].flatMap((st) =>
            ['(Sample) John Smith', '(Sample) Emma Wilson', '(Sample) Michael Brown', '(Sample) Olivia Taylor', '(Sample) James Davis', '(Sample) Sophia Miller', '(Sample) Robert Johnson', '(Sample) Ava Garcia', '(Sample) Chris Evans', '(Sample) Jessica Parker'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
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
            ['(Exemplo) João Silva', '(Exemplo) Maria Santos', '(Exemplo) Lucas Pereira', '(Exemplo) Ana Costa', '(Exemplo) Gabriel Rodrigues', '(Exemplo) Juliana Oliveira', '(Exemplo) Pedro Fernandes', '(Exemplo) Larissa Souza', '(Exemplo) Rafael Almeida', '(Exemplo) Camila Lima'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
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
            ['(Ejemplo) Carlos García', '(Ejemplo) Lucía Fernández', '(Ejemplo) Javier Rodríguez', '(Ejemplo) Elena Martínez', '(Ejemplo) Diego López', '(Ejemplo) Marta Sánchez', '(Ejemplo) Pablo Ruiz', '(Ejemplo) Sara Morales', '(Ejemplo) Jorge Castro', '(Ejemplo) Paula Ortiz'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
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
            ['(例) 田中 太郎', '(例) 佐藤 花子', '(例) 鈴木 一郎', '(例) 高橋 健太', '(例) 伊藤 結衣', '(例) 渡辺 誠', '(例) 山本 翔太', '(例) 中村 文子', '(例) 小林 健二', '(例) 加藤 恵'].map((name, i) => {
                const isSoccer = st === SportType.SOCCER;
                const isFutsal = st === SportType.FUTSAL;
                const isBasket = st === SportType.BASKETBALL;

                const socAll = ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
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
