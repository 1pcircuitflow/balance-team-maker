/**
 * 테니스 시나리오 시뮬레이션
 * - 10명, 5팀(각 2명)
 * - 포지션 없음
 * - 상위 3개 알고리즘 × 500회
 */

// ========== 타입 정의 ==========
type Position = 'NONE';
type Tier = 1 | 2 | 3 | 4 | 5;

interface Player {
    id: string;
    name: string;
    tier: Tier;
    isActive: boolean;
    sportType: string;
    primaryPositions: Position[];
    secondaryPositions: Position[];
    tertiaryPositions: Position[];
    forbiddenPositions: Position[];
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

// ========== 테스트 데이터: 테니스 10명 ==========
const createTestPlayers = (): Player[] => [
    { id: 'P1', name: '김철수', tier: 5, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P2', name: '이영희', tier: 5, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P3', name: '박민수', tier: 4, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P4', name: '최지연', tier: 4, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P5', name: '정승호', tier: 3, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P6', name: '한수정', tier: 3, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P7', name: '오태준', tier: 2, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P8', name: '서미래', tier: 2, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P9', name: '장현우', tier: 1, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
    { id: 'P10', name: '윤서연', tier: 1, isActive: true, sportType: 'TENNIS', primaryPositions: ['NONE'], secondaryPositions: [], tertiaryPositions: [], forbiddenPositions: [] },
];

// 제약조건 없음
const constraints: TeamConstraint[] = [];

// 포지션 쿼터 없음
const customQuotas: Record<Position, number> = { 'NONE': 0 };

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
    diversityPenalty: number;
    sdLimit: number | null;
    strictForbidden: boolean;
}

function evaluateSolution(
    teams: Team[],
    constraints: TeamConstraint[],
    previousHashes: string[],
    config: EvaluationConfig
): { score: number; details: any } {
    let score = 0;
    const details: any = {
        constraintViolations: 0,
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

    // 3순위: 다양성
    const similarity = calculatePairSimilarity(teams, previousHashes);
    score += similarity * config.diversityPenalty;
    details.diversity = 1 - similarity;

    // 4순위: 실력 표준편차
    const totalSkills = teams.map(t => t.players.reduce((sum, p) => sum + p.tier, 0));
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teams.length;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teams.length;
    const stdDev = Math.sqrt(variance);
    details.sd = stdDev;

    if (config.sdLimit !== null && stdDev > config.sdLimit) {
        score += 100000000;
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

    const activePlayers = shuffle([...players.filter(p => p.isActive)]);

    // 균등 배치
    activePlayers.forEach((player, idx) => {
        const targetTeamIdx = idx % teamCount;
        teams[targetTeamIdx].players.push({ ...player });
    });

    // 팀 스킬 계산
    teams.forEach(t => {
        t.totalSkill = t.players.reduce((sum, p) => sum + p.tier, 0);
    });

    return teams;
}

// ========== Swap 로직 ==========
function canSwap(p1: Player, t1Idx: number, p2: Player, t2Idx: number, teams: Team[], constraints: TeamConstraint[]): boolean {
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
    return true;
}

function swapPlayers(teams: Team[], p1: Player, t1Idx: number, p2: Player, t2Idx: number): Team[] {
    const newTeams = cloneTeams(teams);
    newTeams[t1Idx].players = newTeams[t1Idx].players.filter(p => p.id !== p1.id);
    newTeams[t2Idx].players.push({ ...p1 });
    newTeams[t2Idx].players = newTeams[t2Idx].players.filter(p => p.id !== p2.id);
    newTeams[t1Idx].players.push({ ...p2 });

    newTeams[t1Idx].totalSkill = newTeams[t1Idx].players.reduce((sum, p) => sum + p.tier, 0);
    newTeams[t2Idx].totalSkill = newTeams[t2Idx].players.reduce((sum, p) => sum + p.tier, 0);

    return newTeams;
}

// ========== GA ==========
function performGA(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    previousHashes: string[],
    config: EvaluationConfig,
    generations: number = 50
): Team[] {
    const popSize = 20;
    let population: Team[][] = [];

    for (let i = 0; i < popSize; i++) {
        let p = cloneTeams(initialTeams);
        for (let k = 0; k < 10; k++) {
            const t1 = Math.floor(Math.random() * p.length);
            const t2 = Math.floor(Math.random() * p.length);
            if (t1 !== t2 && p[t1].players.length > 0 && p[t2].players.length > 0) {
                const pl1 = p[t1].players[Math.floor(Math.random() * p[t1].players.length)];
                const pl2 = p[t2].players[Math.floor(Math.random() * p[t2].players.length)];
                if (canSwap(pl1, t1, pl2, t2, p, constraints)) {
                    p = swapPlayers(p, pl1, t1, pl2, t2);
                }
            }
        }
        population.push(p);
    }

    let bestSolution = cloneTeams(initialTeams);
    let bestScore = evaluateSolution(bestSolution, constraints, previousHashes, config).score;

    for (let gen = 0; gen < generations; gen++) {
        const scoredPop = population.map(indi => ({
            teams: indi,
            score: evaluateSolution(indi, constraints, previousHashes, config).score
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
                    if (canSwap(pl1, t1, pl2, t2, child, constraints)) {
                        child = swapPlayers(child, pl1, t1, pl2, t2);
                    }
                }
            }
            nextGen.push(child);
        }
        population = nextGen;
    }

    return bestSolution;
}

// ========== PSO ==========
function performPSO(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    previousHashes: string[],
    config: EvaluationConfig,
    iterations: number = 60
): Team[] {
    const particlesCount = 20;
    let particles: Team[][] = [];

    for (let i = 0; i < particlesCount; i++) {
        let p = cloneTeams(initialTeams);
        for (let k = 0; k < 10; k++) {
            const t1 = Math.floor(Math.random() * p.length);
            const t2 = Math.floor(Math.random() * p.length);
            if (t1 !== t2 && p[t1].players.length > 0 && p[t2].players.length > 0) {
                const pl1 = p[t1].players[Math.floor(Math.random() * p[t1].players.length)];
                const pl2 = p[t2].players[Math.floor(Math.random() * p[t2].players.length)];
                if (canSwap(pl1, t1, pl2, t2, p, constraints)) {
                    p = swapPlayers(p, pl1, t1, pl2, t2);
                }
            }
        }
        particles.push(p);
    }

    let pBests = particles.map(p => ({
        teams: cloneTeams(p),
        score: evaluateSolution(p, constraints, previousHashes, config).score
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
                    if (canSwap(pl1, t1, pl2, t2, currentTeams, constraints)) {
                        const nextTeams = swapPlayers(currentTeams, pl1, t1, pl2, t2);
                        const nextScore = evaluateSolution(nextTeams, constraints, previousHashes, config).score;
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

// ========== 알고리즘 정의 (상위 3개) ==========
interface AlgorithmDef {
    name: string;
    config: EvaluationConfig;
    gaGenerations: number;
    psoIterations: number;
}

const algorithms: AlgorithmDef[] = [
    { name: 'MoreGA', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 50, psoIterations: 30 },
    { name: 'MorePSO', config: { diversityPenalty: 50000000, sdLimit: 2, strictForbidden: true }, gaGenerations: 20, psoIterations: 60 },
    { name: 'SD_Limit_2', config: { diversityPenalty: 1000000, sdLimit: 2, strictForbidden: false }, gaGenerations: 20, psoIterations: 30 },
];

// ========== 시뮬레이션 실행 ==========
function runSimulation(alg: AlgorithmDef, players: Player[], teamCount: number, runs: number): any {
    const results = {
        name: alg.name,
        runs,
        sdUnder2: 0,
        avgSD: 0,
        avgDiversity: 0,
        totalScore: 0
    };

    const previousHashes: string[] = [];

    for (let i = 0; i < runs; i++) {
        const initial = buildInitialTeams(players, teamCount, constraints);

        const gaResult = performGA(initial, constraints, previousHashes, alg.config, alg.gaGenerations);
        const psoResult = performPSO(initial, constraints, previousHashes, alg.config, alg.psoIterations);

        const gaEval = evaluateSolution(gaResult, constraints, previousHashes, alg.config);
        const psoEval = evaluateSolution(psoResult, constraints, previousHashes, alg.config);

        const bestTeams = gaEval.score < psoEval.score ? gaResult : psoResult;
        const bestEval = gaEval.score < psoEval.score ? gaEval : psoEval;

        if (bestEval.details.sd <= 2) results.sdUnder2++;
        results.avgSD += bestEval.details.sd;
        results.avgDiversity += bestEval.details.diversity;
        results.totalScore += bestEval.score;

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
    const teamCount = 5; // 5팀 (각 2명)

    console.log('==========================================');
    console.log('🎾 테니스 시나리오 시뮬레이션');
    console.log('   10명 → 5팀 (2명씩), 포지션 없음');
    console.log('==========================================\n');

    console.log('📌 상위 3개 알고리즘 × 500회\n');
    const results = [];

    for (const alg of algorithms) {
        console.log(`  ⏳ ${alg.name} 실행 중...`);
        const result = runSimulation(alg, players, teamCount, 500);
        results.push(result);
        console.log(`     ✅ 완료 (SD≤2: ${Math.round(result.sdUnder2 / 5)}%, 평균SD: ${result.avgSD}, 다양성: ${result.avgDiversity}%)`);
    }

    results.sort((a, b) => {
        if (a.sdUnder2 !== b.sdUnder2) return b.sdUnder2 - a.sdUnder2;
        if (a.avgSD !== b.avgSD) return a.avgSD - b.avgSD;
        return b.avgDiversity - a.avgDiversity;
    });

    console.log('\n📊 최종 결과:');
    console.log('─'.repeat(70));
    console.log(`${'순위'.padEnd(4)} | ${'알고리즘'.padEnd(15)} | ${'SD≤2'.padEnd(8)} | ${'평균SD'.padEnd(10)} | 다양성`);
    console.log('─'.repeat(70));
    results.forEach((r, i) => {
        const mark = i === 0 ? '🏆' : '  ';
        console.log(`${mark}${(i + 1).toString().padEnd(2)} | ${r.name.padEnd(15)} | ${(Math.round(r.sdUnder2 / 5) + '%').padEnd(8)} | ${r.avgSD.toString().padEnd(10)} | ${r.avgDiversity}%`);
    });

    console.log('\n==========================================');
    console.log(`🏆 테니스 시나리오 우승: ${results[0].name}`);
    console.log('==========================================\n');
}

main().catch(console.error);
