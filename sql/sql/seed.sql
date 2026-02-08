BEGIN;

INSERT INTO departments (name) VALUES
('IT Operations'),
('Security'),
('Engineering'),
('Customer Support')
ON CONFLICT DO NOTHING;

INSERT INTO users (full_name, email, dept_id, role) VALUES
('J Roque', 'jroque@example.com', (SELECT dept_id FROM departments WHERE name='IT Operations'), 'admin'),
('A. Reviewer', 'reviewer@example.com', (SELECT dept_id FROM departments WHERE name='Security'), 'reviewer'),
('S. Approver', 'approver@example.com', (SELECT dept_id FROM departments WHERE name='IT Operations'), 'approver'),
('E. Engineer', 'engineer@example.com', (SELECT dept_id FROM departments WHERE name='Engineering'), 'requester')
ON CONFLICT DO NOTHING;

INSERT INTO systems (name, owner_dept_id, tier, description) VALUES
('Core DNS', (SELECT dept_id FROM departments WHERE name='IT Operations'), 3, 'Internal and external DNS hosting'),
('VPN Gateway', (SELECT dept_id FROM departments WHERE name='Security'), 3, 'Remote access VPN'),
('Customer Portal', (SELECT dept_id FROM departments WHERE name='Engineering'), 2, 'Public web portal'),
('File Share', (SELECT dept_id FROM departments WHERE name='IT Operations'), 1, 'Internal SMB file services')
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_windows (name, day_of_week, start_time, end_time, timezone, notes) VALUES
('Weekly Sunday Window', 0, '01:00', '04:00', 'America/Los_Angeles', 'Preferred maintenance window'),
('Wednesday Night Window', 3, '22:00', '23:59', 'America/Los_Angeles', 'Lightweight changes only')
ON CONFLICT DO NOTHING;

INSERT INTO risk_rules (code, name, description, points) VALUES
('TIER3_SYSTEM', 'Tier 3 system involved', 'Any mission critical system included in the change', 25),
('HIGH_IMPACT', 'High customer impact', 'Customer impact set to high', 20),
('NO_ROLLBACK', 'Rollback plan too short', 'Rollback plan is missing or too short', 15),
('NO_TEST', 'Test plan too short', 'Test plan is missing or too short', 15),
('SHORT_NOTICE', 'Short notice', 'Change planned within 24 hours of submission', 10),
('LONG_DURATION', 'Long duration', 'Planned duration is over 2 hours', 8)
ON CONFLICT DO NOTHING;

-- Sample incident history
INSERT INTO incidents (title, severity, started_at, resolved_at, root_cause, notes)
VALUES
('Customer portal outage after release', 2, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days' + INTERVAL '45 minutes',
 'Bad config in deployment', 'Rollback restored service'),
('VPN authentication failures', 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days' + INTERVAL '2 hours',
 'Expired cert on gateway', 'Renewed cert and restarted service');

-- Link incidents to systems
INSERT INTO incident_systems (incident_id, system_id)
SELECT i.incident_id, s.system_id
FROM incidents i
JOIN systems s ON (i.title LIKE '%portal%' AND s.name='Customer Portal')
   OR (i.title LIKE '%VPN%' AND s.name='VPN Gateway');

-- Sample changes
INSERT INTO changes
(title, change_type, requester_id, planned_start, planned_end, customer_impact, rollback_plan, test_plan, implementation_steps, status)
VALUES
('Patch VPN gateway OpenSSL', 'patch',
 (SELECT user_id FROM users WHERE email='engineer@example.com'),
 NOW() + INTERVAL '2 days',
 NOW() + INTERVAL '2 days' + INTERVAL '90 minutes',
 'medium',
 'Rollback: restore snapshot, reinstall previous package, restart VPN services, validate login.',
 'Test: validate VPN login from test account, check logs, run smoke test from two networks.',
 '1) Notify stakeholders 2) Snapshot VM 3) Apply patch 4) Restart 5) Validate 6) Monitor',
 'submitted'
),
('DNS record cleanup for legacy app', 'dns',
 (SELECT user_id FROM users WHERE email='jroque@example.com'),
 NOW() + INTERVAL '6 hours',
 NOW() + INTERVAL '6 hours' + INTERVAL '30 minutes',
 'high',
 'Rollback: revert DNS records to previous values and flush caches.',
 'Test: nslookup from internal and external, confirm app reachability.',
 '1) Export DNS zone 2) Update records 3) Validate 4) Monitor 30 min',
 'in_review'
);

-- Link changes to systems
INSERT INTO change_systems (change_id, system_id)
SELECT c.change_id, s.system_id
FROM changes c
JOIN systems s ON (c.title LIKE '%VPN%' AND s.name='VPN Gateway')
             OR (c.title LIKE '%DNS%' AND s.name='Core DNS');

COMMIT;
