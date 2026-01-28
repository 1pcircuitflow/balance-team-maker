import { Player, Team, BalanceResult, SportType, Position, Tier, TeamConstraint } from '../types';

/**
 * 사용자가 설정한 포지션 쿼터 및 팀 묶기/나누기 제약 조건을 포함한 고도화된 밸런스 알고리즘
 */
export const generateBalancedTeams = (
    players: Player[],
    teamCount: number,
    customQuotas?: Partial<Record<Position, number | null>>,
    constraints: TeamConstraint[] = [],
    ignoreTier: boolean = false,
    previousHashes: string[] = []
): BalanceResult => {
    const activePlayers = [...players.filter(p => p.isActive)];
    if (activePlayers.length === 0) return { teams: [], standardDeviation: 0 };

    const sport = activePlayers[0].sportType;
    const allPossiblePositions: Position[] =
        sport === SportType.SOCCER ? ['FW', 'LW', 'RW', 'MF', 'DF', 'LB', 'RB', 'GK'] :
            sport === SportType.FUTSAL ? ['PIV', 'ALA', 'FIX', 'GK'] :
                sport === SportType.BASKETBALL ? ['PG', 'SG', 'SF', 'PF', 'C'] :
                    ['NONE'];

    const shuffle = <T>(array: T[]): T[] => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    const calculateOneAttempt = (): BalanceResult => {
        const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
            id: i + 1,
            name: `Team ${String.fromCharCode(65 + i)}`,
            players: [],
            totalSkill: 0,
        }));

        const teamPositionCounts = teams.map(() => {
            const counts: Record<string, number> = {};
            allPossiblePositions.forEach(p => counts[p] = 0);
            return counts;
        });

        // 배정 순서 최적화: 제약조건 대상자 및 까다로운 선수를 먼저 배정
        const getPlayerPriority = (p: Player) => {
            let priority = 0;
            const forbiddenCount = p.forbiddenPositions?.length || 0;
            const primaryCount = p.primaryPositions?.length || (p.primaryPosition !== 'NONE' ? 1 : 0);

            // 제약 조건(묶기/나누기)에 포함된 선수는 0순위로 배정하여 공간 확보
            const isInConstraint = constraints.some(c => c.playerIds.includes(p.id));
            if (isInConstraint) priority += 1000;

            priority += forbiddenCount * 10;
            priority -= primaryCount * 2;
            return priority;
        };

        const pool = shuffle(activePlayers).map(p => ({
            ...p,
            // 정렬을 위한 임의 점수 부여 (티어 + 랜덤 노이즈)
            // 노이즈 범위가 1.5면, A급(4점)이 운 좋으면 S급(5점)보다 먼저 배정될 수 있음 -> 구조적 다양성 확보
            sortScore: p.tier + (Math.random() * 1.5)
        })).sort((a, b) => {
            const priorityDiff = getPlayerPriority(b) - getPlayerPriority(a);
            if (priorityDiff !== 0) return priorityDiff;

            // 일반 모드: 점수 높은 순 (실력 위주지만 랜덤성 포함)
            if (sport === SportType.GENERAL) return b.sortScore - a.sortScore;
            // 포지션 모드: 점수 낮은 순 (랜덤성 포함)
            return a.sortScore - b.sortScore;
        });
        let hardRuleViolationPenalty = 0;

        for (const player of pool) {
            const forbidden = player.forbiddenPositions || [];
            const p1s = player.primaryPositions || (player.primaryPosition !== 'NONE' ? [player.primaryPosition] : []);
            const p2s = player.secondaryPositions || (player.secondaryPosition !== 'NONE' ? [player.secondaryPosition] : []);
            const p3s = player.tertiaryPositions || (player.tertiaryPosition && player.tertiaryPosition !== 'NONE' ? [player.tertiaryPosition] : []);

            let bestEvaluation: { teamIdx: number; pos: Position; penalty: number; score: number } | null = null;

            teams.forEach((team, teamIdx) => {
                const currentCounts = teamPositionCounts[teamIdx];
                const avgPlayersPerTeam = activePlayers.length / teamCount;

                allPossiblePositions.forEach(pos => {
                    if (forbidden.includes(pos)) return;

                    // 2. 포지션 쿼터 체크 (Soft Quota 방식으로 변경)
                    const quota = customQuotas?.[pos];
                    const isCustomQuota = typeof quota === 'number';
                    const isCorePos = pos === 'GK' || pos === 'C';
                    const effectiveLimit = isCustomQuota ? quota : (isCorePos ? 1 : Math.max(1, Math.ceil(avgPlayersPerTeam / Math.max(1, allPossiblePositions.length - (allPossiblePositions.includes('GK') || allPossiblePositions.includes('C') ? 1 : 0)))));

                    let quotaPenalty = 0;
                    if (currentCounts[pos] >= effectiveLimit && sport !== SportType.GENERAL) {
                        quotaPenalty = 10000000; // 쿼터 위반 시 1000만 점 페널티
                    }

                    // 3. 선호도 페널티
                    let preferencePenalty = 100.0;
                    if (p1s.includes(pos)) preferencePenalty = 0;
                    else if (p2s.includes(pos)) preferencePenalty = 20.0;
                    else if (p3s.includes(pos)) preferencePenalty = 40.0;

                    // 4. 제약 조건 가중치 (묶기/나누기) - **1순위 (1억 점)**
                    let constraintWeight = 0;
                    constraints.forEach(c => {
                        if (c.playerIds.includes(player.id)) {
                            const partners = c.playerIds.filter(id => id !== player.id);
                            const partnersInThisTeam = team.players.some(p => partners.includes(p.id));
                            const partnersInOtherTeams = teams.some((t, idx) => idx !== teamIdx && t.players.some(p => partners.includes(p.id)));

                            if (c.type === 'MATCH') {
                                if (partnersInThisTeam) constraintWeight -= 100000000;
                                if (partnersInOtherTeams) constraintWeight += 100000000;
                            } else if (c.type === 'SPLIT') {
                                if (partnersInThisTeam) constraintWeight += 100000000;
                            }
                        }
                    });

                    // 5. 배정 점수 계산
                    // 5. 배정 점수 계산
                    const playerCountWeight = team.players.length * 100000000; // 팀원 수 균등화 (1억 점 단위 - 최우선)

                    // 사용자 요청: "표준편차가 선호 포지션보다 우선시 되어야 함"
                    // 포지션 페널티 비중을 대폭 낮추고, 스킬(밸런스) 비중을 높임
                    const positionPenaltyWeight = preferencePenalty * 1; // 기존 1000 -> 1로 축소
                    const skillWeight = ignoreTier ? 0 : team.totalSkill * 10; // 기존 1 -> 10으로 확대

                    const evaluationScore = playerCountWeight + quotaPenalty + positionPenaltyWeight + skillWeight + constraintWeight;

                    if (!bestEvaluation || evaluationScore < bestEvaluation.score) {
                        bestEvaluation = { teamIdx, pos, penalty: preferencePenalty, score: evaluationScore };
                    }
                });
            });

            if (bestEvaluation) {
                const { teamIdx, pos, penalty } = bestEvaluation;
                const targetTeam = teams[teamIdx];
                targetTeam.players.push({ ...player, assignedPosition: pos });
                const actualPenalty = penalty === 0 ? 0 : (penalty === 20.0 ? 0.5 : (penalty === 40.0 ? 1.0 : 2.0));
                targetTeam.totalSkill = Number((targetTeam.totalSkill + (player.tier - actualPenalty)).toFixed(1));
                teamPositionCounts[teamIdx][pos]++;
            } else {
                const fallbackTeamIdx = teams.map((t, i) => ({ i, len: t.players.length })).sort((a, b) => a.len - b.len)[0].i;
                const targetTeam = teams[fallbackTeamIdx];
                const safePos = allPossiblePositions.find(p => !forbidden.includes(p) && (typeof customQuotas?.[p] !== 'number' || teamPositionCounts[fallbackTeamIdx][p] < customQuotas[p]!)) || 'NONE';
                targetTeam.players.push({ ...player, assignedPosition: safePos });
                targetTeam.totalSkill += player.tier - 2.0;
                if (safePos !== 'NONE') teamPositionCounts[fallbackTeamIdx][safePos]++;
                hardRuleViolationPenalty += 100000000;
            }
        }

        const totalSkills = teams.map(t => t.totalSkill);
        const standardDeviation = Number(Math.sqrt(totalSkills.reduce((acc, s) => acc + Math.pow(s - (totalSkills.reduce((a, b) => a + b, 0) / teamCount), 2), 0) / teamCount).toFixed(2));

        let isConstraintViolated = false;
        constraints.forEach(c => {
            const teamIdsFound = new Set<number>();
            c.playerIds.forEach(pid => {
                const team = teams.find(t => t.players.some(p => p.id === pid));
                if (team) teamIdsFound.add(team.id);
            });

            if (c.type === 'MATCH' && teamIdsFound.size > 1) {
                hardRuleViolationPenalty += 100000000;
                isConstraintViolated = true;
            }
            if (c.type === 'SPLIT' && teamIdsFound.size === 1 && c.playerIds.length > 1) {
                hardRuleViolationPenalty += 100000000;
                isConstraintViolated = true;
            }
        });

        let isQuotaViolated = false;
        if (customQuotas) {
            Object.entries(customQuotas).forEach(([pos, quota]) => {
                if (typeof quota === 'number') {
                    teams.forEach(t => {
                        if (t.players.filter(p => p.assignedPosition === pos).length !== quota) {
                            hardRuleViolationPenalty += 10000000;
                            isQuotaViolated = true;
                        }
                    });
                }
            });
        }

        const imbalanceScore = ignoreTier
            ? Number(hardRuleViolationPenalty.toFixed(2))
            : Number((hardRuleViolationPenalty + standardDeviation).toFixed(2));
        const maxDiff = Number((Math.max(...totalSkills) - Math.min(...totalSkills)).toFixed(1));
        const isValid = !isConstraintViolated && !isQuotaViolated && (hardRuleViolationPenalty < 1000000);

        return { teams, standardDeviation, imbalanceScore, maxDiff, isValid, isConstraintViolated, isQuotaViolated };
    };

    let bestResult = calculateOneAttempt();
    let bestScore = bestResult.imbalanceScore || 999999999;
    let attempts = 0;

    // 팀 Hash 생성 헬퍼
    const getTeamHash = (team: Team): string => {
        return team.players.map(p => p.id).sort().join(',');
    };

    while (attempts < 700) {
        const nextResult = calculateOneAttempt();
        let nextScore = nextResult.imbalanceScore || 999999999;

        // 개별 팀 중복 체크 (이전에 등장했던 팀 조합이 하나라도 포함되면 페널티)
        const currentTeamHashes = nextResult.teams.map(getTeamHash);
        const duplicateCount = currentTeamHashes.filter(h => previousHashes.includes(h)).length;

        if (duplicateCount > 0) {
            nextScore += (duplicateCount * 100000); // 겹치는 팀 하나당 큰 페널티
        }

        if (nextScore < bestScore) {
            bestResult = nextResult;
            bestScore = nextScore;
        }

        // 종료 조건: 유효하면서 중복팀이 없는 경우 조기 종료
        if (ignoreTier && bestResult.isValid && duplicateCount === 0) break;
        if (bestScore < 1.0 && duplicateCount === 0) break;

        attempts++;
    }

    return bestResult;
};
