import { useState } from "react";
import { simulate, type SimResult, type SimSnapshot } from "./lib/simulate";

type Mode = "custom" | "recommend";
type Goal = "shortlist" | "ranking";
type TopN = 1 | 3 | 5;

function InputField({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-row">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = parseInt(e.target.value);
            if (!isNaN(n) && n >= min && n <= max) onChange(n);
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

type ChartMetric = { key: string; label: string; color: string; getValue: (s: SimSnapshot) => number };

function getChartMetrics(goal: Goal, topN: TopN): ChartMetric[] {
  if (goal === "ranking") {
    return [
      { key: "rankAccuracy", label: "Rank accuracy", color: "var(--indigo)", getValue: (s) => s.rankAccuracy },
      { key: "top1Pct", label: "Top 1 correct", color: "var(--mint)", getValue: (s) => s.top1Pct },
    ];
  }
  if (topN === 1) {
    return [
      { key: "top1Pct", label: "Top 1 correct", color: "var(--mint)", getValue: (s) => s.top1Pct },
      { key: "rankAccuracy", label: "Rank accuracy", color: "var(--indigo)", getValue: (s) => s.rankAccuracy },
    ];
  }
  if (topN === 3) {
    return [
      { key: "top3Ratio", label: "Top 3 overlap ratio", color: "var(--mint)", getValue: (s) => s.top3Overlap / 3 },
      { key: "top1Pct", label: "Top 1 correct", color: "var(--violet)", getValue: (s) => s.top1Pct },
      { key: "rankAccuracy", label: "Rank accuracy", color: "var(--indigo)", getValue: (s) => s.rankAccuracy },
    ];
  }
  return [
    { key: "top5Ratio", label: "Top 5 overlap ratio", color: "var(--mint)", getValue: (s) => s.top5Overlap / 5 },
    { key: "top1Pct", label: "Top 1 correct", color: "var(--violet)", getValue: (s) => s.top1Pct },
    { key: "rankAccuracy", label: "Rank accuracy", color: "var(--indigo)", getValue: (s) => s.rankAccuracy },
  ];
}

function ConvergenceChart({ snapshots, goal, topN }: { snapshots: SimSnapshot[]; goal: Goal; topN: TopN }) {
  if (snapshots.length === 0) return null;

  const maxVotes = snapshots[snapshots.length - 1].votes;
  const chartH = 180;
  const chartW = 480;
  const padL = 44;
  const padR = 12;
  const padT = 8;
  const padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const x = (votes: number) => padL + (votes / maxVotes) * innerW;
  const y = (val: number) => padT + innerH - val * innerH;

  const metrics = getChartMetrics(goal, topN);

  const pathD = (metric: ChartMetric) =>
    snapshots
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.votes).toFixed(1)},${y(metric.getValue(s)).toFixed(1)}`)
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={chartW - padR} y2={y(t)} stroke="var(--line)" strokeWidth={0.5} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="chart-label">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {snapshots.map((s) => (
          <text key={s.votes} x={x(s.votes)} y={chartH - 6} textAnchor="middle" className="chart-label">
            {s.votes}
          </text>
        ))}
        {metrics.map((m) => (
          <path key={m.key} d={pathD(m)} fill="none" stroke={m.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {metrics.map((m) =>
          snapshots.map((s) => (
            <circle key={`${m.key}-${s.votes}`} cx={x(s.votes)} cy={y(m.getValue(s))} r={3} fill={m.color} />
          )),
        )}
      </svg>
      <div className="legend">
        {metrics.map((m) => (
          <div key={m.key} className="legend-item">
            <span className="legend-dot" style={{ background: m.color }} />
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SigmaChart({ snapshots }: { snapshots: SimSnapshot[] }) {
  if (snapshots.length === 0) return null;

  const maxVotes = snapshots[snapshots.length - 1].votes;
  const maxSigma = 1.0;
  const chartH = 130;
  const chartW = 480;
  const padL = 44;
  const padR = 12;
  const padT = 8;
  const padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const x = (votes: number) => padL + (votes / maxVotes) * innerW;
  const y = (val: number) => padT + innerH - (val / maxSigma) * innerH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  const pathD = snapshots
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.votes).toFixed(1)},${y(s.avgSigma).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={chartW - padR} y2={y(t)} stroke="var(--line)" strokeWidth={0.5} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" className="chart-label">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {snapshots.map((s) => (
          <text key={s.votes} x={x(s.votes)} y={chartH - 6} textAnchor="middle" className="chart-label">
            {s.votes}
          </text>
        ))}
        <path d={pathD} fill="none" stroke="var(--red)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {snapshots.map((s) => (
          <circle key={s.votes} cx={x(s.votes)} cy={y(s.avgSigma)} r={3} fill="var(--red)" />
        ))}
      </svg>
      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: "var(--red)" }} />
          Avg uncertainty (sigma)
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ result, goal, topN }: { result: SimResult; goal: Goal; topN: TopN }) {
  return (
    <div className="results-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>Votes</th>
            <th>Avg sigma</th>
            <th>Rank acc.</th>
            {goal === "shortlist" ? (
              <>
                <th>Top 1</th>
                {topN >= 3 && <th>Top 3 overlap</th>}
                {topN >= 5 && <th>Top 5 overlap</th>}
                <th>Top {topN} ratio</th>
              </>
            ) : (
              <>
                <th>Top 1</th>
                <th>Top 3 overlap</th>
                <th>Top 5 overlap</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {result.snapshots.map((s) => {
            const overlap = getOverlap(s, topN);
            const ratio = overlap / topN;
            return (
              <tr key={s.votes}>
                <td className="mono">{s.votes}</td>
                <td className="mono">
                  {s.avgSigma.toFixed(3)}
                  <Bar value={1 - s.avgSigma} max={1} color="var(--mint)" />
                </td>
                <td className="mono">
                  {(s.rankAccuracy * 100).toFixed(0)}%
                  <Bar value={s.rankAccuracy} max={1} color="var(--indigo)" />
                </td>
                {goal === "shortlist" ? (
                  <>
                    <td className="mono">{(s.top1Pct * 100).toFixed(0)}%</td>
                    {topN >= 3 && <td className="mono">{s.top3Overlap.toFixed(1)} / 3</td>}
                    {topN >= 5 && <td className="mono">{s.top5Overlap.toFixed(1)} / 5</td>}
                    <td className="mono">
                      {(ratio * 100).toFixed(0)}%
                      <Bar value={ratio} max={1} color="var(--mint)" />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="mono">{(s.top1Pct * 100).toFixed(0)}%</td>
                    <td className="mono">{s.top3Overlap.toFixed(1)} / 3</td>
                    <td className="mono">{s.top5Overlap.toFixed(1)} / 5</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getOverlap(snap: SimSnapshot, topN: TopN): number {
  if (topN === 1) return snap.top1Pct;
  if (topN === 3) return snap.top3Overlap;
  return snap.top5Overlap;
}

type Verdict = "strong" | "good" | "fair" | "weak";

function getVerdict(result: SimResult, goal: Goal, topN: TopN): Verdict | null {
  const final = result.snapshots[result.snapshots.length - 1];
  if (!final) return null;

  const sigma = final.avgSigma;
  const rankAcc = final.rankAccuracy;

  if (goal === "shortlist") {
    const overlap = getOverlap(final, topN);
    const ratio = overlap / topN;
    if (ratio >= 0.75) return "strong";
    if (ratio >= 0.65) return "good";
    if (ratio >= 0.55) return "fair";
    return "weak";
  }
  if (sigma < 0.3 && rankAcc > 0.85) return "strong";
  if (sigma < 0.35 && rankAcc > 0.8) return "good";
  if (sigma < 0.5 && rankAcc > 0.75) return "fair";
  return "weak";
}

function getVerdictCopy(verdict: Verdict, goal: Goal, topN: TopN, overlap: number, rankAcc: number, totalVotes: number, nJudges: number): { label: string; color: string; body: string } {
  const labels: Record<Verdict, string> = { strong: "Strong confidence", good: "Good confidence", fair: "Moderate confidence", weak: "Low confidence" };
  const colors: Record<Verdict, string> = { strong: "var(--mint)", good: "var(--indigo)", fair: "var(--amber)", weak: "var(--red)" };

  const stats = `With ${totalVotes} total votes across ${nJudges} judges, `;
  const metric = goal === "shortlist"
    ? topN === 1
      ? `the true #1 project is correctly identified ${(overlap * 100).toFixed(0)}% of the time.`
      : `on average ${overlap.toFixed(1)} of the true top ${topN} projects will appear in your top ${topN}.`
    : `rankings reach ${(rankAcc * 100).toFixed(0)}% accuracy.`;

  let advice = "";
  if (verdict === "weak") {
    advice = " Consider adding more judges or extending the judging window.";
  } else if (verdict === "fair") {
    advice = " Usable as a rough filter. Plan a finals round (presentations, judge deliberation, or ranked voting) to decide the actual winners.";
  } else if (verdict === "good") {
    advice = " Reliable for narrowing the field. A short finals round with the top projects will confirm the winners.";
  } else {
    advice = " Strong first-pass signal. A brief finals deliberation is still recommended for close calls at the top.";
  }

  return { label: labels[verdict], color: colors[verdict], body: stats + metric + advice };
}

function VerdictCard({ result, goal, topN }: { result: SimResult; goal: Goal; topN: TopN }) {
  const final = result.snapshots[result.snapshots.length - 1];
  if (!final) return null;

  const verdict = getVerdict(result, goal, topN);
  if (!verdict) return null;

  const overlap = getOverlap(final, topN);
  const { label, color, body } = getVerdictCopy(verdict, goal, topN, overlap, final.rankAccuracy, result.totalVotes, result.nJudges);

  return (
    <div className={`verdict ${verdict}`}>
      <span className="verdict-dot" style={{ background: color }} />
      <div>
        <div className="verdict-label">{label}</div>
        <div className="verdict-body">
          {body}
          <span className="mono" style={{ display: "block", marginTop: 6, fontSize: 11 }}>
            Coverage: avg {result.avgAvgSeen.toFixed(1)} views per project, min {result.avgMinSeen.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function meetsThreshold(result: SimResult, goal: Goal, topN: TopN): boolean {
  const v = getVerdict(result, goal, topN);
  return v === "strong" || v === "good";
}

function toMarkdown(result: SimResult, goal: Goal, topN: TopN, params: { teams: number; judges: number; minutes: number; perVote: number }): string {
  const verdict = getVerdict(result, goal, topN);
  const final = result.snapshots[result.snapshots.length - 1];
  const overlap = getOverlap(final, topN);
  const labels: Record<string, string> = { strong: "Strong", good: "Good", fair: "Moderate", weak: "Low" };

  const lines: string[] = [
    `## Judging Plan`,
    ``,
    `| Parameter | Value |`,
    `|---|---|`,
    `| Teams | ${params.teams} |`,
    `| Judges | ${params.judges} |`,
    `| Total time | ${params.minutes} min |`,
    `| Per vote | ${params.perVote} min |`,
    `| Goal | ${goal === "shortlist" ? `Shortlist (top ${topN})` : "Full ranking"} |`,
    ``,
    `**${labels[verdict!]} confidence** — ${result.totalVotes} total votes, ${result.votesPerJudge} per judge.`,
  ];

  if (goal === "shortlist") {
    if (topN === 1) {
      lines.push(`Top 1 accuracy: ${(overlap * 100).toFixed(0)}%.`);
    } else {
      lines.push(`Top ${topN} overlap: ${overlap.toFixed(1)} / ${topN} (${(overlap / topN * 100).toFixed(0)}%).`);
    }
  } else {
    lines.push(`Rank accuracy: ${(final.rankAccuracy * 100).toFixed(0)}%. Avg sigma: ${final.avgSigma.toFixed(3)}.`);
  }

  lines.push(`Coverage: avg ${result.avgAvgSeen.toFixed(1)} views per project, min ${result.avgMinSeen.toFixed(1)}.`);
  lines.push(``);

  if (goal === "shortlist") {
    lines.push(`| Votes | Sigma | Rank acc. | Top 1 | Top ${topN} ratio |`);
    lines.push(`|---|---|---|---|---|`);
    for (const s of result.snapshots) {
      const r = getOverlap(s, topN) / topN;
      lines.push(`| ${s.votes} | ${s.avgSigma.toFixed(3)} | ${(s.rankAccuracy * 100).toFixed(0)}% | ${(s.top1Pct * 100).toFixed(0)}% | ${(r * 100).toFixed(0)}% |`);
    }
  } else {
    lines.push(`| Votes | Sigma | Rank acc. | Top 1 | Top 3 | Top 5 |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const s of result.snapshots) {
      lines.push(`| ${s.votes} | ${s.avgSigma.toFixed(3)} | ${(s.rankAccuracy * 100).toFixed(0)}% | ${(s.top1Pct * 100).toFixed(0)}% | ${s.top3Overlap.toFixed(1)}/3 | ${s.top5Overlap.toFixed(1)}/5 |`);
    }
  }

  lines.push(``);
  lines.push(`*Simulated with [Gavel Planner](https://skelston.github.io/gavel-planner) using CrowdBT (100 Monte Carlo runs).*`);

  return lines.join("\n");
}

function CopyButton({ result, goal, topN, params }: { result: SimResult; goal: Goal; topN: TopN; params: { teams: number; judges: number; minutes: number; perVote: number } }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const md = toMarkdown(result, goal, topN, params);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className="btn-copy" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy as Markdown"}
    </button>
  );
}

const MAX_JUDGES = 50;

function findMinJudges(teams: number, minutes: number, perVote: number, goal: Goal, topN: TopN): { judges: number; result: SimResult } {
  let lo = 2;
  let hi = Math.min(MAX_JUDGES, Math.max(4, Math.ceil(teams * 1.5)));
  let bestJudges = hi;
  let bestResult = simulate(teams, hi, minutes, perVote, 60);

  if (!meetsThreshold(bestResult, goal, topN)) {
    while (hi < MAX_JUDGES && !meetsThreshold(simulate(teams, hi, minutes, perVote, 60), goal, topN)) {
      hi = Math.min(hi * 2, MAX_JUDGES);
    }
    bestResult = simulate(teams, hi, minutes, perVote, 60);
    bestJudges = hi;
    if (!meetsThreshold(bestResult, goal, topN)) {
      return { judges: hi, result: bestResult };
    }
  }

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const r = simulate(teams, mid, minutes, perVote, 60);
    if (meetsThreshold(r, goal, topN)) {
      hi = mid;
      bestJudges = mid;
      bestResult = r;
    } else {
      lo = mid + 1;
    }
  }

  return { judges: bestJudges, result: bestResult };
}

function CustomMode({ goal, topN }: { goal: Goal; topN: TopN }) {
  const [teams, setTeams] = useState(16);
  const [judges, setJudges] = useState(10);
  const [minutes, setMinutes] = useState(120);
  const [perVote, setPerVote] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  function handleRun() {
    setRunning(true);
    setTimeout(() => {
      setResult(simulate(teams, judges, minutes, perVote, 100));
      setRunning(false);
    }, 50);
  }

  const totalVotes = judges * Math.floor(minutes / perVote);

  return (
    <>
      <div className="card">
        <div className="card-title">Event parameters</div>
        <div className="fields">
          <InputField label="Teams" value={teams} onChange={setTeams} min={4} max={200} />
          <InputField label="Judges" value={judges} onChange={setJudges} min={2} max={100} />
          <InputField label="Total time" value={minutes} onChange={setMinutes} min={15} max={480} suffix="min" />
          <InputField label="Per vote" value={perVote} onChange={setPerVote} min={3} max={30} suffix="min" />
        </div>
        <div className="run-row">
          <button className="btn-run" onClick={handleRun} disabled={running}>
            {running ? "Simulating..." : "Run simulation"}
          </button>
          <span className="vote-summary mono">
            {totalVotes} total votes, {Math.floor(minutes / perVote)} per judge
          </span>
        </div>
      </div>

      {result && (
        <>
          <VerdictCard result={result} goal={goal} topN={topN} />
          <CopyButton result={result} goal={goal} topN={topN} params={{ teams, judges, minutes, perVote }} />

          <div className="card">
            <div className="card-title">Accuracy over time</div>
            <p className="card-desc">
              How ranking accuracy improves as votes accumulate. The curves flatten because
              human preferences are inherently noisy: two judges can reasonably disagree about
              similar-quality projects.
            </p>
            <ConvergenceChart snapshots={result.snapshots} goal={goal} topN={topN} />
          </div>

          <div className="card">
            <div className="card-title">Uncertainty over time</div>
            <p className="card-desc">
              Sigma measures how uncertain the ranking is. It starts at 1.0 (no information)
              and decreases with each vote. When the curve flattens, additional votes yield
              diminishing returns.
            </p>
            <SigmaChart snapshots={result.snapshots} />
          </div>

          <div className="card">
            <div className="card-title">Detailed results</div>
            <p className="card-desc">
              {goal === "shortlist"
                ? `Top ${topN} ratio is the key metric: what fraction of the true top ${topN} projects appear in your predicted top ${topN}. Averaged over 100 simulated events.`
                : "Rank accuracy and sigma are the key metrics. Averaged over 100 simulated events."}
            </p>
            <ResultsTable result={result} goal={goal} topN={topN} />
          </div>

          <div className="card">
            <div className="card-title">Pairwise judging is a first pass, not the final answer</div>
            <div className="explainer">
              <p>
                CrowdBT excels at separating tiers: top vs. middle vs. bottom.
                It is much less reliable at ordering within a tier, because projects
                close in quality produce noisy pairwise comparisons. Two judges shown
                the same pair may genuinely disagree.
              </p>
              <p>
                Use pairwise judging to narrow the field to a shortlist, then decide
                winners with a second stage:
              </p>
              <ul>
                <li><strong>Finals presentations</strong> to a panel, where the top 3-5 teams present in depth</li>
                <li><strong>Judge deliberation</strong> where judges discuss the shortlisted projects and vote</li>
                <li><strong>Ranked-choice voting</strong> among the shortlist for a more nuanced final ordering</li>
              </ul>
              <p>
                This two-stage approach is how most well-run hackathons work: pairwise
                judging handles the scale problem (every project gets seen), and a focused
                final round handles the precision problem (picking the actual winners).
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Understanding the metrics</div>
            <div className="explainer">
              <p>
                The three accuracy metrics measure different things and have very different
                difficulty levels:
              </p>
              <dl className="metric-list">
                <dt>Rank accuracy</dt>
                <dd>
                  How well the overall ordering matches reality, measured across all projects.
                  This tends to be the highest number because it benefits from easy separations
                  in the middle and bottom of the leaderboard, where project quality differences
                  are large.
                </dd>
                <dt>Top N overlap</dt>
                <dd>
                  How many of the true top N projects appear in your predicted top N, regardless
                  of order within those N. Harder than rank accuracy because it only measures the
                  top of the leaderboard, where projects tend to be closest in quality. Whether
                  this is easier or harder than rank accuracy depends on N and the number of
                  judges: with enough judges, top-5 overlap can approach rank accuracy, but top-1
                  and top-3 typically lag behind.
                </dd>
                <dt>Top 1 correct</dt>
                <dd>
                  Whether the #1 project is correctly identified. This is a single yes/no
                  question per simulation run, making it the hardest metric by far. Even with
                  many judges, the true #1 and #2 are often close in quality, so a few noisy
                  comparisons can swap them. Expect this to plateau well below 100%.
                </dd>
              </dl>
              <p>
                This is why pairwise judging is best used as a shortlisting tool (top N overlap)
                rather than a precision instrument for picking a single winner (top 1).
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function RecommendMode({ goal, topN }: { goal: Goal; topN: TopN }) {
  const [teams, setTeams] = useState(16);
  const [minutes, setMinutes] = useState(120);
  const [perVote, setPerVote] = useState(10);
  const [running, setRunning] = useState(false);
  const [recommendation, setRecommendation] = useState<{ judges: number; result: SimResult } | null>(null);

  function handleRun() {
    setRunning(true);
    setTimeout(() => {
      setRecommendation(findMinJudges(teams, minutes, perVote, goal, topN));
      setRunning(false);
    }, 50);
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Your constraints</div>
        <p className="card-desc">
          Enter your event size and time window. The planner will find the minimum number of
          judges needed for{" "}
          {goal === "shortlist"
            ? `reliably identifying the top ${topN} project${topN > 1 ? "s" : ""}`
            : "accurate full rankings"}.
        </p>
        <div className="fields">
          <InputField label="Teams" value={teams} onChange={setTeams} min={4} max={200} />
          <InputField label="Total time" value={minutes} onChange={setMinutes} min={15} max={480} suffix="min" />
          <InputField label="Per vote" value={perVote} onChange={setPerVote} min={3} max={30} suffix="min" />
        </div>
        <div className="run-row">
          <button className="btn-run" onClick={handleRun} disabled={running}>
            {running ? "Searching..." : "Find minimum judges"}
          </button>
        </div>
      </div>

      {recommendation && (() => {
        const final = recommendation.result.snapshots[recommendation.result.snapshots.length - 1];
        const overlap = getOverlap(final, topN);
        return (
          <>
            {meetsThreshold(recommendation.result, goal, topN) ? (
              <div className="card">
                <div className="recommend-result">
                  <div className="recommend-number" style={{ color: "var(--indigo)" }}>
                    {recommendation.judges}
                  </div>
                  <div className="recommend-unit">judges minimum</div>
                  <div className="recommend-detail">
                    {recommendation.judges} judges x {Math.floor(minutes / perVote)} votes each
                    = {recommendation.result.totalVotes} total votes across {minutes} minutes.
                    {goal === "shortlist"
                      ? topN === 1
                        ? ` Top 1 accuracy: ${(overlap * 100).toFixed(0)}%.`
                        : ` Top ${topN} overlap: ${overlap.toFixed(1)} / ${topN}.`
                      : ` Rank accuracy: ${(final.rankAccuracy * 100).toFixed(0)}%.`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="verdict searching">
                <span className="verdict-dot" style={{ background: "var(--amber)" }} />
                <div>
                  <div className="verdict-label">Consider restructuring</div>
                  <div className="verdict-body">
                    {teams > 40 ? (
                      <>
                        With {teams} teams, pairwise judging alone can't reliably{" "}
                        {goal === "shortlist" ? `identify a precise top ${topN}` : "produce accurate full rankings"}{" "}
                        in {minutes} minutes. At this scale, consider:
                        <ul style={{ margin: "8px 0 0 16px", lineHeight: 1.7 }}>
                          <li>
                            <strong>Split into heats</strong> — divide teams into {Math.ceil(teams / 30)}{" "}
                            groups of ~{Math.round(teams / Math.ceil(teams / 30))}, each with their own judges.
                            Advance the top few from each heat to a finals round.
                          </li>
                          <li>
                            <strong>Widen the shortlist</strong> — use pairwise judging to find a top 10-15,
                            then run finals presentations or judge deliberation to pick winners.
                          </li>
                          <li>
                            <strong>Reduce time per vote</strong> — if {perVote} min feels long, even
                            shaving a few minutes multiplies total comparisons significantly.
                          </li>
                        </ul>
                      </>
                    ) : (
                      <>
                        Even with {recommendation.judges} judges, {minutes} minutes at {perVote} min/vote
                        isn't enough for {goal === "shortlist" ? `reliable top-${topN} identification` : "accurate rankings"} with {teams} teams.
                        Try increasing the judging window, reducing time per vote, or adding more judges.
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <VerdictCard result={recommendation.result} goal={goal} topN={topN} />
            <CopyButton result={recommendation.result} goal={goal} topN={topN} params={{ teams, judges: recommendation.judges, minutes, perVote }} />

            <div className="card">
              <div className="card-title">Accuracy over time</div>
              <ConvergenceChart snapshots={recommendation.result.snapshots} goal={goal} topN={topN} />
            </div>

            <div className="card">
              <div className="card-title">Uncertainty over time</div>
              <SigmaChart snapshots={recommendation.result.snapshots} />
            </div>

            <div className="card">
              <div className="card-title">Detailed results</div>
              <ResultsTable result={recommendation.result} goal={goal} topN={topN} />
            </div>
          </>
        );
      })()}
    </>
  );
}

export function Planner() {
  const [mode, setMode] = useState<Mode>("recommend");
  const [goal, setGoal] = useState<Goal>("shortlist");
  const [topN, setTopN] = useState<TopN>(3);

  return (
    <div className="shell">
      <div className="header">
        <h1>Gavel Planner</h1>
        <p>
          Plan your hackathon judging setup before the event. Simulate how many judges you need,
          how accurate your rankings will be, and when additional judging stops helping.
        </p>
        <a href="https://github.com/skelston/gavel2" className="header-link">
          github.com/skelston/gavel2
        </a>
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn ${mode === "recommend" ? "active" : ""}`} onClick={() => setMode("recommend")}>
          Recommend
        </button>
        <button className={`mode-btn ${mode === "custom" ? "active" : ""}`} onClick={() => setMode("custom")}>
          Custom
        </button>
      </div>

      <div className="goal-toggle">
        <button className={`goal-btn ${goal === "shortlist" ? "active" : ""}`} onClick={() => setGoal("shortlist")}>
          Shortlist
        </button>
        <button className={`goal-btn ${goal === "ranking" ? "active" : ""}`} onClick={() => setGoal("ranking")}>
          Full ranking
        </button>
        {goal === "shortlist" && (
          <>
            <span style={{ color: "var(--dim)", fontSize: 12, marginLeft: 4 }}>Top</span>
            {([1, 3, 5] as TopN[]).map((n) => (
              <button
                key={n}
                className={`goal-btn ${topN === n ? "active" : ""}`}
                onClick={() => setTopN(n)}
              >
                {n}
              </button>
            ))}
          </>
        )}
      </div>

      {mode === "custom" ? <CustomMode goal={goal} topN={topN} /> : <RecommendMode goal={goal} topN={topN} />}

      <div className="footer">
        Powered by <a href="https://github.com/skelston/gavel2">Gavel 2</a>.
        Simulations run entirely in your browser using the CrowdBT pairwise comparison model.
        No data is sent to any server.
      </div>
    </div>
  );
}
