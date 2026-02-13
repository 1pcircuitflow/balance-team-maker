import { Player, Team, BalanceResult, SportType, Position, Tier, TeamConstraint } from '../types';
import { POSITIONS_BY_SPORT } from '../constants';

/**
 * Gemini 팀 밸런싱 알고리즘 (Enhanced)
 * 1단계: 제약조건(MATCH/SPLIT) 기반 그룹핑 및 전처리
 * 2단계: Modified Greedy 초기 배정 (실시간 밸런싱)
 * 3단계: 팀 내 포지션 최적화 (가중치 기반)
 * 4단계: 양방향 Swap 최적화 (SD & 포지션 만족도 동시 고려)
 */

// ========== 1. 헬퍼 함수 ==========

/** 팀 구성의 해시 생성 (팀별 선수 ID 정렬 후 결합) */
export const computeTeamHash = (teams: Team[]): string => {
    return teams
        .map(t => t.players.map(p => p.id).sort().join(','))
        .sort()
        .join('|');
};

export const shuffle = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

export const cloneTeams = (teams: Team[]): Team[] => {
    return teams.map(t => ({
        ...t,
        players: t.players.map(p => ({ ...p }))
    }));
};

// 포지션 점수 (가중치)
export const getPositionPoint = (player: Player, pos: Position): number => {
    if (pos === 'NONE') return 50;

    // Player 타입에 positions 구조가 없다면 기존 primary 등 활용
    const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
    const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
    const p3s = player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : []);

    // 1순위(선호): 100점
    if (p1s.includes(pos)) return 100;
    // 2순위(가능): 75점
    if (p2s.includes(pos)) return 75;
    // 3순위(괜찮음): 50점
    if (p3s.includes(pos)) return 50;

    // 그 외(불가능으로 간주하거나 4순위): -9999점 (Hard Constraint)
    // 앱 설정상 1/2/3순위 외에는 '불가능'으로 칠지, 아니면 그냥 점수 낮게 줄지 결정 필요.
    // 사용자 요청: "포지션 불가능은 배정되면 안돼" -> 절대 금지 (-9999)
    return -9999;
};

// 팀의 총 실력 계산 (포지션 페널티 제외, 순수 실력 합계)
// Gemini는 실력 합계를 기준으로 밸런싱하고, 포지션은 별도 점수로 최적화함
export const calculateTeamSkillReal = (team: Team): number => {
    return Number(team.players.reduce((sum, p) => sum + p.tier, 0).toFixed(1));
};

// ========== 2. 전처리 및 초기 배정 ==========

export function initialDistribute(
    players: Player[],
    teamCount: number,
    constraints: TeamConstraint[]
): { teams: Team[], constraintViolated: boolean } {
    let constraintViolated = false;
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));

    // 1. MATCH 그룹핑 및 전처리
    const activePlayers = [...players];
    const matchGroups: Player[][] = [];
    const processedIds = new Set<string>();

    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const group: Player[] = [];
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

    // 2. 셔플링 & 정렬 (다양성 + Greedy 준비)
    // 그룹과 개인을 합쳐서 하나의 배정 단위(Unit)로 관리
    type Unit = { players: Player[], totalSkill: number, isGroup: boolean };
    let units: Unit[] = [];

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

    // 셔플 후 내림차순 정렬 (고실력 Unit부터 배정)
    units = shuffle(units).sort((a, b) => b.totalSkill - a.totalSkill);

    // 3. Greedy 배정
    // SPLIT 제약 관리
    const splitMap = new Map<string, Set<string>>(); // playerId -> Set<partnerIds>
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        c.playerIds.forEach(id1 => {
            c.playerIds.forEach(id2 => {
                if (id1 !== id2) {
                    if (!splitMap.has(id1)) splitMap.set(id1, new Set());
                    splitMap.get(id1)!.add(id2);
                }
            });
        });
    });

    for (const unit of units) {
        // 들어갈 수 있는 팀 후보 찾기
        // 조건: 해당 팀에 SPLIT 관계인 선수가 없어야 함
        let possibleTeams: number[] = [];

        for (let i = 0; i < teamCount; i++) {
            let conflict = false;
            // Unit 내 모든 선수에 대해 SPLIT 체크
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

        // 가능한 팀 중 TotalSkill이 가장 낮은 팀 선택
        if (possibleTeams.length === 0) {
            // 모든 팀이 SPLIT 제약과 충돌 — 제약을 무시하고 강제 배정
            constraintViolated = true;
            possibleTeams = Array.from({ length: teamCount }, (_, k) => k);
        }

        possibleTeams.sort((a, b) => teams[a].totalSkill - teams[b].totalSkill);
        const targetIdx = possibleTeams[0];

        teams[targetIdx].players.push(...unit.players);
        teams[targetIdx].totalSkill += unit.totalSkill;
    }

    return { teams, constraintViolated };
}


// ========== 3. 팀 내 포지션 최적화 ==========

export function optimizeTeamPositions(
    team: Team,
    allPositions: Position[],
    customQuotas?: Partial<Record<Position, number | null>>
): void {
    const players = team.players;
    const positions = [...allPositions];
    if (positions.includes('NONE')) return; // 포지션 없는 종목은 패스

    // 쿼터 합계 == 팀 인원인 경우: 2단계 백트래킹 (최적 매칭 + 금지 허용 폴백)
    if (customQuotas) {
        const totalQuota = Object.entries(customQuotas)
            .reduce((sum, [_, q]) => sum + (typeof q === 'number' ? q : 0), 0);

        if (totalQuota === players.length && totalQuota > 0) {
            // 포지션 슬롯 생성: PG×1, SG×1, SF×1, PF×1, C×1 → ['PG','SG','SF','PF','C']
            const slots: Position[] = [];
            Object.entries(customQuotas).forEach(([pos, q]) => {
                if (typeof q === 'number') {
                    for (let i = 0; i < q; i++) slots.push(pos as Position);
                }
            });

            // Phase 1: 선호 포지션만으로 백트래킹 (금지 skip, 동적 MRV 선택)
            let bestAssignment: (Position | null)[] = new Array(players.length).fill(null);
            let bestScore = -Infinity;
            const totalSlots1 = slots.length;

            const backtrackPhase1 = (
                doneSlots: boolean[],
                playerUsed: boolean[],
                currentScore: number,
                assignment: Map<number, number>,
                doneCount: number
            ) => {
                if (doneCount === totalSlots1) {
                    if (currentScore > bestScore) {
                        bestScore = currentScore;
                        bestAssignment = new Array(players.length).fill(null);
                        assignment.forEach((sIdx, pIdx) => {
                            bestAssignment[pIdx] = slots[sIdx];
                        });
                    }
                    return;
                }

                // Dynamic MRV: pick unassigned slot with fewest eligible players
                let mrvSlot = -1, mrvCount = Infinity;
                for (let s = 0; s < totalSlots1; s++) {
                    if (doneSlots[s]) continue;
                    let count = 0;
                    for (let p = 0; p < players.length; p++) {
                        if (playerUsed[p]) continue;
                        if (getPositionPoint(players[p], slots[s]) > -5000) count++;
                    }
                    if (count < mrvCount) { mrvCount = count; mrvSlot = s; }
                }
                if (mrvSlot === -1) return;

                const remaining = (totalSlots1 - doneCount) * 100;
                if (currentScore + remaining <= bestScore) return;

                const sIdx = mrvSlot;
                for (let p = 0; p < players.length; p++) {
                    if (playerUsed[p]) continue;
                    const score = getPositionPoint(players[p], slots[sIdx]);
                    if (score <= -5000) continue; // 금지 포지션 skip

                    doneSlots[sIdx] = true;
                    playerUsed[p] = true;
                    assignment.set(p, sIdx);
                    backtrackPhase1(doneSlots, playerUsed, currentScore + score, assignment, doneCount + 1);
                    doneSlots[sIdx] = false;
                    playerUsed[p] = false;
                    assignment.delete(p);
                }
            };

            backtrackPhase1(
                new Array(slots.length).fill(false),
                new Array(players.length).fill(false),
                0,
                new Map(),
                0
            );

            // Phase 2: 미배정 선수가 있으면 금지 포지션도 허용 (점수 -100)
            const unassigned = players.map((_, i) => i).filter(i => bestAssignment[i] === null);

            if (unassigned.length > 0) {
                const usedSlotIndices = new Set<number>();
                bestAssignment.forEach((pos) => {
                    if (pos !== null) {
                        for (let s = 0; s < slots.length; s++) {
                            if (!usedSlotIndices.has(s) && slots[s] === pos) {
                                usedSlotIndices.add(s);
                                break;
                            }
                        }
                    }
                });

                const remainingSlots = slots.map((_, i) => i).filter(i => !usedSlotIndices.has(i));

                let bestPhase2: (Position | null)[] = [...bestAssignment];
                let bestPhase2Score = -Infinity;

                const backtrackPhase2 = (
                    uIdx: number,
                    rSlots: number[],
                    currentScore: number,
                    assignment: (Position | null)[]
                ) => {
                    if (uIdx === unassigned.length) {
                        if (currentScore > bestPhase2Score) {
                            bestPhase2Score = currentScore;
                            bestPhase2 = [...assignment];
                        }
                        return;
                    }

                    const pIdx = unassigned[uIdx];
                    for (let r = 0; r < rSlots.length; r++) {
                        const sIdx = rSlots[r];
                        let score = getPositionPoint(players[pIdx], slots[sIdx]);
                        if (score <= -5000) score = -100; // 금지 포지션 허용 (페널티)

                        const newRSlots = [...rSlots];
                        newRSlots.splice(r, 1);
                        assignment[pIdx] = slots[sIdx];
                        backtrackPhase2(uIdx + 1, newRSlots, currentScore + score, assignment);
                        assignment[pIdx] = null;
                    }
                };

                backtrackPhase2(0, remainingSlots, 0, [...bestAssignment]);
                bestAssignment = bestPhase2;
            }

            // 결과 적용
            players.forEach((p, i) => {
                p.assignedPosition = bestAssignment[i] || 'NONE';
            });
            return; // 완전 배정 완료, 이후 로직 skip
        }
    }

    // 필요한 포지션 슬롯 생성 (쿼터 합 != 팀 인원인 일반 케이스)

    type Assignment = { pIdx: number, pos: Position, score: number };
    let candidates: Assignment[] = [];

    // 농구/축구 등 종목별 쿼터가 있다면 그것을 목표 슬롯으로
    // 여기서는 기본 포지션 리스트를 순환하며 슬롯 생성한다고 가정 (단순화)
    // 혹은 선수별로 Best 포지션을 찾되, 겹치면 조정

    // 전략: 각 선수별 Best 포지션 우선 할당. 중복 시 차선책 점수가 높은 쪽 선택?
    // "가중치 최적화" 구현: 
    // 모든 순열을 돌기엔 너무 많음. 
    // Priority Queue 방식: 점수가 높은 (선수, 포지션) 쌍부터 확정.
    // 단, 각 포지션별 정원(Capacity)이 문제. 
    // 여기서는 정원을 "유동적"으로 둠 (한 포지션에 몰리지만 않으면 됨).
    // 하지만 "티어 불균형 해소"를 위해, **모든 선수의 만족도 합**이 최대가 되어야 함.

    // 간단하고 효과적인 방식:
    // 1. 모든 선수의 (선수, 포지션, 점수) 리스트 생성 (-9999 포지션 제외)
    // 2. 점수 높은 순 정렬
    // 3. 하나씩 배정하되, 한 포지션에 너무 많이(예: 인원의 40% 이상) 몰리면 Skip (쏠림 방지)

    const limitPerPos = Math.ceil(players.length / 3); // 대략적인 포지션별 최대 인원 (유동적)
    const assignedCount: Record<string, number> = {};
    const playerAssigned = new Set<string>();

    const options: Assignment[] = [];
    players.forEach((p, idx) => {
        allPositions.forEach(pos => {
            const score = getPositionPoint(p, pos);
            if (score > -5000) { // 불가능 아니면 후보
                options.push({ pIdx: idx, pos, score });
            }
        });
    });

    // 점수 내림차순, 같으면 티어 높은 순(우선권)
    options.sort((a, b) => b.score - a.score || players[b.pIdx].tier - players[a.pIdx].tier);

    // 1. 쿼터가 설정된 포지션 우선 배정 (절대 규칙)
    if (customQuotas) {
        Object.entries(customQuotas).forEach(([pos, quota]) => {
            if (typeof quota === 'number' && quota > 0) {
                let filled = 0;
                // 해당 포지션을 선호하는 선수들 중 점수 높은 순으로 채움
                const posOptions = options.filter(o => o.pos === pos && !playerAssigned.has(players[o.pIdx].id));
                for (const opt of posOptions) {
                    if (filled >= quota) break;
                    players[opt.pIdx].assignedPosition = opt.pos;
                    playerAssigned.add(players[opt.pIdx].id);
                    assignedCount[opt.pos] = (assignedCount[opt.pos] || 0) + 1;
                    filled++;
                }
            }
        });
    }

    // 2. 남은 선수들 일반 배정 (포지션 쏠림 방지 적용)
    options.forEach(opt => {
        if (playerAssigned.has(players[opt.pIdx].id)) return; // 이미 배정됨

        const currentCount = assignedCount[opt.pos] || 0;
        const maxForThisPos = (customQuotas && typeof customQuotas[opt.pos] === 'number')
            ? customQuotas[opt.pos] as number
            : limitPerPos;
        if (currentCount >= maxForThisPos) return; // 쿼터 설정된 포지션은 쿼터 상한 적용

        players[opt.pIdx].assignedPosition = opt.pos;
        playerAssigned.add(players[opt.pIdx].id);
        assignedCount[opt.pos] = currentCount + 1;
    });

    // 아직 배정 안 된 선수 (모든 포지션 불가능인 경우 등)
    players.forEach(p => {
        if (!playerAssigned.has(p.id)) {
            p.assignedPosition = 'NONE'; // 어쩔 수 없음
        }
    });
}


// ========== 4. Swap 최적화 ==========

export function optimizeTeams(
    teams: Team[],
    constraints: TeamConstraint[],
    allPositions: Position[],
    customQuotas?: Partial<Record<Position, number | null>>
): Team[] {
    let currentTeams = cloneTeams(teams);
    let bestTeams = cloneTeams(teams);

    // 초기 SD 계산
    const calcSD = (ts: Team[]) => {
        const skills = ts.map(t => calculateTeamSkillReal(t));
        const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
        const vari = skills.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / skills.length;
        return Math.sqrt(vari);
    };

    // 초기 포지션 점수 합 계산
    const calcPosScore = (ts: Team[]) => {
        let sum = 0;
        ts.forEach(t => t.players.forEach(p => {
            sum += getPositionPoint(p, p.assignedPosition || 'NONE');
        }));
        return sum;
    };

    // 금지 포지션 배정 수 계산
    const countForbidden = (ts: Team[]) => {
        let count = 0;
        ts.forEach(t => t.players.forEach(p => {
            if (getPositionPoint(p, p.assignedPosition || 'NONE') <= -5000) count++;
        }));
        return count;
    };

    let minSD = calcSD(currentTeams);
    let maxPosScore = calcPosScore(currentTeams);
    let minForbidden = countForbidden(currentTeams);

    // Swap 반복 (Simulated Annealing 비슷하게)
    const iterations = 200;
    let noImprovementCount = 0;

    // MATCH/SPLIT 맵핑
    const matchMap = new Map<string, string>(); // id -> groupId
    constraints.filter(c => c.type === 'MATCH').forEach((c, idx) => {
        c.playerIds.forEach(pid => matchMap.set(pid, `match_${idx}`));
    });

    const splitMap = new Map<string, Set<string>>();
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        c.playerIds.forEach(id1 => {
            c.playerIds.forEach(id2 => {
                if (id1 !== id2) {
                    if (!splitMap.has(id1)) splitMap.set(id1, new Set());
                    splitMap.get(id1)!.add(id2);
                }
            });
        });
    });

    for (let k = 0; k < iterations; k++) {
        if (noImprovementCount > 60) break; // 조기 종료

        // 1. 임의의 두 팀 선택
        const t1Idx = Math.floor(Math.random() * currentTeams.length);
        let t2Idx = Math.floor(Math.random() * currentTeams.length);
        while (t1Idx === t2Idx) t2Idx = Math.floor(Math.random() * currentTeams.length);

        if (currentTeams[t1Idx].players.length === 0 || currentTeams[t2Idx].players.length === 0) continue;

        // 2. 임의의 선수(또는 MATCH 그룹) 선택
        const p1 = currentTeams[t1Idx].players[Math.floor(Math.random() * currentTeams[t1Idx].players.length)];
        const p2 = currentTeams[t2Idx].players[Math.floor(Math.random() * currentTeams[t2Idx].players.length)];

        // 3. 교환 유효성 검사 (Constraint Check)
        // 3-1. MATCH 그룹 통째로 이동해야 함
        // 현재 로직 단순화를 위해: "선택된 선수가 MATCH 그룹에 속해있으면, 그 그룹 전체와 상대방(혹은 그룹)을 교환"
        // 구현 복잡도를 줄이기 위해, "MATCH 그룹에 속하지 않은 단독 선수"끼리의 교환만 우선 시도하거나,
        // MATCH 그룹인 경우 파트너들을 다 찾아서 같이 옮겨야 함.

        // 여기서는 "단독 선수"이거나 "그룹 전체 이동"을 처리
        const p1Group = matchMap.has(p1.id)
            ? currentTeams[t1Idx].players.filter(p => matchMap.get(p.id) === matchMap.get(p1.id))
            : [p1];
        const p2Group = matchMap.has(p2.id)
            ? currentTeams[t2Idx].players.filter(p => matchMap.get(p.id) === matchMap.get(p2.id))
            : [p2];

        // 3-1b. 그룹 크기가 다르면 팀 크기가 변경되므로 무조건 거부
        if (p1Group.length !== p2Group.length) continue;

        // 3-2. SPLIT 체크
        // t1에 p2Group이 왔을 때 SPLIT 위반? / t2에 p1Group이 갔을 때 SPLIT 위반?
        let conflict = false;
        // Check p2Group -> t1
        for (const p of p2Group) {
            const enemies = splitMap.get(p.id);
            if (enemies) {
                // t1의 기존 멤버(p1Group 제외) 중 적이 있는가?
                if (currentTeams[t1Idx].players.some(existing =>
                    !p1Group.map(x => x.id).includes(existing.id) && enemies.has(existing.id)
                )) { conflict = true; break; }
            }
        }
        if (conflict) continue;

        // Check p1Group -> t2
        for (const p of p1Group) {
            const enemies = splitMap.get(p.id);
            if (enemies) {
                if (currentTeams[t2Idx].players.some(existing =>
                    !p2Group.map(x => x.id).includes(existing.id) && enemies.has(existing.id)
                )) { conflict = true; break; }
            }
        }
        if (conflict) continue;

        // 4. 가상 교환 실행 (in-place swap on currentTeams, revert if rejected)
        const p1Ids = new Set(p1Group.map(x => x.id));
        const p2Ids = new Set(p2Group.map(x => x.id));

        // 교환 전 상태 보존 (영향받는 두 팀만)
        const savedT1Players = currentTeams[t1Idx].players.map(p => ({ ...p }));
        const savedT2Players = currentTeams[t2Idx].players.map(p => ({ ...p }));
        const savedT1Skill = currentTeams[t1Idx].totalSkill;
        const savedT2Skill = currentTeams[t2Idx].totalSkill;

        // Remove from source, add to target
        currentTeams[t1Idx].players = currentTeams[t1Idx].players.filter(p => !p1Ids.has(p.id));
        currentTeams[t2Idx].players = currentTeams[t2Idx].players.filter(p => !p2Ids.has(p.id));
        currentTeams[t1Idx].players.push(...p2Group.map(p => ({ ...p })));
        currentTeams[t2Idx].players.push(...p1Group.map(p => ({ ...p })));

        // Update skill
        currentTeams[t1Idx].totalSkill = calculateTeamSkillReal(currentTeams[t1Idx]);
        currentTeams[t2Idx].totalSkill = calculateTeamSkillReal(currentTeams[t2Idx]);

        // 5. 포지션 재최적화 (이동했으니 포지션 다시 맞춰야 함)
        optimizeTeamPositions(currentTeams[t1Idx], allPositions, customQuotas);
        optimizeTeamPositions(currentTeams[t2Idx], allPositions, customQuotas);

        // 6. 평가 (Cost Function) — 금지 배정 수 감소 우선, SD/포지션 점수 기준 적용
        const newSD = calcSD(currentTeams);
        const newPosScore = calcPosScore(currentTeams);
        const newForbidden = countForbidden(currentTeams);

        let accept = false;

        // 금지 포지션 배정이 줄어들면 무조건 수락
        if (newForbidden < minForbidden) {
            accept = true;
        } else if (newForbidden === minForbidden) {
            // 금지 배정 수 동일 시 기존 SD/posScore 기준 적용
            if (newSD < minSD - 0.05) {
                accept = true; // 밸런스 유의미한 개선
            } else if (Math.abs(newSD - minSD) < 0.1 && newPosScore > maxPosScore) {
                accept = true; // 밸런스 유지 & 포지션 개선
            }
        }

        // Swap 수락 시 쿼터 위반 검증: 위반이 증가하면 거부
        if (accept && customQuotas) {
            const countViolations = (teamPlayers: Player[]): number => {
                let v = 0;
                Object.entries(customQuotas).forEach(([pos, quota]) => {
                    if (typeof quota === 'number') {
                        const actual = teamPlayers.filter(p => p.assignedPosition === pos).length;
                        if (actual !== quota) v++;
                    }
                });
                return v;
            };

            const newViolations = countViolations(currentTeams[t1Idx].players) + countViolations(currentTeams[t2Idx].players);
            if (newViolations > 0) {
                const oldViolations = countViolations(savedT1Players) + countViolations(savedT2Players);
                if (newViolations > oldViolations) {
                    accept = false;
                }
            }
        }

        if (accept) {
            minSD = newSD;
            maxPosScore = newPosScore;
            minForbidden = newForbidden;
            bestTeams = cloneTeams(currentTeams);
            noImprovementCount = 0;
        } else {
            // 교환 기각 — 원래 상태로 복원
            currentTeams[t1Idx].players = savedT1Players;
            currentTeams[t2Idx].players = savedT2Players;
            currentTeams[t1Idx].totalSkill = savedT1Skill;
            currentTeams[t2Idx].totalSkill = savedT2Skill;
            noImprovementCount++;
        }
    }

    return bestTeams;
}


// ========== 5. 통합 비용함수 (새 알고리즘 공유 인프라) ==========

export function computeUnifiedCost(
    teamAssignment: number[],
    posAssignment: Position[],
    players: Player[],
    teamCount: number,
    quotas: Partial<Record<Position, number | null>> | undefined,
    constraints: TeamConstraint[],
    allPositions: Position[]
): number {
    const w_forbidden = 1000;
    const w_constraint = 500;
    const w_quota = 200;
    const w_sd = 80;
    const w_pos = 40;

    // 1. Forbidden count
    let forbiddenCount = 0;
    for (let i = 0; i < players.length; i++) {
        if (getPositionPoint(players[i], posAssignment[i]) <= -5000) forbiddenCount++;
    }

    // 2. Constraint violations
    let constraintViolations = 0;
    for (const c of constraints) {
        const teamIndices = c.playerIds
            .map(id => players.findIndex(p => p.id === id))
            .filter(idx => idx >= 0)
            .map(idx => teamAssignment[idx]);
        if (teamIndices.length < 2) continue;
        if (c.type === 'MATCH') {
            const first = teamIndices[0];
            for (let k = 1; k < teamIndices.length; k++) {
                if (teamIndices[k] !== first) constraintViolations++;
            }
        } else {
            // SPLIT: any two on same team = violation
            for (let a = 0; a < teamIndices.length; a++) {
                for (let b = a + 1; b < teamIndices.length; b++) {
                    if (teamIndices[a] === teamIndices[b]) constraintViolations++;
                }
            }
        }
    }

    // 3. Quota deviation
    let quotaDeviation = 0;
    if (quotas) {
        for (let t = 0; t < teamCount; t++) {
            for (const [pos, quota] of Object.entries(quotas)) {
                if (typeof quota !== 'number') continue;
                let actual = 0;
                for (let i = 0; i < players.length; i++) {
                    if (teamAssignment[i] === t && posAssignment[i] === pos) actual++;
                }
                quotaDeviation += Math.abs(actual - quota);
            }
        }
    }

    // 4. Skill SD (normalized)
    const teamSkills = new Array(teamCount).fill(0);
    for (let i = 0; i < players.length; i++) {
        teamSkills[teamAssignment[i]] += players[i].tier;
    }
    const avg = teamSkills.reduce((a: number, b: number) => a + b, 0) / teamCount;
    const variance = teamSkills.reduce((s: number, v: number) => s + (v - avg) ** 2, 0) / teamCount;
    const normalizedSD = Math.sqrt(variance);

    // 5. Position dissatisfaction
    let totalPosScore = 0;
    let posCount = 0;
    for (let i = 0; i < players.length; i++) {
        const score = getPositionPoint(players[i], posAssignment[i]);
        if (score > -5000) {
            totalPosScore += score;
            posCount++;
        }
    }
    const avgPosSatisfaction = posCount > 0 ? totalPosScore / posCount : 0;

    return w_forbidden * forbiddenCount
        + w_constraint * constraintViolations
        + w_quota * quotaDeviation
        + w_sd * normalizedSD
        + w_pos * (1 - avgPosSatisfaction / 100);
}

// ========== 6. 포지션 인식 초기화 (새 알고리즘 공유) ==========

/** 팀 내 선수들에 대해 백트래킹으로 최적 포지션 배정 */
export function backtrackPositions(
    players: Player[],
    allPositions: Position[],
    quotas: Partial<Record<Position, number | null>> | undefined
): Position[] {
    if (allPositions.includes('NONE') || players.length === 0) {
        return players.map(() => 'NONE' as Position);
    }

    // Build slots from quotas — now handles partial quotas too
    // Partial quota: quota slots + FREE slots for remaining players
    if (quotas) {
        const totalQuota = Object.entries(quotas)
            .reduce((sum, [_, q]) => sum + (typeof q === 'number' ? q : 0), 0);

        if (totalQuota > 0 && totalQuota <= players.length) {
            const slots: Position[] = [];
            for (const [pos, q] of Object.entries(quotas)) {
                if (typeof q === 'number') {
                    for (let i = 0; i < q; i++) slots.push(pos as Position);
                }
            }

            // For partial quotas, add FREE slots for remaining players
            // FREE slots = any non-quota position the player can play
            const isPartial = totalQuota < players.length;
            const freeCount = players.length - totalQuota;

            if (isPartial) {
                // Mark quota positions for FREE slot scoring
                const quotaPositions = new Set(Object.keys(quotas).filter(p => typeof quotas[p as Position] === 'number'));

                // Backtracking with dynamic MRV: assign quota slots first,
                // then assign best available non-quota position to remaining players
                const totalQuotaSlots = slots.length;

                let bestAssignment = new Array<Position>(players.length).fill('NONE' as Position);
                let bestScore = -Infinity;

                const bt = (doneSlots: boolean[], playerUsed: boolean[], score: number, assignment: Map<number, number>, doneCount: number) => {
                    if (doneCount === totalQuotaSlots) {
                        // All quota slots processed — now assign FREE positions to remaining players
                        let freeScore = 0;
                        const freeAssignment = new Map<number, Position>();
                        const freeAssignedCount: Record<string, number> = {};

                        // Count already-assigned quota positions
                        assignment.forEach((sIdx, pIdx) => {
                            const pos = slots[sIdx];
                            freeAssignedCount[pos] = (freeAssignedCount[pos] || 0) + 1;
                        });

                        // Collect unassigned players and their best non-quota positions
                        const unassigned: { pIdx: number; pos: Position; score: number }[] = [];
                        for (let p = 0; p < players.length; p++) {
                            if (playerUsed[p]) continue;
                            for (const pos of allPositions) {
                                const s = getPositionPoint(players[p], pos);
                                if (s <= -5000) continue;
                                // Prefer non-quota positions; quota positions only up to their limit
                                if (quotaPositions.has(pos)) {
                                    const quotaVal = quotas[pos as Position] as number;
                                    if ((freeAssignedCount[pos] || 0) >= quotaVal) continue;
                                }
                                unassigned.push({ pIdx: p, pos, score: s });
                            }
                        }
                        unassigned.sort((a, b) => b.score - a.score);

                        const freeUsed = new Set<number>();
                        for (const opt of unassigned) {
                            if (freeUsed.has(opt.pIdx)) continue;
                            const count = freeAssignedCount[opt.pos] || 0;
                            const max = quotaPositions.has(opt.pos)
                                ? (quotas[opt.pos as Position] as number)
                                : Math.ceil(players.length / 3);
                            if (count >= max) continue;
                            freeAssignment.set(opt.pIdx, opt.pos);
                            freeUsed.add(opt.pIdx);
                            freeAssignedCount[opt.pos] = count + 1;
                            freeScore += opt.score;
                        }

                        // Any still unassigned? Give them best available
                        for (let p = 0; p < players.length; p++) {
                            if (playerUsed[p] || freeUsed.has(p)) continue;
                            let bestPos: Position = allPositions[0];
                            let bestS = -Infinity;
                            for (const pos of allPositions) {
                                const s = getPositionPoint(players[p], pos);
                                if (s > bestS) { bestS = s; bestPos = pos; }
                            }
                            freeAssignment.set(p, bestPos);
                            freeScore += bestS > -5000 ? bestS : -100;
                        }

                        const totalScore = score + freeScore;
                        if (totalScore > bestScore) {
                            bestScore = totalScore;
                            bestAssignment = new Array<Position>(players.length).fill('NONE' as Position);
                            assignment.forEach((sIdx, pIdx) => { bestAssignment[pIdx] = slots[sIdx]; });
                            freeAssignment.forEach((pos, pIdx) => { bestAssignment[pIdx] = pos; });
                        }
                        return;
                    }

                    // Dynamic MRV: pick unprocessed slot with fewest eligible players
                    let mrvSlot = -1, mrvCount = Infinity;
                    for (let s = 0; s < totalQuotaSlots; s++) {
                        if (doneSlots[s]) continue;
                        let count = 0;
                        for (let p = 0; p < players.length; p++) {
                            if (playerUsed[p]) continue;
                            if (getPositionPoint(players[p], slots[s]) > -5000) count++;
                        }
                        if (count < mrvCount) { mrvCount = count; mrvSlot = s; }
                    }
                    if (mrvSlot === -1) return;

                    const remaining = (totalQuotaSlots - doneCount) * 100;
                    if (score + remaining + freeCount * 100 <= bestScore) return;

                    const sIdx = mrvSlot;

                    // Option: skip this quota slot (no valid candidate → quota violation, not forbidden)
                    doneSlots[sIdx] = true;
                    bt(doneSlots, playerUsed, score - 50, assignment, doneCount + 1);
                    doneSlots[sIdx] = false;

                    for (let p = 0; p < players.length; p++) {
                        if (playerUsed[p]) continue;
                        const s = getPositionPoint(players[p], slots[sIdx]);
                        if (s <= -5000) continue; // skip forbidden — never force forbidden assignment
                        doneSlots[sIdx] = true;
                        playerUsed[p] = true;
                        assignment.set(p, sIdx);
                        bt(doneSlots, playerUsed, score + s, assignment, doneCount + 1);
                        doneSlots[sIdx] = false;
                        playerUsed[p] = false;
                        assignment.delete(p);
                    }
                };

                bt(new Array(slots.length).fill(false), new Array(players.length).fill(false), 0, new Map(), 0);
                return bestAssignment;
            }

            // Full quota (totalQuota === players.length): exact slot backtracking with dynamic MRV
            const totalFullSlots = slots.length;

            let bestAssignment = new Array<Position>(players.length).fill('NONE' as Position);
            let bestScore = -Infinity;

            const bt = (doneSlots: boolean[], playerUsed: boolean[], score: number, assignment: Map<number, number>, doneCount: number, allowForbidden: boolean) => {
                if (doneCount === totalFullSlots) {
                    if (score > bestScore) {
                        bestScore = score;
                        bestAssignment = new Array<Position>(players.length).fill('NONE' as Position);
                        assignment.forEach((sIdx, pIdx) => { bestAssignment[pIdx] = slots[sIdx]; });
                    }
                    return;
                }

                // Dynamic MRV: pick unassigned slot with fewest eligible players
                let mrvSlot = -1, mrvCount = Infinity;
                for (let s = 0; s < totalFullSlots; s++) {
                    if (doneSlots[s]) continue;
                    let count = 0;
                    for (let p = 0; p < players.length; p++) {
                        if (playerUsed[p]) continue;
                        const sc = getPositionPoint(players[p], slots[s]);
                        if (allowForbidden || sc > -5000) count++;
                    }
                    if (count < mrvCount) { mrvCount = count; mrvSlot = s; }
                }
                if (mrvSlot === -1) return;

                const remaining = (totalFullSlots - doneCount) * 100;
                if (score + remaining <= bestScore) return;

                const sIdx = mrvSlot;
                for (let p = 0; p < players.length; p++) {
                    if (playerUsed[p]) continue;
                    let s = getPositionPoint(players[p], slots[sIdx]);
                    if (s <= -5000) {
                        if (!allowForbidden) continue;
                        s = -100; // fallback: allow forbidden with penalty
                    }
                    doneSlots[sIdx] = true;
                    playerUsed[p] = true;
                    assignment.set(p, sIdx);
                    bt(doneSlots, playerUsed, score + s, assignment, doneCount + 1, allowForbidden);
                    doneSlots[sIdx] = false;
                    playerUsed[p] = false;
                    assignment.delete(p);
                }
            };

            // Phase 1: no forbidden
            bt(new Array(slots.length).fill(false), new Array(players.length).fill(false), 0, new Map(), 0, false);

            // Phase 2: if incomplete, allow forbidden as fallback
            if (bestAssignment.some(p => p === ('NONE' as Position))) {
                bt(new Array(slots.length).fill(false), new Array(players.length).fill(false), 0, new Map(), 0, true);
            }

            return bestAssignment;
        }
    }

    // No quotas at all — greedy best-position assignment
    const result = new Array<Position>(players.length).fill('NONE' as Position);
    const assigned = new Set<number>();
    const options: { pIdx: number; pos: Position; score: number }[] = [];
    players.forEach((p, idx) => {
        allPositions.forEach(pos => {
            const score = getPositionPoint(p, pos);
            if (score > -5000) options.push({ pIdx: idx, pos, score });
        });
    });
    options.sort((a, b) => b.score - a.score);
    const limitPerPos = Math.ceil(players.length / 3);
    const assignedCount: Record<string, number> = {};
    for (const opt of options) {
        if (assigned.has(opt.pIdx)) continue;
        const count = assignedCount[opt.pos] || 0;
        if (count >= limitPerPos) continue;
        result[opt.pIdx] = opt.pos;
        assigned.add(opt.pIdx);
        assignedCount[opt.pos] = count + 1;
    }
    return result;
}

export function positionAwareInit(
    players: Player[],
    teamCount: number,
    constraints: TeamConstraint[],
    quotas: Partial<Record<Position, number | null>> | undefined,
    allPositions: Position[]
): { teamAssignment: number[], posAssignment: Position[] } {
    const n = players.length;
    const teamAssignment = new Array<number>(n).fill(0);
    const posAssignment = new Array<Position>(n).fill('NONE' as Position);

    if (allPositions.includes('NONE') || n === 0) {
        // Use basic greedy for GENERAL sport
        const { teams } = initialDistribute(players, teamCount, constraints);
        for (let t = 0; t < teams.length; t++) {
            for (const p of teams[t].players) {
                const idx = players.findIndex(pl => pl.id === p.id);
                if (idx >= 0) { teamAssignment[idx] = t; posAssignment[idx] = 'NONE' as Position; }
            }
        }
        return { teamAssignment, posAssignment };
    }

    // 1. Process MATCH groups
    const processedIds = new Set<string>();
    const matchGroups: number[][] = []; // indices into players array
    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const group: number[] = [];
        c.playerIds.forEach(id => {
            const idx = players.findIndex(p => p.id === id);
            if (idx >= 0 && !processedIds.has(id)) {
                group.push(idx);
                processedIds.add(id);
            }
        });
        if (group.length > 0) matchGroups.push(group);
    });

    // Build SPLIT map
    const splitMap = new Map<string, Set<string>>();
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        c.playerIds.forEach(id1 => {
            c.playerIds.forEach(id2 => {
                if (id1 !== id2) {
                    if (!splitMap.has(id1)) splitMap.set(id1, new Set());
                    splitMap.get(id1)!.add(id2);
                }
            });
        });
    });

    // 2. Rarity-based sorting: players who can fill rare quota positions first
    const individualIndices = players.map((_, i) => i).filter(i => !processedIds.has(players[i].id));

    // Compute position rarity (how many players can play each position)
    const posRarity: Record<string, number> = {};
    if (quotas) {
        for (const [pos, q] of Object.entries(quotas)) {
            if (typeof q !== 'number') continue;
            let candidates = 0;
            for (const p of players) {
                if (getPositionPoint(p, pos as Position) > -5000) candidates++;
            }
            posRarity[pos] = candidates;
        }
    }

    // Sort individuals: those who fill rare positions first, then by tier descending
    individualIndices.sort((a, b) => {
        // Player's rarest playable quota position
        const rarestA = Object.keys(posRarity).filter(pos => getPositionPoint(players[a], pos as Position) > -5000)
            .reduce((min, pos) => Math.min(min, posRarity[pos] || 999), 999);
        const rarestB = Object.keys(posRarity).filter(pos => getPositionPoint(players[b], pos as Position) > -5000)
            .reduce((min, pos) => Math.min(min, posRarity[pos] || 999), 999);
        if (rarestA !== rarestB) return rarestA - rarestB; // rarer first
        return players[b].tier - players[a].tier; // then by tier
    });

    // 3. Assign match groups first
    const teamSkills = new Array(teamCount).fill(0);
    const teamMembers: number[][] = Array.from({ length: teamCount }, () => []);

    type Unit = { indices: number[], totalSkill: number };
    const units: Unit[] = [];

    for (const group of matchGroups) {
        units.push({ indices: group, totalSkill: group.reduce((s, i) => s + players[i].tier, 0) });
    }
    for (const idx of individualIndices) {
        units.push({ indices: [idx], totalSkill: players[idx].tier });
    }

    // Greedy assign considering SPLIT + skill balance + quota need
    for (const unit of units) {
        let bestTeam = 0;
        let bestScore = -Infinity;

        for (let t = 0; t < teamCount; t++) {
            // Check SPLIT
            let conflict = false;
            for (const idx of unit.indices) {
                const enemies = splitMap.get(players[idx].id);
                if (enemies && teamMembers[t].some(m => enemies.has(players[m].id))) {
                    conflict = true; break;
                }
            }
            if (conflict) continue;

            // Score: prefer team with lower skill (balance)
            const skillScore = -(teamSkills[t] + unit.totalSkill);

            // Quota need: does this team need positions this player can fill?
            let quotaNeedScore = 0;
            if (quotas) {
                const currentTeamPos: Record<string, number> = {};
                for (const m of teamMembers[t]) {
                    // We don't have positions yet, but we can estimate
                }
                // Simple: count unfilled quota positions this unit can cover
                for (const idx of unit.indices) {
                    for (const [pos, q] of Object.entries(quotas)) {
                        if (typeof q !== 'number') continue;
                        if (getPositionPoint(players[idx], pos as Position) > -5000) {
                            quotaNeedScore += 1;
                        }
                    }
                }
            }

            const score = skillScore * 10 + quotaNeedScore;
            if (score > bestScore) {
                bestScore = score;
                bestTeam = t;
            }
        }

        for (const idx of unit.indices) {
            teamAssignment[idx] = bestTeam;
            teamMembers[bestTeam].push(idx);
        }
        teamSkills[bestTeam] += unit.totalSkill;
    }

    // 4. Assign positions per team via backtracking
    for (let t = 0; t < teamCount; t++) {
        const memberIndices = teamMembers[t];
        const teamPlayers = memberIndices.map(i => players[i]);
        const positions = backtrackPositions(teamPlayers, allPositions, quotas);
        for (let j = 0; j < memberIndices.length; j++) {
            posAssignment[memberIndices[j]] = positions[j];
        }
    }

    return { teamAssignment, posAssignment };
}

// ========== 7. Variant E: Simulated Annealing ==========

export function generateTeamsSA(
    players: Player[],
    teamCount: number,
    quotas: Partial<Record<Position, number | null>> | undefined,
    constraints: TeamConstraint[],
    allPositions: Position[]
): { teamAssignment: number[], posAssignment: Position[] } {
    const n = players.length;
    if (n === 0) return { teamAssignment: [], posAssignment: [] };

    // Build MATCH group map
    const matchGroupOf = new Array<number>(n).fill(-1);
    let groupId = 0;
    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const gid = groupId++;
        c.playerIds.forEach(id => {
            const idx = players.findIndex(p => p.id === id);
            if (idx >= 0) matchGroupOf[idx] = gid;
        });
    });

    // Initial state from position-aware init
    let { teamAssignment, posAssignment } = positionAwareInit(players, teamCount, constraints, quotas, allPositions);
    let currentCost = computeUnifiedCost(teamAssignment, posAssignment, players, teamCount, quotas, constraints, allPositions);

    let bestTA = [...teamAssignment];
    let bestPA = [...posAssignment];
    let bestCost = currentCost;

    // Temperature schedule
    let T = 50;
    const alpha = 0.995;
    const maxIter = 2000;
    let noImproveCount = 0;

    // Helper: get team members
    const getTeamMembers = (ta: number[], team: number): number[] => {
        const members: number[] = [];
        for (let i = 0; i < n; i++) if (ta[i] === team) members.push(i);
        return members;
    };

    // Helper: reoptimize positions for specific teams
    const reoptimizeTeams = (ta: number[], pa: Position[], teams: number[]) => {
        for (const t of teams) {
            const members = getTeamMembers(ta, t);
            const teamPlayers = members.map(i => players[i]);
            const newPos = backtrackPositions(teamPlayers, allPositions, quotas);
            for (let j = 0; j < members.length; j++) {
                pa[members[j]] = newPos[j];
            }
        }
    };

    for (let iter = 0; iter < maxIter; iter++) {
        // Reheat if stuck
        if (noImproveCount > 200) {
            T = T * 3;
            noImproveCount = 0;
        }

        const newTA = [...teamAssignment];
        const newPA = [...posAssignment];
        const affectedTeams = new Set<number>();
        const rand = Math.random();

        if (rand < 0.60) {
            // Move type 1: Swap two players between teams (60%)
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1) t2 = Math.floor(Math.random() * teamCount);
            const m1 = getTeamMembers(newTA, t1);
            const m2 = getTeamMembers(newTA, t2);
            if (m1.length === 0 || m2.length === 0) { T *= alpha; continue; }

            let p1 = m1[Math.floor(Math.random() * m1.length)];
            let p2 = m2[Math.floor(Math.random() * m2.length)];

            // If MATCH group, move entire group
            const g1 = matchGroupOf[p1];
            const g2 = matchGroupOf[p2];
            const group1 = g1 >= 0 ? m1.filter(i => matchGroupOf[i] === g1) : [p1];
            const group2 = g2 >= 0 ? m2.filter(i => matchGroupOf[i] === g2) : [p2];

            if (group1.length !== group2.length) { T *= alpha; continue; }

            for (const i of group1) newTA[i] = t2;
            for (const i of group2) newTA[i] = t1;
            affectedTeams.add(t1);
            affectedTeams.add(t2);

        } else if (rand < 0.75) {
            // Move type 2: Move one player to another team (15%)
            const pi = Math.floor(Math.random() * n);
            const oldTeam = newTA[pi];
            let newTeam = Math.floor(Math.random() * teamCount);
            while (newTeam === oldTeam) newTeam = Math.floor(Math.random() * teamCount);

            const g = matchGroupOf[pi];
            const group = g >= 0 ? players.map((_, i) => i).filter(i => matchGroupOf[i] === g && newTA[i] === oldTeam) : [pi];

            for (const i of group) newTA[i] = newTeam;
            affectedTeams.add(oldTeam);
            affectedTeams.add(newTeam);

        } else if (rand < 0.90) {
            // Move type 3: Change position within team (15%)
            const pi = Math.floor(Math.random() * n);
            const validPositions = allPositions.filter(pos => pos !== 'NONE');
            if (validPositions.length === 0) { T *= alpha; continue; }
            const newPos = validPositions[Math.floor(Math.random() * validPositions.length)];
            newPA[pi] = newPos;
            // Don't reoptimize — just change this one position

        } else {
            // Move type 4: 3-player cyclic swap (10%)
            if (teamCount < 3) {
                // Fall back to 2-team swap
                const t1 = 0;
                const t2 = 1;
                const m1 = getTeamMembers(newTA, t1);
                const m2 = getTeamMembers(newTA, t2);
                if (m1.length === 0 || m2.length === 0) { T *= alpha; continue; }
                const p1 = m1[Math.floor(Math.random() * m1.length)];
                const p2 = m2[Math.floor(Math.random() * m2.length)];
                if (matchGroupOf[p1] >= 0 || matchGroupOf[p2] >= 0) { T *= alpha; continue; }
                newTA[p1] = t2;
                newTA[p2] = t1;
                affectedTeams.add(t1);
                affectedTeams.add(t2);
            } else {
                // Pick 3 different teams
                const teamPerm = shuffle(Array.from({ length: teamCount }, (_, i) => i)).slice(0, 3);
                const [tA, tB, tC] = teamPerm;
                const mA = getTeamMembers(newTA, tA);
                const mB = getTeamMembers(newTA, tB);
                const mC = getTeamMembers(newTA, tC);
                if (mA.length === 0 || mB.length === 0 || mC.length === 0) { T *= alpha; continue; }

                const pA = mA[Math.floor(Math.random() * mA.length)];
                const pB = mB[Math.floor(Math.random() * mB.length)];
                const pC = mC[Math.floor(Math.random() * mC.length)];

                // Skip if any are in MATCH groups (complex to handle)
                if (matchGroupOf[pA] >= 0 || matchGroupOf[pB] >= 0 || matchGroupOf[pC] >= 0) { T *= alpha; continue; }

                // A→B, B→C, C→A
                newTA[pA] = tB;
                newTA[pB] = tC;
                newTA[pC] = tA;
                affectedTeams.add(tA);
                affectedTeams.add(tB);
                affectedTeams.add(tC);
            }
        }

        // Reoptimize positions for affected teams
        if (affectedTeams.size > 0) {
            reoptimizeTeams(newTA, newPA, Array.from(affectedTeams));
        }

        const newCost = computeUnifiedCost(newTA, newPA, players, teamCount, quotas, constraints, allPositions);
        const delta = newCost - currentCost;

        // Accept or reject
        if (delta < 0 || Math.random() < Math.exp(-delta / T)) {
            teamAssignment = newTA;
            posAssignment = newPA;
            currentCost = newCost;

            if (currentCost < bestCost) {
                bestCost = currentCost;
                bestTA = [...teamAssignment];
                bestPA = [...posAssignment];
                noImproveCount = 0;
            } else {
                noImproveCount++;
            }
        } else {
            noImproveCount++;
        }

        T *= alpha;
    }

    return { teamAssignment: bestTA, posAssignment: bestPA };
}

// ========== 8. Variant F: Constraint-First Partition + Hungarian ==========

/** Hungarian algorithm for minimum cost assignment */
function hungarian(costMatrix: number[][]): { assignment: number[], totalCost: number } {
    const n = costMatrix.length;
    if (n === 0) return { assignment: [], totalCost: 0 };
    const m = costMatrix[0].length;

    // Pad to square matrix
    const size = Math.max(n, m);
    const C: number[][] = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (i < n && j < m) ? costMatrix[i][j] : 0)
    );

    const u = new Array(size + 1).fill(0);
    const v = new Array(size + 1).fill(0);
    const p = new Array(size + 1).fill(0);
    const way = new Array(size + 1).fill(0);

    for (let i = 1; i <= size; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Array(size + 1).fill(Infinity);
        const used = new Array(size + 1).fill(false);

        do {
            used[j0] = true;
            let i0 = p[j0], delta = Infinity, j1 = 0;
            for (let j = 1; j <= size; j++) {
                if (used[j]) continue;
                const cur = C[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) {
                    minv[j] = cur;
                    way[j] = j0;
                }
                if (minv[j] < delta) {
                    delta = minv[j];
                    j1 = j;
                }
            }

            for (let j = 0; j <= size; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }
            j0 = j1;
        } while (p[j0] !== 0);

        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0 !== 0);
    }

    const assignment = new Array(n).fill(-1);
    let totalCost = 0;
    for (let j = 1; j <= size; j++) {
        if (p[j] > 0 && p[j] <= n && j <= m) {
            assignment[p[j] - 1] = j - 1;
            totalCost += costMatrix[p[j] - 1][j - 1];
        }
    }

    return { assignment, totalCost };
}

export function generateTeamsCFH(
    players: Player[],
    teamCount: number,
    quotas: Partial<Record<Position, number | null>> | undefined,
    constraints: TeamConstraint[],
    allPositions: Position[]
): { teamAssignment: number[], posAssignment: Position[] } {
    const n = players.length;
    if (n === 0) return { teamAssignment: [], posAssignment: [] };

    const baseTeamSize = Math.floor(n / teamCount);
    const extraCount = n % teamCount;
    const teamSizes = Array.from({ length: teamCount }, (_, i) => baseTeamSize + (i < extraCount ? 1 : 0));

    // Build MATCH/SPLIT maps
    const matchGroups: number[][] = [];
    const processedIds = new Set<string>();
    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const group: number[] = [];
        c.playerIds.forEach(id => {
            const idx = players.findIndex(p => p.id === id);
            if (idx >= 0 && !processedIds.has(id)) { group.push(idx); processedIds.add(id); }
        });
        if (group.length > 0) matchGroups.push(group);
    });

    const splitPairs: [number, number][] = [];
    constraints.filter(c => c.type === 'SPLIT').forEach(c => {
        const ids = c.playerIds.map(id => players.findIndex(p => p.id === id)).filter(i => i >= 0);
        for (let a = 0; a < ids.length; a++) {
            for (let b = a + 1; b < ids.length; b++) {
                splitPairs.push([ids[a], ids[b]]);
            }
        }
    });

    // Build quota slots per team
    const buildSlots = (teamPlayerCount: number): Position[] => {
        if (!quotas || allPositions.includes('NONE')) return [];
        const slots: Position[] = [];
        for (const [pos, q] of Object.entries(quotas)) {
            if (typeof q === 'number') {
                for (let i = 0; i < q; i++) slots.push(pos as Position);
            }
        }
        // Fill remaining with FREE slots
        while (slots.length < teamPlayerCount) slots.push('NONE' as Position);
        return slots;
    };

    // Assign positions for a team using Hungarian
    const assignPositionsHungarian = (memberIndices: number[]): Position[] => {
        const teamPlayers = memberIndices.map(i => players[i]);
        if (allPositions.includes('NONE')) return teamPlayers.map(() => 'NONE' as Position);

        const slots = buildSlots(teamPlayers.length);
        if (slots.length === 0) {
            return backtrackPositions(teamPlayers, allPositions, quotas);
        }

        // Build cost matrix: player × slot
        // Cap forbidden positions to -100 instead of -9999 to allow viable assignments
        const costMatrix = teamPlayers.map(p => {
            return slots.map(slot => {
                if (slot === 'NONE') return -50; // FREE slot: neutral
                const score = getPositionPoint(p, slot);
                const effectiveScore = score <= -5000 ? -100 : score;
                return -effectiveScore; // negate because Hungarian minimizes
            });
        });

        const { assignment } = hungarian(costMatrix);
        const result = assignment.map((slotIdx, i) => {
            if (slotIdx >= 0 && slotIdx < slots.length && slots[slotIdx] !== 'NONE') {
                // Check if this is a forbidden assignment — if so, find best playable position
                const assignedPos = slots[slotIdx];
                if (getPositionPoint(teamPlayers[i], assignedPos) <= -5000) {
                    // Forbidden — find best non-forbidden position
                    let best: Position = assignedPos;
                    let bestScore = -Infinity;
                    for (const pos of allPositions) {
                        const s = getPositionPoint(teamPlayers[i], pos);
                        if (s > bestScore) { bestScore = s; best = pos; }
                    }
                    return best;
                }
                return assignedPos;
            }
            // FREE slot: find best position for this player
            let best: Position = allPositions[0];
            let bestScore = -Infinity;
            for (const pos of allPositions) {
                const s = getPositionPoint(teamPlayers[i], pos);
                if (s > bestScore) { bestScore = s; best = pos; }
            }
            return best;
        });

        return result;
    };

    // Phase 1: Enumerate valid partitions via backtracking
    const individualIndices = players.map((_, i) => i).filter(i => !processedIds.has(players[i].id));

    // Sort by tier descending for better pruning
    const sortedIndices = [...individualIndices].sort((a, b) => players[b].tier - players[a].tier);

    interface Partition {
        teamMembers: number[][];
        score: number;
    }

    const candidates: Partition[] = [];
    const MAX_CANDIDATES = 20;
    const MAX_SEARCH = 5000;
    let searchCount = 0;

    // First, place match groups
    const initialTeamMembers: number[][] = Array.from({ length: teamCount }, () => []);
    const initialTeamSkills = new Array(teamCount).fill(0);

    // Greedy place match groups in teams with lowest skill
    const sortedMatchGroups = [...matchGroups].sort((a, b) =>
        b.reduce((s, i) => s + players[i].tier, 0) - a.reduce((s, i) => s + players[i].tier, 0)
    );

    for (const group of sortedMatchGroups) {
        const groupSkill = group.reduce((s, i) => s + players[i].tier, 0);
        let bestTeam = 0;
        let minSkill = Infinity;
        for (let t = 0; t < teamCount; t++) {
            if (initialTeamSkills[t] < minSkill) {
                // Check SPLIT
                let ok = true;
                for (const gi of group) {
                    for (const mi of initialTeamMembers[t]) {
                        if (splitPairs.some(([a, b]) => (a === gi && b === mi) || (a === mi && b === gi))) {
                            ok = false; break;
                        }
                    }
                    if (!ok) break;
                }
                if (ok) { minSkill = initialTeamSkills[t]; bestTeam = t; }
            }
        }
        for (const i of group) initialTeamMembers[bestTeam].push(i);
        initialTeamSkills[bestTeam] += groupSkill;
    }

    // Backtrack over remaining individuals
    const btPartition = (idx: number, teamMembers: number[][], teamSkills: number[]) => {
        if (searchCount >= MAX_SEARCH) return;
        if (idx === sortedIndices.length) {
            // Validate team sizes
            let valid = true;
            for (let t = 0; t < teamCount; t++) {
                if (teamMembers[t].length !== teamSizes[t]) { valid = false; break; }
            }
            if (!valid) return;

            const skillArr = teamSkills.slice();
            const avg = skillArr.reduce((a, b) => a + b, 0) / teamCount;
            const sd = Math.sqrt(skillArr.reduce((s, v) => s + (v - avg) ** 2, 0) / teamCount);
            const score = -sd; // higher is better (lower SD)

            if (candidates.length < MAX_CANDIDATES || score > candidates[candidates.length - 1].score) {
                candidates.push({ teamMembers: teamMembers.map(t => [...t]), score });
                candidates.sort((a, b) => b.score - a.score);
                if (candidates.length > MAX_CANDIDATES) candidates.pop();
            }
            searchCount++;
            return;
        }

        const pi = sortedIndices[idx];
        for (let t = 0; t < teamCount; t++) {
            if (teamMembers[t].length >= teamSizes[t]) continue;

            // Check SPLIT constraint
            let conflict = false;
            for (const mi of teamMembers[t]) {
                if (splitPairs.some(([a, b]) => (a === pi && b === mi) || (a === mi && b === pi))) {
                    conflict = true; break;
                }
            }
            if (conflict) continue;

            teamMembers[t].push(pi);
            teamSkills[t] += players[pi].tier;
            btPartition(idx + 1, teamMembers, teamSkills);
            teamMembers[t].pop();
            teamSkills[t] -= players[pi].tier;

            if (searchCount >= MAX_SEARCH) return;
        }
    };

    btPartition(0, initialTeamMembers.map(t => [...t]), [...initialTeamSkills]);

    // If no candidates found, use greedy init as fallback
    if (candidates.length === 0) {
        return positionAwareInit(players, teamCount, constraints, quotas, allPositions);
    }

    // Phase 2: For each candidate, assign positions via Hungarian and compute cost
    let bestTA = new Array<number>(n).fill(0);
    let bestPA = new Array<Position>(n).fill('NONE' as Position);
    let bestCost = Infinity;

    for (const cand of candidates) {
        const ta = new Array<number>(n).fill(0);
        const pa = new Array<Position>(n).fill('NONE' as Position);

        for (let t = 0; t < teamCount; t++) {
            for (const i of cand.teamMembers[t]) ta[i] = t;
        }

        // Assign positions per team via Hungarian
        for (let t = 0; t < teamCount; t++) {
            const positions = assignPositionsHungarian(cand.teamMembers[t]);
            for (let j = 0; j < cand.teamMembers[t].length; j++) {
                pa[cand.teamMembers[t][j]] = positions[j];
            }
        }

        const cost = computeUnifiedCost(ta, pa, players, teamCount, quotas, constraints, allPositions);
        if (cost < bestCost) {
            bestCost = cost;
            bestTA = ta;
            bestPA = pa;
        }
    }

    // Phase 3: Deterministic fine-tuning — swap same-position players to reduce SD
    for (let iter = 0; iter < 100; iter++) {
        let improved = false;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (bestTA[i] === bestTA[j]) continue;
                if (bestPA[i] !== bestPA[j]) continue; // same position only

                // Try swap
                const newTA = [...bestTA];
                [newTA[i], newTA[j]] = [newTA[j], newTA[i]];
                const newCost = computeUnifiedCost(newTA, bestPA, players, teamCount, quotas, constraints, allPositions);
                if (newCost < bestCost) {
                    bestTA = newTA;
                    bestCost = newCost;
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }

    return { teamAssignment: bestTA, posAssignment: bestPA };
}

// ========== 9. Variant G: Genetic Algorithm ==========

export function generateTeamsGA(
    players: Player[],
    teamCount: number,
    quotas: Partial<Record<Position, number | null>> | undefined,
    constraints: TeamConstraint[],
    allPositions: Position[]
): { teamAssignment: number[], posAssignment: Position[] } {
    const n = players.length;
    if (n === 0) return { teamAssignment: [], posAssignment: [] };

    const POPULATION = 60;
    const GENERATIONS = 100;
    const ELITE_COUNT = 3;
    const MUTATION_RATE = 0.15;
    const STAGNATION_LIMIT = 15;

    // Build MATCH group map
    const matchGroupOf = new Array<number>(n).fill(-1);
    let groupId = 0;
    const matchGroupMembers: Map<number, number[]> = new Map();
    constraints.filter(c => c.type === 'MATCH').forEach(c => {
        const gid = groupId++;
        const members: number[] = [];
        c.playerIds.forEach(id => {
            const idx = players.findIndex(p => p.id === id);
            if (idx >= 0) { matchGroupOf[idx] = gid; members.push(idx); }
        });
        if (members.length > 0) matchGroupMembers.set(gid, members);
    });

    // Team size targets
    const baseSize = Math.floor(n / teamCount);
    const extraCount = n % teamCount;

    type Individual = {
        genes: number[];  // genes[i] = team index for player i
        fitness: number;
        posAssignment: Position[];
    };

    // Decode: assign positions via backtracking
    const decode = (genes: number[]): Position[] => {
        const pa = new Array<Position>(n).fill('NONE' as Position);
        for (let t = 0; t < teamCount; t++) {
            const members = genes.map((g, i) => g === t ? i : -1).filter(i => i >= 0);
            const teamPlayers = members.map(i => players[i]);
            const positions = backtrackPositions(teamPlayers, allPositions, quotas);
            for (let j = 0; j < members.length; j++) {
                pa[members[j]] = positions[j];
            }
        }
        return pa;
    };

    // Evaluate fitness (lower cost = higher fitness)
    const evaluate = (genes: number[], pa: Position[]): number => {
        return -computeUnifiedCost(genes, pa, players, teamCount, quotas, constraints, allPositions);
    };

    // Repair MATCH/SPLIT violations
    const repair = (genes: number[]) => {
        // Repair MATCH: move all group members to the team of the first member
        for (const [gid, members] of matchGroupMembers) {
            const team = genes[members[0]];
            for (const m of members) genes[m] = team;
        }

        // Balance team sizes: move excess players to smaller teams
        for (let iter = 0; iter < 20; iter++) {
            const sizes = new Array(teamCount).fill(0);
            for (const g of genes) sizes[g]++;

            const sortedTeams = Array.from({ length: teamCount }, (_, i) => i).sort((a, b) => sizes[a] - sizes[b]);
            const targetSizes = [...sortedTeams].map((_, i) => baseSize + (i < extraCount ? 0 : 0));

            // Simple: compute actual targets
            const targets = new Array(teamCount).fill(baseSize);
            for (let i = 0; i < extraCount; i++) targets[i] = baseSize + 1;
            targets.sort((a, b) => a - b);

            let balanced = true;
            const actualSizes = new Array(teamCount).fill(0);
            for (const g of genes) actualSizes[g]++;
            const sortedActual = actualSizes.slice().sort((a, b) => a - b);
            const sortedTargets = targets.slice().sort((a, b) => a - b);
            for (let i = 0; i < teamCount; i++) {
                if (sortedActual[i] !== sortedTargets[i]) { balanced = false; break; }
            }
            if (balanced) break;

            // Find oversized team and move a player to smallest
            let maxTeam = 0, minTeam = 0;
            for (let t = 1; t < teamCount; t++) {
                if (actualSizes[t] > actualSizes[maxTeam]) maxTeam = t;
                if (actualSizes[t] < actualSizes[minTeam]) minTeam = t;
            }
            if (maxTeam === minTeam) break;

            // Move a random non-MATCH player from maxTeam to minTeam
            const candidates = genes.map((g, i) => g === maxTeam && matchGroupOf[i] < 0 ? i : -1).filter(i => i >= 0);
            if (candidates.length === 0) break;
            genes[candidates[Math.floor(Math.random() * candidates.length)]] = minTeam;
        }
    };

    // Initialize population
    const population: Individual[] = [];

    // Seed with position-aware init
    const { teamAssignment: seedTA, posAssignment: seedPA } = positionAwareInit(players, teamCount, constraints, quotas, allPositions);
    population.push({ genes: [...seedTA], fitness: evaluate(seedTA, seedPA), posAssignment: seedPA });

    // Rest: random initialization
    for (let i = 1; i < POPULATION; i++) {
        const genes = new Array(n).fill(0);
        for (let j = 0; j < n; j++) genes[j] = Math.floor(Math.random() * teamCount);
        repair(genes);
        const pa = decode(genes);
        population.push({ genes, fitness: evaluate(genes, pa), posAssignment: pa });
    }

    let bestIndividual = population.reduce((a, b) => a.fitness > b.fitness ? a : b);
    let stagnation = 0;

    for (let gen = 0; gen < GENERATIONS; gen++) {
        if (stagnation >= STAGNATION_LIMIT) break;

        // Sort by fitness (higher is better)
        population.sort((a, b) => b.fitness - a.fitness);

        const newPop: Individual[] = [];

        // Elitism
        for (let i = 0; i < ELITE_COUNT; i++) {
            newPop.push({ ...population[i], genes: [...population[i].genes], posAssignment: [...population[i].posAssignment] });
        }

        // Generate offspring
        while (newPop.length < POPULATION) {
            // Tournament selection (size 3)
            const select = (): Individual => {
                const candidates = shuffle(population.slice()).slice(0, 3);
                return candidates.reduce((a, b) => a.fitness > b.fitness ? a : b);
            };

            const parent1 = select();
            const parent2 = select();

            // Uniform crossover
            const childGenes = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                childGenes[i] = Math.random() < 0.5 ? parent1.genes[i] : parent2.genes[i];
            }

            // Mutation
            if (Math.random() < MUTATION_RATE) {
                const mutType = Math.random();
                if (mutType < 0.50) {
                    // Swap mutation: exchange two players' teams
                    const a = Math.floor(Math.random() * n);
                    let b = Math.floor(Math.random() * n);
                    while (b === a) b = Math.floor(Math.random() * n);
                    [childGenes[a], childGenes[b]] = [childGenes[b], childGenes[a]];
                } else if (mutType < 0.80) {
                    // Move mutation: move a player to random team
                    const a = Math.floor(Math.random() * n);
                    childGenes[a] = Math.floor(Math.random() * teamCount);
                } else {
                    // 3-way cyclic mutation
                    if (teamCount >= 3) {
                        const teams = shuffle(Array.from({ length: teamCount }, (_, i) => i)).slice(0, 3);
                        const pFromT = (t: number) => {
                            const cands = childGenes.map((g, i) => g === t ? i : -1).filter(i => i >= 0);
                            return cands.length > 0 ? cands[Math.floor(Math.random() * cands.length)] : -1;
                        };
                        const p0 = pFromT(teams[0]);
                        const p1 = pFromT(teams[1]);
                        const p2 = pFromT(teams[2]);
                        if (p0 >= 0 && p1 >= 0 && p2 >= 0) {
                            childGenes[p0] = teams[1];
                            childGenes[p1] = teams[2];
                            childGenes[p2] = teams[0];
                        }
                    }
                }
            }

            repair(childGenes);
            const pa = decode(childGenes);
            const fitness = evaluate(childGenes, pa);
            newPop.push({ genes: childGenes, fitness, posAssignment: pa });
        }

        // Replace population
        population.length = 0;
        population.push(...newPop);

        const genBest = population.reduce((a, b) => a.fitness > b.fitness ? a : b);
        if (genBest.fitness > bestIndividual.fitness) {
            bestIndividual = { ...genBest, genes: [...genBest.genes], posAssignment: [...genBest.posAssignment] };
            stagnation = 0;
        } else {
            stagnation++;
        }
    }

    return { teamAssignment: bestIndividual.genes, posAssignment: bestIndividual.posAssignment };
}

// ========== 메인 함수 ==========

export const generateBalancedTeams = (
    players: Player[],
    teamCount: number,
    customQuotas?: Partial<Record<Position, number | null>>,
    constraints: TeamConstraint[] = [],
    ignoreTier: boolean = false,
    previousHashes: string[] = [],
    sportType?: SportType // 명시적 스포츠 타입 추가
): BalanceResult => {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0) return { teams: [], standardDeviation: 0, maxDiff: 0, imbalanceScore: 0, isValid: true, isConstraintViolated: false, isQuotaViolated: false };

    // sportType 매개변수가 있으면 그것을 우선 사용, 없으면 첫 번째 플레이어 데이터에서 유추
    const sport = sportType || (activePlayers.length > 0 ? activePlayers[0].sportType : SportType.GENERAL);
    const allPositions: Position[] = POSITIONS_BY_SPORT[sport] || ['NONE'];

    // 중복 결과 방지를 위해 최대 MAX_RETRY_COUNT 회 재시도
    const MAX_RETRY_COUNT = 5;
    let bestResult: BalanceResult | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
        // GA (Genetic Algorithm) 기반 팀 밸런싱
        const { teamAssignment, posAssignment } = generateTeamsGA(
            activePlayers, teamCount, customQuotas, constraints, allPositions
        );

        // Team 객체 구성
        const optimizedTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${String.fromCharCode(65 + i)}`,
            players: [],
            totalSkill: 0,
        }));

        for (let i = 0; i < activePlayers.length; i++) {
            const p = { ...activePlayers[i], assignedPosition: posAssignment[i] };
            optimizedTeams[teamAssignment[i]].players.push(p);
        }
        optimizedTeams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));

        // 제약 위반 체크
        let constraintViolated = false;
        for (const c of constraints) {
            const teamIndices = c.playerIds
                .map(id => activePlayers.findIndex(p => p.id === id))
                .filter(idx => idx >= 0)
                .map(idx => teamAssignment[idx]);
            if (teamIndices.length < 2) continue;
            if (c.type === 'MATCH') {
                if (teamIndices.some(t => t !== teamIndices[0])) { constraintViolated = true; break; }
            } else {
                const unique = new Set(teamIndices);
                if (unique.size < teamIndices.length) { constraintViolated = true; break; }
            }
        }

        // 해시 계산 및 중복 체크
        const hash = computeTeamHash(optimizedTeams);
        if (previousHashes.includes(hash) && attempt < MAX_RETRY_COUNT - 1) {
            continue; // 이전과 동일한 결과 — 재시도
        }

        // 최종 결과 계산
        const totalSkills = optimizedTeams.map(t => calculateTeamSkillReal(t));
        const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teamCount;
        const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teamCount;
        const standardDeviation = Number(Math.sqrt(variance).toFixed(2));
        const maxDiff = Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1));

        // 최종 쿼터 위반 체크
        let isQuotaViolated = false;
        if (customQuotas) {
            Object.entries(customQuotas).forEach(([pos, quota]) => {
                if (typeof quota === 'number') {
                    optimizedTeams.forEach(t => {
                        const actual = t.players.filter(p => p.assignedPosition === pos).length;
                        if (actual !== quota) isQuotaViolated = true;
                    });
                }
            });
        }

        bestResult = {
            teams: optimizedTeams,
            standardDeviation,
            maxDiff,
            hash,
            imbalanceScore: standardDeviation,
            isValid: !isQuotaViolated,
            isConstraintViolated: constraintViolated,
            isQuotaViolated
        };
        break;
    }

    // MAX_RETRY_COUNT회 모두 중복이면 마지막 결과 반환
    if (!bestResult) {
        const { teamAssignment, posAssignment } = generateTeamsGA(
            activePlayers, teamCount, customQuotas, constraints, allPositions
        );
        const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1, name: `Team ${String.fromCharCode(65 + i)}`, players: [], totalSkill: 0,
        }));
        for (let i = 0; i < activePlayers.length; i++) {
            teams[teamAssignment[i]].players.push({ ...activePlayers[i], assignedPosition: posAssignment[i] });
        }
        teams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));
        const totalSkills = teams.map(t => calculateTeamSkillReal(t));
        const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teamCount;
        const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teamCount;
        bestResult = {
            teams,
            standardDeviation: Number(Math.sqrt(variance).toFixed(2)),
            maxDiff: Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1)),
            hash: computeTeamHash(teams),
            imbalanceScore: Number(Math.sqrt(variance).toFixed(2)),
            isValid: true,
            isConstraintViolated: false,
            isQuotaViolated: false
        };
    }

    return bestResult;
};
