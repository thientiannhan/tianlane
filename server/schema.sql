-- ============================================================================
-- TIANLANE — POSTGRESQL SCHEMA (NEON.TECH SERVERLESS POSTGRES)
-- Compliant with pm-system.md (6 Core Tables + Deliverable Standards)
-- Always connect via Neon -pooler endpoint; /health NEVER queries this DB.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users_directory (Synced via Microsoft Entra ID / Teams SSO)
CREATE TABLE IF NOT EXISTS users_directory (
  id VARCHAR(64) PRIMARY KEY,
  microsoft_entra_id VARCHAR(128) UNIQUE NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  avatar_initials VARCHAR(8) NOT NULL DEFAULT 'PO',
  role VARCHAR(64) NOT NULL DEFAULT 'Product Owner',
  teams_status VARCHAR(32) NOT NULL DEFAULT 'available',
  teams_webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. project_templates (Standard Project Templates with relative day offsets)
CREATE TABLE IF NOT EXISTS project_templates (
  id VARCHAR(64) PRIMARY KEY,
  template_name VARCHAR(160) NOT NULL,
  code_prefix VARCHAR(24) NOT NULL DEFAULT 'PRJ',
  description TEXT NOT NULL DEFAULT '',
  category VARCHAR(64) NOT NULL DEFAULT 'Software Product',
  default_milestones_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_tasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(64) REFERENCES users_directory(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. projects (Single-project governance workspace linked to Odoo project.project)
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(200) NOT NULL,
  client_or_unit VARCHAR(160) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  template_id VARCHAR(64) REFERENCES project_templates(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'on_track',
  owner_id VARCHAR(64) REFERENCES users_directory(id) ON DELETE SET NULL,
  odoo_project_id INTEGER NOT NULL,
  odoo_project_url TEXT NOT NULL,
  start_date DATE NOT NULL,
  baseline_committed BOOLEAN NOT NULL DEFAULT FALSE,
  baseline_committed_at TIMESTAMPTZ,
  share_token VARCHAR(64) NOT NULL,
  deliverable_requirements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. project_milestones (Phase Swimlanes on Card-Based Timeline)
CREATE TABLE IF NOT EXISTS project_milestones (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(48) NOT NULL,
  title VARCHAR(200) NOT NULL,
  icon VARCHAR(16) DEFAULT '🧭',
  order_index INTEGER NOT NULL DEFAULT 1,
  planned_start DATE NOT NULL,
  planned_end DATE,
  actual_start DATE NOT NULL,
  actual_end DATE,
  review_cycle_date DATE,
  is_ongoing_phase BOOLEAN NOT NULL DEFAULT FALSE,
  progress_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  odoo_milestone_id INTEGER,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, order_index);

-- 5. project_tasks (Synchronized across Timeline View, Kanban View & Odoo project.task)
CREATE TABLE IF NOT EXISTS project_tasks (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id VARCHAR(64) NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  code VARCHAR(48) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kanban_status VARCHAR(32) NOT NULL DEFAULT 'todo'
    CHECK (kanban_status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority VARCHAR(16) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_gate_blocker BOOLEAN NOT NULL DEFAULT FALSE,
  assignee_id VARCHAR(64) REFERENCES users_directory(id) ON DELETE SET NULL,
  planned_start DATE NOT NULL,
  due_date DATE NOT NULL,
  actual_start DATE NOT NULL,
  actual_end DATE NOT NULL,
  float_days INTEGER NOT NULL DEFAULT 0,
  odoo_task_id INTEGER,
  odoo_task_url TEXT,
  odoo_stage_name VARCHAR(120),
  effective_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id, milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_odoo_id ON project_tasks(odoo_task_id);

-- 6. baselines_and_docs (Captured Baselines, Revision Audit Log & Cloudflare R2 Deliverable Hub)
CREATE TABLE IF NOT EXISTS baselines_and_docs (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id VARCHAR(64) REFERENCES project_milestones(id) ON DELETE SET NULL,
  task_id VARCHAR(64) REFERENCES project_tasks(id) ON DELETE SET NULL,
  record_type VARCHAR(24) NOT NULL CHECK (record_type IN ('baseline', 'document')),
  baseline_snapshot JSONB,
  file_name VARCHAR(255),
  file_url TEXT,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes <= 52428800),
  version_tag VARCHAR(32),
  doc_type VARCHAR(64),
  uploaded_by VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baselines_docs_project ON baselines_and_docs(project_id, record_type);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS members_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id VARCHAR(64);
ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS custom_password TEXT;
ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 7. workspace_state_store (Real-time Multi-User Collaboration & Invite Sync on Neon)
CREATE TABLE IF NOT EXISTS workspace_state_store (
  id VARCHAR(32) PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clean up legacy fake users and seed the 10 official Logtechub accounts
DELETE FROM users_directory WHERE id IN ('usr-tl-02', 'usr-ux-03', 'usr-dev-04', 'usr-qa-05')
  OR email IN ('minh.quan@logtechub.com', 'khanh.vy@logtechub.com', 'hoang.nam@logtechub.com', 'thao.linh@logtechub.com');

INSERT INTO users_directory (id, microsoft_entra_id, full_name, email, avatar_initials, role, teams_status, teams_webhook_url)
VALUES
  ('usr-po-01', 'entra-logtechub-james-nhan', 'James Nhan', 'james.nhan@logtechub.com', 'JN', 'Product Owner', 'available', 'https://outlook.office.com/webhook/logtechub-po'),
  ('usr-azura-thuy', 'entra-logtechub-azura-thuy', 'Azura Thuy', 'azura.thuy@logtechub.com', 'AT', 'Product Owner', 'available', 'https://outlook.office.com/webhook/logtechub-po'),
  ('usr-kenny-thuong', 'entra-logtechub-kenny-thuong', 'Kenny Thuong', 'kenny.thuong@logtechub.com', 'KT', 'Tech Lead', 'available', 'https://outlook.office.com/webhook/logtechub-dev'),
  ('usr-brian-binh', 'entra-logtechub-brian-binh', 'Brian Binh', 'brian.binh@logtechub.com', 'BB', 'Senior Dev', 'available', 'https://outlook.office.com/webhook/logtechub-dev'),
  ('usr-daley-thai', 'entra-logtechub-daley-thai', 'Daley Thai', 'daley.thai@logtechub.com', 'DT', 'Senior Dev', 'available', 'https://outlook.office.com/webhook/logtechub-dev'),
  ('usr-lynne-loc', 'entra-logtechub-lynne-loc', 'Lynne Loc', 'lynne.loc@logtechub.com', 'LL', 'UI/UX Designer', 'available', 'https://outlook.office.com/webhook/logtechub-design'),
  ('usr-jasmine-thu', 'entra-logtechub-jasmine-thu', 'Jasmine Thu', 'jasmine.thu@logtechub.com', 'JT', 'QA Engineer', 'available', 'https://outlook.office.com/webhook/logtechub-qa'),
  ('usr-edwin-tai', 'entra-logtechub-edwin-tai', 'Edwin Tai', 'edwin.tai@logtechub.com', 'ET', 'Senior Dev', 'available', 'https://outlook.office.com/webhook/logtechub-dev'),
  ('usr-anatolius-thuan', 'entra-logtechub-anatolius-thuan', 'Anatolius Thuan', 'anatolius.thuan@logtechub.com', 'AT', 'Tech Lead', 'available', 'https://outlook.office.com/webhook/logtechub-dev'),
  ('usr-alex-phuong', 'entra-logtechub-alex-phuong', 'Alex Phuong', 'alex.phuong@logtechub.com', 'AP', 'QA Engineer', 'available', 'https://outlook.office.com/webhook/logtechub-qa')
ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  microsoft_entra_id = EXCLUDED.microsoft_entra_id,
  full_name = EXCLUDED.full_name,
  avatar_initials = EXCLUDED.avatar_initials,
  role = EXCLUDED.role,
  teams_status = 'available';

DELETE FROM workspace_state_store WHERE id = 'default';
