import { Player, Team, BalanceResult, SportType, Position, Tier, TeamConstraint } from '../types';

/**
 * 하이브리드 팀 밸런싱 알고리즘
 * 1단계: 제약조건 기반 초기 배치 (CSP)
 * 2단계: 시뮬레이티드 어닐링 최적화
 * 3단계: 다양성 검증
 */

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

const getTeamHash = (team: Team): string => {
    return team.players.map(p => p.id).sort().join(',');
};

// ========== 1단계: 제약조건 기반 초기 배치 ==========

interface ConstraintGroup {
    type: 'MATCH' | 'SPLIT';
    playerIds: string[];
}

function analyzeConstraintGroups(constraints: TeamConstraint[]): {
    matchGroups: string[][];
    splitGroups: string[][];
} {
    const matchGroups: string[][] = [];
    const splitGroups: string[][] = [];

    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            matchGroups.push([...constraint.playerIds]);
        } else if (constraint.type === 'SPLIT') {
            splitGroups.push([...constraint.playerIds]);
        }
    }

    return { matchGroups, splitGroups };
}

function buildInitialTeamsWithConstraints(
    players: Player[],
    teamCount: number,
    constraints: TeamConstraint[],
    customQuotas?: Partial<Record<Position, number | null>>,
    allPossiblePositions: Position[] = ['NONE']
): Team[] {
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));

    const activePlayers = [...players.filter(p => p.isActive)];
    const assigned = new Set<string>();
    const { matchGroups, splitGroups } = analyzeConstraintGroups(constraints);

    // 1. MATCH 제약 처리 (같은 팀)
    for (const group of matchGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0) continue;

        // 가장 여유로운 팀 찾기
        const targetTeamIdx = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len)[0].i;

        for (const player of groupPlayers) {
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        }
    }

    // 2. SPLIT 제약 처리 (다른 팀)
    for (const group of splitGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0) continue;

        // 각 선수를 다른 팀에 배치
        const sortedTeams = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len);

        groupPlayers.forEach((player, idx) => {
            const targetTeamIdx = sortedTeams[idx % teamCount].i;
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        });
    }

    // 3. 나머지 선수 랜덤 배치
    const remainingPlayers = shuffle(activePlayers.filter(p => !assigned.has(p.id)));

    for (const player of remainingPlayers) {
        // 가장 여유로운 팀 찾기
        const targetTeamIdx = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len)[0].i;

        teams[targetTeamIdx].players.push({ ...player });
    }

    // 4. 초기 포지션 및 스킬 할당
    teams.forEach(team => {
        team.players.forEach(player => {
            const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
            player.assignedPosition = p1s[0] || 'NONE';
        });
        recalculateTeamSkill(team);
    });

    return teams;
}

function recalculateTeamSkill(team: Team): void {
    team.totalSkill = 0;
    for (const player of team.players) {
        const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
        const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
        const p3s = player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : []);

        let penalty = 0;
        if (p1s.includes(player.assignedPosition || 'NONE')) penalty = 0;
        else if (p2s.includes(player.assignedPosition || 'NONE')) penalty = 0.5;
        else if (p3s.includes(player.assignedPosition || 'NONE')) penalty = 1.0;
        else penalty = 2.0;

        team.totalSkill += (player.tier - penalty);
    }
    team.totalSkill = Number(team.totalSkill.toFixed(1));
}

// ========== 2단계: 시뮬레이티드 어닐링 ==========

function canSwap(
    player1: Player,
    team1Idx: number,
    player2: Player,
    team2Idx: number,
    teams: Team[],
    constraints: TeamConstraint[],
    customQuotas?: Partial<Record<Position, number | null>>
): boolean {
    // 제약조건 체크
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const partnersOfP1 = constraint.playerIds.filter(id => id !== player1.id);
            const partnersOfP2 = constraint.playerIds.filter(id => id !== player2.id);

            // player1이 제약에 포함되어 있고, 파트너가 team2에 없으면 불가
            if (constraint.playerIds.includes(player1.id)) {
                const hasPartnerInTeam2 = teams[team2Idx].players.some(p => partnersOfP1.includes(p.id) && p.id !== player2.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP1.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam2) return false;
            }

            // player2 동일 체크
            if (constraint.playerIds.includes(player2.id)) {
                const hasPartnerInTeam1 = teams[team1Idx].players.some(p => partnersOfP2.includes(p.id) && p.id !== player1.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP2.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam1) return false;
            }
        } else if (constraint.type === 'SPLIT') {
            // player1과 player2가 같은 SPLIT 그룹이면 교환 불가 (이미 분리되어 있어야 함)
            if (constraint.playerIds.includes(player1.id) && constraint.playerIds.includes(player2.id)) {
                return false;
            }
        }
    }

    return true;
}

function swapPlayers(
    teams: Team[],
    player1: Player,
    team1Idx: number,
    player2: Player,
    team2Idx: number
): Team[] {
    const newTeams = cloneTeams(teams);

    // player1 제거 및 team2에 추가
    newTeams[team1Idx].players = newTeams[team1Idx].players.filter(p => p.id !== player1.id);
    newTeams[team2Idx].players.push({ ...player1 });

    // player2 제거 및 team1에 추가
    newTeams[team2Idx].players = newTeams[team2Idx].players.filter(p => p.id !== player2.id);
    newTeams[team1Idx].players.push({ ...player2 });

    // 스킬 재계산
    recalculateTeamSkill(newTeams[team1Idx]);
    recalculateTeamSkill(newTeams[team2Idx]);

    return newTeams;
}

// ========== 3단계: 다양성 검증 ==========

function calculatePairSimilarity(
    currentTeams: Team[],
    previousHashes: string[]
): number {
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

    // 이전 해시들로부터 페어 추출 및 비교
    let maxSimilarity = 0;
    for (const prevHash of previousHashes) {
        const prevPairs = new Set<string>();
        const playerIds = prevHash.split(',');
        for (let i = 0; i < playerIds.length; i++) {
            for (let j = i + 1; j < playerIds.length; j++) {
                const pair = [playerIds[i], playerIds[j]].sort().join('-');
                prevPairs.add(pair);
            }
        }

        const intersection = [...currentPairs].filter(p => prevPairs.has(p)).length;
        const similarity = currentPairs.size > 0 ? intersection / currentPairs.size : 0;
        maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
}

// ========== 평가 함수 ==========

function evaluateSolution(
    teams: Team[],
    constraints: TeamConstraint[],
    customQuotas: Partial<Record<Position, number | null>> | undefined,
    previousHashes: string[],
    ignoreTier: boolean,
    allPossiblePositions: Position[]
): number {
    let score = 0;

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
        }
        if (constraint.type === 'SPLIT' && teamIdsFound.size === 1 && constraint.playerIds.length > 1) {
            score += 100000000;
        }
    }

    // 3순위: 포지션 쿼터 위반 (1000만 점)
    if (customQuotas) {
        Object.entries(customQuotas).forEach(([pos, quota]) => {
            if (typeof quota === 'number') {
                teams.forEach(t => {
                    const count = t.players.filter(p => p.assignedPosition === pos).length;
                    if (count !== quota) {
                        score += Math.abs(count - quota) * 10000000;
                    }
                });
            }
        });
    }

    // 4순위: 멤버 페어 유사도 (100만 점)
    const similarity = calculatePairSimilarity(teams, previousHashes);
    score += similarity * 1000000;

    // 5순위: 실력 표준편차 (1-10점)
    if (!ignoreTier) {
        const totalSkills = teams.map(t => t.totalSkill);
        const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teams.length;
        const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teams.length;
        const stdDev = Math.sqrt(variance);
        score += stdDev;
    }

    // 6순위: 포지션 선호도 (0.01점)
    teams.forEach(team => {
        team.players.forEach(player => {
            const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
            const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
            const p3s = player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : []);

            if (!p1s.includes(player.assignedPosition || 'NONE')) {
                if (p2s.includes(player.assignedPosition || 'NONE')) score += 0.002;
                else if (p3s.includes(player.assignedPosition || 'NONE')) score += 0.004;
                else score += 0.01;
            }
        });
    });

    return score;
}

// ========== 2단계: 최적화 알고리즘 (Hybrid) ==========

// --- Strategy A: Genetic Algorithm ---

function performGeneticAlgorithm(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    customQuotas: Partial<Record<Position, number | null>> | undefined,
    previousHashes: string[],
    ignoreTier: boolean,
    allPossiblePositions: Position[],
    popSize: number = 20,
    generations: number = 20
): Team[] {
    let population: Team[][] = [];

    // 초기 해집단 생성 (Shuffling)
    const allPlayers = initialTeams.flatMap(t => t.players);
    for (let i = 0; i < popSize; i++) {
        if (i === 0) {
            population.push(cloneTeams(initialTeams));
        } else {
            const shuffled = shuffle([...allPlayers]);
            const newTeams = cloneTeams(initialTeams);
            // 구조만 유지하고 선수 재배치
            newTeams.forEach(t => t.players = []);

            // 기존 initialTeams의 구조(팀 개수 등)를 따름. 여기서는 단순 분배
            // buildInitialTeamsWithConstraints 로직을 재사용하면 좋겠지만, 
            // 여기서는 단순 셔플 후 제약 고려 없이 일단 넣고 평가값으로 필터링하는 방식 사용
            // 혹은 swap을 무작위로 많이 수행하여 변경
            let tempTeams = cloneTeams(initialTeams);
            for (let k = 0; k < 20; k++) {
                const t1 = Math.floor(Math.random() * tempTeams.length);
                const t2 = Math.floor(Math.random() * tempTeams.length);
                if (t1 !== t2 && tempTeams[t1].players.length > 0 && tempTeams[t2].players.length > 0) {
                    const p1 = tempTeams[t1].players[Math.floor(Math.random() * tempTeams[t1].players.length)];
                    const p2 = tempTeams[t2].players[Math.floor(Math.random() * tempTeams[t2].players.length)];
                    // 제약 무시하고 섞음 (다양성 확보) - 평가는 나중에
                    // 단, canSwap 체크를 하면 초기 해가 너무 비슷해질 수 있음
                    if (canSwap(p1, t1, p2, t2, tempTeams, constraints, customQuotas)) {
                        tempTeams = swapPlayers(tempTeams, p1, t1, p2, t2);
                    }
                }
            }
            population.push(tempTeams);
        }
    }

    let bestSolution = cloneTeams(initialTeams);
    let bestScore = evaluateSolution(bestSolution, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

    for (let gen = 0; gen < generations; gen++) {
        // 평가 및 정렬
        const scoredPop = population.map(indi => ({
            teams: indi,
            score: evaluateSolution(indi, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions)
        }));
        scoredPop.sort((a, b) => a.score - b.score);

        // 최고 기록 갱신
        if (scoredPop[0].score < bestScore) {
            bestScore = scoredPop[0].score;
            bestSolution = cloneTeams(scoredPop[0].teams);
        }

        // 다음 세대 생성
        const nextGen: Team[][] = [];
        // 상위 20% 엘리트 보존
        const eliteCount = Math.floor(popSize * 0.2);
        for (let i = 0; i < eliteCount; i++) {
            nextGen.push(cloneTeams(scoredPop[i].teams));
        }

        while (nextGen.length < popSize) {
            // 토너먼트 선택
            const parentIdx = Math.floor(Math.random() * (popSize / 2)); // 상위 50% 중에서 랜덤
            const parent = scoredPop[parentIdx].teams;

            // 변이 (Mutation) - Swap 연산
            let child = cloneTeams(parent);
            // 1~3회 Swap 적용
            const mutations = Math.floor(Math.random() * 3) + 1;
            for (let m = 0; m < mutations; m++) {
                const t1 = Math.floor(Math.random() * child.length);
                const t2 = Math.floor(Math.random() * child.length);
                if (t1 !== t2 && child[t1].players.length > 0 && child[t2].players.length > 0) {
                    const p1 = child[t1].players[Math.floor(Math.random() * child[t1].players.length)];
                    const p2 = child[t2].players[Math.floor(Math.random() * child[t2].players.length)];

                    if (canSwap(p1, t1, p2, t2, child, constraints, customQuotas)) {
                        child = swapPlayers(child, p1, t1, p2, t2);
                    }
                }
            }
            nextGen.push(child);
        }
        population = nextGen;
    }

    return bestSolution;
}

// --- Strategy B: Particle Swarm Optimization (PSO) ---

function performPSO(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    customQuotas: Partial<Record<Position, number | null>> | undefined,
    previousHashes: string[],
    ignoreTier: boolean,
    allPossiblePositions: Position[],
    particlesCount: number = 20,
    iterations: number = 30
): Team[] {
    // PSO 초기화
    // 각 입자는 '현재 위치(팀 구성)'와 '개인 최고 기록(pBest)'를 가짐
    let particles = Array.from({ length: particlesCount }, () => {
        const teams = cloneTeams(initialTeams);
        // 초기 무작위 셔플 (다양성)
        for (let k = 0; k < 15; k++) {
            const t1 = Math.floor(Math.random() * teams.length);
            const t2 = Math.floor(Math.random() * teams.length);
            if (t1 !== t2 && teams[t1].players.length > 0 && teams[t2].players.length > 0) {
                const p1 = teams[t1].players[Math.floor(Math.random() * teams[t1].players.length)];
                const p2 = teams[t2].players[Math.floor(Math.random() * teams[t2].players.length)];
                if (canSwap(p1, t1, p2, t2, teams, constraints, customQuotas)) {
                    const newTeams = swapPlayers(teams, p1, t1, p2, t2);
                    // swapPlayers는 새로운 객체를 반환하지 않고 내부 변경이 아니므로
                    // swapPlayers 구현을 확인해야 함. 위 swapPlayers는 clone을 반환함.
                    // 따라서 teams를 업데이트 해줘야 함.
                    // 여기서 swapPlayers 호출 시 teams가 업데이트 되지 않으므로
                    // teams = swapPlayers(...) 가 되어야 하는데
                    // 위쪽 로직을 보면 swapPlayers는 clone을 리턴함.

                    // 임시 변수 사용
                    const temp = swapPlayers(teams, p1, t1, p2, t2);
                    // teams 내용물 교체 (참조 유지 위해 내용만 복사하거나 재할당)
                    // 여기서는 간단히 재할당 (particles 배열 생성 중이므로 가능)
                    return temp;
                }
            }
        }
        return teams;
    });

    // swapPlayers가 clone을 반환하므로 위 로직 약간 수정 필요
    // particles 배열을 제대로 채우기 위해 다시 작성
    particles = [];
    for (let i = 0; i < particlesCount; i++) {
        let p = cloneTeams(initialTeams);
        // 다양성 주입
        for (let k = 0; k < 10; k++) {
            const t1 = Math.floor(Math.random() * p.length);
            const t2 = Math.floor(Math.random() * p.length);
            if (t1 !== t2 && p[t1].players.length > 0 && p[t2].players.length > 0) {
                const pl1 = p[t1].players[Math.floor(Math.random() * p[t1].players.length)];
                const pl2 = p[t2].players[Math.floor(Math.random() * p[t2].players.length)];
                if (canSwap(pl1, t1, pl2, t2, p, constraints, customQuotas)) {
                    p = swapPlayers(p, pl1, t1, pl2, t2);
                }
            }
        }
        particles.push(p);
    }

    let pBests = particles.map(p => ({
        teams: cloneTeams(p),
        score: evaluateSolution(p, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions)
    }));

    let gBest = pBests.reduce((best, current) => current.score < best.score ? current : best, pBests[0]);

    // PSO 루프
    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < particlesCount; i++) {
            let currentTeams = particles[i];

            // 속도(Velocity) 개념을 Swap 횟수나 확률로 적용
            // 글로벌 최적해 방향으로 이동 (gBest와 비슷해지도록 노력?? -> 이산 문제라 어려움)
            // 대신, 랜덤 Swap을 수행하되, 개선되면 pBest 업데이트하는 방식 (Stochastic Local Search에 가까움)
            // 전형적인 PSO의 '위치 이동'을 'Swap 연산'으로 대체

            const swapAttempts = 15; // 속도에 해당
            for (let s = 0; s < swapAttempts; s++) {
                const t1 = Math.floor(Math.random() * currentTeams.length);
                const t2 = Math.floor(Math.random() * currentTeams.length);

                if (t1 !== t2 && currentTeams[t1].players.length > 0 && currentTeams[t2].players.length > 0) {
                    const pl1 = currentTeams[t1].players[Math.floor(Math.random() * currentTeams[t1].players.length)];
                    const pl2 = currentTeams[t2].players[Math.floor(Math.random() * currentTeams[t2].players.length)];

                    if (canSwap(pl1, t1, pl2, t2, currentTeams, constraints, customQuotas)) {
                        const nextTeams = swapPlayers(currentTeams, pl1, t1, pl2, t2);
                        const nextScore = evaluateSolution(nextTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

                        currentTeams = nextTeams;
                        // pBest 갱신
                        if (nextScore < pBests[i].score) {
                            pBests[i] = { teams: cloneTeams(nextTeams), score: nextScore };
                            // gBest 갱신
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

// --- Strategy C: Hybrid Optimization (Main) ---

function performHybridOptimization(
    initialTeams: Team[],
    constraints: TeamConstraint[],
    customQuotas: Partial<Record<Position, number | null>> | undefined,
    previousHashes: string[],
    ignoreTier: boolean,
    allPossiblePositions: Position[]
): Team[] {
    // 3가지 전략 동시 실행 (순차적이지만 논리적으로 경쟁)

    // 1. Baseline (초기값 그대로)
    const baseScore = evaluateSolution(initialTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

    // 2. Genetic Algorithm
    const gaResult = performGeneticAlgorithm(initialTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);
    const gaScore = evaluateSolution(gaResult, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

    // 3. PSO
    const psoResult = performPSO(initialTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);
    const psoScore = evaluateSolution(psoResult, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

    // 최적 결과 선택
    let bestTeams = initialTeams;
    let bestScore = baseScore;

    if (gaScore < bestScore) {
        bestTeams = gaResult;
        bestScore = gaScore;
    }

    if (psoScore < bestScore) {
        bestTeams = psoResult;
        bestScore = psoScore;
    }

    return bestTeams;
}

// ========== 메인 함수 ==========

export const generateBalancedTeams = (
    players: Player[],
    teamCount: number,
    customQuotas?: Partial<Record<Position, number | null>>,
    constraints: TeamConstraint[] = [],
    ignoreTier: boolean = false,
    previousHashes: string[] = []
): BalanceResult => {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0) return { teams: [], standardDeviation: 0 };

    const sport = activePlayers[0].sportType;
    const allPossiblePositions: Position[] =
        sport === SportType.SOCCER ? ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
            sport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
                sport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                    ['NONE'];

    // 1단계: 제약조건 기반 초기 배치
    const initialTeams = buildInitialTeamsWithConstraints(
        activePlayers,
        teamCount,
        constraints,
        customQuotas,
        allPossiblePositions
    );

    // 2단계: Hybrid 최적화 (GA + PSO + Baseline)
    const optimizedTeams = performHybridOptimization(
        initialTeams,
        constraints,
        customQuotas,
        previousHashes,
        ignoreTier,
        allPossiblePositions
    );

    // 4단계: 최종 인원 균형 맞추기 (Move)
    // 최적화 과정에서 swap만 일어나므로 초기 혹은 중간에 인원 불균형이 고착될 수 있음.
    // 따라서 강제로 인원이 많은 팀에서 적은 팀으로 이동시킴
    let balancedTeams = cloneTeams(optimizedTeams);
    const targetSize = Math.floor(activePlayers.length / teamCount);
    // const remainder = activePlayers.length % teamCount; // 나머지는 허용

    let iterations = 0;
    while (iterations < 50) {
        // 가장 많은 팀과 가장 적은 팀 찾기
        let maxTeamIdx = -1, minTeamIdx = -1;
        let maxSize = -1, minSize = 999;

        balancedTeams.forEach((t, i) => {
            if (t.players.length > maxSize) { maxSize = t.players.length; maxTeamIdx = i; }
            if (t.players.length < minSize) { minSize = t.players.length; minTeamIdx = i; }
        });

        // 차이가 1 이하면 균형 잡힌 상태
        if (maxSize - minSize <= 1) break;

        // maxTeam에서 minTeam으로 이동해볼 후보들 점수 매기기
        const sourceTeam = balancedTeams[maxTeamIdx];

        // SD가 가장 낮아지는(좋아지는) 이동을 선택
        let bestCandidate = null;
        let bestScoreDelta = Infinity;

        // 현재 상태 점수 (SD 관련 부분만 약식 계산하거나 전체 평가 호출)
        // 여기서는 빠르게 evaluateSolution 호출
        const currentScore = evaluateSolution(balancedTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

        for (const player of sourceTeam.players) {
            // 임시 이동 팀 구성
            const tempTeams = cloneTeams(balancedTeams);

            // 1. 출발 팀에서 제거 (ID 비교 강화)
            const initialLength = tempTeams[maxTeamIdx].players.length;
            tempTeams[maxTeamIdx].players = tempTeams[maxTeamIdx].players.filter(p => String(p.id) !== String(player.id));

            // 제거되지 않았다면 스킵 (오류 방지)
            if (tempTeams[maxTeamIdx].players.length === initialLength) continue;

            // 2. 도착 팀에 추가 (이미 있는지 체크)
            if (!tempTeams[minTeamIdx].players.some(p => String(p.id) === String(player.id))) {
                tempTeams[minTeamIdx].players.push({ ...player });
            } else {
                continue; // 이미 존재하면 스킵
            }

            // 이동 후 포지션/스킬 재계산 (필수)
            recalculateTeamSkill(tempTeams[maxTeamIdx]);
            recalculateTeamSkill(tempTeams[minTeamIdx]);

            // 1. 제약 조건 체크 (필수) - 위반 시 스킵
            let constraintsOk = true;
            for (const c of constraints) {
                const pIds = c.playerIds;
                if (c.type === 'MATCH' && pIds.includes(player.id)) {
                    // 혼자 이동 불가, 찢어지면 안됨
                    const partnerInSource = tempTeams[maxTeamIdx].players.some(p => pIds.includes(p.id));
                    const partnerInOther = tempTeams.some((t, idx) => idx !== maxTeamIdx && idx !== minTeamIdx && t.players.some(p => pIds.includes(p.id)));
                    if (partnerInSource || partnerInOther) { constraintsOk = false; break; }
                }
                if (c.type === 'SPLIT' && pIds.includes(player.id)) {
                    const enemyInTarget = tempTeams[minTeamIdx].players.some(p => pIds.includes(p.id) && p.id !== player.id);
                    if (enemyInTarget) { constraintsOk = false; break; }
                }
            }
            if (!constraintsOk) continue;

            // 2. 점수 평가 (SD 포함)
            const score = evaluateSolution(tempTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

            if (score < bestScoreDelta) {
                bestScoreDelta = score;
                bestCandidate = { player, tempTeams };
            }
        }

        if (bestCandidate) {
            balancedTeams = bestCandidate.tempTeams;
            // 하나 옮기고 난 후, 팀 상황이 변했으므로 다시 루프(가장 많은 팀, 적은 팀 다시 찾기)
        } else {
            break; // 옮길 수 있는 유효한 후보가 없음 (제약 때문일 가능성)
        }

        iterations++;
    }

    // 다시 스킬/포지션 재계산
    balancedTeams.forEach(t => {
        t.players.forEach(player => {
            const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
            player.assignedPosition = p1s[0] || 'NONE';
        });
        recalculateTeamSkill(t);
    });

    const optimizedTeamsFinal = balancedTeams; // 변수명 맞춤

    // 3단계: 최종 결과 생성 (변수명 변경: optimizedTeams -> optimizedTeamsFinal)
    const totalSkills = optimizedTeamsFinal.map(t => t.totalSkill);
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teamCount;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teamCount;
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));
    const maxDiff = Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1));

    // 제약조건 검증
    let isConstraintViolated = false;
    constraints.forEach(c => {
        const teamIdsFound = new Set<number>();
        c.playerIds.forEach(pid => {
            const team = optimizedTeamsFinal.find(t => t.players.some(p => p.id === pid));
            if (team) teamIdsFound.add(team.id);
        });

        if (c.type === 'MATCH' && teamIdsFound.size > 1) {
            isConstraintViolated = true;
        }
        if (c.type === 'SPLIT' && teamIdsFound.size === 1 && c.playerIds.length > 1) {
            isConstraintViolated = true;
        }
    });

    // 포지션 쿼터 검증
    let isQuotaViolated = false;
    if (customQuotas) {
        Object.entries(customQuotas).forEach(([pos, quota]) => {
            if (typeof quota === 'number') {
                optimizedTeamsFinal.forEach(t => {
                    if (t.players.filter(p => p.assignedPosition === pos).length !== quota) {
                        isQuotaViolated = true;
                    }
                });
            }
        });
    }

    const isValid = !isConstraintViolated && !isQuotaViolated;
    const imbalanceScore = evaluateSolution(optimizedTeamsFinal, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);

    return {
        teams: optimizedTeamsFinal,
        standardDeviation,
        maxDiff,
        imbalanceScore,
        isValid,
        isConstraintViolated,
        isQuotaViolated
    };
};
