// ─────────────────────────────────────────────────────────────
// talk.js · Renders the talking-points page (talk.html).
// Pulls content from data.json (presenterPlaybook + engineersUpdate)
// plus per-shift "talkingPoint" overrides defined inline below for
// the rare cases where the script line should differ from the
// implication used in the main report.
// ─────────────────────────────────────────────────────────────

(async function () {
  let data;
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
    data = await res.json();
  } catch (err) {
    console.error("Initialization error:", err);
    document.body.innerHTML =
      '<main class="present-main"><p style="color:var(--accent-warm); padding:3rem 1rem; text-align:center;">Failed to load data.json. Serve this page over HTTP (e.g. <code>python3 -m http.server</code>).</p></main>';
    return;
  }

  const playbook = data.presenterPlaybook;
  const eng      = data.engineersUpdate;
  if (!playbook || !eng) {
    document.querySelector(".present-main").innerHTML =
      '<p style="color:var(--accent-warm); padding:3rem 1rem; text-align:center;">Missing presenterPlaybook / engineersUpdate in data.json.</p>';
    return;
  }

  const $    = (id)  => document.getElementById(id);
  const $$   = (sel) => document.querySelectorAll(sel);
  const setT = (id, val) => { const el = $(id); if (el && val !== undefined && val !== null) el.textContent = val; };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));

  // ── Override hero metadata to match this page's purpose (talking-points). ──
  // Use playbook values where they make sense; override the rest in markup.
  if (playbook.totalTime) setT("present-total-time", playbook.totalTime + " + 5 Q&A");
  setT("present-audience", "Software developers");
  setT("present-format",   "Live in-browser demo · no slides · share links");

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

  // ── Update Flow ── (with detailed per-beat scripts) ──────────────
  // Each beat carries the full presenter script: time on stage, the
  // exact opening sentence, the key data you must cite (with sources
  // pre-loaded), what to do on stage (demo cues, slide cues, audience
  // beats), the transition into the next beat, and the audience risks
  // to anticipate. This is the operating manual a presenter can rehearse
  // from. Keep flowSteps[].desc as the executive summary; the script
  // below adds the nuance that matters at delivery time.
  const flowScripts = {
    "01": {
      time: "1 min · ~120 words",
      opener: "“I'm going to spend 20 minutes telling you what's actually different about AI for our craft right now — not the hype, not the doom. Five concrete shifts, one live demo running on this laptop with no internet, and a $200 two-week experiment you can run on Monday. If by minute 20 you don't have one thing you're going to try this sprint, I've failed.”",
      keyData: [
        "METR randomized controlled trial (mid-2025): 16 experienced open-source devs · 246 tasks · their own repos. Result: −19% slower with AI; self-perceived +20% faster. 39-point perception gap.",
        "Stack Overflow Developer Survey 2025: 84% of professional developers use AI in their workflow; 51% daily.",
        "Industry quote frequently cited: ~42% of enterprise GenAI initiatives end up shelved or scaled back (commonly attributed to S&P/IBM-class surveys 2024–2025) — say ‘industry surveys put enterprise AI abandonment around 40%’ rather than a single hard number, then move on."
      ],
      onStage: [
        "Stand still. No slide. Look at the room for the first 10 seconds before you speak.",
        "Lead with the contract: 20 minutes, 5 shifts, 1 demo, 1 experiment. Engineers respect tight scopes.",
        "Cite METR by name and the −19% / +20% numbers. This is your skepticism credential.",
        "Do NOT show the live demo yet. Foreshadow it (‘a real model running locally, no internet, in this browser tab’) and move on."
      ],
      transition: "“So if AI sometimes makes the best engineers slower, and 40% of enterprise pilots fail, what's actually different in the last 12 months? Here are the five shifts that matter.”",
      audienceRisk: "Hostile-audience opener. The room is waiting to dismiss you. Win them with credible skepticism in the first 60 seconds — don't oversell."
    },
    "02": {
      time: "5 min · 1 min per shift",
      opener: "“Five things didn't exist 12 months ago. Not ‘GPT got better’ — five structurally different shifts. I'll spend one minute on each, then we'll go to the demo.”",
      keyData: [
        "Shift 1 · Agents: Cursor Composer edits 8 files in parallel · Devin in $25B funding talks · Qwen 3.7 Max ran 35h autonomously with 1,000+ tool calls.",
        "Shift 2 · Price collapse: GPT-4 (2023) $30/$60 per Mtok → DeepSeek V4 Flash (2026) $0.14/$0.28. That's ~200× on the cheap end. Prompt caching adds 40–70% on top.",
        "Shift 3 · Reasoning knob: o1 (Sep 2024) → DeepSeek-R1 (Jan 2025) → standard across all frontier labs by 2026. Claude Mythos leads SWE-Bench Verified at 93.9%.",
        "Shift 4 · MCP: 54,450 servers indexed (May 2026). AWS Bedrock AgentCore exposes MCP natively. Microsoft, Salesforce, Anthropic, OpenAI all wrote first-class support.",
        "Shift 5 · Open weights: Kimi K2.6 ties GPT-5.5 on SWE-Bench Pro under Modified MIT. DeepSeek V4 1.6T MoE. The frontier gap effectively closed."
      ],
      onStage: [
        "Strict 60 seconds per shift. Use the timer on the laptop visible to you.",
        "Don't read the cards — the audience is reading them on the talk page link they have. You add the verbal hook (‘the say-it-like-this line’) and one number.",
        "Skip the bullets. Land the implication of each shift, not the evidence list.",
        "If you're behind on time, drop the evidence and keep the implication. The implication is the load-bearing claim."
      ],
      transition: "“These are the claims. Now the proof — let's switch to the demo tab. The model you're about to see is running 100% in this browser with no network, no API keys.”",
      audienceRisk: "Engineers will pattern-match to the labs they already follow. Don't argue ‘OpenAI vs Anthropic vs DeepSeek’ — keep it about the architectural shift, not the leaderboard."
    },
    "03": {
      time: "8 min · the heart of the talk",
      opener: "“This laptop. No internet. Watch.” Click the talk-page link to live-demo.html. Open DevTools → Network → ‘Offline’. Run anything.",
      keyData: [
        "WebGPU runs the model on the audience's GPU — Apple M-series, RTX, Intel Arc — first-token latency is real, not animated.",
        "Tab 1 (Chat): point at the tok/s readout. ‘Each one of those numbers is a real forward pass, not a recording.’",
        "Tab 2 (Reasoning Knob): same prompt, three system prompts. Tokens out and time go up; quality goes up. Cost knob made visible.",
        "Tab 3 (Persona): same model, same prompt; system prompt changes everything. ‘The behaviour you see in production is mostly the system prompt.’",
        "Tab 4 (Tools): model emits JSON · browser executes · result fed back. ‘This is the agent loop, end to end, 80 lines of vanilla JavaScript.’",
        "Tab 5 (Orchestration): one model, four roles, sequential calls. ‘This is how Claude Code, Devin, Cursor Composer work — minus a thousand engineering details.’"
      ],
      onStage: [
        "Don't pre-load the model in front of the audience. Pre-warm it before the talk so weights are cached.",
        "If WebGPU is unavailable on stage hardware, switch to Qwen 0.5B (CPU-friendly) and say so out loud.",
        "Encourage the room to open the URL on their laptops — when 30 people are seeing real tok/s on their own machines, the talk has already won.",
        "Resist the urge to narrate every token. Let silence do the work for the first 10 seconds of streaming.",
        "If the model says something weird, lean into it: ‘This is a 1B-param model. The frontier is 1T. The shift is that this works at all.’"
      ],
      transition: "“Same model, five lenses. Now: what should you actually learn this year?”",
      audienceRisk: "Demo failure modes: WiFi drops mid-download (mitigation: pre-cache); model loads slowly (mitigation: smallest model first); audience laptops can't run WebGPU (mitigation: don't make them run it — your screen is enough)."
    },
    "04": {
      time: "3 min · ~30s per discipline",
      opener: "“Four skills appreciated fastest in 2026. None of them are ‘write better prompts.’”",
      keyData: [
        "D1 · Eval Engineering: Promptfoo, Inspect AI, Braintrust, Langfuse, Helicone all production-grade. Treat AI features like any other prod code — golden datasets, regression on every deploy.",
        "D2 · Spec-Driven Development: Thoughtworks, Martin Fowler, GitHub, Amazon, and a 67-source academic review (arXiv 2411.13768) all converged on this in 2025–2026.",
        "D3 · Cost Engineering: prefix caching pins prompts at ~10% of input rate. Anthropic, OpenAI, Google all support it. 40–70% reduction with zero code changes.",
        "D4 · Agent Orchestration & Observability: debugging an agent that calls 300 tools needs OpenTelemetry traces, not console.log. LangGraph, CrewAI, AutoGen, Claude Agent SDK."
      ],
      onStage: [
        "One sentence per discipline. The room doesn't need a tool catalogue — they need to know the names so they can search later.",
        "Land the framing: ‘the unit of work moved from typing functions to writing specs, designing evals, reviewing diffs from agents.’",
        "Optional callback: ‘That tool-calling demo three minutes ago was eval-able the moment you wrote it. The agent loop, the JSON schema, the ground-truth answers — that's the spec.’"
      ],
      transition: "“But this isn't a victory lap. Here's where it actually breaks.”",
      audienceRisk: "Skip the temptation to teach any one of these. You're naming, not training. If you teach, you blow the time budget."
    },
    "05": {
      time: "3 min · the credibility tax",
      opener: "“If I only told you the bullish parts, you'd have stopped listening. Four uncomfortable findings.”",
      keyData: [
        "AI can make you slower (METR mid-2025): 16 experienced devs, 246 tasks, on their own repos. −19% with AI, +20% perception. Repeat the 39-point gap.",
        "The slop problem (DORA 2025): ‘we got faster at producing change; we did not get equally fast at understanding its consequences.’ Code review is the new bottleneck. AI amplifies the org you already have.",
        "Junior skill atrophy: when the agent always writes the code, when do juniors learn to read it? The skill appreciating fastest is also the one eroding fastest among new hires.",
        "Cost surprises: a single high-effort reasoning query can emit 50K+ output tokens. At GPT-5.5 rates that's ~$1.50 per call. Budget for output, not input."
      ],
      onStage: [
        "Slow down here. The previous beats were claims — these are caveats. Pace shift signals seriousness.",
        "If you're behind, keep METR + DORA and drop juniors + cost. Those two are the ones engineers fact-check after the talk.",
        "Don't editorialise. Engineers prefer ‘DORA found X’ over ‘I think X.’"
      ],
      transition: "“So what do you do about it on Monday morning?”",
      audienceRisk: "This is when someone asks ‘Will AI replace us?’ Have the answer ready (Q1 in the Q&A list). Don't ad-lib it."
    },
    "06": {
      time: "2 min · close strong",
      opener: "“Three experiments. $200/engineer. Two weeks. Schedule the retro before you start.”",
      keyData: [
        "Week 1A · Replace your editor: Cursor or Claude Code as primary on one real feature. Track time-to-PR, diff size, your review burden.",
        "Week 1B · Stand up an MCP server: pick one internal tool — wiki, ticketing, monitoring. Wrap it. Connect your IDE. Measure tool-use rate.",
        "Week 2 · Write evals for one feature: 50-example golden dataset · LLM-as-Judge graders · run on the next deploy. Promptfoo or Inspect AI.",
        "Pre-approve the budget with finance / your VP before the talk. The CTA lands flat without a real budget."
      ],
      onStage: [
        "End on the closing line — memorise it: ‘AI didn't replace engineers — it changed the unit of work. We're not typing functions anymore, we're writing specs, designing evals, and reviewing diffs from agents. That's still software engineering. It just looks different.’",
        "Concrete CTA: pick one of the three, give it two weeks, send the team a 1-paragraph retro. Don't leave the next step ambiguous.",
        "Don't take questions in the closing minute. Land the line, hold the silence, then open Q&A."
      ],
      transition: "“Two weeks. One experiment. Tell me what you found. Questions?”",
      audienceRisk: "Don't run over. A 20-minute talk that lands on time earns the trust to deliver the next one. A 23-minute talk loses the room in the last three."
    }
  };

  const flowEl = $("present-flow-target");
  if (flowEl && eng.flowSteps) {
    flowEl.innerHTML = eng.flowSteps.map(f => {
      const s = flowScripts[f.num];
      const scriptBlock = s ? `
        <details class="flow-step-script">
          <summary class="flow-step-script-summary">
            <span class="flow-step-script-time">${escapeHtml(s.time)}</span>
            <span class="flow-step-script-toggle">Detailed script ▾</span>
          </summary>
          <div class="flow-step-script-body">
            <div class="flow-script-section flow-script-opener">
              <div class="flow-script-label">Opening line · say it verbatim</div>
              <p class="flow-script-quote">${escapeHtml(s.opener)}</p>
            </div>
            <div class="flow-script-section">
              <div class="flow-script-label">Key data to cite</div>
              <ul class="flow-script-list">
                ${s.keyData.map(d => `<li>${escapeHtml(d)}</li>`).join("")}
              </ul>
            </div>
            <div class="flow-script-section">
              <div class="flow-script-label">On stage · what to do</div>
              <ul class="flow-script-list flow-script-onstage">
                ${s.onStage.map(d => `<li>${escapeHtml(d)}</li>`).join("")}
              </ul>
            </div>
            <div class="flow-script-grid">
              <div class="flow-script-section flow-script-transition">
                <div class="flow-script-label">Transition into next beat</div>
                <p class="flow-script-quote-mini">${escapeHtml(s.transition)}</p>
              </div>
              <div class="flow-script-section flow-script-risk">
                <div class="flow-script-label">Audience risk · anticipate</div>
                <p>${escapeHtml(s.audienceRisk)}</p>
              </div>
            </div>
          </div>
        </details>
      ` : "";
      return `
        <li class="flow-step">
          <div class="flow-step-num">${escapeHtml(f.num)}</div>
          <div class="flow-step-body">
            <div class="flow-step-title">${escapeHtml(f.title)}</div>
            <div class="flow-step-desc">${escapeHtml(f.desc)}</div>
            ${scriptBlock}
          </div>
        </li>
      `;
    }).join("");
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

  // ── 5 Inflection Points · talking-point scripts ──
  // We render each shift with: tag, title, summary, evidence bullets,
  // implication, plus a per-shift "Say it like this" line that gives
  // the presenter a literal sentence to deliver from stage.
  const sayIt = {
    "Shift 01": "Twelve months ago: tab completion. Today: ‘ship a PR, here are the tests, ping me.’ Different muscle.",
    "Shift 02": "Inference is 30 to 200× cheaper than 24 months ago. Patterns we called demos last year are in production this year.",
    "Shift 03": "Reasoning_effort is now a knob. You stop prompt-engineering harder and start writing better specs.",
    "Shift 04": "MCP is to AI integration what HTTP was to networking — the boring standard that makes the whole stack possible.",
    "Shift 05": "The frontier gap closed. Open weights are no longer the cheap-and-slow tier — they're the cheap-and-good tier."
  };

  // Per-shift extended script. Used to round out the 60-second beat
  // beyond the one-liner: an anchor stat the room must hear, the
  // objection most likely to come back from the audience, and one
  // counter-narrative line to defuse it without losing the minute.
  const shiftScripts = {
    "Shift 01": {
      anchor: "Devin runs in $25B funding talks. Cursor Composer edits 8 files in parallel. Qwen 3.7 Max ran 35 hours autonomously with 1,000+ tool calls. The work-unit changed.",
      objection: "‘But agents hallucinate / fabricate / break stuff.’",
      counter: "Yes — and so do junior engineers. The discipline is code review, not refusal. The eval-and-review muscle is the new senior-engineer skill."
    },
    "Shift 02": {
      anchor: "GPT-4 was $30/$60 per million tokens in 2023. DeepSeek V4 Flash is $0.14/$0.28 in 2026. That's roughly 200× cheaper on the floor. Then prompt caching shaves another 40–70%.",
      objection: "‘Reasoning models burn through tokens — won't this blow up costs anyway?’",
      counter: "Right — that's why output budgeting and model routing are now real disciplines. The unit cost dropped; the per-call ceiling went up. You manage both."
    },
    "Shift 03": {
      anchor: "OpenAI o1 in September 2024. DeepSeek-R1 in January 2025. By 2026, every frontier lab ships a reasoning_effort knob. Claude Mythos leads SWE-Bench Verified at 93.9% by deliberation — not by knowing more.",
      objection: "‘Isn't this just a glorified system prompt?’",
      counter: "The model is RL-trained to emit chain-of-thought tokens before the answer. Quality scales with thinking budget. You'll see this live in the demo's reasoning-knob tab."
    },
    "Shift 04": {
      anchor: "54,450 MCP servers indexed in May 2026. AWS Bedrock AgentCore exposes MCP natively. Microsoft, Salesforce, Anthropic, and OpenAI all wrote first-class support inside one year. That's protocol-level adoption speed.",
      objection: "‘Yet another standard. Why not just call our APIs?’",
      counter: "Because your IDE — Cursor, Claude Code, Codex CLI — already speaks MCP. One config block exposes your wiki, ticketing, observability to every agent on every dev's machine. That's the win."
    },
    "Shift 05": {
      anchor: "Kimi K2.6 ties GPT-5.5 on SWE-Bench Pro under a Modified MIT licence. DeepSeek V4 is 1.6T parameters MoE. GLM-5.1 is 754B. The frontier closed — open weights aren't the cheap-and-slow tier anymore, they're the cheap-and-good tier.",
      objection: "‘We can't run a 1T-parameter MoE in our VPC.’",
      counter: "You don't have to run the biggest one. Kimi K2.6 active params are 32B — that fits on one H100. The point is: the option exists. ‘Compliance says no’ is no longer a reason to skip the best AI."
    }
  };
  const shiftsEl = $("talk-shifts-target");
  if (shiftsEl && eng.shifts) {
    shiftsEl.innerHTML = eng.shifts.map(s => {
      const sayLine = sayIt[s.tag] || "";
      const script  = shiftScripts[s.tag];
      const evidence = (s.evidence || []).map(e => `<li>${escapeHtml(e)}</li>`).join("");
      const scriptBlock = script ? `
        <div class="talk-shift-script">
          <div class="talk-shift-script-row">
            <span class="talk-shift-script-label">Anchor stat · land this number</span>
            <p>${escapeHtml(script.anchor)}</p>
          </div>
          <div class="talk-shift-script-row">
            <span class="talk-shift-script-label">Likely objection</span>
            <p class="talk-shift-objection">${escapeHtml(script.objection)}</p>
            <span class="talk-shift-script-label">Counter</span>
            <p>${escapeHtml(script.counter)}</p>
          </div>
        </div>
      ` : "";
      return `
        <article class="shift-card talk-shift-card">
          <div class="shift-card-tag">${escapeHtml(s.tag)}</div>
          <h4 class="shift-card-title">${escapeHtml(s.title)}</h4>
          <p class="shift-card-summary">${escapeHtml(s.summary)}</p>
          <ul class="shift-card-evidence">${evidence}</ul>
          <div class="shift-card-implication">
            <span class="shift-card-implication-label">Implication</span>
            <p>${escapeHtml(s.implication)}</p>
          </div>
          ${sayLine ? `
            <div class="talk-say-it">
              <span class="talk-say-it-label">Say it like this</span>
              <p>“${escapeHtml(sayLine)}”</p>
            </div>` : ""}
          ${scriptBlock}
          <a class="shift-card-source" href="${s.sourceLink}" target="_blank" rel="noopener">${escapeHtml(s.sourceLabel)} ↗</a>
        </article>
      `;
    }).join("");
  }

  // ── Disciplines ──
  const discEl = $("talk-disc-target");
  if (discEl && eng.disciplines) {
    discEl.innerHTML = eng.disciplines.map(d => `
      <div class="discipline-card">
        <div class="discipline-num">${escapeHtml(d.num)}</div>
        <div class="discipline-title">${escapeHtml(d.title)}</div>
        <div class="discipline-desc">${escapeHtml(d.desc)}</div>
        <div class="discipline-stack">${escapeHtml(d.stack)}</div>
      </div>
    `).join("");
  }

  // ── Reality check ──
  const realityEl = $("talk-reality-target");
  if (realityEl && eng.realityCheck) {
    realityEl.innerHTML = eng.realityCheck.map(r => `
      <div class="reality-card">
        <div class="reality-card-title">${escapeHtml(r.title)}</div>
        <p class="reality-card-body">${escapeHtml(r.body)}</p>
      </div>
    `).join("");
  }

  // ── Two-week experiment ──
  setT("present-action-title",    eng.actionPlan?.title || "The Two-Week Experiment");
  setT("present-action-subtitle", eng.actionPlan?.subtitle || "");
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

  // ── Theme toggle ──
  function updateThemeButtons() {
    const cur = document.documentElement.getAttribute("data-theme");
    $$(".theme-toggle-btn").forEach(b =>
      b.classList.toggle("active", b.getAttribute("data-theme-set") === cur)
    );
  }
  $$(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-theme-set");
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("ai-report-theme", t); } catch {}
      updateThemeButtons();
    });
  });
  updateThemeButtons();

  // ── Smooth-scroll the jump nav and reveal the matching section ──
  $$(".talk-jump a").forEach(a => {
    a.addEventListener("click", e => {
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
