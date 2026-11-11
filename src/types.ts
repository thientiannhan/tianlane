export type KanbanStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface UserProfile {
  id: string;
  microsoft_entra_id: string;
  full_name: string;
  email: string;
  avatar_initials: string;
  avatar_url?: string;
  role: 'Owner' | 'Product Owner' | 'Tech Lead' | 'Senior Dev' | 'UI/UX Designer' | 'QA Engineer';
  teams_status: 'available' | 'busy' | 'in_meeting';
  teams_webhook_url: string;
  password?: string;
  is_admin?: boolean;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  pm_ids: string[];
  member_ids: string[];
  created_at?: string;
}

export interface TemplateMilestoneDef {
  key: string;
  code: string;
  title: string;
  icon?: string;
  offset_days: number;
  duration_days: number;
  is_ongoing_phase?: boolean;
}

export interface TemplateTaskDef {
  milestone_key: string;
  title: string;
  description: string;
  offset_days: number;
  duration_days: number;
  is_gate_blocker: boolean;
  priority?: TaskPriority;
  default_role: UserProfile['role'];
  checklist: string[];
}

export interface ProjectTemplate {
  id: string;
  template_name: string;
  code_prefix: string;
  description: string;
  category: 'Software Product' | 'Enterprise Integration' | 'Mobile & PWA';
  default_milestones_json: TemplateMilestoneDef[];
  default_tasks_json: TemplateTaskDef[];
  created_by: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  code: string;
  title: string;
  icon?: string;
  order_index: number;
  planned_start: string; // YYYY-MM-DD (Baseline captured)
  planned_end: string | null; // null if is_ongoing_phase ("No end date")
  actual_start: string; // YYYY-MM-DD
  actual_end: string | null; // YYYY-MM-DD or null if ongoing
  review_cycle_date?: string; // Mandatory periodic review date if is_ongoing_phase
  is_ongoing_phase: boolean;
  progress_pct: number;
  odoo_milestone_id: number | null;
  is_closed?: boolean;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  milestone_id: string;
  code: string;
  title: string;
  description: string;
  kanban_status: KanbanStatus;
  priority?: TaskPriority;
  is_completed: boolean;
  is_gate_blocker: boolean;
  assignee_id: string;
  planned_start: string; // YYYY-MM-DD (Baseline)
  due_date: string; // YYYY-MM-DD (Baseline planned end)
  actual_start: string; // YYYY-MM-DD
  actual_end: string; // YYYY-MM-DD (Current expected/actual finish)
  float_days: number; // Free float (0 = on Critical Path)
  odoo_task_id: number | null;
  odoo_task_url: string | null;
  odoo_stage_name: string | null;
  effective_hours: number;
  last_synced_at: string | null;
  checklist: ChecklistItem[];
  tags?: string[];
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  milestone_id: string | null;
  task_id: string | null;
  file_name: string;
  file_url: string;
  file_size_bytes: number; // Max 50 MB (52,428,800 bytes) on Supabase Free Tier
  version_tag: string;
  doc_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ProjectDocRequirement {
  id: string;
  project_id: string;
  doc_type: string; // e.g. 'Blueprint', 'PRD', 'UI/UX', 'Architecture', 'UAT Sign-off'
  icon: string;
  accent_color: string;
  description: string;
  milestone_id: string | null;
  is_mandatory: boolean;
}

export interface BaselineRevisionEntry {
  id: string;
  project_id: string;
  target_type: 'milestone' | 'task' | 'scope';
  target_title: string;
  previous_end: string;
  new_end: string;
  delta_days: number;
  reason: string;
  author_name: string;
  created_at: string;
}

export type ProjectMemberRole = 'owner' | 'writer' | 'viewer';

export interface ProjectMember {
  user_id: string;
  email: string;
  full_name: string;
  avatar_initials: string;
  role: ProjectMemberRole;
  added_at: string;
  added_by: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client_or_unit: string;
  description: string;
  template_id: string;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
  owner_id: string;
  team_id?: string;
  odoo_project_id: number;
  odoo_project_url: string;
  start_date: string; // YYYY-MM-DD
  baseline_committed: boolean;
  baseline_committed_at: string | null;
  share_token: string;
  members?: ProjectMember[];
  invite_default_role?: 'viewer' | 'writer';
  avatar_url?: string;
}

export function getApiBaseUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  if (metaEnv?.VITE_API_URL) {
    return String(metaEnv.VITE_API_URL).replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('workers.dev') ||
      window.location.hostname.includes('pages.dev'))
  ) {
    return 'https://tianlane.onrender.com';
  }
  return '';
}

export function isProjectCreator(
  project: Project | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!project || !user) return false;
  return (
    project.owner_id === user.id ||
    (project.owner_id === 'usr-po-01' &&
      user.email?.toLowerCase() === 'james.nhan@logtechub.com')
  );
}

export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.is_admin ||
      user.role === 'Owner' ||
      user.email?.toLowerCase() === 'james.nhan@logtechub.com' ||
      user.id === 'usr-po-01'
  );
}

export function isUserTeamPM(
  team: Team | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!team || !user) return false;
  if (isUserAdmin(user)) return true;
  const pmIds = team.pm_ids || [];
  const memberIds = team.member_ids || [];
  return (
    pmIds.includes(user.id) ||
    (user.role === 'Product Owner' && memberIds.includes(user.id))
  );
}

export function canUserAccessTeam(
  team: Team,
  user: UserProfile | null | undefined
): boolean {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  const memberIds = team.member_ids || [];
  const pmIds = team.pm_ids || [];
  return memberIds.includes(user.id) || pmIds.includes(user.id);
}

export function getUserProjectRole(
  project: Project | null | undefined,
  user: UserProfile | null | undefined
): ProjectMemberRole {
  if (!project || !user) return 'viewer';
  if (isProjectCreator(project, user)) return 'owner';
  const list = project.members || [];
  const hit = list.find(
    (m) =>
      m.user_id === user.id ||
      m.email?.toLowerCase() === user.email?.toLowerCase()
  );
  if (hit) return hit.role;
  return 'viewer';
}

export function canUserEditProject(
  project: Project | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!project || !user) return false;
  const role = getUserProjectRole(project, user);
  return role === 'owner' || role === 'writer';
}

export function canUserManageMembers(
  project: Project | null | undefined,
  user: UserProfile | null | undefined
): boolean {
  if (!project || !user) return false;
  return getUserProjectRole(project, user) === 'owner';
}

export interface OdooConnectionConfig {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  companyName: string;
  companyId: number;
}

export type McpToolName =
  | 'instantiate_project_from_template'
  | 'generate_odoo_tasks_from_app'
  | 'sync_tasks_status_with_odoo'
  | 'get_project_roadmap_and_blockers'
  | 'send_project_reminder_notification'
  | 'generate_and_send_status_report';

export interface McpExecutionLog {
  id: string;
  tool_name: McpToolName;
  timestamp: string;
  prompt_summary: string;
  status: 'pending_confirmation' | 'executed' | 'cancelled';
  affected_count: number;
  output_markdown: string;
}
