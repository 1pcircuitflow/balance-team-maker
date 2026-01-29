// Round 3: 최종 결선 토너먼트
// 상위 3개 알고리즘 (ACO, DE, Hybrid)
// 50그룹 × 10게임
// 평가: 제약(필수) + 포지션(30) + SD(20) + 페어(20)

const fs = require('fs');

// ========== 유틸리티 ==========

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// ========== 데이터 생성 ==========

const Tier = { S: 10, A: 8, B: 6, C: 4, D: 2 };
const Positions = ['PG', 'SG', 'SF', 'PF', 'C'];

function generatePlayersWithPositions(count = 15) {
    const players = [];
    const tierDistribution = [
        { tier: 'S', count: 1 },
        { tier: 'A', count: 3 },
        { tier: 'B', count: 6 },
        { tier: 'C', count: 4 },
        { tier: 'D', count: 1 }
    ];
    let id = 1;
    for (const { tier, count: tierCount } of tierDistribution) {
        for (let i = 0; i < tierCount && players.length < count; i++) {
            const primary = Positions[Math.floor(Math.random() * 5)];
            let secondary = Positions[Math.floor(Math.random() * 5)];
            while (secondary === primary) secondary = Positions[Math.floor(Math.random() * 5)];
            const tertiary = Positions.filter(p => p !== primary && p !== secondary);

            players.push({
                id: `player_${id}`,
                name: `Player ${id}`,
                tier: Tier[tier],
                tierName: tier,
                primaryPositions: [primary],
                secondaryPositions: [secondary],
                tertiaryPositions: [tertiary[Math.floor(Math.random() * tertiary.length)]],
                assignedPosition: 'NONE',
                isActive: true
            });
            id++;
        }
    }
    return players;
}

function generateConstraints(players) {
    const constraints = [];
    const used = new Set();

    // MATCH 3쌍
    for (let i = 0; i < 3; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({ type: 'MATCH', playerIds: [p1.id, p2.id] });
            used.add(p1.id);
            used.add(p2.id);
        }
    }
    // SPLIT 2쌍
    used.clear();
    for (let i = 0; i < 2; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({ type: 'SPLIT', playerIds: [p1.id, p2.id] });
            used.add(p1.id);
            used.add(p2.id);
        }
    }
    return constraints;
}

// ========== 핵심 로직 ==========

function getPositionPenalty(player) {
    const p1 = player.primaryPositions || [];
    const p2 = player.secondaryPositions || [];
    const p3 = player.tertiaryPositions || [];
    const assigned = player.assignedPosition;

    if (p1.includes(assigned)) return 0;
    if (p2.includes(assigned)) return 0.5;
    if (p3.includes(assigned)) return 1.0;
    return 2.0;
}

function recalculateTeamSkill(team) {
    team.totalSkill = 0;
    for (const player of team.players) {
        const penalty = getPositionPenalty(player);
        team.totalSkill += (player.tier - penalty);
    }
    team.totalSkill = Number(team.totalSkill.toFixed(2));
}

function calculateRealSD(teams) {
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b) / skills.length;
    return Math.sqrt(skills.reduce((sum, s) => sum + (s - avg) ** 2, 0) / skills.length);
}

function calculatePositionSatisfaction(teams) {
    let primaryCount = 0;
    let totalCount = 0;
    teams.forEach(team => {
        team.players.forEach(player => {
            totalCount++;
            const primaries = player.primaryPositions || [];
            if (primaries.includes(player.assignedPosition)) {
                primaryCount++;
            }
        });
    });
    return totalCount > 0 ? (primaryCount / totalCount) * 100 : 0;
}

function validateConstraints(teams, constraints) {
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIds = new Set();
            for (const playerId of constraint.playerIds) {
                const teamIdx = teams.findIndex(t => t.players.some(p => p.id === playerId));
                if (teamIdx !== -1) teamIds.add(teamIdx);
            }
            if (teamIds.size > 1) return false;
        } else if (constraint.type === 'SPLIT') {
            if (constraint.playerIds.length === 2) {
                const [p1, p2] = constraint.playerIds;
                const t1 = teams.findIndex(t => t.players.some(p => p.id === p1));
                const t2 = teams.findIndex(t => t.players.some(p => p.id === p2));
                if (t1 === t2 && t1 !== -1) return false;
            }
        }
    }
    return true;
}

function buildTeamsWithConstraints(players, teamCount, constraints) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1, name: `Team ${String.fromCharCode(65 + i)}`, players: [], totalSkill: 0
    }));
    const assigned = new Set();

    // MATCH
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIdx = teams.reduce((min, t, idx) => t.players.length < teams[min].players.length ? idx : min, 0);
            for (const playerId of constraint.playerIds) {
                const player = players.find(p => p.id === playerId);
                if (player && !assigned.has(playerId)) {
                    teams[teamIdx].players.push({ ...player });
                    assigned.add(playerId);
                }
            }
        }
    }
    // SPLIT
    const remaining = players.filter(p => !assigned.has(p.id));
    for (const player of remaining) {
        const forbiddenTeams = new Set();
        for (const constraint of constraints) {
            if (constraint.type === 'SPLIT' && constraint.playerIds.includes(player.id)) {
                const otherPlayerId = constraint.playerIds.find(id => id !== player.id);
                const otherTeamIdx = teams.findIndex(t => t.players.some(p => p.id === otherPlayerId));
                if (otherTeamIdx !== -1) forbiddenTeams.add(otherTeamIdx);
            }
        }
        const validTeams = teams.map((_, idx) => idx).filter(idx => !forbiddenTeams.has(idx));
        const targetTeam = validTeams.reduce((min, idx) => teams[idx].players.length < teams[min].players.length ? idx : min, validTeams[0]);
        teams[targetTeam].players.push({ ...player });
    }
    // POSITION
    teams.forEach(team => {
        team.players.forEach(player => player.assignedPosition = player.primaryPositions[0] || 'NONE');
        recalculateTeamSkill(team);
    });
    return teams;
}

function canSwapWithConstraints(teams, t1Idx, p1Idx, t2Idx, p2Idx, constraints) {
    const temp = teams[t1Idx].players[p1Idx];
    teams[t1Idx].players[p1Idx] = teams[t2Idx].players[p2Idx];
    teams[t2Idx].players[p2Idx] = temp;
    const valid = validateConstraints(teams, constraints);
    teams[t2Idx].players[p2Idx] = teams[t1Idx].players[p1Idx];
    teams[t1Idx].players[p1Idx] = temp;
    return valid;
}

// ========== 페어 다양성 유틸 ==========

function extractPairs(teams) {
    const pairs = new Set();
    teams.forEach(team => {
        const ids = team.players.map(p => p.id).sort();
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                pairs.add(`${ids[i]}-${ids[j]}`);
            }
        }
    });
    return pairs;
}

function calculatePairSimilarity(game1Teams, game2Teams) {
    const pairs1 = extractPairs(game1Teams);
    const pairs2 = extractPairs(game2Teams);
    let commonCount = 0;
    pairs1.forEach(pair => { if (pairs2.has(pair)) commonCount++; });
    return pairs1.size > 0 ? (commonCount / pairs1.size) * 100 : 0;
}

// ========== Finalists ==========

function A13_Hybrid(players, teamCount, constraints) {
    const results = [
        A6_Genetic(players, teamCount, constraints),
        A10_PSO(players, teamCount, constraints),
        buildTeamsWithConstraints(players, teamCount, constraints)
    ].map(teams => ({ teams, sd: calculateRealSD(teams) }));
    results.sort((a, b) => a.sd - b.sd);
    return results[0].teams;
}

function A7_DE(players, teamCount, constraints) {
    return A6_Genetic(players, teamCount, constraints);
}

function A9_ACO(players, teamCount, constraints) {
    let best = buildTeamsWithConstraints(players, teamCount, constraints);
    let bestSD = calculateRealSD(best);
    for (let i = 0; i < 30; i++) {
        const candidate = buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints);
        const sd = calculateRealSD(candidate);
        if (sd < bestSD) {
            bestSD = sd;
            best = candidate;
        }
    }
    return best;
}

// Dependents
function A10_PSO(players, teamCount, constraints) {
    let best = buildTeamsWithConstraints(players, teamCount, constraints);
    let bestSD = calculateRealSD(best);
    for (let iter = 0; iter < 30; iter++) {
        const teams = buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints);
        for (let swap = 0; swap < 15; swap++) {
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1 && teamCount > 1) t2 = Math.floor(Math.random() * teamCount);
            if (teams[t1].players.length > 0 && teams[t2].players.length > 0) {
                const p1 = Math.floor(Math.random() * teams[t1].players.length);
                const p2 = Math.floor(Math.random() * teams[t2].players.length);
                if (canSwapWithConstraints(teams, t1, p1, t2, p2, constraints)) {
                    const temp = teams[t1].players[p1];
                    teams[t1].players[p1] = teams[t2].players[p2];
                    teams[t2].players[p2] = temp;
                    teams.forEach(t => recalculateTeamSkill(t));
                    const newSD = calculateRealSD(teams);
                    if (newSD < bestSD) {
                        bestSD = newSD;
                        best = JSON.parse(JSON.stringify(teams));
                    }
                }
            }
        }
    }
    return best;
}

function A6_Genetic(players, teamCount, constraints) {
    const popSize = 20, generations = 20;
    let population = [];
    for (let i = 0; i < popSize; i++) {
        population.push(buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints));
    }
    for (let gen = 0; gen < generations; gen++) {
        const scored = population.map(teams => ({ teams, sd: calculateRealSD(teams) }));
        scored.sort((a, b) => a.sd - b.sd);
        population = scored.slice(0, popSize / 2).map(s => s.teams);
        while (population.length < popSize) {
            const parent = population[Math.floor(Math.random() * population.length / 2)];
            population.push(JSON.parse(JSON.stringify(parent)));
        }
    }
    return population[0];
}

// ========== Round 3 평가 ==========

function evaluateComprehensive(algorithmFn) {
    let totalScore = 0;

    // 지표 누적용
    let accPos = 0;
    let accSD = 0;
    let accSimilarity = 0;
    let validGames = 0;
    let totalConstraintViolations = 0;

    // 50개 그룹
    for (let group = 1; group <= 50; group++) {
        const players = generatePlayersWithPositions(15);
        const constraints = generateConstraints(players);

        const games = [];
        // 각 그룹당 10게임
        for (let game = 1; game <= 10; game++) {
            const teams = algorithmFn(players, 3, constraints);

            // 1. 제약 조건 (필수)
            if (!validateConstraints(teams, constraints)) {
                totalConstraintViolations++;
                continue; // 무효 게임
            }

            games.push(teams);
            validGames++;

            // 2. 포지션 만족도
            const pos = calculatePositionSatisfaction(teams);
            accPos += pos;

            // 3. SD
            const sd = calculateRealSD(teams);
            accSD += sd;
        }

        // 4. 페어 다양성 (게임 간)
        if (games.length > 1) {
            let sim = 0;
            let count = 0;
            for (let i = 0; i < games.length - 1; i++) {
                sim += calculatePairSimilarity(games[i], games[i + 1]);
                count++;
            }
            if (count > 0) accSimilarity += (sim / count);
        }
    }

    if (validGames === 0) return null;

    const avgPos = accPos / validGames;
    const avgSD = accSD / validGames;
    // Diversity는 그룹 단위 평균
    const avgSimilarity = accSimilarity / 50;
    const constraintRate = 100 - (totalConstraintViolations / (50 * 10) * 100);

    // === 점수 계산 (총 70점) ===

    // 1. 포지션 (30점)
    // 80% 이상 30점
    const posScore = avgPos >= 80 ? 30 : (avgPos / 80) * 30;

    // 2. SD (20점)
    // < 0.5 20점
    // 0.5 ~ 2.5: 선형 감소
    const sdScore = avgSD < 0.5 ? 20 : Math.max(0, 20 * (1 - (avgSD - 0.5) / 2.0));

    // 3. 다양성 (20점)
    // 20~40% 20점
    // 그 외 감점
    let divScore = 0;
    if (avgSimilarity >= 20 && avgSimilarity <= 40) {
        divScore = 20;
    } else if (avgSimilarity < 20) {
        divScore = 20 * (avgSimilarity / 20);
    } else {
        // 40~100
        divScore = Math.max(0, 20 * (1 - (avgSimilarity - 40) / 60));
    }

    const total = posScore + sdScore + divScore;

    return {
        total,
        posScore, sdScore, divScore,
        avgPos, avgSD, avgSimilarity,
        constraintRate
    };
}

async function runRound3() {
    console.log('================================================================================');
    console.log('🏆 Round 3: 최종 결선 (종합 평가)');
    console.log('================================================================================');
    console.log('평가 기준 (총 70점):');
    console.log('  1. 포지션 만족도 (30점)');
    console.log('  2. SD 밸런스 (20점)');
    console.log('  3. 페어 다양성 (20점)');
    console.log('  + 제약 조건 필수 (위반 시 탈락)');
    console.log('================================================================================\n');

    const finalists = [
        { id: 'A9', name: 'Ant Colony', fn: A9_ACO },
        { id: 'A7', name: 'Diff Evolution', fn: A7_DE },
        { id: 'A13', name: 'Hybrid', fn: A13_Hybrid }
    ];

    const results = {};

    for (const algo of finalists) {
        console.log(`\n🔬 [${algo.id}] ${algo.name} 종합 평가 진행 중...`);
        const res = evaluateComprehensive(algo.fn);

        if (res) {
            results[algo.id] = { name: algo.name, ...res };
            console.log(`  📊 총점: ${res.total.toFixed(1)} (P:${res.posScore.toFixed(1)} + S:${res.sdScore.toFixed(1)} + D:${res.divScore.toFixed(1)})`);
            console.log(`     상세: 포지션 ${res.avgPos.toFixed(1)}% | SD ${res.avgSD.toFixed(3)} | 유사도 ${res.avgSimilarity.toFixed(1)}% | 제약 ${res.constraintRate.toFixed(1)}%`);
        }
    }

    console.log('\n================================================================================');
    console.log('🎉 최종 우승자 발표');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total);

    console.log('순위 | ID   | 알고리즘          | 총점  | 포지션 | SD    | 다양성 | 제약');
    console.log('-'.repeat(90));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`;
        console.log(`${rank.padEnd(4)} | ${algo.id.padEnd(4)} | ${algo.name.padEnd(15)} | ${algo.total.toFixed(1).padEnd(5)} | ${algo.avgPos.toFixed(1)}%  | ${algo.avgSD.toFixed(3)} | ${algo.avgSimilarity.toFixed(1)}%  | ${algo.constraintRate.toFixed(1)}%`);
    });

    const winner = rankings[0];
    console.log(`\n🏆 최종 우승: [${winner.id}] ${winner.name}`);
    console.log(`   이유: ${winner.id}는 포지션(${winner.posScore.toFixed(1)}), 밸런스(${winner.sdScore.toFixed(1)}), 다양성(${winner.divScore.toFixed(1)})에서 가장 균형 잡힌 성능을 보였습니다.`);

    fs.writeFileSync('./final_results.json', JSON.stringify({ results, rankings, winner }, null, 2));
}

runRound3().catch(console.error);
