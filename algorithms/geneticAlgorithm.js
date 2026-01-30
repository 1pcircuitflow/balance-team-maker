// 유전 알고리즘 (Genetic Algorithm)

const shuffle = (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

function evaluateFitness(teams, customQuotas, constraints) {
    // 밸런스 평가
    const skills = teams.map(t => t.totalSkill);
    const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
    const sd = Math.sqrt(skills.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / skills.length);

    // 제약 조건 평가
    let violationPenalty = 0;

    // 포지션 쿼터 체크
    if (Object.keys(customQuotas).length > 0) {
        for (const team of teams) {
            for (const [pos, quota] of Object.entries(customQuotas)) {
                const count = team.players.filter(p => p.assignedPosition === pos).length;
                if (count !== quota) {
                    violationPenalty += 1000;
                }
            }
        }
    }

    // MATCH/SPLIT 제약 체크
    for (const constraint of constraints) {
        if (constraint.type === 'MATCH') {
            const teamIds = new Set();
            for (const playerId of constraint.playerIds) {
                const teamIdx = teams.findIndex(t => t.players.some(p => p.id === playerId));
                if (teamIdx !== -1) teamIds.add(teamIdx);
            }
            if (teamIds.size > 1) {
                violationPenalty += 1000;
            }
        } else if (constraint.type === 'SPLIT') {
            if (constraint.playerIds.length === 2) {
                const [p1, p2] = constraint.playerIds;
                const t1 = teams.findIndex(t => t.players.some(p => p.id === p1));
                const t2 = teams.findIndex(t => t.players.some(p => p.id === p2));
                if (t1 === t2 && t1 !== -1) {
                    violationPenalty += 1000;
                }
            }
        }
    }

    // 종합 점수 (낮을수록 좋음)
    return sd + violationPenalty;
}

// 유전자 표현: 각 선수가 어느 팀에 속하는지 [0, 1, 2, 0, 1, 2, ...]
function encodeTeamsToChromosome(teams) {
    const chromosome = [];
    const playerIdToTeam = new Map();

    teams.forEach((team, teamIdx) => {
        team.players.forEach(player => {
            playerIdToTeam.set(player.id, teamIdx);
        });
    });

    return playerIdToTeam;
}

function decodeChromosomeToTeams(chromosome, players, teamCount) {
    const teams = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0
    }));

    for (const player of players) {
        const teamIdx = chromosome.get(player.id);
        if (teamIdx !== undefined && teamIdx < teamCount) {
            teams[teamIdx].players.push({ ...player });
        }
    }

    // 스킬 재계산
    teams.forEach(team => {
        team.totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
    });

    return teams;
}

function crossover(parent1, parent2, players) {
    // 단일점 교차
    const child = new Map();
    const crossoverPoint = Math.floor(players.length / 2);

    players.forEach((player, idx) => {
        if (idx < crossoverPoint) {
            child.set(player.id, parent1.get(player.id));
        } else {
            child.set(player.id, parent2.get(player.id));
        }
    });

    return child;
}

function mutate(chromosome, players, teamCount, mutationRate = 0.1) {
    const mutated = new Map(chromosome);

    for (const player of players) {
        if (Math.random() < mutationRate) {
            // 랜덤하게 다른 팀으로 변경
            const currentTeam = mutated.get(player.id);
            let newTeam = Math.floor(Math.random() * teamCount);
            // 다른 팀이 되도록 보장
            while (newTeam === currentTeam && teamCount > 1) {
                newTeam = Math.floor(Math.random() * teamCount);
            }
            mutated.set(player.id, newTeam);
        }
    }

    return mutated;
}

function geneticAlgorithm(players, teamCount, customQuotas, constraints, options = {}) {
    const {
        populationSize = 100,
        generations = 100,
        mutationRate = 0.1,
        eliteSize = 10
    } = options;

    // 초기 population 생성
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        const shuffled = shuffle([...players]);
        const chromosome = new Map();
        shuffled.forEach((player, idx) => {
            chromosome.set(player.id, idx % teamCount);
        });
        population.push(chromosome);
    }

    let bestSolution = null;
    let bestFitness = Infinity;

    // 진화
    for (let gen = 0; gen < generations; gen++) {
        // 평가
        const fitnesses = population.map(chromosome => {
            const teams = decodeChromosomeToTeams(chromosome, players, teamCount);
            return evaluateFitness(teams, customQuotas, constraints);
        });

        // 최선 기록
        const minFitness = Math.min(...fitnesses);
        if (minFitness < bestFitness) {
            bestFitness = minFitness;
            const bestIdx = fitnesses.indexOf(minFitness);
            bestSolution = population[bestIdx];
        }

        // 선택 - 엘리트 보존 + 토너먼트 선택
        const sortedIndices = fitnesses
            .map((f, i) => ({ fitness: f, index: i }))
            .sort((a, b) => a.fitness - b.fitness)
            .map(item => item.index);

        const newPopulation = [];

        // 엘리트 보존
        for (let i = 0; i < eliteSize; i++) {
            newPopulation.push(population[sortedIndices[i]]);
        }

        // 교차 + 돌연변이로 나머지 생성
        while (newPopulation.length < populationSize) {
            // 토너먼트 선택
            const tournament1 = shuffle(sortedIndices.slice(0, Math.floor(populationSize / 2)));
            const tournament2 = shuffle(sortedIndices.slice(0, Math.floor(populationSize / 2)));

            const parent1 = population[tournament1[0]];
            const parent2 = population[tournament2[0]];

            // 교차
            let child = crossover(parent1, parent2, players);

            // 돌연변이
            child = mutate(child, players, teamCount, mutationRate);

            newPopulation.push(child);
        }

        population = newPopulation;
    }

    // 최선의 해 반환
    return decodeChromosomeToTeams(bestSolution, players, teamCount);
}

module.exports = {
    geneticAlgorithm,
    evaluateFitness
};
