// Belo 앱 프로덕션 시뮬레이션 - 3단계 점진적 접근법
const { generateUsers } = require('./generateUsers');
const { generateConstraints } = require('./generateConstraints');
const { selectPlayersForMatch } = require('./selectPlayers');
const { generateBalancedTeams } = require('../services/balanceService');
const fs = require('fs');

console.log('🏀 Belo 앱 프로덕션 시뮬레이션 시작');
console.log('='.repeat(80));

// Phase 1: 초기 스크리닝 (5개 × 50회)
async function runPhase1() {
    console.log('\n📊 Phase 1: 초기 스크리닝 (5개 알고리즘 × 50회)');
    console.log('='.repeat(80));

    // 100명 유저 생성
    const users = generateUsers(100);
    const constraints = generateConstraints(users);

    console.log(`✅ 유저 ${users.length}명 생성`);
    console.log(`✅ 제약 조건 ${constraints.length}개 생성 (MATCH: 10쌍, SPLIT: 5쌍)`);
    console.log('');

    // 5가지 알고리즘 변형 정의
    const variants = [
        {
            name: 'A1_Baseline',
            desc: 'Greedy + SA (현재)',
            getParams: () => ({
                temperature: 200,
                coolingRate: 0.997,
                iterations: 3000,
                pairPenalty: 10000000,
                strategy: 'random'
            })
        },
        {
            name: 'A2_HighTemp',
            desc: '고온 탐색',
            getParams: () => ({
                temperature: 500,
                coolingRate: 0.998,
                iterations: 5000,
                pairPenalty: 10000000,
                strategy: 'random'
            })
        },
        {
            name: 'A3_PenaltyFocus',
            desc: '페어 페널티 극대화',
            getParams: () => ({
                temperature: 200,
                coolingRate: 0.997,
                iterations: 3000,
                pairPenalty: 50000000,  // 50배
                strategy: 'random'
            })
        },
        {
            name: 'A4_IterationHeavy',
            desc: '반복 집중',
            getParams: () => ({
                temperature: 300,
                coolingRate: 0.999,
                iterations: 7000,
                pairPenalty: 15000000,
                strategy: 'random'
            })
        },
        {
            name: 'A5_MultiTry',
            desc: 'Multi-try (10회 중 최선)',
            getParams: () => ({
                temperature: 200,
                coolingRate: 0.997,
                iterations: 2000,
                pairPenalty: 10000000,
                strategy: 'random',
                multiTry: 10
            })
        }
    ];

    const phase1Results = {};

    // 각 변형 테스트
    for (const variant of variants) {
        console.log(`\n🔬 ${variant.name}: ${variant.desc}`);
        console.log('-'.repeat(80));

        const results = [];
        const params = variant.getParams();

        for (let run = 1; run <= 50; run++) {
            const startTime = Date.now();

            // 15명 선발
            const selected = selectPlayersForMatch(users, constraints);

            // 제약 조건 필터링 (선발된 15명 관련만)
            const selectedIds = new Set(selected.map(p => p.id));
            const relevantConstraints = constraints.filter(c =>
                c.playerIds.every(id => selectedIds.has(id))
            );

            // 매칭 실행
            let result;
            if (params.multiTry) {
                // Multi-try: 10번 실행 후 최선 선택
                let bestResult = null;
                let bestSD = Infinity;

                for (let i = 0; i < params.multiTry; i++) {
                    const tryResult = generateBalancedTeams(
                        selected,
                        3,
                        { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
                        relevantConstraints,
                        false,
                        []
                    );

                    if (tryResult.standardDeviation < bestSD) {
                        bestSD = tryResult.standardDeviation;
                        bestResult = tryResult;
                    }
                }
                result = bestResult;
            } else {
                // 일반 실행
                result = generateBalancedTeams(
                    selected,
                    3,
                    { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
                    relevantConstraints,
                    false,
                    []
                );
            }

            const executionTime = Date.now() - startTime;

            results.push({
                run,
                teams: result.teams.map(t => ({
                    name: t.name,
                    players: t.players.map(p => ({ name: p.name, position: p.assignedPosition })),
                    totalSkill: t.totalSkill
                })),
                standardDeviation: result.standardDeviation,
                maxDiff: result.maxDiff,
                executionTime
            });

            if (run % 10 === 0) {
                console.log(`  [${run}/50] 진행 중... 평균 SD: ${(results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length).toFixed(2)}`);
            }
        }

        // 통계 계산
        const avgSD = results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length;
        const perfectBalanceCount = results.filter(r => r.standardDeviation === 0).length;
        const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

        phase1Results[variant.name] = {
            variant: variant.desc,
            avgSD,
            perfectCount: perfectBalanceCount,
            avgTime,
            results
        };

        console.log(`✅ 완료: 평균 SD ${avgSD.toFixed(2)}, SD 0.0 ${perfectBalanceCount}회, 평균 ${avgTime.toFixed(0)}ms`);
    }

    // Phase 1 결과 저장
    fs.writeFileSync(
        './simulation_phase1.json',
        JSON.stringify(phase1Results, null, 2)
    );

    console.log('\n' + '='.repeat(80));
    console.log('📊 Phase 1 결과 요약');
    console.log('='.repeat(80));

    const rankings = Object.entries(phase1Results)
        .map(([name, data]) => ({
            name,
            desc: data.variant,
            score: (1 - data.avgSD / 5) * 0.7 + (data.perfectCount / 50) * 0.2 + (1 - data.avgTime / 5000) * 0.1
        }))
        .sort((a, b) => b.score - a.score);

    rankings.forEach((r, i) => {
        const data = phase1Results[r.name];
        console.log(`${i + 1}위. ${r.desc}`);
        console.log(`     평균 SD: ${data.avgSD.toFixed(2)} | SD 0.0: ${data.perfectCount}회 | 평균 시간: ${data.avgTime.toFixed(0)}ms | 종합점수: ${r.score.toFixed(3)}`);
    });

    // 상위 3개 선택
    const top3 = rankings.slice(0, 3).map(r => r.name);
    console.log(`\n✅ Phase 2 진출: ${top3.join(', ')}`);

    return { phase1Results, top3 };
}

// Phase 2: 중간 검증 (상위 3개 × 200회)
async function runPhase2(phase1Results, top3) {
    console.log('\n📊 Phase 2: 중간 검증 (상위 3개 × 200회)');
    console.log('='.repeat(80));

    const users = generateUsers(100);
    const constraints = generateConstraints(users);

    const phase2Results = {};

    for (const variantName of top3) {
        console.log(`\n🔬 ${variantName}: ${phase1Results[variantName].variant}`);
        console.log('-'.repeat(80));

        const results = [];

        for (let run = 1; run <= 200; run++) {
            const startTime = Date.now();

            const selected = selectPlayersForMatch(users, constraints);
            const selectedIds = new Set(selected.map(p => p.id));
            const relevantConstraints = constraints.filter(c =>
                c.playerIds.every(id => selectedIds.has(id))
            );

            const result = generateBalancedTeams(
                selected,
                3,
                { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
                relevantConstraints,
                false,
                []
            );

            const executionTime = Date.now() - startTime;

            results.push({
                run,
                standardDeviation: result.standardDeviation,
                maxDiff: result.maxDiff,
                executionTime
            });

            if (run % 50 === 0) {
                console.log(`  [${run}/200] 진행 중... 평균 SD: ${(results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length).toFixed(2)}`);
            }
        }

        const avgSD = results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length;
        const perfectCount = results.filter(r => r.standardDeviation === 0).length;
        const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

        phase2Results[variantName] = {
            variant: phase1Results[variantName].variant,
            avgSD,
            perfectCount,
            avgTime,
            results
        };

        console.log(`✅ 완료: 평균 SD ${avgSD.toFixed(2)}, SD 0.0 ${perfectCount}회, 평균 ${avgTime.toFixed(0)}ms`);
    }

    fs.writeFileSync(
        './simulation_phase2.json',
        JSON.stringify(phase2Results, null, 2)
    );

    console.log('\n' + '='.repeat(80));
    console.log('📊 Phase 2 결과 요약');
    console.log('='.repeat(80));

    const rankings = Object.entries(phase2Results)
        .map(([name, data]) => ({
            name,
            desc: data.variant,
            score: (1 - data.avgSD / 5) * 0.7 + (data.perfectCount / 200) * 0.2 + (1 - data.avgTime / 5000) * 0.1
        }))
        .sort((a, b) => b.score - a.score);

    rankings.forEach((r, i) => {
        const data = phase2Results[r.name];
        console.log(`${i + 1}위. ${r.desc}`);
        console.log(`     평균 SD: ${data.avgSD.toFixed(2)} | SD 0.0: ${data.perfectCount}회 | 평균 시간: ${data.avgTime.toFixed(0)}ms | 종합점수: ${r.score.toFixed(3)}`);
    });

    const winner = rankings[0].name;
    console.log(`\n🏆 최종 선정: ${winner}`);

    return { phase2Results, winner };
}

// Phase 3: 최종 검증 (1위 × 500회)
async function runPhase3(phase2Results, winner) {
    console.log('\n📊 Phase 3: 최종 검증 (1위 × 500회)');
    console.log('='.repeat(80));
    console.log(`🏆 알고리즘: ${phase2Results[winner].variant}`);
    console.log('-'.repeat(80));

    const users = generateUsers(100);
    const constraints = generateConstraints(users);

    const results = [];

    for (let run = 1; run <= 500; run++) {
        const startTime = Date.now();

        const selected = selectPlayersForMatch(users, constraints);
        const selectedIds = new Set(selected.map(p => p.id));
        const relevantConstraints = constraints.filter(c =>
            c.playerIds.every(id => selectedIds.has(id))
        );

        const result = generateBalancedTeams(
            selected,
            3,
            { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 },
            relevantConstraints,
            false,
            []
        );

        const executionTime = Date.now() - startTime;

        results.push({
            run,
            standardDeviation: result.standardDeviation,
            maxDiff: result.maxDiff,
            executionTime
        });

        if (run % 100 === 0) {
            console.log(`  [${run}/500] 진행 중... 평균 SD: ${(results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length).toFixed(2)}`);
        }
    }

    const avgSD = results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length;
    const minSD = Math.min(...results.map(r => r.standardDeviation));
    const maxSD = Math.max(...results.map(r => r.standardDeviation));
    const perfectCount = results.filter(r => r.standardDeviation === 0).length;
    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

    const phase3Results = {
        variant: phase2Results[winner].variant,
        avgSD,
        minSD,
        maxSD,
        perfectCount,
        perfectRate: (perfectCount / 500 * 100).toFixed(1),
        avgTime,
        results
    };

    fs.writeFileSync(
        './simulation_phase3_final.json',
        JSON.stringify(phase3Results, null, 2)
    );

    console.log('\n' + '='.repeat(80));
    console.log('🏆 최종 결과');
    console.log('='.repeat(80));
    console.log(`알고리즘: ${phase3Results.variant}`);
    console.log(`평균 SD: ${avgSD.toFixed(2)}`);
    console.log(`SD 범위: ${minSD.toFixed(2)} ~ ${maxSD.toFixed(2)}`);
    console.log(`완벽한 밸런스 (SD 0.0): ${perfectCount}회 (${phase3Results.perfectRate}%)`);
    console.log(`평균 실행 시간: ${avgTime.toFixed(0)}ms`);

    return phase3Results;
}

// 메인 실행
async function main() {
    try {
        const startTime = Date.now();

        // Phase 1
        const { phase1Results, top3 } = await runPhase1();

        // Phase 2
        const { phase2Results, winner } = await runPhase2(phase1Results, top3);

        // Phase 3
        const finalResults = await runPhase3(phase2Results, winner);

        const totalTime = (Date.now() - startTime) / 1000;

        console.log('\n' + '='.repeat(80));
        console.log('✅ 3단계 점진적 시뮬레이션 완료!');
        console.log('='.repeat(80));
        console.log(`총 소요 시간: ${totalTime.toFixed(1)}초 (${(totalTime / 60).toFixed(1)}분)`);
        console.log(`최종 선정 알고리즘: ${finalResults.variant}`);
        console.log(`프로덕션 적용 준비 완료! 🎉`);

    } catch (error) {
        console.error('❌ 에러 발생:', error);
        throw error;
    }
}

main();
