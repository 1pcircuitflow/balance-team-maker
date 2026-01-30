// 포지션 만족도 포함 시뮬레이션
// 평가: SD, 다양성, 포지션 만족도(선호 100/가능 75/괜찮음 50/불가능 0)

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

// 다양성 계산
function calcDiversity(currentTeams, history) {
    if (history.length === 0) return 100;
    const currentPairs = new Set();
    currentTeams.forEach(team => {
        const ids = team.players.map(p => p.id).sort();
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                currentPairs.add(`${ids[i]}-${ids[j]}`);
            }
        }
    });
    const historyPairs = new Set();
    for (const prev of history) {
        prev.forEach(team => {
            const ids = team.players.map(p => p.id).sort();
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    historyPairs.add(`${ids[i]}-${ids[j]}`);
                }
            }
        });
    }
    let overlap = 0;
    currentPairs.forEach(pair => { if (historyPairs.has(pair)) overlap++; });
    return 100 - (overlap / currentPairs.size) * 100;
}

// 포지션 만족도 계산 (선호 100/가능 75/괜찮음 50/불가능 0)
function calcPositionSatisfaction(teams) {
    let totalSat = 0, count = 0;
    teams.forEach(team => {
        team.players.forEach(player => {
            if (player.assignedPos && player.positions) {
                const { preferred, possible, okay, forbidden } = player.positions;
                const pos = player.assignedPos;

                if (preferred && preferred.includes(pos)) {
                    totalSat += 100;
                } else if (possible && possible.includes(pos)) {
                    totalSat += 75;
                } else if (okay && okay.includes(pos)) {
                    totalSat += 50;
                } else if (forbidden && forbidden.includes(pos)) {
                    totalSat += 0;
                } else {
                    totalSat += 50; // 기본값
                }
                count++;
            }
        });
    });
    return count > 0 ? totalSat / count : 0;
}

// 농구 선수 15명 (포지션 선호도 포함)
function genBasketball() {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const tiers = [
        { tier: 'S', count: 2, range: [9, 10] },
        { tier: 'A', count: 3, range: [7, 8] },
        { tier: 'B', count: 5, range: [5, 6] },
        { tier: 'C', count: 3, range: [3, 4] },
        { tier: 'D', count: 2, range: [1, 2] }
    ];
    const p = [];
    let id = 1;
    for (const t of tiers) {
        for (let i = 0; i < t.count; i++) {
            const skill = t.range[0] + Math.random() * (t.range[1] - t.range[0]);
            // 포지션 선호도 랜덤 생성
            const shuffledPos = shuffle([...positions]);
            const preferred = [shuffledPos[0]]; // 선호 1개
            const possible = [shuffledPos[1]];  // 가능 1개
            const okay = [shuffledPos[2]];      // 괜찮음 1개
            const forbidden = [shuffledPos[3], shuffledPos[4]]; // 불가능 2개

            p.push({
                id: `B${id}`,
                skill: +skill.toFixed(1),
                tier: t.tier,
                positions: { preferred, possible, okay, forbidden }
            });
            id++;
        }
    }
    return shuffle(p);
}

// 테니스 선수 10명 (포지션 없음)
function genTennis() {
    const tiers = [
        { tier: 'S', count: 1, range: [9, 10] },
        { tier: 'A', count: 2, range: [7, 8] },
        { tier: 'B', count: 4, range: [5, 6] },
        { tier: 'C', count: 2, range: [3, 4] },
        { tier: 'D', count: 1, range: [1, 2] }
    ];
    const p = [];
    let id = 1;
    for (const t of tiers) {
        for (let i = 0; i < t.count; i++) {
            const skill = t.range[0] + Math.random() * (t.range[1] - t.range[0]);
            p.push({ id: `T${id}`, skill: +skill.toFixed(1), tier: t.tier });
            id++;
        }
    }
    return shuffle(p);
}

function genConstraints(players, m, s) {
    const c = [], used = new Set();
    for (let i = 0; i < m; i++) {
        const avail = players.filter(p => !used.has(p.id));
        if (avail.length >= 2) {
            const [p1, p2] = shuffle(avail).slice(0, 2);
            c.push({ type: 'MATCH', ids: [p1.id, p2.id] });
            used.add(p1.id); used.add(p2.id);
        }
    }
    used.clear();
    for (let i = 0; i < s; i++) {
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

// 포지션 배정 (각 팀에 PG/SG/SF/PF/C 배정)
function assignPositions(teams) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    teams.forEach(team => {
        // 각 선수에게 포지션 배정 (순서대로)
        team.players.forEach((player, idx) => {
            player.assignedPos = positions[idx % 5];
        });
    });
    return teams;
}

//=============================================================================
// Gemini (포지션 고려 버전)
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

    // 포지션 배정
    assignPositions(teams);

    // Swap 최적화 (SD 기준)
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
            // 포지션도 함께 교환
            const pos1 = teams[t1].players[i].assignedPos;
            const pos2 = teams[t2].players[j].assignedPos;
            [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
            teams[t1].players[i].assignedPos = pos1;
            teams[t2].players[j].assignedPos = pos2;
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
        assignPositions(teams);
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
        assignPositions(teams);
        let sd = calcSD(teams);
        if (sd < bestSD) { bestSD = sd; best = JSON.parse(JSON.stringify(teams)); }
        for (let sw = 0; sw < 10; sw++) {
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1) t2 = Math.floor(Math.random() * teamCount);
            if (teams[t1].players.length && teams[t2].players.length) {
                const i = Math.floor(Math.random() * teams[t1].players.length);
                const j = Math.floor(Math.random() * teams[t2].players.length);
                const pos1 = teams[t1].players[i].assignedPos;
                const pos2 = teams[t2].players[j].assignedPos;
                [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
                teams[t1].players[i].assignedPos = pos1;
                teams[t2].players[j].assignedPos = pos2;
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
        assignPositions(teams);
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
// 실행
//=============================================================================
async function run() {
    const algos = [
        { id: 'Gemini', fn: Gemini },
        { id: 'MoreGA', fn: MoreGA },
        { id: 'MorePSO', fn: MorePSO },
        { id: 'SD_Limit', fn: SD_Limit_2 }
    ];

    //=========================================================================
    // 농구
    //=========================================================================
    console.log('================================================================================');
    console.log('🏀 농구: 15명 → 3팀, 포지션 쿼터, MATCH 3 + SPLIT 2');
    console.log('   평가: SD, 다양성, 포지션 만족도');
    console.log('================================================================================\n');

    const bbStats = {};
    algos.forEach(a => bbStats[a.id] = { sdSum: 0, violSum: 0, divSum: 0, satSum: 0, wins: 0 });

    for (let run = 0; run < 500; run++) {
        const players = genBasketball();
        const constraints = genConstraints(players, 3, 2);

        const history = [];
        for (let h = 0; h < 4; h++) {
            const histTeams = Array.from({ length: 3 }, () => ({ players: [], totalSkill: 0 }));
            shuffle([...players]).forEach((p, idx) => histTeams[idx % 3].players.push({ ...p }));
            history.push(histTeams);
        }

        const results = {};
        for (const algo of algos) {
            const teams = algo.fn(players, 3);
            const sd = calcSD(teams);
            const viol = checkConstraints(teams, constraints);
            const div = calcDiversity(teams, history);
            const sat = calcPositionSatisfaction(teams);

            results[algo.id] = { sd, viol, div, sat };
            bbStats[algo.id].sdSum += sd;
            bbStats[algo.id].violSum += viol;
            bbStats[algo.id].divSum += div;
            bbStats[algo.id].satSum += sat;
        }

        const minSD = Math.min(...algos.map(a => results[a.id].sd));
        algos.forEach(a => { if (results[a.id].sd === minSD) bbStats[a.id].wins++; });

        if ((run + 1) % 100 === 0) console.log(`  [${run + 1}/500] 농구`);
    }

    console.log('\n📊 농구 결과:');
    const bbRank = algos.map(a => ({
        id: a.id,
        avgSD: (bbStats[a.id].sdSum / 500).toFixed(3),
        avgViol: (bbStats[a.id].violSum / 500).toFixed(2),
        avgDiv: (bbStats[a.id].divSum / 500).toFixed(1),
        avgSat: (bbStats[a.id].satSum / 500).toFixed(1),
        wins: bbStats[a.id].wins
    })).sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | 알고리즘  | 평균SD | 위반  | 다양성  | 포지션만족 | SD승리');
    console.log('-'.repeat(70));
    bbRank.forEach((r, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${m}${i + 1}위 | ${r.id.padEnd(9)} | ${r.avgSD}  | ${r.avgViol}  | ${r.avgDiv}%  | ${r.avgSat}%    | ${r.wins}회`);
    });

    //=========================================================================
    // 테니스
    //=========================================================================
    console.log('\n================================================================================');
    console.log('🎾 테니스: 10명 → 5팀, 포지션 없음, MATCH 2 + SPLIT 2');
    console.log('================================================================================\n');

    const tnStats = {};
    algos.forEach(a => tnStats[a.id] = { sdSum: 0, violSum: 0, divSum: 0, wins: 0 });

    for (let run = 0; run < 500; run++) {
        const players = genTennis();
        const constraints = genConstraints(players, 2, 2);

        const history = [];
        for (let h = 0; h < 4; h++) {
            const histTeams = Array.from({ length: 5 }, () => ({ players: [], totalSkill: 0 }));
            shuffle([...players]).forEach((p, idx) => histTeams[idx % 5].players.push({ ...p }));
            history.push(histTeams);
        }

        const results = {};
        for (const algo of algos) {
            const teams = algo.fn(players, 5);
            const sd = calcSD(teams);
            const viol = checkConstraints(teams, constraints);
            const div = calcDiversity(teams, history);

            results[algo.id] = { sd, viol, div };
            tnStats[algo.id].sdSum += sd;
            tnStats[algo.id].violSum += viol;
            tnStats[algo.id].divSum += div;
        }

        const minSD = Math.min(...algos.map(a => results[a.id].sd));
        algos.forEach(a => { if (results[a.id].sd === minSD) tnStats[a.id].wins++; });

        if ((run + 1) % 100 === 0) console.log(`  [${run + 1}/500] 테니스`);
    }

    console.log('\n📊 테니스 결과:');
    const tnRank = algos.map(a => ({
        id: a.id,
        avgSD: (tnStats[a.id].sdSum / 500).toFixed(3),
        avgViol: (tnStats[a.id].violSum / 500).toFixed(2),
        avgDiv: (tnStats[a.id].divSum / 500).toFixed(1),
        wins: tnStats[a.id].wins
    })).sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | 알고리즘  | 평균SD | 위반  | 다양성  | SD승리');
    console.log('-'.repeat(60));
    tnRank.forEach((r, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${m}${i + 1}위 | ${r.id.padEnd(9)} | ${r.avgSD}  | ${r.avgViol}  | ${r.avgDiv}%  | ${r.wins}회`);
    });

    //=========================================================================
    // 결론
    //=========================================================================
    console.log('\n================================================================================');
    console.log('🏆 최종 결론');
    console.log('================================================================================\n');
    console.log(`🏀 농구 1위: ${bbRank[0].id} (SD: ${bbRank[0].avgSD}, 다양성: ${bbRank[0].avgDiv}%, 포지션만족: ${bbRank[0].avgSat}%)`);
    console.log(`🎾 테니스 1위: ${tnRank[0].id} (SD: ${tnRank[0].avgSD}, 다양성: ${tnRank[0].avgDiv}%)\n`);

    fs.writeFileSync('./scenario_position_results.json', JSON.stringify({ basketball: bbRank, tennis: tnRank }, null, 2));
    console.log('✅ 결과 저장: scenario_position_results.json\n');
}

run().catch(console.error);
