// ─────────────────────────────────────────────────────────────
// app.js · CDN React 18 + Babel standalone (JSX, no imports)
// ─────────────────────────────────────────────────────────────
const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;

// ── Data ──────────────────────────────────────────────────────
async function loadData() {
  const res = await fetch("data.json");
  if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
  return res.json();
}

// ── Theme ─────────────────────────────────────────────────────
function useTheme() {
  const [theme, set] = useState(() => document.documentElement.getAttribute("data-theme") || "light");
  const apply = useCallback((next) => {
    const commit = () => { document.documentElement.setAttribute("data-theme", next); set(next); };
    document.startViewTransition ? document.startViewTransition(commit) : commit();
    try { localStorage.setItem("ai-report-theme", next); } catch {}
  }, []);
  return [theme, apply];
}

const SUN = <React.Fragment><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></React.Fragment>;
const MOON = <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />;

function ThemeToggle({ theme, setTheme }) {
  const btn = (mode, label, icon) =>
    <button className={"theme-toggle-btn" + (theme === mode ? " active" : "")} data-theme-set={mode} aria-label={`${label} theme`} onClick={() => setTheme(mode)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>{label}
    </button>;
  return <div className="theme-toggle" role="group" aria-label="Color theme">{btn("light", "Light", SUN)}{btn("dark", "Dark", MOON)}</div>;
}

function ThemeToggleMobile({ theme, setTheme }) {
  return <button className="theme-toggle-mobile" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{theme === "dark" ? SUN : MOON}</svg>
  </button>;
}

// ── Shared Components ─────────────────────────────────────────
function FatalError({ message }) {
  return <p style={{ color: "var(--accent-warm)", padding: "3rem 1rem", textAlign: "center" }}>{message} Serve over HTTP (e.g. <code>python3 -m http.server</code>).</p>;
}

function StatStrip({ stats }) {
  return <div className="stack-stats">
    {stats.map((s, i) => <a key={i} className="stack-stat" href={s.source} target="_blank" rel="noopener" title="View source">
      <div className="stack-stat-num">{s.num}</div>
      <div className="stack-stat-label">{s.label}</div>
      <div className="stack-stat-trend">{s.trend}</div>
    </a>)}
  </div>;
}

function MarketGrid({ items, style }) {
  return <div className="market-grid" style={style}>
    {items.map((m, i) => <a key={i} className="market-card" href={m.link} target="_blank" rel="noopener" style={m.cardStyle}>
      <div className="market-company" style={m.companyStyle}>{m.company}</div>
      <div className="market-headline" style={m.headlineStyle}>{m.headline}</div>
      {m.valuation && <div className="market-valuation">{m.valuation}</div>}
      <div className="market-detail" style={m.detailStyle}>{m.detail}</div>
      <div className="market-source">View source ↗</div>
    </a>)}
  </div>;
}

function Table({ headers, rows, style }) {
  return <div className="table-container" style={style}>
    <table className="premium-table">
      <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((cells, r) => <tr key={r}>{cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function SubsectionHeader({ title, desc, kicker }) {
  return <div className="subsection-header">
    {kicker && <div className="section-kicker">{kicker}</div>}
    <h3 className="subsection-title">{title}</h3>
    <p className="subsection-desc">{desc}</p>
  </div>;
}

function ShiftCards({ shifts }) {
  return shifts.map((s, i) => <article key={i} className="shift-card">
    <div className="shift-card-tag">{s.tag}</div>
    <h4 className="shift-card-title">{s.title}</h4>
    <p className="shift-card-summary">{s.summary}</p>
    <ul className="shift-card-evidence">{s.evidence.map((e, j) => <li key={j}>{e}</li>)}</ul>
    <div className="shift-card-implication">
      <span className="shift-card-implication-label">Implication</span>
      <p>{s.implication}</p>
    </div>
    <a className="shift-card-source" href={s.sourceLink} target="_blank" rel="noopener">{s.sourceLabel} ↗</a>
  </article>);
}

function DisciplineGrid({ items }) {
  return <div className="disc-grid">
    {items.map((d, i) => <div key={i} className="discipline-card">
      <div className="discipline-num">{d.num}</div>
      <div className="discipline-title">{d.title}</div>
      <div className="discipline-desc">{d.desc}</div>
      <div className="discipline-stack">{d.stack}</div>
    </div>)}
  </div>;
}

function RealityGrid({ items }) {
  return <div className="reality-grid">
    {items.map((r, i) => <div key={i} className="reality-card">
      <div className="reality-card-title">{r.title}</div>
      <p className="reality-card-body">{r.body}</p>
    </div>)}
  </div>;
}

// ── Nav & Layout ──────────────────────────────────────────────
const NAV = [
  ["overview","Overview","Overview","①"],["timeline","Timeline","Timeline","②"],
  ["models","Models","Models","③"],["stack","Stack","Stack","④"],
  ["hardware","Silicon","Silicon","⑤"],["economics","Economics","Econ","⑥"],
  ["industry","Industry","Industry","⑦"],["engineers","Engineers","Engineers","⑧"],
  ["workforce","Workforce","Workforce","⑨"],["legal","Legal","Legal","⑩"],
  ["security","Geopolitics","Geopol","⑪"],
];

const MILESTONE_COLOR = { llm:"var(--primary)","open-source":"var(--secondary)",agent:"var(--accent-sky)",robot:"var(--accent-warm)",policy:"var(--text-faint)",science:"var(--secondary)" };

const viewTransition = (fn) => document.startViewTransition ? document.startViewTransition(fn) : fn();

// ── System 2 ──────────────────────────────────────────────────
const S2Ctx = createContext(() => {});
function S2Trigger() {
  const open = useContext(S2Ctx);
  return <button className="s2-trigger" type="button" onClick={open} aria-label="Open System 2 explainer"><span className="s2-trigger-icon">i</span>System 2</button>;
}
function s2(text) {
  const parts = String(text ?? "").split(/\bSystem 2\b/);
  if (parts.length === 1) return text;
  return parts.flatMap((p, i) => i ? [<S2Trigger key={"t"+i} />, p] : [p]);
}

// ── Section Shell ─────────────────────────────────────────────
function Section({ id, title, desc, kicker, children }) {
  return <section id={id}>
    <div className="section-title-wrap">
      <div className="section-icon-badge">○</div>
      <div>
        {kicker && <div className="section-kicker">{kicker}</div>}
        <h2 className="section-title" tabIndex={-1}>{title}</h2>
        <div className="section-desc">{desc}</div>
      </div>
    </div>
    {children}
  </section>;
}

// ── Sidebar & Mobile Nav ──────────────────────────────────────
function Sidebar({ active, onNav, theme, setTheme }) {
  return <sidebar id="main-sidebar">
    <div className="logo-container">
      <div className="logo-icon">◈</div><div className="logo-text">AI Retrospective</div>
    </div>
    <ul className="nav-links">
      {NAV.map(([id, label, , icon]) => <li key={id} className={"nav-item" + (active === id ? " active" : "")}>
        <a href={"#" + id} onClick={(e) => onNav(e, id)}><span className="nav-icon">{icon}</span> {label}</a>
      </li>)}
    </ul>
    <ThemeToggle theme={theme} setTheme={setTheme} />
    <div className="sidebar-footer">
      <div>Epoch 2022–2026</div>
      <div style={{ marginTop: "0.25rem" }}>Cognitive Systems Report</div>
    </div>
  </sidebar>;
}

function MobileNav({ active, onNav }) {
  return <div className="mobile-nav-bar"><ul className="mobile-nav-list">
    {NAV.map(([id, , short]) => <li key={id} className={"mobile-nav-item" + (active === id ? " active" : "")}>
      <a href={"#" + id} onClick={(e) => onNav(e, id)}>{short}</a>
    </li>)}
  </ul></div>;
}

// ── Hero ──────────────────────────────────────────────────────
function Hero({ data }) {
  return <div className="hero">
    <div className="hero-subtitle">Strategic Retrospective</div>
    <h1>{data.title}</h1>
    <p>{data.subtitle}</p>
    <div className="stats-grid">
      {data.heroStats.map((s) => <div key={s.id} className="stat-card">
        <div className="stat-num">{s.num}</div>
        <div className="stat-label">{s.label}</div>
        <div className="stat-trend">{s.trend}</div>
      </div>)}
    </div>
  </div>;
}

// ── Overview ──────────────────────────────────────────────────
const supportsBeforematch = "onbeforematch" in HTMLElement.prototype;
function Overview({ shifts }) {
  return <Section id="overview" title="The Big Picture" desc="Six core systemic transitions restructuring computational models and the world economy.">
    <div className="grid-2">
      {shifts.map((sh, i) => <div key={i} className="card">
        <h3>{sh.icon} {s2(sh.title)}</h3>
        <p className="card-desc">{s2(sh.desc)}</p>
        <ul className="card-list">{sh.points.map((p, j) => <li key={j}>{s2(p)}</li>)}</ul>
        <details className="deep-dive" open={!supportsBeforematch}>
          <summary>Technical Deep-Dive Details</summary>
          <div className="deep-dive-content">
            Comprehensive review verifies this structural change has transitioned the system lifecycle. Full audit trace confirms: {s2(sh.points.join(" "))}
          </div>
        </details>
      </div>)}
    </div>
  </Section>;
}

// ── Timeline ──────────────────────────────────────────────────
function Timeline({ data }) {
  const [year, setYear] = useState("2026");
  const years = ["2022","2023","2024","2025","2026"];
  const select = (y) => viewTransition(() => setYear(y));
  return <Section id="timeline" title="Chronological Evolution" desc="From symbolic reasoning logic gates to generative mimicry and stateful deliberate routing.">
    <div className="evolution-timeline" style={{ marginBottom: "3rem" }}>
      {data.fullEvolutionTimeline.map((it, i) => <div key={i} className="timeline-row">
        <div className="timeline-dot"></div>
        <div className="timeline-card">
          <div className="timeline-header">
            <div className="timeline-era">{s2(it.era)}</div>
            <span className="timeline-badge">{it.architecture}</span>
          </div>
          <div className="timeline-field"><strong>Primary Technical Mechanism:</strong> {s2(it.mechanism)}</div>
          <div className="timeline-field"><strong>Landmark Release:</strong> {s2(it.landmark)}</div>
          <div className="timeline-field" style={{ color: "var(--text-faint)" }}><strong>Core Operational Limitation:</strong> {s2(it.limitation)}</div>
        </div>
      </div>)}
    </div>
    <div className="section-title-wrap" style={{ marginTop: "2rem" }}>
      <div className="section-icon-badge">○</div>
      <div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 700 }}>Annual High-Impact Milestones</h3>
        <div className="section-desc">Select a year to review key technical launches and policy shifts.</div>
      </div>
    </div>
    <div className="pill-tabs" style={{ marginBottom: "2rem" }}>
      {years.map((y) => <button key={y} className={"pill-tab timeline-pill" + (year === y ? " active" : "")} onClick={() => select(y)}>{y}</button>)}
    </div>
    <div className="grid-2">
      {(data.milestones[year] || []).map((ms, i) => {
        const c = MILESTONE_COLOR[ms.category] || "var(--primary)";
        return <div key={i} className="card" style={{ borderLeft: `4px solid ${c}` }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: c, letterSpacing: "0.1em" }}>{ms.category}</span>
          <h4 style={{ marginTop: "0.25rem", fontSize: "1.05rem", fontFamily: "var(--font-display)", fontWeight: 700 }}>{s2(ms.title)}</h4>
          <p className="card-desc" style={{ marginTop: "0.5rem", fontSize: "0.85rem", marginBottom: 0 }}>{s2(ms.desc)}</p>
        </div>;
      })}
    </div>
  </Section>;
}

// ── Models ────────────────────────────────────────────────────
const LINK = { color: "inherit", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.25)", textDecorationThickness: "1px", textUnderlineOffset: "3px" };
const PEAK_CLOSED = { color: "var(--secondary)", fontWeight: 700, textDecoration: "underline", textDecorationColor: "rgba(0,229,255,0.45)", textUnderlineOffset: "3px" };
const PEAK_OPEN = { color: "var(--accent-pink)", fontWeight: 700, textDecoration: "underline", textDecorationColor: "rgba(255,0,153,0.45)", textUnderlineOffset: "3px" };

function Cell({ value, link, title, style = LINK }) {
  const na = !value || value === "N/A";
  const st = na ? { ...style, opacity: 0.6 } : style;
  const text = na ? "N/A" : value;
  return link
    ? <a href={link} target="_blank" rel="noopener" style={st} title={title}>{text}</a>
    : <span style={na ? { opacity: 0.6 } : undefined} title={title}>{text}</span>;
}

function SourceFooter() {
  const pills = [["215","GPQA"],["91","SWE-Bench Verified"],["109","AIME 2025"],["76","HLE"],["32","MATH-500"]];
  return <div className="source-footer">
    <div className="source-footer-header">
      <span className="source-footer-label">Sources & Methodology</span>
      <span className="source-snapshot-badge">Snapshot · 2026-05-27</span>
    </div>
    <div className="source-pills" aria-label="Models tracked per benchmark">
      {pills.map(([n, l]) => <span key={l} className="source-pill"><strong>{n}</strong> {l}</span>)}
    </div>
    <div className="source-links">
      <span className="source-links-label">Primary</span>
      <a href="https://llm-stats.com/benchmarks" target="_blank" rel="noopener">LLM Stats Leaderboards</a>
      <span className="source-links-divider" aria-hidden="true">·</span>
      <span className="source-links-label">Cross-checked</span>
      <a href="https://benchlm.ai" target="_blank" rel="noopener">BenchLM.ai</a>
      <a href="https://lmmarketcap.com/benchmarks" target="_blank" rel="noopener">LM Market Cap</a>
      <span className="source-links-divider" aria-hidden="true">·</span>
      <span style={{ color: "var(--text-faint)" }}>primary papers</span>
    </div>
    <div className="source-footnote">"N/A" indicates the benchmark did not exist in that year. Click any value in the table to verify against its source.</div>
  </div>;
}

function Models({ data }) {
  const headers = ["Benchmark","2022 (SOTA)","2024 (SOTA)","Closed-Source SOTA (2026)","Open-Weight SOTA (2026)","Trend"];
  const rows = data.benchmarkSota.map((b) => [
    <span className="text-primary-color"><Cell value={b.benchmark} link={b.benchmarkLink} title="Benchmark paper / definition" /></span>,
    <Cell value={b.y2022} link={b.y2022Link} title={b.y2022Note} />,
    <Cell value={b.y2024} link={b.y2024Link} title={b.y2024Note} />,
    <React.Fragment><Cell value={b.peakClosed} link={b.peakClosedLink} title={b.peakClosedModel} style={PEAK_CLOSED} /><div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>{b.peakClosedModel}</div></React.Fragment>,
    <React.Fragment><Cell value={b.peakOpen} link={b.peakOpenLink} title={b.peakOpenModel} style={PEAK_OPEN} /><div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>{b.peakOpenModel}</div></React.Fragment>,
    <span className="trend-up">{b.trend}</span>,
  ]);
  return <Section id="models" title="Model Capability Evolution" desc="PhD-level benchmarks and sequential context size surges. Every numeric cell is sourced — click a value to verify against its leaderboard or paper. Closed-source vs open-weight SOTA are split because the gap has collapsed differently per benchmark.">
    <Table headers={headers} rows={rows} style={{ marginBottom: "3rem" }} />
    <SourceFooter />
    <MoEExplorer models={data.frontierModels2026} />
  </Section>;
}

// ── MoE Explorer ──────────────────────────────────────────────
function MoEExplorer({ models }) {
  const [idx, setIdx] = useState(0);
  const m = models[idx];
  const isMoE = /Mixture-of-Experts|MoE/.test(m.architecture);
  return <div className="card moe-explorer">
    <h3>Mixture-of-Experts Parameter Explorer</h3>
    <p className="card-desc">Compare sparse MoE activation routing vs. full dense computation across frontier models.</p>
    <div className="moe-layout">
      <div className="moe-model-selector">
        {models.map((mm, i) => <button key={i} className={"moe-btn" + (i === idx ? " active" : "")} onClick={() => setIdx(i)}>{mm.name}</button>)}
      </div>
      <div className="moe-display">
        <div className="moe-visualizer" dangerouslySetInnerHTML={{ __html: isMoE ? moeVisual() : denseVisual() }}></div>
        <div className="moe-details">
          <h4 style={{ fontFamily: "var(--font-display)", color: "var(--text-main)", fontSize: "1.1rem", fontWeight: 700 }}>{m.name} ({m.developer})</h4>
          {moeLine("Architectural Class", m.architecture)}
          {moeLine("Parametric Split", m.parameters)}
          {moeLine("Context Capacity", m.context)}
          {moeLine("Peak SOTA Benchmark", m.gpqa, "var(--secondary)")}
          <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-main)" }}>Primary Functional Advantage:</strong><br/>
            <span style={{ color: "var(--text-muted)" }}>{m.capabilities}</span>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function moeLine(label, val, color) {
  return <div className="moe-stat-line" style={label === "Architectural Class" ? { marginTop: "0.5rem" } : undefined}>
    <span>{label}</span><strong style={color ? { color } : undefined}>{val}</strong>
  </div>;
}

function denseVisual() {
  const n = 6, startY = 50, gap = 22;
  let layers = "";
  for (let i = 0; i < n; i++) {
    const y = startY + i * gap;
    layers += `<rect x="120" y="${y}" width="200" height="16" rx="3" class="node-bg-primary" stroke-width="1.5"/><text x="220" y="${y + 11}" text-anchor="middle" font-size="9" font-weight="600" class="node-text-primary">Layer ${i + 1} · Self-Attn + FFN (active)</text>`;
  }
  return `<div class="moe-visualizer-title">Dense Architecture · Full Forward Pass</div>
  <svg class="arch-svg" viewBox="0 0 440 230" role="img" aria-label="Dense transformer architecture diagram">
    <defs><marker id="arr-dense" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrow-head"/></marker></defs>
    <rect x="20" y="100" width="80" height="36" rx="6" class="node-bg-muted" stroke-width="1.5"/>
    <text x="60" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-main">Input Token</text>
    <text x="60" y="128" text-anchor="middle" font-size="8" class="node-text-faint">x_t</text>
    <line x1="100" y1="118" x2="118" y2="118" class="arrow-line" marker-end="url(#arr-dense)"/>
    <rect x="115" y="42" width="210" height="${gap * n + 14}" rx="8" class="layer-stack-fill"/>
    <text x="220" y="36" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="0.08em" class="node-text-faint">DENSE TRANSFORMER STACK · 100% PARAMS ACTIVE</text>
    ${layers}
    <line x1="320" y1="118" x2="338" y2="118" class="arrow-line" marker-end="url(#arr-dense)"/>
    <rect x="340" y="100" width="80" height="36" rx="6" class="node-bg-secondary" stroke-width="1.5"/>
    <text x="380" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-secondary">Logits</text>
    <text x="380" y="128" text-anchor="middle" font-size="8" class="node-text-faint">P(x_t+1)</text>
    <text x="220" y="${startY + n * gap + 30}" text-anchor="middle" font-size="9" font-weight="600" class="node-text-faint">Compute per token = 100% of parameters</text>
  </svg>
  <div class="arch-legend"><span class="arch-legend-item"><span class="arch-legend-dot active-shared"></span>Active layer</span><span class="arch-legend-item"><span class="arch-legend-dot inactive"></span>None skipped</span></div>
  <div class="moe-formula">Active Params = <strong style="color: var(--text-main);">P<sub>total</sub></strong> &nbsp;·&nbsp; every token, every layer</div>`;
}

function moeVisual() {
  const expertCount = 8, active = [1, 4], eh = 18, eg = 4, ex = 245, ew = 105, top = 30;
  let experts = "", routes = "", merges = "";
  for (let i = 0; i < expertCount; i++) {
    const y = top + i * (eh + eg), on = active.includes(i);
    const cls = on ? "node-bg-secondary" : "node-bg-inactive", txt = on ? "node-text-secondary" : "node-text-faint", pulse = on ? " pulse" : "";
    experts += `<rect x="${ex}" y="${y}" width="${ew}" height="${eh}" rx="3" class="${cls}${pulse}" stroke-width="1.5"/><text x="${ex + ew / 2}" y="${y + eh / 2 + 3}" text-anchor="middle" font-size="9" font-weight="${on ? 700 : 500}" class="${txt}">Expert ${i + 1}${on ? " · ACTIVE" : ""}</text>`;
    const cy = y + eh / 2, lc = on ? "arrow-line-active" : "arrow-line-dim";
    routes += `<path d="M 215 118 C 230 118, 235 ${cy}, ${ex} ${cy}" class="${lc}" fill="none"/>`;
    if (on) merges += `<path d="M ${ex + ew} ${cy} C ${ex + ew + 18} ${cy}, ${ex + ew + 22} 118, 380 118" class="arrow-line-active" fill="none"/>`;
  }
  return `<div class="moe-visualizer-title">Mixture-of-Experts · Sparse Routing</div>
  <svg class="arch-svg" viewBox="0 0 430 240" role="img" aria-label="Mixture of Experts routing diagram">
    <defs>
      <marker id="arr-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrow-head-active"/></marker>
      <marker id="arr-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrow-head-dim"/></marker>
    </defs>
    <rect x="14" y="100" width="76" height="36" rx="6" class="node-bg-muted" stroke-width="1.5"/>
    <text x="52" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-main">Token</text>
    <text x="52" y="128" text-anchor="middle" font-size="8" class="node-text-faint">x_t</text>
    <line x1="90" y1="118" x2="108" y2="118" class="arrow-line" marker-end="url(#arr-dim)"/>
    <rect x="110" y="92" width="60" height="52" rx="6" class="node-bg-primary" stroke-width="1.5"/>
    <text x="140" y="111" text-anchor="middle" font-size="9" font-weight="700" class="node-text-primary">Shared</text>
    <text x="140" y="123" text-anchor="middle" font-size="8" class="node-text-primary">Embed +</text>
    <text x="140" y="133" text-anchor="middle" font-size="8" class="node-text-primary">Attention</text>
    <line x1="170" y1="118" x2="188" y2="118" class="arrow-line" marker-end="url(#arr-dim)"/>
    <polygon points="190,118 215,100 215,136" class="node-bg-primary" stroke-width="1.5"/>
    <text x="201" y="121" text-anchor="middle" font-size="8" font-weight="700" class="node-text-primary">router</text>
    <text x="${ex + ew / 2}" y="22" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="0.08em" class="node-text-faint">EXPERT BANK · TOP-${active.length} ACTIVATED</text>
    ${routes}${experts}${merges}
    <circle cx="380" cy="118" r="5" class="node-bg-secondary" stroke-width="1.5"/>
    <line x1="385" y1="118" x2="402" y2="118" class="arrow-line-active" marker-end="url(#arr-active)"/>
    <rect x="350" y="180" width="76" height="36" rx="6" class="node-bg-secondary" stroke-width="1.5"/>
    <text x="388" y="196" text-anchor="middle" font-size="10" font-weight="600" class="node-text-secondary">Logits</text>
    <text x="388" y="208" text-anchor="middle" font-size="8" class="node-text-faint">P(x_t+1)</text>
    <line x1="380" y1="124" x2="380" y2="178" class="arrow-line-active" marker-end="url(#arr-active)"/>
  </svg>
  <div class="arch-legend"><span class="arch-legend-item"><span class="arch-legend-dot active-shared"></span>Shared</span><span class="arch-legend-item"><span class="arch-legend-dot active-expert"></span>Active expert</span><span class="arch-legend-item"><span class="arch-legend-dot inactive"></span>Skipped</span></div>
  <div class="moe-formula">Active Params = P<sub>shared</sub> + &Sigma;<sub>i&isin;TopK</sub> P<sub>expert<sub>i</sub></sub> &nbsp;&laquo;&nbsp; P<sub>total</sub></div>`;
}

// ── Stack ─────────────────────────────────────────────────────
function Stack({ stack }) {
  if (!stack) return null;
  const a = stack.frameworkAdoption;
  return <Section id="stack" title={stack.title} desc={stack.intro} kicker={stack.kicker}>
    <StatStrip stats={stack.stats} />

    <SubsectionHeader title="The Six-Layer Harness" desc="Modern agentic harnesses (Claude Code, Codex, Cursor, Devin, Goose) wrap the model with six functional layers around a continuous gather → act → verify loop. The model reasons; the harness mediates every action." />
    <div className="harness-grid">
      {stack.harnessLayers.map((l, i) => <div key={i} className="harness-card">
        <div className="harness-card-head"><span className="harness-tier">L{l.tier}</span><span className="harness-icon">{l.icon}</span><h4 className="harness-name">{l.name}</h4></div>
        <div className="harness-purpose">{l.purpose}</div>
        <div className="harness-primitives"><strong>Primitives:</strong> {l.primitives}</div>
      </div>)}
    </div>

    <div className="loop-strip"><div className="loop-strip-inner">
      <div className="loop-title"><span className="loop-title-label">Continuous Loop</span><strong>{stack.loop.title}</strong><span className="loop-desc">{stack.loop.desc}</span></div>
      <div className="loop-phases">
        {stack.loop.phases.map((p, i) => <React.Fragment key={i}>
          <div className="loop-phase"><span className="loop-phase-icon">{p.icon}</span><div className="loop-phase-text"><div className="loop-phase-name">{p.phase}</div><div className="loop-phase-tools">{p.tools}</div></div></div>
          {i < stack.loop.phases.length - 1
            ? <span className="loop-arrow" aria-hidden="true">→</span>
            : <span className="loop-arrow loop-arrow-back" aria-hidden="true">↻</span>}
        </React.Fragment>)}
      </div>
    </div></div>

    <SubsectionHeader title="Open Inter-op Protocols" desc="Two protocols moved from vendor experiments to Linux Foundation standards between 2024 and 2025, defining the tool↔model and agent↔agent integration layers." />
    <div className="protocol-grid">
      {stack.protocols.map((p, i) => <div key={i} className="protocol-card">
        <div className="protocol-head"><h4 className="protocol-name">{p.name}</h4><span className="protocol-released">{p.released}</span></div>
        <div className="protocol-owner">{p.owner}</div>
        <p className="protocol-purpose">{p.purpose}</p>
        <ul className="protocol-stats">{p.stats.map((s, j) => <li key={j}>{s}</li>)}</ul>
        <a className="protocol-link" href={p.link} target="_blank" rel="noopener">View source ↗</a>
      </div>)}
    </div>

    <SubsectionHeader title="Memory Architectures" desc={'Memory is now a first-class primitive. Three vendors ship three distinct default architectures (filesystem, identity-database, vector-store); three frameworks compete on the LongMemEval benchmark; Anthropic\'s "Dreaming" introduces async hippocampal consolidation between sessions.'} />
    <Table headers={["Memory System","Type","License","Score","Highlight"]}
      rows={stack.memoryArchitectures.map((m) => [
        <span className="text-primary-color"><a href={m.link} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px dashed var(--border-hover)" }}>{m.name}</a></span>,
        m.type,
        <span className="license-tag">{m.license}</span>,
        <React.Fragment><span className="memory-score">{m.score}</span><div style={{ fontSize: "0.7rem", color: "var(--text-faint)" }}>{m.scoreLabel}</div></React.Fragment>,
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{m.highlight}</span>,
      ])} />

    <SubsectionHeader title="Multi-Agent Orchestration Frameworks" desc="Four frameworks dominate enterprise multi-agent deployments. The market is shifting from framework-locked solutions to protocol-first designs (Paperclip ACP, A2A) — driven by enterprise demand for portability across vendors." />
    <Table style={{ marginBottom: "1.25rem" }}
      headers={["Framework","Vendor","GitHub Stars","PyPI / mo","Approach","Best For"]}
      rows={stack.frameworks.map((f) => [
        <span className="text-primary-color">{f.name}</span>, f.vendor,
        <strong style={{ color: "var(--text-main)" }}>{f.stars}</strong>, f.downloads,
        <span className="approach-tag">{f.approach}</span>,
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{f.best}</span>,
      ])} />
    <div className="adoption-strip"><div className="adoption-row">
      <div className="adoption-cell"><div className="adoption-num">{a.experimenting}</div><div className="adoption-label">{a.experimentingLabel}</div></div>
      <div className="adoption-divider" aria-hidden="true"></div>
      <div className="adoption-cell"><div className="adoption-num adoption-num-prod">{a.production}</div><div className="adoption-label">{a.productionLabel}</div></div>
      <a className="adoption-source" href={a.source} target="_blank" rel="noopener">{a.sourceLabel} ↗</a>
    </div></div>

    <SubsectionHeader title="Agentic Coding: The Killer App" desc="The agentic-coding category posted the highest valuations and ARR growth rates in private AI in early 2026. Computer-use agents — closed and open — crossed the 72.4% human OSWorld baseline." />
    <MarketGrid items={stack.marketTrajectory.map((m) => ({ link: m.link, company: m.company, headline: m.headline, valuation: m.valuation, detail: m.detail }))} />
  </Section>;
}

// ── Hardware ──────────────────────────────────────────────────
function Hardware({ data }) {
  const dc = data.dataCenters;
  return <Section id="hardware" title="The Silicon Interconnect War" desc="Comparison of modular clusters, custom hardware, and interconnect bottlenecks defining physical computing power. All chip specs cross-checked against vendor datasheets and Flopper.io / LLM-stats / DCD reporting (May 2026).">
    <div className="grid-2">
      {data.hardwarePlatforms.map((hw, i) => <div key={i} className="card">
        <h3>{hw.name}</h3>
        <div style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "-0.5rem", marginBottom: "0.4rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{hw.developer}</div>
        {hw.release && <div style={{ fontSize: "0.7rem", color: "var(--secondary)", marginBottom: "1rem", fontWeight: 600 }}>{hw.release}</div>}
        <ul className="card-list">
          <li><strong>Compute:</strong> {hw.capacity}</li>
          <li><strong>Memory:</strong> {hw.memory}</li>
          <li><strong>Interconnect:</strong> {hw.bandwidth}</li>
          <li><strong style={{ color: "var(--secondary)" }}>Advantage:</strong> {hw.advantage}</li>
          <li><strong style={{ color: "var(--accent-warm)" }}>Bottleneck:</strong> {hw.bottleneck}</li>
        </ul>
      </div>)}
    </div>
    {dc && <React.Fragment>
      <SubsectionHeader kicker={dc.kicker} title={dc.title} desc={dc.intro} />
      <StatStrip stats={dc.stats} />
      <MarketGrid style={{ marginTop: "1.75rem" }}
        items={dc.projects.map((p) => ({ link: p.link, company: p.name, headline: p.scope, headlineStyle: { fontSize: "0.95rem" }, detail: p.highlight, detailStyle: { marginTop: "0.85rem" } }))} />
    </React.Fragment>}
  </Section>;
}

// ── Economics ─────────────────────────────────────────────────
function Economics({ econ }) {
  const [cost, setCost] = useState(2275);
  const centralized = cost * 12;
  const sovereign = Math.round(centralized / 13.5);
  const usd = (n) => "$" + n.toLocaleString();
  return <Section id="economics" title="The Strategic Deployment Economics" desc="Comparing metered cloud services to self-hosted open architectures.">
    <Table style={{ marginBottom: "3rem" }}
      headers={["Operational Dimension","Centralized API Model (e.g. OpenAI, Anthropic)","Sovereign Open-Weight Infrastructure"]}
      rows={econ.dimensions.map((d) => [
        <span className="text-primary-color">{d.dimension}</span>, d.centralized,
        <span style={{ color: "var(--secondary)", fontWeight: 600 }}>{d.sovereign}</span>,
      ])} />
    <div className="grid-2">
      <div className="card calc-container">
        <h3>Sovereign Infrastructure Savings</h3>
        <p className="card-desc">Estimate monthly API spending to calculate sovereign hosting savings (13.5x deflation factor).</p>
        <div className="slider-group">
          <div className="slider-labels"><span>Monthly API Spending</span>
            <strong style={{ color: "var(--primary)", fontSize: "1rem" }}>${cost.toLocaleString()}/mo</strong></div>
          <input type="range" min="100" max="50000" step="100" value={cost} className="premium-slider" onInput={(e) => setCost(+e.target.value)} />
        </div>
        <div className="calc-results">
          <div className="calc-box"><div className="calc-val">{usd(centralized)}</div><div className="calc-lbl">Annual Centralized Cost</div></div>
          <div className="calc-box highlight"><div className="calc-val">{usd(sovereign)}</div><div className="calc-lbl">Sovereign Cost</div></div>
          <div className="calc-box highlight"><div className="calc-val">{usd(centralized - sovereign)}</div><div className="calc-lbl">Annual Savings</div></div>
        </div>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h3>CAGR Projection</h3>
        <p className="card-desc" style={{ fontSize: "0.85rem" }}>{econ.cagrDetails}</p>
        <div style={{ background: "var(--surface-alt)", padding: "1.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", textAlign: "center" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", display: "block", marginBottom: "0.5rem" }}>Projected 2026 Valuation</span>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", color: "var(--primary)" }}>{econ.cagrProjected2026Valuation}</strong>
        </div>
      </div>
    </div>
  </Section>;
}

// ── Industry ──────────────────────────────────────────────────
function Industry({ ind }) {
  if (!ind) return null;
  return <Section id="industry" title={ind.title} desc={ind.intro} kicker={ind.kicker}>
    <StatStrip stats={ind.stats} />
    <SubsectionHeader title={ind.pricingShift.title} desc={ind.pricingShift.desc} />
    <Table headers={["Dimension","Legacy SaaS (per-seat)","Agentic Era (consumption / outcome)"]}
      rows={ind.pricingShift.rows.map((r) => [
        <span className="text-primary-color">{r.dimension}</span>, r.legacy,
        <span style={{ color: "var(--secondary)", fontWeight: 600 }}>{r.agentic}</span>,
      ])} />
    <SubsectionHeader title="How the Giants Are Repositioning" desc="Each major software platform is taking a distinct stance on the agent transition — from infrastructure orchestration (AWS) to vertical integration (Microsoft) to consumption-priced agent platforms (Salesforce) to model-vendor compute lock-in (Anthropic + OpenAI)." />
    <MarketGrid items={ind.giantMoves.map((g) => ({ link: g.link, company: g.company, headline: g.headline, valuation: g.stance, detail: g.detail }))} />
    <SubsectionHeader title="The Pullback Signals" desc="Not every story is up-and-to-the-right. Three signals show where agent autonomy is hitting cost, reliability, or ROI ceilings — and where humans are coming back into the loop." />
    <MarketGrid items={ind.pullbacks.map((p) => ({ link: p.link, company: p.name, companyStyle: { color: "var(--accent-warm)" }, headline: p.trend, headlineStyle: { fontSize: "1rem" }, detail: p.detail, detailStyle: { marginTop: "0.85rem" }, cardStyle: { borderLeft: "3px solid var(--accent-warm)" } }))} />
  </Section>;
}

// ── Engineers ─────────────────────────────────────────────────
function Engineers({ eng }) {
  if (!eng) return null;
  const cta = (href, icon, kicker, title, desc) => <a className="playbook-cta" href={href} target="_blank" rel="noopener">
    <div className="playbook-cta-icon" aria-hidden="true">{icon}</div>
    <div className="playbook-cta-body"><div className="playbook-cta-kicker">{kicker}</div><div className="playbook-cta-title">{title}</div><div className="playbook-cta-desc">{desc}</div></div></a>;
  return <Section id="engineers" title={eng.title} desc={eng.subtitle} kicker={eng.kicker}>
    <p className="eng-intro">{eng.intro}</p>
    <StatStrip stats={eng.stats} />
    <div className="playbook-cta-pair">
      {cta("talk.html", "📋", "Delivering this as a talk?", "Open the Talking Points →", "20-minute script for software developers. Per-beat opener, key data, on-stage cues, transitions, and Q&A prep.")}
      {cta("live-demo.html", "▶", "Show, don't tell", "Open the Live In-Browser Demo →", "Real frontier-class small LLM running 100% on your laptop via WebGPU. No API keys, works offline. Five demos, one model.")}
    </div>
    <SubsectionHeader title="The 5 Inflection Points" desc="Five structurally different things that didn't exist 12 months ago — each with verified evidence and the daily-work implication." />
    <div className="shifts-stack"><ShiftCards shifts={eng.shifts} /></div>
    <SubsectionHeader title="The New Disciplines" desc="Four skills that appreciated fastest in 2026 — what your team should actually invest in this year." />
    <DisciplineGrid items={eng.disciplines} />
    <SubsectionHeader title="Reality Check" desc="Honest tradeoffs. Engineers smell hype instantly — these are the inconvenient findings worth leading with." />
    <RealityGrid items={eng.realityCheck} />
    <SubsectionHeader title="Starter Kit · Reading List" desc="Sources cited above, plus the canonical reading for engineers who want to go deeper." />
    <div className="resource-pills">
      {eng.resources.map((r, i) => <a key={i} className="resource-pill" href={r.link} target="_blank" rel="noopener">{r.label}</a>)}
    </div>
    <div className="playbook-cta-footer">
      <a className="playbook-cta-link" href="talk.html" target="_blank" rel="noopener">Open the Talking Points →</a>
      <span className="present-footer-divider" aria-hidden="true">·</span>
      <a className="playbook-cta-link" href="live-demo.html" target="_blank" rel="noopener">Open the Live Demo →</a>
    </div>
  </Section>;
}

// ── Workforce ─────────────────────────────────────────────────
function Workforce({ items }) {
  return <Section id="workforce" title="Workforce & Revenue Efficiency" desc="Deflationary trends, corporate re-architecting, and sector transformations.">
    <div className="grid-2">{items.map((d, i) => <div key={i} className="card">
      <h3>{d.metric}</h3>
      <ul className="card-list">
        <li><strong>Pre-AI Baseline:</strong> {d.baseline}</li>
        <li><strong>2026 Impact:</strong> {d.impact}</li>
        <li><strong style={{ color: "var(--secondary)" }}>Driver:</strong> {d.driver}</li>
      </ul>
    </div>)}</div>
  </Section>;
}

// ── Legal ─────────────────────────────────────────────────────
function Legal({ items }) {
  return <Section id="legal" title="The Regurgitation Debate & Licensing" desc="Legal cases, exact copying disputes, and the transition to structured partnerships.">
    <div className="grid-2">{items.map((l, i) => <div key={i} className="card" style={{ borderTop: "2px solid var(--primary)" }}>
      <h3>{l.case}</h3>
      <div style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: "-0.5rem", marginBottom: "0.75rem", fontWeight: 600 }}>{l.parties}</div>
      <p className="card-desc" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}><strong>Dispute:</strong> {l.dispute}</p>
      <div style={{ fontSize: "0.82rem", color: "var(--secondary)", fontWeight: 600 }}>Status: {l.resolution}</div>
    </div>)}</div>
  </Section>;
}

// ── Security ──────────────────────────────────────────────────
function Security({ data }) {
  return <Section id="security" title="Geopolitics & Cybersecurity Threat Profile" desc="Contrasting regulatory regimes, deepfakes, internal shadow endpoints, and Zero-Trust defenses.">
    <Table style={{ marginBottom: "2rem" }}
      headers={["Strategic Dimension","European Union (Audits & Bans)","United States (Deregulation & Preemption)"]}
      rows={data.cybersecurityAndGeopolitics.categories.map((c) => [
        <span className="text-primary-color">{c.category}</span>, c.eu,
        <span style={{ color: "var(--secondary)", fontWeight: 500 }}>{c.us}</span>,
      ])} />
    <div className="card" style={{ borderLeft: "3px solid var(--primary)" }}>
      <h3>Enterprise Architecture Guidelines</h3>
      <p className="card-desc" style={{ marginBottom: 0 }}>Securing operations requires hybrid architectures: centralized APIs for complex deliberation tasks, open-weight systems locally for proprietary workflows. Zero-Trust networks must enforce out-of-band verification (OOBV) on all wire transfers and critical database mutations.</p>
    </div>
  </Section>;
}

// ── System 2 Modal ────────────────────────────────────────────
function System2Modal({ data, open, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("modal-open");
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!data) return null;
  const pills = (list) => <div className="s2-source-pills">{list.map((s, i) => <a key={i} className="s2-source-pill" href={s.link} target="_blank" rel="noopener">{s.name}</a>)}</div>;
  return <div className={"info-modal-backdrop" + (open ? " is-open" : "")} role="dialog" aria-modal="true" aria-hidden={String(!open)} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="info-modal" role="document">
      <button className="info-modal-close" ref={closeRef} aria-label="Close explainer" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
      </button>
      <header className="info-modal-header">
        <div className="info-modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2a4 4 0 0 0-4 4c0 1 .3 1.9.8 2.7L8 10v5h2v6h4v-6h2v-5l-.8-1.3A4 4 0 0 0 12 2zM10 23h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="12" cy="6" r="1.3" fill="currentColor"/></svg>
        </div>
        <div><div className="info-modal-kicker">{data.kicker}</div><h2 className="info-modal-title">{data.title}</h2><p className="info-modal-subtitle">{data.subtitle}</p></div>
      </header>
      <div className="info-modal-body">
        <div className="s2-tldr">{data.tldr}</div>
        <section className="s2-section"><h3 className="s2-section-heading">{data.origin.heading}</h3><p className="s2-section-body">{data.origin.body}</p>{pills(data.origin.sources)}</section>
        <section className="s2-section"><h3 className="s2-section-heading">{data.comparison.heading}</h3>
          <div className="s2-compare-grid">
            <div className="s2-compare-col s2-compare-col-1"><div className="s2-compare-col-head"><span className="s2-compare-badge">System 1</span><span className="s2-compare-tagline">The gut</span></div>
              <ul className="s2-compare-list">{data.comparison.rows.map((r, i) => <li key={i}><strong>{r.axis}</strong>{r.s1}</li>)}</ul></div>
            <div className="s2-compare-divider" aria-hidden="true"><span>vs</span></div>
            <div className="s2-compare-col s2-compare-col-2"><div className="s2-compare-col-head"><span className="s2-compare-badge s2-compare-badge-2">System 2</span><span className="s2-compare-tagline">The deliberation</span></div>
              <ul className="s2-compare-list">{data.comparison.rows.map((r, i) => <li key={i}><strong>{r.axis}</strong>{r.s2}</li>)}</ul></div>
          </div>
        </section>
        <section className="s2-section"><h3 className="s2-section-heading">{data.aiCrossover.heading}</h3><p className="s2-section-body">{data.aiCrossover.body}</p><div className="s2-callout">{data.aiCrossover.argument}</div>{pills(data.aiCrossover.sources)}</section>
        <section className="s2-section"><h3 className="s2-section-heading">What "System 2" means in modern AI</h3>
          <div className="s2-meaning-grid">{data.modernMeaning.map((m, i) => <div key={i} className="s2-meaning-card"><div className="s2-meaning-card-num">0{i + 1}</div><div className="s2-meaning-card-title">{m.title}</div><div className="s2-meaning-card-desc">{m.desc}</div></div>)}</div>
        </section>
        <section className="s2-section"><h3 className="s2-section-heading">Landmark releases</h3>
          <ol className="s2-timeline">{data.landmarks.map((l, i) => <li key={i} className="s2-timeline-item"><div className="s2-timeline-head"><a className="s2-timeline-name" href={l.link} target="_blank" rel="noopener">{l.name}</a><span className="s2-timeline-date">{l.date}</span></div><div className="s2-timeline-note">{l.note}</div></li>)}</ol>
        </section>
        <section className="s2-section s2-caveat"><h3 className="s2-section-heading">{data.caveat.heading}</h3><p className="s2-section-body">{data.caveat.body}</p></section>
      </div>
    </div>
  </div>;
}

// ── Root App ──────────────────────────────────────────────────
function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [active, setActive] = useState("overview");
  const [s2Open, setS2Open] = useState(false);

  useEffect(() => { loadData().then(setData).catch((e) => setErr(e.message)); }, []);

  useEffect(() => {
    if (!data) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.isIntersecting && setActive(e.target.id));
    }, { threshold: 0.15, rootMargin: "-80px 0px -40% 0px" });
    document.querySelectorAll("section[id]").forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [data]);

  const onNav = (e, id) => {
    e.preventDefault();
    const sec = document.getElementById(id);
    if (!sec) return;
    viewTransition(() => {
      setActive(id);
      sec.scrollIntoView({ behavior: "smooth", block: "start" });
      sec.querySelector(".section-title")?.focus();
    });
  };

  const [theme, setTheme] = useTheme();
  if (err) return <FatalError message="Failed to load data.json." />;
  if (!data) return <div className="hero"><p>Loading detailed retrospective insights…</p></div>;

  return <S2Ctx.Provider value={() => setS2Open(true)}>
    <div className="app-container">
      <Sidebar active={active} onNav={onNav} theme={theme} setTheme={setTheme} />
      <ThemeToggleMobile theme={theme} setTheme={setTheme} />
      <main>
        <Hero data={data} />
        <Overview shifts={data.macroShifts} />
        <Timeline data={data} />
        <Models data={data} />
        <Stack stack={data.agenticStack} />
        <Hardware data={data} />
        <Economics econ={data.economicsSplit} />
        <Industry ind={data.industryShift} />
        <Engineers eng={data.engineersUpdate} />
        <Workforce items={data.deflationaryImpact} />
        <Legal items={data.legalLitigation} />
        <Security data={data} />
        <footer style={{ textAlign: "center", color: "var(--text-faint)", fontSize: "0.75rem", marginTop: "4rem", borderTop: "1px solid var(--border)", paddingTop: "2rem", paddingBottom: "2rem" }}>
          <p>Strategic Retrospective of Cognitive Systems (2022–2026)</p>
          <p style={{ marginTop: "0.25rem" }}>Compiled from industry sources. Last updated May 2026.</p>
        </footer>
      </main>
      <System2Modal data={data.system2Explainer} open={s2Open} onClose={() => setS2Open(false)} />
      <MobileNav active={active} onNav={onNav} />
    </div>
  </S2Ctx.Provider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
