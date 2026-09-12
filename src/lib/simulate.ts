import {
  crowdBtUpdate,
  expectedInfoGain,
  MU_PRIOR,
  SIGMA_SQ_PRIOR,
  ALPHA_PRIOR,
  BETA_PRIOR,
  EPSILON,
} from "./crowdbt";

export type SimSnapshot = {
  votes: number;
  avgSigma: number;
  rankAccuracy: number;
  top1Pct: number;
  top3ExactPct: number;
  top5ExactPct: number;
  top3Overlap: number;
  top5Overlap: number;
};

export type SimResult = {
  nTeams: number;
  nJudges: number;
  votesPerJudge: number;
  totalVotes: number;
  snapshots: SimSnapshot[];
  avgMinSeen: number;
  avgAvgSeen: number;
};

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed;
  }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) & 0xffffffff;
    return (this.s >>> 0) / 0x100000000;
  }
  sample<T>(arr: T[], k: number): T[] {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, k);
  }
}

function trueQuality(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 2.0 - (4.0 * i) / (n - 1));
}

function pickWinner(qa: number, qb: number, rng: Rng): boolean {
  const p = 1.0 / (1.0 + Math.exp(-(qa - qb)));
  return rng.next() < p;
}

function assignPair(
  judgeIdx: number,
  projects: { mu: number; sigmaSq: number }[],
  judgeHistory: Set<number>[],
  rng: Rng,
): [number, number] | null {
  const seen = judgeHistory[judgeIdx];
  const candidates = [];
  for (let i = 0; i < projects.length; i++) {
    if (!seen.has(i)) candidates.push(i);
  }
  if (candidates.length < 2) return null;

  if (rng.next() < EPSILON) {
    const pair = rng.sample(candidates, 2);
    return [pair[0], pair[1]];
  }

  let bestPair: [number, number] | null = null;
  let bestGain = -1;
  const sampled = rng.sample(candidates, Math.min(candidates.length, 8));
  for (let i = 0; i < sampled.length; i++) {
    for (let j = i + 1; j < sampled.length; j++) {
      const a = sampled[i], b = sampled[j];
      const gain = expectedInfoGain(
        ALPHA_PRIOR, BETA_PRIOR,
        projects[a].mu, projects[a].sigmaSq,
        projects[b].mu, projects[b].sigmaSq,
      );
      if (gain > bestGain) {
        bestGain = gain;
        bestPair = [a, b];
      }
    }
  }
  return bestPair;
}

function countInversions(predicted: number[], n: number): number {
  let inv = 0;
  const pos = new Array(n);
  for (let i = 0; i < predicted.length; i++) pos[predicted[i]] = i;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (pos[i] > pos[j]) inv++;
    }
  }
  return inv;
}

function setOverlap(a: number[], b: number[], k: number): number {
  const sa = new Set(a.slice(0, k));
  let count = 0;
  for (let i = 0; i < k; i++) {
    if (sa.has(b[i])) count++;
  }
  return count;
}

function runOne(
  nTeams: number,
  nJudges: number,
  totalMinutes: number,
  minutesPerVote: number,
  seed: number,
) {
  const rng = new Rng(seed);
  const qualities = trueQuality(nTeams);
  const trueRanking = Array.from({ length: nTeams }, (_, i) => i);

  const projects = Array.from({ length: nTeams }, () => ({
    mu: MU_PRIOR,
    sigmaSq: SIGMA_SQ_PRIOR,
    seenCount: 0,
  }));

  const votesPerJudge = Math.floor(totalMinutes / minutesPerVote);
  const totalVotes = nJudges * votesPerJudge;
  const judgeHistory: Set<number>[] = Array.from({ length: nJudges }, () => new Set());

  let alpha = ALPHA_PRIOR;
  let beta = BETA_PRIOR;

  const snapInterval = Math.max(1, Math.floor(totalVotes / 10));
  const snapshots: SimSnapshot[] = [];

  for (let v = 0; v < totalVotes; v++) {
    const judgeIdx = v % nJudges;
    const pair = assignPair(judgeIdx, projects, judgeHistory, rng);
    if (!pair) continue;

    const [a, b] = pair;
    judgeHistory[judgeIdx].add(a);
    judgeHistory[judgeIdx].add(b);
    projects[a].seenCount++;
    projects[b].seenCount++;

    const aWins = pickWinner(qualities[a], qualities[b], rng);
    const [w, l] = aWins ? [a, b] : [b, a];

    const result = crowdBtUpdate(
      alpha, beta,
      projects[w].mu, projects[w].sigmaSq,
      projects[l].mu, projects[l].sigmaSq,
    );
    alpha = result[0];
    beta = result[1];
    projects[w].mu = result[2];
    projects[w].sigmaSq = result[3];
    projects[l].mu = result[4];
    projects[l].sigmaSq = result[5];

    if ((v + 1) % snapInterval === 0 || v === totalVotes - 1) {
      const avgSigma = projects.reduce((s, p) => s + p.sigmaSq, 0) / nTeams;
      const predicted = Array.from({ length: nTeams }, (_, i) => i)
        .sort((a, b) => projects[b].mu - projects[a].mu);

      const inv = countInversions(predicted, nTeams);
      const maxInv = (nTeams * (nTeams - 1)) / 2;

      snapshots.push({
        votes: v + 1,
        avgSigma,
        rankAccuracy: 1 - inv / maxInv,
        top1Pct: predicted[0] === trueRanking[0] ? 1 : 0,
        top3ExactPct: setOverlap(predicted, trueRanking, 3) === 3 ? 1 : 0,
        top5ExactPct: setOverlap(predicted, trueRanking, 5) === 5 ? 1 : 0,
        top3Overlap: setOverlap(predicted, trueRanking, 3),
        top5Overlap: setOverlap(predicted, trueRanking, 5),
      });
    }
  }

  return {
    snapshots,
    minSeen: Math.min(...projects.map((p) => p.seenCount)),
    avgSeen: projects.reduce((s, p) => s + p.seenCount, 0) / nTeams,
  };
}

export function simulate(
  nTeams: number,
  nJudges: number,
  totalMinutes: number,
  minutesPerVote: number,
  nRuns = 100,
): SimResult {
  const allSnapshots: SimSnapshot[][] = [];
  let totalMinSeen = 0;
  let totalAvgSeen = 0;

  for (let run = 0; run < nRuns; run++) {
    const result = runOne(nTeams, nJudges, totalMinutes, minutesPerVote, run * 7919 + 42);
    allSnapshots.push(result.snapshots);
    totalMinSeen += result.minSeen;
    totalAvgSeen += result.avgSeen;
  }

  const nSnaps = allSnapshots[0].length;
  const averaged: SimSnapshot[] = [];
  for (let i = 0; i < nSnaps; i++) {
    const votes = allSnapshots[0][i].votes;
    let avgSigma = 0, rankAcc = 0, top1 = 0, top3e = 0, top5e = 0, top3o = 0, top5o = 0;
    for (const snaps of allSnapshots) {
      avgSigma += snaps[i].avgSigma;
      rankAcc += snaps[i].rankAccuracy;
      top1 += snaps[i].top1Pct;
      top3e += snaps[i].top3ExactPct;
      top5e += snaps[i].top5ExactPct;
      top3o += snaps[i].top3Overlap;
      top5o += snaps[i].top5Overlap;
    }
    averaged.push({
      votes,
      avgSigma: avgSigma / nRuns,
      rankAccuracy: rankAcc / nRuns,
      top1Pct: top1 / nRuns,
      top3ExactPct: top3e / nRuns,
      top5ExactPct: top5e / nRuns,
      top3Overlap: top3o / nRuns,
      top5Overlap: top5o / nRuns,
    });
  }

  return {
    nTeams,
    nJudges,
    votesPerJudge: Math.floor(totalMinutes / minutesPerVote),
    totalVotes: nJudges * Math.floor(totalMinutes / minutesPerVote),
    snapshots: averaged,
    avgMinSeen: totalMinSeen / nRuns,
    avgAvgSeen: totalAvgSeen / nRuns,
  };
}
