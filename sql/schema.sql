-- Change Risk Autopilot
-- PostgreSQL schema
-- Author: J Roque
-- Purpose: Change management with incident learning + risk scoring + approvals

BEGIN;

-- =========================
-- Core reference tables
-- =========================

CREATE TABLE IF NOT EXISTS departments (
  dept_id      SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  user_id      SERIAL PRIMARY KEY,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  dept_id      INT REFERENCES departments(dept_id),
  role         TEXT NOT NULL CHECK (role IN ('requester','reviewer','approver','admin')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems (
  system_id     SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  owner_dept_id INT REFERENCES departments(dept_id),
  tier          INT NOT NULL CHECK (tier BETWEEN 0 AND 3), -- 0=low, 3=mission critical
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_windows (
  window_id     SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  notes         TEXT
);

-- =========================
-- Change management
-- =========================

CREATE TABLE IF NOT EXISTS changes (
  change_id        SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  change_type      TEXT NOT NULL CHECK (change_type IN ('patch','config','release','network','dns','access','maintenance','other')),
  requester_id     INT NOT NULL REFERENCES users(user_id),
  planned_start    TIMESTAMPTZ NOT NULL,
  planned_end      TIMESTAMPTZ NOT NULL,
  customer_impact  TEXT NOT NULL CHECK (customer_impact IN ('none','low','medium','high')),
  rollback_plan    TEXT NOT NULL,
  test_plan        TEXT NOT NULL,
  implementation_steps TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','scheduled','implemented','post_review','closed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT planned_end_after_start CHECK (planned_end > planned_start)
);

CREATE TABLE IF NOT EXISTS change_systems (
  change_id   INT NOT NULL REFERENCES changes(change_id) ON DELETE CASCADE,
  system_id   INT NOT NULL REFERENCES systems(system_id),
  PRIMARY KEY (change_id, system_id)
);

CREATE TABLE IF NOT EXISTS change_approvals (
  approval_id  SERIAL PRIMARY KEY,
  change_id    INT NOT NULL REFERENCES changes(change_id) ON DELETE CASCADE,
  approver_id  INT NOT NULL REFERENCES users(user_id),
  decision     TEXT NOT NULL CHECK (decision IN ('pending','approved','rejected')),
  decided_at   TIMESTAMPTZ,
  comment      TEXT
);

-- =========================
-- Incidents and learning
-- =========================

CREATE TABLE IF NOT EXISTS incidents (
  incident_id    SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  severity       INT NOT NULL CHECK (severity BETWEEN 1 AND 4), -- 1=critical, 4=low
  started_at     TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  root_cause     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_systems (
  incident_id INT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  system_id   INT NOT NULL REFERENCES systems(system_id),
  PRIMARY KEY (incident_id, system_id)
);

CREATE TABLE IF NOT EXISTS incident_change_links (
  incident_id INT NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  change_id   INT NOT NULL REFERENCES changes(change_id) ON DELETE CASCADE,
  link_type   TEXT NOT NULL CHECK (link_type IN ('caused_by','related_to')),
  PRIMARY KEY (incident_id, change_id)
);

-- =========================
-- Risk rules and scoring
-- =========================

-- Risk rules are simple, transparent checks. You can upgrade later to ML.
CREATE TABLE IF NOT EXISTS risk_rules (
  rule_id       SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE, -- ex: TIER3_SYSTEM, HIGH_IMPACT, SHORT_NOTICE
  name          TEXT NOT NULL,
  description   TEXT NOT NULL,
  points        INT NOT NULL CHECK (points BETWEEN 1 AND 50),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Stores scoring outcome for each change
CREATE TABLE IF NOT EXISTS change_risk_scores (
  change_id      INT PRIMARY KEY REFERENCES changes(change_id) ON DELETE CASCADE,
  total_score    INT NOT NULL DEFAULT 0,
  level          TEXT NOT NULL CHECK (level IN ('low','medium','high','critical')),
  reasons        JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of {code, points, message}
  calculated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Audit log
-- =========================

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id     SERIAL PRIMARY KEY,
  actor_id     INT REFERENCES users(user_id),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
CREATE INDEX IF NOT EXISTS idx_changes_planned_start ON changes(planned_start);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at);
CREATE INDEX IF NOT EXISTS idx_change_risk_level ON change_risk_scores(level);

COMMIT;
