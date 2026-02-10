import { Player, Tier, SportType, Position, TeamConstraint } from '../types';
import { generateBalancedTeams } from '../services/balanceService';

/**
 * 20회 시뮬레이션 테스트 스크립트
 * 업로드된 이미지 데이터 기반 (15명, 3팀)
 */

// 테스트 데이터: 이미지에서 확인된 15명의 선수
const testPlayers: Player[] = [
    { id: '1', name: '김승원', tier: Tier.S, sportType: SportType.SOCCER, primaryPosition: 'ST', secondaryPosition: 'NONE', isActive: true },
    { id: '2', name: '김희원', tier: Tier.A, sportType: SportType.SOCCER, primaryPosition: 'MF', secondaryPosition: 'NONE', isActive: true },
    { id: '3', name: '고범찬', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'DF', secondaryPosition: 'MF', isActive: true },
    { id: '4', name: '광반이언구', tier: Tier.A, sportType: SportType.SOCCER, primaryPosition: 'ST', secondaryPosition: 'MF', isActive: true },
    { id: '5', name: '김주원', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'MF', secondaryPosition: 'DF', isActive: true },
    { id: '6', name: '김동원', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'DF', secondaryPosition: 'NONE', isActive: true },
    { id: '7', name: '김주억', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'MF', secondaryPosition: 'ST', isActive: true },
    { id: '8', name: '배창삼', tier: Tier.C, sportType: SportType.SOCCER, primaryPosition: 'DF', secondaryPosition: 'NONE', isActive: true },
    { id: '9', name: '유성진', tier: Tier.A, sportType: SportType.SOCCER, primaryPosition: 'MF', secondaryPosition: 'ST', isActive: true },
    { id: '10', name: '유종현', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'DF', secondaryPosition: 'MF', isActive: true },
    { id: '11', name: '이경근', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'ST', secondaryPosition: 'MF', isActive: true },
    { id: '12', name: '이승환', tier: Tier.C, sportType: SportType.SOCCER, primaryPosition: 'GK', secondaryPosition: 'NONE', isActive: true },
    { id: '13', name: '전과자', tier: Tier.B, sportType: SportType.SOCCER, primaryPosition: 'MF', secondaryPosition: 'DF', isActive: true },
    { id: '14', name: '전광필', tier: Tier.C, sportType: SportType.SOCCER, primaryPosition: 'DF', secondaryPosition: 'NONE', isActive: true },
    { id: '15', name: '조성준', tier: Tier.C, sportType: SportType.SOCCER, primaryPosition: 'GK', secondaryPosition: 'NONE', isActive: true },
];

// 제약조건 (필요 시 설정)
const testConstraints: TeamConstraint[] = [
    // 예: { type: 'MATCH', playerIds: ['1', '2'] }, // 김승원과 김희원은 같은 팀
    // 예: { type: 'SPLIT', playerIds: ['3', '4'] }, // 고범찬과 광반이언구는 다른 팀
];

// 포지션 쿼터 (필요 시 설정)
const testQuotas: Partial<Record<Position, number | null>> = {
    // GK: 1, // 각 팀당 골키퍼 1명
    // DF: 2, // 각 팀당 수비수 2명
    // MF: 2, // 각 팀당 미드필더 2명
};

interface SimulationResult {
    runNumber: number;
    teams: Array<{
        name: string;
        players: string[];
        totalSkill: number;
    }>;
    standardDeviation: number;
    maxDiff: number;
    teamHashes: string[];
    pairSimilarity: number;
    pairDetails: {
        totalPairs: number;
        uniquePairs: number;
        duplicatePairs: number;
    };
}

function getTeamHash(playerIds: string[]): string {
    return playerIds.sort().join(',');
}

function extractPairs(playerIds: string[]): Set<string> {
    const pairs = new Set<string>();
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            const pair = [playerIds[i], playerIds[j]].sort().join('-');
            pairs.add(pair);
        }
    }
    return pairs;
}

function calculateDetailedPairSimilarity(
    currentPairs: Set<string>,
    allPreviousPairs: Set<string>
): { similarity: number; totalPairs: number; uniquePairs: number; duplicatePairs: number } {
    if (allPreviousPairs.size === 0) {
        return { similarity: 0, totalPairs: currentPairs.size, uniquePairs: currentPairs.size, duplicatePairs: 0 };
    }

    const duplicatePairs = [...currentPairs].filter(p => allPreviousPairs.has(p)).length;
    const uniquePairs = currentPairs.size - duplicatePairs;
    const similarity = currentPairs.size > 0 ? duplicatePairs / currentPairs.size : 0;

    return {
        similarity,
        totalPairs: currentPairs.size,
        uniquePairs,
        duplicatePairs
    };
}

// 시뮬레이션 실행
console.log('='.repeat(80));
console.log('하이브리드 팀 밸런싱 알고리즘 시뮬레이션 (20회)');
console.log('='.repeat(80));
console.log(`선수 수: ${testPlayers.length}명`);
console.log(`팀 수: 3팀`);
console.log(`제약조건: ${testConstraints.length}개`);
console.log(`포지션 쿼터: ${Object.keys(testQuotas).length}개`);
console.log('='.repeat(80));
console.log('');

const results: SimulationResult[] = [];
const previousHashes: string[] = [];
const allPreviousPairs = new Set<string>();
const startTime = Date.now();

for (let run = 1; run <= 20; run++) {
    const result = generateBalancedTeams(
        testPlayers,
        3,
        testQuotas,
        testConstraints,
        false,
        previousHashes
    );

    // 팀 해시 생성
    const teamHashes = result.teams.map(team => getTeamHash(team.players.map(p => p.id)));

    // 현재 페어 추출
    const currentPairs = new Set<string>();
    result.teams.forEach(team => {
        const playerIds = team.players.map(p => p.id);
        const teamPairs = extractPairs(playerIds);
        teamPairs.forEach(pair => currentPairs.add(pair));
    });

    // 페어 유사도 계산
    const pairDetails = calculateDetailedPairSimilarity(currentPairs, allPreviousPairs);

    // 결과 저장
    results.push({
        runNumber: run,
        teams: result.teams.map(team => ({
            name: team.name,
            players: team.players.map(p => p.name),
            totalSkill: team.totalSkill
        })),
        standardDeviation: result.standardDeviation,
        maxDiff: result.maxDiff || 0,
        teamHashes,
        pairSimilarity: pairDetails.similarity,
        pairDetails
    });

    // 해시 및 페어 누적
    teamHashes.forEach(hash => previousHashes.push(hash));
    currentPairs.forEach(pair => allPreviousPairs.add(pair));

    // 진행 상황 출력
    console.log(`[RUN ${run}/20] SD: ${result.standardDeviation.toFixed(2)} | MaxDiff: ${result.maxDiff?.toFixed(1) || '0.0'} | PairSim: ${(pairDetails.similarity * 100).toFixed(1)}% | Unique: ${pairDetails.uniquePairs}/${pairDetails.totalPairs}`);
}

const endTime = Date.now();
const totalTime = ((endTime - startTime) / 1000).toFixed(2);

console.log('');
console.log('='.repeat(80));
console.log('시뮬레이션 완료');
console.log('='.repeat(80));
console.log(`총 실행 시간: ${totalTime}초`);
console.log(`평균 실행 시간: ${(parseFloat(totalTime) / 20).toFixed(3)}초/회`);
console.log('');

// ========== 통계 분석 ==========

console.log('='.repeat(80));
console.log('📊 통계 분석 결과');
console.log('='.repeat(80));
console.log('');

// 1. 다양성 지표
const avgPairSimilarity = results.reduce((sum, r) => sum + r.pairSimilarity, 0) / results.length;
const uniqueTeamCombinations = new Set(results.flatMap(r => r.teamHashes)).size;
const totalTeamCombinations = results.length * 3;

console.log('📌 다양성 지표');
console.log('-'.repeat(80));
console.log(`평균 멤버 페어 유사도: ${(avgPairSimilarity * 100).toFixed(1)}%`);
console.log(`팀 조합 중복률: ${((1 - uniqueTeamCombinations / totalTeamCombinations) * 100).toFixed(1)}% (${uniqueTeamCombinations}/${totalTeamCombinations} 유니크)`);
console.log('');

// 2. 밸런스 지표
const avgStdDev = results.reduce((sum, r) => sum + r.standardDeviation, 0) / results.length;
const minStdDev = Math.min(...results.map(r => r.standardDeviation));
const maxStdDev = Math.max(...results.map(r => r.standardDeviation));
const avgMaxDiff = results.reduce((sum, r) => sum + r.maxDiff, 0) / results.length;

console.log('📌 밸런스 지표');
console.log('-'.repeat(80));
console.log(`평균 표준편차: ${avgStdDev.toFixed(2)}`);
console.log(`표준편차 범위: ${minStdDev.toFixed(2)} ~ ${maxStdDev.toFixed(2)}`);
console.log(`평균 최대 팀 점수 차: ${avgMaxDiff.toFixed(1)}점`);
console.log('');

// 3. 페어 분석
const pairFrequency = new Map<string, number>();
allPreviousPairs.forEach(pair => {
    let count = 0;
    results.forEach(result => {
        result.teams.forEach(team => {
            const playerIds = team.players.map((_, idx) => (idx + 1).toString());
            const teamPairs = extractPairs(team.players.map(p => testPlayers.find(tp => tp.name === p)?.id || ''));
            if (teamPairs.has(pair)) count++;
        });
    });
    pairFrequency.set(pair, count);
});

const mostFrequentPairs = [...pairFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

console.log('📌 가장 자주 짝을 이룬 선수 페어 (Top 10)');
console.log('-'.repeat(80));
mostFrequentPairs.forEach(([pair, count], idx) => {
    const [id1, id2] = pair.split('-');
    const name1 = testPlayers.find(p => p.id === id1)?.name || id1;
    const name2 = testPlayers.find(p => p.id === id2)?.name || id2;
    console.log(`${idx + 1}. ${name1} - ${name2}: ${count}회 (${(count / 20 * 100).toFixed(0)}%)`);
});
console.log('');

// 4. 샘플 결과 (첫 3회)
console.log('📌 샘플 결과 (Run 1-3)');
console.log('-'.repeat(80));
for (let i = 0; i < 3 && i < results.length; i++) {
    const result = results[i];
    console.log(`\n[RUN ${result.runNumber}] SD: ${result.standardDeviation.toFixed(2)} | MaxDiff: ${result.maxDiff.toFixed(1)}`);
    result.teams.forEach((team, idx) => {
        console.log(`  ${team.name} (${team.totalSkill.toFixed(1)}점): ${team.players.join(', ')}`);
    });
}

console.log('');
console.log('='.repeat(80));
console.log('시뮬레이션 분석 완료');
console.log('='.repeat(80));

// 결과를 JSON 파일로 저장
const fs = require('fs');
const outputPath = './simulation_results.json';
fs.writeFileSync(outputPath, JSON.stringify({
    summary: {
        totalRuns: 20,
        totalPlayers: testPlayers.length,
        teamCount: 3,
        avgStdDev,
        minStdDev,
        maxStdDev,
        avgMaxDiff,
        avgPairSimilarity,
        uniqueTeamCombinations,
        totalTeamCombinations,
        totalTime: parseFloat(totalTime),
        avgTimePerRun: parseFloat(totalTime) / 20
    },
    results,
    pairFrequency: Object.fromEntries(pairFrequency)
}, null, 2));

console.log(`\n✅ 상세 결과가 ${outputPath} 파일로 저장되었습니다.`);
