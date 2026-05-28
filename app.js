let reportData = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  fetchData();
});

// ── THEME TOGGLE ──
function setupThemeToggle() {
  const root = document.documentElement;
  const sunPath = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';
  const moonPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

  function applyTheme(next) {
    if (document.startViewTransition) {
      document.startViewTransition(() => syncTheme(next));
    } else {
      syncTheme(next);
    }
    try { localStorage.setItem('ai-report-theme', next); } catch (e) {}
  }

  function syncTheme(next) {
    root.setAttribute('data-theme', next);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-set') === next);
    });
    const mobileIcon = document.getElementById('theme-mobile-icon');
    if (mobileIcon) {
      mobileIcon.innerHTML = next === 'dark' ? sunPath : moonPath;
    }
  }

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.getAttribute('data-theme-set')));
  });

  const mobileBtn = document.getElementById('theme-toggle-mobile');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      const cur = root.getAttribute('data-theme') || 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  // Initial sync (the inline bootstrap script already set data-theme)
  syncTheme(root.getAttribute('data-theme') || 'light');
}

async function fetchData() {
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error("Failed to load data.json");
    reportData = await res.json();
    
    renderApp();
    setupCalculators();
    setupMoEExplorer();
    setupNavigation();
    setupSystem2Modal();
  } catch (error) {
    console.error("Initialization error:", error);
    const errorTarget = document.getElementById("hero-desc");
    if (errorTarget) {
      errorTarget.innerText = "Failed to load data.json. Make sure it exists in the same folder.";
      errorTarget.style.color = "var(--accent-warm)";
    }
  }
}

// ── NAVIGATION CONTROLLER ──
function setupNavigation() {
  const sidebarLinks = document.querySelectorAll(".nav-item a");
  const mobileLinks = document.querySelectorAll(".mobile-nav-item a");
  
  function handleNav(targetId, clickedEl) {
    // Focus target section
    const targetSection = document.getElementById(targetId);
    if (!targetSection) return;

    // Helper to update active nav styles
    function updateActiveState() {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
      document.querySelectorAll(".mobile-nav-item").forEach(item => item.classList.remove("active"));
      
      const parentLi = clickedEl.parentElement;
      parentLi.classList.add("active");
      
      // Match active states across sidebar and mobile
      const label = clickedEl.getAttribute("data-target");
      document.querySelectorAll(`[data-target="${label}"]`).forEach(link => {
        link.parentElement.classList.add("active");
      });
    }

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        updateActiveState();
        targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
        targetSection.querySelector(".section-title")?.focus();
      });
    } else {
      updateActiveState();
      targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
      targetSection.querySelector(".section-title")?.focus();
    }
  }

  [...sidebarLinks, ...mobileLinks].forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      handleNav(targetId, link);
    });
  });

  // Intersection Observer to update active navigation links on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        const activeLink = document.querySelector(`.nav-item a[href="#${id}"]`);
        if (activeLink) {
          document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
          document.querySelectorAll(".mobile-nav-item").forEach(item => item.classList.remove("active"));
          
          activeLink.parentElement.classList.add("active");
          const mobileLink = document.querySelector(`.mobile-nav-item a[href="#${id}"]`);
          if (mobileLink) mobileLink.parentElement.classList.add("active");
        }
      }
    });
  }, { threshold: 0.15, rootMargin: "-80px 0px -40% 0px" });

  document.querySelectorAll("section[id]").forEach(sec => observer.observe(sec));
}

// ── RENDER PAGES / MODULES ──
function renderApp() {
  if (!reportData) return;
  
  // Render Hero
  document.getElementById("hero-title").innerText = reportData.title;
  document.getElementById("hero-desc").innerText = reportData.subtitle;
  
  // Render Hero Stats
  const statsContainer = document.getElementById("stats-target");
  statsContainer.innerHTML = reportData.heroStats.map(stat => `
    <div class="stat-card">
      <div class="stat-num">${stat.num}</div>
      <div class="stat-label">${stat.label}</div>
      <div class="stat-trend">${stat.trend}</div>
    </div>
  `).join("");
  
  // Render Overview Shifters
  const shiftsContainer = document.getElementById("shifts-target");
  shiftsContainer.innerHTML = reportData.macroShifts.map((shift, index) => `
    <div class="card">
      <h3>${shift.icon} ${shift.title}</h3>
      <p class="card-desc">${shift.desc}</p>
      <ul class="card-list">
        ${shift.points.map(pt => `<li>${pt}</li>`).join("")}
      </ul>
      <details class="deep-dive" id="details-shift-${index}">
        <summary>Technical Deep-Dive Details</summary>
        <div class="deep-dive-content">
          Comprehensive review verifies this structural change has transitioned the system lifecycle. Full audit trace confirms: ${shift.points.join(" ")}
        </div>
      </details>
    </div>
  `).join("");

  // Setup support for searchable hidden content (beforematch event)
  setupBeforematchSupport();

  // Render Full Evolution Timeline (1950 - 2026)
  const timelineTarget = document.getElementById("timeline-target");
  timelineTarget.innerHTML = reportData.fullEvolutionTimeline.map(item => `
    <div class="timeline-row">
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-header">
          <div class="timeline-era">${item.era}</div>
          <span class="timeline-badge">${item.architecture}</span>
        </div>
        <div class="timeline-field"><strong>Primary Technical Mechanism:</strong> ${item.mechanism}</div>
        <div class="timeline-field"><strong>Landmark Release:</strong> ${item.landmark}</div>
        <div class="timeline-field" style="color: var(--text-faint);"><strong>Core Operational Limitation:</strong> ${item.limitation}</div>
      </div>
    </div>
  `).join("");
  
  // Render Milestones (Tabs at 2022, 2023, 2024, 2025, 2026)
  renderTimelineMilestones("2026"); // Default to 2026 milestones
  
  // Render Benchmark Table
  const sotaTarget = document.getElementById("sota-target");
  const linkStyle = "color: inherit; text-decoration: underline; text-decoration-color: rgba(255,255,255,0.25); text-decoration-thickness: 1px; text-underline-offset: 3px;";
  const peakClosedStyle = "color: var(--secondary); font-weight: 700; text-decoration: underline; text-decoration-color: rgba(0,229,255,0.45); text-underline-offset: 3px;";
  const peakOpenStyle = "color: var(--accent-pink); font-weight: 700; text-decoration: underline; text-decoration-color: rgba(255,0,153,0.45); text-underline-offset: 3px;";
  
  const cell = (value, link, title, style) => {
    if (!value || value === "N/A") {
      const note = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
      return link
        ? `<a href="${link}" target="_blank" rel="noopener" style="${style || linkStyle}; opacity: 0.6;"${note}>N/A</a>`
        : `<span style="opacity: 0.6;"${note}>N/A</span>`;
    }
    const note = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
    return link
      ? `<a href="${link}" target="_blank" rel="noopener" style="${style || linkStyle}"${note}>${value}</a>`
      : `<span${note}>${value}</span>`;
  };
  
  sotaTarget.innerHTML = reportData.benchmarkSota.map(bench => `
    <tr>
      <td class="text-primary-color">${cell(bench.benchmark, bench.benchmarkLink, "Benchmark paper / definition", linkStyle)}</td>
      <td>${cell(bench.y2022, bench.y2022Link, bench.y2022Note || "", linkStyle)}</td>
      <td>${cell(bench.y2024, bench.y2024Link, bench.y2024Note || "", linkStyle)}</td>
      <td>${cell(bench.peakClosed, bench.peakClosedLink, bench.peakClosedModel || "", peakClosedStyle)}<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${bench.peakClosedModel || ""}</div></td>
      <td>${cell(bench.peakOpen, bench.peakOpenLink, bench.peakOpenModel || "", peakOpenStyle)}<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${bench.peakOpenModel || ""}</div></td>
      <td><span class="trend-up">${bench.trend}</span></td>
    </tr>
  `).join("");
  
  // ── Render Agentic Stack ──
  const stack = reportData.agenticStack;
  if (stack) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
    setText("stack-kicker", stack.kicker);
    setText("stack-heading", stack.title);
    setText("stack-intro", stack.intro);
    
    // Stat strip
    const stackStats = document.getElementById("stack-stats-target");
    if (stackStats && stack.stats) {
      stackStats.innerHTML = stack.stats.map(s => `
        <a class="stack-stat" href="${s.source}" target="_blank" rel="noopener" title="View source">
          <div class="stack-stat-num">${s.num}</div>
          <div class="stack-stat-label">${s.label}</div>
          <div class="stack-stat-trend">${s.trend}</div>
        </a>
      `).join("");
    }
    
    // Harness layers
    const harnessGrid = document.getElementById("harness-grid-target");
    if (harnessGrid && stack.harnessLayers) {
      harnessGrid.innerHTML = stack.harnessLayers.map(layer => `
        <div class="harness-card">
          <div class="harness-card-head">
            <span class="harness-tier">L${layer.tier}</span>
            <span class="harness-icon">${layer.icon}</span>
            <h4 class="harness-name">${layer.name}</h4>
          </div>
          <div class="harness-purpose">${layer.purpose}</div>
          <div class="harness-primitives"><strong>Primitives:</strong> ${layer.primitives}</div>
        </div>
      `).join("");
    }
    
    // Loop strip
    const loopStrip = document.getElementById("loop-strip-target");
    if (loopStrip && stack.loop) {
      loopStrip.innerHTML = `
        <div class="loop-strip-inner">
          <div class="loop-title">
            <span class="loop-title-label">Continuous Loop</span>
            <strong>${stack.loop.title}</strong>
            <span class="loop-desc">${stack.loop.desc}</span>
          </div>
          <div class="loop-phases">
            ${stack.loop.phases.map((p, i) => `
              <div class="loop-phase">
                <span class="loop-phase-icon">${p.icon}</span>
                <div class="loop-phase-text">
                  <div class="loop-phase-name">${p.phase}</div>
                  <div class="loop-phase-tools">${p.tools}</div>
                </div>
              </div>
              ${i < stack.loop.phases.length - 1 ? '<span class="loop-arrow" aria-hidden="true">→</span>' : '<span class="loop-arrow loop-arrow-back" aria-hidden="true">↻</span>'}
            `).join("")}
          </div>
        </div>
      `;
    }
    
    // Protocols
    const protocolGrid = document.getElementById("protocol-grid-target");
    if (protocolGrid && stack.protocols) {
      protocolGrid.innerHTML = stack.protocols.map(p => `
        <div class="protocol-card">
          <div class="protocol-head">
            <h4 class="protocol-name">${p.name}</h4>
            <span class="protocol-released">${p.released}</span>
          </div>
          <div class="protocol-owner">${p.owner}</div>
          <p class="protocol-purpose">${p.purpose}</p>
          <ul class="protocol-stats">
            ${p.stats.map(s => `<li>${s}</li>`).join("")}
          </ul>
          <a class="protocol-link" href="${p.link}" target="_blank" rel="noopener">View source ↗</a>
        </div>
      `).join("");
    }
    
    // Memory architectures
    const memoryTarget = document.getElementById("memory-target");
    if (memoryTarget && stack.memoryArchitectures) {
      memoryTarget.innerHTML = stack.memoryArchitectures.map(m => `
        <tr>
          <td class="text-primary-color"><a href="${m.link}" target="_blank" rel="noopener" style="color: inherit; text-decoration: none; border-bottom: 1px dashed var(--border-hover);">${m.name}</a></td>
          <td>${m.type}</td>
          <td><span class="license-tag">${m.license}</span></td>
          <td><span class="memory-score">${m.score}</span><div style="font-size: 0.7rem; color: var(--text-faint);">${m.scoreLabel}</div></td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${m.highlight}</td>
        </tr>
      `).join("");
    }
    
    // Frameworks
    const frameworksTarget = document.getElementById("frameworks-target");
    if (frameworksTarget && stack.frameworks) {
      frameworksTarget.innerHTML = stack.frameworks.map(f => `
        <tr>
          <td class="text-primary-color">${f.name}</td>
          <td>${f.vendor}</td>
          <td><strong style="color: var(--text-main);">${f.stars}</strong></td>
          <td>${f.downloads}</td>
          <td><span class="approach-tag">${f.approach}</span></td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${f.best}</td>
        </tr>
      `).join("");
    }
    
    // Adoption strip
    const adoption = stack.frameworkAdoption;
    const adoptionStrip = document.getElementById("adoption-strip-target");
    if (adoptionStrip && adoption) {
      adoptionStrip.innerHTML = `
        <div class="adoption-row">
          <div class="adoption-cell">
            <div class="adoption-num">${adoption.experimenting}</div>
            <div class="adoption-label">${adoption.experimentingLabel}</div>
          </div>
          <div class="adoption-divider" aria-hidden="true"></div>
          <div class="adoption-cell">
            <div class="adoption-num adoption-num-prod">${adoption.production}</div>
            <div class="adoption-label">${adoption.productionLabel}</div>
          </div>
          <a class="adoption-source" href="${adoption.source}" target="_blank" rel="noopener">${adoption.sourceLabel} ↗</a>
        </div>
      `;
    }
    
    // Market trajectory
    const marketGrid = document.getElementById("market-grid-target");
    if (marketGrid && stack.marketTrajectory) {
      marketGrid.innerHTML = stack.marketTrajectory.map(m => `
        <a class="market-card" href="${m.link}" target="_blank" rel="noopener">
          <div class="market-company">${m.company}</div>
          <div class="market-headline">${m.headline}</div>
          <div class="market-valuation">${m.valuation}</div>
          <div class="market-detail">${m.detail}</div>
          <div class="market-source">View source ↗</div>
        </a>
      `).join("");
    }
  }
  
  // Render Silicon Platforms
  const hardwareTarget = document.getElementById("hardware-target");
  hardwareTarget.innerHTML = reportData.hardwarePlatforms.map(hw => `
    <div class="card">
      <h3>${hw.name}</h3>
      <div style="font-size: 0.72rem; color: var(--text-faint); margin-top:-0.5rem; margin-bottom: 0.4rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;">
        ${hw.developer}
      </div>
      ${hw.release ? `<div style="font-size: 0.7rem; color: var(--secondary); margin-bottom: 1rem; font-weight: 600;">${hw.release}</div>` : ''}
      <ul class="card-list">
        <li><strong>Compute:</strong> ${hw.capacity}</li>
        <li><strong>Memory:</strong> ${hw.memory}</li>
        <li><strong>Interconnect:</strong> ${hw.bandwidth}</li>
        <li><strong style="color:var(--secondary);">Advantage:</strong> ${hw.advantage}</li>
        <li><strong style="color:var(--accent-warm);">Bottleneck:</strong> ${hw.bottleneck}</li>
      </ul>
    </div>
  `).join("");
  
  // ── Render Data Centers Block ──
  const dc = reportData.dataCenters;
  const dcStatsEl = document.getElementById("dc-stats-target");
  if (dcStatsEl && dc) {
    document.getElementById("dc-kicker").textContent = dc.kicker || "";
    document.getElementById("dc-title").textContent = dc.title || "";
    document.getElementById("dc-intro").textContent = dc.intro || "";
    dcStatsEl.innerHTML = dc.stats.map(s => `
      <a class="stack-stat" href="${s.source}" target="_blank" rel="noopener" title="View source">
        <div class="stack-stat-num">${s.num}</div>
        <div class="stack-stat-label">${s.label}</div>
        <div class="stack-stat-trend">${s.trend}</div>
      </a>
    `).join("");
    
    document.getElementById("dc-projects-target").innerHTML = dc.projects.map(p => `
      <a class="market-card" href="${p.link}" target="_blank" rel="noopener">
        <div class="market-company">${p.name}</div>
        <div class="market-headline" style="font-size: 0.95rem;">${p.scope}</div>
        <div class="market-detail" style="margin-top: 0.85rem;">${p.highlight}</div>
        <div class="market-source">View source ↗</div>
      </a>
    `).join("");
  }
  
  // Render Economics Comparison Grid
  const econTarget = document.getElementById("econ-target");
  econTarget.innerHTML = reportData.economicsSplit.dimensions.map(dim => `
    <tr>
      <td class="text-primary-color">${dim.dimension}</td>
      <td>${dim.centralized}</td>
      <td style="color: var(--secondary); font-weight: 600;">${dim.sovereign}</td>
    </tr>
  `).join("");
  document.getElementById("econ-cagr-text").innerText = reportData.economicsSplit.cagrDetails;
  document.getElementById("econ-cagr-val").innerText = reportData.economicsSplit.cagrProjected2026Valuation;
  
  // ── Render Industry Shift ──
  const ind = reportData.industryShift;
  if (ind) {
    const setT = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
    setT("industry-kicker", ind.kicker);
    setT("industry-heading", ind.title);
    setT("industry-intro", ind.intro);
    setT("industry-pricing-title", ind.pricingShift?.title);
    setT("industry-pricing-desc", ind.pricingShift?.desc);
    
    // Stat strip
    const indStats = document.getElementById("industry-stats-target");
    if (indStats && ind.stats) {
      indStats.innerHTML = ind.stats.map(s => `
        <a class="stack-stat" href="${s.source}" target="_blank" rel="noopener" title="View source">
          <div class="stack-stat-num">${s.num}</div>
          <div class="stack-stat-label">${s.label}</div>
          <div class="stack-stat-trend">${s.trend}</div>
        </a>
      `).join("");
    }
    
    // Pricing pivot table
    const pricingTarget = document.getElementById("industry-pricing-target");
    if (pricingTarget && ind.pricingShift?.rows) {
      pricingTarget.innerHTML = ind.pricingShift.rows.map(r => `
        <tr>
          <td class="text-primary-color">${r.dimension}</td>
          <td>${r.legacy}</td>
          <td style="color: var(--secondary); font-weight: 600;">${r.agentic}</td>
        </tr>
      `).join("");
    }
    
    // Software giants moves
    const giantsTarget = document.getElementById("industry-giants-target");
    if (giantsTarget && ind.giantMoves) {
      giantsTarget.innerHTML = ind.giantMoves.map(g => `
        <a class="market-card" href="${g.link}" target="_blank" rel="noopener">
          <div class="market-company">${g.company}</div>
          <div class="market-headline">${g.headline}</div>
          <div class="market-valuation">${g.stance}</div>
          <div class="market-detail">${g.detail}</div>
          <div class="market-source">View source ↗</div>
        </a>
      `).join("");
    }
    
    // Pullbacks
    const pullbacksTarget = document.getElementById("industry-pullbacks-target");
    if (pullbacksTarget && ind.pullbacks) {
      pullbacksTarget.innerHTML = ind.pullbacks.map(p => `
        <a class="market-card" href="${p.link}" target="_blank" rel="noopener" style="border-left: 3px solid var(--accent-warm);">
          <div class="market-company" style="color: var(--accent-warm);">${p.name}</div>
          <div class="market-headline" style="font-size: 1rem;">${p.trend}</div>
          <div class="market-detail" style="margin-top: 0.85rem;">${p.detail}</div>
          <div class="market-source">View source ↗</div>
        </a>
      `).join("");
    }
  }

  // ── Render Engineers Update — content findings only.
  //    Flow / Demos / Action plan moved to present.html (Presenter's Playbook). ──
  const eng = reportData.engineersUpdate;
  if (eng) {
    const setT = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
    setT("eng-kicker", eng.kicker);
    setT("eng-heading", eng.title);
    setT("eng-subtitle", eng.subtitle);
    setT("eng-intro", eng.intro);

    const engStats = document.getElementById("eng-stats-target");
    if (engStats && eng.stats) {
      engStats.innerHTML = eng.stats.map(s => `
        <a class="stack-stat" href="${s.source}" target="_blank" rel="noopener" title="View source">
          <div class="stack-stat-num">${s.num}</div>
          <div class="stack-stat-label">${s.label}</div>
          <div class="stack-stat-trend">${s.trend}</div>
        </a>
      `).join("");
    }

    const engShifts = document.getElementById("eng-shifts-target");
    if (engShifts && eng.shifts) {
      engShifts.innerHTML = eng.shifts.map(s => `
        <article class="shift-card">
          <div class="shift-card-tag">${s.tag}</div>
          <h4 class="shift-card-title">${s.title}</h4>
          <p class="shift-card-summary">${s.summary}</p>
          <ul class="shift-card-evidence">
            ${s.evidence.map(e => `<li>${e}</li>`).join("")}
          </ul>
          <div class="shift-card-implication">
            <span class="shift-card-implication-label">Implication</span>
            <p>${s.implication}</p>
          </div>
          <a class="shift-card-source" href="${s.sourceLink}" target="_blank" rel="noopener">${s.sourceLabel} ↗</a>
        </article>
      `).join("");
    }

    const engDisc = document.getElementById("eng-disciplines-target");
    if (engDisc && eng.disciplines) {
      engDisc.innerHTML = eng.disciplines.map(d => `
        <div class="discipline-card">
          <div class="discipline-num">${d.num}</div>
          <div class="discipline-title">${d.title}</div>
          <div class="discipline-desc">${d.desc}</div>
          <div class="discipline-stack">${d.stack}</div>
        </div>
      `).join("");
    }

    const engReality = document.getElementById("eng-reality-target");
    if (engReality && eng.realityCheck) {
      engReality.innerHTML = eng.realityCheck.map(r => `
        <div class="reality-card">
          <div class="reality-card-title">${r.title}</div>
          <p class="reality-card-body">${r.body}</p>
        </div>
      `).join("");
    }

    const engResources = document.getElementById("eng-resources-target");
    if (engResources && eng.resources) {
      engResources.innerHTML = eng.resources.map(r =>
        `<a class="resource-pill" href="${r.link}" target="_blank" rel="noopener">${r.label}</a>`
      ).join("");
    }
  }
  
  // Render Deflation Impact
  const deflationTarget = document.getElementById("deflation-target");
  deflationTarget.innerHTML = reportData.deflationaryImpact.map(def => `
    <div class="card">
      <h3>${def.metric}</h3>
      <ul class="card-list">
        <li><strong>Pre-AI Baseline:</strong> ${def.baseline}</li>
        <li><strong>2026 Impact:</strong> ${def.impact}</li>
        <li><strong style="color:var(--secondary);">Driver:</strong> ${def.driver}</li>
      </ul>
    </div>
  `).join("");
  
  // Render Legal Battles
  const legalTarget = document.getElementById("legal-target");
  legalTarget.innerHTML = reportData.legalLitigation.map(leg => `
    <div class="card" style="border-top: 2px solid var(--primary);">
      <h3>${leg.case}</h3>
      <div style="font-size: 0.75rem; color: var(--text-faint); margin-top:-0.5rem; margin-bottom: 0.75rem; font-weight: 600;">
        ${leg.parties}
      </div>
      <p class="card-desc" style="font-size: 0.85rem; margin-bottom: 1rem;">
        <strong>Dispute:</strong> ${leg.dispute}
      </p>
      <div style="font-size: 0.82rem; color: var(--secondary); font-weight: 600;">
        Status: ${leg.resolution}
      </div>
    </div>
  `).join("");
  
  // Render Geopolitical Compass
  const geopoliticalTarget = document.getElementById("geopolitical-target");
  geopoliticalTarget.innerHTML = reportData.cybersecurityAndGeopolitics.categories.map(cat => `
    <tr>
      <td class="text-primary-color">${cat.category}</td>
      <td>${cat.eu}</td>
      <td style="color: var(--secondary); font-weight: 500;">${cat.us}</td>
    </tr>
  `).join("");
}

// Render dynamic milestones for specific years
function renderTimelineMilestones(year) {
  const milestoneTarget = document.getElementById("milestones-target");
  const milestones = reportData.milestones[year];
  
  if (!milestones) return;
  
  milestoneTarget.innerHTML = milestones.map(ms => {
    let tagColor = "var(--primary)";
    if (ms.category === "llm") tagColor = "var(--primary)";
    else if (ms.category === "open-source") tagColor = "var(--secondary)";
    else if (ms.category === "agent") tagColor = "var(--accent-sky)";
    else if (ms.category === "robot") tagColor = "var(--accent-warm)";
    else if (ms.category === "policy") tagColor = "var(--text-faint)";
    else if (ms.category === "science") tagColor = "var(--secondary)";
    
    return `
      <div class="card" style="border-left: 4px solid ${tagColor};">
        <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color: ${tagColor}; letter-spacing:0.1em;">
          ${ms.category}
        </span>
        <h4 style="margin-top: 0.25rem; font-size:1.05rem; font-family:var(--font-display); font-weight:700;">${ms.title}</h4>
        <p class="card-desc" style="margin-top: 0.5rem; font-size: 0.85rem; margin-bottom:0;">${ms.desc}</p>
      </div>
    `;
  }).join("");
  
  // Update year tabs active class
  document.querySelectorAll(".timeline-pill").forEach(pill => {
    if (pill.getAttribute("data-year") === year) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }
  });
}

// Handle timeline pill clicking
window.selectTimelineYear = function(year) {
  if (document.startViewTransition) {
    document.startViewTransition(() => renderTimelineMilestones(year.toString()));
  } else {
    renderTimelineMilestones(year.toString());
  }
};

// ── HEAR FOR SEARCHABLE HIDDEN CONTENT (beforematch) ──
function setupBeforematchSupport() {
  // Feature detection for hidden="until-found"
  const isSupported = 'onbeforematch' in HTMLElement.prototype;
  
  if (!isSupported) {
    // Fallback: Reveal all collapsed details so they are indexable/searchable natively
    document.querySelectorAll("details.deep-dive").forEach(el => {
      el.setAttribute("open", "");
    });
  } else {
    // Standard hidden="until-found" listener
    document.querySelectorAll("details.deep-dive").forEach(detailsEl => {
      detailsEl.addEventListener("beforematch", () => {
        detailsEl.setAttribute("open", "");
      });
    });
  }
}

// ── INTERACTIVE CALCULATOR (SAVINGS) ──
function setupCalculators() {
  const slider = document.getElementById("metered-cost");
  const costValDisplay = document.getElementById("metered-cost-val");
  
  const annualCentralized = document.getElementById("annual-centralized");
  const annualSovereign = document.getElementById("annual-sovereign");
  const annualSavings = document.getElementById("annual-savings");
  
  function updateCalculator() {
    const monthlyCostCentralized = parseInt(slider.value);
    costValDisplay.innerText = monthlyCostCentralized.toLocaleString();
    
    // Compute annual values
    const centralizedAnnual = monthlyCostCentralized * 12;
    // Sovereign is 13x cheaper (13-fold savings: $2,275 vs $168 -> centralized / 13)
    const sovereignAnnual = Math.round(centralizedAnnual / 13.5);
    const savingsAnnual = centralizedAnnual - sovereignAnnual;
    
    annualCentralized.innerText = `$${centralizedAnnual.toLocaleString()}`;
    annualSovereign.innerText = `$${sovereignAnnual.toLocaleString()}`;
    annualSavings.innerText = `$${savingsAnnual.toLocaleString()}`;
  }
  
  if (slider) {
    slider.addEventListener("input", updateCalculator);
    updateCalculator(); // Run initial calculation
  }
}

// ── INTERACTIVE MIXTURE OF EXPERTS EXPLORER ──
function setupMoEExplorer() {
  const btnContainer = document.getElementById("moe-btns");
  if (!btnContainer || !reportData) return;
  
  // Render selector buttons
  btnContainer.innerHTML = reportData.frontierModels2026.map((model, idx) => `
    <button class="moe-btn ${idx === 0 ? 'active' : ''}" onclick="selectMoEModel(${idx})" data-idx="${idx}">
      ${model.name}
    </button>
  `).join("");
  
  selectMoEModel(0); // Display the first model initially
}

window.selectMoEModel = function(index) {
  if (!reportData) return;
  const model = reportData.frontierModels2026[index];
  
  // Update button active state
  document.querySelectorAll(".moe-btn").forEach(btn => {
    if (parseInt(btn.getAttribute("data-idx")) === index) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // Update details
  document.getElementById("moe-model-name").innerText = `${model.name} (${model.developer})`;
  document.getElementById("moe-desc-architecture").innerText = model.architecture;
  document.getElementById("moe-desc-params").innerText = model.parameters;
  document.getElementById("moe-desc-context").innerText = model.context;
  document.getElementById("moe-desc-gpqa").innerText = model.gpqa;
  document.getElementById("moe-desc-capabilities").innerText = model.capabilities;
  
  // Compute parameter boxes visualization
  const visualTarget = document.getElementById("moe-visual-target");

  // Determine expert visual layout based on architecture
  const isMoE = model.architecture.includes("Mixture-of-Experts") || model.architecture.includes("MoE");

  if (isMoE) {
    visualTarget.innerHTML = renderMoEVisual();
  } else {
    visualTarget.innerHTML = renderDenseVisual();
  }
};

// ── ARCHITECTURE SVG VISUALS ──
function renderDenseVisual() {
  // Dense transformer flow: token → embed → N stacked layers (all active) → unembed → next token
  const layerCount = 6;
  const layers = [];
  const startY = 50;
  const gap = 22;
  for (let i = 0; i < layerCount; i++) {
    const y = startY + i * gap;
    layers.push(`
      <rect x="120" y="${y}" width="200" height="16" rx="3" class="node-bg-primary" stroke-width="1.5"/>
      <text x="220" y="${y + 11}" text-anchor="middle" font-size="9" font-weight="600" class="node-text-primary">
        Layer ${i + 1} · Self-Attn + FFN (active)
      </text>
    `);
  }

  return `
    <div class="moe-visualizer-title">Dense Architecture · Full Forward Pass</div>
    <svg class="arch-svg" viewBox="0 0 440 230" role="img" aria-label="Dense transformer architecture diagram">
      <defs>
        <marker id="arr-dense" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-head"/>
        </marker>
      </defs>

      <!-- Input token -->
      <rect x="20" y="100" width="80" height="36" rx="6" class="node-bg-muted" stroke-width="1.5"/>
      <text x="60" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-main">Input Token</text>
      <text x="60" y="128" text-anchor="middle" font-size="8" class="node-text-faint">x_t</text>

      <line x1="100" y1="118" x2="118" y2="118" class="arrow-line" marker-end="url(#arr-dense)"/>

      <!-- Stack background -->
      <rect x="115" y="42" width="210" height="${gap * layerCount + 14}" rx="8" class="layer-stack-fill"/>
      <text x="220" y="36" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="0.08em" class="node-text-faint">DENSE TRANSFORMER STACK · 100% PARAMS ACTIVE</text>

      ${layers.join('')}

      <!-- Stack to output -->
      <line x1="320" y1="118" x2="338" y2="118" class="arrow-line" marker-end="url(#arr-dense)"/>

      <!-- Output -->
      <rect x="340" y="100" width="80" height="36" rx="6" class="node-bg-secondary" stroke-width="1.5"/>
      <text x="380" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-secondary">Logits</text>
      <text x="380" y="128" text-anchor="middle" font-size="8" class="node-text-faint">P(x_t+1)</text>

      <!-- Side annotation: cost -->
      <text x="220" y="${startY + layerCount * gap + 30}" text-anchor="middle" font-size="9" font-weight="600" class="node-text-faint">
        Compute per token = 100% of parameters
      </text>
    </svg>
    <div class="arch-legend">
      <span class="arch-legend-item"><span class="arch-legend-dot active-shared"></span>Active layer</span>
      <span class="arch-legend-item"><span class="arch-legend-dot inactive"></span>None skipped</span>
    </div>
    <div class="moe-formula">
      Active Params = <strong style="color: var(--text-main);">P<sub>total</sub></strong> &nbsp;·&nbsp; every token, every layer
    </div>
  `;
}

function renderMoEVisual() {
  // MoE: token → router → top-K experts highlighted, rest dim → merged → output
  const expertCount = 8;
  const activeIndices = [1, 4]; // top-K = 2
  const expertHeight = 18;
  const expertGap = 4;
  const expertX = 245;
  const expertW = 105;
  const stackTop = 30;

  const experts = [];
  const routeLines = [];
  const mergeLines = [];

  for (let i = 0; i < expertCount; i++) {
    const y = stackTop + i * (expertHeight + expertGap);
    const isActive = activeIndices.includes(i);
    const cls = isActive ? 'node-bg-secondary' : 'node-bg-inactive';
    const txtCls = isActive ? 'node-text-secondary' : 'node-text-faint';
    const pulse = isActive ? ' pulse' : '';

    experts.push(`
      <rect x="${expertX}" y="${y}" width="${expertW}" height="${expertHeight}" rx="3" class="${cls}${pulse}" stroke-width="1.5"/>
      <text x="${expertX + expertW / 2}" y="${y + expertHeight / 2 + 3}" text-anchor="middle" font-size="9" font-weight="${isActive ? 700 : 500}" class="${txtCls}">
        Expert ${i + 1}${isActive ? ' · ACTIVE' : ''}
      </text>
    `);

    // Router → expert lines
    const routerY = 118;
    const expertCenterY = y + expertHeight / 2;
    const lineCls = isActive ? 'arrow-line-active' : 'arrow-line-dim';
    routeLines.push(`<path d="M 215 ${routerY} C 230 ${routerY}, 235 ${expertCenterY}, ${expertX} ${expertCenterY}" class="${lineCls}" fill="none"/>`);

    // Active experts → merge
    if (isActive) {
      mergeLines.push(`<path d="M ${expertX + expertW} ${expertCenterY} C ${expertX + expertW + 18} ${expertCenterY}, ${expertX + expertW + 22} ${routerY}, 380 ${routerY}" class="arrow-line-active" fill="none"/>`);
    }
  }

  return `
    <div class="moe-visualizer-title">Mixture-of-Experts · Sparse Routing</div>
    <svg class="arch-svg" viewBox="0 0 430 240" role="img" aria-label="Mixture of Experts routing diagram">
      <defs>
        <marker id="arr-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-head-active"/>
        </marker>
        <marker id="arr-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" class="arrow-head-dim"/>
        </marker>
      </defs>

      <!-- Input token -->
      <rect x="14" y="100" width="76" height="36" rx="6" class="node-bg-muted" stroke-width="1.5"/>
      <text x="52" y="116" text-anchor="middle" font-size="10" font-weight="600" class="node-text-main">Token</text>
      <text x="52" y="128" text-anchor="middle" font-size="8" class="node-text-faint">x_t</text>
      <line x1="90" y1="118" x2="108" y2="118" class="arrow-line" marker-end="url(#arr-dim)"/>

      <!-- Shared params (embed + attn) -->
      <rect x="110" y="92" width="60" height="52" rx="6" class="node-bg-primary" stroke-width="1.5"/>
      <text x="140" y="111" text-anchor="middle" font-size="9" font-weight="700" class="node-text-primary">Shared</text>
      <text x="140" y="123" text-anchor="middle" font-size="8" class="node-text-primary">Embed +</text>
      <text x="140" y="133" text-anchor="middle" font-size="8" class="node-text-primary">Attention</text>

      <line x1="170" y1="118" x2="188" y2="118" class="arrow-line" marker-end="url(#arr-dim)"/>

      <!-- Router -->
      <polygon points="190,118 215,100 215,136" class="node-bg-primary" stroke-width="1.5"/>
      <text x="201" y="121" text-anchor="middle" font-size="8" font-weight="700" class="node-text-primary">router</text>

      <!-- Expert stack background -->
      <text x="${expertX + expertW / 2}" y="22" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="0.08em" class="node-text-faint">EXPERT BANK · TOP-${activeIndices.length} ACTIVATED</text>

      ${routeLines.join('')}
      ${experts.join('')}
      ${mergeLines.join('')}

      <!-- Merge dot -->
      <circle cx="380" cy="118" r="5" class="node-bg-secondary" stroke-width="1.5"/>

      <line x1="385" y1="118" x2="402" y2="118" class="arrow-line-active" marker-end="url(#arr-active)"/>

      <!-- Output -->
      <rect x="350" y="180" width="76" height="36" rx="6" class="node-bg-secondary" stroke-width="1.5"/>
      <text x="388" y="196" text-anchor="middle" font-size="10" font-weight="600" class="node-text-secondary">Logits</text>
      <text x="388" y="208" text-anchor="middle" font-size="8" class="node-text-faint">P(x_t+1)</text>

      <line x1="380" y1="124" x2="380" y2="178" class="arrow-line-active" marker-end="url(#arr-active)"/>
    </svg>
    <div class="arch-legend">
      <span class="arch-legend-item"><span class="arch-legend-dot active-shared"></span>Shared</span>
      <span class="arch-legend-item"><span class="arch-legend-dot active-expert"></span>Active expert</span>
      <span class="arch-legend-item"><span class="arch-legend-dot inactive"></span>Skipped</span>
    </div>
    <div class="moe-formula">
      Active Params = P<sub>shared</sub> + &Sigma;<sub>i&isin;TopK</sub> P<sub>expert<sub>i</sub></sub> &nbsp;&laquo;&nbsp; P<sub>total</sub>
    </div>
  `;
}


// ─────────────────────────────────────────────────────────────
// SYSTEM 2 EXPLAINER MODAL
// ─────────────────────────────────────────────────────────────
function setupSystem2Modal() {
  const data = reportData?.system2Explainer;
  if (!data) return;

  // ── Render modal contents ──
  const $ = id => document.getElementById(id);
  const setT = (id, val) => { const el = $(id); if (el && val !== undefined) el.textContent = val; };

  setT("s2-kicker", data.kicker);
  setT("s2-modal-title", data.title);
  setT("s2-subtitle", data.subtitle);
  setT("s2-tldr", data.tldr);

  setT("s2-origin-heading", data.origin?.heading);
  setT("s2-origin-body", data.origin?.body);
  const originSrcEl = $("s2-origin-sources");
  if (originSrcEl && data.origin?.sources) {
    originSrcEl.innerHTML = data.origin.sources.map(s =>
      `<a class="s2-source-pill" href="${s.link}" target="_blank" rel="noopener">${s.name}</a>`
    ).join("");
  }

  setT("s2-comparison-heading", data.comparison?.heading);
  const s1List = $("s2-compare-s1");
  const s2List = $("s2-compare-s2");
  if (s1List && s2List && data.comparison?.rows) {
    s1List.innerHTML = data.comparison.rows.map(r =>
      `<li><strong>${r.axis}</strong>${r.s1}</li>`
    ).join("");
    s2List.innerHTML = data.comparison.rows.map(r =>
      `<li><strong>${r.axis}</strong>${r.s2}</li>`
    ).join("");
  }

  setT("s2-cross-heading", data.aiCrossover?.heading);
  setT("s2-cross-body", data.aiCrossover?.body);
  setT("s2-cross-argument", data.aiCrossover?.argument);
  const crossSrcEl = $("s2-cross-sources");
  if (crossSrcEl && data.aiCrossover?.sources) {
    crossSrcEl.innerHTML = data.aiCrossover.sources.map(s =>
      `<a class="s2-source-pill" href="${s.link}" target="_blank" rel="noopener">${s.name}</a>`
    ).join("");
  }

  const meaningEl = $("s2-meaning-target");
  if (meaningEl && data.modernMeaning) {
    meaningEl.innerHTML = data.modernMeaning.map((m, i) => `
      <div class="s2-meaning-card">
        <div class="s2-meaning-card-num">0${i + 1}</div>
        <div class="s2-meaning-card-title">${m.title}</div>
        <div class="s2-meaning-card-desc">${m.desc}</div>
      </div>
    `).join("");
  }

  const landmarksEl = $("s2-landmarks-target");
  if (landmarksEl && data.landmarks) {
    landmarksEl.innerHTML = data.landmarks.map(l => `
      <li class="s2-timeline-item">
        <div class="s2-timeline-head">
          <a class="s2-timeline-name" href="${l.link}" target="_blank" rel="noopener">${l.name}</a>
          <span class="s2-timeline-date">${l.date}</span>
        </div>
        <div class="s2-timeline-note">${l.note}</div>
      </li>
    `).join("");
  }

  setT("s2-caveat-heading", data.caveat?.heading);
  setT("s2-caveat-body", data.caveat?.body);

  // ── Inject inline triggers wherever "System 2" is mentioned ──
  injectSystem2Triggers();

  // ── Wire up open / close behaviour ──
  const backdrop = $("s2-modal");
  const closeBtn = $("s2-modal-close");
  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    backdrop.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    setTimeout(() => closeBtn?.focus(), 50);
  }
  function close() {
    backdrop.classList.remove("is-open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused?.focus) lastFocused.focus();
  }

  // Expose globally so inline triggers can call it
  window.openSystem2Modal = open;

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", e => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && backdrop.classList.contains("is-open")) close();
  });
}

// Replace literal text "System 2" in selected containers with clickable triggers
function injectSystem2Triggers() {
  const selectors = [
    "#shifts-target",       // overview macro shifts cards
    "#timeline-target",     // timeline / paradigm eras
    "#sota-target",         // model capability table
    "#milestones-target"    // milestone bullets
  ];

  const triggerHTML = `<button class="s2-trigger" type="button" onclick="openSystem2Modal()" aria-label="Open System 2 explainer"><span class="s2-trigger-icon">i</span>System 2</button>`;

  selectors.forEach(sel => {
    const root = document.querySelector(sel);
    if (!root) return;
    walkAndReplace(root, /\bSystem 2\b/g, triggerHTML);
  });
}

// Walk all text nodes and replace pattern with HTML, preserving structure
function walkAndReplace(root, pattern, replacementHTML) {
  // Build a non-global tester so .test() doesn't advance lastIndex
  const testRe = new RegExp(pattern.source, pattern.flags.replace("g", ""));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(".s2-trigger, button, a")) return NodeFilter.FILTER_REJECT;
      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") return NodeFilter.FILTER_REJECT;
      return testRe.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const nodesToReplace = [];
  let node;
  while ((node = walker.nextNode())) {
    nodesToReplace.push(node);
  }

  nodesToReplace.forEach(textNode => {
    const text = textNode.nodeValue;
    const replaceRe = new RegExp(pattern.source, pattern.flags); // fresh regex per replace
    const html = text.replace(replaceRe, replacementHTML);
    if (html !== text) {
      const wrapper = document.createElement("span");
      wrapper.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (wrapper.firstChild) frag.appendChild(wrapper.firstChild);
      textNode.parentNode.replaceChild(frag, textNode);
    }
  });
}
