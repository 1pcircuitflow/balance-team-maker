/**
 * 알고리즘 토너먼트 시뮬레이션
 * - 10가지 알고리즘 변형 비교
 * - 3라운드 토너먼트 (100회 → 300회 → 500회)
 */

// ========== 타입 정의 ==========
type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'NONE';
type Tier = 1 | 2 | 3 | 4 | 5;

interface Player {
    id: string;
    name: string;
    tier: Tier;
    isActive: boolean;
    sportType: string;
    primaryPositions: Position[];      // 선호 (100)
    secondaryPositions: Position[];    // 가능 (75)
    tertiaryPositions: Position[];     // 괜찮음 (50)
    forbiddenPositions: Position[];    // 불가능
    assignedPosition?: Position;
}

interface Team {
    id: number;
    name: string;
    players: Player[];
    totalSkill: number;
}

interface TeamConstraint {
    type: 'MATCH' | 'SPLIT';
    playerIds: string[];
}

interface BalanceResult {
    teams: Team[];
    standardDeviation: number;
    maxDiff?: number;
    imbalanceScore?: number;
    isValid?: boolean;
    isConstraintViolated?: boolean;
    isQuotaViolated?: boolean;
}

// ========== 테스트 데이터 ==========
const createTestPlayers = (): Player[] => [
    { id: 'A', name: 'A', tier: 5, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: [], forbiddenPositions: ['C'] },
    { id: 'B', name: 'B', tier: 5, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SG'], secondaryPositions: ['SF'], tertiaryPositions: [], forbiddenPositions: ['C'] },
    { id: 'C', name: 'C', tier: 4, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SF', 'PF'], secondaryPositions: [], tertiaryPositions: ['C'], forbiddenPositions: [] },
    { id: 'D', name: 'D', tier: 4, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PF'], secondaryPositions: ['C'], tertiaryPositions: ['SF'], forbiddenPositions: ['PG'] },
    { id: 'E', name: 'E', tier: 4, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['C'], secondaryPositions: ['PF'], tertiaryPositions: [], forbiddenPositions: ['PG', 'SG'] },
    { id: 'F', name: 'F', tier: 3, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PG', 'SG'], secondaryPositions: [], tertiaryPositions: ['SF'], forbiddenPositions: ['C'] },
    { id: 'G', name: 'G', tier: 3, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SG'], secondaryPositions: ['SF'], tertiaryPositions: ['PF'], forbiddenPositions: [] },
    { id: 'H', name: 'H', tier: 3, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SF'], secondaryPositions: ['PF'], tertiaryPositions: ['SG'], forbiddenPositions: [] },
    { id: 'I', name: 'I', tier: 3, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PF'], secondaryPositions: ['SF'], tertiaryPositions: ['C'], forbiddenPositions: ['PG'] },
    { id: 'J', name: 'J', tier: 3, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['C'], secondaryPositions: ['PF'], tertiaryPositions: [], forbiddenPositions: ['PG', 'SG'] },
    { id: 'K', name: 'K', tier: 2, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PG'], secondaryPositions: [], tertiaryPositions: ['SG'], forbiddenPositions: ['C', 'PF'] },
    { id: 'L', name: 'L', tier: 2, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SG'], secondaryPositions: ['PG'], tertiaryPositions: [], forbiddenPositions: ['C'] },
    { id: 'M', name: 'M', tier: 2, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['SF'], secondaryPositions: ['SG'], tertiaryPositions: ['PF'], forbiddenPositions: [] },
    { id: 'N', name: 'N', tier: 2, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['PF'], secondaryPositions: ['SF'], tertiaryPositions: ['C'], forbiddenPositions: ['PG'] },
    { id: 'O', name: 'O', tier: 1, isActive: true, sportType: 'BASKETBALL', primaryPositions: ['C'], secondaryPositions: ['PF'], tertiaryPositions: ['SF'], forbiddenPositions: ['PG', 'SG'] },
];

const constraints: TeamConstraint[] = [
    { type: 'MATCH', playerIds: ['A', 'B'] },  // A와 B는 같은 팀
    { type: 'SPLIT', playerIds: ['A', 'C'] },  // A와 C는 다른 팀
];

const customQuotas: Record<Position, number> = {
    'PG': 1, 'SG': 1, 'SF': 1, 'PF': 1, 'C': 1, 'NONE': 0
};

// ========== 헬퍼 함수 ==========
const shuffle = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const cloneTeams = (teams: Team[]): Team[] => {
    return teams.map(t => ({
        ...t,
        players: [...t.players.map(p => ({ ...p }))]
    }));
};

// ========== 평가 함수 ==========
interface EvaluationConfig {
    diversityPenalty: number;      // 다양성 패널티 배수
    sdLimit: number | null;        // SD 제한 (null이면 제한 없음)
    strictForbidden: boolean;      // 불가능 포지션 하드체크
}

function evaluateSolution(
    teams: Team[],
    constraints: TeamConstraint[],
    customQuotas: Record<Position, number>,
    previousHashes: string[],
    config: EvaluationConfig
): { score: number; details: any } {
    let score = 0;
    const details: any = {
        constraintViolations: 0,
        quotaViolations: 0,
        forbiddenViolations: 0,
        sd: 0,
        diversity: 0
    };

    // 1순위: 팀 인원 균형 (1억 점)
    const teamSizes = teams.map(t => t.players.length);
    const avgSize = teamSizes.reduce((a, b) => a + b, 0) / teams.length;
    const sizeImbalance = teamSizes.reduce((sum, size) => sum + Math.abs(size - avgSize), 0);
    score += sizeImbalance * 100000000;

    // 2순위: 제약조건 위반 (1억 점)
    for (const constraint of constraints) {
        const teamIdsFound = new Set<number>();
        constraint.playerIds.forEach(pid => {
            const team = teams.find(t => t.players.some(p => p.id === pid));
            if (team) teamIdsFound.add(team.id);
        });

        if (constraint.type === 'MATCH' && teamIdsFound.size > 1) {
            score += 100000000;
            details.constraintViolations++;
        }
        if (constraint.type === 'SPLIT' && teamIdsFound.size === 1 && constraint.playerIds.length > 1) {
            score += 100000000;
            details.constraintViolations++;
        }
    }

    // 3순위: 포지션 쿼터 위반 (1000만 점)
    Object.entries(customQuotas).forEach(([pos, quota]) => {
        if (typeof quota === 'number' && quota > 0) {
            teams.forEach(t => {
                const count = t.players.filter(p => p.assignedPosition === pos).length;
                if (count !== quota) {
                    score += Math.abs(count - quota) * 10000000;
                    details.quotaViolations += Math.abs(count - quota);
                }
            });
        }
    });

    // 4순위: 불가능 포지션 위반
    if (config.strictForbidden) {
        teams.forEach(t => {
            t.players.forEach(p => {
                if (p.forbiddenPositions.includes(p.assignedPosition as Position)) {
                    score += 100000000; // 하드 페널티
                    details.forbiddenViolations++;
                }
            });
        });
    }

    // 5순위: 다양성 (config.diversityPenalty)
    const similarity = calculatePairSimilarity(teams, previousHashes);
    score += similarity * config.diversityPenalty;
    details.diversity = 1 - similarity; // 변경률

    // 6순위: 실력 표준편차
    const totalSkills = teams.map(t => t.players.reduce((sum, p) => sum + p.tier, 0));
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teams.length;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teams.length;
    const stdDev = Math.sqrt(variance);
    details.sd = stdDev;

    // SD 제한 적용
    if (config.sdLimit !== null && stdDev > config.sdLimit) {
        score += 100000000; // 하드 페널티
    }
    score += stdDev;

    return { score, details };
}

function calculatePairSimilarity(currentTeams: Team[], previousHashes: string[]): number {
    if (previousHashes.length === 0) return 0;

    const currentPairs = new Set<string>();
    for (const team of currentTeams) {
        for (let i = 0; i < team.players.length; i++) {
            for (let j = i + 1; j < team.players.length; j++) {
                const pair = [team.players[i].id, team.players[j].id].sort().join('-');
                currentPairs.add(pair);
            }
        }
    }

    let maxSimilarity = 0;
    for (const prevHash of previousHashes) {
        const prevIds = prevHash.split('|');
        const prevPairs = new Set<string>();
        // 각 팀별로 분리
        for (const teamIds of prevIds) {
            const ids = teamIds.split(',');
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const pair = [ids[i], ids[j]].sort().join('-');
                    prevPairs.add(pair);
                }
            }
        }

        const intersection = [...currentPairs].filter(p => prevPairs.has(p)).length;
        const similarity = currentPairs.size > 0 ? intersection / currentPairs.size : 0;
        maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
}

function getTeamsHash(teams: Team[]): string {
    return teams.map(t => t.players.map(p => p.id).sort().join(',')).join('|');
}

// ========== 초기 배치 ==========
function buildInitialTeams(players: Player[], teamCount: number, constraints: TeamConstraint[]): Team[] {
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));

    const activePlayers = [...players.filter(p => p.isActive)];
    const assigned = new Set<string>();

    // 1. MATCH 제약 처리
    const matchGroups = constraints.filter(c => c.type === 'MATCH').map(c => c.playerIds);
    for (const group of matchGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0) continue;
        const targetTeamIdx = teams.map((t, i) => ({ i, len: t.players.length })).sort((a, b) => a.len - b.len)[0].i;
        for (const player of groupPlayers) {
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        }
    }

    // 2. SPLIT 제약 처리
    const splitGroups = constraints.filter(c => c.type === 'SPLIT').map(c => c.playerIds);
    for (const group of splitGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id) && !assigned.has(p.id));
        if (groupPlayers.length === 0) continue;
        const sortedTeams = teams.map((t, i) => ({ i, len: t.players.length })).sort((a, b) => a.len - b.len);
        groupPlayers.forEach((player, idx) => {
            const targetTeamIdx = sortedTeams[idx % teamCount].i;
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        });
    }

    // 3. 나머지 선수 랜덤 배치
    const remainingPlayers = shuffle(activePlayers.filter(p => !assigned.has(p.id)));
    for (const player of remainingPlayers) {
        const targetTeamIdx = teams.map((t, i) => ({ i, len: t.players.length })).sort((a, b) => a.len - b.len)[0].i;
        teams[targetTeamIdx].players.push({ ...player });
    }

    return teams;
}

// ========== 포지션 배정 ==========
function assignPositions(teams: Team[], quotas: Record<Position, number>, strictForbidden: boolean): boolean {
    const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

    for (const team of teams) {
        const assigned: Position[] = [];
        const unassigned = [...team.players];

        // 각 포지션별로 가장 적합한 선수 배정
        for (const pos of positions) {
            const quota = quotas[pos] || 0;
            for (let i = 0; i < quota; i++) {
                // 후보 찾기: 불가능 포지션이 아닌 선수 중
                let bestCandidate = null;
                let bestScore = -1;

                for (const player of unassigned) {
                    if (strictForbidden && player.forbiddenPositions.includes(pos)) continue;

                    let score = 0;
                    if (player.primaryPositions.includes(pos)) score = 100;
                    else if (player.secondaryPositions.includes(pos)) score = 75;
                    else if (player.tertiaryPositions.includes(pos)) score = 50;
                    else if (!player.forbiddenPositions.includes(pos)) score = 25;
                    else continue; // 불가능 포지션

                    if (score > bestScore) {
                        bestScore = score;
                        bestCandidate = player;
                    }
                }

                if (bestCandidate) {
                    bestCandidate.assignedPosition = pos;
                    unassigned.splice(unassigned.indexOf(bestCandidate), 1);
                    assigned.push(pos);
                }
            }
        }

        // 남은 선수 처리
        for (const player of unassigned) {
            player.assignedPosition = player.primaryPositions[0] || 'NONE';
        }

        // 팀 스킬 계산
        team.totalSkill = team.players.reduce((sum, p) => sum + p.tier, 0);
    }

    return true;
}

// ========== Swap 로직 ==========
function canSwap(p1: Player, t1Idx: number, p2: Player, t2Idx: number, teams: Team[], constraints: TeamConstraint[], strictForbidden: boolean): boolean {
    // 제약조건 체크
    for (const c of constraints) {
        if (c.type === 'MATCH') {
            if (c.playerIds.includes(p1.id)) {
                const partners = c.playerIds.filter(id => id !== p1.id);
                const partnerInT2 = teams[t2Idx].players.some(p => partners.includes(p.id) && p.id !== p2.id);
                const partnerInOther = teams.some((t, idx) => idx !== t1Idx && idx !== t2Idx && t.players.some(p => partners.includes(p.id)));
                if (partnerInOther && !partnerInT2) return false;
            }
            if (c.playerIds.includes(p2.id)) {
                const partners = c.playerIds.filter(id => id !== p2.id);
                const partnerInT1 = teams[t1Idx].players.some(p => partners.includes(p.id) && p.id !== p1.id);
                const partnerInOther = teams.some((t, idx) => idx !== t1Idx && idx !== t2Idx && t.players.some(p => partners.includes(p.id)));
                if (partnerInOther && !partnerInT1) return false;
            }
        } else if (c.type === 'SPLIT') {
            if (c.playerIds.includes(p1.id) && c.playerIds.includes(p2.id)) return false;
        }
    }

    // 불가능 포지션 체크 (교환 후 포지션 배정 가능 여부)
    if (strictForbidden) {
        // 간단히: 교환 후 재배정 시 불가능 포지션에 배정될 위험 체크는 생략 (추후 assignPositions에서 처리)
    }

    return true;
}

function swapPlayers(teams: Team[], p1: Player, t1Idx: number, p2: Player, t2Idx: number): Team[] {
    const newTeams = cloneTeams(teams);
    newTeams[t1Idx].players = newTeams[t1Idx].players.filter(p => p.id !== p1.id);
    newTeams[t2Idx].players.push({ ...p1 });
    newTeams[t2Idx].players = newTeams[t2Idx].players.filter(p => p.id !== p2.id);
    newTeams[t1Idx].players.push({ ...p2 });
    return newTeams;
}

// ========== 최적화 알고리즘 ==========
function performGA(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    quotas: Record<Position, number>,
    previousHashes: string[],
    config: EvaluationConfig,
    popSize: number = 20,
    generations: number = 20
): Team[] {
    let population: Team[][] = [];

    // 초기 해집단
    for (let i = 0; i < popSize; i++) {
        let p = cloneTeams(initialTeams);
        // 랜덤 Swap으로 다양성 주입
        for (let k = 0; k < 10; k++) {
            const t1 = Math.floor(Math.random() * p.length);
            const t2 = Math.floor(Math.random() * p.length);
            if (t1 !== t2 && p[t1].players.length > 0 && p[t2].players.length > 0) {
                const pl1 = p[t1].players[Math.floor(Math.random() * p[t1].players.length)];
                const pl2 = p[t2].players[Math.floor(Math.random() * p[t2].players.length)];
                if (canSwap(pl1, t1, pl2, t2, p, constraints, config.strictForbidden)) {
                    p = swapPlayers(p, pl1, t1, pl2, t2);
                }
            }
        }
        assignPositions(p, quotas, config.strictForbidden);
        population.push(p);
    }

    let bestSolution = cloneTeams(initialTeams);
    assignPositions(bestSolution, quotas, config.strictForbidden);
    let bestScore = evaluateSolution(bestSolution, constraints, quotas, previousHashes, config).score;

    for (let gen = 0; gen < generations; gen++) {
        const scoredPop = population.map(indi => ({
            teams: indi,
            score: evaluateSolution(indi, constraints, quotas, previousHashes, config).score
        }));
        scoredPop.sort((a, b) => a.score - b.score);

        if (scoredPop[0].score < bestScore) {
            bestScore = scoredPop[0].score;
            bestSolution = cloneTeams(scoredPop[0].teams);
        }

        const nextGen: Team[][] = [];
        const eliteCount = Math.floor(popSize * 0.2);
        for (let i = 0; i < eliteCount; i++) {
            nextGen.push(cloneTeams(scoredPop[i].teams));
        }

        while (nextGen.length < popSize) {
            const parentIdx = Math.floor(Math.random() * (popSize / 2));
            let child = cloneTeams(scoredPop[parentIdx].teams);
            const mutations = Math.floor(Math.random() * 3) + 1;
            for (let m = 0; m < mutations; m++) {
                const t1 = Math.floor(Math.random() * child.length);
                const t2 = Math.floor(Math.random() * child.length);
                if (t1 !== t2 && child[t1].players.length > 0 && child[t2].players.length > 0) {
                    const pl1 = child[t1].players[Math.floor(Math.random() * child[t1].players.length)];
                    const pl2 = child[t2].players[Math.floor(Math.random() * child[t2].players.length)];
                    if (canSwap(pl1, t1, pl2, t2, child, constraints, config.strictForbidden)) {
                        child = swapPlayers(child, pl1, t1, pl2, t2);
                    }
                }
            }
            assignPositions(child, quotas, config.strictForbidden);
            nextGen.push(child);
        }
        population = nextGen;
    }

    return bestSolution;
}

function performPSO(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    quotas: Record<Position, number>,
    previousHashes: string[],
    config: EvaluationConfig,
    particlesCount: number = 20,
    iterations: number = 30
): Team[] {
    let particles: Team[][] = [];
    for (let i = 0; i < particlesCount; i++) {
        let p = cloneTeams(initialTeams);
        for (let k = 0; k < 10; k++) {
            const t1 = Math.floor(Math.random() * p.length);
            const t2 = Math.floor(Math.random() * p.length);
            if (t1 !== t2 && p[t1].players.length > 0 && p[t2].players.length > 0) {
                const pl1 = p[t1].players[Math.floor(Math.random() * p[t1].players.length)];
                const pl2 = p[t2].players[Math.floor(Math.random() * p[t2].players.length)];
                if (canSwap(pl1, t1, pl2, t2, p, constraints, config.strictForbidden)) {
                    p = swapPlayers(p, pl1, t1, pl2, t2);
                }
            }
        }
        assignPositions(p, quotas, config.strictForbidden);
        particles.push(p);
    }

    let pBests = particles.map(p => ({
        teams: cloneTeams(p),
        score: evaluateSolution(p, constraints, quotas, previousHashes, config).score
    }));

    let gBest = pBests.reduce((best, current) => current.score < best.score ? current : best, pBests[0]);

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < particlesCount; i++) {
            let currentTeams = particles[i];
            const swapAttempts = 15;
            for (let s = 0; s < swapAttempts; s++) {
                const t1 = Math.floor(Math.random() * currentTeams.length);
                const t2 = Math.floor(Math.random() * currentTeams.length);
                if (t1 !== t2 && currentTeams[t1].players.length > 0 && currentTeams[t2].players.length > 0) {
                    const pl1 = currentTeams[t1].players[Math.floor(Math.random() * currentTeams[t1].players.length)];
                    const pl2 = currentTeams[t2].players[Math.floor(Math.random() * currentTeams[t2].players.length)];
                    if (canSwap(pl1, t1, pl2, t2, currentTeams, constraints, config.strictForbidden)) {
                        const nextTeams = swapPlayers(currentTeams, pl1, t1, pl2, t2);
                        assignPositions(nextTeams, quotas, config.strictForbidden);
                        const nextScore = evaluateSolution(nextTeams, constraints, quotas, previousHashes, config).score;
                        currentTeams = nextTeams;
                        if (nextScore < pBests[i].score) {
                            pBests[i] = { teams: cloneTeams(nextTeams), score: nextScore };
                            if (nextScore < gBest.score) {
                                gBest = { teams: cloneTeams(nextTeams), score: nextScore };
                            }
                        }
                    }
                }
            }
            particles[i] = currentTeams;
        }
    }

    return gBest.teams;
}

// ========== 알고리즘 정의 ==========
interface AlgorithmDef {
    name: string;
    config: EvaluationConfig;
    gaGenerations: number;
    psoIterations: number;
}

const algorithms: AlgorithmDef[] = [
    { name: 'Baseline', config: { diversityPenalty: 1000000, sdLimit: null, strictForbidden: false }, gaGenerations: 20, psoIterations: 30 },
    { name: 'StrictForbidden', config: { diversityPenalty: 1000000, sdLimit: null, strictForbidden: true }, gaGenerations: 20, psoIterations: 30 },
    { name: 'SD_Limit_2', config: { diversityPenalty: 1000000, sdLimit: 2, strictForbidden: false }, gaGenerations: 20, psoIterations: 30 },
    { name: 'HighDiversity', config: { diversityPenalty: 50000000, sdLimit: null, strictForbidden: false }, gaGenerations: 20, psoIterations: 30 },
    { name: 'Combo_Forbidden_SD', config: { diversityPenalty: 1000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 20, psoIterations: 30 },
    { name: 'Combo_Forbidden_Div', config: { diversityPenalty: 50000000, sdLimit: null, strictForbidden: true }, gaGenerations: 20, psoIterations: 30 },
    { name: 'Combo_SD_Div', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: false }, gaGenerations: 20, psoIterations: 30 },
    { name: 'AllCombo', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 20, psoIterations: 30 },
    { name: 'MoreGA', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 50, psoIterations: 30 },
    { name: 'MorePSO', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 20, psoIterations: 60 },
];

// ========== 시뮬레이션 실행 ==========
function runSimulation(alg: AlgorithmDef, players: Player[], teamCount: number, runs: number): any {
    const results = {
        name: alg.name,
        runs,
        constraintPass: 0,
        quotaPass: 0,
        forbiddenPass: 0,
        sdUnder2: 0,
        avgSD: 0,
        avgDiversity: 0,
        totalScore: 0
    };

    const previousHashes: string[] = [];

    for (let i = 0; i < runs; i++) {
        const initial = buildInitialTeams(players, teamCount, constraints);

        // GA 실행
        const gaResult = performGA(initial, constraints, customQuotas, previousHashes, alg.config, 20, alg.gaGenerations);

        // PSO 실행
        const psoResult = performPSO(initial, constraints, customQuotas, previousHashes, alg.config, 20, alg.psoIterations);

        // 더 좋은 결과 선택
        const gaEval = evaluateSolution(gaResult, constraints, customQuotas, previousHashes, alg.config);
        const psoEval = evaluateSolution(psoResult, constraints, customQuotas, previousHashes, alg.config);

        const bestTeams = gaEval.score < psoEval.score ? gaResult : psoResult;
        const bestEval = gaEval.score < psoEval.score ? gaEval : psoEval;

        // 통계 수집
        if (bestEval.details.constraintViolations === 0) results.constraintPass++;
        if (bestEval.details.quotaViolations === 0) results.quotaPass++;
        if (bestEval.details.forbiddenViolations === 0) results.forbiddenPass++;
        if (bestEval.details.sd <= 2) results.sdUnder2++;
        results.avgSD += bestEval.details.sd;
        results.avgDiversity += bestEval.details.diversity;
        results.totalScore += bestEval.score;

        // 이전 기록 업데이트 (최근 4개 유지)
        previousHashes.push(getTeamsHash(bestTeams));
        if (previousHashes.length > 4) previousHashes.shift();
    }

    results.avgSD = Number((results.avgSD / runs).toFixed(2));
    results.avgDiversity = Number((results.avgDiversity / runs * 100).toFixed(1));
    results.totalScore = Number((results.totalScore / runs).toFixed(0));

    return results;
}

// ========== 메인 ==========
async function main() {
    const players = createTestPlayers();
    const teamCount = 3;

    console.log('========================================');
    console.log('🏀 알고리즘 토너먼트 시뮬레이션');
    console.log('========================================\n');

    // Round 1: 100회
    console.log('📌 Round 1: 10개 알고리즘 × 100회\n');
    const round1Results = [];
    for (const alg of algorithms) {
        console.log(`  ⏳ ${alg.name} 실행 중...`);
        const result = runSimulation(alg, players, teamCount, 100);
        round1Results.push(result);
        console.log(`     ✅ 완료 (제약:${result.constraintPass}%, 쿼터:${result.quotaPass}%, SD≤2:${result.sdUnder2}%, 다양성:${result.avgDiversity}%)`);
    }

    // Round 1 정렬 및 상위 5개 선발
    round1Results.sort((a, b) => {
        // 우선순위: 제약 → 쿼터 → 불가능 → SD → 다양성
        if (a.constraintPass !== b.constraintPass) return b.constraintPass - a.constraintPass;
        if (a.quotaPass !== b.quotaPass) return b.quotaPass - a.quotaPass;
        if (a.forbiddenPass !== b.forbiddenPass) return b.forbiddenPass - a.forbiddenPass;
        if (a.sdUnder2 !== b.sdUnder2) return b.sdUnder2 - a.sdUnder2;
        return b.avgDiversity - a.avgDiversity;
    });

    console.log('\n📊 Round 1 결과:');
    console.log('─'.repeat(90));
    console.log(`${'순위'.padEnd(4)} | ${'알고리즘'.padEnd(20)} | ${'제약'.padEnd(6)} | ${'쿼터'.padEnd(6)} | ${'금지'.padEnd(6)} | ${'SD≤2'.padEnd(6)} | ${'평균SD'.padEnd(8)} | 다양성`);
    console.log('─'.repeat(90));
    round1Results.forEach((r, i) => {
        const mark = i < 5 ? '✓' : ' ';
        console.log(`${mark}${(i + 1).toString().padEnd(3)} | ${r.name.padEnd(20)} | ${(r.constraintPass + '%').padEnd(6)} | ${(r.quotaPass + '%').padEnd(6)} | ${(r.forbiddenPass + '%').padEnd(6)} | ${(r.sdUnder2 + '%').padEnd(6)} | ${r.avgSD.toString().padEnd(8)} | ${r.avgDiversity}%`);
    });

    const top5 = round1Results.slice(0, 5).map(r => algorithms.find(a => a.name === r.name)!);

    // Round 2: 300회
    console.log('\n\n📌 Round 2: 상위 5개 × 300회\n');
    const round2Results = [];
    for (const alg of top5) {
        console.log(`  ⏳ ${alg.name} 실행 중...`);
        const result = runSimulation(alg, players, teamCount, 300);
        round2Results.push(result);
        console.log(`     ✅ 완료 (제약:${result.constraintPass / 3}%, SD평균:${result.avgSD}, 다양성:${result.avgDiversity}%)`);
    }

    round2Results.sort((a, b) => {
        if (a.constraintPass !== b.constraintPass) return b.constraintPass - a.constraintPass;
        if (a.quotaPass !== b.quotaPass) return b.quotaPass - a.quotaPass;
        if (a.forbiddenPass !== b.forbiddenPass) return b.forbiddenPass - a.forbiddenPass;
        if (a.sdUnder2 !== b.sdUnder2) return b.sdUnder2 - a.sdUnder2;
        return b.avgDiversity - a.avgDiversity;
    });

    console.log('\n📊 Round 2 결과:');
    console.log('─'.repeat(90));
    round2Results.forEach((r, i) => {
        const mark = i < 3 ? '✓' : ' ';
        console.log(`${mark}${(i + 1).toString().padEnd(3)} | ${r.name.padEnd(20)} | ${(Math.round(r.constraintPass / 3) + '%').padEnd(6)} | ${(Math.round(r.quotaPass / 3) + '%').padEnd(6)} | ${(Math.round(r.forbiddenPass / 3) + '%').padEnd(6)} | ${(Math.round(r.sdUnder2 / 3) + '%').padEnd(6)} | ${r.avgSD.toString().padEnd(8)} | ${r.avgDiversity}%`);
    });

    const top3 = round2Results.slice(0, 3).map(r => algorithms.find(a => a.name === r.name)!);

    // Round 3: 500회
    console.log('\n\n📌 Round 3: 상위 3개 × 500회\n');
    const round3Results = [];
    for (const alg of top3) {
        console.log(`  ⏳ ${alg.name} 실행 중...`);
        const result = runSimulation(alg, players, teamCount, 500);
        round3Results.push(result);
        console.log(`     ✅ 완료`);
    }

    round3Results.sort((a, b) => {
        if (a.constraintPass !== b.constraintPass) return b.constraintPass - a.constraintPass;
        if (a.quotaPass !== b.quotaPass) return b.quotaPass - a.quotaPass;
        if (a.forbiddenPass !== b.forbiddenPass) return b.forbiddenPass - a.forbiddenPass;
        if (a.sdUnder2 !== b.sdUnder2) return b.sdUnder2 - a.sdUnder2;
        return b.avgDiversity - a.avgDiversity;
    });

    console.log('\n📊 Round 3 최종 결과:');
    console.log('─'.repeat(90));
    round3Results.forEach((r, i) => {
        const mark = i === 0 ? '🏆' : '  ';
        console.log(`${mark}${(i + 1).toString().padEnd(2)} | ${r.name.padEnd(20)} | ${(Math.round(r.constraintPass / 5) + '%').padEnd(6)} | ${(Math.round(r.quotaPass / 5) + '%').padEnd(6)} | ${(Math.round(r.forbiddenPass / 5) + '%').padEnd(6)} | ${(Math.round(r.sdUnder2 / 5) + '%').padEnd(6)} | ${r.avgSD.toString().padEnd(8)} | ${r.avgDiversity}%`);
    });

    console.log('\n========================================');
    console.log(`🏆 최종 우승: ${round3Results[0].name}`);
    console.log('========================================\n');

    // 결과 파일 저장
    const fs = require('fs');
    fs.writeFileSync('simulation/tournament_results.json', JSON.stringify({
        round1: round1Results,
        round2: round2Results,
        round3: round3Results,
        winner: round3Results[0].name
    }, null, 2));
    console.log('📁 결과 저장: simulation/tournament_results.json');
}

main().catch(console.error);
