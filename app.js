// app.js
const $ = (sel) => document.querySelector(sel);

const STORAGE_KEY = "change_risk_autopilot_v2";

const state = {
  view: "dashboard",
  data: null
};

document.addEventListener("DOMContentLoaded", () => {
  if (!window.APP_CONTENT) {
    const app = document.getElementById("app");
    if (app) app.innerHTML = `<pre>Fatal: content.js did not load.</pre>`;
    return;
  }
  state.data = loadData();
  renderShell();
  navigate("dashboard");
});

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const seeded = safeClone(window.APP_CONTENT.demoData);
  saveData(seeded);
  return seeded;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function renderShell() {
  const { brand, nav } = window.APP_CONTENT;

  $("#app").innerHTML = `
    <header class="topbar">
      <div class="brand" role="banner" aria-label="App header">
        <div class="brand-mark">CR</div>
        <div class="brand-text">
          <div class="brand-name">${escapeHtml(brand.name)}</div>
          <div class="brand-tagline">${escapeHtml(brand.tagline)}</div>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="btn primary" id="btnDemo">Run demo</button>
        <button class="btn ghost" id="btnReset" title="Reset demo data">Reset</button>
      </div>
    </header>

    <div class="layout">
      <aside class="sidebar" aria-label="Sidebar">
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot">
          <div class="muted small">Portfolio demo by ${escapeHtml(brand.owner)}</div>
        </div>
      </aside>

      <main class="main">
        <div class="main-head">
          <div class="breadcrumbs" id="breadcrumbs"></div>
          <div class="main-actions" id="mainActions"></div>
        </div>
        <section class="content" id="view"></section>
      </main>
    </div>
  `;

  const navEl = $("#nav");
  navEl.innerHTML = nav.map(item => `
    <button class="nav-item" data-view="${item.id}">
      <span class="dot"></span>
      <span>${escapeHtml(item.label)}</span>
    </button>
  `).join("");

  navEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    stopDemoIfRunning();
    navigate(btn.dataset.view);
  });

  $("#btnReset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.data = loadData();
    navigate("dashboard");
    toast("Demo data reset.");
  });

  $("#btnDemo").addEventListener("click", async () => {
    await runDemo();
  });
}

function navigate(view) {
  state.view = view;
  highlightNav(view);
  $("#breadcrumbs").textContent = viewLabel(view);
  $("#mainActions").innerHTML = mainActions(view);
  $("#view").innerHTML = renderView(view);
  wireView(view);

  if (state.data?.demo?.isActive && view === "dashboard") {
    bindDemoControls();
  }
}

function highlightNav(view) {
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
}

function viewLabel(view) {
  const item = window.APP_CONTENT.nav.find(n => n.id === view);
  return item ? item.label : "View";
}

function mainActions(view) {
  if (view === "changes") return `<button class="btn" id="btnNewChange">New change</button>`;
  if (view === "dashboard") return `<button class="btn" id="btnNewChange">New change</button>`;
  if (view === "incidents") return `<span class="badge">Incident learning enabled</span>`;
  return "";
}

function wireView(view) {
  const btnNew = $("#btnNewChange");
  if (btnNew) btnNew.addEventListener("click", () => { stopDemoIfRunning(); navigate("new_change"); });

  if (view === "changes") {
    $("#changesTable").addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (!row) return;
      openChangeModal(Number(row.dataset.id));
    });
  }

  if (view === "dashboard") {
    $("#riskList").addEventListener("click", (e) => {
      const row = e.target.closest("[data-id]");
      if (!row) return;
      openChangeModal(Number(row.dataset.id));
    });
  }

  if (view === "new_change") {
    $("#changeForm").addEventListener("submit", onCreateChange);
    $("#btnBack").addEventListener("click", () => { stopDemoIfRunning(); navigate("dashboard"); });
  }

  if (view === "about") {
    $("#btnExportJson").addEventListener("click", () => {
      download("change-risk-autopilot-demo.json", JSON.stringify(state.data, null, 2), "application/json");
    });
  }
}

function renderView(view) {
  if (view === "dashboard") return renderDashboard();
  if (view === "new_change") return renderNewChange();
  if (view === "changes") return renderChanges();
  if (view === "incidents") return renderIncidents();
  if (view === "about") return renderAbout();
  return `<div class="card">Unknown view.</div>`;
}

function renderDashboard() {
  const { changes, systems, demo } = state.data;

  const scored = changes.map(c => ({ ...c, risk: scoreChange(c, systems) }))
    .sort((a, b) => b.risk.total - a.risk.total);

  const kpis = {
    total: changes.length,
    high: scored.filter(x => ["high","critical"].includes(x.risk.level)).length,
    upcoming24: scored.filter(x => hoursUntil(x.plannedStart) <= 24 && hoursUntil(x.plannedStart) >= 0).length
  };

  const banner = demo?.isActive ? renderDemoBanner() : "";

  return `
    ${banner}

    <div class="grid-3" id="demoKpis">
      ${kpi("Total changes", kpis.total)}
      ${kpi("High or critical risk", kpis.high)}
      ${kpi("Starting within 24 hours", kpis.upcoming24)}
    </div>

    <div class="grid-2">
      <div class="card" id="demoQueue">
        <div class="card-head">
          <div>
            <div class="title">Top risk queue</div>
            <div class="muted">Click a row to view details</div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table" id="riskList">
            <thead>
              <tr>
                <th>Risk</th>
                <th>Change</th>
                <th>Start</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${scored.slice(0, 8).map(r => `
                <tr class="rowlink" data-id="${r.id}">
                  <td>${riskPill(r.risk.level, r.risk.total)}</td>
                  <td>
                    <div class="strong">${escapeHtml(r.title)}</div>
                    <div class="muted small">${escapeHtml(r.changeType)} • ${escapeHtml(systemsLabel(r.systems))}</div>
                  </td>
                  <td class="mono">${escapeHtml(r.plannedStart.replace("T"," "))}</td>
                  <td>${statusPill(r.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" id="demoRules">
        <div class="card-head">
          <div>
            <div class="title">How risk is calculated</div>
            <div class="muted">Transparent rules for review</div>
          </div>
        </div>
        <ul class="list">
          ${window.APP_CONTENT.riskRules.map(rule => `
            <li>
              <div class="strong">${escapeHtml(rule.code)}</div>
              <div class="muted small">${escapeHtml(rule.message)} • +${rule.points} pts</div>
            </li>
          `).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderDemoBanner() {
  const demo = state.data.demo || { stepIndex: 0, runCount: 0 };
  const steps = demoSteps();
  const total = steps.length;
  const idx = clamp(demo.stepIndex ?? 0, 0, total - 1);
  const pct = Math.round(((idx + 1) / total) * 100);

  return `
    <div class="demo-banner card" id="demoBanner">
      <div style="min-width:0">
        <div class="strong">Demo running</div>
        <div class="muted small" id="demoText">${escapeHtml(steps[idx].text)}</div>
        <div style="margin-top:8px">
          <div class="progress"><div style="width:${pct}%"></div></div>
          <div class="muted small" style="margin-top:6px">Step ${idx + 1} of ${total}</div>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn ghost" id="demoSkip">Stop demo</button>
        <button class="btn" id="demoNext">Next</button>
      </div>
    </div>
  `;
}

function renderNewChange() {
  const { systems } = state.data;
  const { changeTypes, customerImpact } = window.APP_CONTENT.lookups;

  const now = new Date();
  const start = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="title">Create a change</div>
          <div class="muted">This demo saves to your browser storage</div>
        </div>
      </div>

      <form class="form" id="changeForm">
        <div class="form-row">
          <div class="field">
            <label>Title</label>
            <input required name="title" placeholder="Example: Patch VPN gateway OpenSSL" />
          </div>
          <div class="field">
            <label>Change type</label>
            <select name="changeType">
              ${changeTypes.map(t => `<option value="${t}">${t}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Planned start</label>
            <input required type="datetime-local" name="plannedStart" value="${toLocalInputValue(start)}" />
          </div>
          <div class="field">
            <label>Planned end</label>
            <input required type="datetime-local" name="plannedEnd" value="${toLocalInputValue(end)}" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label>Customer impact</label>
            <select name="customerImpact">
              ${customerImpact.map(i => `<option value="${i}">${i}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status">
              <option value="draft">draft</option>
              <option value="submitted" selected>submitted</option>
              <option value="in_review">in_review</option>
              <option value="approved">approved</option>
              <option value="scheduled">scheduled</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label>Systems impacted</label>
          <div class="chips">
            ${systems.map(s => `
              <label class="chip">
                <input type="checkbox" name="systems" value="${s.id}" />
                <span>${escapeHtml(s.name)} <span class="muted">(tier ${s.tier})</span></span>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="field">
          <label>Rollback plan</label>
          <textarea required name="rollbackPlan" rows="4" placeholder="Clear steps to restore service quickly"></textarea>
        </div>

        <div class="field">
          <label>Test plan</label>
          <textarea required name="testPlan" rows="4" placeholder="How you will validate success and detect problems"></textarea>
        </div>

        <div class="field">
          <label>Implementation steps</label>
          <textarea required name="steps" rows="4" placeholder="Step by step execution checklist"></textarea>
        </div>

        <div class="form-actions">
          <button class="btn" type="submit">Save change</button>
          <button class="btn ghost" type="button" id="btnBack">Back</button>
        </div>
      </form>
    </div>
  `;
}

function renderChanges() {
  const { changes, systems } = state.data;
  const scored = changes.map(c => ({ ...c, risk: scoreChange(c, systems) }))
    .sort((a, b) => new Date(b.plannedStart) - new Date(a.plannedStart));

  return `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="title">Changes</div>
          <div class="muted">Click a row for risk breakdown</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table" id="changesTable">
          <thead>
            <tr>
              <th>Risk</th>
              <th>Title</th>
              <th>Type</th>
              <th>Start</th>
              <th>Impact</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${scored.map(c => `
              <tr class="rowlink" data-id="${c.id}">
                <td>${riskPill(c.risk.level, c.risk.total)}</td>
                <td>
                  <div class="strong">${escapeHtml(c.title)}</div>
                  <div class="muted small">${escapeHtml(systemsLabel(c.systems))}</div>
                </td>
                <td>${escapeHtml(c.changeType)}</td>
                <td class="mono">${escapeHtml(c.plannedStart.replace("T"," "))}</td>
                <td>${escapeHtml(c.customerImpact)}</td>
                <td>${statusPill(c.status)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card subtle">
      <div class="card-head">
        <div>
          <div class="title">Portfolio note</div>
          <div class="muted">This GitHub Pages demo stores data in your browser. The SQL folder shows the backend design.</div>
        </div>
      </div>
    </div>
  `;
}

function renderIncidents() {
  const { incidents, systems } = state.data;
  const rows = incidents.map(i => ({
    ...i,
    systemsLabel: i.systems.map(id => systems.find(s => s.id === id)?.name || "Unknown").join(", ")
  })).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  return `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="title">Incident history</div>
          <div class="muted">What the risk engine should learn from</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Incident</th>
              <th>Started</th>
              <th>Systems</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(i => `
              <tr>
                <td>${sevPill(i.severity)}</td>
                <td>
                  <div class="strong">${escapeHtml(i.title)}</div>
                  <div class="muted small">${escapeHtml(i.notes)}</div>
                </td>
                <td class="mono">${escapeHtml(i.startedAt.replace("T"," "))}</td>
                <td>${escapeHtml(i.systemsLabel)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAbout() {
  return `
    <div class="card">
      <div class="card-head">
        <div>
          <div class="title">About this project</div>
          <div class="muted">A change management demo that scores risk using transparent rules</div>
        </div>
      </div>

      <div style="padding:14px">
        <p class="muted">Problem: outages repeat because changes are approved without learning from incident history.</p>
        <p class="muted">Solution: risk scoring with clear reasons reviewers can act on.</p>
        <p class="muted">Upgrade path: connect a real API to the SQL schema in the <span class="mono">sql</span> folder.</p>
      </div>

      <div style="padding:0 14px 14px 14px; display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn ghost" id="btnExportJson">Export demo data (JSON)</button>
      </div>
    </div>
  `;
}

function onCreateChange(e) {
  e.preventDefault();

  const fd = new FormData(e.target);
  const systems = fd.getAll("systems").map(Number);

  const change = {
    id: nextId(state.data.changes),
    title: String(fd.get("title") || "").trim(),
    changeType: String(fd.get("changeType") || "other"),
    requester: window.APP_CONTENT.brand.owner,
    plannedStart: String(fd.get("plannedStart")),
    plannedEnd: String(fd.get("plannedEnd")),
    customerImpact: String(fd.get("customerImpact")),
    status: String(fd.get("status")),
    systems,
    rollbackPlan: String(fd.get("rollbackPlan") || "").trim(),
    testPlan: String(fd.get("testPlan") || "").trim(),
    steps: String(fd.get("steps") || "").trim()
  };

  if (!change.title || !change.plannedStart || !change.plannedEnd) { toast("Complete required fields."); return; }
  if (systems.length === 0) { toast("Pick at least one system impacted."); return; }

  state.data.changes.unshift(change);
  saveData(state.data);

  toast("Change saved.");
  navigate("changes");
}

function openChangeModal(changeId) {
  const change = state.data.changes.find(c => c.id === changeId);
  if (!change) return;

  const risk = scoreChange(change, state.data.systems);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div style="min-width:0">
          <div class="title">${escapeHtml(change.title)}</div>
          <div class="muted small">${escapeHtml(change.changeType)} • ${escapeHtml(systemsLabel(change.systems))} • ${escapeHtml(change.status)}</div>
        </div>
        <button class="iconbtn" id="closeModal" aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        <div class="risk-line">
          <div>${riskPill(risk.level, risk.total)}</div>
          <div class="muted">Planned: <span class="mono">${escapeHtml(change.plannedStart.replace("T"," "))}</span> to <span class="mono">${escapeHtml(change.plannedEnd.replace("T"," "))}</span></div>
        </div>

        <div class="split">
          <div class="card mini" id="demoReasons">
            <div style="padding:12px 14px 0 14px" class="strong">Risk reasons</div>
            <ul class="list">
              ${risk.reasons.length ? risk.reasons.map(r => `
                <li>
                  <div class="strong">${escapeHtml(r.code)}</div>
                  <div class="muted small">${escapeHtml(r.message)} • +${r.points}</div>
                </li>
              `).join("") : `<li class="muted">No risk rules triggered.</li>`}
            </ul>
          </div>

          <div class="card mini" id="demoPlans">
            <div style="padding:12px 14px 0 14px" class="strong">Plans</div>
            <div style="padding:12px 14px 14px 14px">
              <div class="block">
                <div class="label">Rollback</div>
                <div class="muted">${escapeHtml(change.rollbackPlan)}</div>
              </div>
              <div class="block">
                <div class="label">Testing</div>
                <div class="muted">${escapeHtml(change.testPlan)}</div>
              </div>
              <div class="block">
                <div class="label">Steps</div>
                <div class="muted">${escapeHtml(change.steps)}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-foot">
          <button class="btn ghost" id="copySummary">Copy reviewer summary</button>
          <button class="btn" id="closeModal2">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => { modal.remove(); clearHighlights(); };

  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  modal.querySelector("#closeModal").addEventListener("click", close);
  modal.querySelector("#closeModal2").addEventListener("click", close);

  modal.querySelector("#copySummary").addEventListener("click", async () => {
    const summary = buildSummary(change, risk);
    try { await navigator.clipboard.writeText(summary); toast("Summary copied."); }
    catch { toast("Clipboard blocked."); }
  });
}

function buildSummary(change, risk) {
  return [
    `Change: ${change.title}`,
    `Type: ${change.changeType}`,
    `Systems: ${systemsLabel(change.systems)}`,
    `Window: ${change.plannedStart} to ${change.plannedEnd}`,
    `Impact: ${change.customerImpact}`,
    `Status: ${change.status}`,
    `Risk: ${risk.level.toUpperCase()} (${risk.total} pts)`,
    `Reasons:`,
    ...(risk.reasons.length ? risk.reasons.map(r => `- ${r.code} (+${r.points}): ${r.message}`) : [`- None`]),
    ``,
    `Rollback: ${change.rollbackPlan}`,
    `Test: ${change.testPlan}`,
    `Steps: ${change.steps}`
  ].join("\n");
}

function scoreChange(change, systems) {
  const rules = window.APP_CONTENT.riskRules;
  const reasons = [];
  const sys = (change.systems || []).map(id => systems.find(s => s.id === id)).filter(Boolean);

  if (sys.some(s => s.tier === 3)) add("TIER3_SYSTEM");
  if (change.customerImpact === "high") add("HIGH_IMPACT");
  if ((change.rollbackPlan || "").trim().length < 40) add("NO_ROLLBACK");
  if ((change.testPlan || "").trim().length < 40) add("NO_TEST");

  const until = hoursUntil(change.plannedStart);
  if (until >= 0 && until <= 24) add("SHORT_NOTICE");

  const durHours = (new Date(change.plannedEnd) - new Date(change.plannedStart)) / (1000*60*60);
  if (durHours > 2) add("LONG_DURATION");

  const total = reasons.reduce((sum, r) => sum + r.points, 0);
  const level = total >= 50 ? "critical" : total >= 30 ? "high" : total >= 15 ? "medium" : "low";
  return { total, level, reasons };

  function add(code) {
    const r = rules.find(x => x.code === code);
    if (r) reasons.push({ code: r.code, points: r.points, message: r.message });
  }
}

function hoursUntil(iso) {
  const dt = new Date(iso);
  return (dt - new Date()) / (1000*60*60);
}

function kpi(label, value) {
  return `
    <div class="card kpi">
      <div class="muted small">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(String(value))}</div>
    </div>
  `;
}

function riskPill(level, score) { return `<span class="pill risk ${escapeHtml(level)}">${escapeHtml(level)} • ${score}</span>`; }
function statusPill(status) { return `<span class="pill status">${escapeHtml(status)}</span>`; }
function sevPill(sev) {
  const map = { 1: "critical", 2: "high", 3: "medium", 4: "low" };
  const label = map[sev] || "low";
  return `<span class="pill risk ${label}">sev ${sev}</span>`;
}

function systemsLabel(ids) {
  const names = (ids || []).map(id => state.data.systems.find(s => s.id === id)?.name).filter(Boolean);
  return names.join(", ") || "No systems";
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function nextId(list) {
  const max = (list || []).reduce((m, x) => Math.max(m, x.id || 0), 0);
  return max + 1;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 1800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Demo mode */
function demoSteps() {
  return [
    { key: "intro", text: "We will walk through a risky DNS change and why it is flagged." },
    { key: "queue", text: "This is the Top risk queue. We will open the riskiest change." },
    { key: "modal", text: "This modal shows a risk breakdown with reasons and plans." },
    { key: "reasons", text: "These reasons are the exact rules triggered. This is what reviewers need." },
    { key: "rules", text: "Now we review the rule list so the scoring is explainable." },
    { key: "create", text: "Next we create a new change with missing plans to show how risk increases." },
    { key: "done", text: "Demo complete. You can now click around or reset to rerun." }
  ];
}

async function runDemo() {
  state.data.demo = state.data.demo || {};
  state.data.demo.isActive = true;
  state.data.demo.stepIndex = 0;
  state.data.demo.startedAt = new Date().toISOString();
  state.data.demo.runCount = (state.data.demo.runCount || 0) + 1;
  saveData(state.data);

  navigate("dashboard");
  await sleep(50);
  bindDemoControls();
  await demoGoToStep(0);
}

function bindDemoControls() {
  const banner = $("#demoBanner");
  if (!banner) return;

  $("#demoSkip").addEventListener("click", () => {
    stopDemoIfRunning();
    navigate("dashboard");
    toast("Demo stopped.");
  });

  $("#demoNext").addEventListener("click", async () => {
    const steps = demoSteps();
    const idx = clamp(state.data.demo.stepIndex || 0, 0, steps.length - 1);
    if (idx >= steps.length - 1) {
      stopDemoIfRunning();
      navigate("dashboard");
      toast("Demo finished.");
      return;
    }
    state.data.demo.stepIndex = idx + 1;
    saveData(state.data);
    navigate("dashboard");
    await sleep(60);
    bindDemoControls();
    await demoGoToStep(state.data.demo.stepIndex);
  });
}

async function demoGoToStep(stepIndex) {
  clearHighlights();
  const steps = demoSteps();
  const s = steps[clamp(stepIndex, 0, steps.length - 1)];

  if (s.key === "intro") { highlight("#demoBanner"); toast("Demo started."); return; }

  if (s.key === "queue") {
    highlight("#demoQueue");
    const top = getTopRiskChangeId();
    if (top) { await sleep(350); openChangeModal(top); }
    return;
  }

  if (s.key === "modal") { highlight(".modal"); return; }
  if (s.key === "reasons") { highlight("#demoReasons"); return; }

  if (s.key === "rules") {
    closeAnyModal();
    await sleep(150);
    highlight("#demoRules");
    return;
  }

  if (s.key === "create") {
    closeAnyModal();
    stopDemoHighlightsOnly();
    await sleep(150);
    navigate("new_change");
    await sleep(80);

    const form = $("#changeForm");
    if (form) {
      form.title.value = "Firewall rule change without test plan";
      form.changeType.value = "network";
      form.customerImpact.value = "high";
      const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 3.5 * 60 * 60 * 1000);
      form.plannedStart.value = toLocalInputValue(start);
      form.plannedEnd.value = toLocalInputValue(end);
      const cb = form.querySelector('input[name="systems"][value="2"]');
      if (cb) cb.checked = true;
      form.rollbackPlan.value = "Rollback: revert rule.";
      form.testPlan.value = "Test: ok.";
      form.steps.value = "1) Apply rule 2) Monitor";
      highlight("#changeForm");
      toast("Save this change to see it score high.");
    }
    return;
  }

  if (s.key === "done") {
    closeAnyModal();
    stopDemoHighlightsOnly();
    navigate("dashboard");
    await sleep(60);
    highlight("#demoBanner");
    toast("Demo complete.");
  }
}

function stopDemoIfRunning() {
  if (!state.data?.demo?.isActive) return;
  state.data.demo.isActive = false;
  state.data.demo.stepIndex = 0;
  saveData(state.data);
  clearHighlights();
}

function stopDemoHighlightsOnly() { clearHighlights(); }

function getTopRiskChangeId() {
  const { changes, systems } = state.data;
  const scored = changes.map(c => ({ id: c.id, risk: scoreChange(c, systems) }))
    .sort((a, b) => b.risk.total - a.risk.total);
  return scored[0]?.id || null;
}

function closeAnyModal() {
  const m = document.querySelector(".modal-backdrop");
  if (m) m.remove();
}

function highlight(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.classList.add("highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearHighlights() {
  document.querySelectorAll(".highlight").forEach(el => el.classList.remove("highlight"));
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
