// ─────────────────────────────────────────────────────────────
// live-demo.js · Real in-browser LLM demo for software developers.
//
// Engine: @mlc-ai/web-llm (WebGPU). Falls back to a graceful error if
// WebGPU is unavailable. Models are downloaded lazily on user click,
// then cached by the browser (IndexedDB / Cache Storage) — works
// offline on subsequent runs.
//
// Five demos all share a single MLCEngine instance:
//   1) Streaming Chat — first-token latency + tok/s
//   2) Reasoning Knob — same prompt, three system prompts (low/med/high)
//   3) Persona — same model, different system prompt → different role
//   4) Tool Calling — model emits JSON, browser executes, result fed back
//   5) Multi-Agent Orchestration — Planner → Researcher → Critic
//
// Everything runs locally. No backend. No API keys. Cmd+F "fetch(" —
// the only network call here is the WebLLM weights download.
// ─────────────────────────────────────────────────────────────

import * as webllm from "https://esm.run/@mlc-ai/web-llm@0.2.79";

// ── Shared utilities ────────────────────────────────────────
const $   = (id)  => document.getElementById(id);
const $$  = (sel) => document.querySelectorAll(sel);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));

// ── Available models ────────────────────────────────────────
// Curated list. WebLLM exposes ~150+ pre-quantised builds; we pick
// three that fit a 20-min talk: tiny / small / standard.
const MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 · 1B (recommended)",
    sizeMB: 879,
    family: "llama",
    note: "Best balance for live demos. ~880 MB · loads in ~30 s on fast Wi-Fi."
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 · 3B (best quality)",
    sizeMB: 1828,
    family: "llama",
    note: "Best quality at this size. ~1.8 GB · ~90 s first-load. Cached after."
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen 3 · 0.6B (newest small)",
    sizeMB: 1403,
    family: "qwen3",
    note: "Latest Qwen3 generation. Native <think> reasoning tokens. ~1.4 GB · loads in ~40 s."
  },
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    label: "Qwen 3 · 1.7B (best for reasoning demo)",
    sizeMB: 2037,
    family: "qwen3",
    note: "Strongest small reasoning model. Native <think> tokens make the reasoning knob demo land harder. ~2.0 GB."
  },
  {
    id: "Qwen3-4B-q4f16_1-MLC",
    label: "Qwen 3 · 4B (top quality, pre-cache!)",
    sizeMB: 3432,
    family: "qwen3",
    note: "Best in-browser quality available. ~3.4 GB · ~3 min first-load — pre-cache before the talk."
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 · 0.5B (safety net)",
    sizeMB: 360,
    family: "qwen",
    note: "Tiny — ~360 MB · loads in ~15 s. Lower quality but always works."
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 · 1.5B",
    sizeMB: 868,
    family: "qwen",
    note: "Solid mid-tier. Good multilingual + reasoning."
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    label: "DeepSeek R1 · 7B Distill (cross-vendor reasoning)",
    sizeMB: 4500,
    family: "deepseek",
    note: "DeepSeek R1 distilled into Qwen-7B. Different reasoning style than Qwen3 — great for cross-vendor evals. ~4.5 GB · pre-cache before the talk."
  }
];

// ── Engine state ────────────────────────────────────────────
let engine = null;          // webllm.MLCEngine
let currentModelId = null;  // string | null
let busy = false;           // global generation lock — only one demo runs at a time

// ── Local-first model loading ───────────────────────────────
// If `./models/<modelId>/mlc-chat-config.json` exists next to this HTML, we
// build a custom appConfig pointing WebLLM at local files instead of the CDN.
// Otherwise we transparently fall back to the default HuggingFace-hosted
// build. This requires serving the page over HTTP (Chrome blocks fetch from
// file://); see download-models.sh and `python3 -m http.server` in the repo.
const LOCAL_MODELS_BASE = "./models/";

async function probeLocalModel(modelId) {
  const configUrl = `${LOCAL_MODELS_BASE}${modelId}/mlc-chat-config.json`;
  try {
    const res = await fetch(configUrl, { method: "HEAD", cache: "no-store" });
    if (res.ok) return { ok: true, url: new URL(configUrl, window.location.href).href, status: res.status };
    if (res.status !== 405 && res.status !== 501) {
      return { ok: false, url: new URL(configUrl, window.location.href).href, status: res.status };
    }
  } catch (err) {
    try {
      const res = await fetch(configUrl, { method: "GET", cache: "no-store" });
      return { ok: res.ok, url: new URL(configUrl, window.location.href).href, status: res.status };
    } catch (getErr) {
      return { ok: false, url: new URL(configUrl, window.location.href).href, error: getErr.message || err.message || String(getErr) };
    }
  }
  try {
    const res = await fetch(configUrl, { method: "GET", cache: "no-store" });
    return { ok: res.ok, url: new URL(configUrl, window.location.href).href, status: res.status };
  } catch (err) {
    return { ok: false, url: new URL(configUrl, window.location.href).href, error: err.message || String(err) };
  }
}

async function probeLocalFile(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// WebLLM looks up the model_lib (compiled WebGPU kernel WASM) from a default
// list keyed on the model family + quantisation. When loading locally we have
// to pin it explicitly. download-models.sh mirrors that lib next to the
// weights so the page can run fully offline; older folders can still fall back
// to WebLLM's default CDN/cache URL for the lib.
async function buildLocalAppConfig(modelId, defaultConfig) {
  // Find the default entry to inherit overrides + library path.
  const defaultEntry = (defaultConfig?.model_list || []).find(m =>
    m.model_id === modelId || m.model === modelId
  );
  // WebLLM passes `model` into `new URL(model)` without a base, which throws
  // for relative paths. Build an absolute URL anchored at the current page.
  const localBase = new URL(`${LOCAL_MODELS_BASE}${modelId}/`, window.location.href).href;
  const modelLibName = defaultEntry?.model_lib?.split("/").pop()
    || `${modelId.split("-q")[0].replace(/-MLC$/, "")}-webgpu.wasm`;
  const localModelLib = new URL(modelLibName, localBase).href;
  const hasLocalModelLib = await probeLocalFile(localModelLib);
  const modelLib = hasLocalModelLib ? localModelLib : (defaultEntry?.model_lib || localModelLib);
  return {
    appConfig: {
      model_list: [{
        model: localBase,
        model_id: modelId,
        model_lib: modelLib,
        overrides: defaultEntry?.overrides || { context_window_size: 4096 }
      }]
    },
    hasLocalModelLib
  };
}

// ── DOM bootstrap ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  hydrateModelPicker();
  bindThemeToggle();
  bindNetIndicator();
  bindTabs();
  bindChatDemo();
  bindReasoningDemo();
  bindPersonaDemo();
  bindToolsDemo();
  bindOrchDemo();
  bindEvalsDemo();
  detectWebGPU();
});

// ─────────────────────────────────────────────────────────────
// MODEL PICKER + ENGINE LIFECYCLE
// ─────────────────────────────────────────────────────────────
function hydrateModelPicker() {
  const select = $("model-select");
  select.innerHTML = MODELS.map(m =>
    `<option value="${m.id}">${escapeHtml(m.label)} · ~${(m.sizeMB / 1000).toFixed(2)} GB</option>`
  ).join("");

  // Default to Llama 3.2 1B.
  select.value = MODELS[0].id;
  $("model-hint").textContent = MODELS[0].note;
  select.addEventListener("change", () => {
    const m = MODELS.find(x => x.id === select.value);
    if (m) $("model-hint").textContent = m.note;
  });

  $("model-load-btn").addEventListener("click", () => loadModel(select.value));
  $("model-unload-btn").addEventListener("click", () => unloadModel());
}

async function detectWebGPU() {
  const pill = $("webgpu-pill");
  if (!("gpu" in navigator)) {
    pill.textContent = "WebGPU: unavailable";
    pill.classList.add("model-stat-pill-bad");
    showFatal("This browser doesn't expose WebGPU. Use Chrome/Edge 113+ or Safari Tech Preview, then reload. (You're seeing the static UI; Load model will fail.)");
    return;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      pill.textContent = "WebGPU: no adapter";
      pill.classList.add("model-stat-pill-bad");
      return;
    }
    pill.textContent = "WebGPU: ready";
    pill.classList.add("model-stat-pill-ok");
  } catch (err) {
    pill.textContent = "WebGPU: error";
    pill.classList.add("model-stat-pill-bad");
    console.warn(err);
  }
}

function showFatal(msg) {
  // Insert a non-blocking warning row into the model picker hint.
  const hint = $("model-hint");
  hint.innerHTML = `<strong style="color: var(--accent-warm);">⚠ ${escapeHtml(msg)}</strong>`;
}

async function loadModel(modelId) {
  if (busy) return;
  busy = true;
  const loadBtn   = $("model-load-btn");
  const unloadBtn = $("model-unload-btn");
  const progress  = $("model-progress");
  const fill      = $("model-progress-fill");
  const pText     = $("model-progress-text");
  const modelPill = $("model-pill");

  loadBtn.disabled = true;
  loadBtn.textContent = "⏳ Loading…";
  progress.hidden = false;
  fill.style.width = "0%";
  modelPill.textContent = `loading: ${modelId}`;
  modelPill.classList.remove("model-stat-pill-ok", "model-stat-pill-bad");

  // 1. Probe local folder (./models/<id>/) for pre-downloaded files.
  // 2. Fall back to browser Cache API (already-downloaded CDN weights).
  // 3. Fall back to fresh CDN download.
  const localProbe = await probeLocalModel(modelId);
  const hasLocal = localProbe.ok;
  if (!hasLocal) {
    console.warn("Local model probe failed; falling back to cache/CDN:", localProbe);
  }
  let cacheHit = false;
  if (!hasLocal) {
    try {
      if (typeof caches !== "undefined" && caches.keys) {
        const keys = await caches.keys();
        for (const k of keys) {
          if (!/webllm|mlc/i.test(k)) continue;
          const c = await caches.open(k);
          const reqs = await c.keys();
          const idLower = modelId.toLowerCase();
          if (reqs.some(r => r.url && r.url.toLowerCase().includes(idLower))) {
            cacheHit = true;
            break;
          }
        }
      }
    } catch (_) { /* cache probe is best-effort */ }
  }

  let source = hasLocal ? "local" : (cacheHit ? "cache" : "internet");
  const labelFor = (s) => s === "local"
    ? "💾 from ./models/ · "
    : (s === "cache" ? "📦 from browser cache · " : "🌐 from internet · ");
  if (!hasLocal) {
    const detail = localProbe.status ? `HTTP ${localProbe.status}` : (localProbe.error || "not reachable");
    pText.textContent = `${labelFor(source)}No local model at ${localProbe.url} (${detail}); using ${cacheHit ? "browser cache" : "CDN"}…`;
  }

  const initProgressCallback = (report) => {
    const pct = Math.round((report.progress || 0) * 100);
    fill.style.width = pct + "%";
    pText.textContent = (report.text ? labelFor(source) + report.text : labelFor(source) + `Loading… ${pct}%`);
  };

  let hasLocalModelLib = false;

  // Build the CreateMLCEngine call once so we can retry with a different
  // source if the first attempt fails (local files corrupt/incomplete →
  // automatic fallback to CDN).
  async function tryCreate(useLocal) {
    if (engine) {
      try { await engine.unload(); } catch (_) {}
      engine = null;
    }
    const engineOpts = { initProgressCallback };
    if (useLocal) {
      const localConfig = await buildLocalAppConfig(modelId, webllm.prebuiltAppConfig);
      engineOpts.appConfig = localConfig.appConfig;
      hasLocalModelLib = localConfig.hasLocalModelLib;
    }
    return webllm.CreateMLCEngine(modelId, engineOpts);
  }

  // If a previous local-load attempt poisoned WebLLM's Cache Storage with
  // partial entries, future loads keep failing. Wipe matching cache buckets
  // before retrying from the CDN.
  async function purgeWebLLMCacheFor(id) {
    try {
      if (typeof caches === "undefined" || !caches.keys) return;
      const keys = await caches.keys();
      const idLower = id.toLowerCase();
      for (const k of keys) {
        if (!/webllm|mlc/i.test(k)) continue;
        const c = await caches.open(k);
        const reqs = await c.keys();
        for (const r of reqs) {
          if (r.url && r.url.toLowerCase().includes(idLower)) {
            try { await c.delete(r); } catch (_) {}
          }
        }
      }
    } catch (_) { /* purge is best-effort */ }
  }

  try {
    if (engine && currentModelId !== modelId) {
      try { await engine.unload(); } catch (_) {}
      engine = null;
    }
    if (!engine) {
      try {
        engine = await tryCreate(hasLocal);
      } catch (localErr) {
        if (hasLocal) {
          // Local files broke (missing shard, bad symlink, server stopped, …)
          // — wipe partial cache and retry against the CDN. Keeps the demo
          // bullet-proof on stage.
          console.warn("Local model load failed, falling back to CDN:", localErr);
          source = "internet";
          pText.textContent = `${labelFor("internet")}Local files unavailable, retrying from CDN…`;
          await purgeWebLLMCacheFor(modelId);
          fill.style.width = "0%";
          engine = await tryCreate(false);
        } else {
          throw localErr;
        }
      }
    }
    currentModelId = modelId;
    modelPill.textContent = `model: ${shortName(modelId)}`;
    modelPill.classList.add("model-stat-pill-ok");

    // Quick warm-up: 1 token to prime the kernel cache so the first user
    // generation isn't penalised by JIT compile time.
    pText.textContent = "Warming up kernels…";
    try {
      await engine.chat.completions.create({
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
        temperature: 0
      });
    } catch (_) { /* warm-up failures are non-fatal */ }

    pText.textContent = source === "local"
      ? (hasLocalModelLib
        ? `Ready · ${shortName(modelId)} loaded from ./models/ — fully offline.`
        : `Ready · ${shortName(modelId)} weights loaded from ./models/; WebLLM kernel loaded from CDN/cache.`)
      : (source === "cache"
        ? `Ready · ${shortName(modelId)} loaded from browser cache (offline-capable).`
        : `Ready · ${shortName(modelId)} downloaded and cached — next reload is offline-capable.`);
    fill.style.width = "100%";
    loadBtn.hidden = true;
    unloadBtn.hidden = false;

    // Try to read VRAM info if present
    updateVramReadout();
  } catch (err) {
    console.error("Model load failed:", err);
    pText.textContent = `Load failed: ${err.message || err}`;
    modelPill.textContent = "load failed";
    modelPill.classList.add("model-stat-pill-bad");
    loadBtn.disabled = false;
    loadBtn.textContent = "⬇ Load model";
  } finally {
    busy = false;
  }
}

async function unloadModel() {
  if (!engine) return;
  try { await engine.unload(); } catch (_) {}
  engine = null;
  currentModelId = null;
  $("model-load-btn").hidden = false;
  $("model-load-btn").disabled = false;
  $("model-load-btn").textContent = "⬇ Load model";
  $("model-unload-btn").hidden = true;
  $("model-progress").hidden = true;
  $("model-pill").textContent = "no model loaded";
  $("model-pill").classList.remove("model-stat-pill-ok", "model-stat-pill-bad");
  $("vram-pill").textContent = "VRAM: —";
}

function shortName(id) {
  return id.replace("-Instruct-q4f16_1-MLC", "").replace("-q4f16_1-MLC", "");
}

async function updateVramReadout() {
  // WebLLM exposes runtime stats for the active engine.
  if (!engine) return;
  try {
    const stats = await engine.runtimeStatsText?.();
    if (typeof stats === "string" && stats.length) {
      $("vram-pill").textContent = stats.split(",")[0].slice(0, 36);
    }
  } catch (_) { /* ignore */ }
}

// Helper that ensures a model is loaded before a demo runs. Returns false
// if the user cancels or no model is available.
async function requireModel() {
  if (engine && currentModelId) return true;
  // Auto-load the currently selected option in the picker.
  const id = $("model-select").value;
  await loadModel(id);
  return !!engine;
}

// ─────────────────────────────────────────────────────────────
// THEME + NETWORK INDICATOR + TABS
// ─────────────────────────────────────────────────────────────
function bindThemeToggle() {
  function update() {
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
      update();
    });
  });
  update();
}

function bindNetIndicator() {
  const pill = $("net-status-pill");
  function paint() {
    if (navigator.onLine) {
      pill.textContent = "● online — but inference is local";
      pill.classList.remove("net-pill-offline");
      pill.classList.add("net-pill-online");
    } else {
      pill.textContent = "✈ offline — and still working";
      pill.classList.remove("net-pill-online");
      pill.classList.add("net-pill-offline");
    }
  }
  paint();
  window.addEventListener("online",  paint);
  window.addEventListener("offline", paint);

  $("net-test-btn").addEventListener("click", () => {
    alert("Open DevTools → Network tab → set throttling to ‘Offline’. Then run any demo. The model keeps generating because the weights live in your browser's cache.");
  });
}

function bindTabs() {
  $$(".live-tab").forEach(b => {
    b.addEventListener("click", () => {
      const tab = b.getAttribute("data-tab");
      $$(".live-tab").forEach(x => {
        const on = x === b;
        x.classList.toggle("active", on);
        x.setAttribute("aria-selected", String(on));
      });
      $$(".live-panel").forEach(p =>
        p.classList.toggle("active", p.getAttribute("data-panel") === tab)
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SHARED STREAMING HELPER
// Stream tokens from the engine, updating an output element and
// returning {fullText, ttftMs, totalMs, tokens}.
// ─────────────────────────────────────────────────────────────
async function streamCompletion({
  messages,
  outEl,                 // element to write to (textContent appended)
  onDelta,               // optional (delta, fullText) callback
  onStats,               // optional ({ttftMs, totalMs, tokens, tps}) per chunk
  abortToken,            // {cancelled: boolean}
  maxTokens = 512,
  temperature = 0.7
}) {
  if (!engine) throw new Error("No model loaded");
  const start = performance.now();
  let firstTokenAt = 0;
  let fullText = "";
  let tokens = 0;

  const stream = await engine.chat.completions.create({
    stream: true,
    messages,
    max_tokens: maxTokens,
    temperature
  });

  for await (const chunk of stream) {
    if (abortToken?.cancelled) break;
    const delta = chunk.choices?.[0]?.delta?.content || "";
    if (!delta) continue;
    if (firstTokenAt === 0) firstTokenAt = performance.now();
    fullText += delta;
    tokens += 1;
    if (outEl) outEl.textContent += delta;
    onDelta?.(delta, fullText);
    if (onStats) {
      const totalMs = performance.now() - start;
      const tps = tokens / Math.max(0.001, totalMs / 1000);
      onStats({
        ttftMs: firstTokenAt ? firstTokenAt - start : 0,
        totalMs, tokens, tps
      });
    }
  }
  const totalMs = performance.now() - start;
  const tps = tokens / Math.max(0.001, totalMs / 1000);
  return {
    fullText,
    ttftMs: firstTokenAt ? firstTokenAt - start : 0,
    totalMs,
    tokens,
    tps
  };
}

// ─────────────────────────────────────────────────────────────
// DEMO 1 · STREAMING CHAT
// ─────────────────────────────────────────────────────────────
function bindChatDemo() {
  const messagesEl = $("chat-messages");
  const form  = $("chat-form");
  const input = $("chat-input");
  const sendBtn = $("chat-send");
  const stopBtn = $("chat-stop");
  const ttftEl = $("chat-ttft");
  const tpsEl  = $("chat-tps");
  const tokenEl = $("chat-tokens");

  // Conversation memory for this tab — short, small models can't hold much.
  const history = [
    { role: "system", content: "You are a precise, helpful technical assistant for software developers. Answer concisely. If you don't know, say so." }
  ];
  let abortToken = null;

  const presets = {
    "explain-mcp": "Explain the Model Context Protocol (MCP) in 3 sentences for a senior engineer.",
    "explain-eval": "What is an LLM eval? Give a concrete example I could write today.",
    "rust-vs-go": "Rust vs Go for a high-throughput HTTP server. Pick one and defend it in 4 bullets.",
    "debug-py": "Debug this Python loop:\n\n```python\nfor i in range(10):\n    if i % 2 = 0:\n        print(i)\n```"
  };
  $$(".chat-preset").forEach(b => {
    b.addEventListener("click", () => {
      input.value = presets[b.getAttribute("data-preset")] || "";
      input.focus();
    });
  });

  function appendMessage(role, content) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-msg-${role}`;
    const head = document.createElement("div");
    head.className = "chat-msg-head";
    head.textContent = role === "user" ? "You" : "Assistant";
    const body = document.createElement("div");
    body.className = "chat-msg-body";
    body.textContent = content;
    div.appendChild(head);
    div.appendChild(body);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return body;
  }

  async function send(text) {
    if (!text.trim()) return;
    if (busy) return;
    if (!(await requireModel())) return;

    busy = true;
    sendBtn.hidden = true;
    stopBtn.hidden = false;
    abortToken = { cancelled: false };

    appendMessage("user", text);
    history.push({ role: "user", content: text });

    const outEl = appendMessage("assistant", "");
    ttftEl.textContent = "…";
    tpsEl.textContent = "—";
    tokenEl.textContent = "0";

    try {
      const result = await streamCompletion({
        messages: history,
        outEl,
        abortToken,
        onStats: ({ ttftMs, tokens, tps }) => {
          if (ttftMs) ttftEl.textContent = (ttftMs / 1000).toFixed(2) + " s";
          tpsEl.textContent = tps.toFixed(1);
          tokenEl.textContent = String(tokens);
        }
      });
      history.push({ role: "assistant", content: result.fullText });
    } catch (err) {
      outEl.textContent += `\n\n[error] ${err.message || err}`;
    } finally {
      busy = false;
      sendBtn.hidden = false;
      stopBtn.hidden = true;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = "";
    send(text);
  });
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  stopBtn.addEventListener("click", () => {
    abortToken && (abortToken.cancelled = true);
  });
}

// ─────────────────────────────────────────────────────────────
// DEMO 2 · REASONING KNOB
// Same prompt, three system prompts. We literally show that bigger
// system prompts produce more thoughtful output at the cost of more
// tokens / latency. This is a faithful illustration of how
// reasoning_effort works under the hood.
// ─────────────────────────────────────────────────────────────
const REASONING_PROMPT =
`Non-VIP customers with cart total of exactly 100 complain about
incorrect pricing. See function:

  function getDiscount(user, cart) {
    if (user.isVIP || cart.total > 100) return 0.15;
    return 0.05;
  }

Two engineers disagree on whether it's a bug. PM confirms the
customer is correct. Return the corrected getDiscount as a JS
code block.`;

// Each level uses an "answer-first" pattern so the model commits to a final
// recommendation even when the token budget is tight, then expands. Budgets
// are sized to comfortably fit the full output for Llama-3.2-1B class models.
//
// Note: small reasoning models (Qwen3) wrap output in <think>...</think> by
// default, which would eat the entire budget before any answer surfaces.
// We append "/no_think" to disable Qwen3's built-in reasoning so this tab
// stays a clean demo of *prompt-engineered* effort levels — exactly the
// knob shown in the talking-points script.
const NO_THINK_DIRECTIVE = "\n\n/no_think";

const REASONING_LEVELS = [
  {
    id: "low",
    system:
`You are a fast assistant. Reply in EXACTLY one sentence with the answer
to the question. Do not explain. Do not show working. One sentence only.`,
    user: REASONING_PROMPT,
    maxTokens: 400
  },
  {
    id: "med",
    system:
`You are a careful engineer. Think step by step before answering.
Compare the BUGGY code's comparison operator against what the SPEC requires.
Then output exactly this structure:
TRACE: <one line: what does the buggy code do when cart.total === 100? what does the spec say it should do?>
ANSWER: <one sentence naming the off-by-one operator that must change>
FIX: <the corrected function as a JavaScript code block — it MUST be different from the buggy code>
Keep it tight. Do not output the buggy code unchanged.`,
    user: REASONING_PROMPT,
    maxTokens: 700
  },
  {
    id: "high",
    system:
`You are a senior engineer doing a careful code review. Think step-by-step
at every phase — never commit to a conclusion until you have walked through
the actual values. Use exactly this structure, in order. Each section MUST
begin with "Think step-by-step:" and show your reasoning before stating the
result on the next line.

RESTATE — Think step-by-step: read the customer complaint. What boundary
value are they pointing at? Then in one line: what does the spec require?

TRACE — Think step-by-step: evaluate EACH operator in the buggy predicate
separately for the boundary case (user.isVIP === false, cart.total === 100).
Walk through "user.isVIP" → ?, then "cart.total > 100" → ?, then the "||"
combining them → ?. Then in one line: what does the buggy code RETURN at the
boundary, and what SHOULD it return per the customer?

DIAGNOSIS — Think step-by-step: which single sub-expression in the predicate
produced the wrong value at the boundary in your trace above? It is NOT the
"||" — both engineers should get the discount, so OR is correct. Look at the
COMPARISON operator. Then in one line: name the exact operator that is wrong
and what it must become. (Hint: the bug is at the boundary value 100, so the
fix involves how the comparison treats equality.)

FIX — Think step-by-step: copy the buggy function, then change ONLY that one
operator. Then output the corrected function as a JavaScript code block. It
MUST differ from the buggy code by exactly one character.

VERIFY — Think step-by-step: re-run the TRACE with cart.total === 100 against
your FIXED code. Walk through each operator again. Then in one line: confirm
the boundary now returns the correct discount.

EDGE CASES — Think step-by-step: what happens at cart.total === 99.99? at
cart.total === 100.00? at cart.total === 100.01? Then in one line: name the
edge case the fix now handles correctly.

Hard rules: (1) The "||" operator is CORRECT — do not change it. (2) The bug
is in the comparison operator, not the logical operator. (3) You MUST not
output the original buggy function as the FIX.`,
    user: REASONING_PROMPT,
    maxTokens: 2400
  }
];

function bindReasoningDemo() {
  $("reasoning-prompt-code").textContent = REASONING_PROMPT;

  const runBtn = $("reasoning-run");
  const resetBtn = $("reasoning-reset");
  const elapsedEl = $("reasoning-elapsed");
  let abortToken = null;

  function clearAll() {
    REASONING_LEVELS.forEach(l => {
      $("rout-" + l.id).textContent = "";
      $$("#rstats-" + l.id + " [data-stat]").forEach(s => s.textContent = "—");
      $(`rout-${l.id}`).parentElement.classList.remove("reasoning-level-active", "reasoning-level-done");
    });
    elapsedEl.textContent = "";
  }

  async function runOne(level) {
    const out = $("rout-" + level.id);
    const stats = $("rstats-" + level.id);
    const card = out.parentElement;
    card.classList.add("reasoning-level-active");
    out.textContent = "";
    const tokensEl = stats.querySelector("[data-stat=tokens]");
    const timeEl   = stats.querySelector("[data-stat=time]");
    const tpsEl    = stats.querySelector("[data-stat=tps]");

    // Qwen3 emits built-in <think> blocks by default; append /no_think so
    // this tab stays a clean demo of *prompt-engineered* effort levels.
    // /no_think is a soft hint though — Qwen3 still leaks reasoning tokens
    // that get stripped from the visible output but still count against
    // the budget. Give it 2× headroom so the answer always finishes.
    const isQwen3 = (currentModelId || "").toLowerCase().startsWith("qwen3");
    const userContent = isQwen3 ? level.user + NO_THINK_DIRECTIVE : level.user;
    const tokenBudget = isQwen3 ? Math.round(level.maxTokens * 2) : level.maxTokens;

    const messages = [
      { role: "system", content: level.system },
      { role: "user", content: userContent }
    ];

    let raw = "";
    const result = await streamCompletion({
      messages,
      abortToken,
      maxTokens: tokenBudget,
      temperature: 0.4,
      onDelta: (_delta, full) => {
        raw = full;
        // Strip closed <think>...</think> blocks (model finished thinking).
        // While the model is still inside an unterminated <think>, keep the
        // raw thinking visible — but with a label so the audience knows it's
        // the model's monologue, not the final answer. Once </think> arrives
        // we hide it and show only the post-answer.
        const closed = /<think>[\s\S]*?<\/think>/g;
        const stripped = raw.replace(closed, "").trim();
        const inThink = /<think>[\s\S]*$/.test(raw) && !/<\/think>/.test(raw);
        if (inThink && !stripped) {
          // Show the live thinking with a kicker so it's clear what's happening
          const thinking = raw.replace(/^<think>/, "").trim();
          out.textContent = "[model thinking…]\n\n" + thinking;
        } else {
          out.textContent = stripped;
        }
      },
      onStats: ({ tokens, totalMs, tps }) => {
        tokensEl.textContent = String(tokens);
        timeEl.textContent   = (totalMs / 1000).toFixed(1) + "s";
        tpsEl.textContent    = tps.toFixed(1);
      }
    });
    card.classList.remove("reasoning-level-active");
    card.classList.add("reasoning-level-done");
    return result;
  }

  async function runAll() {
    if (busy) return;
    if (!(await requireModel())) return;
    busy = true;
    runBtn.disabled = true;
    runBtn.textContent = "● Running…";
    resetBtn.disabled = true;
    abortToken = { cancelled: false };
    clearAll();

    const start = performance.now();
    for (const level of REASONING_LEVELS) {
      if (abortToken.cancelled) break;
      try {
        await runOne(level);
      } catch (err) {
        $("rout-" + level.id).textContent += `\n[error] ${err.message || err}`;
      }
      const elapsed = (performance.now() - start) / 1000;
      elapsedEl.textContent = `Total elapsed: ${elapsed.toFixed(1)}s`;
    }

    busy = false;
    runBtn.disabled = false;
    runBtn.textContent = "▶ Run all three";
    resetBtn.disabled = false;
  }

  runBtn.addEventListener("click", runAll);
  resetBtn.addEventListener("click", () => {
    if (abortToken) abortToken.cancelled = true;
    clearAll();
  });
}

// ─────────────────────────────────────────────────────────────
// DEMO 3 · PERSONA
// Same user prompt. Three system prompts. Different output.
// ─────────────────────────────────────────────────────────────
const PERSONAS = [
  {
    id: "sre",
    label: "Senior SRE",
    system: "You are a calm, terse senior site reliability engineer. Reply in 3-5 numbered steps. No preamble, no fluff, no closing remarks. Stop after the last step."
  },
  {
    id: "skeptic",
    label: "Skeptical Reviewer",
    system: "You are a senior engineer doing code review. Reply with at most 4 short bullets — each names one concrete risk, edge case, or missing test. No preamble. Be blunt but constructive. Stop after the last bullet."
  },
  {
    id: "kid",
    label: "10-year-old",
    system: "You are a curious 10-year-old. Use simple words. Use short sentences. Reply in at most 3 sentences. Stop there."
  },
  {
    id: "shakespeare",
    label: "Shakespeare",
    system: "Thou art an Elizabethan-era playwright. Reply in iambic pentameter where possible, in ye olde English. At most 6 lines. Stop after the sixth line."
  }
];

// Stage-ready preset prompts. The first is the default — picked because
// it makes the SRE / Skeptic / 10-year-old contrast loud and obvious:
// SRE produces a runbook, Skeptic asks for evidence, kid asks if the
// computer is tired. Pick whichever lands hardest with the room.
const PERSONA_PRESETS = [
  {
    id: "incident",
    label: "Incident triage",
    text: "Our login API just spiked to 5% HTTP 500 errors after a deploy 10 minutes ago. P99 latency looks normal. What do I do in the next 5 minutes?"
  },
  {
    id: "review",
    label: "Code review",
    text: "Review this function and tell me if you'd merge it:\n\nfunction divide(a, b) {\n  return a / b;\n}"
  },
  {
    id: "arch",
    label: "Architecture call",
    text: "Should we put a Redis cache in front of our Postgres reads to fix slow dashboard queries? Be specific."
  },
  {
    id: "debug",
    label: "Flaky test",
    text: "A test passes locally but fails 30% of the time in CI. Same code, same commit. Where do I start?"
  }
];

function bindPersonaDemo() {
  const buttonsEl = $("persona-buttons");
  const systemEl  = $("persona-system");
  const grid = $("persona-grid");
  const input = $("persona-input");
  const presetsEl = $("persona-presets");
  const runBtn = $("persona-run");
  const stopBtn = $("persona-stop");
  const selected = new Set([ "sre", "skeptic", "kid" ]);
  let abortToken = null;

  function renderPresets() {
    if (!presetsEl) return;
    presetsEl.innerHTML = PERSONA_PRESETS.map(p => `
      <button type="button" class="persona-preset" data-id="${p.id}">${escapeHtml(p.label)}</button>
    `).join("");
    presetsEl.querySelectorAll("button.persona-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        const preset = PERSONA_PRESETS.find(p => p.id === btn.getAttribute("data-id"));
        if (!preset) return;
        input.value = preset.text;
        presetsEl.querySelectorAll("button.persona-preset").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        input.focus();
      });
    });
  }

  function renderButtons() {
    buttonsEl.innerHTML = PERSONAS.map(p => `
      <label class="persona-chip ${selected.has(p.id) ? "active" : ""}">
        <input type="checkbox" data-id="${p.id}" ${selected.has(p.id) ? "checked" : ""}>
        ${escapeHtml(p.label)}
      </label>
    `).join("");
    buttonsEl.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-id");
        if (cb.checked) selected.add(id); else selected.delete(id);
        cb.closest(".persona-chip").classList.toggle("active", cb.checked);
        renderSystem();
        renderGrid();
      });
    });
  }
  function renderSystem() {
    const list = [...selected].map(id => PERSONAS.find(p => p.id === id)).filter(Boolean);
    systemEl.textContent = list.length === 0
      ? "(no persona selected)"
      : list.map(p => `// ${p.label}\n${p.system}`).join("\n\n");
  }
  function renderGrid() {
    const list = [...selected].map(id => PERSONAS.find(p => p.id === id)).filter(Boolean);
    if (list.length === 0) {
      grid.innerHTML = '<div class="persona-empty">Pick at least one persona above.</div>';
      return;
    }
    grid.innerHTML = list.map(p => `
      <article class="persona-card" data-id="${p.id}">
        <header class="persona-card-head">
          <strong>${escapeHtml(p.label)}</strong>
          <span class="persona-card-stats" id="pstat-${p.id}">—</span>
        </header>
        <pre class="persona-card-body" id="pout-${p.id}"></pre>
      </article>
    `).join("");
  }

  async function runAll() {
    const text = input.value.trim();
    if (!text) return;
    if (busy) return;
    if (!(await requireModel())) return;
    if (selected.size === 0) return;

    busy = true;
    runBtn.hidden = true;
    stopBtn.hidden = false;
    abortToken = { cancelled: false };

    // Render fresh grid (clears outputs)
    renderGrid();

    const list = [...selected].map(id => PERSONAS.find(p => p.id === id)).filter(Boolean);

    // Run sequentially — small models can't time-share the GPU well.
    for (const p of list) {
      if (abortToken.cancelled) break;
      const out = $("pout-" + p.id);
      const stats = $("pstat-" + p.id);
      const messages = [
        { role: "system", content: p.system },
        { role: "user", content: text }
      ];
      try {
        await streamCompletion({
          messages, outEl: out, abortToken,
          maxTokens: 1600,
          temperature: 0.7,
          onStats: ({ tokens, tps, totalMs }) => {
            stats.textContent = `${tokens} tok · ${(totalMs/1000).toFixed(1)}s · ${tps.toFixed(0)} tok/s`;
          }
        });
      } catch (err) {
        out.textContent += `\n[error] ${err.message || err}`;
      }
    }

    busy = false;
    runBtn.hidden = false;
    stopBtn.hidden = true;
  }

  runBtn.addEventListener("click", runAll);
  stopBtn.addEventListener("click", () => {
    if (abortToken) abortToken.cancelled = true;
  });
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runAll();
    }
  });

  renderButtons();
  renderSystem();
  renderGrid();
  renderPresets();

  // Pre-fill with the strongest contrast scenario so the demo is one click
  // away on stage. Mark its chip active so the audience can see what's loaded.
  if (PERSONA_PRESETS.length > 0 && !input.value) {
    input.value = PERSONA_PRESETS[0].text;
    const firstBtn = presetsEl && presetsEl.querySelector(`button.persona-preset[data-id="${PERSONA_PRESETS[0].id}"]`);
    if (firstBtn) firstBtn.classList.add("active");
  }
}

// ─────────────────────────────────────────────────────────────
// DEMO 4 · TOOL CALLING (custom JSON protocol)
// Most small open-weight models don't have native function-calling
// JSON-mode like GPT-5/Claude. We define a tiny convention:
//
//   {"tool": "<name>", "args": { ... }}                  → tool call
//   {"final": "<answer to the user>"}                    → final answer
//
// The model's system prompt teaches it the protocol. We parse the
// first JSON object out of the response, run the tool, append the
// result to history, and loop. Max 4 iterations to keep demos fast.
// ─────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression. Args: { expression: string }. Operators: + - * / ( ) and decimals.",
    handler: ({ expression }) => {
      // Very strict allow-list to avoid eval-injection — only digits, ops, dots, parens.
      if (typeof expression !== "string") throw new Error("expression must be a string");
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) throw new Error("only +, -, *, /, ., ( ), digits allowed");
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${expression});`)();
      return { result: v };
    }
  },
  {
    name: "get_time",
    description: "Get the current time in a city. Args: { city: string }. Supported: 'Tokyo','London','New York','Sydney'.",
    handler: ({ city }) => {
      const tz = { "tokyo": "Asia/Tokyo", "london": "Europe/London", "new york": "America/New_York", "sydney": "Australia/Sydney" };
      const k = String(city || "").trim().toLowerCase();
      const z = tz[k] || "UTC";
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: z, weekday: "short", year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short"
      });
      return { city, timezone: z, now: fmt.format(new Date()) };
    }
  },
  {
    name: "search_report",
    description: "Search the AI Evolution report (data.json) for a keyword. Args: { query: string }. Returns up to 3 matching snippets.",
    handler: async ({ query }) => {
      try {
        const res = await fetch("data.json");
        const json = await res.json();
        const flat = JSON.stringify(json);
        const q = String(query || "").toLowerCase();
        if (!q) return { matches: [] };
        const out = [];
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        let m;
        while ((m = re.exec(flat)) && out.length < 3) {
          const i = m.index;
          out.push(flat.slice(Math.max(0, i - 80), Math.min(flat.length, i + 160)).replace(/\\"/g, '"'));
        }
        return { matches: out, total: out.length };
      } catch (err) {
        return { error: err.message };
      }
    }
  }
];

const TOOL_SYSTEM_PROMPT = `You are a tool-using assistant. You can call exactly ONE of these tools per turn:

${TOOLS.map(t => `- ${t.name} — ${t.description}`).join("\n")}

COPY THESE PATTERNS:
User asks: What is 17 * 24? Use calculator.
Assistant responds: {"tool":"calculator","args":{"expression":"17*24"}}
User provides: [tool result for calculator] {"result":408}
Assistant responds: {"final":"17 * 24 = 408."}

User asks: What time is it now in Tokyo? Use get_time.
Assistant responds: {"tool":"get_time","args":{"city":"Tokyo"}}
User provides: [tool result for get_time] {"city":"Tokyo","timezone":"Asia/Tokyo","now":"Mon, 01 Jan 2026, 09:00 JST"}
Assistant responds: {"final":"It is Mon, 01 Jan 2026, 09:00 JST in Tokyo."}

User asks: Search this report for "WebGPU". Return one short finding. Use search_report.
Assistant responds: {"tool":"search_report","args":{"query":"WebGPU"}}
User provides: [tool result for search_report] {"matches":["WebGPU lets browser demos run local models."],"total":1}
Assistant responds: {"final":"One finding: WebGPU lets browser demos run local models."}

PROTOCOL (follow exactly):
- To call a tool, respond with ONLY a single JSON object on one line:
  {"tool":"<name>","args":{ ... }}
- After the user provides the tool result, you MUST either call another tool or give the final answer.
- To give the final answer, respond with ONLY a single JSON object:
  {"final":"<your answer to the original question>"}
- Do not include any prose outside the JSON. Do not wrap in code fences.
- Do not use <think> tags. Skip reasoning. Output JSON only.
- If a tool errors, try a different approach or give your best final answer with what you have.

/no_think`;

function bindToolsDemo() {
  const list = $("tools-toolbox-list");
  list.innerHTML = TOOLS.map(t => `
    <div class="tools-tool">
      <div class="tools-tool-name">${escapeHtml(t.name)}</div>
      <div class="tools-tool-desc">${escapeHtml(t.description)}</div>
    </div>
  `).join("");

  const form = $("tools-form");
  const input = $("tools-input");
  const sendBtn = $("tools-send");
  const stopBtn = $("tools-stop");
  const trace = $("tools-trace");
  let abortToken = null;

  $$(".tools-preset").forEach(b => {
    b.addEventListener("click", () => { input.value = b.textContent; input.focus(); });
  });

  function appendStep(kind, payload) {
    const empty = trace.querySelector(".tools-trace-empty");
    if (empty) empty.remove();
    const div = document.createElement("div");
    div.className = "tools-step tools-step-" + kind;
    if (kind === "user") {
      div.innerHTML = `<div class="tools-step-head">User</div><div class="tools-step-body">${escapeHtml(payload)}</div>`;
    } else if (kind === "thought") {
      div.innerHTML = `<div class="tools-step-head">Model</div><pre class="tools-step-body">${escapeHtml(payload)}</pre>`;
    } else if (kind === "call") {
      div.innerHTML = `<div class="tools-step-head">⚙ Tool call · ${escapeHtml(payload.tool)}</div><pre class="tools-step-body">${escapeHtml(JSON.stringify(payload.args, null, 2))}</pre>`;
    } else if (kind === "result") {
      div.innerHTML = `<div class="tools-step-head">→ Tool result</div><pre class="tools-step-body">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
    } else if (kind === "final") {
      div.innerHTML = `<div class="tools-step-head">✓ Final answer</div><div class="tools-step-body">${escapeHtml(payload)}</div>`;
    } else if (kind === "error") {
      div.innerHTML = `<div class="tools-step-head">⚠ Error</div><div class="tools-step-body">${escapeHtml(payload)}</div>`;
    }
    trace.appendChild(div);
    trace.scrollTop = trace.scrollHeight;
    return div;
  }

  // Pull the first complete JSON object out of arbitrary text.
  // Robust to: <think>...</think> prefixes (Qwen3), markdown ```json fences,
  // leading prose, and multiple candidate objects.
  function extractJson(text) {
    if (!text) return null;
    // Strip closed <think>...</think> blocks (Qwen3 native reasoning tokens).
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    // If think tag is unterminated, drop everything up to the last <think> opener.
    const lastOpen = cleaned.lastIndexOf("<think>");
    if (lastOpen >= 0 && cleaned.indexOf("</think>", lastOpen) < 0) {
      cleaned = cleaned.slice(lastOpen + "<think>".length);
    }
    // Strip ```json ... ``` and ``` ... ``` fences.
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

    // Walk every '{' as a candidate start, return the first parseable object
    // that contains either a "tool" or "final" key.
    for (let s = cleaned.indexOf("{"); s >= 0; s = cleaned.indexOf("{", s + 1)) {
      let depth = 0, inStr = false, esc = false;
      for (let i = s; i < cleaned.length; i++) {
        const c = cleaned[i];
        if (inStr) {
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === "{") depth++;
          else if (c === "}") {
            depth--;
            if (depth === 0) {
              const slice = cleaned.slice(s, i + 1);
              try {
                const obj = JSON.parse(slice);
                if (obj && (obj.tool || obj.final)) return obj;
              } catch (_) { /* try next opener */ }
              break;
            }
          }
        }
      }
    }
    return null;
  }

  async function runAgent(question) {
    if (busy) return;
    if (!(await requireModel())) return;
    busy = true;
    sendBtn.hidden = true;
    stopBtn.hidden = false;
    abortToken = { cancelled: false };

    appendStep("user", question);

    const messages = [
      { role: "system", content: TOOL_SYSTEM_PROMPT },
      { role: "user",   content: question }
    ];

    const MAX_TURNS = 4;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (abortToken.cancelled) break;

      // Step 1: ask the model what to do.
      const stepEl = appendStep("thought", "");
      const outPre = stepEl.querySelector("pre");
      let raw;
      try {
        const result = await streamCompletion({
          messages, outEl: outPre, abortToken,
          maxTokens: 220,
          temperature: 0
        });
        raw = result.fullText;
      } catch (err) {
        appendStep("error", err.message || String(err));
        break;
      }
      if (abortToken.cancelled) break;
      const obj = extractJson(raw);
      if (!obj) {
        appendStep("error", "Model did not produce parseable JSON. Stopping.");
        break;
      }

      // Step 2: dispatch.
      if (obj.final) {
        messages.push({ role: "assistant", content: raw });
        appendStep("final", obj.final);
        break;
      }
      if (obj.tool) {
        const tool = TOOLS.find(t => t.name === obj.tool);
        if (!tool) {
          appendStep("error", `Unknown tool: ${obj.tool}`);
          messages.push({ role: "assistant", content: raw });
          messages.push({ role: "user", content: `[tool error] No tool named "${obj.tool}". Try one of: ${TOOLS.map(t=>t.name).join(", ")}` });
          continue;
        }
        appendStep("call", { tool: obj.tool, args: obj.args || {} });
        let result;
        try {
          result = await tool.handler(obj.args || {});
        } catch (err) {
          result = { error: err.message };
        }
        appendStep("result", result);
        messages.push({ role: "assistant", content: raw });
        messages.push({ role: "user", content: `[tool result for ${obj.tool}] ${JSON.stringify(result)}` });
        continue;
      }
      // Neither final nor tool: stop.
      appendStep("error", "Response was JSON but had neither {tool} nor {final}.");
      break;
    }

    busy = false;
    sendBtn.hidden = false;
    stopBtn.hidden = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    runAgent(q);
  });
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  stopBtn.addEventListener("click", () => {
    if (abortToken) abortToken.cancelled = true;
  });
}

// ─────────────────────────────────────────────────────────────
// DEMO 5 · MULTI-AGENT ORCHESTRATION
// One model. Three system prompts. Sequential calls. Each agent's
// output is the next agent's input.
// ─────────────────────────────────────────────────────────────
// `/no_think` is appended to disable Qwen3's native <think> reasoning, which
// otherwise consumes the role's token budget before producing visible output.
const ORCH_NO_THINK = "\n\n/no_think";
const ORCH_AGENTS = {
  planner: {
    label: "Planner",
    system: "You are the Planner. Given a user question, write 3 short, concrete sub-questions a researcher must answer to give a complete reply. Output ONLY a numbered list (1., 2., 3.), nothing else. No preamble. No reasoning." + ORCH_NO_THINK,
    maxTokens: 320
  },
  researcher: {
    label: "Researcher",
    system: "You are the Researcher. The user gives you 3 sub-questions from the Planner. Answer each in 2-4 sentences with concrete facts and tradeoffs. Use this exact format and nothing else:\nQ1: <restate question 1>\nA1: <answer>\n\nQ2: <restate question 2>\nA2: <answer>\n\nQ3: <restate question 3>\nA3: <answer>" + ORCH_NO_THINK,
    maxTokens: 700
  },
  critic: {
    label: "Critic",
    system: "You are the Critic. Read the Researcher's answers. Identify the SINGLE weakest claim and ONE risk the Researcher missed. Output exactly two short bullets and nothing else:\n- Weakest claim: <one sentence>\n- Missed risk: <one sentence>" + ORCH_NO_THINK,
    maxTokens: 280
  },
  final: {
    label: "Final",
    system: "You are the Final Synthesiser. You receive: (1) the original question, (2) the Researcher's answers, (3) the Critic's notes. Merge them into a single concise answer for the user. 4-6 sentences max. End with one line: 'Recommendation: <one sentence>'." + ORCH_NO_THINK,
    maxTokens: 600
  }
};

// Strip <think>...</think> blocks and any unterminated trailing think state
// so the final pane shows answers, not raw reasoning.
function stripThink(text) {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const lastOpen = cleaned.lastIndexOf("<think>");
  if (lastOpen >= 0 && cleaned.indexOf("</think>", lastOpen) < 0) {
    cleaned = cleaned.slice(0, lastOpen);
  }
  return cleaned.trim();
}

function bindOrchDemo() {
  const form = $("orch-form");
  const input = $("orch-input");
  const sendBtn = $("orch-send");
  const stopBtn = $("orch-stop");
  let abortToken = null;

  const presets = {
    "rate-limiter": "Design a rate limiter for a public REST API at ~10k QPS. What algorithm, what storage, what tradeoffs?",
    "oncall": "Our on-call dashboard takes 30 seconds to load. What are the top 3 things I should check first?",
    "migrate": "Should we migrate from Postgres to a vector DB for embeddings? Pros, cons, recommendation."
  };
  $$(".orch-preset").forEach(b => {
    b.addEventListener("click", () => { input.value = presets[b.getAttribute("data-preset")] || b.textContent; input.focus(); });
  });

  function clearAll() {
    Object.keys(ORCH_AGENTS).forEach(k => {
      const out = $("orch-out-" + k);
      out.textContent = "";
      out.classList.remove("orch-pane-active", "orch-pane-done");
      const pane = out.closest(".orch-pane");
      if (pane) {
        const oldRecv = pane.querySelector(".orch-pane-received");
        if (oldRecv) oldRecv.remove();
      }
    });
  }

  // Show a visible "Received from upstream agent(s)" header above the pane body
  // so the audience sees how data flows from one agent to the next.
  function showReceived(role, summary) {
    const out = $("orch-out-" + role);
    const pane = out.closest(".orch-pane");
    if (!pane) return;
    const old = pane.querySelector(".orch-pane-received");
    if (old) old.remove();
    const recv = document.createElement("div");
    recv.className = "orch-pane-received";
    recv.textContent = summary;
    pane.insertBefore(recv, out);
  }

  function preview(text, n = 90) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  async function runRole(role, userContent, receivedSummary) {
    const out = $("orch-out-" + role);
    out.textContent = "";
    out.classList.remove("orch-pane-done");
    out.classList.add("orch-pane-active");
    if (receivedSummary) showReceived(role, receivedSummary);
    const cfg = ORCH_AGENTS[role];
    const messages = [
      { role: "system", content: cfg.system },
      { role: "user",   content: userContent }
    ];
    const r = await streamCompletion({
      messages, outEl: out, abortToken,
      maxTokens: cfg.maxTokens,
      temperature: 0.5
    });
    out.classList.remove("orch-pane-active");
    out.classList.add("orch-pane-done");
    // Strip Qwen3 <think> blocks before passing to the next agent
    // (and visually clean up the displayed output).
    const clean = stripThink(r.fullText);
    if (clean !== r.fullText) out.textContent = clean;
    return clean;
  }

  async function run() {
    const question = input.value.trim();
    if (!question) return;
    if (busy) return;
    if (!(await requireModel())) return;
    busy = true;
    sendBtn.hidden = true;
    stopBtn.hidden = false;
    abortToken = { cancelled: false };
    clearAll();

    try {
      const plan = await runRole(
        "planner",
        question,
        `← User question: "${preview(question, 70)}"`
      );
      if (abortToken.cancelled) throw new Error("cancelled");

      const research = await runRole(
        "researcher",
        `User question:\n${question}\n\nSub-questions from the Planner:\n${plan}`,
        `← Planner's 3 sub-questions: "${preview(plan, 70)}"`
      );
      if (abortToken.cancelled) throw new Error("cancelled");

      const critique = await runRole(
        "critic",
        `Researcher's answers:\n${research}`,
        `← Researcher's answers: "${preview(research, 70)}"`
      );
      if (abortToken.cancelled) throw new Error("cancelled");

      await runRole(
        "final",
        `Original user question:\n${question}\n\nResearcher's answers:\n${research}\n\nCritic's notes:\n${critique}\n\nProduce the final answer.`,
        `← Researcher + Critic merged · "${preview(critique, 60)}"`
      );
    } catch (err) {
      $("orch-out-final").textContent += `\n[stopped] ${err.message || err}`;
    } finally {
      busy = false;
      sendBtn.hidden = false;
      stopBtn.hidden = true;
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
  input.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  stopBtn.addEventListener("click", () => { if (abortToken) abortToken.cancelled = true; });
}

// ─────────────────────────────────────────────────────────────
// DEMO 6 · EVAL HARNESS
// Pick models. Pick a test set. Run sequentially. Score deterministically.
// Show comparison. This is what "your own eval, your own data, your own
// answer" looks like, in a single browser tab.
// ─────────────────────────────────────────────────────────────
// Prompt variants — the "context engineering" axis. Picking 2-3 of these
// alongside 2-3 models proves that *how you ask* moves the score as much as
// *which model* you ask. This is the talk's thesis in evidence form.
const EVAL_PROMPTS = {
  "naive": {
    label: "Naive · zero shot",
    description: "Bare assistant. No format guidance.",
    system: "You are a helpful assistant."
  },
  "terse": {
    label: "Terse · format-strict",
    description: "Tells the model: no preamble, exact-format reply.",
    system: "You are a precise assistant. Follow the user's output format exactly. No preamble. No explanation. Just the answer in the exact form requested. /no_think"
  },
  "cot": {
    label: "Chain-of-thought · think first",
    description: "Asks the model to reason briefly before answering. Costs more tokens.",
    system: "You are a careful reasoning assistant. First think step-by-step in 1-2 short sentences. Then on a NEW line write 'ANSWER: ' followed by the final answer in the exact format the user requested."
  },
  "fewshot": {
    label: "Few-shot · 1 example",
    description: "Includes one worked example that pattern-matches the question. Often the biggest single jump.",
    system: "You are a precise assistant. Reply in the exact format requested. /no_think\n\nExample:\nQuestion: What is 5 + 3? Reply with just the number.\nAnswer: 8"
  }
};

// Some prompts (chain-of-thought) need to run a regex against just the
// post-'ANSWER:' segment, not the whole reasoning trace, or scoring degrades
// unfairly. This helper extracts the answer portion if the prompt produced it.
function extractAnswerPortion(text, promptId) {
  if (!text) return "";
  if (promptId === "cot") {
    const m = text.match(/ANSWER\s*:\s*([\s\S]+)/i);
    if (m) return m[1].trim();
  }
  return text;
}

const EVAL_SUITES = {
  "regex-synth": {
    label: "Regex synthesis (5 q · executable scoring)",
    description: "Model writes a regex; harness runs it against positive and negative test strings. Scores 1 only if every positive matches AND every negative is rejected. This is the showpiece — the model's output is literally executed.",
    items: [
      {
        q: "Write a JavaScript regex that matches a US ZIP code: exactly 5 digits, optionally followed by a hyphen and 4 more digits. Reply with ONLY the regex pattern between forward slashes (e.g. /pattern/), no prose.",
        expectKind: "executableRegex",
        positives: ["12345", "94107-1234", "00000", "98101-0001"],
        negatives: ["1234", "ABCDE", "12345-12", "123456", "12345 1234"]
      },
      {
        q: "Write a JavaScript regex that matches a semver version like v1.2.3 or 10.20.300 (optional leading 'v', three dot-separated numeric components). Reply with ONLY the regex pattern between forward slashes, no prose.",
        expectKind: "executableRegex",
        positives: ["1.2.3", "v1.2.3", "10.20.300", "v0.0.1"],
        negatives: ["1.2", "1.2.3.4", "v1", "1.2.x", "v1.2"]
      },
      {
        q: "Write a JavaScript regex that matches a hex color: a # followed by exactly 3 or exactly 6 hex digits, case-insensitive. Reply with ONLY the regex pattern between forward slashes, no prose.",
        expectKind: "executableRegex",
        positives: ["#fff", "#FFF", "#a1b2c3", "#ABCDEF"],
        negatives: ["fff", "#ff", "#fffff", "#gggggg", "#fffffff"]
      },
      {
        q: "Write a JavaScript regex that matches an ISO date in the form YYYY-MM-DD where MM is 01-12 and DD is 01-31. Reply with ONLY the regex pattern between forward slashes, no prose.",
        expectKind: "executableRegex",
        positives: ["2026-05-28", "1999-12-31", "2000-01-01"],
        negatives: ["2026-13-01", "2026-00-15", "2026-05-32", "26-05-28", "2026/05/28"]
      },
      {
        q: "Write a JavaScript regex that matches a simple email of the form local@domain.tld where local is letters/digits/dots/underscores and tld is 2-6 letters. Reply with ONLY the regex pattern between forward slashes, no prose.",
        expectKind: "executableRegex",
        positives: ["a@b.io", "first.last@example.com", "user_1@sub.example.org"],
        negatives: ["@b.com", "a@.com", "a@b", "a@b.c", "a@b.toolongtld"]
      }
    ],
    maxTokens: 200
  },
  "spot-the-bug": {
    label: "Spot the bug (6 q · realistic JS bugs)",
    description: "Subtle real-world JavaScript bugs — missing await, mutation, ===, off-by-one, async-in-forEach. Scores 1 if the corrected keyword/operator appears in the output.",
    items: [
      {
        q: "This function is supposed to fetch data and return the parsed JSON, but the caller always gets a Promise instead of the data:\n\nfunction loadUser(id) {\n  const res = fetch('/users/' + id);\n  return res.json();\n}\n\nName the missing keyword that fixes both lines. Reply with just the keyword.",
        expect: "await"
      },
      {
        q: "This function is supposed to return a sorted COPY of the array without mutating the input, but the input array gets reordered:\n\nfunction sortedCopy(arr) {\n  return arr.sort();\n}\n\nReply with the corrected return statement only (one line).",
        expect: /\[\s*\.\.\.\s*arr\s*\]\s*\.sort|arr\.slice\(\)\.sort/i,
        expectKind: "regex"
      },
      {
        q: "This loop is supposed to iterate 10 times but it iterates 11:\n\nfor (let i = 0; i <= 10; i++) {}\n\nReply with the corrected for-loop one-liner.",
        expect: "i < 10"
      },
      {
        q: "This comparison is supposed to be strictly equal but accepts '0' (string) as 0 (number):\n\nif (value == 0) { /* ... */ }\n\nReply with the corrected condition only.",
        expect: "=== 0"
      },
      {
        q: "This code is supposed to wait for all the saves to complete before returning, but it returns immediately while saves are still pending:\n\nasync function saveAll(items) {\n  items.forEach(async item => {\n    await save(item);\n  });\n}\n\nName the array method that should replace forEach (one word).",
        expect: /\b(map|Promise\.all)\b/i,
        expectKind: "regex"
      },
      {
        q: "This function is supposed to return the LAST element of an array:\n\nfunction last(arr) { return arr[0]; }\n\nReply with the corrected return statement only.",
        expect: "arr.length - 1"
      }
    ],
    maxTokens: 200
  },
  "tool-call-json": {
    label: "Tool-call JSON (4 q · parsed + shape-checked)",
    description: "Model must emit a tool call as valid JSON. Harness parses it and checks each required key. This is the same skill that makes or breaks the Tools and Orchestration tabs.",
    items: [
      {
        q: "Emit a tool call as valid JSON for the function `schedule_meeting` with arguments title=\"Q3 review\", attendees=[\"alice\", \"bob\"], duration_minutes=30. Reply with ONLY the JSON object, no prose, no code fence. Required shape: {\"name\": \"...\", \"arguments\": {...}}.",
        expectKind: "json",
        expect: {
          name: "schedule_meeting",
          arguments: v => v && v.title === "Q3 review"
            && Array.isArray(v.attendees)
            && v.attendees.includes("alice") && v.attendees.includes("bob")
            && Number(v.duration_minutes) === 30
        }
      },
      {
        q: "Emit a tool call as valid JSON for `get_weather` with city=\"Seattle\" and units=\"celsius\". Reply with ONLY the JSON object. Required shape: {\"name\": \"...\", \"arguments\": {...}}.",
        expectKind: "json",
        expect: {
          name: "get_weather",
          arguments: v => v && v.city === "Seattle" && v.units === "celsius"
        }
      },
      {
        q: "Emit a tool call as valid JSON for `send_email` with to=\"team@example.com\", subject=\"Status update\", body=\"All green.\". Reply with ONLY the JSON object.",
        expectKind: "json",
        expect: {
          name: "send_email",
          arguments: v => v && v.to === "team@example.com"
            && v.subject === "Status update"
            && typeof v.body === "string" && v.body.toLowerCase().includes("all green")
        }
      },
      {
        q: "Emit a tool call as valid JSON for `create_ticket` with title=\"Login bug\", priority=\"high\", labels=[\"auth\", \"regression\"]. Reply with ONLY the JSON object.",
        expectKind: "json",
        expect: {
          name: "create_ticket",
          arguments: v => v && v.title === "Login bug"
            && v.priority === "high"
            && Array.isArray(v.labels)
            && v.labels.includes("auth") && v.labels.includes("regression")
        }
      }
    ],
    maxTokens: 220
  },
  "instruct-format": {
    label: "Instruction following (4 q · format check)",
    description: "Tests whether the model obeys output format constraints. Quick sanity check — small models often fail this even when they know the answer.",
    items: [
      { q: "Reply with exactly the word OK and nothing else.", expect: /^\s*ok\s*$/i, expectKind: "regex" },
      { q: "Reply with valid JSON: {\"status\":\"ready\"}. No prose.", expect: "\"status\":\"ready\"" },
      { q: "List three colors as a JSON array of strings. No prose.", expect: /^\s*\[.*\]\s*$/s, expectKind: "regex" },
      { q: "Reply with exactly: <DONE>", expect: "<DONE>" }
    ],
    maxTokens: 60
  }
};

function bindEvalsDemo() {
  const $models = $("evals-models");
  const $prompts = $("evals-prompts");
  const $suite  = $("evals-suite");
  const $suiteDesc = $("evals-suite-desc");
  const $run = $("evals-run");
  const $stop = $("evals-stop");
  const $reset = $("evals-reset");
  const $progress = $("evals-progress");
  const $progressText = $("evals-progress-text");
  const $progressFill = $("evals-progress-fill");
  const $scoreboard = $("evals-scoreboard");
  const $scoreboardRows = $("evals-scoreboard-rows");
  const $trace = $("evals-trace");

  let abortToken = null;

  // Populate model checkboxes (default-select first 2 small models).
  $models.innerHTML = MODELS.map((m, i) => `
    <label class="evals-model-row">
      <input type="checkbox" value="${m.id}" ${i < 2 ? "checked" : ""}>
      <span class="evals-model-label">${escapeHtml(m.label)}</span>
      <span class="evals-model-size">~${(m.sizeMB / 1000).toFixed(2)} GB</span>
    </label>
  `).join("");

  // Populate prompt-variant checkboxes (default: naive vs few-shot — most
  // dramatic delta on instruction-following suites).
  const defaultPromptIds = new Set(["naive", "fewshot"]);
  $prompts.innerHTML = Object.entries(EVAL_PROMPTS).map(([id, p]) => `
    <label class="evals-prompt-row">
      <input type="checkbox" value="${id}" ${defaultPromptIds.has(id) ? "checked" : ""}>
      <span class="evals-prompt-detail">
        <span class="evals-prompt-label">${escapeHtml(p.label)}</span>
        <span class="evals-prompt-desc">${escapeHtml(p.description)}</span>
      </span>
    </label>
  `).join("");

  // Populate suites.
  $suite.innerHTML = Object.entries(EVAL_SUITES)
    .map(([id, s]) => `<option value="${id}">${escapeHtml(s.label)}</option>`)
    .join("");
  function refreshSuiteDesc() {
    const s = EVAL_SUITES[$suite.value];
    if (s) $suiteDesc.textContent = s.description;
  }
  $suite.addEventListener("change", refreshSuiteDesc);
  refreshSuiteDesc();

  function selectedModelIds() {
    return Array.from($models.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
  }
  function selectedPromptIds() {
    return Array.from($prompts.querySelectorAll("input[type=checkbox]:checked")).map(c => c.value);
  }

  function clearOutputs() {
    $trace.innerHTML = `<div class="evals-trace-empty">Running…</div>`;
    $scoreboardRows.innerHTML = "";
    $scoreboard.hidden = true;
    $progress.hidden = false;
    $progressFill.style.width = "0%";
    $progressText.textContent = "Starting…";
  }

  function appendTrace(html) {
    const empty = $trace.querySelector(".evals-trace-empty");
    if (empty) empty.remove();
    const div = document.createElement("div");
    div.className = "evals-step";
    div.innerHTML = html;
    $trace.appendChild(div);
    $trace.scrollTop = $trace.scrollHeight;
  }

  function checkAnswer(item, output) {
    if (!output) return false;

    // Executable regex: take the model's output AS a JS regex pattern, run it
    // against canned positive/negative cases. This is the showstopper — the
    // harness literally executes what the model wrote.
    if (item.expectKind === "executableRegex") {
      const pattern = extractRegexBody(output);
      if (!pattern) return false;
      try {
        const re = new RegExp(pattern);
        const allPos = (item.positives || []).every(s => re.test(s));
        const allNeg = (item.negatives || []).every(s => !re.test(s));
        return allPos && allNeg;
      } catch (_) {
        return false;
      }
    }

    // JSON tool-call: model must emit valid JSON with the expected shape.
    if (item.expectKind === "json") {
      const parsed = parseFirstJSON(output);
      if (!parsed) return false;
      const expected = item.expect || {};
      for (const k of Object.keys(expected)) {
        const want = expected[k];
        const got = parsed[k];
        if (want instanceof RegExp) {
          if (!want.test(String(got ?? ""))) return false;
        } else if (typeof want === "function") {
          if (!want(got)) return false;
        } else if (got !== want) {
          return false;
        }
      }
      return true;
    }

    if (item.expectKind === "regex" || item.expect instanceof RegExp) {
      const re = item.expect instanceof RegExp ? item.expect : new RegExp(item.expect, "i");
      return re.test(output);
    }
    return output.toLowerCase().includes(String(item.expect).toLowerCase());
  }

  // Human-readable summary of an item's pass criterion for the trace row.
  function formatExpected(item) {
    if (item.expectKind === "executableRegex") {
      return `regex matches ${item.positives.length} positives, rejects ${item.negatives.length} negatives`;
    }
    if (item.expectKind === "json") {
      const keys = Object.keys(item.expect || {}).join(", ");
      return `valid JSON · checked keys: ${keys}`;
    }
    if (item.expect instanceof RegExp) return item.expect.toString();
    return String(item.expect);
  }

  // Pull a regex pattern out of model output. Accepts /pattern/flags, bare
  // patterns, or patterns inside a fenced code block.
  function extractRegexBody(text) {
    if (!text) return null;
    const fence = text.match(/```(?:regex|js|javascript)?\s*([\s\S]*?)```/i);
    const body = (fence ? fence[1] : text).trim();
    const slashed = body.match(/\/((?:\\.|[^\/\\\n])+)\/[gimsuy]*/);
    if (slashed) return slashed[1];
    const firstLine = body.split("\n").find(l => l.trim().length > 0) || "";
    return firstLine.trim() || null;
  }

  // Pull the first JSON object out of model output. Tolerates ```json fences
  // and prose before/after.
  function parseFirstJSON(text) {
    if (!text) return null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [];
    if (fence) candidates.push(fence[1]);
    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      candidates.push(text.slice(braceStart, braceEnd + 1));
    }
    candidates.push(text);
    for (const c of candidates) {
      try { return JSON.parse(c.trim()); } catch (_) { /* try next */ }
    }
    return null;
  }

  // Strip <think>...</think> blocks (Qwen3) so they don't confuse the scorer.
  function cleanForScoring(text) {
    if (!text) return "";
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const lastOpen = cleaned.lastIndexOf("<think>");
    if (lastOpen >= 0 && cleaned.indexOf("</think>", lastOpen) < 0) {
      cleaned = cleaned.slice(0, lastOpen);
    }
    return cleaned.trim();
  }

  async function ensureModelLoaded(modelId) {
    if (currentModelId === modelId && engine) return;
    const select = $("model-select");
    select.value = modelId;
    select.dispatchEvent(new Event("change"));
    // loadModel() guards on `busy` and will silently return if a caller has
    // already claimed the lock. The eval harness sets busy=true around the
    // whole run, so we must temporarily release the lock for the load (and
    // restore it after) — otherwise loadModel no-ops and the harness silently
    // re-runs the previously-loaded model under the new model's name.
    const wasBusy = busy;
    if (wasBusy) busy = false;
    try {
      await loadModel(modelId);
    } finally {
      if (wasBusy) busy = true;
    }
    if (currentModelId !== modelId) {
      throw new Error(`Model swap to ${modelId} failed — currentModelId is ${currentModelId}`);
    }
  }

  async function runOneItem(item, suite, promptCfg) {
    const messages = [
      { role: "system", content: promptCfg.system },
      { role: "user", content: item.q }
    ];
    // CoT prompts need extra room to think before answering.
    const budget = (promptCfg.id === "cot" || promptCfg === EVAL_PROMPTS.cot)
      ? Math.max(suite.maxTokens || 80, 200)
      : (suite.maxTokens || 80);
    const result = await streamCompletion({
      messages,
      abortToken,
      maxTokens: budget,
      temperature: 0.1
    });
    return result;
  }

  async function run() {
    if (busy) return;
    const modelIds = selectedModelIds();
    if (modelIds.length === 0) { alert("Pick at least one model."); return; }
    const promptIds = selectedPromptIds();
    if (promptIds.length === 0) { alert("Pick at least one prompt variant."); return; }
    const suite = EVAL_SUITES[$suite.value];
    if (!suite) return;

    busy = true;
    $run.hidden = true;
    $stop.hidden = false;
    abortToken = { cancelled: false };
    clearOutputs();

    const totalSteps = modelIds.length * promptIds.length * suite.items.length;
    let step = 0;
    // Results keyed by `${modelId}__${promptId}` so the scoreboard can render
    // a model × prompt grid.
    const results = {};

    try {
      for (const modelId of modelIds) {
        if (abortToken.cancelled) break;
        $progressText.textContent = `Loading model ${shortName(modelId)}…`;
        try {
          await ensureModelLoaded(modelId);
        } catch (err) {
          appendTrace(`<div class="evals-step-head evals-step-error">Failed to load ${escapeHtml(shortName(modelId))}: ${escapeHtml(err.message || String(err))}</div>`);
          continue;
        }
        appendTrace(`<div class="evals-step-head evals-step-model">▶ ${escapeHtml(shortName(modelId))} <span class="evals-active-pill">active engine: ${escapeHtml(shortName(currentModelId || "?"))}</span></div>`);

        for (const promptId of promptIds) {
          if (abortToken.cancelled) break;
          const promptCfg = EVAL_PROMPTS[promptId];
          const key = `${modelId}__${promptId}`;
          results[key] = {
            modelId, promptId,
            passed: 0, total: suite.items.length,
            perItem: [], totalMs: 0, totalTokens: 0
          };
          appendTrace(`<div class="evals-step-head evals-step-prompt">  ↳ prompt: <strong>${escapeHtml(promptCfg.label)}</strong></div>`);

          for (let i = 0; i < suite.items.length; i++) {
            if (abortToken.cancelled) break;
            const item = suite.items[i];
            step++;
            $progressText.textContent = `${shortName(modelId)} · ${promptCfg.label} · q${i + 1}/${suite.items.length}`;
            $progressFill.style.width = (step / totalSteps * 100).toFixed(0) + "%";

            // Hard guard: if the active engine doesn't match the expected
            // model at generation time, something de-synced. Skip the row
            // rather than silently scoring a different model under this
            // model's name.
            if (currentModelId !== modelId) {
              appendTrace(`<div class="evals-step-q">Q: ${escapeHtml(item.q)}</div><div class="evals-step-error">[skip] Active engine is ${escapeHtml(shortName(currentModelId || "?"))}, expected ${escapeHtml(shortName(modelId))}.</div>`);
              results[key].perItem.push({ q: item.q, output: "", pass: false });
              continue;
            }

            let out, stats;
            try {
              const r = await runOneItem(item, suite, { ...promptCfg, id: promptId });
              const cleaned = cleanForScoring(r.fullText);
              out = extractAnswerPortion(cleaned, promptId);
              stats = { totalMs: r.totalMs, tokens: r.tokens, raw: cleaned };
            } catch (err) {
              appendTrace(`<div class="evals-step-q">Q: ${escapeHtml(item.q)}</div><div class="evals-step-error">[error] ${escapeHtml(err.message || String(err))}</div>`);
              results[key].perItem.push({ q: item.q, output: "", pass: false });
              continue;
            }

            const pass = checkAnswer(item, out);
            if (pass) results[key].passed++;
            results[key].totalMs += stats.totalMs || 0;
            results[key].totalTokens += stats.tokens || 0;
            results[key].perItem.push({ q: item.q, output: out, pass });

            appendTrace(`
              <div class="evals-step-row ${pass ? "evals-pass" : "evals-fail"}">
                <span class="evals-verdict">${pass ? "✓" : "✗"}</span>
                <div class="evals-step-detail">
                  <div class="evals-step-q"><strong>Q${i + 1}:</strong> ${escapeHtml(item.q)}</div>
                  <div class="evals-step-out"><strong>Output:</strong> <code>${escapeHtml(out.slice(0, 240))}${out.length > 240 ? "…" : ""}</code></div>
                  <div class="evals-step-meta">prompt: <code>${escapeHtml(promptCfg.label)}</code> · expected: <code>${escapeHtml(formatExpected(item))}</code> · ${(stats.totalMs / 1000).toFixed(2)}s · ${stats.tokens} tok</div>
                </div>
              </div>
            `);
          }
        }
      }
    } finally {
      busy = false;
      $run.hidden = false;
      $stop.hidden = true;
    }

    // Render scoreboard with both axes visible.
    $scoreboard.hidden = false;
    $progressText.textContent = abortToken && abortToken.cancelled ? "Stopped" : "Complete";
    const sortedKeys = Object.keys(results).sort((a, b) => {
      const ra = results[a], rb = results[b];
      return (rb.passed / rb.total) - (ra.passed / ra.total);
    });
    const rowsHtml = sortedKeys.map(key => {
      const r = results[key];
      const pct = r.total > 0 ? Math.round(r.passed / r.total * 100) : 0;
      const tps = r.totalMs > 0 ? (r.totalTokens / (r.totalMs / 1000)).toFixed(1) : "—";
      const promptLabel = EVAL_PROMPTS[r.promptId]?.label || r.promptId;
      return `
        <div class="evals-score-row">
          <div class="evals-score-model">
            <span class="evals-score-modelname">${escapeHtml(shortName(r.modelId))}</span>
            <span class="evals-score-promptchip">${escapeHtml(promptLabel)}</span>
          </div>
          <div class="evals-score-bar">
            <div class="evals-score-bar-fill" style="width:${pct}%"></div>
            <span class="evals-score-bar-label">${r.passed} / ${r.total} · ${pct}%</span>
          </div>
          <div class="evals-score-perf">${tps} tok/s</div>
        </div>
      `;
    }).join("");

    // Synthesise the talking-point summary: which axis (model vs prompt)
    // moved the score more? Compute the spread along each axis.
    let summary = "";
    if (modelIds.length > 1 && promptIds.length > 1) {
      const pctOf = (r) => r.total > 0 ? r.passed / r.total : 0;
      const all = Object.values(results);
      // Spread along prompt axis: for each (model), max-min over prompts.
      let promptDelta = 0;
      for (const m of modelIds) {
        const rs = all.filter(r => r.modelId === m);
        if (rs.length < 2) continue;
        const vals = rs.map(pctOf);
        promptDelta = Math.max(promptDelta, Math.max(...vals) - Math.min(...vals));
      }
      // Spread along model axis: for each (prompt), max-min over models.
      let modelDelta = 0;
      for (const p of promptIds) {
        const rs = all.filter(r => r.promptId === p);
        if (rs.length < 2) continue;
        const vals = rs.map(pctOf);
        modelDelta = Math.max(modelDelta, Math.max(...vals) - Math.min(...vals));
      }
      const promptPp = Math.round(promptDelta * 100);
      const modelPp = Math.round(modelDelta * 100);
      const winner = promptPp > modelPp ? "prompt" : (modelPp > promptPp ? "model" : "tie");
      const verdictText = winner === "tie"
        ? `<strong>Tie:</strong> swapping the prompt and swapping the model both moved scores by ${modelPp} pp on this suite.`
        : (winner === "prompt"
          ? `<strong>Prompt won.</strong> Swapping the system prompt moved scores by <strong>${promptPp} pp</strong> on the same model — bigger than the <strong>${modelPp} pp</strong> gap between models. Context engineering &gt; model upgrade on this suite.`
          : `<strong>Model won.</strong> Swapping the model moved scores by <strong>${modelPp} pp</strong> with the same prompt — bigger than the <strong>${promptPp} pp</strong> gap from prompt changes. On this suite, weights matter more than framing.`);
      summary = `<div class="evals-axis-verdict">${verdictText}</div>`;
    }

    $scoreboardRows.innerHTML = summary + rowsHtml;
  }

  $run.addEventListener("click", run);
  $stop.addEventListener("click", () => { if (abortToken) abortToken.cancelled = true; });
  $reset.addEventListener("click", () => {
    $trace.innerHTML = `<div class="evals-trace-empty">Pick models + prompts + a test set, then hit Run. Per-question results stream in here.</div>`;
    $scoreboard.hidden = true;
    $progress.hidden = true;
    $progressFill.style.width = "0%";
    $progressText.textContent = "Idle";
  });
}
