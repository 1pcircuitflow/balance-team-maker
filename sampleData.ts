import { Player, Position, Tier, SportType } from './types';
import { Language } from './translations';

const SOC: Position[] = ['ST', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'];
const FUT: Position[] = ['PIV', 'ALA', 'FIX', 'GK'];
const BSK: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

type R = { n: string; t: Tier; p1: Position[]; p2: Position[]; p3: Position[] };

function build(lang: string, key: string, sport: SportType, allPos: Position[], data: R[]): Player[] {
    return data.map((d, i) => ({
        id: `${lang}_${key}_${i}`,
        name: d.n,
        tier: d.t,
        isActive: false,
        sportType: sport,
        primaryPositions: d.p1,
        secondaryPositions: d.p2,
        tertiaryPositions: d.p3,
        forbiddenPositions: allPos.filter(p => !d.p1.includes(p) && !d.p2.includes(p) && !d.p3.includes(p)),
    }));
}

const GT = [Tier.S, Tier.A, Tier.A, Tier.B, Tier.B, Tier.B, Tier.B, Tier.C, Tier.C, Tier.D];

function general(lang: string, names: string[]): Player[] {
    return names.map((name, i) => ({
        id: `${lang}_general_${i}`,
        name,
        tier: GT[i],
        isActive: false,
        sportType: SportType.GENERAL,
        primaryPositions: [] as Position[],
        secondaryPositions: [] as Position[],
        tertiaryPositions: [] as Position[],
        forbiddenPositions: [] as Position[],
    }));
}

export const SAMPLE_PLAYERS_BY_LANG: Record<Language, Player[]> = {
    ko: [
        // 축구 (10명)
        ...build('ko', 'soccer', SportType.SOCCER, SOC, [
            { n: '김지현', t: Tier.S, p1: ['LW', 'ST'], p2: ['RW'], p3: ['MF'] },
            { n: '박서준', t: Tier.A, p1: ['DF'], p2: ['LB', 'RB'], p3: ['MF'] },
            { n: '이하율', t: Tier.A, p1: ['MF', 'RW'], p2: ['LW'], p3: ['ST'] },
            { n: '정민호', t: Tier.B, p1: ['LW', 'ST'], p2: ['RW'], p3: ['MF'] },
            { n: '최강우', t: Tier.B, p1: ['ST'], p2: ['LW', 'RW'], p3: ['MF'] },
            { n: '류현준', t: Tier.B, p1: ['MF'], p2: ['LW', 'RW'], p3: ['ST'] },
            { n: '윤현우', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: '장도윤', t: Tier.C, p1: ['MF'], p2: ['DF'], p3: [] },
            { n: '한재혁', t: Tier.C, p1: ['LB', 'RB'], p2: ['DF'], p3: ['MF'] },
            { n: '오시원', t: Tier.D, p1: ['DF'], p2: ['LB'], p3: [] },
        ]),
        // 풋살 (10명)
        ...build('ko', 'futsal', SportType.FUTSAL, FUT, [
            { n: '강민재', t: Tier.S, p1: ['FIX'], p2: ['ALA'], p3: ['PIV'] },
            { n: '조윤호', t: Tier.A, p1: ['ALA'], p2: ['FIX'], p3: [] },
            { n: '임승현', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: '황궁준', t: Tier.B, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: '서태양', t: Tier.B, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: '배진우', t: Tier.B, p1: ['GK'], p2: ['PIV'], p3: ['ALA'] },
            { n: '남석훈', t: Tier.B, p1: ['ALA'], p2: ['FIX'], p3: ['PIV'] },
            { n: '문성빈', t: Tier.C, p1: ['ALA'], p2: ['FIX'], p3: [] },
            { n: '양현수', t: Tier.C, p1: ['PIV'], p2: [], p3: [] },
            { n: '홍동준', t: Tier.D, p1: ['FIX'], p2: ['ALA'], p3: [] },
        ]),
        // 농구 (10명)
        ...build('ko', 'basketball', SportType.BASKETBALL, BSK, [
            { n: '안재민', t: Tier.S, p1: ['SG'], p2: ['PG'], p3: ['SF'] },
            { n: '권도현', t: Tier.A, p1: ['SF', 'PF'], p2: ['PG'], p3: ['SG'] },
            { n: '성민호', t: Tier.A, p1: ['C'], p2: ['PF'], p3: [] },
            { n: '차명훈', t: Tier.B, p1: ['PG'], p2: ['SG'], p3: ['SF'] },
            { n: '백승준', t: Tier.B, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: '고윤성', t: Tier.B, p1: ['SG'], p2: ['PG'], p3: ['SF'] },
            { n: '천성민', t: Tier.B, p1: ['SF'], p2: ['PF'], p3: ['SG'] },
            { n: '유태준', t: Tier.C, p1: ['PF'], p2: ['C'], p3: ['SF'] },
            { n: '신현준', t: Tier.C, p1: ['C'], p2: ['PF'], p3: [] },
            { n: '임우석', t: Tier.D, p1: ['PG'], p2: ['SG'], p3: [] },
        ]),
        // 일반 (10명)
        ...general('ko', ['김민수', '이서연', '박준혁', '최서윤', '장우진', '강다은', '정하준', '한소율', '윤성민', '오유나']),
    ],
    en: [
        // Soccer (10)
        ...build('en', 'soccer', SportType.SOCCER, SOC, [
            { n: 'Jake Mitchell', t: Tier.S, p1: ['ST'], p2: ['LW', 'RW'], p3: [] },
            { n: 'Ryan Torres', t: Tier.A, p1: ['RW'], p2: ['ST', 'LW'], p3: [] },
            { n: 'Ethan Cole', t: Tier.A, p1: ['MF'], p2: ['RW'], p3: ['ST'] },
            { n: 'Lucas Ward', t: Tier.B, p1: ['RW', 'LW'], p2: ['MF'], p3: [] },
            { n: 'Nathan Reid', t: Tier.B, p1: ['RW', 'MF'], p2: ['ST', 'LW'], p3: [] },
            { n: 'Marcus Fox', t: Tier.B, p1: ['MF'], p2: ['DF'], p3: [] },
            { n: 'Dylan Price', t: Tier.B, p1: ['DF'], p2: ['LB'], p3: [] },
            { n: 'Jason Webb', t: Tier.C, p1: ['RB'], p2: ['MF'], p3: [] },
            { n: 'Tyler Hart', t: Tier.C, p1: ['LW'], p2: ['ST', 'RW'], p3: [] },
            { n: 'Kevin Stone', t: Tier.D, p1: ['GK'], p2: [], p3: [] },
        ]),
        // Futsal (10)
        ...build('en', 'futsal', SportType.FUTSAL, FUT, [
            { n: 'Alex Rivera', t: Tier.S, p1: ['ALA'], p2: ['PIV'], p3: ['FIX'] },
            { n: 'Brandon Cruz', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Carlos Vega', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: ['FIX'] },
            { n: 'Dante Rojas', t: Tier.B, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: 'Eric Mendez', t: Tier.B, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Felix Nava', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: 'Hugo Torres', t: Tier.B, p1: ['ALA'], p2: ['PIV'], p3: ['FIX'] },
            { n: 'Ivan Reyes', t: Tier.C, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Marco Luna', t: Tier.C, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Pablo Ochoa', t: Tier.D, p1: ['GK'], p2: ['FIX'], p3: [] },
        ]),
        // Basketball (10)
        ...build('en', 'basketball', SportType.BASKETBALL, BSK, [
            { n: 'Jayden Brooks', t: Tier.S, p1: ['SF', 'PF'], p2: ['PG'], p3: [] },
            { n: 'Marcus Green', t: Tier.A, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: 'Tyler Evans', t: Tier.A, p1: ['SF', 'PF'], p2: ['SG'], p3: [] },
            { n: 'Kyle Parker', t: Tier.B, p1: ['C'], p2: ['PF'], p3: [] },
            { n: 'Andre Williams', t: Tier.B, p1: ['PF', 'C'], p2: ['SF'], p3: [] },
            { n: 'Darius Scott', t: Tier.B, p1: ['PG', 'SG'], p2: ['SF'], p3: [] },
            { n: 'Trevor Lane', t: Tier.B, p1: ['SF'], p2: ['SG', 'PF'], p3: [] },
            { n: 'Caleb Ross', t: Tier.C, p1: ['SG'], p2: ['SF'], p3: [] },
            { n: 'Devon Blake', t: Tier.C, p1: ['C', 'PF'], p2: ['SF'], p3: [] },
            { n: 'Isaiah Ford', t: Tier.D, p1: ['PG'], p2: ['SG'], p3: [] },
        ]),
        // General (10)
        ...general('en', ['James Wilson', 'Emily Chen', 'Michael Brown', 'Sophia Garcia', 'Daniel Kim', 'Olivia Martinez', 'Ryan Patel', 'Emma Thompson', 'David Lee', 'Sarah Johnson']),
    ],
    es: [
        // Futbol (10)
        ...build('es', 'soccer', SportType.SOCCER, SOC, [
            { n: 'Pablo Ruiz', t: Tier.S, p1: ['MF'], p2: ['DF'], p3: [] },
            { n: 'Diego Moreno', t: Tier.A, p1: ['MF'], p2: ['RW'], p3: ['LW'] },
            { n: 'Javier Torres', t: Tier.A, p1: ['RW'], p2: ['LW', 'ST'], p3: [] },
            { n: 'Andres Reyes', t: Tier.B, p1: ['LW'], p2: ['RW'], p3: ['ST'] },
            { n: 'Sergio Navarro', t: Tier.B, p1: ['ST'], p2: ['LW', 'RW'], p3: [] },
            { n: 'Miguel Herrera', t: Tier.B, p1: ['MF', 'RW'], p2: ['LW', 'ST'], p3: [] },
            { n: 'Alejandro Vega', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: 'Daniel Castro', t: Tier.C, p1: ['RB'], p2: ['DF'], p3: [] },
            { n: 'Ivan Romero', t: Tier.C, p1: ['MF'], p2: ['RW'], p3: [] },
            { n: 'Hugo Mendoza', t: Tier.D, p1: ['DF'], p2: ['LB'], p3: [] },
        ]),
        // Futbol sala (10)
        ...build('es', 'futsal', SportType.FUTSAL, FUT, [
            { n: 'Raul Prieto', t: Tier.S, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: 'Fernando Gil', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Oscar Molina', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: ['FIX'] },
            { n: 'Alberto Ramos', t: Tier.B, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Alvaro Soto', t: Tier.B, p1: ['ALA'], p2: ['FIX'], p3: ['PIV'] },
            { n: 'David Medina', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: 'Adrian Blanco', t: Tier.B, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: 'Emilio Vargas', t: Tier.C, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Ruben Aguilar', t: Tier.C, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Tomas Pena', t: Tier.D, p1: ['FIX'], p2: ['ALA'], p3: [] },
        ]),
        // Baloncesto (10)
        ...build('es', 'basketball', SportType.BASKETBALL, BSK, [
            { n: 'Carlos Delgado', t: Tier.S, p1: ['C', 'PF'], p2: ['SF'], p3: [] },
            { n: 'Luis Guerrero', t: Tier.A, p1: ['C'], p2: ['PF'], p3: [] },
            { n: 'Marcos Jimenez', t: Tier.A, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: 'Ricardo Flores', t: Tier.B, p1: ['SG', 'SF'], p2: ['PG'], p3: [] },
            { n: 'Eduardo Pardo', t: Tier.B, p1: ['PG', 'SG'], p2: ['SF'], p3: [] },
            { n: 'Gonzalo Cruz', t: Tier.B, p1: ['PF', 'C'], p2: ['SF'], p3: [] },
            { n: 'Antonio Iglesias', t: Tier.B, p1: ['SG'], p2: ['PG'], p3: [] },
            { n: 'Inigo Cuesta', t: Tier.C, p1: ['SF', 'PF'], p2: ['SG'], p3: [] },
            { n: 'Sergio Pascual', t: Tier.C, p1: ['PF', 'C'], p2: ['SF'], p3: [] },
            { n: 'Miguel Bravo', t: Tier.D, p1: ['SF'], p2: ['SG'], p3: [] },
        ]),
        // General (10)
        ...general('es', ['Alejandro Garcia', 'Lucia Fernandez', 'Roberto Munoz', 'Elena Martinez', 'Diego Lopez', 'Marta Sanchez', 'Adrian Ortega', 'Sara Morales', 'Jorge Castro', 'Paula Ortiz']),
    ],
    ja: [
        // サッカー (10名)
        ...build('ja', 'soccer', SportType.SOCCER, SOC, [
            { n: '田中翔太', t: Tier.S, p1: ['LW'], p2: ['RW', 'MF'], p3: [] },
            { n: '佐藤健太', t: Tier.A, p1: ['RW'], p2: ['MF', 'LW'], p3: [] },
            { n: '鈴木大地', t: Tier.A, p1: ['MF'], p2: ['DF'], p3: [] },
            { n: '高橋隼人', t: Tier.B, p1: ['DF'], p2: ['RB'], p3: [] },
            { n: '伊藤蓮', t: Tier.B, p1: ['RW'], p2: ['MF', 'LW'], p3: [] },
            { n: '渡辺悠', t: Tier.B, p1: ['ST'], p2: ['LW', 'RW'], p3: [] },
            { n: '山本大輝', t: Tier.B, p1: ['MF'], p2: ['RW', 'ST'], p3: [] },
            { n: '松田拓海', t: Tier.C, p1: ['DF'], p2: ['MF'], p3: [] },
            { n: '小林颯太', t: Tier.C, p1: ['LW', 'ST'], p2: ['RW', 'MF'], p3: [] },
            { n: '加藤陽翔', t: Tier.D, p1: ['GK'], p2: [], p3: [] },
        ]),
        // フットサル (10名)
        ...build('ja', 'futsal', SportType.FUTSAL, FUT, [
            { n: '吉田翼', t: Tier.S, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: '山田拓也', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: '中村湊真', t: Tier.A, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: '森大翔', t: Tier.B, p1: ['ALA'], p2: ['FIX'], p3: ['PIV'] },
            { n: '藤本奏太', t: Tier.B, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: '井上陸', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: '斎藤悠', t: Tier.B, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: '松井壮大', t: Tier.C, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: '太田海斗', t: Tier.C, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: '石田翼', t: Tier.D, p1: ['FIX'], p2: ['ALA'], p3: [] },
        ]),
        // バスケットボール (10名)
        ...build('ja', 'basketball', SportType.BASKETBALL, BSK, [
            { n: '清水颯太朗', t: Tier.S, p1: ['PF', 'SF'], p2: ['SG'], p3: [] },
            { n: '木村蓮', t: Tier.A, p1: ['SF'], p2: ['SG', 'PF'], p3: [] },
            { n: '池田凛太', t: Tier.A, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: '橋本悠', t: Tier.B, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: '岡田将也', t: Tier.B, p1: ['SG'], p2: ['SF'], p3: [] },
            { n: '近藤大輔', t: Tier.B, p1: ['SF'], p2: ['SG', 'PF'], p3: [] },
            { n: '長谷川陸', t: Tier.B, p1: ['SG'], p2: ['PG'], p3: ['SF'] },
            { n: '三上俊平', t: Tier.C, p1: ['PF', 'C'], p2: ['SF'], p3: [] },
            { n: '西村翼', t: Tier.C, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: '上田拓也', t: Tier.D, p1: ['C'], p2: ['PF'], p3: [] },
        ]),
        // 一般 (10名)
        ...general('ja', ['田中太郎', '佐藤花子', '鈴木一郎', '高橋結衣', '伊藤健太', '渡辺幸子', '山本翔太', '松田悠', '小林健二', '加藤美咲']),
    ],
    pt: [
        // Futebol (10)
        ...build('pt', 'soccer', SportType.SOCCER, SOC, [
            { n: 'Matheus Silva', t: Tier.S, p1: ['LW'], p2: ['RW', 'ST'], p3: [] },
            { n: 'Lucas Costa', t: Tier.A, p1: ['RW'], p2: ['LW', 'ST'], p3: [] },
            { n: 'Gabriel Almeida', t: Tier.A, p1: ['LW', 'RW'], p2: ['MF', 'ST'], p3: [] },
            { n: 'Rafael Oliveira', t: Tier.B, p1: ['RW', 'LW'], p2: ['MF'], p3: [] },
            { n: 'Bruno Santos', t: Tier.B, p1: ['MF'], p2: ['DF'], p3: [] },
            { n: 'Thiago Pereira', t: Tier.B, p1: ['DF'], p2: ['LB', 'RB'], p3: [] },
            { n: 'Felipe Souza', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: 'Andre Lima', t: Tier.C, p1: ['DF'], p2: ['RB'], p3: [] },
            { n: 'Diego Ferreira', t: Tier.C, p1: ['ST'], p2: ['LW'], p3: [] },
            { n: 'Caio Rocha', t: Tier.D, p1: ['MF'], p2: ['RW', 'LW'], p3: [] },
        ]),
        // Futsal (10)
        ...build('pt', 'futsal', SportType.FUTSAL, FUT, [
            { n: 'Renato Campos', t: Tier.S, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Marcos Ribeiro', t: Tier.A, p1: ['PIV'], p2: ['ALA'], p3: ['FIX'] },
            { n: 'Eduardo Martins', t: Tier.A, p1: ['ALA'], p2: ['PIV'], p3: [] },
            { n: 'Henrique Nunes', t: Tier.B, p1: ['ALA'], p2: ['PIV'], p3: ['FIX'] },
            { n: 'Leandro Araujo', t: Tier.B, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Pedro Moreira', t: Tier.B, p1: ['GK'], p2: [], p3: [] },
            { n: 'Victor Barbosa', t: Tier.B, p1: ['ALA'], p2: ['FIX'], p3: [] },
            { n: 'Julio Gomes', t: Tier.C, p1: ['PIV'], p2: ['ALA'], p3: [] },
            { n: 'Ricardo Dias', t: Tier.C, p1: ['FIX'], p2: ['ALA'], p3: [] },
            { n: 'Fernando Lopes', t: Tier.D, p1: ['ALA'], p2: ['PIV'], p3: [] },
        ]),
        // Basquete (10)
        ...build('pt', 'basketball', SportType.BASKETBALL, BSK, [
            { n: 'Daniel Mendes', t: Tier.S, p1: ['SG'], p2: ['SF'], p3: [] },
            { n: 'Paulo Carvalho', t: Tier.A, p1: ['PF', 'C'], p2: ['SF'], p3: [] },
            { n: 'Gustavo Teixeira', t: Tier.A, p1: ['SF'], p2: ['SG'], p3: [] },
            { n: 'Leonardo Nascimento', t: Tier.B, p1: ['PF'], p2: ['SF', 'C'], p3: [] },
            { n: 'Arthur Correia', t: Tier.B, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: 'Rodrigo Monteiro', t: Tier.B, p1: ['SG'], p2: ['SF'], p3: [] },
            { n: 'Samuel Cardoso', t: Tier.B, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: 'Igor Rezende', t: Tier.C, p1: ['C'], p2: ['PF'], p3: [] },
            { n: 'Fabio Pinto', t: Tier.C, p1: ['PG'], p2: ['SG'], p3: [] },
            { n: 'Otavio Cunha', t: Tier.D, p1: ['C'], p2: ['PF'], p3: [] },
        ]),
        // Geral (10)
        ...general('pt', ['Joao Silva', 'Maria Santos', 'Lucas Pereira', 'Ana Costa', 'Gabriel Rodrigues', 'Juliana Oliveira', 'Pedro Fernandes', 'Larissa Souza', 'Rafael Almeida', 'Camila Lima']),
    ],
};
