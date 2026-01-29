// 100명 풀에서 15명 선발
function selectPlayersForMatch(users, constraints) {
    const selected = [];
    const positionCount = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

    // 1. 제약이 있는 선수들 파악
    const constrainedUserIds = new Set();
    constraints.forEach(c => {
        c.playerIds.forEach(id => constrainedUserIds.add(id));
    });

    const constrainedUsers = users.filter(u => constrainedUserIds.has(u.id));
    const unconstrainedUsers = users.filter(u => !constrainedUserIds.has(u.id));

    // 2. 제약이 있는 선수들 중 균형있게 선택 (최대 8명)
    const constrainedSelected = [];
    for (const user of constrainedUsers) {
        if (constrainedSelected.length >= 8) break;

        const pos = user.primaryPosition;
        if (positionCount[pos] < 3) {  // 각 포지션 최대 3명
            constrainedSelected.push(user);
            positionCount[pos]++;
        }
    }

    selected.push(...constrainedSelected);

    // 3. 각 포지션별 최소 3명 보장
    for (const pos of positions) {
        const needed = 3 - positionCount[pos];
        if (needed > 0) {
            const candidates = unconstrainedUsers
                .filter(u => !selected.includes(u))
                .filter(u => {
                    const p1s = u.primaryPositions || [u.primaryPosition];
                    const p2s = u.secondaryPositions || [];
                    return p1s.includes(pos) || p2s.includes(pos);
                })
                .sort((a, b) => b.tier - a.tier);  // 티어 높은 순

            for (let i = 0; i < needed && i < candidates.length; i++) {
                selected.push(candidates[i]);
                positionCount[pos]++;
            }
        }
    }

    // 4. 아직 15명이 안되면 나머지 채우기
    while (selected.length < 15) {
        const remaining = unconstrainedUsers
            .filter(u => !selected.includes(u));

        if (remaining.length === 0) break;

        // 티어 균형 맞추기
        const avgTier = selected.reduce((sum, u) => sum + u.tier, 0) / selected.length;
        remaining.sort((a, b) => Math.abs(b.tier - avgTier) - Math.abs(a.tier - avgTier));

        selected.push(remaining[0]);
    }

    return selected.slice(0, 15);
}

module.exports = { selectPlayersForMatch };
