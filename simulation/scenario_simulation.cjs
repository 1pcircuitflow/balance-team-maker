// 농구 + 테니스 시나리오별 500회 시뮬레이션
// 농구: 15명 → 3팀 (5명씩), 포지션 쿼터 (PG/SG/SF/PF/C 각 1명)
// 테니스: 10명 → 5팀 (2명씩), 포지션 없음

const fs = require('fs');

function shuffle(arr) {
    const r = [...arr];
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

function calcSD(teams) {
    const s = teams.map(t => t.totalSkill);
    const avg = s.reduce((a, b) => a + b) / s.length;
    return Math.sqrt(s.reduce((sum, v) => sum + (v - avg) ** 2, 0) / s.length);
}

// 농구 선수 15명 생성 (포지션 포함)
function genBasketballPlayers() {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const tiers = [
        { tier: 'S', count: 2, range: [9, 10] },
        { tier: 'A', count: 3, range: [7, 8] },
        { tier: 'B', count: 5, range: [5, 6] },
        { tier: 'C', count: 3, range: [3, 4] },
        { tier: 'D', count: 2, range: [1, 2] }
    ];
    const players = [];
    let id = 1;
    for (const t of tiers) {
        for (let i = 0; i < t.count; i++) {
            const skill = t.range[0] + Math.random() * (t.range[1] - t.range[0]);
            const pos = positions[Math.floor(Math.random() * 5)];
            players.push({ id: `B${id}`, skill: +skill.toFixed(1), pos, tier: t.tier });
            id++;
        }
    }
    return shuffle(players);
}

// 테니스 선수 10명 생성 (포지션 없음)
function genTennisPlayers() {
    const tiers = [
        { tier: 'S', count: 1, range: [9, 10] },
        { tier: 'A', count: 2, range: [7, 8] },
        { tier: 'B', count: 4, range: [5, 6] },
        { tier: 'C', count: 2, range: [3, 4] },
        { tier: 'D', count: 1, range: [1, 2] }
    ];
    const players = [];
    let id = 1;
    for (const t of tiers) {
        for (let i = 0; i < t.count; i++) {
            const skill = t.range[0] + Math.random() * (t.range[1] - t.range[0]);
            players.push({ id: `T${id}`, skill: +skill.toFixed(1), tier: t.tier });
            id++;
        }
    }
    return shuffle(players);
}

// 제약 조건 생성
function genConstraints(players, matchCount, splitCount) {
    const c = [], used = new Set();
    for (let i = 0; i < matchCount; i++) {
        const avail = players.filter(p => !used.has(p.id));
        if (avail.length >= 2) {
            const [p1, p2] = shuffle(avail).slice(0, 2);
            c.push({ type: 'MATCH', ids: [p1.id, p2.id] });
            used.add(p1.id); used.add(p2.id);
        }
    }
    used.clear();
    for (let i = 0; i < splitCount; i++) {
        const avail = players.filter(p => !used.has(p.id));
        if (avail.length >= 2) {
            const [p1, p2] = shuffle(avail).slice(0, 2);
            c.push({ type: 'SPLIT', ids: [p1.id, p2.id] });
            used.add(p1.id); used.add(p2.id);
        }
    }
    return c;
}

function checkConstraints(teams, constraints) {
    let v = 0;
    for (const c of constraints) {
        if (c.type === 'MATCH') {
            const ts = new Set();
            for (const id of c.ids) {
                const idx = teams.findIndex(t => t.players.some(p => p.id === id));
                if (idx >= 0) ts.add(idx);
            }
            if (ts.size > 1) v++;
        } else {
            const [a, b] = c.ids;
            const t1 = teams.findIndex(t => t.players.some(p => p.id === a));
            const t2 = teams.findIndex(t => t.players.some(p => p.id === b));
            if (t1 === t2 && t1 >= 0) v++;
        }
    }
    return v;
}

// 포지션 쿼터 체크 (농구용)
function checkPositionQuota(teams) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    let violations = 0;
    for (const team of teams) {
        const posCounts = {};
        team.players.forEach(p => {
            posCounts[p.pos] = (posCounts[p.pos] || 0) + 1;
        });
        // 각 포지션 1명씩 있어야 함
        for (const pos of positions) {
            if ((posCounts[pos] || 0) !== 1) violations++;
        }
    }
    return violations;
}

//=============================================================================
// Gemini 알고리즘
//=============================================================================
function Gemini(players, teamCount) {
    const sorted = shuffle([...players]).sort((a, b) => b.skill - a.skill);
    const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));

    for (const p of sorted) {
        let minIdx = 0, minS = Infinity;
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].totalSkill < minS) { minS = teams[i].totalSkill; minIdx = i; }
        }
        teams[minIdx].players.push({ ...p });
        teams[minIdx].totalSkill += p.skill;
    }

    let iter = 100, improved = true;
    while (improved && iter-- > 0) {
        improved = false;
        const curDiff = Math.max(...teams.map(t => t.totalSkill)) - Math.min(...teams.map(t => t.totalSkill));
        if (curDiff < 0.1) break;

        let bestSwap = null, bestImp = 0;
        for (let t1 = 0; t1 < teamCount; t1++) {
            for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                for (let i = 0; i < teams[t1].players.length; i++) {
                    for (let j = 0; j < teams[t2].players.length; j++) {
                        const p1 = teams[t1].players[i], p2 = teams[t2].players[j];
                        const ns1 = teams[t1].totalSkill - p1.skill + p2.skill;
                        const ns2 = teams[t2].totalSkill - p2.skill + p1.skill;
                        const skills = teams.map((t, k) => k === t1 ? ns1 : k === t2 ? ns2 : t.totalSkill);
                        const newDiff = Math.max(...skills) - Math.min(...skills);
                        if (curDiff - newDiff > bestImp) { bestImp = curDiff - newDiff; bestSwap = { t1, t2, i, j }; }
                    }
                }
            }
        }
        if (bestSwap && bestImp > 0.01) {
            const { t1, t2, i, j } = bestSwap;
            [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
            teams[t1].totalSkill = teams[t1].players.reduce((s, p) => s + p.skill, 0);
            teams[t2].totalSkill = teams[t2].players.reduce((s, p) => s + p.skill, 0);
            improved = true;
        }
    }
    return teams;
}

//=============================================================================
// MoreGA
//=============================================================================
function MoreGA(players, teamCount) {
    const popSize = 30, gen = 50;
    let pop = [];
    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        pop.push(teams);
    }
    for (let g = 0; g < gen; g++) {
        const scored = pop.map(t => ({ t, sd: calcSD(t) })).sort((a, b) => a.sd - b.sd);
        pop = scored.slice(0, popSize / 2).map(s => s.t);
        while (pop.length < popSize) pop.push(JSON.parse(JSON.stringify(pop[Math.floor(Math.random() * pop.length / 2)])));
    }
    return pop[0];
}

//=============================================================================
// MorePSO
//=============================================================================
function MorePSO(players, teamCount) {
    let best = null, bestSD = Infinity;
    for (let iter = 0; iter < 60; iter++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        let sd = calcSD(teams);
        if (sd < bestSD) { bestSD = sd; best = JSON.parse(JSON.stringify(teams)); }
        for (let sw = 0; sw < 10; sw++) {
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1) t2 = Math.floor(Math.random() * teamCount);
            if (teams[t1].players.length && teams[t2].players.length) {
                const i = Math.floor(Math.random() * teams[t1].players.length);
                const j = Math.floor(Math.random() * teams[t2].players.length);
                [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
                teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
                sd = calcSD(teams);
                if (sd < bestSD) { bestSD = sd; best = JSON.parse(JSON.stringify(teams)); }
            }
        }
    }
    return best;
}

//=============================================================================
// SD_Limit_2
//=============================================================================
function SD_Limit_2(players, teamCount) {
    const popSize = 30, gen = 30;
    let pop = [];
    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        pop.push(teams);
    }
    for (let g = 0; g < gen; g++) {
        const scored = pop.map(t => {
            let sd = calcSD(t);
            if (sd > 2) sd += 1e8;
            return { t, sd };
        }).sort((a, b) => a.sd - b.sd);
        pop = scored.slice(0, popSize / 2).map(s => s.t);
        while (pop.length < popSize) pop.push(JSON.parse(JSON.stringify(pop[Math.floor(Math.random() * pop.length / 2)])));
    }
    return pop[0];
}

//=============================================================================
// 시뮬레이션 실행
//=============================================================================
async function runScenarios() {
    const algos = [
        { id: 'Gemini', fn: Gemini },
        { id: 'MoreGA', fn: MoreGA },
        { id: 'MorePSO', fn: MorePSO },
        { id: 'SD_Limit', fn: SD_Limit_2 }
    ];

    const results = { basketball: {}, tennis: {} };

    //=========================================================================
    // 시나리오 1: 농구 (15명 → 3팀, 포지션 쿼터)
    //=========================================================================
    console.log('================================================================================');
    console.log('🏀 시나리오 1: 농구');
    console.log('   15명 고정 → 3팀 (5명씩)');
    console.log('   포지션 쿼터: PG/SG/SF/PF/C 각 1명');
    console.log('   제약: MATCH 3쌍 + SPLIT 2쌍');
    console.log('================================================================================\n');

    // 테스트 케이스 500개 생성
    const bbCases = [];
    for (let i = 0; i < 500; i++) {
        const players = genBasketballPlayers();
        const constraints = genConstraints(players, 3, 2);
        bbCases.push({ players, constraints });
    }
    console.log('✅ 농구 테스트 케이스 500개 생성\n');

    const bbStats = {};
    algos.forEach(a => bbStats[a.id] = { sdSum: 0, violSum: 0, posViolSum: 0, wins: 0, sdList: [], perfect: 0 });

    for (let i = 0; i < 500; i++) {
        const tc = bbCases[i];
        const runResults = {};

        for (const algo of algos) {
            const teams = algo.fn(tc.players, 3);
            const sd = calcSD(teams);
            const viol = checkConstraints(teams, tc.constraints);
            const posViol = checkPositionQuota(teams);

            runResults[algo.id] = { sd, viol, posViol };
            bbStats[algo.id].sdSum += sd;
            bbStats[algo.id].violSum += viol;
            bbStats[algo.id].posViolSum += posViol;
            bbStats[algo.id].sdList.push(sd);
            if (sd < 0.01) bbStats[algo.id].perfect++;
        }

        const minSD = Math.min(...algos.map(a => runResults[a.id].sd));
        algos.forEach(a => { if (runResults[a.id].sd === minSD) bbStats[a.id].wins++; });

        if ((i + 1) % 100 === 0) console.log(`  [${i + 1}/500] 농구 완료`);
    }

    // 헤드투헤드
    const bbH2H = {};
    algos.forEach(a1 => {
        bbH2H[a1.id] = {};
        algos.forEach(a2 => {
            if (a1.id !== a2.id) {
                let w = 0;
                for (let i = 0; i < 500; i++) {
                    if (bbStats[a1.id].sdList[i] < bbStats[a2.id].sdList[i]) w++;
                }
                bbH2H[a1.id][a2.id] = w;
            }
        });
    });

    console.log('\n📊 농구 결과:');
    const bbRank = algos.map(a => ({
        id: a.id,
        avgSD: (bbStats[a.id].sdSum / 500).toFixed(3),
        avgViol: (bbStats[a.id].violSum / 500).toFixed(2),
        avgPosViol: (bbStats[a.id].posViolSum / 500).toFixed(2),
        wins: bbStats[a.id].wins,
        perfect: bbStats[a.id].perfect
    })).sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | 알고리즘  | 평균SD | 위반  | 포지션위반 | SD승리 | 완벽');
    console.log('-'.repeat(65));
    bbRank.forEach((r, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${m}${i + 1}위 | ${r.id.padEnd(9)} | ${r.avgSD}  | ${r.avgViol}  | ${r.avgPosViol}       | ${r.wins}회   | ${r.perfect}`);
    });

    results.basketball = { rankings: bbRank, h2h: bbH2H };

    //=========================================================================
    // 시나리오 2: 테니스 (10명 → 5팀, 포지션 없음)
    //=========================================================================
    console.log('\n================================================================================');
    console.log('🎾 시나리오 2: 테니스');
    console.log('   10명 고정 → 5팀 (2명씩)');
    console.log('   포지션 제약 없음');
    console.log('   제약: MATCH 2쌍 + SPLIT 2쌍');
    console.log('================================================================================\n');

    const tnCases = [];
    for (let i = 0; i < 500; i++) {
        const players = genTennisPlayers();
        const constraints = genConstraints(players, 2, 2);
        tnCases.push({ players, constraints });
    }
    console.log('✅ 테니스 테스트 케이스 500개 생성\n');

    const tnStats = {};
    algos.forEach(a => tnStats[a.id] = { sdSum: 0, violSum: 0, wins: 0, sdList: [], perfect: 0 });

    for (let i = 0; i < 500; i++) {
        const tc = tnCases[i];
        const runResults = {};

        for (const algo of algos) {
            const teams = algo.fn(tc.players, 5);
            const sd = calcSD(teams);
            const viol = checkConstraints(teams, tc.constraints);

            runResults[algo.id] = { sd, viol };
            tnStats[algo.id].sdSum += sd;
            tnStats[algo.id].violSum += viol;
            tnStats[algo.id].sdList.push(sd);
            if (sd < 0.01) tnStats[algo.id].perfect++;
        }

        const minSD = Math.min(...algos.map(a => runResults[a.id].sd));
        algos.forEach(a => { if (runResults[a.id].sd === minSD) tnStats[a.id].wins++; });

        if ((i + 1) % 100 === 0) console.log(`  [${i + 1}/500] 테니스 완료`);
    }

    // 헤드투헤드
    const tnH2H = {};
    algos.forEach(a1 => {
        tnH2H[a1.id] = {};
        algos.forEach(a2 => {
            if (a1.id !== a2.id) {
                let w = 0;
                for (let i = 0; i < 500; i++) {
                    if (tnStats[a1.id].sdList[i] < tnStats[a2.id].sdList[i]) w++;
                }
                tnH2H[a1.id][a2.id] = w;
            }
        });
    });

    console.log('\n📊 테니스 결과:');
    const tnRank = algos.map(a => ({
        id: a.id,
        avgSD: (tnStats[a.id].sdSum / 500).toFixed(3),
        avgViol: (tnStats[a.id].violSum / 500).toFixed(2),
        wins: tnStats[a.id].wins,
        perfect: tnStats[a.id].perfect
    })).sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | 알고리즘  | 평균SD | 위반  | SD승리 | 완벽');
    console.log('-'.repeat(55));
    tnRank.forEach((r, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${m}${i + 1}위 | ${r.id.padEnd(9)} | ${r.avgSD}  | ${r.avgViol}  | ${r.wins}회   | ${r.perfect}`);
    });

    results.tennis = { rankings: tnRank, h2h: tnH2H };

    //=========================================================================
    // 최종 결론
    //=========================================================================
    console.log('\n================================================================================');
    console.log('🏆 최종 결론');
    console.log('================================================================================\n');
    console.log(`🏀 농구 1위: ${bbRank[0].id} (평균SD: ${bbRank[0].avgSD}, ${bbRank[0].wins}승)`);
    console.log(`🎾 테니스 1위: ${tnRank[0].id} (평균SD: ${tnRank[0].avgSD}, ${tnRank[0].wins}승)\n`);

    fs.writeFileSync('./scenario_results.json', JSON.stringify(results, null, 2));
    console.log('✅ 결과 저장: scenario_results.json\n');
}

runScenarios().catch(console.error);
