
// Gemini 서비스 로직 검증 스크립트
// balanceService.ts의 핵심 로직을 그대로 가져와서 테스트 데이터를 넣고 돌려봄

const SportType = { BASKETBALL: 'BASKETBALL' };

// ========== 1. 헬퍼 함수 ==========

const shuffle = (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const cloneTeams = (teams) => {
    return teams.map(t => ({
        ...t,
        players: t.players.map(p => ({ ...p }))
    }));
};

const getPositionPoint = (player, pos) => {
    if (pos === 'NONE') return 50;
    const p1s = player.primaryPositions || [];
    const p2s = player.secondaryPositions || [];
    const p3s = player.tertiaryPositions || [];

    if (p1s.includes(pos)) return 100;
    if (p2s.includes(pos)) return 75;
    if (p3s.includes(pos)) return 50;
    return -9999;
};

const calculateTeamSkillReal = (team) => {
    return Number(team.players.reduce((sum, p) => sum + p.tier, 0).toFixed(1));
};

// ========== 2. 전처리 및 초기 배정 ==========

function initialDistribute(players, teamCount, constraints) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        players: [],
        totalSkill: 0,
    }));

    const activePlayers = [...players];
    const matchGroups = [];
    const processedIds = new Set();

    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const group = [];
        c.playerIds.forEach(id => {
            const p = activePlayers.find(ap => ap.id === id);
            if (p && !processedIds.has(p.id)) {
                group.push(p);
                processedIds.add(p.id);
            }
        });
        if (group.length > 0) matchGroups.push(group);
    });

    const individualPlayers = activePlayers.filter(p => !processedIds.has(p.id));

    let units = [];
    matchGroups.forEach(g => {
        units.push({
            players: g,
            totalSkill: g.reduce((s, p) => s + p.tier, 0),
            isGroup: true
        });
    });
    individualPlayers.forEach(p => {
        units.push({
            players: [p],
            totalSkill: p.tier,
            isGroup: false
        });
    });

    units = shuffle(units).sort((a, b) => b.totalSkill - a.totalSkill);

    const splitMap = new Map();
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        c.playerIds.forEach(id1 => {
            c.playerIds.forEach(id2 => {
                if (id1 !== id2) {
                    if (!splitMap.has(id1)) splitMap.set(id1, new Set());
                    splitMap.get(id1).add(id2);
                }
            });
        });
    });

    for (const unit of units) {
        let possibleTeams = [];
        for (let i = 0; i < teamCount; i++) {
            let conflict = false;
            for (const p of unit.players) {
                const enemies = splitMap.get(p.id);
                if (enemies) {
                    if (teams[i].players.some(existing => enemies.has(existing.id))) {
                        conflict = true;
                        break;
                    }
                }
            }
            if (!conflict) possibleTeams.push(i);
        }

        if (possibleTeams.length === 0) possibleTeams = Array.from({ length: teamCount }, (_, k) => k);

        possibleTeams.sort((a, b) => teams[a].totalSkill - teams[b].totalSkill);
        const targetIdx = possibleTeams[0];

        teams[targetIdx].players.push(...unit.players);
        teams[targetIdx].totalSkill += unit.totalSkill;
    }

    return teams;
}

// ========== 3. 팀 내 포지션 최적화 ==========

function optimizeTeamPositions(team, allPositions) {
    const players = team.players;
    const positions = [...allPositions];
    if (positions.includes('NONE')) return;

    const assignedCount = {};
    const playerAssigned = new Set();
    const options = [];

    players.forEach((p, idx) => {
        allPositions.forEach(pos => {
            const score = getPositionPoint(p, pos);
            if (score > -5000) {
                options.push({ pIdx: idx, pos, score });
            }
        });
    });

    options.sort((a, b) => b.score - a.score || players[b.pIdx].tier - players[a.pIdx].tier);

    options.forEach(opt => {
        if (playerAssigned.has(players[opt.pIdx].id)) return;
        players[opt.pIdx].assignedPosition = opt.pos;
        playerAssigned.add(players[opt.pIdx].id);
        assignedCount[opt.pos] = (assignedCount[opt.pos] || 0) + 1;
    });

    players.forEach(p => {
        if (!playerAssigned.has(p.id)) {
            p.assignedPosition = 'NONE';
        }
    });
}

// ========== 4. Swap 최적화 ==========

function optimizeTeams(teams, constraints, allPositions) {
    let currentTeams = cloneTeams(teams);
    let bestTeams = cloneTeams(teams);

    // 초기 스킬 재계산 필요 (중요!)
    teams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));

    const calcSD = (ts) => {
        const skills = ts.map(t => calculateTeamSkillReal(t));
        const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
        const vari = skills.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / skills.length;
        return Math.sqrt(vari);
    };

    const calcPosScore = (ts) => {
        let sum = 0;
        ts.forEach(t => t.players.forEach(p => {
            sum += getPositionPoint(p, p.assignedPosition || 'NONE');
        }));
        return sum;
    };

    let minSD = calcSD(currentTeams);
    let maxPosScore = calcPosScore(currentTeams);

    const iterations = 500;
    let noImprovementCount = 0;

    const matchMap = new Map();
    constraints.filter(c => c.type === 'MATCH').forEach((c, idx) => {
        c.playerIds.forEach(pid => matchMap.set(pid, `match_${idx}`));
    });

    const splitMap = new Map();
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        c.playerIds.forEach(id1 => {
            c.playerIds.forEach(id2 => {
                if (id1 !== id2) {
                    if (!splitMap.has(id1)) splitMap.set(id1, new Set());
                    splitMap.get(id1).add(id2);
                }
            });
        });
    });

    for (let k = 0; k < iterations; k++) {
        if (noImprovementCount > 50) break;

        const t1Idx = Math.floor(Math.random() * currentTeams.length);
        let t2Idx = Math.floor(Math.random() * currentTeams.length);
        while (t1Idx === t2Idx) t2Idx = Math.floor(Math.random() * currentTeams.length);

        if (currentTeams[t1Idx].players.length === 0 || currentTeams[t2Idx].players.length === 0) continue;

        const p1 = currentTeams[t1Idx].players[Math.floor(Math.random() * currentTeams[t1Idx].players.length)];
        const p2 = currentTeams[t2Idx].players[Math.floor(Math.random() * currentTeams[t2Idx].players.length)];

        const p1Group = matchMap.has(p1.id)
            ? currentTeams[t1Idx].players.filter(p => matchMap.get(p.id) === matchMap.get(p1.id))
            : [p1];
        const p2Group = matchMap.has(p2.id)
            ? currentTeams[t2Idx].players.filter(p => matchMap.get(p.id) === matchMap.get(p2.id))
            : [p2];

        let conflict = false;
        for (const p of p2Group) {
            const enemies = splitMap.get(p.id);
            if (enemies) {
                if (currentTeams[t1Idx].players.some(existing =>
                    !p1Group.map(x => x.id).includes(existing.id) && enemies.has(existing.id)
                )) { conflict = true; break; }
            }
        }
        if (conflict) continue;

        for (const p of p1Group) {
            const enemies = splitMap.get(p.id);
            if (enemies) {
                if (currentTeams[t2Idx].players.some(existing =>
                    !p2Group.map(x => x.id).includes(existing.id) && enemies.has(existing.id)
                )) { conflict = true; break; }
            }
        }
        if (conflict) continue;

        const newTeams = cloneTeams(currentTeams);
        newTeams[t1Idx].players = newTeams[t1Idx].players.filter(p => !p1Group.map(x => x.id).includes(p.id));
        newTeams[t2Idx].players = newTeams[t2Idx].players.filter(p => !p2Group.map(x => x.id).includes(p.id));

        newTeams[t1Idx].players.push(...p2Group);
        newTeams[t2Idx].players.push(...p1Group);

        newTeams[t1Idx].totalSkill = calculateTeamSkillReal(newTeams[t1Idx]);
        newTeams[t2Idx].totalSkill = calculateTeamSkillReal(newTeams[t2Idx]);

        optimizeTeamPositions(newTeams[t1Idx], allPositions);
        optimizeTeamPositions(newTeams[t2Idx], allPositions);

        const newSD = calcSD(newTeams);
        const newPosScore = calcPosScore(newTeams);
        const isPosValid = newPosScore > -5000;

        let accept = false;
        if (isPosValid) {
            if (newSD < minSD - 0.05) {
                accept = true;
            } else if (Math.abs(newSD - minSD) < 0.1 && newPosScore > maxPosScore) {
                accept = true;
            }
        }

        if (accept) {
            currentTeams = newTeams;
            minSD = newSD;
            maxPosScore = newPosScore;
            bestTeams = cloneTeams(newTeams);
            noImprovementCount = 0;
        } else {
            noImprovementCount++;
        }
    }

    return bestTeams;
}

const generateBalancedTeams = (players, teamCount, constraints) => {
    const allPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const initialTeams = initialDistribute(players, teamCount, constraints);
    initialTeams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));
    initialTeams.forEach(t => optimizeTeamPositions(t, allPositions));
    const optimizedTeams = optimizeTeams(initialTeams, constraints, allPositions);
    return optimizedTeams;
};

// ========== 실행 테스트 ==========

const players = Array.from({ length: 15 }, (_, i) => ({
    id: `P${i + 1}`,
    name: `Player ${i + 1}`,
    tier: 5 + (i % 5), // 5~9 점수 분포
    sportType: 'BASKETBALL',
    isActive: true,
    primaryPositions: ['PG'], // 기본은 다 PG 선호
    secondaryPositions: [],
    tertiaryPositions: [],
    primaryPosition: 'PG',
    secondaryPosition: 'NONE',
    tertiaryPosition: 'NONE'
}));

// P1, P2는 MATCH (같은 팀이어야 함)
const constraints = [
    { type: 'MATCH', playerIds: ['P1', 'P2'] }
];

// P1은 PG 불가능 -> C만 가능
players[0].primaryPositions = ['C'];
players[0].primaryPosition = 'C';

// P3는 PG 선호하지만 SG도 가능
players[2].secondaryPositions = ['SG'];
players[2].secondaryPosition = 'SG';

console.log('🚀 Gemini 서비스 검증 시작');
const resultTeams = generateBalancedTeams(players, 3, constraints);

console.log('\n📊 결과 확인');
resultTeams.forEach(t => {
    console.log(`[${t.name}] Total Skill: ${t.totalSkill}`);
    t.players.forEach(p => {
        console.log(`  - ${p.name} (Tier ${p.tier}): Assigned ${p.assignedPosition}`);
    });
});

console.log('\n✅ 검증 포인트');

// 1. MATCH 체크
const t1 = resultTeams.find(t => t.players.some(p => p.id === 'P1'));
const t2 = resultTeams.find(t => t.players.some(p => p.id === 'P2'));
if (t1 && t2 && t1.id === t2.id) console.log('PASS: P1, P2 같은 팀 배정됨');
else console.log('FAIL: P1, P2 찢어짐!');

// 2. 불가능 포지션 체크
const p1Res = resultTeams.flatMap(t => t.players).find(p => p.id === 'P1');
if (p1Res.assignedPosition === 'C') console.log('PASS: P1에게 선호 포지션 C 배정됨');
else console.log(`FAIL: P1에게 ${p1Res.assignedPosition} 배정됨 (PG면 안됨)`);

// 3. SD 체크
const skills = resultTeams.map(t => t.totalSkill);
const avg = skills.reduce((a, b) => a + b) / 3;
const sd = Math.sqrt(skills.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / 3);
console.log(`SD: ${sd.toFixed(3)}`);
