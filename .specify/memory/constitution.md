# Tianlane Platform Constitution & Non-Negotiables

**Created**: 2026-11-10  
**Domain**: Project Management & Governance for Logistics TechHub  
**Enforcement**: Spec-Kit Automated Analysis & Convergence  

---

## 1. Core Principles & Law of Architecture

1. **Three-Tier Governance Hierarchy (`Project > Milestone > Task`)**:
   - `Project`: Strategic initiative linked to Odoo `project.project`.
   - `Milestone`: Time-boxed stage with mandatory Phase-Gate criteria (mandatory deliverables + blockers).
   - `Task`: Granular work unit linked to Odoo ticket (`project.task`). Tasks MUST belong to a parent Milestone.

2. **Odoo Single Source of Truth for Timesheets**:
   - Tianlane governs schedule baselines, milestone phase-gates, and access.
   - Odoo ERP (`support.logtechub.com`) remains the single source of truth for developer timesheets, hours, and tickets.
   - Synchronization is executed bidirectionally via JSON-RPC / MCP Server (`/api/mcp`).

3. **Discreet Security & Confidentiality**:
   - Never leak passwords, password formulas, or usernames in error messages or modals.
   - Client applications never store cloud storage master keys; all file uploads use Cloudflare R2 presigned PUT URLs (`POST /api/storage/presign`).

4. **Multi-Team & RBAC Boundaries**:
   - Admin (`james.nhan@logtechub.com`): Global visibility across all teams, accounts, and projects.
   - Team PM: Manages team member positions and team projects.
   - Project Roles: `Owner` (full edit, member management), `Writer` (edit tasks, shift dates), `Viewer` (read-only audit).

5. **Zero-Disk Backend & Scale-to-Zero Database**:
   - The backend server is 100% stateless (zero local disk persistence).
   - Neon PostgreSQL pooler connects with `max: 3` and `idleTimeoutMillis: 10000` to allow compute scale-to-zero.
   - `/health` endpoint NEVER touches the database.
