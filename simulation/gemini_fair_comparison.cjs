// Gemini 알고리즘 vs 기존 알고리즘 - 공정 비교 (동일 테스트 케이스)
// 모든 알고리즘이 동일한 선수 세트와 제약 조건으로 테스트

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
// 테스트 케이스 생성 (100개 - 모든 알고리즘이 공유)
//=============================================================================

function generateTestCases(users, count = 100) {
    const testCases = [];
    for (let i = 0; i < count; i++) {
        const selected = shuffle(users).slice(0, 15);
        const constraints = generateConstraints(selected);
        testCases.push({ players: selected, constraints });
    }
    return testCases;
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
        totalSkill: 0
    }));

    // Step 2: 초기 분배 (Greedy - 실시간 합계 비교)
    for (const player of sortedPlayers) {
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
    }

    // Step 3: 교환 최적화 (Swap Optimization)
    let improved = true;
    let maxIterations = 100;

    while (improved && maxIterations > 0) {
        improved = false;
        maxIterations--;

        const currentDiff = Math.max(...teams.map(t => t.totalSkill)) - Math.min(...teams.map(t => t.totalSkill));

        if (currentDiff < 0.1) break;

        let bestSwap = null;
        let bestImprovement = 0;

        for (let t1 = 0; t1 < teamCount; t1++) {
            for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                for (let p1 = 0; p1 < teams[t1].players.length; p1++) {
                    for (let p2 = 0; p2 < teams[t2].players.length; p2++) {
                        const player1 = teams[t1].players[p1];
                        const player2 = teams[t2].players[p2];

                        const newSkill1 = teams[t1].totalSkill - player1.skill + player2.skill;
                        const newSkill2 = teams[t2].totalSkill - player2.skill + player1.skill;

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

        if (bestSwap && bestImprovement > 0.01) {
            const { t1, t2, p1, p2 } = bestSwap;
            const player1 = teams[t1].players[p1];
            const player2 = teams[t2].players[p2];

            teams[t1].players[p1] = player2;
            teams[t2].players[p2] = player1;

            teams[t1].totalSkill = teams[t1].players.reduce((sum, p) => sum + p.skill, 0);
            teams[t2].totalSkill = teams[t2].players.reduce((sum, p) => sum + p.skill, 0);

            improved = true;
        }
    }

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
            if (sd > 2) sd += 100000000;
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

// Hybrid (현재 앱에서 사용 중)
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
// 공정 비교 시뮬레이션
//=============================================================================

async function runFairComparison() {
    console.log('================================================================================');
    console.log('🏆 Gemini vs 기존 알고리즘 - 공정 비교 (동일 테스트 케이스)');
    console.log('================================================================================');
    console.log('테스트 알고리즘: 5개');
    console.log('  1. Gemini (Greedy + Swap 최적화)');
    console.log('  2. MoreGA (GA 50세대)');
    console.log('  3. MorePSO (PSO 60반복)');
    console.log('  4. SD_Limit_2 (SD > 2 패널티)');
    console.log('  5. Hybrid (현재 앱 사용 중)');
    console.log('테스트 케이스: 500개 (모든 알고리즘이 동일 데이터 사용)');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    console.log(`✅ 유저 풀: ${users.length}명`);

    // 100개의 테스트 케이스 생성 (모든 알고리즘이 공유)
    const testCases = generateTestCases(users, 100);
    console.log(`✅ 테스트 케이스: ${testCases.length}개 생성 완료\n`);

    const algorithms = [
        { id: 'Gemini', name: 'Gemini (Greedy+Swap)', fn: GeminiAlgorithm },
        { id: 'MoreGA', name: 'MoreGA (GA 50세대)', fn: MoreGA },
        { id: 'MorePSO', name: 'MorePSO (PSO 60반복)', fn: MorePSO },
        { id: 'SD_Limit', name: 'SD_Limit_2', fn: SD_Limit_2 },
        { id: 'Hybrid', name: 'Hybrid (현재 앱)', fn: HybridAlgorithm }
    ];

    const results = {};

    // 각 테스트 케이스에 대해 모든 알고리즘 실행
    const caseResults = testCases.map((tc, idx) => {
        const caseResult = { caseIdx: idx };

        for (const algo of algorithms) {
            const start = Date.now();
            const teams = algo.fn(tc.players, 3);
            const executionTime = (Date.now() - start) / 1000;

            const sd = calculateSD(teams);
            const violations = validateConstraints(teams, tc.constraints);
            const perfectBalance = sd < 0.01 ? 1 : 0;

            caseResult[algo.id] = { sd, violations, executionTime, perfectBalance };
        }

        if ((idx + 1) % 25 === 0) {
            console.log(`  [${idx + 1}/100] 테스트 케이스 완료`);
        }

        return caseResult;
    });

    console.log('\n');

    // 결과 집계
    for (const algo of algorithms) {
        let totalSD = 0, totalViolations = 0, totalTime = 0, perfectCount = 0;
        let winCount = 0;
        const sdList = [];

        for (const cr of caseResults) {
            totalSD += cr[algo.id].sd;
            totalViolations += cr[algo.id].violations;
            totalTime += cr[algo.id].executionTime;
            if (cr[algo.id].perfectBalance) perfectCount++;
            sdList.push(cr[algo.id].sd);

            // 이 케이스에서 가장 낮은 SD를 가진 알고리즘인지 체크
            const allSDs = algorithms.map(a => cr[a.id].sd);
            const minSD = Math.min(...allSDs);
            if (cr[algo.id].sd === minSD) winCount++;
        }

        results[algo.id] = {
            name: algo.name,
            avgSD: (totalSD / 100).toFixed(3),
            minSD: Math.min(...sdList).toFixed(3),
            maxSD: Math.max(...sdList).toFixed(3),
            avgViolations: (totalViolations / 100).toFixed(2),
            avgTime: (totalTime / 100).toFixed(4),
            perfectRate: perfectCount,
            winRate: winCount
        };
    }

    // 헤드투헤드 비교
    console.log('================================================================================');
    console.log('📊 헤드투헤드 비교 (동일 테스트 케이스별 SD 승리 횟수)');
    console.log('================================================================================\n');

    const h2h = {};
    for (const algo1 of algorithms) {
        h2h[algo1.id] = {};
        for (const algo2 of algorithms) {
            if (algo1.id !== algo2.id) {
                let wins = 0;
                for (const cr of caseResults) {
                    if (cr[algo1.id].sd < cr[algo2.id].sd) wins++;
                }
                h2h[algo1.id][algo2.id] = wins;
            }
        }
    }

    console.log('           | Gemini | MoreGA | MorePSO | SD_Limit | Hybrid');
    console.log('-'.repeat(70));
    for (const algo1 of algorithms) {
        const row = [algo1.id.padEnd(10)];
        for (const algo2 of algorithms) {
            if (algo1.id === algo2.id) {
                row.push('  -   ');
            } else {
                row.push(` ${h2h[algo1.id][algo2.id].toString().padStart(3)}   `);
            }
        }
        console.log(row.join('|'));
    }

    console.log('\n');
    console.log('================================================================================');
    console.log('📊 최종 결과 비교');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | ID        | 알고리즘              | 평균SD | 최소SD | 최대SD | 위반  | 완벽  | SD승리 | 시간');
    console.log('-'.repeat(105));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const id = algo.id.padEnd(9);
        const name = algo.name.padEnd(20);
        console.log(`${rank} | ${id} | ${name} | ${algo.avgSD}  | ${algo.minSD}  | ${algo.maxSD}  | ${algo.avgViolations}  | ${algo.perfectRate}%   | ${algo.winRate}회   | ${algo.avgTime}s`);
    });

    console.log('\n================================================================================');
    console.log('🏆 최종 순위 (평균 SD 기준)');
    console.log('================================================================================\n');
    rankings.forEach((algo, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        console.log(`${medal} ${idx + 1}위: [${algo.id}] ${algo.name}`);
        console.log(`       평균SD: ${algo.avgSD} | 제약위반: ${algo.avgViolations} | SD승리: ${algo.winRate}/100 | 완벽: ${algo.perfectRate}%`);
    });

    console.log('\n================================================================================\n');

    // 결과 저장
    try {
        fs.writeFileSync('./gemini_fair_comparison_results.json', JSON.stringify({
            results,
            rankings,
            headToHead: h2h
        }, null, 2));
        console.log('✅ 결과 저장: gemini_fair_comparison_results.json\n');
    } catch (e) {
        console.log('⚠️  결과 저장 실패:', e.message);
    }

    return { results, rankings, headToHead: h2h };
}

runFairComparison().catch(console.error);
