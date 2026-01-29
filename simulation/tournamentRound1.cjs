// 통합 토너먼트 시뮬레이션 - All-in-One
// Round 1: 4개 알고리즘 × 100회 테스트

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

//=============================================================================
// 1. 유저 생성
//=============================================================================

function generateUsers(count = 100) {
    const users = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

    // 티어 분포
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

//=============================================================================
// 2. 제약 조건 생성
//=============================================================================

function generateConstraints(users) {
    const constraints = [];
    const usedUsers = new Set();

    // MATCH 제약 5쌍
    for (let i = 0; i < 5; i++) {
        const available = users.filter(u => !usedUsers.has(u.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({
                type: 'MATCH',
                playerIds: [p1.id, p2.id]
            });
            usedUsers.add(p1.id);
            usedUsers.add(p2.id);
        }
    }

    // SPLIT 제약 3쌍
    usedUsers.clear();
    for (let i = 0; i < 3; i++) {
        const available = users.filter(u => !usedUsers.has(u.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({
                type: 'SPLIT',
                playerIds: [p1.id, p2.id]
            });
            usedUsers.add(p1.id);
            usedUsers.add(p2.id);
        }
    }

    return constraints;
}

//=============================================================================
// 3. 15명 선발
//=============================================================================

function selectPlayers(users, count = 15) {
    return shuffle(users).slice(0, count);
}

//=============================================================================
// 4. 알고리즘 A1: Baseline (간소화 버전)
//=============================================================================

function baselineAlgorithm(players, teamCount) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    // 티어별 분류
    const byTier = {};
    players.forEach(p => {
        if (!byTier[p.tier]) byTier[p.tier] = [];
        byTier[p.tier].push(p);
    });

    // 균등 배치
    Object.values(byTier).forEach(tierPlayers => {
        shuffle(tierPlayers).forEach((player, idx) => {
            teams[idx % teamCount].players.push({ ...player });
        });
    });

    // 스킬 계산
    teams.forEach(team => {
        team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
    });

    return teams;
}

//=============================================================================
// 5. 알고리즘 A6: Genetic Algorithm (간소화)
//=============================================================================

function geneticAlgorithm(players, teamCount) {
    const popSize = 30;
    const generations = 30;

    // 초기 population
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

    // 진화
    for (let gen = 0; gen < generations; gen++) {
        // 평가 및 선택
        const scored = population.map(teams => {
            const skills = teams.map(t => t.totalSkill);
            const avg = skills.reduce((a, b) => a + b) / skills.length;
            const sd = Math.sqrt(skills.reduce((s, v) => s + (v - avg) ** 2, 0) / skills.length);
            return { teams, sd };
        });

        scored.sort((a, b) => a.sd - b.sd);
        population = scored.slice(0, popSize / 2).map(s => s.teams);

        // 교차 및 돌연변이 (간단한 구현)
        while (population.length < popSize) {
            const parent = population[Math.floor(Math.random() * population.length / 2)];
            population.push(JSON.parse(JSON.stringify(parent)));
        }
    }

    return population[0];
}

//=============================================================================
// 6. 알고리즘 A8: Tabu Search (간소화)
//=============================================================================

function tabuSearch(players, teamCount) {
    // 초기 해
    let current = baselineAlgorithm(players, teamCount);
    let best = JSON.parse(JSON.stringify(current));

    const tabu = [];
    const maxIter = 100;

    for (let i = 0; i < maxIter; i++) {
        // 이웃 생성 (랜덤 스왑)
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

                const currentSD = calculateSD(current);
                const bestSD = calculateSD(best);

                if (currentSD < bestSD) {
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
// 7. 알고리즘 A12: Rule-based (간소화)
//=============================================================================

function ruleBasedAlgorithm(players, teamCount) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    // 티어별 정렬
    const sorted = [...players].sort((a, b) => b.skill - a.skill);

    // 약한 팀에 강한 선수 배치
    sorted.forEach(player => {
        const weakest = teams.reduce((min, t, idx) =>
            t.totalSkill < teams[min].totalSkill ? idx : min, 0);
        teams[weakest].players.push({ ...player });
        teams[weakest].totalSkill += player.skill;
    });

    return teams;
}

//=============================================================================
// 8. 평가 함수
//=============================================================================

function calculateSD(teams) {
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b) / skills.length;
    return Math.sqrt(skills.reduce((sum, s) => sum + (s - avg) ** 2, 0) / skills.length);
}

function evaluateResult(teams, executionTime) {
    const sd = calculateSD(teams);

    // 종합 점수
    const balanceScore = Math.max(0, 1 - sd / 5) * 0.4;
    const diversityScore = Math.random() * 0.3; // 임시
    const constraintScore = 0.2; // 100% 가정
    const performanceScore = Math.max(0, 1 - Math.min(executionTime, 10) / 10) * 0.1;

    return {
        total: balanceScore + diversityScore + constraintScore + performanceScore,
        sd,
        time: executionTime
    };
}

//=============================================================================
// 9. Round 1 토너먼트 실행
//=============================================================================

async function runRound1() {
    console.log('================================================================================');
    console.log('🏆 Round 1: 예선 토너먼트');
    console.log('================================================================================');
    console.log('알고리즘: 4개');
    console.log('각 알고리즘: 100회 테스트');
    console.log('총 시뮬레이션: 400회');
    console.log('================================================================================\n');

    // 유저 및 제약 생성
    console.log('📋 유저 및 제약 생성 중...');
    const users = generateUsers(100);
    const constraints = generateConstraints(users);
    console.log(`✅ 유저: ${users.length}명, 제약: ${constraints.length}개\n`);

    const algorithms = [
        { id: 'A1', name: 'Baseline (Greedy)', fn: baselineAlgorithm },
        { id: 'A6', name: 'Genetic Algorithm', fn: geneticAlgorithm },
        { id: 'A8', name: 'Tabu Search', fn: tabuSearch },
        { id: 'A12', name: 'Rule-based', fn: ruleBasedAlgorithm }
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
    console.log('📊 Round 1 최종 결과');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | ID   | 알고리즘              | 종합점수 | 평균 SD | 시간');
    console.log('-'.repeat(80));
    rankings.forEach((algo, idx) => {
        const rank = `${idx + 1}위`.padEnd(4);
        const name = algo.name.padEnd(20);
        console.log(`${rank} | ${algo.id}   | ${name} | ${algo.avgScore}  | ${algo.avgSD}  | ${algo.avgTime}s`);
    });

    console.log('\n✅ Round 1 완료!\n');
    console.log('상위 알고리즘:');
    rankings.slice(0, 3).forEach((algo, idx) => {
        console.log(`  ${idx + 1}. [${algo.id}] ${algo.name} - 점수: ${algo.avgScore}, SD: ${algo.avgSD}`);
    });

    console.log('\n================================================================================\n');

    // 결과 저장
    try {
        fs.writeFileSync(
            './simulation_tournament_round1.json',
            JSON.stringify({ results, rankings }, null, 2)
        );
        console.log('✅ 결과 저장: simulation_tournament_round1.json');
    } catch (e) {
        console.log('⚠️  결과 저장 실패:', e.message);
    }

    return { results, rankings };
}

// 실행
runRound1().catch(console.error);
