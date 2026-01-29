// 제약 조건 생성 (MATCH 10쌍, SPLIT 5쌍)
function generateConstraints(users) {
    const constraints = [];
    const usedInMatch = new Set();
    const usedInSplit = new Set();

    // MATCH 제약 10쌍 (20명)
    let matchCount = 0;
    while (matchCount < 10) {
        const idx1 = Math.floor(Math.random() * users.length);
        const idx2 = Math.floor(Math.random() * users.length);

        if (idx1 === idx2) continue;
        if (usedInMatch.has(users[idx1].id) || usedInMatch.has(users[idx2].id)) continue;

        constraints.push({
            type: 'MATCH',
            playerIds: [users[idx1].id, users[idx2].id],
            reason: '친구'
        });

        usedInMatch.add(users[idx1].id);
        usedInMatch.add(users[idx2].id);
        matchCount++;
    }

    // SPLIT 제약 5쌍 (10명) - MATCH와 겹치지 않게
    let splitCount = 0;
    while (splitCount < 5) {
        const idx1 = Math.floor(Math.random() * users.length);
        const idx2 = Math.floor(Math.random() * users.length);

        if (idx1 === idx2) continue;
        if (usedInMatch.has(users[idx1].id) || usedInMatch.has(users[idx2].id)) continue;
        if (usedInSplit.has(users[idx1].id) || usedInSplit.has(users[idx2].id)) continue;

        constraints.push({
            type: 'SPLIT',
            playerIds: [users[idx1].id, users[idx2].id],
            reason: '라이벌'
        });

        usedInSplit.add(users[idx1].id);
        usedInSplit.add(users[idx2].id);
        splitCount++;
    }

    return constraints;
}

module.exports = { generateConstraints };
