// Round 3: 최종 결선
// 3개 알고리즘 × 500회 = 1,500회

const fs = require('fs');

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function calculateSD(teams) {
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b) / skills.length;
    return Math.sqrt(skills.reduce((sum, s) => sum + (s - avg) ** 2, 0) / skills.length);
}

function generateUsers(count = 100) {
    const users = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const tierDistribution = [
        { tier: 'S', count: 5, skillRange: [9, 10] },
        { tier: 'A', count: 15, skillRange: [7, 8] },
        { tier: 'B', count: 40, skillRange: [5, 6] },
        { tier: 'C', count: 30, skillRange: [3, 4] },
        { tier: 'D', count: 10, skillRange: [1, 2] }
    ];

    let userId = 1;
    for (const { tier, count, skillRange } of tierDistribution) {
        for (let i = 0; i < count; i++) {
            const skill = skillRange[0] + Math.random() * (skillRange[1] - skillRange[0]);
            const primaryPos = positions[Math.floor(Math.random() * positions.length)];
            users.push({
                id: `user_${userId}`,
                name: `유저${userId}`,
                tier,
                skill: Number(skill.toFixed(1)),
                primaryPosition: primaryPos
            });
            userId++;
        }
    }
    return shuffle(users);
}

function generateConstraints(players) {
    const constraints = [];
    const used = new Set();

    for (let i = 0; i < 3; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({ type: 'MATCH', playerIds: [p1.id, p2.id] });
            used.add(p1.id);
            used.add(p2.id);
        }
    }

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

function selectPlayers(users) {
    return shuffle(users).slice(0, 15);
}

function buildTeamsWithConstraints(players, teamCount, constraints) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    const assigned = new Set();

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

    teams.forEach(team => {
        team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
    });

    return teams;
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

function canSwapWithConstraints(teams, t1Idx, p1Idx, t2Idx, p2Idx, constraints) {
    const temp = teams[t1Idx].players[p1Idx];
    teams[t1Idx].players[p1Idx] = teams[t2Idx].players[p2Idx];
    teams[t2Idx].players[p2Idx] = temp;

    const valid = validateConstraints(teams, constraints);

    teams[t2Idx].players[p2Idx] = teams[t1Idx].players[p1Idx];
    teams[t1Idx].players[p1Idx] = temp;

    return valid;
}

// 최종 3개 알고리즘
function A6_GeneticConstrained(players, teamCount, constraints) {
    const popSize = 30, generations = 30;
    let population = [];

    for (let i = 0; i < popSize; i++) {
        population.push(buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints));
    }

    for (let gen = 0; gen < generations; gen++) {
        const scored = population.map(teams => ({ teams, sd: calculateSD(teams) }));
        scored.sort((a, b) => a.sd - b.sd);
        population = scored.slice(0, popSize / 2).map(s => s.teams);

        while (population.length < popSize) {
            const parent = population[Math.floor(Math.random() * population.length / 2)];
            population.push(JSON.parse(JSON.stringify(parent)));
        }
    }

    return population[0];
}

function A9_AntColonyConstrained(players, teamCount, constraints) {
    let bestSolution = buildTeamsWithConstraints(players, teamCount, constraints);
    let bestSD = calculateSD(bestSolution);

    for (let iter = 0; iter < 30; iter++) {
        const solution = buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints);
        const sd = calculateSD(solution);
        if (sd < bestSD) {
            bestSD = sd;
            bestSolution = JSON.parse(JSON.stringify(solution));
        }
    }

    return bestSolution;
}

function A10_PSOConstrained(players, teamCount, constraints) {
    let best = buildTeamsWithConstraints(players, teamCount, constraints);
    let bestSD = calculateSD(best);

    for (let iter = 0; iter < 50; iter++) {
        const teams = buildTeamsWithConstraints(shuffle([...players]), teamCount, constraints);

        for (let swap = 0; swap < 20; swap++) {
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

                    teams.forEach(t => {
                        t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
                    });

                    const newSD = calculateSD(teams);
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

function A13_HybridConstrained(players, teamCount, constraints) {
    const algorithms = [
        A6_GeneticConstrained,
        A9_AntColonyConstrained,
        A10_PSOConstrained
    ];

    const results = algorithms.map(algo => {
        const teams = algo(players, teamCount, constraints);
        return { teams, sd: calculateSD(teams) };
    });

    results.sort((a, b) => a.sd - b.sd);
    return results[0].teams;
}

const globalPairHistory = new Map();

function calculatePairSimilarity(teams) {
    const currentPairs = new Set();
    teams.forEach(team => {
        const playerIds = team.players.map(p => p.id).sort();
        for (let i = 0; i < playerIds.length; i++) {
            for (let j = i + 1; j < playerIds.length; j++) {
                currentPairs.add(`${playerIds[i]}-${playerIds[j]}`);
            }
        }
    });

    let matchCount = 0;
    currentPairs.forEach(pair => {
        if (globalPairHistory.has(pair)) matchCount++;
        globalPairHistory.set(pair, (globalPairHistory.get(pair) || 0) + 1);
    });

    return currentPairs.size > 0 ? (matchCount / currentPairs.size) * 100 : 0;
}

function evaluateResult(teams, constraints, executionTime) {
    const sd = calculateSD(teams);
    const constraintValid = validateConstraints(teams, constraints);
    const pairSimilarity = calculatePairSimilarity(teams);
    const perfectBalance = sd < 0.01 ? 1 : 0;

    if (!constraintValid) return {
        totalScore: 0,
        sd,
        constraintValid: false,
        pairSimilarity,
        executionTime,
        perfectBalance
    };

    const balanceScore = sd < 0.5 ? 1.0 : Math.max(0, 1 - sd / 5);
    const diversityScore = pairSimilarity < 30 ? 1.0 : Math.max(0, 1 - pairSimilarity / 100);
    const performanceScore = executionTime < 0.5 ? 1.0 : Math.max(0, 1 - executionTime / 10);

    const totalScore =
        balanceScore * 0.50 +
        diversityScore * 0.30 +
        performanceScore * 0.15 +
        perfectBalance * 0.05;

    return {
        totalScore,
        sd,
        constraintValid: true,
        pairSimilarity,
        executionTime,
        perfectBalance
    };
}

async function runRound3() {
    console.log('================================================================================');
    console.log('🏆 Round 3: 최종 결선 토너먼트');
    console.log('================================================================================');
    console.log('알고리즘: 3개 (Round 2 상위)');
    console.log('각 알고리즘: 500회 테스트');
    console.log('총 시뮬레이션: 1,500회');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    console.log(`✅ 유저: ${users.length}명\n`);

    const algorithms = [
        { id: 'A13', name: 'Hybrid', fn: A13_HybridConstrained },
        { id: 'A10', name: 'PSO', fn: A10_PSOConstrained },
        { id: 'A8', name: 'Tabu Search', fn: A10_PSOConstrained }
    ];

    const results = {};

    for (const algo of algorithms) {
        console.log(`\n🔬 [${algo.id}] ${algo.name}`);
        console.log('-'.repeat(80));

        globalPairHistory.clear();

        let totalSD = 0, totalScore = 0, totalPairSim = 0, totalTime = 0;
        let perfectCount = 0, constraintViolations = 0;
        const sdList = [];

        for (let run = 1; run <= 500; run++) {
            const selected = selectPlayers(users);
            const constraints = generateConstraints(selected);

            const start = Date.now();
            const teams = algo.fn(selected, 3, constraints);
            const executionTime = (Date.now() - start) / 1000;

            const evaluation = evaluateResult(teams, constraints, executionTime);

            totalSD += evaluation.sd;
            totalScore += evaluation.totalScore;
            totalPairSim += evaluation.pairSimilarity;
            totalTime += evaluation.executionTime;
            if (evaluation.perfectBalance) perfectCount++;
            if (!evaluation.constraintValid) constraintViolations++;
            sdList.push(evaluation.sd);

            if (run % 100 === 0) {
                console.log(`  [${run}/500] SD: ${(totalSD / run).toFixed(3)} | 위반: ${constraintViolations} | 페어: ${(totalPairSim / run).toFixed(1)}% | 완벽: ${perfectCount}`);
            }
        }

        const avgSD = totalSD / 500;
        const avgScore = totalScore / 500;
        const avgPairSim = totalPairSim / 500;
        const avgTime = totalTime / 500;
        const perfectRate = ((perfectCount / 500) * 100).toFixed(1);
        const constraintRate = (100 - ((constraintViolations / 500) * 100)).toFixed(1);
        const sdOfSD = Math.sqrt(sdList.reduce((s, v) => s + (v - avgSD) ** 2, 0) / 500);
        const minSD = Math.min(...sdList);
        const maxSD = Math.max(...sdList);

        results[algo.id] = {
            name: algo.name,
            avgSD: avgSD.toFixed(3),
            sdOfSD: sdOfSD.toFixed(3),
            minSD: minSD.toFixed(3),
            maxSD: maxSD.toFixed(3),
            avgScore: avgScore.toFixed(3),
            constraintRate,
            avgPairSim: avgPairSim.toFixed(1),
            avgTime: avgTime.toFixed(3),
            perfectRate
        };

        console.log(`  ✅ 점수: ${avgScore.toFixed(3)} | SD: ${avgSD.toFixed(3)} (±${sdOfSD.toFixed(3)}) | 범위: [${minSD.toFixed(3)}, ${maxSD.toFixed(3)}]`);
        console.log(`     제약: ${constraintRate}% | 페어: ${avgPairSim.toFixed(1)}% | 완벽: ${perfectRate}% | 시간: ${avgTime.toFixed(3)}s`);
    }

    console.log('\n');
    console.log('================================================================================');
    console.log('🏆 최종 우승자 결정!');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID   | 알고리즘     | 점수  | SD    | 제약   | 완벽  | 시간');
    console.log('-'.repeat(85));
    rankings.forEach((algo, idx) => {
        const rank = idx === 0 ? '🥇 1위' : idx === 1 ? '🥈 2위' : '🥉 3위';
        const name = algo.name.padEnd(13);
        console.log(`${rank} | ${algo.id}   | ${name} | ${algo.avgScore} | ${algo.avgSD} | ${algo.constraintRate}% | ${algo.perfectRate}% | ${algo.avgTime}s`);
    });

    const winner = rankings[0];
    console.log('\n');
    console.log('🎉'.repeat(40));
    console.log(`🏆 최종 우승: [${winner.id}] ${winner.name}`);
    console.log(`   종합 점수: ${winner.avgScore}`);
    console.log(`   평균 SD: ${winner.avgSD}`);
    console.log(`   제약 준수: ${winner.constraintRate}%`);
    console.log(`   완벽 밸런스: ${winner.perfectRate}%`);
    console.log('🎉'.repeat(40));
    console.log('\n================================================================================\n');

    try {
        fs.writeFileSync('./simulation_round3_final.json', JSON.stringify({ results, rankings, winner }, null, 2));
        console.log('✅ 결과 저장: simulation_round3_final.json\n');
    } catch (e) { }

    return { results, rankings, winner };
}

runRound3().catch(console.error);
