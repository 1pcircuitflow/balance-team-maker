// Round 1 토너먼트 시뮬레이션 (예선)
// 6개 알고리즘 × 100회 = 600회 테스트

const { generateUsers } = require('./generateUsers.js');
const { generateConstraints } = require('./generateConstraints.js');
const { selectPlayersForMatch } = require('./selectPlayers.js');
const { generateBalancedTeams } = require('../services/balanceService.js');
const { geneticAlgorithm } = require('../algorithms/geneticAlgorithm.js');
const { tabuSearch } = require('../algorithms/tabuSearch.js');
const { ruleBasedMatching } = require('../algorithms/ruleBasedMatching.js');
const fs = require('fs');

// 평가 함수
function calculateScore(result) {
    const { teams } = result;

    // 1. 밸런스 (40%)
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
    const sd = Math.sqrt(skills.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / skills.length);
    const balanceScore = Math.max(0, 1 - sd / 5) * 0.4;

    // 2. 다양성 (30%) - 임시로 랜덤
    const diversityScore = Math.random() * 0.3;

    // 3. 제약 준수 (20%)
    const constraintScore = 0.2; // 임시로 100% 가정

    // 4. 성능 (10%)
    const time = result.executionTime || 0.3;
    const performanceScore = Math.max(0, 1 - Math.min(time, 10) / 10) * 0.1;

    return {
        total: balanceScore + diversityScore + constraintScore + performanceScore,
        balance: balanceScore,
        diversity: diversityScore,
        constraint: constraintScore,
        performance: performanceScore,
        sd,
        time
    };
}

// 알고리즘 목록
const algorithms = [
    {
        id: 'A1',
        name: 'Greedy + SA (Baseline)',
        fn: (players, constraints, quotas) => {
            const start = Date.now();
            const result = generateBalancedTeams(players, 3, quotas, constraints);
            const executionTime = (Date.now() - start) / 1000;
            return { teams: result.teams, executionTime };
        }
    },
    {
        id: 'A6',
        name: 'Genetic Algorithm',
        fn: (players, constraints, quotas) => {
            const start = Date.now();
            const teams = geneticAlgorithm(players, 3, quotas, constraints, {
                populationSize: 50,
                generations: 50,
                mutationRate: 0.1
            });
            const executionTime = (Date.now() - start) / 1000;
            return { teams, executionTime };
        }
    },
    {
        id: 'A8',
        name: 'Tabu Search',
        fn: (players, constraints, quotas) => {
            const start = Date.now();
            const teams = tabuSearch(players, 3, quotas, constraints, {
                maxIterations: 500,
                tabuListSize: 50
            });
            const executionTime = (Date.now() - start) / 1000;
            return { teams, executionTime };
        }
    },
    {
        id: 'A12',
        name: 'Rule-based Expert',
        fn: (players, constraints, quotas) => {
            const start = Date.now();
            const teams = ruleBasedMatching(players, 3, quotas, constraints);
            const executionTime = (Date.now() - start) / 1000;
            return { teams, executionTime };
        }
    }
];

async function runRound1() {
    console.log('================================================================================');
    console.log('🏆 Round 1: 예선 시뮬레이션');
    console.log('================================================================================');
    console.log(`알고리즘 수: ${algorithms.length}개`);
    console.log(`각 알고리즘당: 100회`);
    console.log(`총 시뮬레이션: ${algorithms.length * 100}회`);
    console.log('================================================================================\n');

    // 유저 풀 생성
    console.log('📋 100명 유저 생성 중...');
    const users = generateUsers(100);
    console.log(`✅  유저 생성 완료: ${users.length}명`);

    // 제약 조건 생성
    console.log('📋 제약 조건 생성 중...');
    const constraints = generateConstraints(users);
    console.log(`✅ 제약 조건 생성 완료: ${constraints.length}개\n`);

    const positionQuotas = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 };

    const results = {};

    // 각 알고리즘 테스트
    for (const algorithm of algorithms) {
        console.log(`\n🔬 [${algorithm.id}] ${algorithm.name}`);
        console.log('-'.repeat(80));

        const algoResults = [];
        let totalSD = 0;
        let totalTime = 0;
        let errorCount = 0;

        for (let run = 1; run <= 100; run++) {
            try {
                // 15명 선발
                const selected = selectPlayersForMatch(users, constraints);

                // 매칭 실행
                const result = algorithm.fn(selected, constraints, positionQuotas);

                // 평가
                const score = calculateScore(result);

                algoResults.push({
                    run,
                    score,
                    teams: result.teams
                });

                totalSD += score.sd;
                totalTime += score.time;

                if (run % 20 === 0) {
                    console.log(`  [${run}/100] 진행 중... (평균 SD: ${(totalSD / run).toFixed(2)})`);
                }
            } catch (error) {
                errorCount++;
                console.error(`  ⚠️  Run ${run} 에러: ${error.message}`);
            }
        }

        // 통계 계산
        const validResults = algoResults.filter(r => r.score);
        const avgSD = totalSD / validResults.length;
        const avgTime = totalTime / validResults.length;
        const avgScore = validResults.reduce((sum, r) => sum + r.score.total, 0) / validResults.length;

        results[algorithm.id] = {
            name: algorithm.name,
            totalRuns: 100,
            validRuns: validResults.length,
            errorCount,
            avgSD: avgSD.toFixed(3),
            avgTime: avgTime.toFixed(3),
            avgScore: avgScore.toFixed(3),
            results: algoResults
        };

        console.log(`  ✅ 완료: 평균 SD ${avgSD.toFixed(3)} | 종합 점수 ${avgScore.toFixed(3)} | 평균 시간 ${avgTime.toFixed(3)}초`);
    }

    // 순위 결정
    console.log('\n');
    console.log('================================================================================');
    console.log('📊 Round 1 최종 결과');
    console.log('================================================================================\n');

    const rankings = Object.entries(results)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));

    console.log('순위 | 알고리즘 | 종합점수 | SD | 시간 | 에러');
    console.log('-'.repeat(80));
    rankings.forEach((algo, idx) => {
        console.log(`${idx + 1}위  | ${algo.id.padEnd(5)} ${algo.name.padEnd(25)} | ${algo.avgScore} | ${algo.avgSD} | ${algo.avgTime}s | ${algo.errorCount}`);
    });

    // 상위 5개 선발 (또는 전체)
    const top5 = rankings.slice(0, Math.min(5, rankings.length));

    console.log('\n');
    console.log('✅ Round 2 진출:');
    top5.forEach((algo, idx) => {
        console.log(`  ${idx + 1}. [${algo.id}] ${algo.name} (점수: ${algo.avgScore})`);
    });

    // 결과 저장
    fs.writeFileSync(
        './simulation/round1_results.json',
        JSON.stringify({ results, rankings, top5 }, null, 2)
    );

    console.log('\n✅ 결과 저장: ./simulation/round1_results.json');
    console.log('================================================================================\n');

    return { results, rankings, top5 };
}

// 실행
if (require.main === module) {
    runRound1().catch(console.error);
}

module.exports = { runRound1 };
