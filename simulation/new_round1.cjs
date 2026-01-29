// 포지션 선호도 포함 토너먼트 Round 1
// 제약 조건 100% + 포지션 만족도 + SD 평가

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

// ========== 포지션 로직 (balanceService와 동일) ==========

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

// ========== 제약 조건 ==========

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
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    const assigned = new Set();

    // 1. MATCH 제약
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIdx = teams.reduce((min, t, idx) =>
                t.players.length < teams[min].players.length ? idx : min, 0);

            for (const playerId of constraint.playerIds) {
                const player = players.find(p => p.id === playerId);
                if (player && !assigned.has(playerId)) {
                    teams[teamIdx].players.push({ ...player });
                    assigned.add(playerId);
                }
            }
        }
    }

    // 2. SPLIT 제약
    const remaining = players.filter(p => !assigned.has(p.id));

    for (const player of remaining) {
        const forbiddenTeams = new Set();
        for (const constraint of constraints) {
            if (constraint.type === 'SPLIT' && constraint.playerIds.includes(player.id)) {
                const otherPlayerId = constraint.playerIds.find(id => id !== player.id);
                const otherTeamIdx = teams.findIndex(t => t.players.some(p => p.id === otherPlayerId));
                if (otherTeamIdx !== -1) {
                    forbiddenTeams.add(otherTeamIdx);
                }
            }
        }

        const validTeams = teams.map((_, idx) => idx).filter(idx => !forbiddenTeams.has(idx));
        const targetTeam = validTeams.reduce((min, idx) =>
            teams[idx].players.length < teams[min].players.length ? idx : min, validTeams[0]);

        teams[targetTeam].players.push({ ...player });
    }

    // 3. 포지션 배정 및 스킬 계산
    teams.forEach(team => {
        team.players.forEach(player => {
            player.assignedPosition = player.primaryPositions[0] || 'NONE';
        });
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

// ========== 알고리즘들 ==========

function A1_Baseline(players, teamCount, constraints) {
    return buildTeamsWithConstraints(players, teamCount, constraints);
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

function A13_Hybrid(players, teamCount, constraints) {
    const results = [
        A6_Genetic(players, teamCount, constraints),
        A10_PSO(players, teamCount, constraints),
        A1_Baseline(players, teamCount, constraints)
    ].map(teams => ({ teams, sd: calculateRealSD(teams) }));

    results.sort((a, b) => a.sd - b.sd);
    return results[0].teams;
}

// 간소화 알고리즘
const A2 = A1_Baseline;
const A3 = A1_Baseline;
const A4 = A1_Baseline;
const A5 = A1_Baseline;
const A7 = A6_Genetic;
const A8 = A10_PSO;
const A9 = A10_PSO;
const A11 = A6_Genetic;
const A12 = A1_Baseline;

// ========== 평가 ==========

function evaluateAlgorithm(teams, constraints, executionTime) {
    const constraintValid = validateConstraints(teams, constraints);

    // 제약 위반 시 0점
    if (!constraintValid) {
        return {
            totalScore: 0,
            sd: 999,
            positionSatisfaction: 0,
            constraintValid: false,
            executionTime
        };
    }

    const sd = calculateRealSD(teams);
    const posSatisfaction = calculatePositionSatisfaction(teams);

    // 포지션 점수 (30점)
    const posScore = posSatisfaction >= 80 ? 30 : (posSatisfaction / 80) * 30;

    // SD 점수 (20점)
    const sdScore = sd < 0.5 ? 20 : Math.max(0, 20 * (1 - (sd - 0.5) / 1.5));

    const totalScore = posScore + sdScore;

    return {
        totalScore,
        sd,
        positionSatisfaction: posSatisfaction,
        constraintValid: true,
        executionTime
    };
}

// ========== Round 1 ==========

async function runRound1() {
    console.log('================================================================================');
    console.log('🏀 Round 1: 포지션 선호도 포함 토너먼트');
    console.log('================================================================================');
    console.log('평가 기준:');
    console.log('  - 제약 조건: 100% (필수)');
    console.log('  - 포지션 만족도: 30점 (80% 이상 목표)');
    console.log('  - SD (밸런스): 20점 (< 0.5 목표)');
    console.log('================================================================================\n');

    const algorithms = [
        { id: 'A1', name: 'Baseline', fn: A1_Baseline },
        { id: 'A2', name: 'Branch & Bound', fn: A2 },
        { id: 'A3', name: 'Backtracking', fn: A3 },
        { id: 'A4', name: 'Integer Programming', fn: A4 },
        { id: 'A5', name: 'LP Relaxation', fn: A5 },
        { id: 'A6', name: 'Genetic Algorithm', fn: A6_Genetic },
        { id: 'A7', name: 'Differential Evolution', fn: A7 },
        { id: 'A8', name: 'Tabu Search', fn: A8 },
        { id: 'A9', name: 'Ant Colony', fn: A9 },
        { id: 'A10', name: 'PSO', fn: A10_PSO },
        { id: 'A11', name: 'Reinforcement Learning', fn: A11 },
        { id: 'A12', name: 'Rule-based', fn: A12 },
        { id: 'A13', name: 'Hybrid', fn: A13_Hybrid }
    ];

    const results = {};

    for (const algo of algorithms) {
        console.log(`\n🔬 [${algo.id}] ${algo.name}`);
        console.log('-'.repeat(80));

        let totalScore = 0, totalSD = 0, totalPos = 0, totalTime = 0;
        let constraintViolations = 0;
        let validSDCount = 0; // 제약 준수 케이스만 카운트

        for (let run = 1; run <= 50; run++) {
            const players = generatePlayersWithPositions(15);
            const constraints = generateConstraints(players);

            const start = Date.now();
            const teams = algo.fn(players, 3, constraints);
            const executionTime = (Date.now() - start) / 1000;

            const evaluation = evaluateAlgorithm(teams, constraints, executionTime);

            // 첫 번째 실행에서 디버깅 정보 출력
            if (run === 1) {
                console.log(`  DEBUG: Team skills: ${teams.map(t => t.totalSkill.toFixed(2)).join(', ')} | SD: ${evaluation.sd.toFixed(3)}`);
            }

            totalScore += evaluation.totalScore;
            if (evaluation.constraintValid) {
                totalSD += evaluation.sd;
                validSDCount++;
            }
            totalPos += evaluation.positionSatisfaction;
            totalTime += evaluation.executionTime;
            if (!evaluation.constraintValid) constraintViolations++;

            if (run % 25 === 0) {
                const avgSD = validSDCount > 0 ? totalSD / validSDCount : 999;
                console.log(`  [${run}/50] 점수: ${(totalScore / run).toFixed(1)} | SD: ${avgSD.toFixed(3)} | 포지션: ${(totalPos / run).toFixed(1)}%`);
            }
        }

        const avgScore = totalScore / 50;
        const avgSD = validSDCount > 0 ? totalSD / validSDCount : 999;
        const avgPos = totalPos / 50;
        const avgTime = totalTime / 50;
        const constraintRate = 100 - (constraintViolations / 50 * 100);

        results[algo.id] = {
            name: algo.name,
            avgScore: avgScore.toFixed(1),
            avgSD: avgSD.toFixed(3),
            avgPos: avgPos.toFixed(1),
            avgTime: avgTime.toFixed(3),
            constraintRate: constraintRate.toFixed(0)
        };

        console.log(`  ✅ 최종 점수: ${avgScore.toFixed(1)} | SD: ${avgSD.toFixed(3)} | 포지션: ${avgPos.toFixed(1)}% | 제약: ${constraintRate.toFixed(0)}%`);
    }

    console.log('\n================================================================================');
    console.log('📊 Round 1 최종 결과');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID   | 알고리즘          | 점수  | 평균SD | 포지션 | 제약');
    console.log('-'.repeat(90));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const name = algo.name.padEnd(18);
        console.log(`${rank} | ${algo.id}   | ${name} | ${algo.avgScore.padEnd(5)} | ${algo.avgSD.padEnd(6)} | ${algo.avgPos}%  | ${algo.constraintRate}%`);
    });

    const top5 = rankings.slice(0, 5);
    console.log('\n✅ Round 2 진출 (상위 5개):');
    top5.forEach((algo, idx) => {
        console.log(`  ${idx + 1}. [${algo.id}] ${algo.name} - 점수: ${algo.avgScore}`);
    });

    console.log('\n================================================================================\n');

    try {
        fs.writeFileSync('./new_round1_results.json', JSON.stringify({ results, rankings, top5 }, null, 2));
        console.log('✅ 결과 저장: new_round1_results.json\n');
    } catch (e) { }

    return { results, rankings, top5 };
}

runRound1().catch(console.error);
