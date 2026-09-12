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

function ConvergenceChart({ snapshots }: { snapshots: SimSnapshot[] }) {
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

  const metrics = [
    { key: "rankAccuracy" as const, label: "Rank accuracy", color: "var(--indigo)" },
    { key: "top1Pct" as const, label: "Top 1 correct", color: "var(--mint)" },
    { key: "top3ExactPct" as const, label: "Top 3 exact", color: "var(--violet)" },
  ];

  const pathD = (key: "rankAccuracy" | "top1Pct" | "top3ExactPct") =>
    snapshots
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(s.votes).toFixed(1)},${y(s[key]).toFixed(1)}`)
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
          <path key={m.key} d={pathD(m.key)} fill="none" stroke={m.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {metrics.map((m) =>
          snapshots.map((s) => (
            <circle key={`${m.key}-${s.votes}`} cx={x(s.votes)} cy={y(s[m.key])} r={3} fill={m.color} />
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
  const y = (val: number) => padT + (val / maxSigma) * innerH;

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

function ResultsTable({ result }: { result: SimResult }) {
  return (
    <div className="results-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>Votes</th>
            <th>Avg sigma</th>
            <th>Rank acc.</th>
            <th>Top 1</th>
            <th>Top 3 exact</th>
            <th>Top 5 exact</th>
            <th>Top 3 overlap</th>
            <th>Top 5 overlap</th>
          </tr>
        </thead>
        <tbody>
          {result.snapshots.map((s) => (
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
              <td className="mono">{(s.top1Pct * 100).toFixed(0)}%</td>
              <td className="mono">{(s.top3ExactPct * 100).toFixed(0)}%</td>
              <td className="mono">{(s.top5ExactPct * 100).toFixed(0)}%</td>
              <td className="mono">{s.top3Overlap.toFixed(1)} / 3</td>
              <td className="mono">{s.top5Overlap.toFixed(1)} / 5</td>
            </tr>
          ))}
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

function getVerdict(result: SimResult, goal: Goal, topN: TopN) {
  const final = result.snapshots[result.snapshots.length - 1];
  if (!final) return null;

  const sigma = final.avgSigma;
  const rankAcc = final.rankAccuracy;

  if (goal === "shortlist") {
    const overlap = getOverlap(final, topN);
    const ratio = overlap / topN;
    if (ratio >= 0.67) return "strong" as const;
    if (ratio >= 0.5) return "good" as const;
    return "weak" as const;
  }
  if (sigma < 0.3 && rankAcc > 0.85) return "strong" as const;
  if (sigma < 0.5 && rankAcc > 0.75) return "good" as const;
  return "weak" as const;
}

function Verdict({ result, goal, topN }: { result: SimResult; goal: Goal; topN: TopN }) {
  const final = result.snapshots[result.snapshots.length - 1];
  if (!final) return null;

  const verdict = getVerdict(result, goal, topN);

  const labels = { strong: "Strong confidence", good: "Moderate confidence", weak: "Low confidence" };
  const colors = { strong: "var(--mint)", good: "var(--indigo)", weak: "var(--red)" };

  const rankAcc = final.rankAccuracy;
  const overlap = getOverlap(final, topN);

  return (
    <div className={`verdict ${verdict}`}>
      <span className="verdict-dot" style={{ background: colors[verdict!] }} />
      <div>
        <div className="verdict-label">{labels[verdict!]}</div>
        <div className="verdict-body">
          With {result.totalVotes} total votes across {result.nJudges} judges,{" "}
          {goal === "shortlist"
            ? topN === 1
              ? `the true #1 project is correctly identified ${(overlap * 100).toFixed(0)}% of the time.`
              : `on average ${overlap.toFixed(1)} of the true top ${topN} projects will appear in your top ${topN}.`
            : `rankings reach ${(rankAcc * 100).toFixed(0)}% accuracy.`}
          {verdict === "weak" && " Consider adding more judges or extending the judging window."}
          {verdict === "strong" && " This is a reliable setup for identifying winners."}
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

function findMinJudges(teams: number, minutes: number, perVote: number, goal: Goal, topN: TopN): { judges: number; result: SimResult } {
  let lo = 2;
  let hi = Math.max(4, Math.ceil(teams * 1.5));
  let bestJudges = hi;
  let bestResult = simulate(teams, hi, minutes, perVote, 60);

  if (!meetsThreshold(bestResult, goal, topN)) {
    while (hi <= 100 && !meetsThreshold(simulate(teams, hi, minutes, perVote, 60), goal, topN)) {
      hi = Math.min(hi * 2, 100);
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
          <Verdict result={result} goal={goal} topN={topN} />

          <div className="card">
            <div className="card-title">Accuracy over time</div>
            <p className="card-desc">
              How ranking accuracy improves as votes accumulate. The curves flatten because
              human preferences are inherently noisy: two judges can reasonably disagree about
              similar-quality projects.
            </p>
            <ConvergenceChart snapshots={result.snapshots} />
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
              <strong>Exact set match</strong> means all N projects in your top N are correct
              (getting 2 of 3 right scores 0%). <strong>Overlap</strong> counts how many of
              the true top N appear in your predicted top N, regardless of order. Averaged
              over 100 simulated events.
            </p>
            <ResultsTable result={result} />
          </div>

          <div className="card">
            <div className="card-title">Why not 100%?</div>
            <div className="explainer">
              <p>
                Pairwise judging relies on human opinions, which are inherently noisy. Two
                judges shown the same pair may disagree, especially when projects are close in
                quality. This noise is fundamental, not a limitation of the algorithm.
              </p>
              <p>
                Think of it this way: if you asked 10 people to rank 16 restaurants, they'd
                mostly agree on the best and worst, but the middle would shuffle. CrowdBT is
                doing the same thing mathematically: it correctly identifies the noise
                (high sigma) and doesn't pretend to be more confident than the data allows.
              </p>
              <p>
                <strong>The practical implication:</strong> trust the top tier (top 3-5), not
                exact positions. Projects ranked #3 and #4 may be interchangeable, and that's
                fine. The algorithm is most reliable at separating tiers (top vs. middle vs.
                bottom) and least reliable at ordering within a tier.
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
                  <div className="verdict-label">Not enough time</div>
                  <div className="verdict-body">
                    Even with {recommendation.judges} judges, {minutes} minutes at {perVote} min/vote
                    isn't enough for {goal === "shortlist" ? `reliable top-${topN} identification` : "accurate rankings"} with {teams} teams.
                    Try increasing the judging window or reducing time per vote.
                  </div>
                </div>
              </div>
            )}

            <Verdict result={recommendation.result} goal={goal} topN={topN} />

            <div className="card">
              <div className="card-title">Accuracy over time</div>
              <ConvergenceChart snapshots={recommendation.result.snapshots} />
            </div>

            <div className="card">
              <div className="card-title">Uncertainty over time</div>
              <SigmaChart snapshots={recommendation.result.snapshots} />
            </div>

            <div className="card">
              <div className="card-title">Detailed results</div>
              <ResultsTable result={recommendation.result} />
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
