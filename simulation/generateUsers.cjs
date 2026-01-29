// 100명 가상 유저 생성
function generateUsers(count = 100) {
    const users = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

    // 티어 분포 (실제 분포 반영)
    const tierDistribution = [
        { tier: 'S', count: 5, skillRange: [9, 10] },
        { tier: 'A', count: 15, skillRange: [7, 8] },
        { tier: 'B', count: 40, skillRange: [5, 6] },
        { tier: 'C', count: 30, skillRange: [3, 4] },
        { tier: 'D', count: 10, skillRange: [1, 2] }
    ];

    // 포지션 분포
    const positionDistribution = {
        'PG': 15,
        'SG': 20,
        'SF': 25,
        'PF': 20,
        'C': 20
    };

    // 티어 풀 생성
    const tierPool = [];
    tierDistribution.forEach(({ tier, count }) => {
        for (let i = 0; i < count; i++) {
            tierPool.push(tier);
        }
    });

    // 셔플
    shuffle(tierPool);

    // 포지션 풀 생성
    const positionPool = [];
    Object.entries(positionDistribution).forEach(([pos, count]) => {
        for (let i = 0; i < count; i++) {
            positionPool.push(pos);
        }
    });
    shuffle(positionPool);

    // 유저 생성
    for (let i = 0; i < count; i++) {
        const tier = tierPool[i];
        const tierInfo = tierDistribution.find(t => t.tier === tier);
        const skill = getRandomInRange(tierInfo.skillRange[0], tierInfo.skillRange[1]);
        const primaryPos = positionPool[i];

        users.push({
            id: `user_${i + 1}`,
            name: `유저${i + 1}`,
            tier: getTierValue(tier),
            skill,
            sportType: 'BASKETBALL',
            primaryPosition: primaryPos,
            secondaryPosition: getSecondaryPosition(primaryPos, skill),
            tertiaryPositions: getTertiaryPositions(primaryPos, skill),
            forbiddenPositions: getForbiddenPositions(primaryPos, skill),
            isActive: true,
            primaryPositions: [primaryPos],
            secondaryPositions: getSecondaryPosition(primaryPos, skill) !== 'NONE' ? [getSecondaryPosition(primaryPos, skill)] : [],
        });
    }

    return users;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getRandomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTierValue(tier) {
    const map = { S: 5, A: 4, B: 3, C: 2, D: 1 };
    return map[tier];
}

function getSecondaryPosition(primary, skill) {
    // 높은 스킬은 다재다능
    if (skill >= 7) {
        const adjacentMap = {
            'PG': 'SG',
            'SG': ['PG', 'SF'][Math.floor(Math.random() * 2)],
            'SF': ['SG', 'PF'][Math.floor(Math.random() * 2)],
            'PF': ['SF', 'C'][Math.floor(Math.random() * 2)],
            'C': 'PF'
        };
        return adjacentMap[primary];
    }

    // 중간 스킬은 50% 확률
    if (skill >= 4 && Math.random() > 0.5) {
        const adjacentMap = {
            'PG': 'SG',
            'SG': 'SF',
            'SF': 'PF',
            'PF': 'C',
            'C': 'PF'
        };
        return adjacentMap[primary];
    }

    return 'NONE';
}

function getTertiaryPositions(primary, skill) {
    // S급만 3차 포지션 가능
    if (skill < 9) return [];

    const allPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const secondary = getSecondaryPosition(primary, skill);

    return allPositions.filter(p => p !== primary && p !== secondary).slice(0, 1);
}

function getForbiddenPositions(primary, skill) {
    const forbidden = [];

    // 키 작은 선수 (PG, SG)는 C 어려움
    if (primary === 'PG' && skill < 7) {
        forbidden.push('C', 'PF');
    }
    if (primary === 'SG' && skill < 6) {
        forbidden.push('C');
    }

    // 큰 선수 (C, PF)는 PG 어려움
    if (primary === 'C' && skill < 7) {
        forbidden.push('PG', 'SG');
    }
    if (primary === 'PF' && skill < 6) {
        forbidden.push('PG');
    }

    return forbidden;
}

module.exports = { generateUsers };

