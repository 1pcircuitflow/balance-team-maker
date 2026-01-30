// 하이브리드 팀 밸런싱 알고리즘 (JavaScript 버전)
// 1단계: 제약조건 기반 초기 배치 (CSP)
// 2단계: 시뮬레이티드 어닐링 최적화
// 3단계: 다양성 검증

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
        } else if (constraint.type === 'SPLIT') {
            splitGroups.push([...constraint.playerIds]);
        }
    }

    return { matchGroups, splitGroups };
}

function buildInitialTeamsWithConstraints(
    players,
    teamCount,
    constraints,
    customQuotas = {},
    strategyHint = 'balanced'
) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));

    const activePlayers = [...players.filter(p => p.isActive)];
    const assigned = new Set();
    const { matchGroups, splitGroups } = analyzeConstraintGroups(constraints);

    // 1. MATCH 제약 처리
    for (const group of matchGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0) continue;

        const targetTeamIdx = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len)[0].i;

        for (const player of groupPlayers) {
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        }
    }

    // 2. SPLIT 제약 처리
    for (const group of splitGroups) {
        const groupPlayers = activePlayers.filter(p => group.includes(p.id));
        if (groupPlayers.length === 0) continue;

        const sortedTeams = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len);

        groupPlayers.forEach((player, idx) => {
            const targetTeamIdx = sortedTeams[idx % teamCount].i;
            teams[targetTeamIdx].players.push({ ...player });
            assigned.add(player.id);
        });
    }

    // 3. 포지션 쿼터 기반 배치 (완전 개선 버전)
    if (Object.keys(customQuotas).length > 0) {
        const positions = Object.keys(customQuotas);

        for (const position of positions) {
            const quota = customQuotas[position];
            if (typeof quota !== 'number') continue;

            // 해당 포지션 가능한 선수들 (아직 배치되지 않은)
            const positionPlayers = activePlayers.filter(p => {
                if (assigned.has(p.id)) return false;
                const p1s = p.primaryPositions || (p.primaryPosition !== 'NONE' ? [p.primaryPosition] : []);
                const p2s = p.secondaryPositions || (p.secondaryPosition !== 'NONE' ? [p.secondaryPosition] : []);
                const p3s = p.tertiaryPositions || [];

                // 주, 보조, 3차 포지션 모두 확인
                return p1s.includes(position) || p2s.includes(position) || p3s.includes(position);
            });

            if (positionPlayers.length === 0) continue;

            // 티어별로 그룹화
            const byTier = {};
            positionPlayers.forEach(p => {
                if (!byTier[p.tier]) byTier[p.tier] = [];
                byTier[p.tier].push(p);
            });

            // 각 티어 그룹을 셔플
            Object.keys(byTier).forEach(tier => {
                byTier[tier] = shuffle(byTier[tier]);
            });

            // 전략에 따라 정렬 순서 변경
            let tiers;
            if (strategyHint === 'high-to-low') {
                tiers = Object.keys(byTier).sort((a, b) => b - a);  // 높은 티어부터
            } else if (strategyHint === 'low-to-high') {
                tiers = Object.keys(byTier).sort((a, b) => a - b);  // 낮은 티어부터
            } else if (strategyHint === 'snake') {
                const sorted = Object.keys(byTier).sort((a, b) => b - a);
                tiers = [...sorted, ...sorted.slice().reverse()];  // 지그재그
            } else {
                tiers = shuffle(Object.keys(byTier));  // 랜덤 (balanced)
            }

            // 라운드 로빈 방식으로 각 팀에 균등 배분
            let playerIdx = 0;
            const allPositionPlayers = [];
            tiers.forEach(tier => {
                if (byTier[tier]) allPositionPlayers.push(...byTier[tier]);
            });

            // 각 팀에 quota만큼 배치
            for (let round = 0; round < quota; round++) {
                for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
                    if (playerIdx >= allPositionPlayers.length) break;

                    const player = allPositionPlayers[playerIdx];
                    teams[teamIdx].players.push({ ...player });
                    assigned.add(player.id);
                    playerIdx++;
                }
            }
        }
    }

    // 4. 나머지 선수 랜덤 배치
    const remainingPlayers = shuffle(activePlayers.filter(p => !assigned.has(p.id)));

    for (const player of remainingPlayers) {
        const targetTeamIdx = teams
            .map((t, i) => ({ i, len: t.players.length }))
            .sort((a, b) => a.len - b.len)[0].i;

        teams[targetTeamIdx].players.push({ ...player });
    }

    // 5. 초기 포지션 및 스킬 할당
    teams.forEach(team => {
        // 포지션 쿼터가 있는 경우, 각 포지션에 선수 할당
        if (Object.keys(customQuotas).length > 0) {
            const positions = Object.keys(customQuotas);
            const assignedPositions = new Set();

            // 각 포지션별로 최적의 선수 찾기
            positions.forEach(position => {
                let bestPlayer = null;
                let bestPriority = 999;

                team.players.forEach(player => {
                    if (assignedPositions.has(player.id)) return;

                    const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
                    const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
                    const p3s = player.tertiaryPositions || [];

                    let priority = 999;
                    if (p1s.includes(position)) priority = 1;  // 주 포지션
                    else if (p2s.includes(position)) priority = 2;  // 보조 포지션
                    else if (p3s.includes(position)) priority = 3;  // 3차 포지션

                    if (priority < bestPriority) {
                        bestPriority = priority;
                        bestPlayer = player;
                    }
                });

                if (bestPlayer) {
                    bestPlayer.assignedPosition = position;
                    assignedPositions.add(bestPlayer.id);
                }
            });

            // 할당되지 않은 선수들은 주 포지션으로
            team.players.forEach(player => {
                if (!player.assignedPosition) {
                    const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
                    player.assignedPosition = p1s[0] || 'NONE';
                }
            });
        } else {
            // 쿼터가 없으면 주 포지션으로
            team.players.forEach(player => {
                const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
                player.assignedPosition = p1s[0] || 'NONE';
            });
        }

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
        if (p1s.includes(player.assignedPosition || 'NONE')) penalty = 0;
        else if (p2s.includes(player.assignedPosition || 'NONE')) penalty = 0.5;
        else if (p3s.includes(player.assignedPosition || 'NONE')) penalty = 1.0;
        else penalty = 2.0;

        team.totalSkill += (player.tier - penalty);
    }
    team.totalSkill = Number(team.totalSkill.toFixed(1));
}

// 포지션 재배치 가능 여부 확인
function canReassignPositions(players, customQuotas) {
    if (Object.keys(customQuotas).length === 0) return true;

    const positions = Object.keys(customQuotas);
    const assigned = new Set();

    // 각 포지션별로 할당 가능한 선수가 있는지 확인
    for (const position of positions) {
        const quota = customQuotas[position];
        let found = false;

        for (const player of players) {
            if (assigned.has(player.id)) continue;

            const p1s = player.primaryPositions || [];
            const p2s = player.secondaryPositions || [];
            const p3s = player.tertiaryPositions || [];

            if (p1s.includes(position) || p2s.includes(position) || p3s.includes(position)) {
                assigned.add(player.id);
                found = true;
                break;
            }
        }

        if (!found) return false;
    }

    return assigned.size >= positions.length;
}

function canSwap(
    player1,
    team1Idx,
    player2,
    team2Idx,
    teams,
    constraints,
    customQuotas = {}
) {
    // 포지션 쿼터 체크
    if (Object.keys(customQuotas).length > 0) {
        const p1AssignedPos = player1.assignedPosition;
        const p2AssignedPos = player2.assignedPosition;

        // 같은 할당 포지션이면 교환 가능
        if (p1AssignedPos === p2AssignedPos) return true;

        // 다른 포지션이면 쿼터 위반 체크
        const team1AfterSwap = teams[team1Idx].players.filter(p => p.id !== player1.id);
        const team2AfterSwap = teams[team2Idx].players.filter(p => p.id !== player2.id);

        // 교환 후 assignedPosition 재계산 필요
        const p1Clone = { ...player1, assignedPosition: player2.assignedPosition };
        const p2Clone = { ...player2, assignedPosition: player1.assignedPosition };

        team1AfterSwap.push(p2Clone);
        team2AfterSwap.push(p1Clone);

        // 각 팀의 포지션 쿼터 확인 (assignedPosition 기준)
        for (const [position, quota] of Object.entries(customQuotas)) {
            if (typeof quota !== 'number') continue;

            const team1Count = team1AfterSwap.filter(p => p.assignedPosition === position).length;
            const team2Count = team2AfterSwap.filter(p => p.assignedPosition === position).length;

            if (team1Count !== quota || team2Count !== quota) {
                return false;
            }
        }
    }

    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const partnersOfP1 = constraint.playerIds.filter(id => id !== player1.id);
            const partnersOfP2 = constraint.playerIds.filter(id => id !== player2.id);

            if (constraint.playerIds.includes(player1.id)) {
                const hasPartnerInTeam2 = teams[team2Idx].players.some(p => partnersOfP1.includes(p.id) && p.id !== player2.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP1.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam2) return false;
            }

            if (constraint.playerIds.includes(player2.id)) {
                const hasPartnerInTeam1 = teams[team1Idx].players.some(p => partnersOfP2.includes(p.id) && p.id !== player1.id);
                const hasPartnerInOther = teams.some((t, idx) => idx !== team1Idx && idx !== team2Idx && t.players.some(p => partnersOfP2.includes(p.id)));
                if (hasPartnerInOther && !hasPartnerInTeam1) return false;
            }
        } else if (constraint.type === 'SPLIT') {
            if (constraint.playerIds.includes(player1.id) && constraint.playerIds.includes(player2.id)) {
                return false;
            }
        }
    }

    return true;
}

function swapPlayers(teams, player1, team1Idx, player2, team2Idx, customQuotas = {}) {
    const newTeams = cloneTeams(teams);

    newTeams[team1Idx].players = newTeams[team1Idx].players.filter(p => p.id !== player1.id);
    newTeams[team2Idx].players.push({ ...player1 });

    newTeams[team2Idx].players = newTeams[team2Idx].players.filter(p => p.id !== player2.id);
    newTeams[team1Idx].players.push({ ...player2 });

    // 포지션 재배치 (쿼터 있는 경우)
    if (Object.keys(customQuotas).length > 0) {
        reassignTeamPositions(newTeams[team1Idx], customQuotas);
        reassignTeamPositions(newTeams[team2Idx], customQuotas);
    }

    recalculateTeamSkill(newTeams[team1Idx]);
    recalculateTeamSkill(newTeams[team2Idx]);

    return newTeams;
}

// 팀 포지션 재배치
function reassignTeamPositions(team, customQuotas) {
    const positions = Object.keys(customQuotas);
    const assignedPositions = new Set();

    positions.forEach(position => {
        let bestPlayer = null;
        let bestPriority = 999;

        team.players.forEach(player => {
            if (assignedPositions.has(player.id)) return;

            const p1s = player.primaryPositions || [];
            const p2s = player.secondaryPositions || [];
            const p3s = player.tertiaryPositions || [];

            let priority = 999;
            if (p1s.includes(position)) priority = 1;
            else if (p2s.includes(position)) priority = 2;
            else if (p3s.includes(position)) priority = 3;

            if (priority < bestPriority) {
                bestPriority = priority;
                bestPlayer = player;
            }
        });

        if (bestPlayer) {
            bestPlayer.assignedPosition = position;
            assignedPositions.add(bestPlayer.id);
        }
    });

    // 할당되지 않은 선수들은 주 포지션으로
    team.players.forEach(player => {
        if (!player.assignedPosition) {
            const p1s = player.primaryPositions || [];
            player.assignedPosition = p1s[0] || 'NONE';
        }
    });
}

function calculatePairSimilarity(currentTeams, previousHashes) {
    if (previousHashes.length === 0) return 0;

    const currentPairs = new Set();
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

function evaluateSolution(teams, constraints, previousHashes, customQuotas = {}) {
    let score = 0;

    // 1순위: 팀 인원 균형
    const teamSizes = teams.map(t => t.players.length);
    const avgSize = teamSizes.reduce((a, b) => a + b, 0) / teams.length;
    const sizeImbalance = teamSizes.reduce((sum, size) => sum + Math.abs(size - avgSize), 0);
    score += sizeImbalance * 100000000;

    // 2순위: 제약조건 위반
    for (const constraint of constraints) {
        const teamIdsFound = new Set();
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

    // 2.5순위: 포지션 쿼터 위반 (1억 점 - 제약조건과 동등)
    if (Object.keys(customQuotas).length > 0) {
        for (const [position, quota] of Object.entries(customQuotas)) {
            if (typeof quota !== 'number') continue;

            teams.forEach(team => {
                // assignedPosition 기준으로 카운트
                const count = team.players.filter(p => p.assignedPosition === position).length;

                if (count !== quota) {
                    score += Math.abs(count - quota) * 100000000;
                }
            });
        }
    }

    // 3순위: 멤버 페어 유사도 (10배 증폭으로 다양성 강화)
    const similarity = calculatePairSimilarity(teams, previousHashes);
    score += similarity * 10000000;  // 1000만 점

    // 4순위: 실력 표준편차
    const totalSkills = teams.map(t => t.totalSkill);
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teams.length;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teams.length;
    const stdDev = Math.sqrt(variance);
    score += stdDev;

    return score;
}

function simulatedAnnealing(
    initialTeams,
    constraints,
    previousHashes,
    customQuotas = {},
    maxIterations = 3000  // 2000 -> 3000으로 증가
) {
    let currentTeams = cloneTeams(initialTeams);
    let currentScore = evaluateSolution(currentTeams, constraints, previousHashes, customQuotas);
    let bestTeams = cloneTeams(currentTeams);
    let bestScore = currentScore;

    let temperature = 200.0;  // 100 -> 200으로 증가 (더 넓은 탐색)
    const coolingRate = 0.997;  // 0.995 -> 0.997 (더 느린 냉각)
    const minTemperature = 0.05;  // 0.1 -> 0.05 (더 오래 탐색)

    for (let i = 0; i < maxIterations; i++) {
        if (temperature < minTemperature) break;

        const team1Idx = Math.floor(Math.random() * currentTeams.length);
        let team2Idx = Math.floor(Math.random() * currentTeams.length);
        while (team2Idx === team1Idx && currentTeams.length > 1) {
            team2Idx = Math.floor(Math.random() * currentTeams.length);
        }

        if (currentTeams[team1Idx].players.length === 0 || currentTeams[team2Idx].players.length === 0) {
            continue;
        }

        const player1 = currentTeams[team1Idx].players[Math.floor(Math.random() * currentTeams[team1Idx].players.length)];
        const player2 = currentTeams[team2Idx].players[Math.floor(Math.random() * currentTeams[team2Idx].players.length)];

        if (!canSwap(player1, team1Idx, player2, team2Idx, currentTeams, constraints, customQuotas)) {
            continue;
        }

        const newTeams = swapPlayers(currentTeams, player1, team1Idx, player2, team2Idx, customQuotas);
        const newScore = evaluateSolution(newTeams, constraints, previousHashes, customQuotas);

        const delta = newScore - currentScore;
        const acceptanceProbability = delta < 0 ? 1.0 : Math.exp(-delta / temperature);

        if (Math.random() < acceptanceProbability) {
            currentTeams = newTeams;
            currentScore = newScore;

            if (currentScore < bestScore) {
                bestTeams = cloneTeams(currentTeams);
                bestScore = currentScore;
            }
        }

        temperature *= coolingRate;
    }

    return bestTeams;
}

export function generateBalancedTeams(
    players,
    teamCount,
    customQuotas = {},
    constraints = [],
    ignoreTier = false,
    previousHashes = []
) {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0) return { teams: [], standardDeviation: 0 };

    // 초기 배치 전략 선택 (다양성 향상)
    const strategies = ['balanced', 'high-to-low', 'low-to-high', 'snake'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];

    // 1단계: 제약조건 기반 초기 배치
    const initialTeams = buildInitialTeamsWithConstraints(
        activePlayers,
        teamCount,
        constraints,
        customQuotas,
        strategy
    );

    // 2단계: 시뮬레이티드 어닐링 최적화
    const optimizedTeams = simulatedAnnealing(
        initialTeams,
        constraints,
        previousHashes,
        customQuotas,
        3000  // 반복 횟수 증가
    );

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
    if (Object.keys(customQuotas).length > 0) {
        for (const [position, quota] of Object.entries(customQuotas)) {
            if (typeof quota !== 'number') continue;

            optimizedTeams.forEach(team => {
                // assignedPosition 기준으로 검증
                const count = team.players.filter(p => p.assignedPosition === position).length;

                if (count !== quota) {
                    isQuotaViolated = true;
                }
            });
        }
    }

    const isValid = !isConstraintViolated && !isQuotaViolated;
    const imbalanceScore = evaluateSolution(optimizedTeams, constraints, previousHashes, customQuotas);

    return {
        teams: optimizedTeams,
        standardDeviation,
        maxDiff,
        imbalanceScore,
        isValid,
        isConstraintViolated,
        isQuotaViolated
    };
}
