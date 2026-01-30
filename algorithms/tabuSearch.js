// Tabu Search (타부 서치)

function evaluateTeams(teams, customQuotas, constraints) {
    // 밸런스 평가
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
    const sd = Math.sqrt(skills.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / skills.length);

    let penalty = 0;

    // 제약 위반 페널티
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIds = new Set();
            for (const playerId of constraint.playerIds) {
                const teamIdx = teams.findIndex(t => t.players.some(p => p.id === playerId));
                if (teamIdx !== -1) teamIds.add(teamIdx);
            }
            if (teamIds.size > 1) penalty += 1000;
        } else if (constraint.type === 'SPLIT') {
            if (constraint.playerIds.length === 2) {
                const [p1, p2] = constraint.playerIds;
                const t1 = teams.findIndex(t => t.players.some(p => p.id === p1));
                const t2 = teams.findIndex(t => t.players.some(p => p.id === p2));
                if (t1 === t2 && t1 !== -1) penalty += 1000;
            }
        }
    }

    return sd + penalty;
}

function getSwapKey(t1, p1Idx, t2, p2Idx) {
    // 교환을 고유하게 식별하는 키
    return `${t1}-${p1Idx}-${t2}-${p2Idx}`;
}

function tabuSearch(players, teamCount, customQuotas, constraints, options = {}) {
    const {
        maxIterations = 1000,
        tabuListSize = 100,
        neighborhoodSize = 50
    } = options;

    // 초기 해 생성 (랜덤 배치)
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    players.forEach((player, idx) => {
        const teamIdx = idx % teamCount;
        teams[teamIdx].players.push({ ...player });
    });

    teams.forEach(team => {
        team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
    });

    let currentSolution = teams;
    let currentScore = evaluateTeams(currentSolution, customQuotas, constraints);

    let bestSolution = JSON.parse(JSON.stringify(currentSolution));
    let bestScore = currentScore;

    const tabuList = [];

    for (let iter = 0; iter < maxIterations; iter++) {
        // 이웃 해 생성
        const neighbors = [];

        for (let i = 0; i < neighborhoodSize; i++) {
            // 랜덤하게 두 팀 선택
            const t1 = Math.floor(Math.random() * teamCount);
            let t2 = Math.floor(Math.random() * teamCount);
            while (t2 === t1 && teamCount > 1) {
                t2 = Math.floor(Math.random() * teamCount);
            }

            if (currentSolution[t1].players.length === 0 || currentSolution[t2].players.length === 0) {
                continue;
            }

            // 각 팀에서 랜덤 선수 선택
            const p1Idx = Math.floor(Math.random() * currentSolution[t1].players.length);
            const p2Idx = Math.floor(Math.random() * currentSolution[t2].players.length);

            const swapKey = getSwapKey(t1, p1Idx, t2, p2Idx);

            // 타부 리스트 체크
            if (tabuList.includes(swapKey)) {
                continue;
            }

            // 교환 수행
            const newSolution = JSON.parse(JSON.stringify(currentSolution));
            const temp = newSolution[t1].players[p1Idx];
            newSolution[t1].players[p1Idx] = newSolution[t2].players[p2Idx];
            newSolution[t2].players[p2Idx] = temp;

            // 스킬 재계산
            newSolution.forEach(team => {
                team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
            });

            const score = evaluateTeams(newSolution, customQuotas, constraints);

            neighbors.push({
                solution: newSolution,
                score,
                swapKey
            });
        }

        if (neighbors.length === 0) {
            break;
        }

        // 최선의 이웃 선택
        neighbors.sort((a, b) => a.score - b.score);
        const bestNeighbor = neighbors[0];

        // Aspiration criterion: 타부여도 최고 기록보다 좋으면 허용
        if (bestNeighbor.score < bestScore) {
            currentSolution = bestNeighbor.solution;
            currentScore = bestNeighbor.score;
            bestSolution = JSON.parse(JSON.stringify(currentSolution));
            bestScore = currentScore;
        } else {
            currentSolution = bestNeighbor.solution;
            currentScore = bestNeighbor.score;
        }

        // 타부 리스트에 추가
        tabuList.push(bestNeighbor.swapKey);
        if (tabuList.length > tabuListSize) {
            tabuList.shift();
        }
    }

    return bestSolution;
}

module.exports = {
    tabuSearch,
    evaluateTeams
};
