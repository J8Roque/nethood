// app.js
// Change Risk Autopilot (GitHub Pages demo, no backend)

const STORAGE_KEY = "change_risk_autopilot_v1";

document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  if (!app) return;

  if (!window.APP_CONTENT) {
    app.innerHTML = `<pre>Fatal: content.js did not load. Check file name/path.</pre>`;
    return;
  }

  const state = loadState();
  render(app, state);
});

function safeClone(obj) {
  try {
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const seeded = safeClone(window.APP_CONTENT.demoData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render(app, state) {
  const brand = window.APP_CONTENT.brand;
  const changes = (state.changes || []).map(c => ({
    ...c,
    risk: scoreChange(c, state.systems || [])
  })).sort((a, b) => b.risk.total - a.risk.total);

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">CR</div>
          <div>
            <div class="brand-name">${escapeHtml(brand.name)}</div>
            <div class="brand-tagline">${escapeHtml(brand.tagline)}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" id="resetBtn">Reset</button>
        </div>
      </header>

      <main class="main">
        <div class="grid">
          <section class="card">
            <div class="card-head">
              <div>
                <div class="title">Top risk queue</div>
                <div class="muted">Click to expand</div>
              </div>
              <button class="btn" id="newBtn">New change</button>
            </div>

            <div class="table-wrap">
              <table class="table" id="queue">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Change</th>
                    <th>Start</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${changes.slice(0, 10).map(c => `
                    <tr class="rowlink" data-id="${c.id}">
                      <td>${riskPill(c.risk.level, c.risk.total)}</td>
                      <td>
                        <div class="strong">${escapeHtml(c.title)}</div>
                        <div class="muted small">${escapeHtml(c.changeType)} • ${systemsLabel(state, c.systems)}</div>
                      </td>
                      <td class="mono">${escapeHtml((c.plannedStart || "").replace("T"," "))}</td>
                      <td>${pill(c.status || "draft")}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </section>

          <section class="card">
            <div class="card-head">
              <div>
                <div class="title">Create change (minimal)</div>
                <div class="muted">Stored in your browser</div>
              </div>
            </div>

            <form class="form" id="form">
              <label class="label">Title</label>
              <input name="title" required placeholder="Example: Patch VPN gateway OpenSSL" />

              <label class="label">Change type</label>
              <select name="changeType">
                ${window.APP_CONTENT.lookups.changeTypes.map(t => `<option value="${t}">${t}</option>`).join("")}
              </select>

              <label class="label">Customer impact</label>
              <select name="customerImpact">
                ${window.APP_CONTENT.lookups.customerImpact.map(i => `<option value="${i}">${i}</option>`).join("")}
              </select>

              <label class="label">Planned start</label>
              <input name="plannedStart" type="datetime-local" required />

              <label class="label">Planned end</label>
              <input name="plannedEnd" type="datetime-local" required />

              <label class="label">Systems impacted</label>
              <div class="chips">
                ${(state.systems || []).map(s => `
                  <label class="chip">
                    <input type="checkbox" name="systems" value="${s.id}" />
                    <span>${escapeHtml(s.name)} <span class="muted">(tier ${s.tier})</span></span>
                  </label>
                `).join("")}
              </div>

              <label class="label">Rollback plan</label>
              <textarea name="rollbackPlan" rows="3" required placeholder="Restore plan with steps"></textarea>

              <label class="label">Test plan</label>
              <textarea name="testPlan" rows="3" required placeholder="How you validate"></textarea>

              <label class="label">Steps</label>
              <textarea name="steps" rows="3" required placeholder="Implementation checklist"></textarea>

              <button class="btn" type="submit">Save</button>
              <div class="muted small">Risk is auto computed using rules on the right.</div>
            </form>

            <div class="rules">
              <div class="strong">Risk rules</div>
              <ul>
                ${window.APP_CONTENT.riskRules.map(r => `<li><span class="mono">${r.code}</span> +${r.points}: ${escapeHtml(r.message)}</li>`).join("")}
              </ul>
            </div>
          </section>
        </div>

        <footer class="foot muted small">Portfolio demo by ${escapeHtml(brand.owner)} • SQL schema in /sql</footer>
      </main>
    </div>
  `;

  // Set default time inputs
  const now = new Date();
  const start = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  app.querySelector('input[name="plannedStart"]').value = toLocalInputValue(start);
  app.querySelector('input[name="plannedEnd"]').value = toLocalInputValue(end);

  // Reset
  app.querySelector("#resetBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    const seeded = safeClone(window.APP_CONTENT.demoData);
    saveState(seeded);
    render(app, seeded);
  });

  // Save
  app.querySelector("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const systems = fd.getAll("systems").map(Number);

    if (systems.length === 0) {
      alert("Pick at least one system impacted.");
      return;
    }

    const change = {
      id: nextId(state.changes || []),
      title: String(fd.get("title") || "").trim(),
      changeType: String(fd.get("changeType") || "other"),
      requester: brand.owner,
      plannedStart: String(fd.get("plannedStart") || ""),
      plannedEnd: String(fd.get("plannedEnd") || ""),
      customerImpact: String(fd.get("customerImpact") || "low"),
      status: "submitted",
      systems,
      rollbackPlan: String(fd.get("rollbackPlan") || "").trim(),
      testPlan: String(fd.get("testPlan") || "").trim(),
      steps: String(fd.get("steps") || "").trim()
    };

    const next = safeClone(state);
    next.changes = [change, ...(next.changes || [])];
    saveState(next);
    render(app, next);
  });
}

// ---------- risk scoring ----------

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

  const dur = (new Date(change.plannedEnd) - new Date(change.plannedStart)) / (1000 * 60 * 60);
  if (dur > 2) add("LONG_DURATION");

  const total = reasons.reduce((s, r) => s + r.points, 0);
  const level = total >= 50 ? "critical" : total >= 30 ? "high" : total >= 15 ? "medium" : "low";
  return { total, level, reasons };

  function add(code) {
    const r = rules.find(x => x.code === code);
    if (r) reasons.push({ code: r.code, points: r.points, message: r.message });
  }
}

function hoursUntil(iso) {
  const dt = new Date(iso);
  return (dt - new Date()) / (1000 * 60 * 60);
}

// ---------- helpers ----------

function riskPill(level, score) {
  return `<span class="pill risk ${level}">${escapeHtml(level)} • ${score}</span>`;
}

function pill(text) {
  return `<span class="pill">${escapeHtml(text)}</span>`;
}

function systemsLabel(state, ids) {
  const names = (ids || []).map(id => (state.systems || []).find(s => s.id === id)?.name).filter(Boolean);
  return names.join(", ") || "No systems";
}

function nextId(list) {
  const max = (list || []).reduce((m, x) => Math.max(m, x.id || 0), 0);
  return max + 1;
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
