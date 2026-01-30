// Gemini vs 기존 알고리즘 - 500회 공정 비교
// 4가지 알고리즘, 동일 테스트 케이스

const fs = require('fs');

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function calculateSD(teams) {
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b) / skills.length;
    return Math.sqrt(skills.reduce((sum, s) => sum + (s - avg) ** 2, 0) / skills.length);
}

function generateUsers(count = 100) {
    const users = [];
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const tierDistribution = [
        { tier: 'S', count: 5, skillRange: [9, 10] },
        { tier: 'A', count: 15, skillRange: [7, 8] },
        { tier: 'B', count: 40, skillRange: [5, 6] },
        { tier: 'C', count: 30, skillRange: [3, 4] },
        { tier: 'D', count: 10, skillRange: [1, 2] }
    ];

    let userId = 1;
    for (const { tier, count, skillRange } of tierDistribution) {
        for (let i = 0; i < count; i++) {
            const skill = skillRange[0] + Math.random() * (skillRange[1] - skillRange[0]);
            const primaryPos = positions[Math.floor(Math.random() * positions.length)];
            users.push({
                id: `user_${userId}`,
                name: `유저${userId}`,
                tier,
                skill: Number(skill.toFixed(1)),
                primaryPosition: primaryPos
            });
            userId++;
        }
    }
    return shuffle(users);
}

function generateConstraints(players) {
    const constraints = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({ type: 'MATCH', playerIds: [p1.id, p2.id] });
            used.add(p1.id); used.add(p2.id);
        }
    }
    used.clear();
    for (let i = 0; i < 2; i++) {
        const available = players.filter(p => !used.has(p.id));
        if (available.length >= 2) {
            const [p1, p2] = shuffle(available).slice(0, 2);
            constraints.push({ type: 'SPLIT', playerIds: [p1.id, p2.id] });
            used.add(p1.id); used.add(p2.id);
        }
    }
    return constraints;
}

function validateConstraints(teams, constraints) {
    let violations = 0;
    for (const c of constraints) {
        if (c.type === 'MATCH') {
            const teamIds = new Set();
            for (const pid of c.playerIds) {
                const idx = teams.findIndex(t => t.players.some(p => p.id === pid));
                if (idx !== -1) teamIds.add(idx);
            }
            if (teamIds.size > 1) violations++;
        } else if (c.type === 'SPLIT') {
            const [p1, p2] = c.playerIds;
            const t1 = teams.findIndex(t => t.players.some(p => p.id === p1));
            const t2 = teams.findIndex(t => t.players.some(p => p.id === p2));
            if (t1 === t2 && t1 !== -1) violations++;
        }
    }
    return violations;
}

// Gemini 알고리즘
function Gemini(players, teamCount) {
    const sorted = shuffle([...players]).sort((a, b) => b.skill - a.skill);
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1, players: [], totalSkill: 0
    }));

    for (const player of sorted) {
        let minIdx = 0, minSkill = Infinity;
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].totalSkill < minSkill) {
                minSkill = teams[i].totalSkill;
                minIdx = i;
            }
        }
        teams[minIdx].players.push({ ...player });
        teams[minIdx].totalSkill += player.skill;
    }

    let improved = true, iter = 100;
    while (improved && iter-- > 0) {
        improved = false;
        const curDiff = Math.max(...teams.map(t => t.totalSkill)) - Math.min(...teams.map(t => t.totalSkill));
        if (curDiff < 0.1) break;

        let bestSwap = null, bestImp = 0;
        for (let t1 = 0; t1 < teamCount; t1++) {
            for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                for (let p1 = 0; p1 < teams[t1].players.length; p1++) {
                    for (let p2 = 0; p2 < teams[t2].players.length; p2++) {
                        const pl1 = teams[t1].players[p1], pl2 = teams[t2].players[p2];
                        const ns1 = teams[t1].totalSkill - pl1.skill + pl2.skill;
                        const ns2 = teams[t2].totalSkill - pl2.skill + pl1.skill;
                        const skills = teams.map((t, i) => i === t1 ? ns1 : i === t2 ? ns2 : t.totalSkill);
                        const newDiff = Math.max(...skills) - Math.min(...skills);
                        const imp = curDiff - newDiff;
                        if (imp > bestImp) { bestImp = imp; bestSwap = { t1, t2, p1, p2 }; }
                    }
                }
            }
        }
        if (bestSwap && bestImp > 0.01) {
            const { t1, t2, p1, p2 } = bestSwap;
            const temp = teams[t1].players[p1];
            teams[t1].players[p1] = teams[t2].players[p2];
            teams[t2].players[p2] = temp;
            teams[t1].totalSkill = teams[t1].players.reduce((s, p) => s + p.skill, 0);
            teams[t2].totalSkill = teams[t2].players.reduce((s, p) => s + p.skill, 0);
            improved = true;
        }
    }
    return teams;
}

// MoreGA
function MoreGA(players, teamCount) {
    const popSize = 30, generations = 50;
    let pop = [];
    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        pop.push(teams);
    }
    for (let g = 0; g < generations; g++) {
        const scored = pop.map(t => ({ t, sd: calculateSD(t) })).sort((a, b) => a.sd - b.sd);
        pop = scored.slice(0, popSize / 2).map(s => s.t);
        while (pop.length < popSize) pop.push(JSON.parse(JSON.stringify(pop[Math.floor(Math.random() * pop.length / 2)])));
    }
    return pop[0];
}

// MorePSO
function MorePSO(players, teamCount) {
    let best = null, bestSD = Infinity;
    for (let iter = 0; iter < 60; iter++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        let sd = calculateSD(teams);
        if (sd < bestSD) { bestSD = sd; best = JSON.parse(JSON.stringify(teams)); }
        for (let sw = 0; sw < 10; sw++) {
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1) t2 = Math.floor(Math.random() * teamCount);
            if (teams[t1].players.length && teams[t2].players.length) {
                const p1 = Math.floor(Math.random() * teams[t1].players.length);
                const p2 = Math.floor(Math.random() * teams[t2].players.length);
                [teams[t1].players[p1], teams[t2].players[p2]] = [teams[t2].players[p2], teams[t1].players[p1]];
                teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
                sd = calculateSD(teams);
                if (sd < bestSD) { bestSD = sd; best = JSON.parse(JSON.stringify(teams)); }
            }
        }
    }
    return best;
}

// SD_Limit_2
function SD_Limit_2(players, teamCount) {
    const popSize = 30, generations = 30;
    let pop = [];
    for (let i = 0; i < popSize; i++) {
        const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));
        shuffle([...players]).forEach((p, idx) => teams[idx % teamCount].players.push({ ...p }));
        teams.forEach(t => t.totalSkill = t.players.reduce((s, p) => s + p.skill, 0));
        pop.push(teams);
    }
    for (let g = 0; g < generations; g++) {
        const scored = pop.map(t => {
            let sd = calculateSD(t);
            if (sd > 2) sd += 1e8;
            return { t, sd };
        }).sort((a, b) => a.sd - b.sd);
        pop = scored.slice(0, popSize / 2).map(s => s.t);
        while (pop.length < popSize) pop.push(JSON.parse(JSON.stringify(pop[Math.floor(Math.random() * pop.length / 2)])));
    }
    return pop[0];
}

async function run500() {
    console.log('================================================================================');
    console.log('🏆 Gemini vs 기존 알고리즘 - 500회 공정 비교');
    console.log('================================================================================');
    console.log('알고리즘: Gemini, MoreGA, MorePSO, SD_Limit_2');
    console.log('테스트: 500개 동일 케이스');
    console.log('================================================================================\n');

    const users = generateUsers(100);
    const testCases = [];
    for (let i = 0; i < 500; i++) {
        const sel = shuffle(users).slice(0, 15);
        testCases.push({ players: sel, constraints: generateConstraints(sel) });
    }
    console.log(`✅ 테스트 케이스 500개 생성\n`);

    const algos = [
        { id: 'Gemini', fn: Gemini },
        { id: 'MoreGA', fn: MoreGA },
        { id: 'MorePSO', fn: MorePSO },
        { id: 'SD_Limit', fn: SD_Limit_2 }
    ];

    const stats = {};
    algos.forEach(a => stats[a.id] = { sdSum: 0, violSum: 0, timeSum: 0, perfect: 0, wins: 0, sdList: [] });

    for (let i = 0; i < 500; i++) {
        const tc = testCases[i];
        const results = {};

        for (const algo of algos) {
            const start = Date.now();
            const teams = algo.fn(tc.players, 3);
            const time = (Date.now() - start) / 1000;
            const sd = calculateSD(teams);
            const viol = validateConstraints(teams, tc.constraints);

            results[algo.id] = { sd, viol, time };
            stats[algo.id].sdSum += sd;
            stats[algo.id].violSum += viol;
            stats[algo.id].timeSum += time;
            stats[algo.id].sdList.push(sd);
            if (sd < 0.01) stats[algo.id].perfect++;
        }

        // SD 승자 결정
        const minSD = Math.min(...algos.map(a => results[a.id].sd));
        algos.forEach(a => { if (results[a.id].sd === minSD) stats[a.id].wins++; });

        if ((i + 1) % 100 === 0) console.log(`  [${i + 1}/500] 완료`);
    }

    // 헤드투헤드
    const h2h = {};
    algos.forEach(a1 => {
        h2h[a1.id] = {};
        algos.forEach(a2 => {
            if (a1.id !== a2.id) {
                let wins = 0;
                for (let i = 0; i < 500; i++) {
                    if (stats[a1.id].sdList[i] < stats[a2.id].sdList[i]) wins++;
                }
                h2h[a1.id][a2.id] = wins;
            }
        });
    });

    console.log('\n================================================================================');
    console.log('📊 헤드투헤드 (SD 승리 횟수 / 500)');
    console.log('================================================================================\n');
    console.log('           | Gemini | MoreGA | MorePSO | SD_Limit');
    console.log('-'.repeat(60));
    algos.forEach(a1 => {
        const row = [a1.id.padEnd(10)];
        algos.forEach(a2 => row.push(a1.id === a2.id ? '  -   ' : ` ${h2h[a1.id][a2.id].toString().padStart(3)}   `));
        console.log(row.join('|'));
    });

    console.log('\n================================================================================');
    console.log('📊 최종 순위 (평균 SD)');
    console.log('================================================================================\n');

    const rankings = algos.map(a => ({
        id: a.id,
        avgSD: (stats[a.id].sdSum / 500).toFixed(3),
        minSD: Math.min(...stats[a.id].sdList).toFixed(3),
        maxSD: Math.max(...stats[a.id].sdList).toFixed(3),
        avgViol: (stats[a.id].violSum / 500).toFixed(2),
        avgTime: (stats[a.id].timeSum / 500).toFixed(4),
        perfect: stats[a.id].perfect,
        wins: stats[a.id].wins
    })).sort((a, b) => parseFloat(a.avgSD) - parseFloat(b.avgSD));

    console.log('순위 | 알고리즘  | 평균SD | 최소SD | 최대SD | 위반  | 완벽  | SD승리 | 시간');
    console.log('-'.repeat(85));
    rankings.forEach((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${medal}${i + 1}위 | ${r.id.padEnd(9)} | ${r.avgSD}  | ${r.minSD}  | ${r.maxSD}  | ${r.avgViol}  | ${r.perfect}%   | ${r.wins}회   | ${r.avgTime}s`);
    });

    console.log('\n================================================================================\n');

    fs.writeFileSync('./gemini_500_results.json', JSON.stringify({ rankings, h2h }, null, 2));
    console.log('✅ 결과 저장: gemini_500_results.json\n');
}

run500().catch(console.error);
