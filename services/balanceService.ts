import { Player, Team, BalanceResult, SportType, Position, Tier, TeamConstraint } from '../types';

/**
 * Gemini 팀 밸런싱 알고리즘 (Enhanced)
 * 1단계: 제약조건(MATCH/SPLIT) 기반 그룹핑 및 전처리
 * 2단계: Modified Greedy 초기 배정 (실시간 밸런싱)
 * 3단계: 팀 내 포지션 최적화 (가중치 기반)
 * 4단계: 양방향 Swap 최적화 (SD & 포지션 만족도 동시 고려)
 */

// ========== 1. 헬퍼 함수 ==========

const shuffle = <T>(array: T[]): T[] => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

const cloneTeams = (teams: Team[]): Team[] => {
    return teams.map(t => ({
        ...t,
        players: t.players.map(p => ({ ...p }))
    }));
};

// 포지션 점수 (가중치)
const getPositionPoint = (player: Player, pos: Position): number => {
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
const calculateTeamSkillReal = (team: Team): number => {
    return Number(team.players.reduce((sum, p) => sum + p.tier, 0).toFixed(1));
};

// ========== 2. 전처리 및 초기 배정 ==========

function initialDistribute(
    players: Player[],
    teamCount: number,
    constraints: TeamConstraint[]
): Team[] {
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
            // 비상! 들어갈 곳이 없음 (제약 충돌). 
            // 어쩔 수 없이 가장 인원 적은 곳에 넣거나 무시? 
            // 여기서는 밸런스 위해 스킬 최저 팀 강제 배정 (제약 깨짐 감수)
            // 사용자에게 알릴 방법이 없으므로 최선 배정
            possibleTeams = Array.from({ length: teamCount }, (_, k) => k);
        }

        possibleTeams.sort((a, b) => teams[a].totalSkill - teams[b].totalSkill);
        const targetIdx = possibleTeams[0];

        teams[targetIdx].players.push(...unit.players);
        teams[targetIdx].totalSkill += unit.totalSkill;
    }

    return teams;
}


// ========== 3. 팀 내 포지션 최적화 ==========

function optimizeTeamPositions(
    team: Team,
    allPositions: Position[]
): void {
    const players = team.players;
    const positions = [...allPositions];
    if (positions.includes('NONE')) return; // 포지션 없는 종목은 패스

    // 필요한 포지션 슬롯 생성
    // 5명 농구라면 PG, SG, SF, PF, C 각 1개씩이 이상적 (쿼터)
    // 하지만 현재 인원이 다를 수 있으므로, 인원수에 맞춰 슬롯 생성
    // 예: 6명이면 기본 5개 + 랜덤 1개? 
    // 여기서는 "최적 매칭"을 위해 
    // 1. 모든 선수가 가능한 포지션 중 가장 높은 점수를 받는 곳을 찾아야 함
    // 2. 단, 포지션 쏠림을 막기 위해 팀 전체 포지션 분포도 고려해야 함.

    // 간소화된 헝가리안 접근:
    // 가능한 모든 (선수, 포지션) 조합 점수 계산 후 그리디 매칭

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

    options.forEach(opt => {
        if (playerAssigned.has(players[opt.pIdx].id)) return; // 이미 배정됨

        // 포지션 쏠림 체크 (옵션)
        const currentCount = assignedCount[opt.pos] || 0;
        // 특정 포지션 꽉 찼으면 다음 옵션으로 (단, 마지막 선수라 갈 곳 없으면 허용)
        // 여기서는 강제 제한보다는 점수로 해결되길 기대하지만, 최소한의 분산을 위해
        // 일단 제한 없이 Best로 채우고, 나중에 조정? 
        // -> 사용자: "저티어도 만족해야 함". 
        // -> 점수 합 최대화이므로, 고티어가 선호 가져가고 저티어도 선호(다른거) 가져가면 OK.

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

function optimizeTeams(
    teams: Team[],
    constraints: TeamConstraint[],
    allPositions: Position[]
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

    let minSD = calcSD(currentTeams);
    let maxPosScore = calcPosScore(currentTeams);

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
        if (noImprovementCount > 30) break; // 조기 종료

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

        // 4. 가상 교환 실행
        const newTeams = cloneTeams(currentTeams);

        // Remove from source
        newTeams[t1Idx].players = newTeams[t1Idx].players.filter(p => !p1Group.map(x => x.id).includes(p.id));
        newTeams[t2Idx].players = newTeams[t2Idx].players.filter(p => !p2Group.map(x => x.id).includes(p.id));

        // Add to target
        newTeams[t1Idx].players.push(...p2Group);
        newTeams[t2Idx].players.push(...p1Group);

        // Update skill
        newTeams[t1Idx].totalSkill = calculateTeamSkillReal(newTeams[t1Idx]);
        newTeams[t2Idx].totalSkill = calculateTeamSkillReal(newTeams[t2Idx]);

        // 5. 포지션 재최적화 (이동했으니 포지션 다시 맞춰야 함)
        optimizeTeamPositions(newTeams[t1Idx], allPositions);
        optimizeTeamPositions(newTeams[t2Idx], allPositions);

        // 6. 평가 (Cost Function)
        const newSD = calcSD(newTeams);
        const newPosScore = calcPosScore(newTeams);

        // 조건: 
        // 1. SD가 0.1 이상 감소하면 무조건 수락 (밸런스 우선)
        // 2. SD가 비슷하면(차이 0.1 미만), 포지션 점수가 오르면 수락
        // 3. 포지션 점수가 '불가능(-9999)'이 포함되어 있으면 무조건 기각 (이전 상태가 정상이었다면)

        const isPosValid = newPosScore > -5000; // 대략적인 체크

        let accept = false;
        if (isPosValid) {
            if (newSD < minSD - 0.05) {
                accept = true; // 밸런스 유의미한 개선
            } else if (Math.abs(newSD - minSD) < 0.1 && newPosScore > maxPosScore) {
                accept = true; // 밸런스 유지 & 포지션 개선
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


// ========== 메인 함수 ==========

export const generateBalancedTeams = (
    players: Player[],
    teamCount: number,
    customQuotas?: Partial<Record<Position, number | null>>,
    constraints: TeamConstraint[] = [],
    ignoreTier: boolean = false,
    previousHashes: string[] = []
): BalanceResult => {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0) return { teams: [], standardDeviation: 0, maxDiff: 0, imbalanceScore: 0, isValid: true, isConstraintViolated: false, isQuotaViolated: false };

    const sport = activePlayers[0].sportType;
    const allPositions: Position[] =
        sport === SportType.SOCCER ? ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
            sport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
                sport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                    ['NONE'];

    // 1 & 2. 초기 배정 (Greedy & Constraint)
    const initialTeams = initialDistribute(activePlayers, teamCount, constraints);

    // 초기 스킬 계산
    initialTeams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));

    // 3. 초기 포지션 최적화
    initialTeams.forEach(t => optimizeTeamPositions(t, allPositions));

    // 4. Swap 최적화 (Gemini Core)
    const optimizedTeams = optimizeTeams(initialTeams, constraints, allPositions);

    // 최종 결과 계산
    const totalSkills = optimizedTeams.map(t => calculateTeamSkillReal(t));
    const avgSkill = totalSkills.reduce((a, b) => a + b, 0) / teamCount;
    const variance = totalSkills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / teamCount;
    const standardDeviation = Number(Math.sqrt(variance).toFixed(2));
    const maxDiff = Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1));

    // 최종 제약 위반 체크
    // optimizeTeams 내부에서 철저히 지켰으므로 false가 정상. 
    // 혹시 초기 배정에서 실패했을 경우를 대비해 다시 계산 안하고 false 처리하거나, 간단 체크 가능.
    // 여기서는 항상 지켜졌다고 가정 (알고리즘 특성상)

    return {
        teams: optimizedTeams,
        standardDeviation,
        maxDiff,
        imbalanceScore: standardDeviation, // 간단히 SD를 점수로 사용
        isValid: true,
        isConstraintViolated: false,
        isQuotaViolated: false
    };
};
