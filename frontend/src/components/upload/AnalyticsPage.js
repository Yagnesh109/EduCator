import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { API_BASE } from "../../config/api";

import "./AnalyticsPage.css";

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatPercent(value) {
  const n = clampPercent(value);
  return `${Math.round(n)}%`;
}

function isExamAttempt(item) {
  return String(item?.kind || "") === "mock_exam_attempt";
}

function MiniDonut({ title, segments }) {
  const normalized = Array.isArray(segments)
    ? segments
        .map((s) => ({ label: String(s?.label || ""), value: Number(s?.value || 0), color: String(s?.color || "#94a3b8") }))
        .filter((s) => s.value > 0)
    : [];

  const total = normalized.reduce((acc, s) => acc + s.value, 0);
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      <div className="donut-wrap">
        <svg viewBox="0 0 100 100" className="donut" role="img" aria-label={title}>
          <circle className="donut-bg" cx="50" cy="50" r={r} />
          {total > 0
            ? normalized.map((seg) => {
                const length = (seg.value / total) * c;
                const dash = `${length} ${Math.max(0, c - length)}`;
                const el = (
                  <circle
                    key={seg.label}
                    className="donut-seg"
                    cx="50"
                    cy="50"
                    r={r}
                    style={{
                      stroke: seg.color,
                      strokeDasharray: dash,
                      strokeDashoffset: -offset,
                    }}
                  />
                );
                offset += length;
                return el;
              })
            : null}
          <text x="50" y="52" textAnchor="middle" className="donut-center">
            {total > 0 ? `${Math.round((normalized[0]?.value / total) * 100)}%` : "—"}
          </text>
        </svg>

        <ul className="donut-legend" aria-label={`${title} legend`}>
          {normalized.length === 0 ? <li className="legend-row muted">No data</li> : null}
          {normalized.map((seg) => (
            <li key={seg.label} className="legend-row">
              <span className="legend-dot" style={{ background: seg.color }} aria-hidden="true" />
              <span className="legend-label">{seg.label}</span>
              <span className="legend-value">
                {seg.value} ({formatPercent((seg.value / Math.max(1, total)) * 100)})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LineChart({ title, points }) {
  const width = 560;
  const height = 170;
  const padX = 24;
  const padY = 22;

  const coords = useMemo(() => {
    const data = Array.isArray(points) ? points : [];
    if (data.length === 0) return [];
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    return data.map((p, idx) => {
      const x = padX + (data.length === 1 ? innerW / 2 : (idx / (data.length - 1)) * innerW);
      const pct = clampPercent(p?.pct);
      const y = padY + (1 - pct / 100) * innerH;
      return { x, y, label: String(p?.label || ""), pct };
    });
  }, [points]);

  const polyline = coords.length
    ? coords
        .map((p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`)
        .join(" ")
    : "";

  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {coords.length === 0 ? (
        <div className="analytics-empty">Submit a mock exam to see trend.</div>
      ) : (
        <div className="linechart-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} className="linechart" role="img" aria-label={title}>
            <g className="linechart-grid" aria-hidden="true">
              {[0, 25, 50, 75, 100].map((t) => {
                const y = padY + (1 - t / 100) * (height - padY * 2);
                return (
                  <g key={t}>
                    <line x1={padX} y1={y} x2={width - padX} y2={y} />
                    <text x={padX - 8} y={y + 4} textAnchor="end">
                      {t}%
                    </text>
                  </g>
                );
              })}
            </g>
            <polyline className="linechart-line" points={polyline} />
            {coords.map((p, idx) => (
              <g key={`${p.label}-${idx}`}>
                <circle className="linechart-point" cx={p.x} cy={p.y} r="5" />
              </g>
            ))}
          </svg>
          <div className="linechart-xlabels" aria-hidden="true">
            {coords.map((p, idx) => (
              <div key={`${p.label}-${idx}`} className="xlab">
                {p.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HorizontalBars({ title, rows }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {list.length === 0 ? (
        <div className="analytics-empty">No data yet.</div>
      ) : (
        <div className="hbars" role="list" aria-label={title}>
          {list.map((row) => (
            <div key={row.section || row.label} className="hbar-row" role="listitem">
              <div className="hbar-label">{row.section || row.label}</div>
              <div className="hbar-track" aria-hidden="true">
                <div className="hbar-fill" style={{ width: `${clampPercent(row.accuracyPct || row.pct)}%` }} />
              </div>
              <div className="hbar-value">{formatPercent(row.accuracyPct || row.pct)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const getReadableErrorMessage = useCallback((error, fallbackMessage) => {
    const raw = String(error?.message || "").toLowerCase();
    if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed")) {
      return `Cannot reach backend at ${API_BASE}. Start backend server and verify CORS/API URL.`;
    }
    return error?.message || fallbackMessage;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/history?limit=100`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Failed to load analytics");
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (error) {
        console.error(error);
        toast.error(getReadableErrorMessage(error, "Failed to load analytics"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getReadableErrorMessage]);

  const attempts = useMemo(() => {
    const list = (items || []).filter(isExamAttempt);
    return list
      .slice()
      .sort((a, b) => Number(b?.createdAtEpoch || 0) - Number(a?.createdAtEpoch || 0));
  }, [items]);

  const summary = useMemo(() => {
    const totalExams = attempts.length;
    const totalQuestions = attempts.reduce((acc, it) => acc + Number(it?.examTotalQuestions || 0), 0);
    const totalAttempted = attempts.reduce((acc, it) => acc + Number(it?.examAttempted || 0), 0);
    const totalCorrect = attempts.reduce((acc, it) => acc + Number(it?.examCorrect || 0), 0);
    const totalWrong = attempts.reduce((acc, it) => acc + Number(it?.examWrong || 0), 0);
    const totalNotAttempted = attempts.reduce((acc, it) => acc + Number(it?.examNotAttempted || 0), 0);

    const avgScorePct = totalExams
      ? (attempts.reduce((acc, it) => acc + (Number(it?.examCorrect || 0) / Math.max(1, Number(it?.examTotalQuestions || 0))), 0) /
          totalExams) *
        100
      : 0;

    const accuracyPct = totalAttempted ? (totalCorrect / Math.max(1, totalAttempted)) * 100 : 0;

    let bestScorePct = 0;
    for (const it of attempts) {
      const pct = (Number(it?.examCorrect || 0) / Math.max(1, Number(it?.examTotalQuestions || 0))) * 100;
      if (pct > bestScorePct) bestScorePct = pct;
    }

    return {
      totalExams,
      totalQuestions,
      totalAttempted,
      totalCorrect,
      totalWrong,
      totalNotAttempted,
      avgScorePct,
      accuracyPct,
      bestScorePct,
      lastExamAt: attempts[0]?.createdAt || "",
    };
  }, [attempts]);

  const conceptCounts = useMemo(() => {
    const map = new Map();
    for (const it of attempts) {
      const concepts = Array.isArray(it?.examConcepts) ? it.examConcepts : [];
      for (const c of concepts) {
        const key = String(c || "").trim();
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([concept, count]) => ({ concept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [attempts]);

  const sectionLeaderboard = useMemo(() => {
    const map = new Map();
    for (const it of attempts) {
      const stats = it?.examSectionStats && typeof it.examSectionStats === "object" ? it.examSectionStats : {};
      for (const [name, row] of Object.entries(stats)) {
        const key = String(name || "").trim() || "General";
        const existing = map.get(key) || { section: key, total: 0, attempted: 0, correct: 0, wrong: 0, notAttempted: 0 };
        existing.total += Number(row?.total || 0);
        existing.attempted += Number(row?.attempted || 0);
        existing.correct += Number(row?.correct || 0);
        existing.wrong += Number(row?.wrong || 0);
        existing.notAttempted += Number(row?.notAttempted || 0);
        map.set(key, existing);
      }
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        accuracyPct: row.attempted ? (row.correct / Math.max(1, row.attempted)) * 100 : 0,
      }))
      .sort((a, b) => b.accuracyPct - a.accuracyPct)
      .slice(0, 10);
  }, [attempts]);

  const recentTrend = useMemo(() => {
    const last = attempts.slice(0, 10).slice().reverse();
    return last.map((it) => {
      const correct = Number(it?.examCorrect || 0);
      const total = Math.max(1, Number(it?.examTotalQuestions || 0));
      return {
        id: it?.id || `${it?.createdAtEpoch || ""}`,
        label: it?.createdAt ? String(it.createdAt).slice(5, 16) : "Attempt",
        pct: (correct / total) * 100,
      };
    });
  }, [attempts]);

  const donutSegments = useMemo(() => {
    return [
      { label: "Correct", value: summary.totalCorrect, color: "rgba(22, 163, 74, 0.95)" },
      { label: "Wrong", value: summary.totalWrong, color: "rgba(220, 38, 38, 0.95)" },
      { label: "Unattempted", value: summary.totalNotAttempted, color: "rgba(148, 163, 184, 0.95)" },
    ];
  }, [summary.totalCorrect, summary.totalNotAttempted, summary.totalWrong]);

  return (
    <main className="upload-page analytics-page">
      <div className="home-bots" aria-hidden="true">
        <div className="boat-group">
          <img src="/blue.png" alt="" className="bot boat boat-blue" />
        </div>
      </div>

      <section className="upload-card upload-layout notebook-shell">
        <header className="upload-header">
          <div className="upload-header-actions">
            <button type="button" className="history-btn" onClick={() => navigate("/uplod")}>
              Back
            </button>
          </div>
          <h1>Learning Analytics</h1>
          <p>Based on your submitted mock exams.</p>
        </header>

        {loading ? (
          <div className="notebook-grid notebook-grid-full">
            <section className="notebook-card">
              <div className="notebook-card-body">
                <div className="rag-answer">Loading analytics...</div>
              </div>
            </section>
          </div>
        ) : (
          <div className="analytics-grid">
            <section className="notebook-card analytics-card">
              <div className="card-header">
                <h2 className="card-title">Overview</h2>
              </div>
              <div className="notebook-card-body analytics-body">
                <div className="analytics-metrics">
                  <div className="metric">
                    <div className="metric-label">Mock exams</div>
                    <div className="metric-value">{summary.totalExams}</div>
                    <div className="metric-sub">{summary.lastExamAt ? `Last: ${summary.lastExamAt}` : "No attempts yet"}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Avg score</div>
                    <div className="metric-value">{formatPercent(summary.avgScorePct)}</div>
                    <div className="metric-sub">Best: {formatPercent(summary.bestScorePct)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Accuracy</div>
                    <div className="metric-value">{formatPercent(summary.accuracyPct)}</div>
                    <div className="metric-sub">
                      Correct {summary.totalCorrect} / Attempted {summary.totalAttempted}
                    </div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Unattempted</div>
                    <div className="metric-value">{summary.totalNotAttempted}</div>
                    <div className="metric-sub">Across {summary.totalQuestions} questions</div>
                  </div>
                </div>

                <div className="overview-charts">
                  <MiniDonut title="Answer Distribution" segments={donutSegments} />
                </div>
              </div>
            </section>

            <section className="notebook-card analytics-card">
              <div className="card-header">
                <h2 className="card-title">Charts</h2>
              </div>
              <div className="notebook-card-body analytics-body">
                <LineChart title="Recent Score Trend" points={recentTrend} />
                <HorizontalBars title="Section Accuracy" rows={sectionLeaderboard} />
              </div>
            </section>

            <section className="notebook-card analytics-card">
              <div className="card-header">
                <h2 className="card-title">Top Concepts</h2>
              </div>
              <div className="notebook-card-body analytics-body">
                {conceptCounts.length === 0 ? (
                  <div className="analytics-empty">No concepts saved yet.</div>
                ) : (
                  <ul className="concept-pills">
                    {conceptCounts.map((c) => (
                      <li key={c.concept} className="concept-pill">
                        <span className="concept-name">{c.concept}</span>
                        <span className="concept-count">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="notebook-card analytics-card">
              <div className="card-header">
                <h2 className="card-title">Section Performance</h2>
              </div>
              <div className="notebook-card-body analytics-body">
                {sectionLeaderboard.length === 0 ? (
                  <div className="analytics-empty">No section data yet.</div>
                ) : (
                  <div className="section-table" role="table" aria-label="Section performance">
                    <div className="section-row section-head" role="row">
                      <div role="columnheader">Section</div>
                      <div role="columnheader">Accuracy</div>
                      <div role="columnheader">Attempted</div>
                      <div role="columnheader">Wrong</div>
                      <div role="columnheader">Unattempted</div>
                    </div>
                    {sectionLeaderboard.map((row) => (
                      <div key={row.section} className="section-row" role="row">
                        <div role="cell" className="section-name">
                          {row.section}
                        </div>
                        <div role="cell">{formatPercent(row.accuracyPct)}</div>
                        <div role="cell">{row.attempted}</div>
                        <div role="cell">{row.wrong}</div>
                        <div role="cell">{row.notAttempted}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

export default AnalyticsPage;
