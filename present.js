const { useState, useEffect, useRef } = React;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.getAttribute("data-theme") || "light");
  const apply = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("ai-report-theme", t); } catch (e) { /* noop */ }
    setTheme(t);
  };
  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button className={`theme-toggle-btn${theme === "light" ? " active" : ""}`} onClick={() => apply("light")} aria-label="Light theme">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        Light
      </button>
      <button className={`theme-toggle-btn${theme === "dark" ? " active" : ""}`} onClick={() => apply("dark")} aria-label="Dark theme">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        Dark
      </button>
    </div>
  );
}

function Hero({ playbook }) {
  return (
    <header className="present-hero">
      <div className="present-kicker">{playbook.kicker}</div>
      <h1 className="present-title">{playbook.title}</h1>
      <p className="present-subtitle">{playbook.subtitle}</p>
      <p className="present-intro">{playbook.intro}</p>
      <div className="present-meta">
        <div className="present-meta-item"><div className="present-meta-label">Total time</div><div className="present-meta-value">{playbook.totalTime}</div></div>
        <div className="present-meta-item"><div className="present-meta-label">Audience</div><div className="present-meta-value">{playbook.audience}</div></div>
        <div className="present-meta-item"><div className="present-meta-label">Format</div><div className="present-meta-value">{playbook.format}</div></div>
      </div>
    </header>
  );
}

function PrepGrid({ items }) {
  return (
    <section className="present-section">
      <h2 className="present-section-heading">Preparation Checklist</h2>
      <p className="present-section-desc">Do these before the talk. Each one earns 5–10 minutes of credibility on stage.</p>
      <div className="prep-grid">
        {items.map((p, i) => (
          <div className="prep-card" key={i}>
            <div className="prep-num">P{i + 1}</div>
            <div className="prep-body"><div className="prep-title">{p.title}</div><div className="prep-desc">{p.desc}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowStrip({ steps }) {
  return (
    <section className="present-section">
      <h2 className="present-section-heading">The Update Flow</h2>
      <p className="present-section-desc">Six steps for delivering this content to a senior engineering audience without losing them in the first ten minutes.</p>
      <ol className="flow-strip">
        {steps.map((f, i) => (
          <li className="flow-step" key={i}>
            <div className="flow-step-num">{f.num}</div>
            <div className="flow-step-body"><div className="flow-step-title">{f.title}</div><div className="flow-step-desc">{f.desc}</div></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TimeGrid({ items }) {
  return (
    <section className="present-section">
      <h2 className="present-section-heading">Time Allocation</h2>
      <p className="present-section-desc">Recommended pacing for a tight 20-minute talk plus 5-minute Q&A buffer. Two demos do the heavy lifting — keep the inflection-point overview deliberately brief.</p>
      <div className="time-grid">
        {items.map((t, i) => (
          <div className={`time-card time-card-${t.color || "primary"}`} key={i}>
            <div className="time-step">{t.step}</div><div className="time-title">{t.title}</div><div className="time-minutes">{t.minutes}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionPlan({ plan }) {
  return (
    <section className="present-section">
      <h2 className="present-section-heading">{plan.title}</h2>
      <p className="present-section-desc">{plan.subtitle}</p>
      <div className="action-plan-grid">
        {plan.items.map((a, i) => (
          <div className="action-card" key={i}>
            <div className="action-week">{a.label}</div><div className="action-title">{a.title}</div>
            <div className="action-desc">{a.desc}</div><div className="action-tools">{a.tools}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QAPrep({ items }) {
  return (
    <section className="present-section">
      <h2 className="present-section-heading">Q&amp;A Prep</h2>
      <p className="present-section-desc">Six anticipated questions and suggested answers. Read once before the talk; you'll get at least four of these.</p>
      <div className="qa-list">
        {items.map((qa, i) => (
          <details className="qa-item" key={i}>
            <summary className="qa-question">
              <span className="qa-num">Q{i + 1}</span><span className="qa-q-text">{qa.q}</span><span className="qa-chevron" aria-hidden="true">▸</span>
            </summary>
            <div className="qa-answer">{qa.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function StepRow({ s }) {
  switch (s.kind) {
    case "thinking": return <div className="step-row step-thinking"><span className="step-icon">◆</span><span className="step-text">{s.text}</span></div>;
    case "spawn": return <div className="step-row step-spawn"><span className="step-icon">↳</span><span className="step-text"><span className="mono">{s.text}</span></span></div>;
    case "tool": return <div className="step-row step-tool"><span className="step-icon">⚙</span><span className="step-text"><span className="step-tool-name">{s.tool}</span><span className="step-tool-args">({s.args})</span></span></div>;
    case "result": return <div className="step-row step-result"><span className="step-icon">→</span><span className="step-text">{s.text}</span></div>;
    case "diff": return <div className="step-row step-diff"><pre className="step-diff-pre">{s.text}</pre></div>;
    case "done": return <div className="step-row step-done"><span className="step-icon">✓</span><span className="step-text"><strong>{s.text}</strong></span></div>;
    default: return <div className="step-row"><span className="step-text">{s.text || ""}</span></div>;
  }
}

function AgentDemo({ cfg }) {
  const [selectedTask, setSelectedTask] = useState(cfg.tasks[0].id);
  const [runState, setRunState] = useState("idle");
  const [panes, setPanes] = useState({ orch: [], researcher: [], implementer: [], reviewer: [] });
  const [meta, setMeta] = useState("");
  const [typingAgent, setTypingAgent] = useState(null);
  const tokenRef = useRef(0);

  const clearStage = () => { setPanes({ orch: [], researcher: [], implementer: [], reviewer: [] }); setMeta(""); setTypingAgent(null); };

  const runLoop = async () => {
    if (runState === "running") return;
    setRunState("running");
    tokenRef.current += 1;
    const myToken = tokenRef.current;
    clearStage();
    const script = cfg.scripts[selectedTask] || [];
    const start = performance.now();
    let toolCount = 0;
    const acc = { orch: [], researcher: [], implementer: [], reviewer: [] };

    for (const step of script) {
      setTypingAgent(step.agent);
      await sleep(step.delay || 300);
      if (myToken !== tokenRef.current) return;
      setTypingAgent(null);
      acc[step.agent] = [...acc[step.agent], step];
      setPanes({ ...acc });
      if (step.kind === "tool") toolCount += 1;
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      setMeta(`elapsed ${elapsed}s · ${toolCount} tool calls`);
    }
    setRunState("done");
  };

  const reset = () => { tokenRef.current += 1; setRunState("idle"); clearStage(); };

  return (
    <div className="idemo-panel active" data-panel="agent" role="tabpanel">
      <div className="idemo-panel-head">
        <div className="idemo-inflection">{cfg.inflection}</div>
        <h3 className="idemo-panel-title">{cfg.headline}</h3>
        <p className="idemo-panel-blurb">{cfg.blurb}</p>
      </div>
      <div className="idemo-controls">
        <label className="idemo-label">Choose a task</label>
        <div className="idemo-task-row">
          {cfg.tasks.map((t) => (
            <button key={t.id} className={`agent-task-btn${t.id === selectedTask ? " active" : ""}`} onClick={() => { if (runState !== "running") { setSelectedTask(t.id); clearStage(); } }}>
              <div className="agent-task-label">{t.label}</div><div className="agent-task-stack">{t.stack}</div>
            </button>
          ))}
        </div>
        <div className="idemo-actions">
          <button className="idemo-run" disabled={runState === "running"} onClick={runLoop}>{runState === "running" ? "● Running" : runState === "done" ? "▶ Run again" : "▶ Run agent loop"}</button>
          <button className="idemo-reset" disabled={runState === "running"} onClick={reset}>↻ Reset</button>
          {meta && <span className="idemo-meta">{meta}</span>}
        </div>
      </div>
      <div className="idemo-stage agent-stage">
        {["orch", "researcher", "implementer", "reviewer"].map((agent) => (
          <AgentPane key={agent} agent={agent} steps={panes[agent]} typing={typingAgent === agent} />
        ))}
      </div>
    </div>
  );
}

function AgentPane({ agent, steps, typing }) {
  const labels = { orch: "Orchestrator", researcher: "Researcher · sub-agent", implementer: "Implementer · sub-agent", reviewer: "Reviewer · sub-agent" };
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [steps, typing]);
  return (
    <div className="agent-pane" data-agent={agent}>
      <div className="agent-pane-head"><span className={`agent-dot ${agent}-dot`}></span> {labels[agent]}</div>
      <div className="agent-pane-body" ref={ref}>
        {steps.length === 0 && !typing && <span className="agent-pane-empty">waiting…</span>}
        {steps.map((s, i) => <div className="agent-step" key={i}><StepRow s={s} /></div>)}
        {typing && <div className="agent-typing"><span></span><span></span><span></span></div>}
      </div>
    </div>
  );
}

function ReasoningDemo({ cfg }) {
  const [idx, setIdx] = useState(0);
  const [output, setOutput] = useState("");
  const [typing, setTyping] = useState(false);
  const tokenRef = useRef(0);

  const level = cfg.levels[idx];

  useEffect(() => {
    tokenRef.current += 1;
    const myToken = tokenRef.current;
    setOutput("");
    setTyping(true);
    const text = level.output;
    const charDelay = Math.max(2, 20 - idx * 4);
    let i = 0;
    const tick = () => {
      if (myToken !== tokenRef.current) return;
      const batch = Math.max(1, Math.round(3));
      const end = Math.min(text.length, i + batch);
      setOutput(text.slice(0, end));
      i = end;
      if (i < text.length) setTimeout(tick, charDelay);
      else setTyping(false);
    };
    tick();
  }, [idx]);

  return (
    <div className="idemo-panel" data-panel="reasoning" role="tabpanel">
      <div className="idemo-panel-head">
        <div className="idemo-inflection">{cfg.inflection}</div>
        <h3 className="idemo-panel-title">{cfg.headline}</h3>
        <p className="idemo-panel-blurb">{cfg.blurb}</p>
      </div>
      <div className="reasoning-prompt-row">
        <div className="reasoning-prompt-label">{cfg.prompt}</div>
        <pre className="reasoning-code">{cfg.code}</pre>
      </div>
      <div className="reasoning-controls">
        <label className="idemo-label">Reasoning effort</label>
        <input type="range" min="0" max={cfg.levels.length - 1} value={idx} step="1" className="reasoning-slider" onChange={(e) => setIdx(Number(e.target.value))} />
        <div className="reasoning-ticks">
          {cfg.levels.map((l, i) => <span key={i} className={`reasoning-tick${i === idx ? " active" : ""}`}>{l.label}</span>)}
        </div>
      </div>
      <div className="reasoning-output-row">
        <div className="reasoning-stats">
          <div className="reasoning-stat"><div className="reasoning-stat-num">{level.tokens.toLocaleString()}</div><div className="reasoning-stat-label">tokens</div></div>
          <div className="reasoning-stat"><div className="reasoning-stat-num">{(level.latencyMs / 1000).toFixed(1)}s</div><div className="reasoning-stat-label">latency</div></div>
          <div className="reasoning-stat"><div className="reasoning-stat-num">${level.costUsd.toFixed(4)}</div><div className="reasoning-stat-label">cost</div></div>
          <div className="reasoning-stat reasoning-stat-issues"><div className="reasoning-stat-num">{level.issuesFound}</div><div className="reasoning-stat-label">issues found</div></div>
        </div>
        <pre className={`reasoning-output${typing ? " typing" : ""}`}>{output}</pre>
        <div className="reasoning-summary">{level.summary}</div>
      </div>
    </div>
  );
}

function McpDemo({ cfg }) {
  const [activeCat, setActiveCat] = useState("all");
  const [query, setQuery] = useState("");
  const [attached, setAttached] = useState(new Set());
  const CONTEXT_BUDGET = 128000;

  const toggle = (id) => {
    const next = new Set(attached);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAttached(next);
  };
  const detach = (id) => { const next = new Set(attached); next.delete(id); setAttached(next); };

  const filtered = cfg.servers.filter((s) => {
    if (activeCat !== "all" && s.category !== activeCat) return false;
    if (query && !(s.name + " " + s.desc).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const items = [...attached].map((id) => cfg.servers.find((s) => s.id === id)).filter(Boolean);
  const totalTools = items.reduce((a, b) => a + b.tools, 0);
  const totalCtx = items.reduce((a, b) => a + b.ctx, 0);
  const pct = Math.min(100, (totalCtx / CONTEXT_BUDGET) * 100);

  return (
    <div className="idemo-panel" data-panel="mcp" role="tabpanel">
      <div className="idemo-panel-head">
        <div className="idemo-inflection">{cfg.inflection}</div>
        <h3 className="idemo-panel-title">{cfg.headline}</h3>
        <p className="idemo-panel-blurb">{cfg.blurb}</p>
      </div>
      <div className="mcp-toolbox">
        <div className="mcp-toolbox-head">
          <div className="mcp-toolbox-title">Active toolbox</div>
          <div className="mcp-toolbox-stats">{items.length} server{items.length === 1 ? "" : "s"} · {totalTools} tool{totalTools === 1 ? "" : "s"} · ~{(totalCtx / 1000).toFixed(1)}k ctx</div>
        </div>
        <div className="mcp-toolbox-list">
          {items.length === 0 ? <span className="mcp-toolbox-empty">Click servers below to attach them.</span> :
            items.map((s) => <span className="mcp-toolbox-chip" key={s.id}>{s.name} <span className="mcp-toolbox-chip-x" onClick={() => detach(s.id)}>×</span></span>)}
        </div>
        <div className="mcp-context-bar"><div className={`mcp-context-fill${pct > 90 ? " danger" : pct > 70 ? " warn" : ""}`} style={{ width: pct + "%" }}></div></div>
        <div className="mcp-context-caption">{pct.toFixed(1)}% of 128k context window · registry: {cfg.registrySize.toLocaleString()} servers</div>
      </div>
      <div className="mcp-search-row">
        <input type="text" className="mcp-search" placeholder="Search 54,450 MCP servers (e.g. 'postgres' or 'github')…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="mcp-cats">
          {cfg.categories.map((c) => <button key={c.id} className={`mcp-cat${c.id === activeCat ? " active" : ""}`} onClick={() => setActiveCat(c.id)}>{c.label}</button>)}
        </div>
      </div>
      <div className="mcp-grid">
        {filtered.length === 0 ? <div className="mcp-empty">No servers match. Try a different category or clear search.</div> :
          filtered.map((s) => (
            <div className={`mcp-card${attached.has(s.id) ? " attached" : ""}`} key={s.id}>
              <div className="mcp-card-head"><span className="mcp-card-name">{s.name}</span><span className="mcp-card-tools">{s.tools} tools</span></div>
              <div className="mcp-card-desc">{s.desc}</div>
              <div className="mcp-card-foot"><span className="mcp-card-cat">{cfg.categories.find((c) => c.id === s.category)?.label || s.category}</span><span className="mcp-card-ctx">~{(s.ctx / 1000).toFixed(1)}k ctx</span></div>
              <button className="mcp-card-btn" onClick={() => toggle(s.id)}>{attached.has(s.id) ? "Attached ✓" : "Attach"}</button>
            </div>
          ))}
      </div>
    </div>
  );
}

function RaceDemo({ cfg }) {
  const [selectedPrompt, setSelectedPrompt] = useState(cfg.prompts[0].id);
  const [runState, setRunState] = useState("idle");
  const [lanes, setLanes] = useState({});
  const [summaryText, setSummary] = useState("");
  const tokenRef = useRef(0);

  const resetLanes = () => {
    const init = {};
    cfg.models.forEach((m) => { init[m.id] = { text: "", pct: 0, tps: "—", time: "—", cost: "—", done: false }; });
    setLanes(init);
    setSummary("");
  };

  useEffect(resetLanes, [selectedPrompt]);

  const runRace = async () => {
    if (runState === "running") return;
    setRunState("running");
    tokenRef.current += 1;
    const myToken = tokenRef.current;
    resetLanes();
    const responses = cfg.responses[selectedPrompt] || {};

    const streamLane = async (model) => {
      const text = responses[model.id] || "";
      const charsPerSec = model.tps * 4;
      const start = performance.now();
      let chars = 0;
      const total = text.length;
      while (chars < total) {
        if (myToken !== tokenRef.current) return { name: model.name, totalSec: 0, cost: 0 };
        const batch = Math.max(1, Math.round(charsPerSec / 30));
        const end = Math.min(total, chars + batch);
        chars = end;
        const now = performance.now();
        const elapsed = (now - start) / 1000;
        const tokenCount = chars * 0.25;
        setLanes((prev) => ({ ...prev, [model.id]: {
          text: text.slice(0, chars), pct: ((chars / total) * 100).toFixed(2),
          tps: (tokenCount / Math.max(0.001, elapsed)).toFixed(0),
          time: elapsed.toFixed(1) + "s",
          cost: "$" + ((tokenCount / 1000000) * model.costPerM).toFixed(5), done: false
        }}));
        await sleep(33);
      }
      const totalSec = (performance.now() - start) / 1000;
      const totalTokens = total * 0.25;
      const cost = (totalTokens / 1000000) * model.costPerM;
      setLanes((prev) => ({ ...prev, [model.id]: {
        text, pct: "100", tps: (totalTokens / totalSec).toFixed(0),
        time: totalSec.toFixed(2) + "s", cost: "$" + cost.toFixed(5), done: true
      }}));
      return { name: model.name, totalSec, cost };
    };

    const results = await Promise.all(cfg.models.map((m) => streamLane(m)));
    if (myToken !== tokenRef.current) return;
    const sorted = [...results].sort((a, b) => a.totalSec - b.totalSec);
    setSummary(`${sorted[0].name} finished first (${sorted[0].totalSec.toFixed(2)}s · $${sorted[0].cost.toFixed(5)}). The slowest model (${sorted[3].name}) finished in ${sorted[3].totalSec.toFixed(2)}s — within ${(((sorted[3].totalSec - sorted[0].totalSec) / sorted[0].totalSec) * 100).toFixed(0)}% of the leader. The cost spread is ${(sorted[3].cost / Math.max(0.000001, sorted[0].cost)).toFixed(0)}× — open-weight wins on cost, not quality.`);
    setRunState("done");
  };

  const reset = () => { tokenRef.current += 1; setRunState("idle"); resetLanes(); };

  return (
    <div className="idemo-panel" data-panel="race" role="tabpanel">
      <div className="idemo-panel-head">
        <div className="idemo-inflection">{cfg.inflection}</div>
        <h3 className="idemo-panel-title">{cfg.headline}</h3>
        <p className="idemo-panel-blurb">{cfg.blurb}</p>
      </div>
      <div className="race-prompt-row">
        <label className="idemo-label">Pick a prompt</label>
        <div className="race-prompt-buttons">
          {cfg.prompts.map((p) => <button key={p.id} className={`race-prompt-btn${p.id === selectedPrompt ? " active" : ""}`} onClick={() => { if (runState !== "running") setSelectedPrompt(p.id); }}>{p.label}</button>)}
        </div>
        <div className="idemo-actions">
          <button className="idemo-run" disabled={runState === "running"} onClick={runRace}>{runState === "running" ? "● Racing" : runState === "done" ? "▶ Race again" : "▶ Race"}</button>
          <button className="idemo-reset" disabled={runState === "running"} onClick={reset}>↻ Reset</button>
        </div>
      </div>
      <div className="race-track">
        {cfg.models.map((m) => {
          const l = lanes[m.id] || { text: "", pct: 0, tps: "—", time: "—", cost: "—", done: false };
          return (
            <div className={`race-lane race-lane-${m.lane}${l.done ? " race-lane-done" : ""}`} key={m.id}>
              <div className="race-lane-head">
                <div className="race-lane-name">{m.name}</div>
                <div className={`race-lane-tag race-lane-tag-${m.kind}`}>{m.kind === "closed" ? "closed-source" : "open-weight"}</div>
                <div className="race-lane-provider">{m.provider}</div>
              </div>
              <div className="race-lane-stats">
                <span className="race-lane-stat"><span className="race-lane-stat-num">{l.tps}</span> tok/s</span>
                <span className="race-lane-stat"><span className="race-lane-stat-num">{l.time}</span> time</span>
                <span className="race-lane-stat"><span className="race-lane-stat-num">{l.cost}</span> cost</span>
              </div>
              <pre className="race-lane-output">{l.text}</pre>
              <div className="race-lane-bar"><div className="race-lane-bar-fill" style={{ width: l.pct + "%" }}></div></div>
            </div>
          );
        })}
      </div>
      {summaryText && <div className="race-summary"><div className="race-summary-line"><strong>{summaryText}</strong></div></div>}
    </div>
  );
}

function InteractiveDemos({ idemo }) {
  const [activeTab, setActiveTab] = useState(idemo.tabs[0].id);
  const demoCfg = (id) => {
    const map = { agent: idemo.agentDemo, reasoning: idemo.reasoningDemo, mcp: idemo.mcpDemo, race: idemo.raceDemo };
    const d = map[id];
    const tab = idemo.tabs.find((t) => t.id === id);
    return { ...d, inflection: tab?.inflection || "" };
  };
  return (
    <section className="present-section idemo-section">
      <div className="idemo-heading-row">
        <div>
          <div className="idemo-kicker">{idemo.kicker}</div>
          <h2 className="present-section-heading idemo-title">{idemo.title}</h2>
          <p className="present-section-desc">{idemo.subtitle}</p>
        </div>
      </div>
      <div className="idemo-tabs" role="tablist">
        {idemo.tabs.map((t) => (
          <button key={t.id} className={`idemo-tab${t.id === activeTab ? " active" : ""}`} role="tab" aria-selected={t.id === activeTab} onClick={() => setActiveTab(t.id)}>
            <span className="idemo-tab-icon">{t.icon}</span><span className="idemo-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="idemo-panels">
        {activeTab === "agent" && <AgentDemo cfg={demoCfg("agent")} />}
        {activeTab === "reasoning" && <ReasoningDemo cfg={demoCfg("reasoning")} />}
        {activeTab === "mcp" && <McpDemo cfg={demoCfg("mcp")} />}
        {activeTab === "race" && <RaceDemo cfg={demoCfg("race")} />}
      </div>
    </section>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("data.json").then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="present-main"><p style={{ color: "var(--accent-warm)", padding: "3rem 1rem", textAlign: "center" }}>Failed to load data.json. Please serve this page over HTTP.</p></main>;
  if (!data) return null;

  const { presenterPlaybook: playbook, engineersUpdate: eng, interactiveDemos: idemo } = data;
  if (!playbook || !eng || !idemo) return <main className="present-main"><p style={{ color: "var(--accent-warm)", padding: "3rem 1rem", textAlign: "center" }}>Missing presenterPlaybook / engineersUpdate / interactiveDemos in data.json.</p></main>;

  return (
    <main className="present-main">
      <div className="present-topbar">
        <a className="present-back" href="index.html"><span aria-hidden="true">←</span> Back to Report</a>
        <ThemeToggle />
      </div>
      <Hero playbook={playbook} />
      {playbook.preparation && <PrepGrid items={playbook.preparation} />}
      {eng.flowSteps && <FlowStrip steps={eng.flowSteps} />}
      {playbook.timeAllocation && <TimeGrid items={playbook.timeAllocation} />}
      <InteractiveDemos idemo={idemo} />
      {eng.actionPlan && <ActionPlan plan={eng.actionPlan} />}
      {playbook.qaPrep && <QAPrep items={playbook.qaPrep} />}
      <footer className="present-footer"><a className="playbook-cta-link" href="index.html">← Back to the full report content</a></footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
