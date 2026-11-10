import type {
  KanbanStatus,
  Project,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  ProjectTemplate,
  UserProfile,
} from '../types.ts';

export const MAX_SUPABASE_FILE_BYTES = 50 * 1024 * 1024;

export function addDaysISO(isoDate: string, offsetDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return dt.toISOString().slice(0, 10);
}

export function diffDaysISO(plannedEnd: string | null, actualEnd: string | null): number {
  if (!plannedEnd || !actualEnd) return 0;
  const [py, pm, pd] = plannedEnd.split('-').map(Number);
  const [ay, am, ad] = actualEnd.split('-').map(Number);
  const pTime = Date.UTC(py, pm - 1, pd);
  const aTime = Date.UTC(ay, am - 1, ad);
  return Math.round((aTime - pTime) / 86_400_000);
}

export function calculateMilestoneProgress(tasks: ProjectTask[]): number {
  if (tasks.length === 0) return 0;
  const doneCount = tasks.filter((t) => t.kanban_status === 'done' || t.is_completed).length;
  return Math.round((doneCount / tasks.length) * 100);
}

export type MilestoneHealth = 'healthy' | 'warning' | 'critical' | 'completed';

export function evaluateMilestoneHealth(
  milestone: ProjectMilestone,
  milestoneTasks: ProjectTask[],
  referenceTodayISO: string
): {
  health: MilestoneHealth;
  varianceDays: number;
  activeGateBlockers: ProjectTask[];
  reasonLabel: string;
} {
  const varianceDays = diffDaysISO(milestone.planned_end, milestone.actual_end);
  const activeGateBlockers = milestoneTasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  );

  if (milestone.progress_pct >= 100 && activeGateBlockers.length === 0) {
    return {
      health: 'completed',
      varianceDays,
      activeGateBlockers,
      reasonLabel: 'Completed',
    };
  }

  if (milestone.is_ongoing_phase || !milestone.actual_end) {
    return {
      health: 'warning',
      varianceDays: 0,
      activeGateBlockers,
      reasonLabel: 'No end date',
    };
  }

  const overdueVsToday =
    diffDaysISO(milestone.actual_end, referenceTodayISO) > 0 &&
    milestone.progress_pct < 100;
  if (varianceDays > 3 || overdueVsToday) {
    return {
      health: 'critical',
      varianceDays,
      activeGateBlockers,
      reasonLabel: varianceDays > 0 ? `+${varianceDays}d behind` : 'Overdue',
    };
  }

  if (varianceDays > 0 || activeGateBlockers.length > 0) {
    return {
      health: varianceDays > 0 ? 'warning' : 'healthy',
      varianceDays,
      activeGateBlockers,
      reasonLabel:
        varianceDays > 0
          ? `+${varianceDays}d variance`
          : `${activeGateBlockers.length} blocker`,
    };
  }

  return {
    health: 'healthy',
    varianceDays,
    activeGateBlockers,
    reasonLabel: varianceDays < 0 ? `${Math.abs(varianceDays)}d ahead` : 'On track',
  };
}

export function canCloseMilestoneGate(
  milestone: ProjectMilestone,
  milestoneTasks: ProjectTask[],
  projectDocs: ProjectDocument[]
): { allowed: boolean; blockers: string[] } {
  const reasons: string[] = [];
  const unfinishedBlockers = milestoneTasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  );

  for (const task of unfinishedBlockers) {
    reasons.push(`Open gate blocker: [${task.code}] ${task.title}`);
  }

  const completedBlockersWithoutDocs = milestoneTasks.filter((t) => {
    if (!t.is_gate_blocker) return false;
    const hasDoc = projectDocs.some(
      (d) => d.task_id === t.id || d.milestone_id === milestone.id
    );
    return !hasDoc;
  });

  if (completedBlockersWithoutDocs.length > 0) {
    reasons.push(`Missing deliverable document for "${milestone.title}"`);
  }

  return {
    allowed: reasons.length === 0,
    blockers: reasons,
  };
}

export function validateAttachmentFileSize(sizeBytes: number): {
  valid: boolean;
  error?: string;
} {
  if (sizeBytes <= 0) {
    return { valid: false, error: 'Invalid file size.' };
  }
  if (sizeBytes > MAX_SUPABASE_FILE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File exceeds the 50 MB limit (${sizeMB} MB). Attach a SharePoint or Drive link instead.`,
    };
  }
  return { valid: true };
}

export function mapOdooStageToKanban(odooStageName: string): KanbanStatus {
  const normalized = odooStageName.trim().toLowerCase();
  if (
    normalized.includes('done') ||
    normalized.includes('hoàn thành') ||
    normalized.includes('closed')
  ) {
    return 'done';
  }
  if (
    normalized.includes('review') ||
    normalized.includes('qa') ||
    normalized.includes('uat') ||
    normalized.includes('test')
  ) {
    return 'review';
  }
  if (
    normalized.includes('progress') ||
    normalized.includes('đang làm') ||
    normalized.includes('dev')
  ) {
    return 'in_progress';
  }
  if (
    normalized.includes('todo') ||
    normalized.includes('to do') ||
    normalized.includes('ready')
  ) {
    return 'todo';
  }
  return 'backlog';
}

export function mapKanbanToOdooStage(status: KanbanStatus): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'todo':
      return 'To Do';
    case 'in_progress':
      return 'In Progress';
    case 'review':
      return 'Testing / QA';
    case 'done':
      return 'Done';
  }
}

export function instantiateProjectFromTemplateEngine(params: {
  template: ProjectTemplate;
  projectName: string;
  projectCode: string;
  clientOrUnit: string;
  startDateISO: string;
  odooProjectId: number;
  odooBaseUrl: string;
  ownerId: string;
  users: UserProfile[];
}): {
  project: Project;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
} {
  const {
    template,
    projectName,
    projectCode,
    clientOrUnit,
    startDateISO,
    odooProjectId,
    odooBaseUrl,
    ownerId,
    users,
  } = params;

  const projectId = `proj-${Date.now()}`;
  const creatorUser = users.find((u) => u.id === ownerId) ?? users[0];
  const project: Project = {
    id: projectId,
    code: projectCode,
    name: projectName,
    client_or_unit: clientOrUnit,
    description: `Created from template: ${template.template_name}`,
    template_id: template.id,
    status: 'on_track',
    owner_id: ownerId,
    odoo_project_id: odooProjectId,
    odoo_project_url: `${odooBaseUrl}/web#id=${odooProjectId}&model=project.project&view_type=form`,
    start_date: startDateISO,
    baseline_committed: true,
    baseline_committed_at: new Date().toISOString(),
    share_token: `tl-${projectCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.random().toString(36).slice(2, 7)}`,
    invite_default_role: 'writer',
    members: creatorUser
      ? [
          {
            user_id: creatorUser.id,
            email: creatorUser.email,
            full_name: creatorUser.full_name,
            avatar_initials: creatorUser.avatar_initials,
            role: 'owner',
            added_at: new Date().toISOString().slice(0, 10),
            added_by: creatorUser.full_name,
          },
        ]
      : [],
  };

  const milestoneKeyToId = new Map<string, string>();
  const milestones: ProjectMilestone[] = template.default_milestones_json.map(
    (mDef, idx) => {
      const mId = `ms-${projectId}-${idx + 1}`;
      milestoneKeyToId.set(mDef.key, mId);
      const pStart = addDaysISO(startDateISO, mDef.offset_days);
      const pEnd = mDef.is_ongoing_phase
        ? null
        : addDaysISO(pStart, mDef.duration_days);
      return {
        id: mId,
        project_id: projectId,
        code: `${projectCode} · ${mDef.code}`,
        title: mDef.title,
        icon: mDef.icon ?? ['🧭', '🎨', '⚡', '🛡️', '🚀'][idx % 5],
        order_index: idx + 1,
        planned_start: pStart,
        planned_end: pEnd,
        actual_start: pStart,
        actual_end: pEnd,
        review_cycle_date: mDef.is_ongoing_phase
          ? addDaysISO(pStart, 14)
          : undefined,
        is_ongoing_phase: Boolean(mDef.is_ongoing_phase),
        progress_pct: 0,
        odoo_milestone_id: null,
        is_closed: false,
      };
    }
  );

  const tasks: ProjectTask[] = template.default_tasks_json.map((tDef, idx) => {
    const milestoneId =
      milestoneKeyToId.get(tDef.milestone_key) ?? milestones[0].id;
    const matchedUser =
      users.find((u) => u.role === tDef.default_role) ?? users[0];
    const tStart = addDaysISO(startDateISO, tDef.offset_days);
    const tEnd = addDaysISO(tStart, tDef.duration_days);
    return {
      id: `task-${projectId}-${idx + 1}`,
      project_id: projectId,
      milestone_id: milestoneId,
      code: `${projectCode}-T${String(idx + 1).padStart(2, '0')}`,
      title: tDef.title,
      description: tDef.description,
      kanban_status: idx === 0 ? 'in_progress' : 'todo',
      priority: tDef.priority ?? (tDef.is_gate_blocker ? 'high' : 'medium'),
      is_completed: false,
      is_gate_blocker: tDef.is_gate_blocker,
      assignee_id: matchedUser.id,
      planned_start: tStart,
      due_date: tEnd,
      actual_start: tStart,
      actual_end: tEnd,
      float_days: tDef.is_gate_blocker ? 0 : 2,
      odoo_task_id: null,
      odoo_task_url: null,
      odoo_stage_name: null,
      effective_hours: 0,
      last_synced_at: null,
      checklist: tDef.checklist.map((label, cIdx) => ({
        id: `chk-${idx + 1}-${cIdx + 1}`,
        label,
        done: false,
      })),
    };
  });

  return { project, milestones, tasks };
}
