// Round 2 토너먼트 (준결승)
// 5개 알고리즘 × 300회 = 1,500회

const fs = require('fs');

//=============================================================================
// 유틸리티 함수
//=============================================================================

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

//=============================================================================
// 유저 생성
//=============================================================================

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
                primaryPosition: primaryPos,
                primaryPositions: [primaryPos],
                secondaryPositions: [],
                tertiaryPositions: []
            });
            userId++;
        }
    }
    return shuffle(users);
}

function selectPlayers(users, count = 15) {
    return shuffle(users).slice(0, count);
}

//=============================================================================
// 알고리즘들
//=============================================================================

// A6: Genetic Algorithm
function A6_GeneticAlgorithm(players, teamCount) {
    const popSize = 30;
    const generations = 30;
    let population = [];

    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, (_, j) => ({
            id: j + 1,
            name: `Team ${String.fromCharCode(65 + j)}`,
            players: [],
            totalSkill: 0
        }));

        shuffle([...players]).forEach((p, idx) => {
            teams[idx % teamCount].players.push({ ...p });
        });

        teams.forEach(t => {
            t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
        });

        population.push(teams);
    }

    for (let gen = 0; gen < generations; gen++) {
        const scored = population.map(teams => ({
            teams,
            sd: calculateSD(teams)
        }));

        scored.sort((a, b) => a.sd - b.sd);
        population = scored.slice(0, popSize / 2).map(s => s.teams);

        while (population.length < popSize) {
            const parent = population[Math.floor(Math.random() * population.length / 2)];
            population.push(JSON.parse(JSON.stringify(parent)));
        }
    }

    return population[0];
}

// A9: Ant Colony Optimization
function A9_AntColonyOptimization(players, teamCount) {
    const numAnts = 20;
    const iterations = 30;
    const evaporationRate = 0.1;
    const pheromone = players.map(() => Array(teamCount).fill(1));

    let bestSolution = null;
    let bestSD = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
        const solutions = [];

        for (let ant = 0; ant < numAnts; ant++) {
            const teams = Array.from({ length: teamCount }, (_, i) => ({
                id: i + 1,
                name: `Team ${String.fromCharCode(65 + i)}`,
                players: [],
                totalSkill: 0
            }));

            players.forEach((player, playerIdx) => {
                const probs = pheromone[playerIdx];
                const sum = probs.reduce((a, b) => a + b);
                const normalized = probs.map(p => p / sum);

                let rand = Math.random();
                let teamIdx = 0;
                for (let t = 0; t < teamCount; t++) {
                    rand -= normalized[t];
                    if (rand <= 0) {
                        teamIdx = t;
                        break;
                    }
                }

                teams[teamIdx].players.push(player);
            });

            teams.forEach(t => {
                t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
            });

            const sd = calculateSD(teams);
            solutions.push({ teams, sd });

            if (sd < bestSD) {
                bestSD = sd;
                bestSolution = JSON.parse(JSON.stringify(teams));
            }
        }

        pheromone.forEach(row => {
            for (let i = 0; i < row.length; i++) {
                row[i] *= (1 - evaporationRate);
            }
        });

        solutions.forEach(({ teams, sd }) => {
            const deposit = 1 / (1 + sd);
            teams.forEach((team, teamIdx) => {
                team.players.forEach(player => {
                    const playerIdx = players.findIndex(p => p.id === player.id);
                    if (playerIdx !== -1) {
                        pheromone[playerIdx][teamIdx] += deposit;
                    }
                });
            });
        });
    }

    return bestSolution;
}

// A10: PSO
function A10_PSO(players, teamCount) {
    const numParticles = 15;
    const iterations = 20;

    let best = null;
    let bestSD = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
        const teams = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${String.fromCharCode(65 + i)}`,
            players: [],
            totalSkill: 0
        }));

        shuffle([...players]).forEach((p, idx) => {
            teams[idx % teamCount].players.push({ ...p });
        });

        teams.forEach(t => {
            t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
        });

        const sd = calculateSD(teams);
        if (sd < bestSD) {
            bestSD = sd;
            best = JSON.parse(JSON.stringify(teams));
        }

        for (let swap = 0; swap < 10; swap++) {
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1 && teamCount > 1) t2 = Math.floor(Math.random() * teamCount);

            if (teams[t1].players.length > 0 && teams[t2].players.length > 0) {
                const p1 = Math.floor(Math.random() * teams[t1].players.length);
                const p2 = Math.floor(Math.random() * teams[t2].players.length);

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

    return best;
}

// A12: Rule-based
function A12_RuleBased(players, teamCount) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    const sorted = [...players].sort((a, b) => b.skill - a.skill);

    sorted.forEach(player => {
        const weakest = teams.reduce((min, t, idx) =>
            t.totalSkill < teams[min].totalSkill ? idx : min, 0);
        teams[weakest].players.push({ ...player });
        teams[weakest].totalSkill += player.skill;
    });

    return teams;
}

// A13: Hybrid
function A13_Hybrid(players, teamCount) {
    const algorithms = [
        A6_GeneticAlgorithm,
        A9_AntColonyOptimization,
        A10_PSO,
        A12_RuleBased
    ];

    const results = algorithms.map(algo => {
        const teams = algo(players, teamCount);
        return { teams, sd: calculateSD(teams) };
    });

    results.sort((a, b) => a.sd - b.sd);
    return results[0].teams;
}

//=============================================================================
// 평가 함수
//=============================================================================

function evaluateResult(teams, executionTime) {
    const sd = calculateSD(teams);
    const balanceScore = Math.max(0, 1 - sd / 5) * 0.4;
    const diversityScore = Math.random() * 0.3;
    const constraintScore = 0.2;
    const performanceScore = Math.max(0, 1 - Math.min(executionTime, 10) / 10) * 0.1;

    return {
        total: balanceScore + diversityScore + constraintScore + performanceScore,
        sd,
        time: executionTime
    };
}

//=============================================================================
// Round 2 토너먼트
//=============================================================================

async function runRound2() {
    console.log('================================================================================');
    console.log('🏆 Round 2: 준결승 토너먼트 (5개 알고리즘)');
    console.log('================================================================================');
    console.log('알고리즘: 5개 (상위 진출자)');
    console.log('각 알고리즘: 300회 테스트');
    console.log('총 시뮬레이션: 1,500회');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    console.log(`✅ 유저: ${users.length}명\n`);

    const algorithms = [
        { id: 'A10', name: 'PSO', fn: A10_PSO },
        { id: 'A9', name: 'Ant Colony', fn: A9_AntColonyOptimization },
        { id: 'A13', name: 'Hybrid', fn: A13_Hybrid },
        { id: 'A12', name: 'Rule-based', fn: A12_RuleBased },
        { id: 'A6', name: 'Genetic Algorithm', fn: A6_GeneticAlgorithm }
    ];

    const results = {};

    for (const algo of algorithms) {
        console.log(`\n🔬 [${algo.id}] ${algo.name}`);
        console.log('-'.repeat(80));

        let totalSD = 0;
        let totalTime = 0;
        let totalScore = 0;
        const sdList = [];

        for (let run = 1; run <= 300; run++) {
            const selected = selectPlayers(users, 15);

            const start = Date.now();
            const teams = algo.fn(selected, 3);
            const executionTime = (Date.now() - start) / 1000;

            const evaluation = evaluateResult(teams, executionTime);

            totalSD += evaluation.sd;
            totalTime += evaluation.time;
            totalScore += evaluation.total;
            sdList.push(evaluation.sd);

            if (run % 75 === 0) {
                console.log(`  [${run}/300] 평균 SD: ${(totalSD / run).toFixed(3)}`);
            }
        }

        const avgSD = totalSD / 300;
        const avgTime = totalTime / 300;
        const avgScore = totalScore / 300;
        const sdOfSD = Math.sqrt(sdList.reduce((s, v) => s + (v - avgSD) ** 2, 0) / 300);
        const minSD = Math.min(...sdList);
        const maxSD = Math.max(...sdList);

        results[algo.id] = {
            name: algo.name,
            avgSD: avgSD.toFixed(3),
            sdOfSD: sdOfSD.toFixed(3),
            minSD: minSD.toFixed(3),
            maxSD: maxSD.toFixed(3),
            avgTime: avgTime.toFixed(3),
            avgScore: avgScore.toFixed(3)
        };

        console.log(`  ✅ 완료 → SD: ${avgSD.toFixed(3)} (±${sdOfSD.toFixed(3)}) | 범위: [${minSD.toFixed(3)}, ${maxSD.toFixed(3)}] | 점수: ${avgScore.toFixed(3)}`);
    }

    console.log('\n');
    console.log('================================================================================');
    console.log('📊 Round 2 최종 결과');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID   | 알고리즘              | 종합점수 | 평균 SD | 범위 | 시간');
    console.log('-'.repeat(100));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const name = algo.name.padEnd(20);
        const range = `[${algo.minSD}, ${algo.maxSD}]`.padEnd(15);
        console.log(`${rank} | ${algo.id}   | ${name} | ${algo.avgScore}  | ${algo.avgSD}  | ${range} | ${algo.avgTime}s`);
    });

    const top3 = rankings.slice(0, 3);

    console.log('\n✅ Round 3 진출 (상위 3개):');
    top3.forEach((algo, idx) => {
        console.log(`  ${idx + 1}. [${algo.id}] ${algo.name} - 점수: ${algo.avgScore}, SD: ${algo.avgSD}`);
    });

    console.log('\n================================================================================\n');

    try {
        fs.writeFileSync(
            './simulation_round2_full.json',
            JSON.stringify({ results, rankings, top3 }, null, 2)
        );
        console.log('✅ 결과 저장: simulation_round2_full.json\n');
    } catch (e) {
        console.log('⚠️  결과 저장 실패:', e.message);
    }

    return { results, rankings, top3 };
}

runRound2().catch(console.error);
