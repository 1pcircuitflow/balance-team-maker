/**
 * Position Assignment Algorithm Simulation
 * Run: npx tsx simulation/simulate.ts
 *
 * Tests 4 algorithm variants (A, E, F, G) across 5 scenarios × 5 languages × 50 iterations
 */

import { Player, Team, Position, SportType, Tier, TeamConstraint } from '../types';
import { POSITIONS_BY_SPORT } from '../constants';
import { SAMPLE_PLAYERS_BY_LANG } from '../sampleData';
import { Language } from '../translations';
import {
    computeTeamHash,
    shuffle,
    cloneTeams,
    getPositionPoint,
    calculateTeamSkillReal,
    initialDistribute,
    optimizeTeamPositions as optimizeTeamPositionsA,
    optimizeTeams as optimizeTeamsA,
    generateTeamsSA,
    generateTeamsCFH,
    generateTeamsGA,
} from '../services/balanceService';


// ========== Simulation Framework ==========

interface ConstraintDef { type: 'MATCH' | 'SPLIT'; playerIndices: number[]; }

interface Scenario {
    name: string;
    sport: SportType;
    playerCount: number;
    teamCount: number;
    quotas: Partial<Record<Position, number | null>>;
    constraintDefs: ConstraintDef[];
    skewed?: boolean;
    largeScale?: boolean;
}

const SCENARIOS: Scenario[] = [
    // ===== Soccer =====
    // 2T partial quota
    { name: 'Soc 2T 10p (GK:1,DF:2)', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: { GK: 1, DF: 2 } as any, constraintDefs: [] },
    // 2T minimal quota
    { name: 'Soc 2T 10p (GK:1)', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any, constraintDefs: [] },
    // 2T no quota
    { name: 'Soc 2T 10p (none)', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: {}, constraintDefs: [] },
    // 3T
    { name: 'Soc 3T 9p (GK:1)', sport: SportType.SOCCER, playerCount: 9, teamCount: 3, quotas: { GK: 1 } as any, constraintDefs: [] },
    // Small team
    { name: 'Soc 2T 6p (GK:1)', sport: SportType.SOCCER, playerCount: 6, teamCount: 2, quotas: { GK: 1 } as any, constraintDefs: [] },
    // Large team
    { name: 'Soc 2T 8p (GK:1,DF:1)', sport: SportType.SOCCER, playerCount: 8, teamCount: 2, quotas: { GK: 1, DF: 1 } as any, constraintDefs: [] },

    // ===== Futsal =====
    { name: 'Fut 2T 10p (GK:1,FIX:1)', sport: SportType.FUTSAL, playerCount: 10, teamCount: 2, quotas: { GK: 1, FIX: 1 } as any, constraintDefs: [] },
    { name: 'Fut 2T 10p (GK:1)', sport: SportType.FUTSAL, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any, constraintDefs: [] },
    { name: 'Fut 2T 10p (none)', sport: SportType.FUTSAL, playerCount: 10, teamCount: 2, quotas: {}, constraintDefs: [] },
    { name: 'Fut 2T 8p (GK:1)', sport: SportType.FUTSAL, playerCount: 8, teamCount: 2, quotas: { GK: 1 } as any, constraintDefs: [] },
    { name: 'Fut 3T 9p (GK:1)', sport: SportType.FUTSAL, playerCount: 9, teamCount: 3, quotas: { GK: 1 } as any, constraintDefs: [] },

    // ===== Basketball =====
    // Full quota (5v5)
    { name: 'Bsk 2T 10p Full', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 } as any, constraintDefs: [] },
    // Partial quota
    { name: 'Bsk 2T 10p (C:1,PG:1)', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: { C: 1, PG: 1 } as any, constraintDefs: [] },
    { name: 'Bsk 2T 10p (C:1)', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: { C: 1 } as any, constraintDefs: [] },
    // No quota
    { name: 'Bsk 2T 10p (none)', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: {}, constraintDefs: [] },
    // 3T
    { name: 'Bsk 3T 9p (C:1,PG:1)', sport: SportType.BASKETBALL, playerCount: 9, teamCount: 3, quotas: { C: 1, PG: 1 } as any, constraintDefs: [] },
    // Small
    { name: 'Bsk 2T 6p (C:1)', sport: SportType.BASKETBALL, playerCount: 6, teamCount: 2, quotas: { C: 1 } as any, constraintDefs: [] },

    // ===== General (no positions) =====
    { name: 'Gen 2T 10p', sport: SportType.GENERAL, playerCount: 10, teamCount: 2, quotas: {}, constraintDefs: [] },
    { name: 'Gen 3T 9p', sport: SportType.GENERAL, playerCount: 9, teamCount: 3, quotas: {}, constraintDefs: [] },
    { name: 'Gen 2T 6p', sport: SportType.GENERAL, playerCount: 6, teamCount: 2, quotas: {}, constraintDefs: [] },

    // ===== Constraint Scenarios =====
    { name: 'Soc 2T 10p MATCH(0,1)', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any,
      constraintDefs: [{ type: 'MATCH', playerIndices: [0, 1] }] },
    { name: 'Soc 2T 10p SPLIT(0,2)', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any,
      constraintDefs: [{ type: 'SPLIT', playerIndices: [0, 2] }] },
    { name: 'Bsk 2T 10p M+S', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: { C: 1, PG: 1 } as any,
      constraintDefs: [{ type: 'MATCH', playerIndices: [0, 1] }, { type: 'SPLIT', playerIndices: [2, 3] }] },
    { name: 'Soc 3T 9p SPLIT(0,1,2)', sport: SportType.SOCCER, playerCount: 9, teamCount: 3, quotas: { GK: 1 } as any,
      constraintDefs: [{ type: 'SPLIT', playerIndices: [0, 1, 2] }] },
    { name: 'Fut 2T 10p MATCH(0,1,2)', sport: SportType.FUTSAL, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any,
      constraintDefs: [{ type: 'MATCH', playerIndices: [0, 1, 2] }] },
    { name: 'Bsk 3T 9p M+S conflict', sport: SportType.BASKETBALL, playerCount: 9, teamCount: 3, quotas: { C: 1 } as any,
      constraintDefs: [{ type: 'MATCH', playerIndices: [0, 3] }, { type: 'SPLIT', playerIndices: [0, 6] }] },

    // ===== 4-Team Scenarios =====
    { name: 'Soc 4T 8p (GK:1)', sport: SportType.SOCCER, playerCount: 8, teamCount: 4, quotas: { GK: 1 } as any, constraintDefs: [] },
    { name: 'Bsk 4T 8p (C:1)', sport: SportType.BASKETBALL, playerCount: 8, teamCount: 4, quotas: { C: 1 } as any, constraintDefs: [] },
    { name: 'Gen 4T 8p', sport: SportType.GENERAL, playerCount: 8, teamCount: 4, quotas: {}, constraintDefs: [] },

    // ===== Large-scale Scenarios =====
    { name: 'Soc 2T 20p (GK:1,DF:2)', sport: SportType.SOCCER, playerCount: 20, teamCount: 2, quotas: { GK: 1, DF: 2 } as any, constraintDefs: [], largeScale: true },
    { name: 'Gen 2T 20p', sport: SportType.GENERAL, playerCount: 20, teamCount: 2, quotas: {}, constraintDefs: [], largeScale: true },

    // ===== Skewed Tier Scenarios (S×4 + D×4 + B×2) =====
    { name: 'Soc 2T 10p SKEWED', sport: SportType.SOCCER, playerCount: 10, teamCount: 2, quotas: { GK: 1 } as any, constraintDefs: [], skewed: true },
    { name: 'Bsk 2T 10p SKEWED', sport: SportType.BASKETBALL, playerCount: 10, teamCount: 2, quotas: { C: 1 } as any, constraintDefs: [], skewed: true },
    { name: 'Gen 2T 10p SKEWED', sport: SportType.GENERAL, playerCount: 10, teamCount: 2, quotas: {}, constraintDefs: [], skewed: true },
];

const LANGUAGES: Language[] = ['ko', 'en', 'es', 'ja', 'pt'];
const ITERATIONS = 50;

interface Metrics {
    posSatisfaction: number;
    sd: number;
    quotaCompliance: number;
    forbiddenRate: number;
    diversity: number;
    constraintViolationRate: number;
}

type VariantName = 'A' | 'E' | 'F' | 'G';

type RunResult = { teams: Team[]; hash: string; constraintMet: boolean[] };

type RunFn = (
    players: Player[],
    scenario: Scenario,
) => RunResult;

interface Variant {
    name: VariantName;
    label: string;
    run: RunFn;
}

// ========== Constraint helpers ==========

function buildConstraints(defs: ConstraintDef[], activePlayers: Player[]): TeamConstraint[] {
    return defs.map((def, i) => ({
        id: `sim_constraint_${i}`,
        type: def.type,
        playerIds: def.playerIndices.filter(idx => idx < activePlayers.length).map(idx => activePlayers[idx].id),
    }));
}

function checkConstraints(defs: ConstraintDef[], activePlayers: Player[], teams: Team[]): boolean[] {
    const playerTeamMap = new Map<string, number>();
    teams.forEach((t, ti) => t.players.forEach(p => playerTeamMap.set(p.id, ti)));

    return defs.map(def => {
        const teamIndices = def.playerIndices
            .filter(idx => idx < activePlayers.length)
            .map(idx => playerTeamMap.get(activePlayers[idx].id))
            .filter((t): t is number => t !== undefined);

        if (teamIndices.length < 2) return true;

        if (def.type === 'MATCH') {
            return teamIndices.every(t => t === teamIndices[0]);
        } else {
            return new Set(teamIndices).size === teamIndices.length;
        }
    });
}

// ========== Variant A: Baseline (existing pipeline) ==========

function runBaseline(players: Player[], scenario: Scenario): RunResult {
    const activePlayers = players
        .filter(p => p.sportType === scenario.sport)
        .slice(0, scenario.playerCount)
        .map(p => ({ ...p, isActive: true }));

    const allPositions: Position[] = POSITIONS_BY_SPORT[scenario.sport] || ['NONE'];
    const constraints = buildConstraints(scenario.constraintDefs, activePlayers);

    const { teams: initialTeams } = initialDistribute(activePlayers, scenario.teamCount, constraints);
    initialTeams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));
    initialTeams.forEach(t => optimizeTeamPositionsA(t, allPositions, scenario.quotas));

    const optimizedTeams = optimizeTeamsA(initialTeams, constraints, allPositions, scenario.quotas);
    const hash = computeTeamHash(optimizedTeams);
    const constraintMet = checkConstraints(scenario.constraintDefs, activePlayers, optimizedTeams);

    return { teams: optimizedTeams, hash, constraintMet };
}

// ========== Variant E/F/G: New algorithms (unified interface) ==========

function buildTeamsFromAssignment(
    players: Player[],
    teamAssignment: number[],
    posAssignment: Position[],
    teamCount: number
): Team[] {
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
        id: i + 1,
        name: `Team ${String.fromCharCode(65 + i)}`,
        players: [],
        totalSkill: 0,
    }));

    for (let i = 0; i < players.length; i++) {
        const p = { ...players[i], assignedPosition: posAssignment[i] };
        teams[teamAssignment[i]].players.push(p);
    }
    teams.forEach(t => t.totalSkill = calculateTeamSkillReal(t));
    return teams;
}

function runNewAlgorithm(
    algoFn: (
        players: Player[],
        teamCount: number,
        quotas: Partial<Record<Position, number | null>> | undefined,
        constraints: TeamConstraint[],
        allPositions: Position[]
    ) => { teamAssignment: number[], posAssignment: Position[] },
    players: Player[],
    scenario: Scenario
): RunResult {
    const activePlayers = players
        .filter(p => p.sportType === scenario.sport)
        .slice(0, scenario.playerCount)
        .map(p => ({ ...p, isActive: true }));

    const allPositions: Position[] = POSITIONS_BY_SPORT[scenario.sport] || ['NONE'];
    const constraints = buildConstraints(scenario.constraintDefs, activePlayers);

    const { teamAssignment, posAssignment } = algoFn(
        activePlayers, scenario.teamCount, scenario.quotas, constraints, allPositions
    );

    const teams = buildTeamsFromAssignment(activePlayers, teamAssignment, posAssignment, scenario.teamCount);
    const hash = computeTeamHash(teams);
    const constraintMet = checkConstraints(scenario.constraintDefs, activePlayers, teams);

    return { teams, hash, constraintMet };
}

const VARIANTS: Variant[] = [
    {
        name: 'A',
        label: 'Baseline',
        run: runBaseline,
    },
    {
        name: 'E',
        label: 'Sim. Anneal.',
        run: (players, scenario) => runNewAlgorithm(generateTeamsSA, players, scenario),
    },
    {
        name: 'F',
        label: 'CF+Hungarian',
        run: (players, scenario) => runNewAlgorithm(generateTeamsCFH, players, scenario),
    },
    {
        name: 'G',
        label: 'Genetic Algo',
        run: (players, scenario) => runNewAlgorithm(generateTeamsGA, players, scenario),
    },
];

// ========== Evaluate metrics ==========

function evaluate(
    results: RunResult[],
    scenario: Scenario
): Metrics {
    const hashes = new Set<string>();

    let totalPosSat = 0;
    let totalSD = 0;
    let totalQuotaOk = 0;
    let totalQuotaTotal = 0;
    let totalForbidden = 0;
    let totalPlayers = 0;
    let totalConstraintOk = 0;
    let totalConstraintTotal = 0;

    for (const result of results) {
        hashes.add(result.hash);

        // Position satisfaction
        let posSum = 0;
        let posCount = 0;
        result.teams.forEach(t => t.players.forEach(p => {
            posSum += getPositionPoint(p, p.assignedPosition || 'NONE');
            posCount++;
        }));
        totalPosSat += posCount > 0 ? posSum / posCount : 0;

        // SD
        const skills = result.teams.map(t => calculateTeamSkillReal(t));
        const avg = skills.reduce((a, b) => a + b, 0) / skills.length;
        const vari = skills.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / skills.length;
        totalSD += Math.sqrt(vari);

        // Quota compliance
        if (scenario.quotas) {
            result.teams.forEach(t => {
                Object.entries(scenario.quotas).forEach(([pos, quota]) => {
                    if (typeof quota === 'number') {
                        totalQuotaTotal++;
                        const actual = t.players.filter(p => p.assignedPosition === pos).length;
                        if (actual === quota) totalQuotaOk++;
                    }
                });
            });
        }

        // Forbidden rate
        result.teams.forEach(t => t.players.forEach(p => {
            totalPlayers++;
            const score = getPositionPoint(p, p.assignedPosition || 'NONE');
            if (score <= -5000) totalForbidden++;
        }));

        // Constraint satisfaction (pre-computed in run phase)
        if (result.constraintMet.length > 0) {
            for (const met of result.constraintMet) {
                totalConstraintTotal++;
                if (met) totalConstraintOk++;
            }
        }
    }

    const n = results.length;

    return {
        posSatisfaction: totalPosSat / n,
        sd: totalSD / n,
        quotaCompliance: totalQuotaTotal > 0 ? (totalQuotaOk / totalQuotaTotal) * 100 : 100,
        forbiddenRate: totalPlayers > 0 ? (totalForbidden / totalPlayers) * 100 : 0,
        diversity: (hashes.size / n) * 100,
        constraintViolationRate: totalConstraintTotal > 0 ? ((totalConstraintTotal - totalConstraintOk) / totalConstraintTotal) * 100 : 0,
    };
}

// ========== Composite score ==========

function compositeScore(m: Metrics, maxSD: number, scenario: Scenario): number {
    const isGeneral = scenario.sport === SportType.GENERAL;
    const posNorm = Math.max(0, m.posSatisfaction) / 100;
    const sdNorm = maxSD > 0 ? Math.max(0, 1 - m.sd / maxSD) : 1;
    const quotaNorm = m.quotaCompliance / 100;
    const forbNorm = 1 - m.forbiddenRate / 100;
    const divNorm = m.diversity / 100;

    const hasConstraints = scenario.constraintDefs.length > 0;
    const constraintNorm = 1 - m.constraintViolationRate / 100;

    // General sport has NONE positions only → PosSat is meaningless 50
    // Redistribute PosSat weight to SD and Diversity
    if (isGeneral) {
        if (hasConstraints) {
            return sdNorm * 35 + constraintNorm * 15 + quotaNorm * 20 + forbNorm * 10 + divNorm * 20;
        }
        return sdNorm * 45 + quotaNorm * 25 + forbNorm * 10 + divNorm * 20;
    }

    // Constraint scenarios: redistribute weight from PosSat and SD
    if (hasConstraints) {
        return posNorm * 25 + sdNorm * 20 + constraintNorm * 15 + quotaNorm * 20 + forbNorm * 10 + divNorm * 10;
    }

    return posNorm * 30 + sdNorm * 25 + quotaNorm * 25 + forbNorm * 10 + divNorm * 10;
}

// ========== Player generation helpers ==========

function duplicatePlayers(basePlayers: Player[], targetCount: number): Player[] {
    const result: Player[] = [];
    let suffix = 0;
    while (result.length < targetCount) {
        for (const p of basePlayers) {
            if (result.length >= targetCount) break;
            result.push({
                ...p,
                id: suffix === 0 ? p.id : `${p.id}_dup${suffix}`,
                name: suffix === 0 ? p.name : `${p.name} ${suffix + 1}`,
            });
        }
        suffix++;
    }
    return result;
}

function buildSkewedPlayers(sport: SportType, allPos: Position[], lang: string): Player[] {
    // S×4 + D×4 + B×2 = 10 players — extreme tier imbalance
    const tiers = [Tier.S, Tier.S, Tier.S, Tier.S, Tier.D, Tier.D, Tier.D, Tier.D, Tier.B, Tier.B];
    const isGeneral = !allPos.length || allPos[0] === 'NONE';
    return tiers.map((tier, i) => ({
        id: `${lang}_skewed_${sport}_${i}`,
        name: `Skewed_${i}`,
        tier,
        isActive: false,
        sportType: sport,
        primaryPositions: isGeneral ? [] as Position[] : [allPos[i % allPos.length]],
        secondaryPositions: isGeneral ? [] as Position[] : [allPos[(i + 1) % allPos.length]],
        tertiaryPositions: [] as Position[],
        forbiddenPositions: isGeneral ? [] as Position[] :
            allPos.filter(p => p !== allPos[i % allPos.length] && p !== allPos[(i + 1) % allPos.length]),
    }));
}

// ========== Main ==========

function main() {
    console.log('='.repeat(80));
    console.log('  Position Assignment Algorithm Simulation (v2)');
    console.log(`  ${VARIANTS.length} variants x ${SCENARIOS.length} scenarios x ${LANGUAGES.length} languages x ${ITERATIONS} iterations`);
    console.log('='.repeat(80));
    console.log();

    // Collect all results per variant
    const variantMetrics: Record<VariantName, { scenario: Scenario; metrics: Metrics }[]> = {
        A: [], E: [], F: [], G: []
    };

    // Per-scenario maxSD map (index = scenario index)
    const scenarioMaxSD: number[] = new Array(SCENARIOS.length).fill(0);

    for (let si = 0; si < SCENARIOS.length; si++) {
        const scenario = SCENARIOS[si];
        console.log(`--- Scenario: ${scenario.name} ---`);

        for (const variant of VARIANTS) {
            const allResults: RunResult[] = [];

            for (const lang of LANGUAGES) {
                let langPlayers = SAMPLE_PLAYERS_BY_LANG[lang];

                // Prepare players for special scenarios
                if (scenario.largeScale) {
                    const sportPlayers = langPlayers.filter(p => p.sportType === scenario.sport);
                    const duplicated = duplicatePlayers(sportPlayers, scenario.playerCount);
                    langPlayers = [...langPlayers.filter(p => p.sportType !== scenario.sport), ...duplicated];
                }
                if (scenario.skewed) {
                    const allPos: Position[] = POSITIONS_BY_SPORT[scenario.sport] || ['NONE'];
                    const skewed = buildSkewedPlayers(scenario.sport, allPos, lang);
                    langPlayers = [...langPlayers.filter(p => p.sportType !== scenario.sport), ...skewed];
                }

                for (let i = 0; i < ITERATIONS; i++) {
                    const result = variant.run(langPlayers, scenario);
                    allResults.push(result);
                }
            }

            const metrics = evaluate(allResults, scenario);
            variantMetrics[variant.name].push({ scenario, metrics });

            if (metrics.sd > scenarioMaxSD[si]) scenarioMaxSD[si] = metrics.sd;

            const cStr = scenario.constraintDefs.length > 0 ? ` | CnstViol: ${metrics.constraintViolationRate.toFixed(1).padStart(5)}%` : '';
            console.log(`  [${variant.name}] ${variant.label.padEnd(14)} | PosSat: ${metrics.posSatisfaction.toFixed(1).padStart(6)} | SD: ${metrics.sd.toFixed(2).padStart(5)} | Quota: ${metrics.quotaCompliance.toFixed(1).padStart(5)}% | Forbid: ${metrics.forbiddenRate.toFixed(1).padStart(5)}% | Div: ${metrics.diversity.toFixed(1).padStart(5)}%${cStr}`);
        }
        console.log();
    }

    // Summary table
    console.log('='.repeat(80));
    console.log('  SUMMARY (Composite Score by Scenario)');
    console.log('='.repeat(80));
    console.log();

    const header = 'Variant'.padEnd(16) + SCENARIOS.map(s => s.name.slice(0, 20).padStart(22)).join('') + '   AVG'.padStart(8);
    console.log(header);
    console.log('-'.repeat(header.length));

    const variantAvgs: { name: VariantName; avg: number }[] = [];

    for (const variant of VARIANTS) {
        const scores: number[] = [];
        let row = `${variant.name} (${variant.label})`.padEnd(16);

        for (let si = 0; si < variantMetrics[variant.name].length; si++) {
            const entry = variantMetrics[variant.name][si];
            const score = compositeScore(entry.metrics, scenarioMaxSD[si], entry.scenario);
            scores.push(score);
            row += score.toFixed(2).padStart(22);
        }

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        variantAvgs.push({ name: variant.name, avg });
        row += avg.toFixed(2).padStart(8);
        console.log(row);
    }

    console.log();
    variantAvgs.sort((a, b) => b.avg - a.avg);
    console.log('='.repeat(80));
    console.log(`  WINNER: Variant ${variantAvgs[0].name} (avg composite: ${variantAvgs[0].avg.toFixed(2)})`);
    console.log('='.repeat(80));

    // Detailed metrics summary
    console.log();
    console.log('='.repeat(80));
    console.log('  DETAILED METRICS (averaged across all scenarios)');
    console.log('='.repeat(80));
    console.log();

    for (const variant of VARIANTS) {
        const entries = variantMetrics[variant.name];
        const avgPosSat = entries.reduce((s, e) => s + e.metrics.posSatisfaction, 0) / entries.length;
        const avgSD = entries.reduce((s, e) => s + e.metrics.sd, 0) / entries.length;
        const avgQuota = entries.reduce((s, e) => s + e.metrics.quotaCompliance, 0) / entries.length;
        const avgForb = entries.reduce((s, e) => s + e.metrics.forbiddenRate, 0) / entries.length;
        const avgDiv = entries.reduce((s, e) => s + e.metrics.diversity, 0) / entries.length;

        const constraintEntries = entries.filter(e => e.scenario.constraintDefs.length > 0);
        const avgCnst = constraintEntries.length > 0 ? constraintEntries.reduce((s, e) => s + e.metrics.constraintViolationRate, 0) / constraintEntries.length : 0;

        console.log(`  [${variant.name}] ${variant.label}`);
        console.log(`    PosSatisfaction: ${avgPosSat.toFixed(1)} | SD: ${avgSD.toFixed(2)} | Quota: ${avgQuota.toFixed(1)}% | Forbidden: ${avgForb.toFixed(1)}% | Diversity: ${avgDiv.toFixed(1)}%${constraintEntries.length > 0 ? ` | CnstViol: ${avgCnst.toFixed(1)}%` : ''}`);
    }

    // Per-scenario best variant table
    console.log();
    console.log('='.repeat(80));
    console.log('  PER-SCENARIO BEST VARIANT');
    console.log('='.repeat(80));
    console.log();

    const bestByScenario: { scenario: string; bestVariant: VariantName; bestScore: number; allScores: Record<VariantName, number> }[] = [];

    for (let s = 0; s < SCENARIOS.length; s++) {
        const scenario = SCENARIOS[s];
        const scores: Record<string, number> = {};
        for (const variant of VARIANTS) {
            const entry = variantMetrics[variant.name][s];
            scores[variant.name] = compositeScore(entry.metrics, scenarioMaxSD[s], scenario);
        }
        const best = (Object.entries(scores) as [VariantName, number][]).reduce((a, b) => a[1] > b[1] ? a : b);
        bestByScenario.push({ scenario: scenario.name, bestVariant: best[0], bestScore: best[1], allScores: scores as Record<VariantName, number> });

        const allStr = VARIANTS.map(v => `${v.name}:${scores[v.name].toFixed(1)}`).join(' | ');
        const marker = best[0];
        console.log(`  ${scenario.name.padEnd(30)} → Best: ${marker}  (${allStr})`);
    }

    // Group wins by sport/teamCount
    console.log();
    console.log('='.repeat(80));
    console.log('  WIN COUNT BY CATEGORY');
    console.log('='.repeat(80));
    console.log();

    const winCount: Record<VariantName, number> = { A: 0, E: 0, F: 0, G: 0 };
    for (const b of bestByScenario) winCount[b.bestVariant]++;
    console.log(`  Total wins: ${VARIANTS.map(v => `${v.name}=${winCount[v.name]}`).join(', ')}`);

    // By sport
    const sportGroups: Record<string, typeof bestByScenario> = {};
    for (let s = 0; s < SCENARIOS.length; s++) {
        const sport = SCENARIOS[s].sport;
        if (!sportGroups[sport]) sportGroups[sport] = [];
        sportGroups[sport].push(bestByScenario[s]);
    }
    for (const [sport, entries] of Object.entries(sportGroups)) {
        const sw: Record<string, number> = {};
        for (const e of entries) sw[e.bestVariant] = (sw[e.bestVariant] || 0) + 1;
        console.log(`  ${sport.padEnd(12)}: ${Object.entries(sw).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    // Hybrid score: if we pick best variant per scenario
    const hybridTotal = bestByScenario.reduce((s, b) => s + b.bestScore, 0) / bestByScenario.length;
    const singleBestTotal = variantAvgs[0].avg;
    console.log();
    console.log(`  Hybrid (best per scenario) avg: ${hybridTotal.toFixed(2)}`);
    console.log(`  Single best (${variantAvgs[0].name}) avg:        ${singleBestTotal.toFixed(2)}`);
    console.log(`  Improvement:                    +${(hybridTotal - singleBestTotal).toFixed(2)}`);
}

main();
