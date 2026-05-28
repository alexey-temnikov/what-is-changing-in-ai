// ─────────────────────────────────────────────────────────────
// PRESENT.JS · renders Presenter's Playbook + Live Interactive Demos
// 4 demos: Kiro A2A Agent · Reasoning Knob · MCP Catalog · Model Race
// All demos run entirely in-browser with realistic streaming animations.
// ─────────────────────────────────────────────────────────────

(async function () {
  let data;
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error("Failed to load data.json");
    data = await res.json();
  } catch (err) {
    console.error("Initialization error:", err);
    document.body.innerHTML =
      '<main class="present-main"><p style="color:var(--accent-warm); padding:3rem 1rem; text-align:center;">Failed to load data.json. Please serve this page over HTTP (e.g. <code>python3 -m http.server</code>).</p></main>';
    return;
  }

  const playbook = data.presenterPlaybook;
  const eng = data.engineersUpdate;
  const idemo = data.interactiveDemos;
  if (!playbook || !eng || !idemo) {
    document.querySelector(".present-main").innerHTML =
      '<p style="color:var(--accent-warm); padding:3rem 1rem; text-align:center;">Missing presenterPlaybook / engineersUpdate / interactiveDemos in data.json.</p>';
    return;
  }

  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const setT = (id, val) => { const el = $(id); if (el && val !== undefined) el.textContent = val; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  // ── Hero ──
  setT("present-kicker", playbook.kicker);
  setT("present-title", playbook.title);
  setT("present-subtitle", playbook.subtitle);
  setT("present-intro", playbook.intro);
  setT("present-total-time", playbook.totalTime);
  setT("present-audience", playbook.audience);
  setT("present-format", playbook.format);

  // ── Preparation checklist ──
  const prepEl = $("present-prep-target");
  if (prepEl && playbook.preparation) {
    prepEl.innerHTML = playbook.preparation.map((p, i) => `
      <div class="prep-card">
        <div class="prep-num">P${i + 1}</div>
        <div class="prep-body">
          <div class="prep-title">${escapeHtml(p.title)}</div>
          <div class="prep-desc">${escapeHtml(p.desc)}</div>
        </div>
      </div>
    `).join("");
  }

  // ── Update Flow ──
  const flowEl = $("present-flow-target");
  if (flowEl && eng.flowSteps) {
    flowEl.innerHTML = eng.flowSteps.map(f => `
      <li class="flow-step">
        <div class="flow-step-num">${escapeHtml(f.num)}</div>
        <div class="flow-step-body">
          <div class="flow-step-title">${escapeHtml(f.title)}</div>
          <div class="flow-step-desc">${escapeHtml(f.desc)}</div>
        </div>
      </li>
    `).join("");
  }

  // ── Time allocation ──
  const timeEl = $("present-time-target");
  if (timeEl && playbook.timeAllocation) {
    timeEl.innerHTML = playbook.timeAllocation.map(t => `
      <div class="time-card time-card-${t.color || "primary"}">
        <div class="time-step">${escapeHtml(t.step)}</div>
        <div class="time-title">${escapeHtml(t.title)}</div>
        <div class="time-minutes">${escapeHtml(t.minutes)}</div>
      </div>
    `).join("");
  }

  // ── Two-week experiment ──
  setT("present-action-title", eng.actionPlan?.title);
  setT("present-action-subtitle", eng.actionPlan?.subtitle);
  const actionEl = $("present-action-target");
  if (actionEl && eng.actionPlan?.items) {
    actionEl.innerHTML = eng.actionPlan.items.map(a => `
      <div class="action-card">
        <div class="action-week">${escapeHtml(a.label)}</div>
        <div class="action-title">${escapeHtml(a.title)}</div>
        <div class="action-desc">${escapeHtml(a.desc)}</div>
        <div class="action-tools">${escapeHtml(a.tools)}</div>
      </div>
    `).join("");
  }

  // ── Q&A prep ──
  const qaEl = $("present-qa-target");
  if (qaEl && playbook.qaPrep) {
    qaEl.innerHTML = playbook.qaPrep.map((qa, i) => `
      <details class="qa-item">
        <summary class="qa-question">
          <span class="qa-num">Q${i + 1}</span>
          <span class="qa-q-text">${escapeHtml(qa.q)}</span>
          <span class="qa-chevron" aria-hidden="true">▸</span>
        </summary>
        <div class="qa-answer">${escapeHtml(qa.a)}</div>
      </details>
    `).join("");
  }

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE DEMOS · header + tabs
  // ─────────────────────────────────────────────────────────────
  setT("idemo-kicker", idemo.kicker);
  setT("idemo-title", idemo.title);
  setT("idemo-subtitle", idemo.subtitle);

  // Per-panel headlines + blurbs
  $$('[data-headline-for]').forEach(el => {
    const k = el.getAttribute("data-headline-for");
    const map = { agent: idemo.agentDemo, reasoning: idemo.reasoningDemo, mcp: idemo.mcpDemo, race: idemo.raceDemo };
    if (map[k]?.headline) el.textContent = map[k].headline;
  });
  $$('[data-blurb-for]').forEach(el => {
    const k = el.getAttribute("data-blurb-for");
    const map = { agent: idemo.agentDemo, reasoning: idemo.reasoningDemo, mcp: idemo.mcpDemo, race: idemo.raceDemo };
    if (map[k]?.blurb) el.textContent = map[k].blurb;
  });
  $$('[data-inflection-for]').forEach(el => {
    const k = el.getAttribute("data-inflection-for");
    const tab = idemo.tabs.find(t => t.id === k);
    if (tab) el.textContent = tab.inflection;
  });

  // Tabs
  const tabsEl = $("idemo-tabs");
  if (tabsEl) {
    tabsEl.innerHTML = idemo.tabs.map((t, i) => `
      <button class="idemo-tab${i === 0 ? " active" : ""}" data-tab="${t.id}" role="tab" aria-selected="${i === 0}">
        <span class="idemo-tab-icon">${t.icon}</span>
        <span class="idemo-tab-label">${escapeHtml(t.label)}</span>
      </button>
    `).join("");
  }

  function activatePanel(id) {
    $$(".idemo-tab").forEach(b => {
      const on = b.getAttribute("data-tab") === id;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $$(".idemo-panel").forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-panel") === id);
    });
  }
  $$(".idemo-tab").forEach(b => b.addEventListener("click", () => activatePanel(b.getAttribute("data-tab"))));
  activatePanel(idemo.tabs[0].id);

  // ─────────────────────────────────────────────────────────────
  // DEMO 1 · KIRO A2A AGENT LOOP
  // ─────────────────────────────────────────────────────────────
  (function initAgentDemo() {
    const cfg = idemo.agentDemo;
    let selectedTask = cfg.tasks[0].id;
    let runState = "idle"; // idle | running | done
    let runToken = 0;       // increments each run, allows cancellation
    const startTime = { v: 0 };

    const taskRow = $("agent-task-row");
    const runBtn  = $("agent-run");
    const resetBtn = $("agent-reset");
    const meta    = $("agent-meta");
    const panes = {
      orch: $("agent-pane-orch"),
      researcher: $("agent-pane-researcher"),
      implementer: $("agent-pane-implementer"),
      reviewer: $("agent-pane-reviewer"),
    };

    function renderTasks() {
      taskRow.innerHTML = cfg.tasks.map(t => `
        <button class="agent-task-btn${t.id === selectedTask ? " active" : ""}" data-task="${t.id}">
          <div class="agent-task-label">${escapeHtml(t.label)}</div>
          <div class="agent-task-stack">${escapeHtml(t.stack)}</div>
        </button>
      `).join("");
      taskRow.querySelectorAll(".agent-task-btn").forEach(b => {
        b.addEventListener("click", () => {
          if (runState === "running") return;
          selectedTask = b.getAttribute("data-task");
          renderTasks();
          clearStage();
        });
      });
    }
    function clearStage() {
      Object.values(panes).forEach(p => p.innerHTML = '<span class="agent-pane-empty">waiting…</span>');
      meta.textContent = "";
    }
    function appendStep(agent, html) {
      const pane = panes[agent];
      if (!pane) return;
      // Remove the "waiting…" placeholder on first append
      const placeholder = pane.querySelector(".agent-pane-empty");
      if (placeholder) placeholder.remove();
      const div = document.createElement("div");
      div.className = "agent-step";
      div.innerHTML = html;
      pane.appendChild(div);
      // Auto-scroll within pane
      pane.scrollTop = pane.scrollHeight;
    }
    function stepHtml(s) {
      switch (s.kind) {
        case "thinking":
          return `<div class="step-row step-thinking">
                    <span class="step-icon">◆</span>
                    <span class="step-text">${escapeHtml(s.text)}</span>
                  </div>`;
        case "spawn":
          return `<div class="step-row step-spawn">
                    <span class="step-icon">↳</span>
                    <span class="step-text"><span class="mono">${escapeHtml(s.text)}</span></span>
                  </div>`;
        case "tool":
          return `<div class="step-row step-tool">
                    <span class="step-icon">⚙</span>
                    <span class="step-text"><span class="step-tool-name">${escapeHtml(s.tool)}</span><span class="step-tool-args">(${escapeHtml(s.args)})</span></span>
                  </div>`;
        case "result":
          return `<div class="step-row step-result">
                    <span class="step-icon">→</span>
                    <span class="step-text">${escapeHtml(s.text)}</span>
                  </div>`;
        case "diff":
          return `<div class="step-row step-diff">
                    <pre class="step-diff-pre">${escapeHtml(s.text)}</pre>
                  </div>`;
        case "done":
          return `<div class="step-row step-done">
                    <span class="step-icon">✓</span>
                    <span class="step-text"><strong>${escapeHtml(s.text)}</strong></span>
                  </div>`;
        default:
          return `<div class="step-row"><span class="step-text">${escapeHtml(s.text || "")}</span></div>`;
      }
    }
    async function runLoop() {
      if (runState === "running") return;
      runState = "running";
      runToken += 1;
      const myToken = runToken;
      runBtn.disabled = true;
      resetBtn.disabled = true;
      runBtn.textContent = "● Running";
      clearStage();
      const script = cfg.scripts[selectedTask] || [];
      startTime.v = performance.now();
      let toolCount = 0;

      for (const step of script) {
        // Show typing indicator on the current agent
        showTyping(step.agent);
        await sleep(step.delay || 300);
        if (myToken !== runToken) return; // cancelled
        hideTyping(step.agent);
        appendStep(step.agent, stepHtml(step));
        if (step.kind === "tool") toolCount += 1;
        const elapsed = ((performance.now() - startTime.v) / 1000).toFixed(1);
        meta.innerHTML = `<span class="agent-meta-pill">elapsed ${elapsed}s</span> <span class="agent-meta-pill">${toolCount} tool calls</span>`;
      }
      runState = "done";
      runBtn.disabled = false;
      resetBtn.disabled = false;
      runBtn.textContent = "▶ Run again";
    }
    function showTyping(agent) {
      const pane = panes[agent];
      if (!pane) return;
      // Remove previous typing indicator anywhere
      $$(".agent-typing").forEach(n => n.remove());
      const placeholder = pane.querySelector(".agent-pane-empty");
      if (placeholder) placeholder.remove();
      const t = document.createElement("div");
      t.className = "agent-typing";
      t.innerHTML = '<span></span><span></span><span></span>';
      pane.appendChild(t);
      pane.scrollTop = pane.scrollHeight;
    }
    function hideTyping() {
      $$(".agent-typing").forEach(n => n.remove());
    }
    runBtn.addEventListener("click", runLoop);
    resetBtn.addEventListener("click", () => {
      runToken += 1; // cancel any in-flight run
      runState = "idle";
      runBtn.disabled = false;
      resetBtn.disabled = false;
      runBtn.textContent = "▶ Run agent loop";
      clearStage();
    });
    renderTasks();
    clearStage();
  })();

  // ─────────────────────────────────────────────────────────────
  // DEMO 2 · REASONING KNOB
  // ─────────────────────────────────────────────────────────────
  (function initReasoningDemo() {
    const cfg = idemo.reasoningDemo;
    setT("reasoning-prompt-label", cfg.prompt);
    $("reasoning-code").textContent = cfg.code;
    const slider = $("reasoning-slider");
    const ticks = $("reasoning-ticks");
    const out = $("reasoning-output");
    const stats = $("reasoning-stats");
    const summary = $("reasoning-summary");

    if (slider) slider.max = String(cfg.levels.length - 1);
    if (ticks) {
      ticks.innerHTML = cfg.levels.map(l => `<span class="reasoning-tick">${escapeHtml(l.label)}</span>`).join("");
    }

    let typingToken = 0;
    async function applyLevel(idx) {
      const level = cfg.levels[idx];
      // Update stats immediately
      stats.innerHTML = `
        <div class="reasoning-stat"><div class="reasoning-stat-num">${level.tokens.toLocaleString()}</div><div class="reasoning-stat-label">tokens</div></div>
        <div class="reasoning-stat"><div class="reasoning-stat-num">${(level.latencyMs / 1000).toFixed(1)}s</div><div class="reasoning-stat-label">latency</div></div>
        <div class="reasoning-stat"><div class="reasoning-stat-num">$${level.costUsd.toFixed(4)}</div><div class="reasoning-stat-label">cost</div></div>
        <div class="reasoning-stat reasoning-stat-issues"><div class="reasoning-stat-num">${level.issuesFound}</div><div class="reasoning-stat-label">issues found</div></div>
      `;
      summary.textContent = level.summary;

      // Update ticks active state
      ticks.querySelectorAll(".reasoning-tick").forEach((t, i) => t.classList.toggle("active", i === idx));

      // Stream the output
      typingToken += 1;
      const myToken = typingToken;
      out.textContent = "";
      out.classList.add("typing");
      const text = level.output;
      // Smooth char-by-char with adjustable speed (slower for higher levels feels right)
      const charDelay = Math.max(2, 20 - idx * 4); // 20ms → 4ms across the slider
      for (let i = 0; i < text.length; i++) {
        if (myToken !== typingToken) return;
        out.textContent += text[i];
        if (i % 3 === 0) await sleep(charDelay);
      }
      out.classList.remove("typing");
    }
    slider.addEventListener("input", e => applyLevel(Number(e.target.value)));
    applyLevel(0);
  })();

  // ─────────────────────────────────────────────────────────────
  // DEMO 3 · MCP CATALOG
  // ─────────────────────────────────────────────────────────────
  (function initMcpDemo() {
    const cfg = idemo.mcpDemo;
    const grid = $("mcp-grid");
    const search = $("mcp-search");
    const cats = $("mcp-cats");
    const toolboxList = $("mcp-toolbox-list");
    const toolboxStats = $("mcp-toolbox-stats");
    const ctxFill = $("mcp-context-fill");
    const ctxCaption = $("mcp-context-caption");
    const CONTEXT_BUDGET = 128000; // tokens

    let activeCat = "all";
    let query = "";
    const attached = new Set();

    cats.innerHTML = cfg.categories.map(c => `
      <button class="mcp-cat${c.id === "all" ? " active" : ""}" data-cat="${c.id}">${escapeHtml(c.label)}</button>
    `).join("");
    cats.querySelectorAll(".mcp-cat").forEach(b => {
      b.addEventListener("click", () => {
        activeCat = b.getAttribute("data-cat");
        cats.querySelectorAll(".mcp-cat").forEach(x => x.classList.toggle("active", x === b));
        renderGrid();
      });
    });
    search.addEventListener("input", () => { query = search.value.trim().toLowerCase(); renderGrid(); });

    function renderGrid() {
      const filtered = cfg.servers.filter(s => {
        if (activeCat !== "all" && s.category !== activeCat) return false;
        if (query) {
          const hay = (s.name + " " + s.desc).toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });
      if (filtered.length === 0) {
        grid.innerHTML = `<div class="mcp-empty">No servers match. Try a different category or clear search.</div>`;
        return;
      }
      grid.innerHTML = filtered.map(s => `
        <div class="mcp-card${attached.has(s.id) ? " attached" : ""}" data-id="${s.id}">
          <div class="mcp-card-head">
            <span class="mcp-card-name">${escapeHtml(s.name)}</span>
            <span class="mcp-card-tools">${s.tools} tools</span>
          </div>
          <div class="mcp-card-desc">${escapeHtml(s.desc)}</div>
          <div class="mcp-card-foot">
            <span class="mcp-card-cat">${escapeHtml(cfg.categories.find(c => c.id === s.category)?.label || s.category)}</span>
            <span class="mcp-card-ctx">~${(s.ctx / 1000).toFixed(1)}k ctx</span>
          </div>
          <button class="mcp-card-btn" data-action="${attached.has(s.id) ? "detach" : "attach"}">${attached.has(s.id) ? "Attached ✓" : "Attach"}</button>
        </div>
      `).join("");
      grid.querySelectorAll(".mcp-card").forEach(card => {
        const id = card.getAttribute("data-id");
        card.querySelector(".mcp-card-btn").addEventListener("click", e => {
          e.stopPropagation();
          if (attached.has(id)) attached.delete(id);
          else attached.add(id);
          renderGrid();
          renderToolbox();
        });
      });
    }
    function renderToolbox() {
      const items = [...attached].map(id => cfg.servers.find(s => s.id === id)).filter(Boolean);
      const totalTools = items.reduce((a, b) => a + b.tools, 0);
      const totalCtx = items.reduce((a, b) => a + b.ctx, 0);
      const pct = Math.min(100, (totalCtx / CONTEXT_BUDGET) * 100);

      if (items.length === 0) {
        toolboxList.innerHTML = `<span class="mcp-toolbox-empty">Click servers below to attach them.</span>`;
      } else {
        toolboxList.innerHTML = items.map(s => `
          <span class="mcp-toolbox-chip">
            ${escapeHtml(s.name)} <span class="mcp-toolbox-chip-x" data-detach="${s.id}">×</span>
          </span>
        `).join("");
        toolboxList.querySelectorAll("[data-detach]").forEach(x => {
          x.addEventListener("click", () => {
            attached.delete(x.getAttribute("data-detach"));
            renderGrid(); renderToolbox();
          });
        });
      }
      toolboxStats.textContent = `${items.length} server${items.length === 1 ? "" : "s"} · ${totalTools} tool${totalTools === 1 ? "" : "s"} · ~${(totalCtx / 1000).toFixed(1)}k ctx`;
      ctxFill.style.width = pct + "%";
      ctxFill.classList.toggle("warn", pct > 70);
      ctxFill.classList.toggle("danger", pct > 90);
      ctxCaption.textContent = `${pct.toFixed(1)}% of 128k context window · registry: ${cfg.registrySize.toLocaleString()} servers`;
    }
    renderGrid();
    renderToolbox();
  })();

  // ─────────────────────────────────────────────────────────────
  // DEMO 4 · MODEL RACE
  // ─────────────────────────────────────────────────────────────
  (function initRaceDemo() {
    const cfg = idemo.raceDemo;
    let selectedPrompt = cfg.prompts[0].id;
    let runState = "idle";
    let runToken = 0;

    const promptBtns = $("race-prompt-buttons");
    const runBtn = $("race-run");
    const resetBtn = $("race-reset");
    const track = $("race-track");
    const summary = $("race-summary");

    function renderPrompts() {
      promptBtns.innerHTML = cfg.prompts.map(p => `
        <button class="race-prompt-btn${p.id === selectedPrompt ? " active" : ""}" data-prompt="${p.id}">${escapeHtml(p.label)}</button>
      `).join("");
      promptBtns.querySelectorAll(".race-prompt-btn").forEach(b => {
        b.addEventListener("click", () => {
          if (runState === "running") return;
          selectedPrompt = b.getAttribute("data-prompt");
          renderPrompts();
          renderTrack();
          summary.innerHTML = "";
        });
      });
    }
    function renderTrack() {
      track.innerHTML = cfg.models.map(m => `
        <div class="race-lane race-lane-${m.lane}" data-model="${m.id}">
          <div class="race-lane-head">
            <div class="race-lane-name">${escapeHtml(m.name)}</div>
            <div class="race-lane-tag race-lane-tag-${m.kind}">${m.kind === "closed" ? "closed-source" : "open-weight"}</div>
            <div class="race-lane-provider">${escapeHtml(m.provider)}</div>
          </div>
          <div class="race-lane-stats" id="race-stats-${m.id}">
            <span class="race-lane-stat"><span class="race-lane-stat-num" data-stat-tps>—</span> tok/s</span>
            <span class="race-lane-stat"><span class="race-lane-stat-num" data-stat-time>—</span> time</span>
            <span class="race-lane-stat"><span class="race-lane-stat-num" data-stat-cost>—</span> cost</span>
          </div>
          <pre class="race-lane-output" id="race-out-${m.id}"></pre>
          <div class="race-lane-bar"><div class="race-lane-bar-fill" id="race-bar-${m.id}"></div></div>
        </div>
      `).join("");
    }
    async function runRace() {
      if (runState === "running") return;
      runState = "running";
      runToken += 1;
      const myToken = runToken;
      runBtn.disabled = true;
      resetBtn.disabled = true;
      runBtn.textContent = "● Racing";
      summary.innerHTML = "";

      // Clear lanes
      cfg.models.forEach(m => {
        $(`race-out-${m.id}`).textContent = "";
        $(`race-bar-${m.id}`).style.width = "0%";
        const s = $(`race-stats-${m.id}`);
        s.querySelector("[data-stat-tps]").textContent = "—";
        s.querySelector("[data-stat-time]").textContent = "—";
        s.querySelector("[data-stat-cost]").textContent = "—";
      });

      const responses = cfg.responses[selectedPrompt] || {};
      // Run all lanes in parallel
      const promises = cfg.models.map(m => streamLane(m, responses[m.id] || "", myToken));
      const results = await Promise.all(promises);
      if (myToken !== runToken) return;

      // Summary: open-weight parity message
      const sorted = [...results].sort((a, b) => a.totalSec - b.totalSec);
      summary.innerHTML = `
        <div class="race-summary-line">
          <strong>${escapeHtml(sorted[0].name)}</strong> finished first (${sorted[0].totalSec.toFixed(2)}s · $${sorted[0].cost.toFixed(5)}).
          The slowest model (<strong>${escapeHtml(sorted[3].name)}</strong>) finished in ${sorted[3].totalSec.toFixed(2)}s — within ${(((sorted[3].totalSec - sorted[0].totalSec) / sorted[0].totalSec) * 100).toFixed(0)}% of the leader. The cost spread is ${(sorted[3].cost / Math.max(0.000001, sorted[0].cost)).toFixed(0)}× — open-weight wins on cost, not quality.
        </div>
      `;

      runState = "done";
      runBtn.disabled = false;
      resetBtn.disabled = false;
      runBtn.textContent = "▶ Race again";
    }

    async function streamLane(model, text, token) {
      const out = $(`race-out-${model.id}`);
      const bar = $(`race-bar-${model.id}`);
      const stats = $(`race-stats-${model.id}`);
      const tpsEl = stats.querySelector("[data-stat-tps]");
      const timeEl = stats.querySelector("[data-stat-time]");
      const costEl = stats.querySelector("[data-stat-cost]");

      // Roughly tokens-per-char ≈ 0.25; convert tps to char/sec
      const charsPerSec = model.tps * 4;
      const msPerChar = 1000 / charsPerSec;
      const start = performance.now();
      let lastUpdate = start;
      let chars = 0;
      const total = text.length;

      while (chars < total) {
        if (token !== runToken) return { name: model.name, totalSec: 0, cost: 0 };
        // Stream a small batch each tick to keep it smooth and live
        const batchChars = Math.max(1, Math.round(charsPerSec / 30)); // ~30 FPS
        const batchEnd = Math.min(total, chars + batchChars);
        out.textContent += text.slice(chars, batchEnd);
        chars = batchEnd;
        bar.style.width = ((chars / total) * 100).toFixed(2) + "%";
        const now = performance.now();
        if (now - lastUpdate > 80) {
          const elapsed = (now - start) / 1000;
          const tokenCount = chars * 0.25;
          tpsEl.textContent = (tokenCount / Math.max(0.001, elapsed)).toFixed(0);
          timeEl.textContent = elapsed.toFixed(1) + "s";
          costEl.textContent = "$" + ((tokenCount / 1_000_000) * model.costPerM).toFixed(5);
          lastUpdate = now;
        }
        await sleep(33); // ~30 FPS
      }
      const totalSec = (performance.now() - start) / 1000;
      const totalTokens = total * 0.25;
      const cost = (totalTokens / 1_000_000) * model.costPerM;
      tpsEl.textContent = (totalTokens / totalSec).toFixed(0);
      timeEl.textContent = totalSec.toFixed(2) + "s";
      costEl.textContent = "$" + cost.toFixed(5);
      bar.style.width = "100%";
      out.parentElement.classList.add("race-lane-done");
      // Quickly remove the done class for re-runs
      setTimeout(() => out.parentElement.classList.remove("race-lane-done"), 800);
      return { name: model.name, totalSec, cost };
    }

    runBtn.addEventListener("click", runRace);
    resetBtn.addEventListener("click", () => {
      runToken += 1;
      runState = "idle";
      runBtn.disabled = false;
      resetBtn.disabled = false;
      runBtn.textContent = "▶ Race";
      summary.innerHTML = "";
      renderTrack();
    });

    renderPrompts();
    renderTrack();
  })();

  // ─────────────────────────────────────────────────────────────
  // Theme toggle (mirrors the report)
  // ─────────────────────────────────────────────────────────────
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-theme-set");
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("ai-report-theme", t); } catch {}
      updateThemeButtons();
    });
  });
  function updateThemeButtons() {
    const cur = document.documentElement.getAttribute("data-theme");
    document.querySelectorAll(".theme-toggle-btn").forEach(b =>
      b.classList.toggle("active", b.getAttribute("data-theme-set") === cur)
    );
  }
  updateThemeButtons();
})();
