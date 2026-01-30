import { SportType } from '../types';
/**
 * 하이브리드 팀 밸런싱 알고리즘
 * 1단계: 제약조건 기반 초기 배치 (CSP)
 * 2단계: 시뮬레이티드 어닐링 최적화
 * 3단계: 다양성 검증
 */
// ========== 헬퍼 함수 ==========
const shuffle = (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};
const cloneTeams = (teams) => {
    return teams.map(t => ({
        ...t,
        players: [...t.players.map(p => ({ ...p }))]
    }));
};
const getTeamHash = (team) => {
    return team.players.map(p => p.id).sort().join(',');
};
function analyzeConstraintGroups(constraints) {
    const matchGroups = [];
    const splitGroups = [];
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            matchGroups.push([...constraint.playerIds]);
        }
        else if (constraint.type === 'SPLIT') {
            splitGroups.push([...constraint.playerIds]);
        }
    }
    return { matchGroups, splitGroups };
}
function buildInitialTeamsWithConstraints(players, teamCount, constraints, customQuotas, allPossiblePositions = ['NONE']) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));
    const activePlayers = [...players.filter(p => p.isActive)];
    const assigned = new Set();
    const { matchGroups, splitGroups } = analyzeConstraintGroups(constraints);
    // 1. MATCH 제약 처리 (같은 팀)
    for (const group of matchGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0)
            continue;
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
        if (groupPlayers.length === 0)
            continue;
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
function recalculateTeamSkill(team) {
    team.totalSkill = 0;
    for (const player of team.players) {
        const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
        const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
        const p3s = player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : []);
        let penalty = 0;
        if (p1s.includes(player.assignedPosition || 'NONE'))
            penalty = 0;
        else if (p2s.includes(player.assignedPosition || 'NONE'))
            penalty = 0.5;
        else if (p3s.includes(player.assignedPosition || 'NONE'))
            penalty = 1.0;
        else
            penalty = 2.0;
        team.totalSkill += (player.tier - penalty);
    }
    team.totalSkill = Number(team.totalSkill.toFixed(1));
}
// ========== 2단계: 시뮬레이티드 어닐링 ==========
function canSwap(player1, team1Idx, player2, team2Idx, teams, constraints, customQuotas) {
    // 제약조건 체크
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const partnersOfP1 = constraint.playerIds.filter(id => id !== player1.id);
            const partnersOfP2 = constraint.playerIds.filter(id => id !== player2.id);
            // player1이 제약에 포함되어 있고, 파트너가 team2에 없으면 불가
            if (constraint.playerIds.includes(player1.id)) {
                const hasPartnerInTeam2 = teams[team2Idx].players.some(p => partnersOfP1.includes(p.id) && p.id !== player2.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP1.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam2)
                    return false;
            }
            // player2 동일 체크
            if (constraint.playerIds.includes(player2.id)) {
                const hasPartnerInTeam1 = teams[team1Idx].players.some(p => partnersOfP2.includes(p.id) && p.id !== player1.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP2.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam1)
                    return false;
            }
        }
        else if (constraint.type === 'SPLIT') {
            // player1과 player2가 같은 SPLIT 그룹이면 교환 불가 (이미 분리되어 있어야 함)
            if (constraint.playerIds.includes(player1.id) && constraint.playerIds.includes(player2.id)) {
                return false;
            }
        }
    }
    return true;
}
function swapPlayers(teams, player1, team1Idx, player2, team2Idx) {
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
function calculatePairSimilarity(currentTeams, previousHashes) {
    if (previousHashes.length === 0)
        return 0;
    const currentPairs = new Set();
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
        const prevPairs = new Set();
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
function evaluateSolution(teams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions) {
    let score = 0;
    // 1순위: 팀 인원 균형 (1억 점)
    const teamSizes = teams.map(t => t.players.length);
    const avgSize = teamSizes.reduce((a, b) => a + b, 0) / teams.length;
    const sizeImbalance = teamSizes.reduce((sum, size) => sum + Math.abs(size - avgSize), 0);
    score += sizeImbalance * 100000000;
    // 2순위: 제약조건 위반 (1억 점)
    for (const constraint of constraints) {
        const teamIdsFound = new Set();
        constraint.playerIds.forEach(pid => {
            const team = teams.find(t => t.players.some(p => p.id === pid));
            if (team)
                teamIdsFound.add(team.id);
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
                if (p2s.includes(player.assignedPosition || 'NONE'))
                    score += 0.002;
                else if (p3s.includes(player.assignedPosition || 'NONE'))
                    score += 0.004;
                else
                    score += 0.01;
            }
        });
    });
    return score;
}
function simulatedAnnealing(initialTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions, maxIterations = 2000) {
    let currentTeams = cloneTeams(initialTeams);
    let currentScore = evaluateSolution(currentTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);
    let bestTeams = cloneTeams(currentTeams);
    let bestScore = currentScore;
    let temperature = 100.0;
    const coolingRate = 0.995;
    const minTemperature = 0.1;
    for (let i = 0; i < maxIterations; i++) {
        // 온도가 너무 낮으면 종료
        if (temperature < minTemperature)
            break;
        // 랜덤하게 두 팀 선택
        const team1Idx = Math.floor(Math.random() * currentTeams.length);
        let team2Idx = Math.floor(Math.random() * currentTeams.length);
        while (team2Idx === team1Idx && currentTeams.length > 1) {
            team2Idx = Math.floor(Math.random() * currentTeams.length);
        }
        // 각 팀에서 랜덤하게 선수 선택
        if (currentTeams[team1Idx].players.length === 0 || currentTeams[team2Idx].players.length === 0) {
            continue;
        }
        const player1 = currentTeams[team1Idx].players[Math.floor(Math.random() * currentTeams[team1Idx].players.length)];
        const player2 = currentTeams[team2Idx].players[Math.floor(Math.random() * currentTeams[team2Idx].players.length)];
        // 교환 가능 여부 체크
        if (!canSwap(player1, team1Idx, player2, team2Idx, currentTeams, constraints, customQuotas)) {
            continue;
        }
        // 교환 시도
        const newTeams = swapPlayers(currentTeams, player1, team1Idx, player2, team2Idx);
        const newScore = evaluateSolution(newTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);
        // 수용 여부 결정
        const delta = newScore - currentScore;
        const acceptanceProbability = delta < 0 ? 1.0 : Math.exp(-delta / temperature);
        if (Math.random() < acceptanceProbability) {
            currentTeams = newTeams;
            currentScore = newScore;
            // 최고 기록 갱신
            if (currentScore < bestScore) {
                bestTeams = cloneTeams(currentTeams);
                bestScore = currentScore;
            }
        }
        // 온도 감소
        temperature *= coolingRate;
    }
    return bestTeams;
}
// ========== 메인 함수 ==========
export const generateBalancedTeams = (players, teamCount, customQuotas, constraints = [], ignoreTier = false, previousHashes = []) => {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0)
        return { teams: [], standardDeviation: 0 };
    const sport = activePlayers[0].sportType;
    const allPossiblePositions = sport === SportType.SOCCER ? ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
        sport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
            sport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                ['NONE'];
    // 1단계: 제약조건 기반 초기 배치
    const initialTeams = buildInitialTeamsWithConstraints(activePlayers, teamCount, constraints, customQuotas, allPossiblePositions);
    // 2단계: 시뮬레이티드 어닐링 최적화
    const optimizedTeams = simulatedAnnealing(initialTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions, 2000);
    // 3단계: 최종 결과 생성
    const totalSkills = optimizedTeams.map(t => t.totalSkill);
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teamCount;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teamCount;
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));
    const maxDiff = Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1));
    // 제약조건 검증
    let isConstraintViolated = false;
    constraints.forEach(c => {
        const teamIdsFound = new Set();
        c.playerIds.forEach(pid => {
            const team = optimizedTeams.find(t => t.players.some(p => p.id === pid));
            if (team)
                teamIdsFound.add(team.id);
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
                optimizedTeams.forEach(t => {
                    if (t.players.filter(p => p.assignedPosition === pos).length !== quota) {
                        isQuotaViolated = true;
                    }
                });
            }
        });
    }
    const isValid = !isConstraintViolated && !isQuotaViolated;
    const imbalanceScore = evaluateSolution(optimizedTeams, constraints, customQuotas, previousHashes, ignoreTier, allPossiblePositions);
    return {
        teams: optimizedTeams,
        standardDeviation,
        maxDiff,
        imbalanceScore,
        isValid,
        isConstraintViolated,
        isQuotaViolated
    };
};
