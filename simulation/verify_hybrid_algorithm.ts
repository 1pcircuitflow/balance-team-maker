
import { generateBalancedTeams } from '../services/balanceService';
import { Player, SportType, Tier } from '../types';

// 더미 데이터 생성기
const generatePlayers = (count: number): Player[] => {
    const players: Player[] = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const tiers = [Tier.S, Tier.A, Tier.B, Tier.C, Tier.D];

    for (let i = 0; i < count; i++) {
        players.push({
            id: `p${i + 1}`,
            name: `Player ${i + 1}`,
            tier: tiers[Math.floor(Math.random() * tiers.length)],
            sportType: SportType.BASKETBALL,
            primaryPosition: positions[Math.floor(Math.random() * positions.length)],
            secondaryPosition: 'NONE',
            isActive: true,
            // 호환성 필드
            primaryPositions: [positions[Math.floor(Math.random() * positions.length)]],
            secondaryPositions: [],
            tertiaryPositions: [],
            forbiddenPositions: []
        } as any); // any 캐스팅: types.ts와 일부 불일치 방지
    }
    return players;
};

async function runVerification() {
    console.log('🧪 Hybrid 알고리즘 검증 시작...');

    // 1. 기본 실행 테스트
    const players = generatePlayers(16); // 16명으로 변경
    console.log(`- 플레이어 ${players.length}명 생성 완료`);

    const start = Date.now();
    const result = generateBalancedTeams(players, 3);
    const time = (Date.now() - start) / 1000;

    console.log(`\n⏱️ 실행 시간: ${time.toFixed(3)}초`);
    console.log(`📊 표준편차(SD): ${result.standardDeviation}`);
    console.log(`⚖️ 불균형 점수: ${result.imbalanceScore.toFixed(2)}`);
    console.log(`✅ 유효성: ${result.isValid ? 'PASS' : 'FAIL'}`);

    // 2. 결과 출력
    result.teams.forEach(team => {
        console.log(`\n[${team.name}] Skill: ${team.totalSkill}`);
        team.players.forEach(p => {
            console.log(`  - ${p.name} (${p.tier}) Pos: ${p.assignedPosition} (Pref: ${p.primaryPositions?.join(',')})`);
        });
    });

    // 3. 제약 조건 테스트
    console.log('\n🔒 제약 조건 테스트 (MATCH/SPLIT)...');
    // 임의의 제약 조건 생성
    const constraints = [
        { type: 'MATCH' as const, playerIds: [players[0].id, players[1].id] },
        { type: 'SPLIT' as const, playerIds: [players[2].id, players[3].id] }
    ];

    const constrainedResult = generateBalancedTeams(players, 3, undefined, constraints);

    console.log(`📊 제약 조건 실행 SD: ${constrainedResult.standardDeviation}`);
    console.log(`✅ 제약 위반 여부: ${constrainedResult.isConstraintViolated ? '위반됨 (FAIL)' : '준수함 (PASS)'}`);

    // 검증
    const t1 = constrainedResult.teams.find(t => t.players.some(p => p.id === players[0].id));
    const t2 = constrainedResult.teams.find(t => t.players.some(p => p.id === players[1].id));
    const isMatchValid = t1 && t2 && t1.id === t2.id;

    const t3 = constrainedResult.teams.find(t => t.players.some(p => p.id === players[2].id));
    const t4 = constrainedResult.teams.find(t => t.players.some(p => p.id === players[3].id));
    const isSplitValid = t3 && t4 && t3.id !== t4.id;

    console.log(`  - MATCH 제약 (p1, p2 같은팀?): ${isMatchValid ? 'YES' : 'NO'}`);
    console.log(`  - SPLIT 제약 (p3, p4 다른팀?): ${isSplitValid ? 'YES' : 'NO'}`);

    if (result.isValid && !constrainedResult.isConstraintViolated && isMatchValid && isSplitValid) {
        console.log('\n✨ 모든 검증 통과! Hybrid 알고리즘이 정상 동작합니다.');
    } else {
        console.error('\n❌ 검증 실패! 로그를 확인하세요.');
        process.exit(1);
    }
}

runVerification().catch(console.error);
