// Gemini 알고리즘 vs 기존 알고리즘 비교 시뮬레이션
// Gemini 알고리즘: Greedy 초기 분배 + Swap 최적화 + Position 가중치

const fs = require('fs');

//=============================================================================
// 유틸리티
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
                primaryPositions: [primaryPos]
            });
            userId++;
        }
    }
    return shuffle(users);
}

//=============================================================================
// 제약 조건 생성
//=============================================================================

function generateConstraints(players) {
    const constraints = [];
    const used = new Set();

    // MATCH 제약 3쌍
    for (let i = 0; i < 3; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({
                type: 'MATCH',
                playerIds: [p1.id, p2.id]
            });
            used.add(p1.id);
            used.add(p2.id);
        }
    }

    // SPLIT 제약 2쌍
    used.clear();
    for (let i = 0; i < 2; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({
                type: 'SPLIT',
                playerIds: [p1.id, p2.id]
            });
            used.add(p1.id);
            used.add(p2.id);
        }
    }

    return constraints;
}

//=============================================================================
// 제약 조건 검증
//=============================================================================

function validateConstraints(teams, constraints) {
    let violations = 0;

    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIds = new Set();
            for (const playerId of constraint.playerIds) {
                const teamIdx = teams.findIndex(t => t.players.some(p => p.id === playerId));
                if (teamIdx !== -1) teamIds.add(teamIdx);
            }
            if (teamIds.size > 1) violations++;
        } else if (constraint.type === 'SPLIT') {
            if (constraint.playerIds.length === 2) {
                const [p1, p2] = constraint.playerIds;
                const t1 = teams.findIndex(t => t.players.some(p => p.id === p1));
                const t2 = teams.findIndex(t => t.players.some(p => p.id === p2));
                if (t1 === t2 && t1 !== -1) violations++;
            }
        }
    }

    return violations;
}

//=============================================================================
// 멤버 페어 유사도 계산
//=============================================================================

const globalPairHistory = new Map();

function calculatePairSimilarity(teams) {
    const currentPairs = new Set();

    teams.forEach(team => {
        const playerIds = team.players.map(p => p.id).sort();
        for (let i = 0; i < playerIds.length; i++) {
            for (let j = i + 1; j < playerIds.length; j++) {
                const pair = `${playerIds[i]}-${playerIds[j]}`;
                currentPairs.add(pair);
            }
        }
    });

    let matchCount = 0;
    currentPairs.forEach(pair => {
        if (globalPairHistory.has(pair)) {
            matchCount++;
        }
    });

    currentPairs.forEach(pair => {
        globalPairHistory.set(pair, (globalPairHistory.get(pair) || 0) + 1);
    });

    const totalPairs = currentPairs.size;
    return totalPairs > 0 ? (matchCount / totalPairs) * 100 : 0;
}

//=============================================================================
// 15명 선발
//=============================================================================

function selectPlayers(users) {
    return shuffle(users).slice(0, 15);
}

//=============================================================================
// Gemini 알고리즘 (사용자 제공 명세)
//=============================================================================

function GeminiAlgorithm(players, teamCount) {
    // Step 5: 동일 점수 선수 셔플링 (무작위성 부여)
    const shuffledPlayers = shuffle([...players]);

    // Step 1: 내림차순 정렬 (고실력자 먼저)
    const sortedPlayers = shuffledPlayers.sort((a, b) => b.skill - a.skill);

    // 팀 초기화
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
        positionCount: {}
    }));

    // Step 2: 초기 분배 (Greedy - 실시간 합계 비교)
    for (const player of sortedPlayers) {
        // 현재 총점이 가장 낮은 팀에 배정
        let weakestTeamIdx = 0;
        let minSkill = Infinity;

        for (let i = 0; i < teams.length; i++) {
            if (teams[i].totalSkill < minSkill) {
                minSkill = teams[i].totalSkill;
                weakestTeamIdx = i;
            }
        }

        teams[weakestTeamIdx].players.push({ ...player });
        teams[weakestTeamIdx].totalSkill += player.skill;

        // 포지션 카운트 업데이트
        const pos = player.primaryPosition || 'ANY';
        teams[weakestTeamIdx].positionCount[pos] = (teams[weakestTeamIdx].positionCount[pos] || 0) + 1;
    }

    // Step 3: 교환 최적화 (Swap Optimization)
    let improved = true;
    let maxIterations = 100; // 무한루프 방지

    while (improved && maxIterations > 0) {
        improved = false;
        maxIterations--;

        const currentDiff = Math.max(...teams.map(t => t.totalSkill)) - Math.min(...teams.map(t => t.totalSkill));

        if (currentDiff < 0.1) break; // 충분히 균형잡힘

        let bestSwap = null;
        let bestImprovement = 0;

        // 모든 팀 쌍에 대해 스왑 검토
        for (let t1 = 0; t1 < teamCount; t1++) {
            for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                for (let p1 = 0; p1 < teams[t1].players.length; p1++) {
                    for (let p2 = 0; p2 < teams[t2].players.length; p2++) {
                        const player1 = teams[t1].players[p1];
                        const player2 = teams[t2].players[p2];

                        // 스왑 후 새로운 점수 계산
                        const newSkill1 = teams[t1].totalSkill - player1.skill + player2.skill;
                        const newSkill2 = teams[t2].totalSkill - player2.skill + player1.skill;

                        // 다른 팀 스킬 그대로
                        const allSkills = teams.map((t, idx) => {
                            if (idx === t1) return newSkill1;
                            if (idx === t2) return newSkill2;
                            return t.totalSkill;
                        });

                        const newDiff = Math.max(...allSkills) - Math.min(...allSkills);
                        const improvement = currentDiff - newDiff;

                        if (improvement > bestImprovement) {
                            bestImprovement = improvement;
                            bestSwap = { t1, t2, p1, p2 };
                        }
                    }
                }
            }
        }

        // 최선의 스왑 실행
        if (bestSwap && bestImprovement > 0.01) {
            const { t1, t2, p1, p2 } = bestSwap;
            const player1 = teams[t1].players[p1];
            const player2 = teams[t2].players[p2];

            // 스왑 실행
            teams[t1].players[p1] = player2;
            teams[t2].players[p2] = player1;

            // 스킬 업데이트
            teams[t1].totalSkill = teams[t1].players.reduce((sum, p) => sum + p.skill, 0);
            teams[t2].totalSkill = teams[t2].players.reduce((sum, p) => sum + p.skill, 0);

            improved = true;
        }
    }

    // Step 4: 포지션 가중치 적용 (이미 잘 분배된 경우 유지)
    // 간단한 포지션 불균형 체크
    teams.forEach(team => {
        team.positionCount = {};
        team.players.forEach(p => {
            const pos = p.primaryPosition || 'ANY';
            team.positionCount[pos] = (team.positionCount[pos] || 0) + 1;
        });
    });

    return teams;
}

//=============================================================================
// 기존 알고리즘들
//=============================================================================

// MoreGA (GA 세대수 50)
function MoreGA(players, teamCount) {
    const popSize = 30, generations = 50;
    let population = [];

    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, (_, j) => ({
            id: j + 1, name: `Team ${String.fromCharCode(65 + j)}`,
            players: [], totalSkill: 0
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

// MorePSO (PSO 반복 60)
function MorePSO(players, teamCount) {
    const iterations = 60;
    let best = null, bestSD = Infinity;

    for (let iter = 0; iter < iterations; iter++) {
        const teams = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1, name: `Team ${String.fromCharCode(65 + i)}`,
            players: [], totalSkill: 0
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

// SD_Limit_2 (SD > 2 패널티)
function SD_Limit_2(players, teamCount) {
    const popSize = 30, generations = 30;
    let population = [];

    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, (_, j) => ({
            id: j + 1, name: `Team ${String.fromCharCode(65 + j)}`,
            players: [], totalSkill: 0
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
        const scored = population.map(teams => {
            let sd = calculateSD(teams);
            if (sd > 2) sd += 100000000; // 1억 패널티
            return { teams, sd };
        });
        scored.sort((a, b) => a.sd - b.sd);
        population = scored.slice(0, popSize / 2).map(s => s.teams);
        while (population.length < popSize) {
            const parent = population[Math.floor(Math.random() * population.length / 2)];
            population.push(JSON.parse(JSON.stringify(parent)));
        }
    }

    return population[0];
}

// Hybrid 알고리즘
function HybridAlgorithm(players, teamCount) {
    const algorithms = [MoreGA, MorePSO, SD_Limit_2];
    const results = algorithms.map(algo => {
        const teams = algo(players, teamCount);
        return { teams, sd: calculateSD(teams) };
    });
    results.sort((a, b) => a.sd - b.sd);
    return results[0].teams;
}

//=============================================================================
// 종합 평가
//=============================================================================

function evaluateResult(teams, constraints, executionTime) {
    const sd = calculateSD(teams);
    const balanceScore = sd < 0.5 ? 1.0 : Math.max(0, 1 - sd / 5);
    const violations = validateConstraints(teams, constraints);
    const constraintScore = violations === 0 ? 1.0 : 0.0;
    const pairSimilarity = calculatePairSimilarity(teams);
    const diversityScore = pairSimilarity < 30 ? 1.0 : Math.max(0, 1 - pairSimilarity / 100);
    const performanceScore = executionTime < 0.5 ? 1.0 : Math.max(0, 1 - executionTime / 10);
    const perfectBalance = sd < 0.01 ? 1 : 0;

    const totalScore =
        balanceScore * 0.35 +
        constraintScore * 0.35 +
        diversityScore * 0.20 +
        performanceScore * 0.05 +
        perfectBalance * 0.05;

    return {
        totalScore,
        sd,
        violations,
        pairSimilarity,
        executionTime,
        perfectBalance,
        balanceScore,
        constraintScore,
        diversityScore,
        performanceScore
    };
}

//=============================================================================
// 시뮬레이션 실행
//=============================================================================

async function runComparison() {
    console.log('================================================================================');
    console.log('🏆 Gemini 알고리즘 vs 기존 알고리즘 비교 시뮬레이션');
    console.log('================================================================================');
    console.log('테스트 알고리즘: 4개');
    console.log('  1. Gemini (사용자 제공 명세)');
    console.log('  2. MoreGA (GA 세대수 50)');
    console.log('  3. MorePSO (PSO 반복 60)');
    console.log('  4. SD_Limit_2 (SD > 2 패널티)');
    console.log('각 알고리즘: 100회 테스트');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    console.log(`✅ 유저: ${users.length}명\n`);

    const algorithms = [
        { id: 'Gemini', name: 'Gemini (Greedy+Swap)', fn: GeminiAlgorithm },
        { id: 'MoreGA', name: 'MoreGA (GA 50세대)', fn: MoreGA },
        { id: 'MorePSO', name: 'MorePSO (PSO 60반복)', fn: MorePSO },
        { id: 'SD_Limit', name: 'SD_Limit_2 (SD>2 패널티)', fn: SD_Limit_2 }
    ];

    const results = {};

    for (const algo of algorithms) {
        console.log(`\n🔬 [${algo.id}] ${algo.name}`);
        console.log('-'.repeat(80));

        globalPairHistory.clear();

        let totalSD = 0, totalScore = 0, totalViolations = 0;
        let totalPairSim = 0, totalTime = 0, perfectCount = 0;
        const sdList = [];

        for (let run = 1; run <= 100; run++) {
            const selected = selectPlayers(users);
            const constraints = generateConstraints(selected);

            const start = Date.now();
            const teams = algo.fn(selected, 3);
            const executionTime = (Date.now() - start) / 1000;

            const evaluation = evaluateResult(teams, constraints, executionTime);

            totalSD += evaluation.sd;
            totalScore += evaluation.totalScore;
            totalViolations += evaluation.violations;
            totalPairSim += evaluation.pairSimilarity;
            totalTime += evaluation.executionTime;
            if (evaluation.perfectBalance) perfectCount++;
            sdList.push(evaluation.sd);

            if (run % 25 === 0) {
                console.log(`  [${run}/100] SD: ${(totalSD / run).toFixed(3)} | 위반: ${(totalViolations / run).toFixed(1)} | 페어: ${(totalPairSim / run).toFixed(1)}%`);
            }
        }

        const avgSD = totalSD / 100;
        const avgScore = totalScore / 100;
        const avgViolations = totalViolations / 100;
        const avgPairSim = totalPairSim / 100;
        const avgTime = totalTime / 100;
        const perfectRate = perfectCount;
        const minSD = Math.min(...sdList);
        const maxSD = Math.max(...sdList);

        results[algo.id] = {
            name: algo.name,
            avgSD: avgSD.toFixed(3),
            minSD: minSD.toFixed(3),
            maxSD: maxSD.toFixed(3),
            avgScore: avgScore.toFixed(3),
            avgViolations: avgViolations.toFixed(2),
            avgPairSim: avgPairSim.toFixed(1),
            avgTime: avgTime.toFixed(4),
            perfectRate
        };

        console.log(`  ✅ 종합: ${avgScore.toFixed(3)} | SD: ${avgSD.toFixed(3)} (${minSD.toFixed(2)}~${maxSD.toFixed(2)}) | 위반: ${avgViolations.toFixed(2)} | 페어: ${avgPairSim.toFixed(1)}% | 완벽: ${perfectRate}%`);
    }

    console.log('\n');
    console.log('================================================================================');
    console.log('📊 최종 결과 비교');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID        | 알고리즘                | 종합  | 평균SD | 최소SD | 최대SD | 위반  | 페어    | 시간');
    console.log('-'.repeat(115));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const id = algo.id.padEnd(9);
        const name = algo.name.padEnd(22);
        console.log(`${rank} | ${id} | ${name} | ${algo.avgScore} | ${algo.avgSD}  | ${algo.minSD}  | ${algo.maxSD}  | ${algo.avgViolations}  | ${algo.avgPairSim}% | ${algo.avgTime}s`);
    });

    console.log('\n================================================================================');
    console.log('🏆 최종 순위');
    console.log('================================================================================\n');
    rankings.forEach((algo, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        console.log(`${medal} ${idx + 1}위: [${algo.id}] ${algo.name}`);
        console.log(`       종합점수: ${algo.avgScore} | 평균SD: ${algo.avgSD} | 제약위반: ${algo.avgViolations} | 실행시간: ${algo.avgTime}s`);
    });

    console.log('\n================================================================================\n');

    try {
        fs.writeFileSync('./gemini_comparison_results.json', JSON.stringify({ results, rankings }, null, 2));
        console.log('✅ 결과 저장: gemini_comparison_results.json\n');
    } catch (e) {
        console.log('⚠️  결과 저장 실패:', e.message);
    }

    return { results, rankings };
}

runComparison().catch(console.error);
