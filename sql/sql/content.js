// content.js
// Text + seed data for the GitHub Pages demo (in-browser only)

window.APP_CONTENT = {
  brand: {
    name: "Change Risk Autopilot",
    tagline: "Change management that learns from outages",
    owner: "J Roque"
  },

  nav: [
    { id: "dashboard", label: "Dashboard" },
    { id: "new_change", label: "New Change" },
    { id: "changes", label: "Changes" },
    { id: "incidents", label: "Incidents" },
    { id: "about", label: "About" }
  ],

  lookups: {
    changeTypes: ["patch", "config", "release", "network", "dns", "access", "maintenance", "other"],
    customerImpact: ["none", "low", "medium", "high"],
    status: ["draft", "submitted", "in_review", "approved", "rejected", "scheduled", "implemented", "post_review", "closed"]
  },

  // Simple transparent risk rules for the web demo
  riskRules: [
    { code: "TIER3_SYSTEM", points: 25, message: "Tier 3 system included" },
    { code: "HIGH_IMPACT", points: 20, message: "Customer impact is high" },
    { code: "NO_ROLLBACK", points: 15, message: "Rollback plan is too short" },
    { code: "NO_TEST", points: 15, message: "Test plan is too short" },
    { code: "SHORT_NOTICE", points: 10, message: "Planned start is within 24 hours" },
    { code: "LONG_DURATION", points: 8, message: "Planned duration is longer than 2 hours" }
  ],

  demoData: {
    systems: [
      { id: 1, name: "Core DNS", tier: 3, desc: "Internal and external DNS hosting" },
      { id: 2, name: "VPN Gateway", tier: 3, desc: "Remote access VPN" },
      { id: 3, name: "Customer Portal", tier: 2, desc: "Public web portal" },
      { id: 4, name: "File Share", tier: 1, desc: "Internal SMB file services" }
    ],

    incidents: [
      {
        id: 101,
        title: "Customer portal outage after release",
        severity: 2,
        startedAt: daysAgoISO(21),
        resolvedAt: daysAgoISO(21, 0.75),
        systems: [3],
        notes: "Rollback restored service. Root cause was a bad config in deployment."
      },
      {
        id: 102,
        title: "VPN authentication failures",
        severity: 1,
        startedAt: daysAgoISO(45),
        resolvedAt: daysAgoISO(45, 2),
        systems: [2],
        notes: "Expired cert. Renewed cert and restarted service."
      }
    ],

    changes: [
      {
        id: 201,
        title: "Patch VPN gateway OpenSSL",
        changeType: "patch",
        requester: "E. Engineer",
        plannedStart: daysFromNowISO(2),
        plannedEnd: daysFromNowISO(2, 1.5),
        customerImpact: "medium",
        status: "submitted",
        systems: [2],
        rollbackPlan: "Rollback: restore snapshot, reinstall previous package, restart VPN services, validate login.",
        testPlan: "Test: validate VPN login from test account, check logs, run smoke test from two networks.",
        steps: "1) Notify 2) Snapshot 3) Patch 4) Restart 5) Validate 6) Monitor"
      },
      {
        id: 202,
        title: "DNS record cleanup for legacy app",
        changeType: "dns",
        requester: "J Roque",
        plannedStart: daysFromNowISO(0.25),
        plannedEnd: daysFromNowISO(0.25, 0.5),
        customerImpact: "high",
        status: "in_review",
        systems: [1],
        rollbackPlan: "Rollback: revert DNS records to previous values and flush caches.",
        testPlan: "Test: nslookup internal and external, confirm app reachability.",
        steps: "1) Export zone 2) Update records 3) Validate 4) Monitor 30 min"
      }
    ]
  }
};

// Helpers for timestamps
function daysFromNowISO(days, hours = 0) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function daysAgoISO(days, hours = 0) {
  const d = new Date();
  d.setTime(d.getTime() - days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
