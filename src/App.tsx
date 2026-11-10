import React, { useEffect, useMemo, useState } from 'react';
import type {
  BaselineRevisionEntry,
  KanbanStatus,
  McpExecutionLog,
  Project,
  ProjectDocRequirement,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  ProjectTemplate,
  UserProfile,
} from './types.ts';
import {
  DEFAULT_ODOO_BASE_URL,
  REFERENCE_TODAY_ISO,
  SEED_DOC_REQUIREMENTS,
  SEED_DOCUMENTS,
  SEED_MCP_LOGS,
  SEED_MILESTONES,
  SEED_PROJECTS,
  SEED_REVISION_LOGS,
  SEED_TASKS,
  SEED_TEMPLATES,
  SEED_USERS,
} from './data/seedData.ts';
import {
  addDaysISO,
  calculateMilestoneProgress,
  instantiateProjectFromTemplateEngine,
  mapKanbanToOdooStage,
} from './engine/scheduleEngine.ts';
import { LandingPage } from './components/LandingPage.tsx';
import { TimelineView } from './components/TimelineView.tsx';
import { KanbanView } from './components/KanbanView.tsx';
import { DetailDrawer } from './components/DetailDrawer.tsx';
import { TemplateModal } from './components/TemplateModal.tsx';
import { ProjectEditModal } from './components/ProjectEditModal.tsx';
import { ProjectFilesView } from './components/ProjectFilesView.tsx';
import { DocumentAndBaselineHub } from './components/DocumentAndBaselineHub.tsx';
import {
  DEFAULT_DISPLAY_PROPERTIES,
  type ProjectDisplayState,
  type ProjectFilterState,
} from './components/ProjectHeaderControls.tsx';
import {
  AgentView,
  InboxView,
  ProjectStandardsView,
  TeamView,
} from './components/WorkspaceViews.tsx';
import { Sidebar, type SidebarSection } from './components/Sidebar.tsx';
import { ProjectTopBar } from './components/ProjectTopBar.tsx';
import { PwaInstallModal } from './components/PwaInstallModal.tsx';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'tianlane_pm_state_v4';

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).projects ?? SEED_PROJECTS;
      } catch {
        return SEED_PROJECTS;
      }
    }
    return SEED_PROJECTS;
  });

  const [milestones, setMilestones] = useState<ProjectMilestone[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).milestones ?? SEED_MILESTONES;
      } catch {
        return SEED_MILESTONES;
      }
    }
    return SEED_MILESTONES;
  });

  const [tasks, setTasks] = useState<ProjectTask[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).tasks ?? SEED_TASKS;
      } catch {
        return SEED_TASKS;
      }
    }
    return SEED_TASKS;
  });

  const [documents, setDocuments] = useState<ProjectDocument[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).documents ?? SEED_DOCUMENTS;
      } catch {
        return SEED_DOCUMENTS;
      }
    }
    return SEED_DOCUMENTS;
  });

  const [docRequirements, setDocRequirements] = useState<
    ProjectDocRequirement[]
  >(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).docRequirements ?? SEED_DOC_REQUIREMENTS;
      } catch {
        return SEED_DOC_REQUIREMENTS;
      }
    }
    return SEED_DOC_REQUIREMENTS;
  });

  const [revisionLogs, setRevisionLogs] = useState<BaselineRevisionEntry[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).revisionLogs ?? SEED_REVISION_LOGS;
      } catch {
        return SEED_REVISION_LOGS;
      }
    }
    return SEED_REVISION_LOGS;
  });

  const [mcpLogs, setMcpLogs] = useState<McpExecutionLog[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).mcpLogs ?? SEED_MCP_LOGS;
      } catch {
        return SEED_MCP_LOGS;
      }
    }
    return SEED_MCP_LOGS;
  });

  const [templates, setTemplates] = useState<ProjectTemplate[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw).templates ?? SEED_TEMPLATES;
      } catch {
        return SEED_TEMPLATES;
      }
    }
    return SEED_TEMPLATES;
  });

  const [showLandingPage, setShowLandingPage] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<SidebarSection>('projects');
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => projects[0]?.id ?? SEED_PROJECTS[0].id
  );
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(true);
  const [teamsOpen, setTeamsOpen] = useState<boolean>(true);

  const [filterState, setFilterState] = useState<ProjectFilterState>({
    searchQuery: '',
    status: 'all',
    gateBlockerOnly: false,
    odooLink: 'all',
    assigneeId: 'all',
    milestoneId: 'all',
  });

  const [displayState, setDisplayState] = useState<ProjectDisplayState>({
    viewMode: 'timeline',
    groupByMilestone: true,
    ordering: 'manual',
    showBaseline: true,
    showEmptyColumns: true,
    properties: { ...DEFAULT_DISPLAY_PROPERTIES },
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(SEED_USERS[0]);
  const [odooBaseUrl, setOdooBaseUrl] = useState<string>(DEFAULT_ODOO_BASE_URL);

  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [selectedMilestone, setSelectedMilestone] =
    useState<ProjectMilestone | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] =
    useState<boolean>(false);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState<boolean>(false);
  const [deferredPwaPrompt, setDeferredPwaPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects,
        milestones,
        tasks,
        documents,
        docRequirements,
        revisionLogs,
        mcpLogs,
        templates,
      })
    );
  }, [
    projects,
    milestones,
    tasks,
    documents,
    docRequirements,
    revisionLogs,
    mcpLogs,
    templates,
  ]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleInstallPwaClick = async () => {
    if (deferredPwaPrompt) {
      await deferredPwaPrompt.prompt();
      const choice = await deferredPwaPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showToast('Installed Tianlane to your desktop.');
      }
      setDeferredPwaPrompt(null);
    } else {
      setIsPwaGuideOpen(true);
    }
  };

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const projectMilestones = milestones
    .filter((m) => m.project_id === activeProject.id)
    .sort((a, b) => a.order_index - b.order_index);
  const projectTasks = tasks.filter((t) => t.project_id === activeProject.id);
  const projectDocs = documents.filter((d) => d.project_id === activeProject.id);
  const projectDocRequirements = docRequirements.filter(
    (r) => r.project_id === activeProject.id
  );
  const projectRevisions = revisionLogs.filter(
    (r) => r.project_id === activeProject.id
  );

  const filteredTasks = useMemo(() => {
    const q = filterState.searchQuery.trim().toLowerCase();
    const list = projectTasks.filter((t) => {
      if (
        q &&
        !t.title.toLowerCase().includes(q) &&
        !t.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filterState.status !== 'all' && t.kanban_status !== filterState.status) {
        return false;
      }
      if (filterState.gateBlockerOnly && !t.is_gate_blocker) {
        return false;
      }
      if (filterState.odooLink === 'linked' && !t.odoo_task_id) {
        return false;
      }
      if (filterState.odooLink === 'unlinked' && t.odoo_task_id) {
        return false;
      }
      if (
        filterState.assigneeId !== 'all' &&
        t.assignee_id !== filterState.assigneeId
      ) {
        return false;
      }
      if (
        filterState.milestoneId !== 'all' &&
        t.milestone_id !== filterState.milestoneId
      ) {
        return false;
      }
      return true;
    });

    if (displayState.ordering === 'due_date') {
      return [...list].sort((a, b) => a.actual_end.localeCompare(b.actual_end));
    }
    if (displayState.ordering === 'progress') {
      return [...list].sort(
        (a, b) => Number(b.is_completed) - Number(a.is_completed)
      );
    }
    return list;
  }, [projectTasks, filterState, displayState.ordering]);

  const filteredMilestones = useMemo(() => {
    if (filterState.milestoneId === 'all') return projectMilestones;
    return projectMilestones.filter((m) => m.id === filterState.milestoneId);
  }, [projectMilestones, filterState.milestoneId]);

  const syncMilestoneProgress = (
    nextTasks: ProjectTask[],
    targetMilestoneId: string
  ) => {
    const mTasks = nextTasks.filter((t) => t.milestone_id === targetMilestoneId);
    const pct = calculateMilestoneProgress(mTasks);
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === targetMilestoneId ? { ...m, progress_pct: pct } : m
      )
    );
  };

  const handleMoveTaskStatus = (taskId: string, newStatus: KanbanStatus) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const updatedTask: ProjectTask = {
      ...target,
      kanban_status: newStatus,
      is_completed: newStatus === 'done',
      odoo_stage_name: target.odoo_task_id
        ? mapKanbanToOdooStage(newStatus)
        : target.odoo_stage_name,
    };

    const nextTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));
    setTasks(nextTasks);
    syncMilestoneProgress(nextTasks, target.milestone_id);

    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }
    showToast(`Moved ${target.code} to ${mapKanbanToOdooStage(newStatus)}.`);
  };

  const handleUpdateTask = (updated: ProjectTask) => {
    const nextTasks = tasks.map((t) => (t.id === updated.id ? updated : t));
    setTasks(nextTasks);
    syncMilestoneProgress(nextTasks, updated.milestone_id);
    setSelectedTask(updated);
  };

  const handleShiftMilestoneEnd = (milestoneId: string, deltaDays: number) => {
    const ms = milestones.find((m) => m.id === milestoneId);
    if (!ms || !ms.actual_end) return;

    const previousEnd = ms.actual_end;
    const newEnd = addDaysISO(previousEnd, deltaDays);

    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId ? { ...m, actual_end: newEnd } : m
      )
    );

    if (activeProject.baseline_committed) {
      const revEntry: BaselineRevisionEntry = {
        id: `rev-${Date.now()}`,
        project_id: activeProject.id,
        target_type: 'milestone',
        target_title: `${ms.code}: ${ms.title}`,
        previous_end: previousEnd,
        new_end: newEnd,
        delta_days: deltaDays,
        reason:
          deltaDays > 0
            ? 'Extended milestone target date on Timeline'
            : 'Pulled in milestone target date on Timeline',
        author_name: currentUser.full_name,
        created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      setRevisionLogs((prev) => [revEntry, ...prev]);
    }
    showToast(`Updated ${ms.code} end date: ${previousEnd} → ${newEnd}.`);
  };

  const handleShiftTaskEnd = (taskId: string, deltaDays: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newEnd = addDaysISO(task.actual_end, deltaDays);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, actual_end: newEnd } : t))
    );
  };

  const handleUpdateMilestoneIcon = (milestoneId: string, icon: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, icon } : m))
    );
    showToast(`Updated milestone icon to ${icon}.`);
  };

  const handleToggleMilestoneClosed = (milestoneId: string) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId ? { ...m, is_closed: !m.is_closed } : m
      )
    );
  };

  const handleCommitBaseline = () => {
    const nowIso = new Date().toISOString();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, baseline_committed: true, baseline_committed_at: nowIso }
          : p
      )
    );
    setMilestones((prev) =>
      prev.map((m) =>
        m.project_id === activeProject.id
          ? { ...m, planned_start: m.actual_start, planned_end: m.actual_end }
          : m
      )
    );
    setTasks((prev) =>
      prev.map((t) =>
        t.project_id === activeProject.id
          ? { ...t, planned_start: t.actual_start, due_date: t.actual_end }
          : t
      )
    );
    showToast(`Committed new baseline for ${activeProject.code}.`);
  };

  const handleCreateTaskQuick = (
    milestoneId: string,
    status: KanbanStatus,
    title: string
  ) => {
    const ms = milestones.find((m) => m.id === milestoneId);
    const nextIdx = projectTasks.length + 1;
    const code = `${activeProject.code}-T${String(nextIdx).padStart(2, '0')}`;
    const startIso = ms?.actual_start ?? REFERENCE_TODAY_ISO;
    const endIso = addDaysISO(startIso, 5);

    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      project_id: activeProject.id,
      milestone_id: milestoneId,
      code,
      title,
      description: 'Created from board quick-add.',
      kanban_status: status,
      priority: 'medium',
      is_completed: status === 'done',
      is_gate_blocker: false,
      assignee_id: currentUser.id,
      planned_start: startIso,
      due_date: endIso,
      actual_start: startIso,
      actual_end: endIso,
      float_days: 2,
      odoo_task_id: null,
      odoo_task_url: null,
      odoo_stage_name: null,
      effective_hours: 0,
      last_synced_at: null,
      checklist: [
        { id: `chk-${Date.now()}`, label: 'Verify deliverable', done: false },
      ],
    };

    const nextTasks = [...tasks, newTask];
    setTasks(nextTasks);
    syncMilestoneProgress(nextTasks, milestoneId);
    showToast(`Added ${code}: ${title}.`);
  };

  const handleInstantiateFromTemplate = (payload: {
    template: ProjectTemplate;
    projectName: string;
    projectCode: string;
    clientOrUnit: string;
    startDateISO: string;
    odooProjectId: number;
    autoPushToOdoo: boolean;
  }) => {
    const result = instantiateProjectFromTemplateEngine({
      template: payload.template,
      projectName: payload.projectName,
      projectCode: payload.projectCode,
      clientOrUnit: payload.clientOrUnit,
      startDateISO: payload.startDateISO,
      odooProjectId: payload.odooProjectId,
      odooBaseUrl,
      ownerId: currentUser.id,
      users: SEED_USERS,
    });

    let baseNewTasks = result.tasks;
    let baseNewMilestones = result.milestones;

    if (payload.autoPushToOdoo) {
      let nextOdooTaskId = payload.odooProjectId * 100 + 1;
      let nextOdooMsId = payload.odooProjectId * 10 + 1;
      baseNewMilestones = baseNewMilestones.map((m) => ({
        ...m,
        odoo_milestone_id: nextOdooMsId++,
      }));
      baseNewTasks = baseNewTasks.map((t) => {
        const assignedId = nextOdooTaskId++;
        return {
          ...t,
          odoo_task_id: assignedId,
          odoo_task_url: `${odooBaseUrl}/web#id=${assignedId}&model=project.task&view_type=form`,
          odoo_stage_name: mapKanbanToOdooStage(t.kanban_status),
          last_synced_at: new Date().toISOString(),
        };
      });
    }

    // Seed standard deliverable requirements for the newly created project
    const defaultReqs: ProjectDocRequirement[] = [
      {
        id: `req-${result.project.id}-blueprint`,
        project_id: result.project.id,
        doc_type: 'Blueprint',
        icon: '📐',
        accent_color: '#0A4595',
        description: 'End-to-end service blueprint and process swimlane architecture.',
        milestone_id: baseNewMilestones[0]?.id ?? null,
        is_mandatory: true,
      },
      {
        id: `req-${result.project.id}-prd`,
        project_id: result.project.id,
        doc_type: 'PRD',
        icon: '📄',
        accent_color: '#2563EB',
        description: 'Product Requirements Document and baseline scope definition.',
        milestone_id: baseNewMilestones[0]?.id ?? null,
        is_mandatory: true,
      },
      {
        id: `req-${result.project.id}-uiux`,
        project_id: result.project.id,
        doc_type: 'UI/UX',
        icon: '🎨',
        accent_color: '#7C3AED',
        description: 'High-fidelity Figma prototype and interaction specification.',
        milestone_id: baseNewMilestones[1]?.id ?? baseNewMilestones[0]?.id ?? null,
        is_mandatory: true,
      },
      {
        id: `req-${result.project.id}-uat`,
        project_id: result.project.id,
        doc_type: 'UAT Sign-off',
        icon: '✅',
        accent_color: '#188038',
        description: 'Final UAT verification report and Product Owner sign-off certificate.',
        milestone_id:
          baseNewMilestones[baseNewMilestones.length - 1]?.id ?? null,
        is_mandatory: true,
      },
    ];

    setProjects((prev) => [result.project, ...prev]);
    setMilestones((prev) => [...prev, ...baseNewMilestones]);
    setTasks((prev) => [...prev, ...baseNewTasks]);
    setDocRequirements((prev) => [...prev, ...defaultReqs]);
    setActiveProjectId(result.project.id);
    setActiveSection('projects');

    showToast(
      `Created ${result.project.code} (${baseNewMilestones.length} milestones, ${baseNewTasks.length} tasks).`
    );
  };

  const handleSaveProject = (payload: {
    updatedProject: Project;
    updatedMilestones: ProjectMilestone[];
    shiftDeltaDays: number;
    previousCode: string;
  }) => {
    const { updatedProject, updatedMilestones, shiftDeltaDays, previousCode } =
      payload;
    const validMsIds = new Set(updatedMilestones.map((m) => m.id));
    const fallbackMsId = updatedMilestones[0]?.id ?? '';

    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );

    setMilestones((prev) => [
      ...prev.filter((m) => m.project_id !== updatedProject.id),
      ...updatedMilestones,
    ]);

    setTasks((prev) =>
      prev.map((t) => {
        if (t.project_id !== updatedProject.id) return t;
        const nextCode = t.code.startsWith(previousCode)
          ? `${updatedProject.code}${t.code.slice(previousCode.length)}`
          : t.code;
        const nextMsId = validMsIds.has(t.milestone_id)
          ? t.milestone_id
          : fallbackMsId;

        if (shiftDeltaDays === 0) {
          return { ...t, code: nextCode, milestone_id: nextMsId };
        }
        return {
          ...t,
          code: nextCode,
          milestone_id: nextMsId,
          planned_start: addDaysISO(t.planned_start, shiftDeltaDays),
          due_date: addDaysISO(t.due_date, shiftDeltaDays),
          actual_start: addDaysISO(t.actual_start, shiftDeltaDays),
          actual_end: addDaysISO(t.actual_end, shiftDeltaDays),
        };
      })
    );

    showToast(`Saved changes to ${updatedProject.code} · ${updatedProject.name}.`);
  };

  const handleDeleteProject = (projectIdToDelete: string) => {
    if (projects.length <= 1) {
      showToast('At least one project must remain in the workspace.');
      return;
    }
    const target = projects.find((p) => p.id === projectIdToDelete);
    const remaining = projects.filter((p) => p.id !== projectIdToDelete);

    setProjects(remaining);
    setMilestones((prev) =>
      prev.filter((m) => m.project_id !== projectIdToDelete)
    );
    setTasks((prev) => prev.filter((t) => t.project_id !== projectIdToDelete));
    setDocuments((prev) =>
      prev.filter((d) => d.project_id !== projectIdToDelete)
    );
    setDocRequirements((prev) =>
      prev.filter((r) => r.project_id !== projectIdToDelete)
    );
    setRevisionLogs((prev) =>
      prev.filter((r) => r.project_id !== projectIdToDelete)
    );

    if (activeProjectId === projectIdToDelete && remaining[0]) {
      setActiveProjectId(remaining[0].id);
    }

    showToast(
      `Deleted project ${target ? `${target.code} · ${target.name}` : projectIdToDelete}.`
    );
  };

  const handleSaveDocRequirement = (req: ProjectDocRequirement) => {
    setDocRequirements((prev) => {
      const exists = prev.some((r) => r.id === req.id);
      if (exists) {
        return prev.map((r) => (r.id === req.id ? req : r));
      }
      return [...prev, req];
    });
    showToast(`Saved deliverable requirement: ${req.icon} ${req.doc_type}.`);
  };

  const handleDeleteDocRequirement = (reqId: string) => {
    setDocRequirements((prev) => prev.filter((r) => r.id !== reqId));
    showToast('Removed document requirement.');
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    showToast('Removed uploaded file.');
  };

  const handleTestOdooConnection = async (): Promise<{
    connected: boolean;
    message: string;
  }> => {
    try {
      const res = await fetch('/api/odoo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(odooConfig),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        const errMsg = data.error || 'Connection test failed';
        showToast(errMsg);
        return { connected: false, message: errMsg };
      }
      const msg = `Connected to ${data.url} (DB: ${data.db}) as ${data.username} (UID #${data.uid}) · ${
        data.projects?.length ?? 0
      } active Odoo projects`;
      showToast(msg);
      return { connected: true, message: msg };
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : 'Unable to reach /api/odoo/test';
      showToast(errMsg);
      return { connected: false, message: errMsg };
    }
  };

  const handleExecuteBatchGenerateOdoo = async (): Promise<{
    createdCount: number;
    summary: string;
  }> => {
    const unlinked = projectTasks.filter((t) => !t.odoo_task_id);
    if (unlinked.length === 0) {
      const summary = `All ${projectTasks.length} tasks are already linked to Execution Tracker Project #${activeProject.odoo_project_id}.`;
      showToast(summary);
      return { createdCount: 0, summary };
    }

    if (odooConfig.apiKey.trim()) {
      try {
        const res = await fetch('/api/odoo/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...odooConfig,
            odooProjectId: activeProject.odoo_project_id,
            tasks: unlinked,
          }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.created)) {
          const createdMap = new Map<
            string,
            {
              odoo_task_id: number;
              odoo_task_url: string;
              odoo_stage_name: string;
            }
          >();
          for (const item of data.created) {
            createdMap.set(item.task_id, item);
          }
          const nowIso = new Date().toISOString();
          setTasks((prev) =>
            prev.map((t) => {
              const hit = createdMap.get(t.id);
              if (!hit) return t;
              return {
                ...t,
                odoo_task_id: hit.odoo_task_id,
                odoo_task_url: hit.odoo_task_url,
                odoo_stage_name: hit.odoo_stage_name,
                last_synced_at: nowIso,
              };
            })
          );
          const summary = `Live Odoo Dispatch: Created ${data.createdCount} tasks in Odoo Project #${activeProject.odoo_project_id} (${odooConfig.url}).`;
          showToast(summary);
          return { createdCount: data.createdCount, summary };
        }
      } catch {
        // Fallback to local link generation below
      }
    }

    let generatedCount = 0;
    let nextId = activeProject.odoo_project_id * 100 + projectTasks.length + 10;

    const nextTasks = tasks.map((t) => {
      if (t.project_id === activeProject.id && !t.odoo_task_id) {
        generatedCount++;
        const newOdooId = nextId++;
        return {
          ...t,
          odoo_task_id: newOdooId,
          odoo_task_url: `${odooBaseUrl}/web#id=${newOdooId}&model=project.task&view_type=form`,
          odoo_stage_name: mapKanbanToOdooStage(t.kanban_status),
          last_synced_at: new Date().toISOString(),
        };
      }
      return t;
    });

    setTasks(nextTasks);
    const summary = `Dispatched ${generatedCount} tasks to Execution Tracker Project #${activeProject.odoo_project_id} with direct links.`;
    showToast(summary);
    return { createdCount: generatedCount, summary };
  };

  const handleExecuteSyncOdooStatus = async (
    direction: 'odoo_to_app' | 'app_to_odoo'
  ): Promise<{ updatedCount: number; summary: string }> => {
    const nowIso = new Date().toISOString();

    if (odooConfig.apiKey.trim()) {
      try {
        const res = await fetch('/api/odoo/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...odooConfig,
            odooProjectId: activeProject.odoo_project_id,
            tasks: projectTasks,
            direction,
          }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.records)) {
          const recordById = new Map<
            number,
            {
              odoo_stage_name: string;
              kanban_status: KanbanStatus;
              effective_hours: number;
              odoo_task_url: string;
            }
          >();
          for (const rec of data.records) {
            recordById.set(Number(rec.odoo_task_id), rec);
          }

          let updatedCount = 0;
          const nextTasks = tasks.map((t) => {
            if (t.project_id !== activeProject.id || !t.odoo_task_id) return t;
            const live = recordById.get(Number(t.odoo_task_id));
            if (!live) return t;
            updatedCount++;
            return {
              ...t,
              kanban_status: live.kanban_status,
              is_completed: live.kanban_status === 'done',
              odoo_stage_name: live.odoo_stage_name,
              effective_hours: live.effective_hours || t.effective_hours,
              odoo_task_url: live.odoo_task_url || t.odoo_task_url,
              last_synced_at: nowIso,
            };
          });

          setTasks(nextTasks);
          setMilestones((prev) =>
            prev.map((m) => {
              if (m.project_id !== activeProject.id) return m;
              const mTasks = nextTasks.filter((t) => t.milestone_id === m.id);
              return { ...m, progress_pct: calculateMilestoneProgress(mTasks) };
            })
          );

          const summary = `Live Odoo Sync: Updated ${updatedCount} linked tasks from ${odooConfig.url} (DB: ${odooConfig.db}, Project #${activeProject.odoo_project_id}).`;
          showToast(summary);
          return { updatedCount, summary };
        }
      } catch {
        // Fallback to local sync below
      }
    }

    let updatedCount = 0;

    const nextTasks = tasks.map((t) => {
      if (t.project_id !== activeProject.id || !t.odoo_task_id) return t;
      updatedCount++;
      if (direction === 'odoo_to_app' && t.kanban_status === 'review') {
        return {
          ...t,
          kanban_status: 'done' as KanbanStatus,
          is_completed: true,
          odoo_stage_name: 'Sprint Complete',
          effective_hours: t.effective_hours + 4,
          last_synced_at: nowIso,
        };
      }
      return {
        ...t,
        odoo_stage_name: mapKanbanToOdooStage(t.kanban_status),
        last_synced_at: nowIso,
      };
    });

    setTasks(nextTasks);
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.project_id !== activeProject.id) return m;
        const mTasks = nextTasks.filter((t) => t.milestone_id === m.id);
        return { ...m, progress_pct: calculateMilestoneProgress(mTasks) };
      })
    );

    const summary = `Synced ${updatedCount} tasks with Execution Tracker Project #${activeProject.odoo_project_id}.`;
    showToast(summary);
    return { updatedCount, summary };
  };

  const handleResetDemo = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProjects(SEED_PROJECTS);
    setMilestones(SEED_MILESTONES);
    setTasks(SEED_TASKS);
    setDocuments(SEED_DOCUMENTS);
    setDocRequirements(SEED_DOC_REQUIREMENTS);
    setRevisionLogs(SEED_REVISION_LOGS);
    setMcpLogs(SEED_MCP_LOGS);
    setTemplates(SEED_TEMPLATES);
    setActiveProjectId(SEED_PROJECTS[0].id);
    showToast('Restored default demo data.');
  };

  const inboxBadgeCount = tasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  ).length;

  return (
    <>
      {showLandingPage ? (
        <LandingPage
          users={SEED_USERS}
          onSignInWithTeams={(user) => {
            setCurrentUser(user);
            setShowLandingPage(false);
          }}
          onInstallApp={handleInstallPwaClick}
        />
      ) : (
        <div className="min-h-dvh flex flex-col lg:flex-row bg-white text-[#121317]">
          {/* Extracted Modular Left Sidebar */}
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            projects={projects}
            activeProjectId={activeProject.id}
            onSelectProject={setActiveProjectId}
            workspaceOpen={workspaceOpen}
            onToggleWorkspace={() => setWorkspaceOpen((v) => !v)}
            teamsOpen={teamsOpen}
            onToggleTeams={() => setTeamsOpen((v) => !v)}
            inboxBadgeCount={inboxBadgeCount}
            filesCount={projectDocs.length}
            currentUser={currentUser}
            totalTeamMembers={SEED_USERS.length}
            onBackToLanding={() => setShowLandingPage(true)}
            onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
            onOpenEditProject={(projId) => {
              setActiveProjectId(projId);
              setIsEditProjectModalOpen(true);
            }}
            onResetDemo={handleResetDemo}
          />

          {/* MAIN WORKSPACE */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Extracted Modular Top Bar */}
            <ProjectTopBar
              activeSection={activeSection}
              activeProject={activeProject}
              filterState={filterState}
              onChangeFilter={setFilterState}
              displayState={displayState}
              onChangeDisplay={setDisplayState}
              milestones={projectMilestones}
              users={SEED_USERS}
              onResetDisplay={() =>
                setDisplayState({
                  viewMode: 'timeline',
                  groupByMilestone: true,
                  ordering: 'manual',
                  showBaseline: true,
                  showEmptyColumns: true,
                  properties: { ...DEFAULT_DISPLAY_PROPERTIES },
                })
              }
              onSyncOdoo={() => handleExecuteSyncOdooStatus('odoo_to_app')}
              onInstallApp={handleInstallPwaClick}
              onOpenEditProject={() => setIsEditProjectModalOpen(true)}
            />

            {toastMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mx-6 mt-4 px-4 py-2.5 rounded-full bg-[#F7F8FA] border border-[#E6E8EE] flex items-center justify-between text-[13px] text-[#121317]"
              >
                <span>{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="text-[#45474D] hover:text-[#121317] text-[12px] ml-4"
                >
                  Dismiss
                </button>
              </div>
            )}

            <main id="main-workspace" className="flex-1 p-6">
              {activeSection === 'inbox' && (
                <InboxView
                  projects={projects}
                  tasks={tasks}
                  revisionLogs={revisionLogs}
                  mcpLogs={mcpLogs}
                  onOpenProjectTask={(projectId, task) => {
                    setActiveProjectId(projectId);
                    setActiveSection('projects');
                    setSelectedTask(task);
                  }}
                />
              )}

              {activeSection === 'agent' && (
                <AgentView
                  project={activeProject}
                  milestones={projectMilestones}
                  tasks={projectTasks}
                  users={SEED_USERS}
                  mcpLogs={mcpLogs}
                  odooConfig={odooConfig}
                  onUpdateOdooConfig={setOdooConfig}
                  onTestOdooConnection={handleTestOdooConnection}
                  onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
                  onExecuteBatchGenerateOdoo={handleExecuteBatchGenerateOdoo}
                  onExecuteSyncOdooStatus={handleExecuteSyncOdooStatus}
                  onAppendMcpLog={(entry) =>
                    setMcpLogs((prev) => [
                      {
                        ...entry,
                        id: `mcp-${Date.now()}`,
                        timestamp: new Date().toTimeString().slice(0, 8),
                      },
                      ...prev,
                    ])
                  }
                />
              )}

              {activeSection === 'team' && (
                <TeamView
                  users={SEED_USERS}
                  tasks={tasks}
                  currentUser={currentUser}
                  onSelectUserAsCurrent={(u) => {
                    setCurrentUser(u);
                    showToast(`Switched active user to ${u.full_name}.`);
                  }}
                  onFilterByMember={(userId) => {
                    setFilterState((prev) => ({ ...prev, assigneeId: userId }));
                    setActiveSection('projects');
                  }}
                />
              )}

              {activeSection === 'files' && (
                <ProjectFilesView
                  projects={projects}
                  activeProject={activeProject}
                  onSelectProject={setActiveProjectId}
                  milestones={projectMilestones}
                  tasks={projectTasks}
                  documents={documents}
                  docRequirements={docRequirements}
                  currentUser={currentUser}
                  referenceTodayISO={REFERENCE_TODAY_ISO}
                  onAddDocument={(doc) => {
                    const newDoc: ProjectDocument = {
                      ...doc,
                      id: `doc-${Date.now()}`,
                      uploaded_at: REFERENCE_TODAY_ISO,
                    };
                    setDocuments((prev) => [newDoc, ...prev]);
                    showToast(
                      `Uploaded ${doc.doc_type}: ${doc.file_name} (${doc.version_tag}).`
                    );
                  }}
                  onDeleteDocument={handleDeleteDocument}
                  onSaveDocRequirement={handleSaveDocRequirement}
                  onDeleteDocRequirement={handleDeleteDocRequirement}
                />
              )}

              {activeSection === 'settings' && (
                <ProjectStandardsView
                  templates={templates}
                  odooBaseUrl={odooBaseUrl}
                  onUpdateOdooBaseUrl={setOdooBaseUrl}
                  onUpdateTemplates={(next) => {
                    setTemplates(next);
                    showToast('Updated project standard settings.');
                  }}
                  onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
                />
              )}

              {activeSection === 'projects' && (
                <>
                  {displayState.viewMode === 'timeline' && (
                    <TimelineView
                      project={activeProject}
                      milestones={filteredMilestones}
                      tasks={filteredTasks}
                      users={SEED_USERS}
                      documents={projectDocs}
                      docRequirements={projectDocRequirements}
                      revisionLogs={projectRevisions}
                      referenceTodayISO={REFERENCE_TODAY_ISO}
                      showBaselineGhost={displayState.showBaseline}
                      displayProperties={displayState.properties}
                      onSelectMilestone={(ms) => {
                        setSelectedTask(null);
                        setSelectedMilestone(ms);
                      }}
                      onSelectTask={(task) => {
                        setSelectedMilestone(null);
                        setSelectedTask(task);
                      }}
                      onShiftMilestoneEnd={handleShiftMilestoneEnd}
                      onShiftTaskEnd={handleShiftTaskEnd}
                      onUpdateMilestoneIcon={handleUpdateMilestoneIcon}
                      onUpdateTask={handleUpdateTask}
                      onCommitBaseline={handleCommitBaseline}
                    />
                  )}

                  {displayState.viewMode === 'board' && (
                    <KanbanView
                      milestones={filteredMilestones}
                      tasks={filteredTasks}
                      users={SEED_USERS}
                      groupByMilestone={displayState.groupByMilestone}
                      showEmptyColumns={displayState.showEmptyColumns}
                      displayProperties={displayState.properties}
                      onSelectTask={(task) => {
                        setSelectedMilestone(null);
                        setSelectedTask(task);
                      }}
                      onMoveTaskStatus={handleMoveTaskStatus}
                      onCreateTaskQuick={handleCreateTaskQuick}
                    />
                  )}

                  {displayState.viewMode === 'list' && (
                    <DocumentAndBaselineHub
                      project={activeProject}
                      milestones={filteredMilestones}
                      tasks={filteredTasks}
                      documents={projectDocs}
                      revisionLogs={projectRevisions}
                      onSelectMilestone={(ms) => {
                        setSelectedTask(null);
                        setSelectedMilestone(ms);
                      }}
                      onSelectTask={(task) => {
                        setSelectedMilestone(null);
                        setSelectedTask(task);
                      }}
                    />
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}

      {/* Detail Slide-over Drawer */}
      <DetailDrawer
        selectedTask={selectedTask}
        selectedMilestone={selectedMilestone}
        milestones={projectMilestones}
        tasks={projectTasks}
        users={SEED_USERS}
        documents={projectDocs}
        odooBaseUrl={odooBaseUrl}
        currentUser={currentUser}
        onClose={() => {
          setSelectedTask(null);
          setSelectedMilestone(null);
        }}
        onUpdateTask={handleUpdateTask}
        onToggleMilestoneClosed={handleToggleMilestoneClosed}
        onAddDocument={(doc) => {
          const newDoc: ProjectDocument = {
            ...doc,
            id: `doc-${Date.now()}`,
            uploaded_at: REFERENCE_TODAY_ISO,
          };
          setDocuments((prev) => [newDoc, ...prev]);
          showToast(`Attached document: ${doc.file_name}.`);
        }}
      />

      {/* Template Instantiation Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        templates={templates}
        referenceTodayISO={REFERENCE_TODAY_ISO}
        onClose={() => setIsTemplateModalOpen(false)}
        onInstantiate={handleInstantiateFromTemplate}
      />

      {/* Edit / Delete Project Modal */}
      <ProjectEditModal
        isOpen={isEditProjectModalOpen}
        project={activeProject}
        milestones={projectMilestones}
        totalProjectsCount={projects.length}
        odooBaseUrl={odooBaseUrl}
        onClose={() => setIsEditProjectModalOpen(false)}
        onSaveProject={handleSaveProject}
        onDeleteProject={handleDeleteProject}
      />

      {/* PWA Desktop Installation Modal */}
      <PwaInstallModal
        isOpen={isPwaGuideOpen}
        onClose={() => setIsPwaGuideOpen(false)}
      />
    </>
  );
};

export default App;
