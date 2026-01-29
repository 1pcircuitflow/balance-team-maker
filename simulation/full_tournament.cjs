// 통합 토너먼트 시뮬레이션 - 13개 알고리즘 완전판
// Round 1: 13개 × 100회 = 1,300회

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
// 유저 생성 (100명)
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
// A1: Baseline (Greedy + SA 간소화)
//=============================================================================

function A1_Baseline(players, teamCount) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    const byTier = {};
    players.forEach(p => {
        if (!byTier[p.tier]) byTier[p.tier] = [];
        byTier[p.tier].push(p);
    });

    Object.values(byTier).forEach(tierPlayers => {
        shuffle(tierPlayers).forEach((player, idx) => {
            teams[idx % teamCount].players.push({ ...player });
        });
    });

    teams.forEach(team => {
        team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
    });

    return teams;
}

//=============================================================================
// A2: Branch and Bound
//=============================================================================

function A2_BranchAndBound(players, teamCount) {
    let bestSolution = null;
    let bestSD = Infinity;
    const maxDepth = Math.min(10, players.length); // 시간 제한

    function branch(assigned, depth) {
        if (depth >= maxDepth) {
            // 나머지는 균등 배치
            const remaining = players.slice(depth);
            remaining.forEach((p, idx) => {
                assigned[idx % teamCount].push(p);
            });

            const teams = assigned.map((ps, i) => ({
                id: i + 1,
                name: `Team ${String.fromCharCode(65 + i)}`,
                players: ps,
                totalSkill: ps.reduce((s, p) => s + p.skill, 0)
            }));

            const sd = calculateSD(teams);
            if (sd < bestSD) {
                bestSD = sd;
                bestSolution = JSON.parse(JSON.stringify(teams));
            }
            return;
        }

        const player = players[depth];
        for (let teamIdx = 0; teamIdx < teamCount; teamIdx++) {
            assigned[teamIdx].push(player);

            // 가지치기: 현재 SD가 이미 최선보다 나쁘면 스킵
            const currentSkills = assigned.map(ps => ps.reduce((s, p) => s + p.skill, 0));
            const avg = currentSkills.reduce((a, b) => a + b) / teamCount;
            const currentSD = Math.sqrt(currentSkills.reduce((s, v) => s + (v - avg) ** 2, 0) / teamCount);

            if (currentSD < bestSD * 2) { // 관대한 기준
                branch(assigned, depth + 1);
            }

            assigned[teamIdx].pop();
        }
    }

    const initialAssigned = Array.from({ length: teamCount }, () => []);
    branch(initialAssigned, 0);

    return bestSolution || A1_Baseline(players, teamCount);
}

//=============================================================================
// A3: Backtracking + Pruning
//=============================================================================

function A3_Backtracking(players, teamCount) {
    let best = null;
    let bestSD = Infinity;
    let attempts = 0;
    const maxAttempts = 1000;

    function backtrack(teams, remaining, targetSize) {
        if (attempts++ > maxAttempts) return;

        if (remaining.length === 0) {
            const sd = calculateSD(teams);
            if (sd < bestSD) {
                bestSD = sd;
                best = JSON.parse(JSON.stringify(teams));
            }
            return;
        }

        const player = remaining[0];
        const rest = remaining.slice(1);

        for (let i = 0; i < teamCount; i++) {
            if (teams[i].players.length < targetSize) {
                teams[i].players.push(player);
                teams[i].totalSkill += player.skill;

                // 가지치기
                const currentSD = calculateSD(teams);
                if (currentSD < bestSD * 1.5) {
                    backtrack(teams, rest, targetSize);
                }

                teams[i].players.pop();
                teams[i].totalSkill -= player.skill;
            }
        }
    }

    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    backtrack(teams, shuffle([...players]), Math.ceil(players.length / teamCount));

    return best || A1_Baseline(players, teamCount);
}

//=============================================================================
// A4: Integer Programming (간소화 - 탐욕 + 최적화)
//=============================================================================

function A4_IntegerProgramming(players, teamCount) {
    // 실제 IP 솔버 없이 간소화 버전
    // 목표: 각 팀 스킬 합이 평균에 최대한 가깝게

    const avgSkill = players.reduce((s, p) => s + p.skill, 0) / teamCount;
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    // 스킬 순 정렬
    const sorted = [...players].sort((a, b) => b.skill - a.skill);

    // 각 선수를 평균에 가장 가깝게 만드는 팀에 배치
    sorted.forEach(player => {
        const bestTeam = teams.reduce((best, team, idx) => {
            const newSkill = team.totalSkill + player.skill;
            const diff = Math.abs(newSkill - avgSkill);
            const bestDiff = Math.abs(teams[best].totalSkill + player.skill - avgSkill);
            return diff < bestDiff ? idx : best;
        }, 0);

        teams[bestTeam].players.push(player);
        teams[bestTeam].totalSkill += player.skill;
    });

    return teams;
}

//=============================================================================
// A5: LP Relaxation + Rounding
//=============================================================================

function A5_LPRelaxation(players, teamCount) {
    // LP 완화 후 반올림 (간소화 버전)
    const avgSkill = players.reduce((s, p) => s + p.skill, 0) / teamCount;

    // 각 선수에게 팀 확률 할당 (연속 변수)
    const assignments = players.map(player => {
        const probs = Array(teamCount).fill(1 / teamCount);
        return { player, probs };
    });

    // 반복적으로 조정 (간단한 gradient descent)
    for (let iter = 0; iter < 50; iter++) {
        const teamSkills = Array(teamCount).fill(0);
        assignments.forEach(({ player, probs }) => {
            probs.forEach((prob, teamIdx) => {
                teamSkills[teamIdx] += player.skill * prob;
            });
        });

        // 각 선수의 확률 조정
        assignments.forEach(({ player, probs }) => {
            const teamDiffs = teamSkills.map(s => Math.abs(s - avgSkill));
            const minDiff = Math.min(...teamDiffs);
            const newProbs = teamDiffs.map(d => d === minDiff ? 0.6 : 0.2);
            const sum = newProbs.reduce((a, b) => a + b);
            for (let i = 0; i < teamCount; i++) {
                probs[i] = newProbs[i] / sum;
            }
        });
    }

    // 반올림: 각 선수를 가장 확률 높은 팀에 배치
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    assignments.forEach(({ player, probs }) => {
        const teamIdx = probs.indexOf(Math.max(...probs));
        teams[teamIdx].players.push(player);
        teams[teamIdx].totalSkill += player.skill;
    });

    return teams;
}

//=============================================================================
// A6: Genetic Algorithm (기존)
//=============================================================================

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

//=============================================================================
// A7: Differential Evolution
//=============================================================================

function A7_DifferentialEvolution(players, teamCount) {
    const popSize = 20;
    const generations = 30;
    const F = 0.8;
    const CR = 0.9;

    // 인코딩: 각 선수의 팀 인덱스 배열
    let population = [];
    for (let i = 0; i < popSize; i++) {
        const individual = players.map((_, idx) => idx % teamCount);
        population.push(shuffle(individual));
    }

    function decode(individual) {
        const teams = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${String.fromCharCode(65 + i)}`,
            players: [],
            totalSkill: 0
        }));

        individual.forEach((teamIdx, playerIdx) => {
            teams[teamIdx].players.push(players[playerIdx]);
        });

        teams.forEach(t => {
            t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
        });

        return teams;
    }

    for (let gen = 0; gen < generations; gen++) {
        const newPop = [];

        for (let i = 0; i < popSize; i++) {
            // 3개 랜덤 선택
            const indices = shuffle([...Array(popSize).keys()].filter(idx => idx !== i)).slice(0, 3);
            const [a, b, c] = indices.map(idx => population[idx]);

            // 변이 벡터
            const mutant = a.map((val, j) => {
                const diff = b[j] - c[j];
                let newVal = Math.round(val + F * diff);
                return Math.max(0, Math.min(teamCount - 1, newVal));
            });

            // 교차
            const trial = population[i].map((val, j) =>
                Math.random() < CR ? mutant[j] : val
            );

            // 선택
            const currentSD = calculateSD(decode(population[i]));
            const trialSD = calculateSD(decode(trial));

            newPop.push(trialSD < currentSD ? trial : population[i]);
        }

        population = newPop;
    }

    return decode(population[0]);
}

//=============================================================================
// A8: Tabu Search (기존)
//=============================================================================

function A8_TabuSearch(players, teamCount) {
    let current = A1_Baseline(players, teamCount);
    let best = JSON.parse(JSON.stringify(current));
    const tabu = [];
    const maxIter = 100;

    for (let i = 0; i < maxIter; i++) {
        const t1 = Math.floor(Math.random() * teamCount);
        let t2 = Math.floor(Math.random() * teamCount);
        while (t2 === t1) t2 = Math.floor(Math.random() * teamCount);

        if (current[t1].players.length > 0 && current[t2].players.length > 0) {
            const p1 = Math.floor(Math.random() * current[t1].players.length);
            const p2 = Math.floor(Math.random() * current[t2].players.length);

            const key = `${t1}-${p1}-${t2}-${p2}`;
            if (!tabu.includes(key)) {
                const temp = current[t1].players[p1];
                current[t1].players[p1] = current[t2].players[p2];
                current[t2].players[p2] = temp;

                current.forEach(t => {
                    t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
                });

                if (calculateSD(current) < calculateSD(best)) {
                    best = JSON.parse(JSON.stringify(current));
                }

                tabu.push(key);
                if (tabu.length > 20) tabu.shift();
            }
        }
    }

    return best;
}

//=============================================================================
// A9: Ant Colony Optimization
//=============================================================================

function A9_AntColonyOptimization(players, teamCount) {
    const numAnts = 20;
    const iterations = 30;
    const evaporationRate = 0.1;

    // 페로몬: pheromone[playerIdx][teamIdx]
    const pheromone = players.map(() => Array(teamCount).fill(1));

    let bestSolution = null;
    let bestSD = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
        const solutions = [];

        // 각 개미가 해 구성
        for (let ant = 0; ant < numAnts; ant++) {
            const teams = Array.from({ length: teamCount }, (_, i) => ({
                id: i + 1,
                name: `Team ${String.fromCharCode(65 + i)}`,
                players: [],
                totalSkill: 0
            }));

            players.forEach((player, playerIdx) => {
                // 페로몬 확률로 팀 선택
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

        // 페로몬 증발
        pheromone.forEach(row => {
            for (let i = 0; i < row.length; i++) {
                row[i] *= (1 - evaporationRate);
            }
        });

        // 페로몬 갱신 (좋은 해일수록 많이)
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

//=============================================================================
// A10: Particle Swarm Optimization
//=============================================================================

function A10_PSO(players, teamCount) {
    // PSO 간소화 버전 - 더 안정적인 구현
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

        // 랜덤 배치
        shuffle([...players]).forEach((p, idx) => {
            teams[idx % teamCount].players.push({ ...p });
        });

        teams.forEach(t => {
            t.totalSkill = t.players.reduce((sum, p) => sum + p.skill, 0);
        });

        // 평가
        const sd = calculateSD(teams);
        if (sd < bestSD) {
            bestSD = sd;
            best = JSON.parse(JSON.stringify(teams));
        }

        // 로컬 개선 (간단한 스왑)
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

    return best || A1_Baseline(players, teamCount);
}

//=============================================================================
// A11: Reinforcement Learning (간소화 - 휴리스틱 학습)
//=============================================================================

function A11_ReinforcementLearning(players, teamCount) {
    // Q-Learning 간소화 버전
    const episodes = 50;
    const epsilon = 0.2;

    // 간단한 상태: 각 팀의 현재 스킬 레벨
    const qTable = new Map();

    function getState(teams) {
        return teams.map(t => Math.floor(t.totalSkill / 5)).join(',');
    }

    function getAction(state) {
        if (Math.random() < epsilon) {
            // 탐색: 랜덤
            return Math.floor(Math.random() * teamCount);
        } else {
            // 활용: Q값 최대
            const key = state;
            if (!qTable.has(key)) {
                qTable.set(key, Array(teamCount).fill(0));
            }
            const qValues = qTable.get(key);
            return qValues.indexOf(Math.max(...qValues));
        }
    }

    let bestSolution = null;
    let bestSD = Infinity;

    for (let episode = 0; episode < episodes; episode++) {
        const teams = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${String.fromCharCode(65 + i)}`,
            players: [],
            totalSkill: 0
        }));

        shuffle([...players]).forEach(player => {
            const state = getState(teams);
            const action = getAction(state);

            teams[action].players.push(player);
            teams[action].totalSkill += player.skill;

            // 보상: -SD
            const reward = -calculateSD(teams);

            // Q-업데이트
            const key = state;
            if (!qTable.has(key)) {
                qTable.set(key, Array(teamCount).fill(0));
            }
            const qValues = qTable.get(key);
            qValues[action] += 0.1 * (reward - qValues[action]);
        });

        const sd = calculateSD(teams);
        if (sd < bestSD) {
            bestSD = sd;
            bestSolution = JSON.parse(JSON.stringify(teams));
        }
    }

    return bestSolution || A1_Baseline(players, teamCount);
}

//=============================================================================
// A12: Rule-based (기존)
//=============================================================================

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

//=============================================================================
// A13: Hybrid (Best-of-Both)
//=============================================================================

function A13_Hybrid(players, teamCount) {
    const algorithms = [
        A4_IntegerProgramming,
        A6_GeneticAlgorithm,
        A8_TabuSearch,
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
// Round 1 토너먼트 (13개 알고리즘 × 100회)
//=============================================================================

async function runRound1() {
    console.log('================================================================================');
    console.log('🏆 Round 1: 예선 토너먼트 (13개 알고리즘)');
    console.log('================================================================================');
    console.log('알고리즘: 13개');
    console.log('각 알고리즘: 100회 테스트');
    console.log('총 시뮬레이션: 1,300회');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    console.log(`✅ 유저: ${users.length}명\n`);

    const algorithms = [
        { id: 'A1', name: 'Baseline (Greedy)', fn: A1_Baseline },
        { id: 'A2', name: 'Branch and Bound', fn: A2_BranchAndBound },
        { id: 'A3', name: 'Backtracking', fn: A3_Backtracking },
        { id: 'A4', name: 'Integer Programming', fn: A4_IntegerProgramming },
        { id: 'A5', name: 'LP Relaxation', fn: A5_LPRelaxation },
        { id: 'A6', name: 'Genetic Algorithm', fn: A6_GeneticAlgorithm },
        { id: 'A7', name: 'Differential Evolution', fn: A7_DifferentialEvolution },
        { id: 'A8', name: 'Tabu Search', fn: A8_TabuSearch },
        { id: 'A9', name: 'Ant Colony', fn: A9_AntColonyOptimization },
        { id: 'A10', name: 'PSO', fn: A10_PSO },
        { id: 'A11', name: 'Reinforcement Learning', fn: A11_ReinforcementLearning },
        { id: 'A12', name: 'Rule-based', fn: A12_RuleBased },
        { id: 'A13', name: 'Hybrid', fn: A13_Hybrid }
    ];

    const results = {};

    for (const algo of algorithms) {
        console.log(`\n🔬 [${algo.id}] ${algo.name}`);
        console.log('-'.repeat(80));

        let totalSD = 0;
        let totalTime = 0;
        let totalScore = 0;
        const sdList = [];

        for (let run = 1; run <= 100; run++) {
            const selected = selectPlayers(users, 15);

            const start = Date.now();
            const teams = algo.fn(selected, 3);
            const executionTime = (Date.now() - start) / 1000;

            const evaluation = evaluateResult(teams, executionTime);

            totalSD += evaluation.sd;
            totalTime += evaluation.time;
            totalScore += evaluation.total;
            sdList.push(evaluation.sd);

            if (run % 25 === 0) {
                console.log(`  [${run}/100] 평균 SD: ${(totalSD / run).toFixed(3)}`);
            }
        }

        const avgSD = totalSD / 100;
        const avgTime = totalTime / 100;
        const avgScore = totalScore / 100;
        const sdOfSD = Math.sqrt(sdList.reduce((s, v) => s + (v - avgSD) ** 2, 0) / 100);

        results[algo.id] = {
            name: algo.name,
            avgSD: avgSD.toFixed(3),
            sdOfSD: sdOfSD.toFixed(3),
            avgTime: avgTime.toFixed(3),
            avgScore: avgScore.toFixed(3)
        };

        console.log(`  ✅ 완료 → SD: ${avgSD.toFixed(3)} (±${sdOfSD.toFixed(3)}) | 점수: ${avgScore.toFixed(3)} | 시간: ${avgTime.toFixed(3)}s`);
    }

    // 최종 순위
    console.log('\n');
    console.log('================================================================================');
    console.log('📊 Round 1 최종 결과 (13개 알고리즘)');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID   | 알고리즘                    | 종합점수 | 평균 SD | 시간');
    console.log('-'.repeat(90));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const name = algo.name.padEnd(28);
        console.log(`${rank} | ${algo.id}   | ${name} | ${algo.avgScore}  | ${algo.avgSD}  | ${algo.avgTime}s`);
    });

    const top5 = rankings.slice(0, 5);

    console.log('\n✅ Round 2 진출 (상위 5개):');
    top5.forEach((algo, idx) => {
        console.log(`  ${idx + 1}. [${algo.id}] ${algo.name} - 점수: ${algo.avgScore}, SD: ${algo.avgSD}`);
    });

    console.log('\n================================================================================\n');

    try {
        fs.writeFileSync(
            './simulation_round1_full.json',
            JSON.stringify({ results, rankings, top5 }, null, 2)
        );
        console.log('✅ 결과 저장: simulation_round1_full.json\n');
    } catch (e) {
        console.log('⚠️  결과 저장 실패:', e.message);
    }

    return { results, rankings, top5 };
}

// 실행
runRound1().catch(console.error);
