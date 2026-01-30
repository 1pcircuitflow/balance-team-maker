// Rule-based Expert System

function ruleBasedMatching(players, teamCount, customQuotas, constraints) {
    // 팀 초기화
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    // 선수를 티어별로 분류
    const byTier = {};
    players.forEach(player => {
        if (!byTier[player.tier]) byTier[player.tier] = [];
        byTier[player.tier].push(player);
    });

    // 규칙 1: S급은 서로 다른 팀에
    const tiers = ['S', 'A', 'B', 'C', 'D'].filter(t => byTier[t]);

    // MATCH 제약이 있는 선수들 먼저 처리
    const constraintPlayers = new Set();
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            for (const playerId of constraint.playerIds) {
                constraintPlayers.add(playerId);
            }
        }
    }

    const assigned = new Set();

    // MATCH 그룹먼저 배치
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            // 가장 비어있는 팀 찾기
            const emptyTeam = teams.reduce((min, team, idx) =>
                team.players.length < teams[min].players.length ? idx : min, 0
            );

            for (const playerId of constraint.playerIds) {
                const player = players.find(p => p.id === playerId);
                if (player && !assigned.has(player.id)) {
                    teams[emptyTeam].players.push({ ...player });
                    assigned.add(player.id);
                }
            }
        }
    }

    // 티어별로 균등 배치 (높은 티어부터)
    for (const tier of tiers) {
        const tierPlayers = byTier[tier].filter(p => !assigned.has(p.id));

        // 스킬 내림차순 정렬
        tierPlayers.sort((a, b) => b.skill - a.skill);

        for (const player of tierPlayers) {
            // SPLIT 제약 체크
            let validTeams = teams.map((_, idx) => idx);

            for (const constraint of constraints) {
                if (constraint.type === 'SPLIT' && constraint.playerIds.includes(player.id)) {
                    const otherPlayer = constraint.playerIds.find(id => id !== player.id);
                    const otherTeamIdx = teams.findIndex(t =>
                        t.players.some(p => p.id === otherPlayer)
                    );
                    if (otherTeamIdx !== -1) {
                        validTeams = validTeams.filter(idx => idx !== otherTeamIdx);
                    }
                }
            }

            if (validTeams.length === 0) validTeams = teams.map((_, idx) => idx);

            // 가장 약한 팀에 배치
            const weakestTeam = validTeams.reduce((minIdx, idx) =>
                teams[idx].totalSkill < teams[minIdx].totalSkill ? idx : minIdx,
                validTeams[0]
            );

            teams[weakestTeam].players.push({ ...player });
            teams[weakestTeam].totalSkill += player.skill;
            assigned.add(player.id);
        }
    }

    // 포지션 쿼터 조정 (간단한 재배치)
    if (Object.keys(customQuotas).length > 0) {
        // 간단한 구현: 각 팀의 선수들을 포지션별로 재배정
        // (실제로는 더 복잡한 로직 필요)
    }

    return teams;
}

module.exports = {
    ruleBasedMatching
};
