const { useState, useEffect } = React;

function ThemeToggle() {
  const [theme, setTheme] = useState(document.documentElement.getAttribute('data-theme') || 'light');
  const toggle = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('ai-report-theme', t); } catch (e) {}
    setTheme(t);
  };
  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button className={`theme-toggle-btn${theme === 'light' ? ' active' : ''}`} onClick={() => toggle('light')} aria-label="Light theme">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        Light
      </button>
      <button className={`theme-toggle-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => toggle('dark')} aria-label="Dark theme">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        Dark
      </button>
    </div>
  );
}

function FlowStep({ step, script }) {
  if (!script) return (
    <li className="flow-step">
      <div className="flow-step-num">{step.num}</div>
      <div className="flow-step-body">
        <div className="flow-step-title">{step.title}</div>
        <div className="flow-step-desc">{step.desc}</div>
      </div>
    </li>
  );
  return (
    <li className="flow-step">
      <div className="flow-step-num">{step.num}</div>
      <div className="flow-step-body">
        <div className="flow-step-title">{step.title}</div>
        <div className="flow-step-desc">{step.desc}</div>
        <details className="flow-step-script">
          <summary className="flow-step-script-summary">
            <span className="flow-step-script-time">{script.time}</span>
            <span className="flow-step-script-toggle">Detailed script ▾</span>
          </summary>
          <div className="flow-step-script-body">
            <div className="flow-script-section flow-script-opener">
              <div className="flow-script-label">Opening line · say it verbatim</div>
              <p className="flow-script-quote">{script.opener}</p>
            </div>
            <div className="flow-script-section">
              <div className="flow-script-label">Key data to cite</div>
              <ul className="flow-script-list">
                {script.keyData.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
            <div className="flow-script-section">
              <div className="flow-script-label">On stage · what to do</div>
              <ul className="flow-script-list flow-script-onstage">
                {script.onStage.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
            <div className="flow-script-grid">
              <div className="flow-script-section flow-script-transition">
                <div className="flow-script-label">Transition into next beat</div>
                <p className="flow-script-quote-mini">{script.transition}</p>
              </div>
              <div className="flow-script-section flow-script-risk">
                <div className="flow-script-label">Audience risk · anticipate</div>
                <p>{script.audienceRisk}</p>
              </div>
            </div>
          </div>
        </details>
      </div>
    </li>
  );
}

function ShiftCard({ shift, sayLine, script }) {
  return (
    <article className="shift-card talk-shift-card">
      <div className="shift-card-tag">{shift.tag}</div>
      <h4 className="shift-card-title">{shift.title}</h4>
      <p className="shift-card-summary">{shift.summary}</p>
      <ul className="shift-card-evidence">
        {(shift.evidence || []).map((e, i) => <li key={i}>{e}</li>)}
      </ul>
      <div className="shift-card-implication">
        <span className="shift-card-implication-label">Implication</span>
        <p>{shift.implication}</p>
      </div>
      {sayLine && (
        <div className="talk-say-it">
          <span className="talk-say-it-label">Say it like this</span>
          <p>"{sayLine}"</p>
        </div>
      )}
      {script && (
        <div className="talk-shift-script">
          <div className="talk-shift-script-row">
            <span className="talk-shift-script-label">Anchor stat · land this number</span>
            <p>{script.anchor}</p>
          </div>
          <div className="talk-shift-script-row">
            <span className="talk-shift-script-label">Likely objection</span>
            <p className="talk-shift-objection">{script.objection}</p>
            <span className="talk-shift-script-label">Counter</span>
            <p>{script.counter}</p>
          </div>
        </div>
      )}
      <a className="shift-card-source" href={shift.sourceLink} target="_blank" rel="noopener">{shift.sourceLabel} ↗</a>
    </article>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('data.json')
      .then(r => { if (!r.ok) throw new Error(`Failed (${r.status})`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (error) return (
    <main className="present-main">
      <p style={{ color: 'var(--accent-warm)', padding: '3rem 1rem', textAlign: 'center' }}>
        Failed to load data.json. Serve this page over HTTP (e.g. <code>python3 -m http.server</code>).
      </p>
    </main>
  );
  if (!data) return null;

  const playbook = data.presenterPlaybook;
  const eng = data.engineersUpdate;
  const flowScripts = data.talkFlowScripts || {};
  const sayIt = data.talkSayIt || {};
  const shiftScripts = data.talkShiftScripts || {};

  if (!playbook || !eng) return (
    <main className="present-main">
      <p style={{ color: 'var(--accent-warm)', padding: '3rem 1rem', textAlign: 'center' }}>
        Missing presenterPlaybook / engineersUpdate in data.json.
      </p>
    </main>
  );

  const handleJump = (e, href) => {
    if (!href || !href.startsWith('#')) return;
    const target = document.querySelector(href);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  return (
    <main className="present-main">
      {/* Top bar */}
      <div className="present-topbar">
        <a className="present-back" href="index.html"><span aria-hidden="true">←</span> Back to Report</a>
        <div className="present-topbar-right">
          <a className="present-demo-cta" href="live-demo.html" target="_blank" rel="noopener"><span aria-hidden="true">▶</span> Open Live Demo</a>
          <ThemeToggle />
        </div>
      </div>

      {/* Hero */}
      <header className="present-hero">
        <div className="present-kicker">Talking Points</div>
        <h1 className="present-title">What's Changing in AI</h1>
        <p className="present-subtitle">20 minutes · Software developers · Skepticism-first · Demo-led</p>
        <p className="present-intro">Engineers are a hostile audience for AI talks. They've sat through too many demos, are allergic to hype, and are deeply protective of their craft. This page is the talk script — exact talking points, time allocations, and Q&amp;A prep. The companion <a href="live-demo.html" className="inline-link" target="_blank" rel="noopener">Live Demo page</a> runs a real LLM in the browser for the show-don't-tell segment.</p>
        <div className="present-meta">
          <div className="present-meta-item">
            <div className="present-meta-label">Total time</div>
            <div className="present-meta-value">{playbook.totalTime ? `${playbook.totalTime} + 5 Q&A` : '20 min + 5 Q&A'}</div>
          </div>
          <div className="present-meta-item">
            <div className="present-meta-label">Audience</div>
            <div className="present-meta-value">Software developers</div>
          </div>
          <div className="present-meta-item">
            <div className="present-meta-label">Format</div>
            <div className="present-meta-value">Live in-browser demo · no slides</div>
          </div>
        </div>
        <nav className="talk-jump" aria-label="Jump to section">
          {[['#prep','Prep'],['#flow','Flow'],['#time','Time'],['#shifts','5 Shifts'],['#disciplines','Disciplines'],['#reality','Reality'],['#action','2-week plan'],['#falsifiers','Falsifiers'],['#qa','Q&A']].map(([href, label]) => (
            <a key={href} href={href} onClick={(e) => handleJump(e, href)}>{label}</a>
          ))}
        </nav>
      </header>

      {/* Opening line */}
      <section className="present-section talk-opener" id="opener">
        <h2 className="present-section-heading">Opening Line (memorise this)</h2>
        <blockquote className="talk-quote">
          <p>"METR ran a randomised controlled trial in 2025. Sixteen senior open-source maintainers. Their own repos, their own tasks. With AI, they got <strong>19% slower</strong>. They believed they got <strong>20% faster</strong>. That's a <strong>39-point self-perception gap</strong> — and that gap is the talk. For the next twenty minutes I'm going to show you what's actually changed under the hood, run a real model on this laptop with no internet, and hand you a two-week experiment you can run on Monday. If by minute twenty you don't have one thing you're going to try this sprint, I've failed."</p>
          <cite>— Concede the priors before the room raises them. Cite METR (<a className="inline-link" href="https://arxiv.org/abs/2507.09089" target="_blank" rel="noopener">arXiv:2507.09089</a>) on screen — engineers verify citations.</cite>
        </blockquote>
      </section>

      {/* Preparation checklist */}
      <section className="present-section" id="prep">
        <h2 className="present-section-heading">Preparation Checklist</h2>
        <p className="present-section-desc">Do these before the talk. Each one earns 5–10 minutes of credibility on stage.</p>
        <div className="prep-grid">
          {(playbook.preparation || []).map((p, i) => (
            <div className="prep-card" key={i}>
              <div className="prep-num">P{i + 1}</div>
              <div className="prep-body">
                <div className="prep-title">{p.title}</div>
                <div className="prep-desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Update Flow */}
      <section className="present-section" id="flow">
        <h2 className="present-section-heading">The Update Flow · 6 beats</h2>
        <p className="present-section-desc">Six beats for delivering this content to a senior engineering audience without losing them in the first ten minutes.</p>
        <ol className="flow-strip">
          {(eng.flowSteps || []).map(f => (
            <FlowStep key={f.num} step={f} script={flowScripts[f.num]} />
          ))}
        </ol>
      </section>

      {/* Time allocation */}
      <section className="present-section" id="time">
        <h2 className="present-section-heading">Time Allocation</h2>
        <p className="present-section-desc">Recommended pacing for a tight 20-minute talk plus 5-minute Q&amp;A buffer. The live demo does the heavy lifting — keep the inflection-point overview deliberately brief.</p>
        <div className="time-grid">
          {(playbook.timeAllocation || []).map((t, i) => (
            <div className={`time-card time-card-${t.color || 'primary'}`} key={i}>
              <div className="time-step">{t.step}</div>
              <div className="time-title">{t.title}</div>
              <div className="time-minutes">{t.minutes}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 5 Inflection Points */}
      <section className="present-section" id="shifts">
        <h2 className="present-section-heading">The 5 Inflection Points · talking-point scripts</h2>
        <p className="present-section-desc">Five structurally different things that didn't exist 12 months ago. Each card has the verified evidence, the implication, and the exact line to land it.</p>
        <div className="shifts-stack">
          {(eng.shifts || []).map((s, i) => (
            <ShiftCard key={i} shift={s} sayLine={sayIt[s.tag]} script={shiftScripts[s.tag]} />
          ))}
        </div>
      </section>

      {/* Live Demo bridge */}
      <section className="present-section talk-bridge" id="demo-bridge">
        <div className="talk-bridge-inner">
          <div>
            <div className="talk-bridge-kicker">Beat 03 · Show, don't tell</div>
            <h2 className="present-section-heading talk-bridge-title">Open the Live Demo page now</h2>
            <p className="present-section-desc">Don't read the next bullets — switch tabs. The Live Demo page boots a real Llama or Qwen model 100% inside the browser (WebGPU, no API calls, works offline). Walk through the six tabs in this order: Chat → Reasoning Knob → Persona → Tools → Orchestration → Evals.</p>
            <p className="talk-bridge-predict-intro">Tee up each tab with a <strong>falsifiable prediction</strong> — engineers trust speakers who let the demo prove (or break) them. If a prediction misses, name it on stage; that's the credibility move.</p>
            <ul className="talk-bridge-list">
              <li><strong>Chat</strong> — ~30 sec to show first-token latency and tokens/sec on local hardware. <em>Predict:</em> "TTFT under 2 seconds, ~25–40 tok/s on this MacBook."</li>
              <li><strong>Reasoning Knob</strong> — same prompt, three system prompts. <em>Predict:</em> "Watch output tokens roughly 3× from low to high — and watch the answer get measurably better."</li>
              <li><strong>Persona</strong> — same weights, same prompt; system prompt changes the output completely. <em>Predict:</em> "Two personas will give near-opposite recommendations on the same code snippet."</li>
              <li><strong>Tools</strong> — model emits JSON, browser executes a calculator/HTTP fetch, result fed back. <em>Predict:</em> "Malformed JSON ~10% of calls — you'll see a retry. That's why structured-output mode exists."</li>
              <li><strong>Orchestration</strong> — Planner → Researcher → Critic, all the same model, different roles. The "Received from upstream agent" chip on each pane shows how data flows. <em>Predict:</em> "The Critic will catch at least one error the Planner missed. Same weights — the architecture is what raised the floor."</li>
              <li><strong>Evals</strong> — pick 2-3 models, pick a test set, click Run. The harness loads each model, runs every question, scores deterministically, and shows a comparison bar chart. <em>Predict:</em> "Bigger model wins on code-fix; smaller model is within 1 point on basic math but 3-4× faster. <strong>This is exactly the artefact I asked you to email me.</strong>"</li>
            </ul>
            <details className="demo-fallback">
              <summary>If the demo fails on stage · recovery script</summary>
              <p><strong>Say this verbatim, smile, and keep moving:</strong></p>
              <blockquote className="talk-quote demo-fallback-quote">
                <p>"Good — this is the honest part. The model is ~880 MB on a hostile conference network, running on WebGPU which two-year-old laptops don't support. Here's the cached transcript I ran at 7am this morning — same model, same hardware class. The point still lands: this ran fully offline, with no API call, on a browser tab."</p>
              </blockquote>
              <p className="demo-fallback-tip">Pre-cache the model on this laptop before the talk (open <code>live-demo.html</code> on the venue Wi-Fi, click <em>Load model</em>, wait for the green pill). Have a 30-second screen recording of the five tabs ready in a second tab as a hard fallback. Never apologise — engineers respect graceful failure more than perfect demos.</p>
            </details>
            <a className="present-demo-cta talk-bridge-cta" href="live-demo.html" target="_blank" rel="noopener"><span aria-hidden="true">▶</span> Open Live Demo</a>
          </div>
        </div>
      </section>

      {/* New Disciplines */}
      <section className="present-section" id="disciplines">
        <h2 className="present-section-heading">The New Disciplines · what to learn this year</h2>
        <p className="present-section-desc">Four skills that appreciated fastest in 2026. Land each in one sentence — the audience needs to know what to do on Monday morning.</p>
        <div className="disc-grid">
          {(eng.disciplines || []).map((d, i) => (
            <div className="discipline-card" key={i}>
              <div className="discipline-num">{d.num}</div>
              <div className="discipline-title">{d.title}</div>
              <div className="discipline-desc">{d.desc}</div>
              <div className="discipline-stack">{d.stack}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Reality Check */}
      <section className="present-section" id="reality">
        <h2 className="present-section-heading">Reality Check · honest tradeoffs</h2>
        <p className="present-section-desc">Engineers smell hype instantly. These are the inconvenient findings worth leading with. If you must drop one, keep the METR slowdown and the slop problem.</p>
        <div className="reality-grid">
          {(eng.realityCheck || []).map((r, i) => (
            <div className="reality-card" key={i}>
              <div className="reality-card-title">{r.title}</div>
              <p className="reality-card-body">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two-week experiment */}
      <section className="present-section" id="action">
        <h2 className="present-section-heading">{eng.actionPlan?.title || 'The Two-Week Experiment'}</h2>
        <p className="present-section-desc">{eng.actionPlan?.subtitle || ''}</p>
        <div className="action-plan-grid">
          {(eng.actionPlan?.items || []).map((a, i) => (
            <div className="action-card" key={i}>
              <div className="action-week">{a.label}</div>
              <div className="action-title">{a.title}</div>
              <div className="action-desc">{a.desc}</div>
              <div className="action-tools">{a.tools}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Falsifiers */}
      <section className="present-section" id="falsifiers">
        <h2 className="present-section-heading">What Would Change My Mind</h2>
        <p className="present-section-desc">Steelman the skeptics in the room before they ask. Three concrete falsifiers — if any of these land in the next 18 months, this talk's thesis is wrong and I'll say so on stage at the next one.</p>
        <ol className="falsifier-list">
          <li>
            <span className="falsifier-tag">Falsifier 01</span>
            <p><strong>METR's task-doubling curve stalls past 14 months.</strong> The current 7-month doubling is the load-bearing claim for "agents are real now." If the 2026 follow-up shows the trend bending, the agent thesis weakens — and so does the case for redesigning your workflow around them.</p>
          </li>
          <li>
            <span className="falsifier-tag">Falsifier 02</span>
            <p><strong>Prompt-injection mitigations ship and hold for 12 consecutive months</strong> with no high-severity bypasses. If that happens, the security objection in the Reality Check evaporates — and the "agents in production" adoption curve gets steeper than I'm forecasting.</p>
          </li>
          <li>
            <span className="falsifier-tag">Falsifier 03</span>
            <p><strong>The METR 19% slowdown inverts in the 2026 replication.</strong> If experienced devs on real codebases now measure faster <em>and</em> believe they're faster — the perception gap was a tooling-maturity artefact, not a structural finding. Reality Check section gets rewritten.</p>
          </li>
        </ol>
        <p className="falsifier-note">Naming the falsifiers earns the right to make the rest of the claims. Tetlock-style forecasting hygiene is rare in tech talks — that's exactly why it lands.</p>
      </section>

      {/* Q&A prep */}
      <section className="present-section" id="qa">
        <h2 className="present-section-heading">Q&amp;A Prep</h2>
        <p className="present-section-desc">Six anticipated questions and suggested answers. Read once before the talk; you'll get at least four of these.</p>
        <div className="qa-list">
          {(playbook.qaPrep || []).map((qa, i) => (
            <details className="qa-item" key={i}>
              <summary className="qa-question">
                <span className="qa-num">Q{i + 1}</span>
                <span className="qa-q-text">{qa.q}</span>
                <span className="qa-chevron" aria-hidden="true">▸</span>
              </summary>
              <div className="qa-answer">{qa.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Closing line */}
      <section className="present-section talk-closer">
        <h2 className="present-section-heading">Closing Line (memorise this too)</h2>
        <blockquote className="talk-quote">
          <p>"The METR doubling is seven months. Your next perf cycle is six. So here's the deal: pick one of the three experiments on the slide, give it two weeks, and email me the result — pass, fail, or weird. I'll publish the aggregate at the end of the quarter. <strong>That's our own eval, our own data, our own answer.</strong> Not a vendor's benchmark. Not a Twitter thread. Yours."</p>
          <cite>— Promise an artefact. Recruit the audience as data. Concrete &gt; philosophical.</cite>
        </blockquote>
      </section>

      {/* Footer */}
      <footer className="present-footer">
        <a className="playbook-cta-link" href="index.html">← Back to the full report content</a>
        <span className="present-footer-divider" aria-hidden="true">·</span>
        <a className="playbook-cta-link" href="live-demo.html" target="_blank" rel="noopener">Open the Live Demo →</a>
      </footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
