import { generateBalancedTeams } from '../services/balanceService.js';
import fs from 'fs';



// 티어 enum
const Tier = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const SportType = { GENERAL: 'GENERAL', SOCCER: 'SOCCER', FUTSAL: 'FUTSAL', BASKETBALL: 'BASKETBALL' };

// 테스트 데이터: 이미지에서 확인된 15명의 농구 선수 (정확한 명단)
const testPlayers = [
    // 1. 강승철 - C급 (PG, SG, SF)
    { id: '1', name: '강승철', tier: Tier.C, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF'], forbiddenPositions: [] },

    // 2. 강희철 - (PG, SG 주 / SF, PF, C 보조)
    { id: '2', name: '강희철', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF', 'PF', 'C'], forbiddenPositions: [] },

    // 3. 고병찬 - (SF, PF 주 / SG, C 보조)
    { id: '3', name: '고병찬', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'SF', secondaryPosition: 'PF', isActive: true, primaryPositions: ['SF'], secondaryPositions: ['PF'], tertiaryPositions: ['SG', 'C'], forbiddenPositions: [] },

    // 4. 광필이언구 - A급 (PF 주 / C, SF 보조 / PG, SG 3차)
    { id: '4', name: '광필이언구', tier: Tier.A, sportType: SportType.BASKETBALL, primaryPosition: 'PF', secondaryPosition: 'C', isActive: true, primaryPositions: ['PF'], secondaryPositions: ['C'], tertiaryPositions: ['SF', 'PG', 'SG'], forbiddenPositions: [] },

    // 5. 김우원 - (PG, SG 주 / SF, PF, C 보조)
    { id: '5', name: '김우원', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF', 'PF', 'C'], forbiddenPositions: [] },

    // 6. 김종철 - (C 주 / PF 보조 / PG, SG, SF 3차)
    { id: '6', name: '김종철', tier: Tier.C, sportType: SportType.BASKETBALL, primaryPosition: 'C', secondaryPosition: 'PF', isActive: true, primaryPositions: ['C'], secondaryPositions: ['PF'], tertiaryPositions: ['PG', 'SG', 'SF'], forbiddenPositions: [] },

    // 7. 김주석 - (PG 주 / SG, SF, PF, C 보조)
    { id: '7', name: '김주석', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF', 'PF', 'C'], forbiddenPositions: [] },

    // 8. 배일상 - (PF 주 / C, SF 보조 / PG, SG 3차)
    { id: '8', name: '배일상', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'PF', secondaryPosition: 'C', isActive: true, primaryPositions: ['PF'], secondaryPositions: ['C'], tertiaryPositions: ['SF', 'PG', 'SG'], forbiddenPositions: [] },

    // 9. 유성진 - S급 (PG, SG 주 / SF, PF, C 보조)
    { id: '9', name: '유성진', tier: Tier.S, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF', 'PF', 'C'], forbiddenPositions: [] },

    // 10. 유종현 - (PG, SG 주 / SF 보조 / PF, C 3차)
    { id: '10', name: '유종현', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'PG', secondaryPosition: 'SG', isActive: true, primaryPositions: ['PG'], secondaryPositions: ['SG'], tertiaryPositions: ['SF', 'PF', 'C'], forbiddenPositions: [] },

    // 11. 이경근 - A급 (SF 주 / PF 보조 / PG 3차 / SG, C 금지?)
    { id: '11', name: '이경근', tier: Tier.A, sportType: SportType.BASKETBALL, primaryPosition: 'SF', secondaryPosition: 'PF', isActive: true, primaryPositions: ['SF'], secondaryPositions: ['PF'], tertiaryPositions: ['PG'], forbiddenPositions: ['SG', 'C'] },

    // 12. 이승환 - (C 주 / PG, SG, SF, PF 보조)
    { id: '12', name: '이승환', tier: Tier.C, sportType: SportType.BASKETBALL, primaryPosition: 'C', secondaryPosition: 'PG', isActive: true, primaryPositions: ['C'], secondaryPositions: ['PG'], tertiaryPositions: ['SG', 'SF', 'PF'], forbiddenPositions: [] },

    // 13. 전과자 - (SF, PG 주 / PF 보조 / SG, C 3차)
    { id: '13', name: '전과자', tier: Tier.B, sportType: SportType.BASKETBALL, primaryPosition: 'SF', secondaryPosition: 'PG', isActive: true, primaryPositions: ['SF'], secondaryPositions: ['PG'], tertiaryPositions: ['PF', 'SG', 'C'], forbiddenPositions: [] },

    // 14. 전광필 - (SF, PG 주 / PG 보조 / SG, C 3차)
    { id: '14', name: '전광필', tier: Tier.C, sportType: SportType.BASKETBALL, primaryPosition: 'SF', secondaryPosition: 'PG', isActive: true, primaryPositions: ['SF'], secondaryPositions: ['PG'], tertiaryPositions: ['SG', 'C'], forbiddenPositions: [] },

    // 15. 조성준 - (C 주 / PG, SG, SF, PF 보조)
    { id: '15', name: '조성준', tier: Tier.C, sportType: SportType.BASKETBALL, primaryPosition: 'C', secondaryPosition: 'PG', isActive: true, primaryPositions: ['C'], secondaryPositions: ['PG'], tertiaryPositions: ['SG', 'SF', 'PF'], forbiddenPositions: [] },
];

const testConstraints = [];

// 포지션 쿼터 설정: 각 팀당 PG, SG, SF, PF, C 각 1명씩
const testQuotas = {
    PG: 1,
    SG: 1,
    SF: 1,
    PF: 1,
    C: 1
};


function getTeamHash(playerIds) {
    return playerIds.sort().join(',');
}

function extractPairs(playerIds) {
    const pairs = new Set();
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            const pair = [playerIds[i], playerIds[j]].sort().join('-');
            pairs.add(pair);
        }
    }
    return pairs;
}

function calculateDetailedPairSimilarity(currentPairs, allPreviousPairs) {
    if (allPreviousPairs.size === 0) {
        return { similarity: 0, totalPairs: currentPairs.size, uniquePairs: currentPairs.size, duplicatePairs: 0 };
    }

    let duplicatePairs = 0;
    currentPairs.forEach(p => {
        if (allPreviousPairs.has(p)) duplicatePairs++;
    });

    const uniquePairs = currentPairs.size - duplicatePairs;
    const similarity = currentPairs.size > 0 ? duplicatePairs / currentPairs.size : 0;

    return {
        similarity,
        totalPairs: currentPairs.size,
        uniquePairs,
        duplicatePairs
    };
}

console.log('='.repeat(80));
console.log('하이브리드 팀 밸런싱 알고리즘 시뮬레이션 (20회)');
console.log('='.repeat(80));
console.log(`선수 수: ${testPlayers.length}명`);
console.log(`팀 수: 3팀`);
console.log('='.repeat(80));
console.log('');

const results = [];
const previousHashes = [];
const allPreviousPairs = new Set();
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

    const teamHashes = result.teams.map(team => getTeamHash(team.players.map(p => p.id)));

    const currentPairs = new Set();
    result.teams.forEach(team => {
        const playerIds = team.players.map(p => p.id);
        const teamPairs = extractPairs(playerIds);
        teamPairs.forEach(pair => currentPairs.add(pair));
    });

    const pairDetails = calculateDetailedPairSimilarity(currentPairs, allPreviousPairs);

    results.push({
        runNumber: run,
        teams: result.teams.map(team => ({
            name: team.name,
            players: team.players.map(p => ({ name: p.name, position: p.assignedPosition })),
            totalSkill: team.totalSkill
        })),
        standardDeviation: result.standardDeviation,
        maxDiff: result.maxDiff || 0,
        teamHashes,
        pairSimilarity: pairDetails.similarity,
        pairDetails
    });

    teamHashes.forEach(hash => previousHashes.push(hash));
    currentPairs.forEach(pair => allPreviousPairs.add(pair));

    console.log(`[RUN ${run}/20] SD: ${result.standardDeviation.toFixed(2)} | MaxDiff: ${(result.maxDiff || 0).toFixed(1)} | PairSim: ${(pairDetails.similarity * 100).toFixed(1)}% | Unique: ${pairDetails.uniquePairs}/${pairDetails.totalPairs}`);
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

// 통계 분석
console.log('='.repeat(80));
console.log('📊 통계 분석 결과');
console.log('='.repeat(80));
console.log('');

const avgPairSimilarity = results.reduce((sum, r) => sum + r.pairSimilarity, 0) / results.length;
const uniqueTeamCombinations = new Set(results.flatMap(r => r.teamHashes)).size;
const totalTeamCombinations = results.length * 3;

console.log('📌 다양성 지표');
console.log('-'.repeat(80));
console.log(`평균 멤버 페어 유사도: ${(avgPairSimilarity * 100).toFixed(1)}%`);
console.log(`팀 조합 중복률: ${((1 - uniqueTeamCombinations / totalTeamCombinations) * 100).toFixed(1)}% (${uniqueTeamCombinations}/${totalTeamCombinations} 유니크)`);
console.log('');

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

const pairFrequency = new Map();
results.forEach(result => {
    result.teams.forEach(team => {
        const playerIds = team.players.map(p => testPlayers.find(tp => tp.name === p.name)?.id || '');
        const teamPairs = extractPairs(playerIds);
        teamPairs.forEach(pair => {
            pairFrequency.set(pair, (pairFrequency.get(pair) || 0) + 1);
        });
    });
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

console.log('📌 샘플 결과 (Run 1-3)');
console.log('-'.repeat(80));
for (let i = 0; i < 3 && i < results.length; i++) {
    const result = results[i];
    console.log(`\n[RUN ${result.runNumber}] SD: ${result.standardDeviation.toFixed(2)} | MaxDiff: ${result.maxDiff.toFixed(1)}`);
    result.teams.forEach((team) => {
        const playerInfo = team.players.map(p => `${p.name}(${p.position})`).join(', ');
        console.log(`  ${team.name} (${team.totalSkill.toFixed(1)}점): ${playerInfo}`);
    });
}

console.log('');
console.log('='.repeat(80));


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
