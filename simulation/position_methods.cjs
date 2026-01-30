// 포지션 배정 방식 4가지 비교 시뮬레이션
// 1. 포지션 우선 배정 후 같은 포지션 내 Swap
// 2. 포지션 만족도 가중치 최적화
// 3. 헝가리안 알고리즘 (최적 매칭)
// 4. 티어 역순 배정

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

// 포지션 점수 계산
function getPositionScore(player, pos) {
    if (!player.positions) return 50;
    const { preferred, possible, okay, forbidden } = player.positions;
    if (preferred?.includes(pos)) return 100;
    if (possible?.includes(pos)) return 75;
    if (okay?.includes(pos)) return 50;
    if (forbidden?.includes(pos)) return 0;
    return 50;
}

// 포지션 만족도 계산
function calcPositionSatisfaction(teams) {
    let total = 0, count = 0;
    teams.forEach(team => {
        team.players.forEach(p => {
            if (p.assignedPos) {
                total += getPositionScore(p, p.assignedPos);
                count++;
            }
        });
    });
    return count > 0 ? total / count : 0;
}

// 농구 선수 15명 생성
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
            const shuffledPos = shuffle([...positions]);
            p.push({
                id: `B${id}`,
                skill: +skill.toFixed(1),
                tier: t.tier,
                positions: {
                    preferred: [shuffledPos[0]],
                    possible: [shuffledPos[1]],
                    okay: [shuffledPos[2]],
                    forbidden: [shuffledPos[3], shuffledPos[4]]
                }
            });
            id++;
        }
    }
    return shuffle(p);
}

//=============================================================================
// 방식 1: 포지션 우선 배정 → 같은 포지션 내 Swap
//=============================================================================
function Method1_PositionFirst(players, teamCount) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));

    // 포지션별로 선수 그룹화 (선호도 기준 최적 배정)
    const assigned = new Set();

    for (const pos of positions) {
        // 이 포지션을 선호하는 선수들 (아직 배정 안 된)
        const candidates = players
            .filter(p => !assigned.has(p.id))
            .map(p => ({ player: p, score: getPositionScore(p, pos) }))
            .sort((a, b) => b.score - a.score);

        // 각 팀에 1명씩 배정
        for (let t = 0; t < teamCount; t++) {
            if (candidates.length > 0) {
                const { player } = candidates.shift();
                player.assignedPos = pos;
                teams[t].players.push({ ...player });
                teams[t].totalSkill += player.skill;
                assigned.add(player.id);
            }
        }
    }

    // 같은 포지션 내에서만 Swap (SD 최적화)
    let improved = true, iter = 50;
    while (improved && iter-- > 0) {
        improved = false;
        for (const pos of positions) {
            for (let t1 = 0; t1 < teamCount; t1++) {
                for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                    const p1 = teams[t1].players.find(p => p.assignedPos === pos);
                    const p2 = teams[t2].players.find(p => p.assignedPos === pos);
                    if (!p1 || !p2) continue;

                    const curDiff = Math.abs(teams[t1].totalSkill - teams[t2].totalSkill);
                    const newS1 = teams[t1].totalSkill - p1.skill + p2.skill;
                    const newS2 = teams[t2].totalSkill - p2.skill + p1.skill;
                    const newDiff = Math.abs(newS1 - newS2);

                    if (newDiff < curDiff - 0.1) {
                        const idx1 = teams[t1].players.indexOf(p1);
                        const idx2 = teams[t2].players.indexOf(p2);
                        teams[t1].players[idx1] = { ...p2, assignedPos: pos };
                        teams[t2].players[idx2] = { ...p1, assignedPos: pos };
                        teams[t1].totalSkill = newS1;
                        teams[t2].totalSkill = newS2;
                        improved = true;
                    }
                }
            }
        }
    }
    return teams;
}

//=============================================================================
// 방식 2: 포지션 만족도 가중치 최적화
//=============================================================================
function Method2_WeightedOptimization(players, teamCount) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));

    // 초기 배정 (Greedy)
    const sorted = shuffle([...players]).sort((a, b) => b.skill - a.skill);
    sorted.forEach((p, idx) => {
        const tIdx = idx % teamCount;
        teams[tIdx].players.push({ ...p });
        teams[tIdx].totalSkill += p.skill;
    });

    // 포지션 배정 + 최적화
    teams.forEach(team => {
        // 헝가리안 스타일: 각 선수-포지션 조합의 점수 계산
        const n = team.players.length;
        const usedPos = new Set();
        const usedPlayer = new Set();

        // 가장 높은 점수 조합부터 배정
        for (let round = 0; round < n; round++) {
            let bestScore = -1, bestP = -1, bestPos = '';
            for (let i = 0; i < n; i++) {
                if (usedPlayer.has(i)) continue;
                for (const pos of positions) {
                    if (usedPos.has(pos)) continue;
                    const score = getPositionScore(team.players[i], pos);
                    if (score > bestScore) {
                        bestScore = score;
                        bestP = i;
                        bestPos = pos;
                    }
                }
            }
            if (bestP >= 0) {
                team.players[bestP].assignedPos = bestPos;
                usedPos.add(bestPos);
                usedPlayer.add(bestP);
            }
        }
    });

    // Swap 시 포지션 만족도 패널티 고려
    let improved = true, iter = 50;
    while (improved && iter-- > 0) {
        improved = false;
        for (let t1 = 0; t1 < teamCount; t1++) {
            for (let t2 = t1 + 1; t2 < teamCount; t2++) {
                for (let i = 0; i < teams[t1].players.length; i++) {
                    for (let j = 0; j < teams[t2].players.length; j++) {
                        const p1 = teams[t1].players[i];
                        const p2 = teams[t2].players[j];

                        // 현재 SD + 포지션 패널티
                        const curSD = calcSD(teams);
                        const curSat = getPositionScore(p1, p1.assignedPos) + getPositionScore(p2, p2.assignedPos);

                        // 교환 후
                        [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
                        teams[t1].totalSkill = teams[t1].players.reduce((s, p) => s + p.skill, 0);
                        teams[t2].totalSkill = teams[t2].players.reduce((s, p) => s + p.skill, 0);
                        const newSD = calcSD(teams);
                        const newSat = getPositionScore(p2, p1.assignedPos) + getPositionScore(p1, p2.assignedPos);

                        // SD 개선 + 포지션 만족도 유지/개선이면 교환 유지
                        if (newSD < curSD - 0.05 && newSat >= curSat - 10) {
                            // 포지션 교환
                            const tempPos = teams[t1].players[i].assignedPos;
                            teams[t1].players[i].assignedPos = teams[t2].players[j].assignedPos;
                            teams[t2].players[j].assignedPos = tempPos;
                            improved = true;
                        } else {
                            // 롤백
                            [teams[t1].players[i], teams[t2].players[j]] = [teams[t2].players[j], teams[t1].players[i]];
                            teams[t1].totalSkill = teams[t1].players.reduce((s, p) => s + p.skill, 0);
                            teams[t2].totalSkill = teams[t2].players.reduce((s, p) => s + p.skill, 0);
                        }
                    }
                }
            }
        }
    }
    return teams;
}

//=============================================================================
// 방식 3: 헝가리안 알고리즘 (최적 매칭)
//=============================================================================
function Method3_Hungarian(players, teamCount) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));

    // 전체 선수-슬롯 매칭 (슬롯 = 팀 × 포지션)
    const slots = [];
    for (let t = 0; t < teamCount; t++) {
        for (const pos of positions) {
            slots.push({ team: t, pos });
        }
    }

    // 그리디 헝가리안 근사: 가장 높은 점수 조합부터 배정
    const playerList = shuffle([...players]);
    const usedSlots = new Set();
    const usedPlayers = new Set();

    // 모든 (선수, 슬롯) 조합의 점수 계산
    const combinations = [];
    for (let p = 0; p < playerList.length; p++) {
        for (let s = 0; s < slots.length; s++) {
            const score = getPositionScore(playerList[p], slots[s].pos);
            combinations.push({ p, s, score });
        }
    }
    combinations.sort((a, b) => b.score - a.score);

    // 높은 점수부터 배정
    for (const { p, s, score } of combinations) {
        if (usedPlayers.has(p) || usedSlots.has(s)) continue;

        const player = { ...playerList[p], assignedPos: slots[s].pos };
        teams[slots[s].team].players.push(player);
        teams[slots[s].team].totalSkill += player.skill;
        usedPlayers.add(p);
        usedSlots.add(s);

        if (usedPlayers.size === playerList.length) break;
    }

    return teams;
}

//=============================================================================
// 방식 4: 티어 역순 배정 (저티어 먼저)
//=============================================================================
function Method4_ReverseTier(players, teamCount) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
    const teams = Array.from({ length: teamCount }, () => ({ players: [], totalSkill: 0 }));

    // 티어 역순 정렬 (D → C → B → A → S)
    const tierOrder = { 'D': 0, 'C': 1, 'B': 2, 'A': 3, 'S': 4 };
    const sorted = [...players].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    // 저티어부터 선호 포지션 배정
    const usedSlots = {}; // { teamIdx: Set<pos> }
    for (let t = 0; t < teamCount; t++) usedSlots[t] = new Set();

    for (const player of sorted) {
        let bestTeam = -1, bestPos = '', bestScore = -1;

        for (let t = 0; t < teamCount; t++) {
            for (const pos of positions) {
                if (usedSlots[t].has(pos)) continue;
                const score = getPositionScore(player, pos);
                if (score > bestScore) {
                    bestScore = score;
                    bestTeam = t;
                    bestPos = pos;
                }
            }
        }

        if (bestTeam >= 0) {
            player.assignedPos = bestPos;
            teams[bestTeam].players.push({ ...player });
            teams[bestTeam].totalSkill += player.skill;
            usedSlots[bestTeam].add(bestPos);
        }
    }

    return teams;
}

//=============================================================================
// 기본 Gemini (비교용)
//=============================================================================
function BaselineGemini(players, teamCount) {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
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

    // 순서대로 포지션 배정
    teams.forEach(team => {
        team.players.forEach((p, idx) => {
            p.assignedPos = positions[idx % 5];
        });
    });

    return teams;
}

//=============================================================================
// 실행
//=============================================================================
async function run() {
    const methods = [
        { id: 'Baseline', name: 'Gemini 기본', fn: BaselineGemini },
        { id: 'M1_PosFirst', name: '포지션 우선+Swap', fn: Method1_PositionFirst },
        { id: 'M2_Weighted', name: '가중치 최적화', fn: Method2_WeightedOptimization },
        { id: 'M3_Hungarian', name: '헝가리안 알고리즘', fn: Method3_Hungarian },
        { id: 'M4_Reverse', name: '티어 역순 배정', fn: Method4_ReverseTier }
    ];

    console.log('================================================================================');
    console.log('🏀 포지션 배정 방식 비교 (농구 15명 → 3팀, 500회)');
    console.log('================================================================================\n');

    const stats = {};
    methods.forEach(m => stats[m.id] = { sdSum: 0, satSum: 0, wins: 0 });

    for (let run = 0; run < 500; run++) {
        const players = genBasketball();
        const results = {};

        for (const method of methods) {
            const teams = method.fn(JSON.parse(JSON.stringify(players)), 3);
            const sd = calcSD(teams);
            const sat = calcPositionSatisfaction(teams);

            results[method.id] = { sd, sat };
            stats[method.id].sdSum += sd;
            stats[method.id].satSum += sat;
        }

        // SD 승자
        const minSD = Math.min(...methods.map(m => results[m.id].sd));
        methods.forEach(m => { if (results[m.id].sd === minSD) stats[m.id].wins++; });

        if ((run + 1) % 100 === 0) console.log(`  [${run + 1}/500] 완료`);
    }

    console.log('\n================================================================================');
    console.log('📊 결과');
    console.log('================================================================================\n');

    const rankings = methods.map(m => ({
        id: m.id,
        name: m.name,
        avgSD: (stats[m.id].sdSum / 500).toFixed(3),
        avgSat: (stats[m.id].satSum / 500).toFixed(1),
        wins: stats[m.id].wins
    }));

    // 종합 점수 (SD 낮을수록 좋음, 만족도 높을수록 좋음)
    rankings.forEach(r => {
        r.composite = (100 - parseFloat(r.avgSD) * 20) + parseFloat(r.avgSat) * 0.5;
    });
    rankings.sort((a, b) => b.composite - a.composite);

    console.log('순위 | 방식               | 평균SD | 포지션만족 | SD승리 | 종합점수');
    console.log('-'.repeat(75));
    rankings.forEach((r, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${m}${i + 1}위 | ${r.name.padEnd(16)} | ${r.avgSD}  | ${r.avgSat}%    | ${r.wins}회   | ${r.composite.toFixed(1)}`);
    });

    console.log('\n================================================================================');
    console.log('💡 분석');
    console.log('================================================================================\n');

    const bestSD = rankings.reduce((a, b) => parseFloat(a.avgSD) < parseFloat(b.avgSD) ? a : b);
    const bestSat = rankings.reduce((a, b) => parseFloat(a.avgSat) > parseFloat(b.avgSat) ? a : b);

    console.log(`📌 SD 최저 (팀 밸런스 최고): ${bestSD.name} (${bestSD.avgSD})`);
    console.log(`📌 포지션 만족도 최고: ${bestSat.name} (${bestSat.avgSat}%)`);
    console.log(`📌 종합 1위: ${rankings[0].name}\n`);

    fs.writeFileSync('./position_method_results.json', JSON.stringify(rankings, null, 2));
    console.log('✅ 결과 저장: position_method_results.json\n');
}

run().catch(console.error);
