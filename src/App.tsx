import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  canUserAccessTeam,
  canUserEditProject,
  getApiBaseUrl,
  isProjectCreator,
  type BaselineRevisionEntry,
  type KanbanStatus,
  type McpExecutionLog,
  type OdooConnectionConfig,
  type Project,
  type ProjectDocRequirement,
  type ProjectDocument,
  type ProjectMember,
  type ProjectMemberRole,
  type ProjectMilestone,
  type ProjectTask,
  type ProjectTemplate,
  type TaskRoleType,
  type Team,
  type UserProfile,
} from './types.ts';
import {
  DEFAULT_ODOO_BASE_URL,
  DEFAULT_ODOO_CONFIG,
  REFERENCE_TODAY_ISO,
  SEED_DOC_REQUIREMENTS,
  SEED_DOCUMENTS,
  SEED_MCP_LOGS,
  SEED_MILESTONES,
  SEED_PROJECTS,
  SEED_REVISION_LOGS,
  SEED_TASKS,
  SEED_TEAMS,
  SEED_TEMPLATES,
  SEED_USERS,
} from './data/seedData.ts';
import {
  addDaysISO,
  calculateMilestoneProgress,
  instantiateProjectFromTemplateEngine,
  mapKanbanToOdooStage,
} from './engine/scheduleEngine.ts';
import { parseRoute, buildRouteUrl } from './engine/routeEngine.ts';
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
  AccountManagementView,
  AgentView,
  InboxView,
  ProjectStandardsView,
  TeamView,
} from './components/WorkspaceViews.tsx';
import { Sidebar, type SidebarSection } from './components/Sidebar.tsx';
import { ProjectTopBar } from './components/ProjectTopBar.tsx';
import { PwaInstallModal } from './components/PwaInstallModal.tsx';
import { TeamsAuthModal } from './components/TeamsAuthModal.tsx';
import { ProjectMembersModal } from './components/ProjectMembersModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { CreateTeamModal } from './components/CreateTeamModal.tsx';
import { TaskModal } from './components/TaskModal.tsx';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'tianlane_pm_state_v5';
const AUTH_STORAGE_KEY = 'tianlane_auth_user_v2';
const REDIRECT_STORAGE_KEY = 'tianlane_redirect_after_login_v1';
const DELETED_TEAMS_KEY = 'tianlane_deleted_team_ids_v1';

const getSavedAuthUser = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      localStorage.getItem(AUTH_STORAGE_KEY) ||
      sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
      return parsed as UserProfile;
    }
  } catch {
    return null;
  }
  return null;
};

const persistAuthUser = (user: UserProfile, rememberMe?: boolean) => {
  const serialized = JSON.stringify(user);
  if (rememberMe === true) {
    localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  } else if (rememberMe === false) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    // Preserve current storage location
    if (sessionStorage.getItem(AUTH_STORAGE_KEY)) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    }
  }
};

const clearAuthUser = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

const getDeletedTeamIds = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_TEAMS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = (JSON.parse(raw).projects ?? SEED_PROJECTS) as Project[];
        const mapped = parsed.map((p) => {
          if (p.code === 'PL071026' || p.code === '26-11' || p.id.includes('efms')) {
            return { ...p, team_id: 'team-efms' };
          }
          if (p.code === 'RND-01' || p.id.includes('rnd')) {
            return { ...p, team_id: 'team-rnd' };
          }
          if (!p.team_id) {
            return { ...p, team_id: 'team-control-tower' };
          }
          return p;
        });
        const existingIds = new Set(mapped.map((p) => p.id));
        const missingSeeds = SEED_PROJECTS.filter((p) => !existingIds.has(p.id));
        return [...mapped, ...missingSeeds];
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
        const parsed = (JSON.parse(raw).milestones ?? SEED_MILESTONES) as ProjectMilestone[];
        const existingIds = new Set(parsed.map((m) => m.id));
        const missingSeeds = SEED_MILESTONES.filter((m) => !existingIds.has(m.id));
        return [...parsed, ...missingSeeds];
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
        const parsed = (JSON.parse(raw).tasks ?? SEED_TASKS) as ProjectTask[];
        const existingIds = new Set(parsed.map((t) => t.id));
        const missingSeeds = SEED_TASKS.filter((t) => !existingIds.has(t.id));
        return [...parsed, ...missingSeeds];
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

  const [users, setUsers] = useState<UserProfile[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = (JSON.parse(raw).users ?? SEED_USERS) as UserProfile[];
        return parsed.map((u) => {
          const sanitized = { ...u };
          delete (sanitized as Record<string, unknown>).password;
          return sanitized;
        });
      } catch {
        return SEED_USERS;
      }
    }
    return SEED_USERS;
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const deletedIds = new Set(getDeletedTeamIds());
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = (JSON.parse(raw).teams ?? SEED_TEAMS) as Team[];
        const filtered = parsed.filter((t) => !deletedIds.has(t.id));
        const existingIds = new Set(filtered.map((t) => t.id));
        const missingSeeds = SEED_TEAMS.filter(
          (t) => !existingIds.has(t.id) && !deletedIds.has(t.id)
        );
        const combined = [...filtered, ...missingSeeds];
        // Deduplicate and merge any eFMS teams created by user with the primary eFMS team
        const efmsTeams = combined.filter(
          (t) =>
            t.id === 'team-efms' ||
            t.code === 'EFMS' ||
            t.name.trim().toLowerCase() === 'efms' ||
            t.name.startsWith('Tú Mai')
        );
        let finalTeams = combined;
        if (efmsTeams.length > 1) {
          const primary =
            efmsTeams.find((t) => t.id === 'team-efms') || efmsTeams[0];
          const allMemberIds = Array.from(
            new Set(efmsTeams.flatMap((t) => t.member_ids || []))
          );
          const allPmIds = Array.from(
            new Set(efmsTeams.flatMap((t) => t.pm_ids || []))
          );
          const mergedEfms: Team = {
            ...primary,
            id: 'team-efms',
            name: 'eFMS',
            code: 'EFMS',
            description:
              'Hệ thống quản lý giao nhận vận tải quốc tế & nội địa eFMS & eTMS',
            icon: '🚢',
            member_ids:
              allMemberIds.length > 0 ? allMemberIds : primary.member_ids,
            pm_ids: allPmIds.length > 0 ? allPmIds : primary.pm_ids,
          };
          const efmsIds = new Set(efmsTeams.map((t) => t.id));
          finalTeams = [
            mergedEfms,
            ...combined.filter((t) => !efmsIds.has(t.id)),
          ];
        }

        return finalTeams.map((t) => {
          if (
            t.id === 'team-efms' &&
            (t.name.startsWith('Tú Mai') || t.name === 'eFMS')
          ) {
            return {
              ...t,
              name: 'eFMS',
              description:
                'Hệ thống quản lý giao nhận vận tải quốc tế & nội địa eFMS & eTMS',
            };
          }
          return t;
        });
      } catch {
        return SEED_TEAMS.filter((t) => !deletedIds.has(t.id));
      }
    }
    return SEED_TEAMS.filter((t) => !deletedIds.has(t.id));
  });

  // Initial route parse from window.location (e.g. /project=16, ?project=16, /team)
  const initialRoute = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseRoute(
      window.location.pathname,
      window.location.search,
      window.location.hash,
      SEED_PROJECTS,
      SEED_TEAMS
    );
  }, []);

  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    if (initialRoute?.teamId) return initialRoute.teamId;
    return localStorage.getItem('tianlane_active_team') || SEED_TEAMS[0].id;
  });

  const [isUserProfileOpen, setIsUserProfileOpen] = useState<boolean>(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getSavedAuthUser();
  });

  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    return !getSavedAuthUser();
  });

  const [activeSection, setActiveSection] = useState<SidebarSection>(
    () => initialRoute?.section ?? 'projects'
  );
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => initialRoute?.projectId ?? projects[0]?.id ?? SEED_PROJECTS[0].id
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
    viewMode: initialRoute?.viewMode ?? 'timeline',
    groupByMilestone: true,
    ordering: 'manual',
    showBaseline: true,
    showEmptyColumns: true,
    properties: { ...DEFAULT_DISPLAY_PROPERTIES },
  });

  const [odooBaseUrl, setOdooBaseUrl] = useState<string>(DEFAULT_ODOO_BASE_URL);
  const [odooConfig, setOdooConfig] =
    useState<OdooConnectionConfig>(DEFAULT_ODOO_CONFIG);

  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [selectedMilestone, setSelectedMilestone] =
    useState<ProjectMilestone | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskModalMilestoneId, setTaskModalMilestoneId] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] =
    useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState<boolean>(false);
  const [isPwaGuideOpen, setIsPwaGuideOpen] = useState<boolean>(false);
  const [deferredPwaPrompt, setDeferredPwaPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [pendingInvite, setPendingInvite] = useState<{
    projectId: string;
    token: string;
    role: ProjectMemberRole;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const invToken = params.get('invite');
    const projId = params.get('project');
    const rawRole = params.get('role');
    if (invToken && projId) {
      const role: ProjectMemberRole =
        rawRole === 'owner' || rawRole === 'writer' || rawRole === 'viewer'
          ? rawRole
          : 'writer';
      return { projectId: projId, token: invToken, role };
    }
    return null;
  });

  const isCloudHydratedRef = useRef<boolean>(false);
  const skipNextCloudSaveRef = useRef<boolean>(false);

  // Redirect unauthenticated visitor from any deep link (e.g. /project=63) to clean homepage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const authed = getSavedAuthUser();
    if (!authed) {
      const fullPath =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      if (fullPath && fullPath !== '/') {
        try {
          sessionStorage.setItem(REDIRECT_STORAGE_KEY, fullPath);
        } catch {}
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  // Open Microsoft Teams SSO modal automatically if arriving via invite link while signed out
  useEffect(() => {
    if (pendingInvite && showLandingPage) {
      setIsAuthModalOpen(true);
    }
  }, [pendingInvite, showLandingPage]);

  // Select task from initial URL if specified (?task=...)
  useEffect(() => {
    if (initialRoute?.taskId && tasks.length > 0) {
      const found = tasks.find(
        (t) =>
          t.id === initialRoute.taskId ||
          String(t.odoo_task_id) === initialRoute.taskId ||
          t.code.toLowerCase() === initialRoute.taskId!.toLowerCase()
      );
      if (found) setSelectedTask(found);
    }
  }, [initialRoute, tasks]);

  // Hydrate multi-user workspace state from Neon PostgreSQL on startup
  useEffect(() => {
    let cancelled = false;
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/workspace`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const remote = data?.state;
        if (remote && Array.isArray(remote.projects) && remote.projects.length > 0) {
          skipNextCloudSaveRef.current = true;
          const deletedIds = new Set(getDeletedTeamIds());

          const projMap = new Map<string, Project>(
            (remote.projects as Project[]).map((p: Project) => [p.id, p])
          );
          for (const sp of SEED_PROJECTS) {
            if (!projMap.has(sp.id)) projMap.set(sp.id, sp);
          }
          setProjects(Array.from(projMap.values()));

          if (Array.isArray(remote.milestones)) {
            const msMap = new Map<string, ProjectMilestone>(
              (remote.milestones as ProjectMilestone[]).map(
                (m: ProjectMilestone) => [m.id, m]
              )
            );
            for (const sm of SEED_MILESTONES) {
              if (!msMap.has(sm.id)) msMap.set(sm.id, sm);
            }
            setMilestones(Array.from(msMap.values()));
          }
          if (Array.isArray(remote.tasks)) {
            const tMap = new Map<string, ProjectTask>(
              (remote.tasks as ProjectTask[]).map((t: ProjectTask) => [t.id, t])
            );
            for (const st of SEED_TASKS) {
              if (!tMap.has(st.id)) tMap.set(st.id, st);
            }
            setTasks(Array.from(tMap.values()));
          }
          if (Array.isArray(remote.documents)) setDocuments(remote.documents);
          if (Array.isArray(remote.docRequirements))
            setDocRequirements(remote.docRequirements);
          if (Array.isArray(remote.revisionLogs))
            setRevisionLogs(remote.revisionLogs);
          if (Array.isArray(remote.templates)) setTemplates(remote.templates);
          if (Array.isArray(remote.teams) && remote.teams.length > 0) {
            const teamMap = new Map<string, Team>(
              (remote.teams as Team[]).map((t: Team) => [t.id, t])
            );
            for (const st of SEED_TEAMS) {
              if (!teamMap.has(st.id) && !deletedIds.has(st.id)) {
                teamMap.set(st.id, st);
              }
            }
            const cleanedTeams: Team[] = Array.from(teamMap.values())
              .filter((t: Team) => !deletedIds.has(t.id))
              .map((t: Team) => {
                if (
                  t.id === 'team-efms' &&
                  (t.name.startsWith('Tú Mai') || t.name === 'eFMS')
                ) {
                  return {
                    ...t,
                    name: 'eFMS',
                    description:
                      'Hệ thống quản lý giao nhận vận tải quốc tế & nội địa eFMS & eTMS',
                  };
                }
                return t;
              });
            if (cleanedTeams.length > 0) setTeams(cleanedTeams);
          }
          if (Array.isArray(remote.users) && remote.users.length > 0) {
            const validEmails = new Set(
              SEED_USERS.map((u) => u.email.toLowerCase())
            );
            const cleanedUsers = remote.users.filter((u: UserProfile) =>
              validEmails.has(u.email?.toLowerCase())
            );
            setUsers(cleanedUsers.length >= 10 ? cleanedUsers : SEED_USERS);
          }
        }
        isCloudHydratedRef.current = true;
      })
      .catch(() => {
        isCloudHydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist to localStorage & sync to Neon PostgreSQL
  useEffect(() => {
    const statePayload = {
      projects,
      milestones,
      tasks,
      documents,
      docRequirements,
      revisionLogs,
      mcpLogs,
      templates,
      teams,
      users,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statePayload));

    if (!isCloudHydratedRef.current) return;
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const apiBase = getApiBaseUrl();
      fetch(`${apiBase}/api/workspace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: statePayload }),
      }).catch(() => {});
    }, 350);

    return () => clearTimeout(timer);
  }, [
    projects,
    milestones,
    tasks,
    documents,
    docRequirements,
    revisionLogs,
    mcpLogs,
    templates,
    teams,
    users,
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

  const accessibleTeams = useMemo(() => {
    return teams.filter((t) => canUserAccessTeam(t, currentUser));
  }, [teams, currentUser]);

  const activeTeam = useMemo(() => {
    const found = accessibleTeams.find((t) => t.id === activeTeamId);
    return found ?? accessibleTeams[0] ?? teams[0];
  }, [accessibleTeams, activeTeamId, teams]);

  const teamProjects = useMemo(() => {
    if (!activeTeam) return [];
    return projects.filter((p) => p.team_id === activeTeam.id);
  }, [projects, activeTeam]);

  const activeProject = useMemo(() => {
    return (
      teamProjects.find((p) => p.id === activeProjectId) ??
      teamProjects[0] ??
      null
    );
  }, [teamProjects, activeProjectId]);

  // Synchronize activeProjectId & activeTeamId across teams
  useEffect(() => {
    if (!activeProjectId) return;
    const target = projects.find((p) => p.id === activeProjectId);
    if (target && target.team_id !== activeTeamId) {
      setActiveTeamId(target.team_id);
      localStorage.setItem('tianlane_active_team', target.team_id);
    }
  }, [activeProjectId, projects, activeTeamId]);

  // Synchronize activeProjectId with activeTeam's projects
  useEffect(() => {
    if (teamProjects.length > 0) {
      if (!teamProjects.some((p) => p.id === activeProjectId)) {
        setActiveProjectId(teamProjects[0].id);
      }
    } else if (activeProjectId) {
      setActiveProjectId('');
    }
  }, [teamProjects, activeProjectId]);

  // Synchronize browser address bar with current workspace route
  useEffect(() => {
    if (typeof window === 'undefined' || showLandingPage) return;

    const targetUrl = buildRouteUrl({
      section: activeSection,
      project: activeProject,
      viewMode: displayState.viewMode,
      task: selectedTask,
    });

    const currentUrl =
      window.location.pathname + window.location.search + window.location.hash;

    if (decodeURIComponent(currentUrl) !== decodeURIComponent(targetUrl)) {
      window.history.pushState(
        { section: activeSection, projectId: activeProjectId },
        '',
        targetUrl
      );
    }
  }, [
    showLandingPage,
    activeSection,
    activeProject,
    activeProjectId,
    displayState.viewMode,
    selectedTask,
  ]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const parsed = parseRoute(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        projects,
        teams
      );
      if (parsed.section) setActiveSection(parsed.section);
      if (parsed.teamId) {
        setActiveTeamId(parsed.teamId);
        localStorage.setItem('tianlane_active_team', parsed.teamId);
      }
      if (parsed.projectId) {
        setActiveProjectId(parsed.projectId);
      }
      if (parsed.viewMode) {
        setDisplayState((prev) => ({ ...prev, viewMode: parsed.viewMode! }));
      }
      if (parsed.taskId) {
        const foundTask = tasks.find(
          (t) =>
            t.id === parsed.taskId ||
            String(t.odoo_task_id) === parsed.taskId ||
            t.code.toLowerCase() === parsed.taskId!.toLowerCase()
        );
        if (foundTask) setSelectedTask(foundTask);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects, teams, tasks]);

  const handleSelectProject = (projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (target && target.team_id !== activeTeamId) {
      setActiveTeamId(target.team_id);
      localStorage.setItem('tianlane_active_team', target.team_id);
    }
    setActiveProjectId(projectId);
    setActiveSection('projects');
  };

  const projectMilestones = useMemo(() => {
    if (!activeProject) return [];
    return milestones
      .filter((m) => m.project_id === activeProject.id)
      .sort((a, b) => a.order_index - b.order_index);
  }, [milestones, activeProject]);

  const projectTasks = useMemo(() => {
    if (!activeProject) return [];
    return tasks.filter((t) => t.project_id === activeProject.id);
  }, [tasks, activeProject]);

  const projectDocs = useMemo(() => {
    if (!activeProject) return [];
    return documents.filter((d) => d.project_id === activeProject.id);
  }, [documents, activeProject]);

  const projectDocRequirements = useMemo(() => {
    if (!activeProject) return [];
    return docRequirements.filter((r) => r.project_id === activeProject.id);
  }, [docRequirements, activeProject]);

  const projectRevisions = useMemo(() => {
    if (!activeProject) return [];
    return revisionLogs.filter((r) => r.project_id === activeProject.id);
  }, [revisionLogs, activeProject]);

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

  const requireWriteAccess = (): boolean => {
    if (!canUserEditProject(activeProject, currentUser)) {
      showToast(
        `[Viewer - Read-only]: You only have viewing permissions on project ${activeProject.code}. Contact an Owner to grant Writer (Edit) access.`
      );
      return false;
    }
    return true;
  };

  // Auto-join project when arriving via Invite Link (?project=...&invite=...&role=...)
  useEffect(() => {
    if (!pendingInvite || showLandingPage || !currentUser) return;
    const targetProj = projects.find(
      (p) =>
        p.id === pendingInvite.projectId ||
        p.share_token === pendingInvite.token
    );
    if (!targetProj) return;

    if (targetProj.share_token !== pendingInvite.token) {
      showToast('The project invite link is invalid or has expired.');
      setPendingInvite(null);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return;
    }

    const existingList = targetProj.members || [];
    const alreadyMember = existingList.find(
      (m) =>
        m.user_id === currentUser.id ||
        m.email.toLowerCase() === currentUser.email.toLowerCase()
    );

    const roleOrder: Record<ProjectMemberRole, number> = {
      viewer: 1,
      writer: 2,
      owner: 3,
    };

    let nextMembers = existingList;
    let grantedRole: ProjectMemberRole = pendingInvite.role;

    if (!alreadyMember) {
      nextMembers = [
        ...existingList,
        {
          user_id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.full_name,
          avatar_initials: currentUser.avatar_initials,
          role: pendingInvite.role,
          added_at: new Date().toISOString().slice(0, 10),
          added_by: 'Invite Link',
        },
      ];
    } else if (roleOrder[pendingInvite.role] > roleOrder[alreadyMember.role]) {
      nextMembers = existingList.map((m) =>
        m.email.toLowerCase() === currentUser.email.toLowerCase()
          ? { ...m, role: pendingInvite.role }
          : m
      );
    } else {
      grantedRole = alreadyMember.role;
    }

    setProjects((prev) =>
      prev.map((p) =>
        p.id === targetProj.id ? { ...p, members: nextMembers } : p
      )
    );
    setActiveProjectId(targetProj.id);
    setActiveSection('projects');
    setPendingInvite(null);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    showToast(
      `Joined project ${targetProj.code} · ${targetProj.name} with ${grantedRole.toUpperCase()} permissions!`
    );
  }, [pendingInvite, showLandingPage, projects, currentUser]);

  const handleAuthenticatedUser = (
    authedUser: UserProfile,
    rememberMe: boolean = true
  ) => {
    setCurrentUser(authedUser);
    persistAuthUser(authedUser, rememberMe);
    setUsers((prev) => {
      const exists = prev.some(
        (u) => u.email.toLowerCase() === authedUser.email.toLowerCase()
      );
      if (exists) {
        return prev.map((u) =>
          u.email.toLowerCase() === authedUser.email.toLowerCase()
            ? authedUser
            : u
        );
      }
      return [...prev, authedUser];
    });

    // Check if user previously tried to navigate to a deep link before logging in
    try {
      const savedRedirect = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
      if (savedRedirect) {
        sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
        const [pathAndSearch, hash] = savedRedirect.split('#');
        const [path, query] = pathAndSearch.split('?');
        const parsed = parseRoute(
          path || '/',
          query ? `?${query}` : '',
          hash ? `#${hash}` : '',
          projects,
          teams
        );
        if (parsed.projectId) setActiveProjectId(parsed.projectId);
        if (parsed.teamId) {
          setActiveTeamId(parsed.teamId);
          localStorage.setItem('tianlane_active_team', parsed.teamId);
        }
        if (parsed.section) setActiveSection(parsed.section);
        if (parsed.viewMode) {
          setDisplayState((prev) => ({ ...prev, viewMode: parsed.viewMode! }));
        }
        if (parsed.taskId) {
          const found = tasks.find(
            (t) =>
              t.id === parsed.taskId ||
              String(t.odoo_task_id) === parsed.taskId ||
              t.code.toLowerCase() === parsed.taskId!.toLowerCase()
          );
          if (found) setSelectedTask(found);
        }
      }
    } catch {}

    setShowLandingPage(false);
    showToast(
      `Signed in as ${authedUser.full_name} (${authedUser.email}).`
    );
  };

  const handleSignOut = () => {
    clearAuthUser();
    sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
    setCurrentUser(null);
    setShowLandingPage(true);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    showToast('Signed out successfully.');
  };

  const handleSelectTeam = (teamId: string) => {
    setActiveTeamId(teamId);
    const targetTeam = teams.find((t) => t.id === teamId);
    const projs = projects.filter((p) => p.team_id === teamId);
    if (projs.length > 0) {
      setActiveProjectId(projs[0].id);
    } else {
      setActiveProjectId('');
    }
    showToast(`Switched to ${targetTeam?.name || 'Team'}`);
  };

  const handleCreateTeam = (newTeam: Team) => {
    setTeams((prev) => [...prev, newTeam]);
    setActiveTeamId(newTeam.id);
    showToast(`Created team: ${newTeam.name} (${newTeam.code}).`);
  };

  const handleDeleteTeam = (teamId: string) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam) return;

    if (teams.length <= 1) {
      showToast('Cannot delete the last remaining team in workspace.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete team "${targetTeam.name}"?\nAll projects, milestones, and tasks under this team will also be deleted.`
    );
    if (!confirmed) return;

    const deletedIds = getDeletedTeamIds();
    if (!deletedIds.includes(teamId)) {
      localStorage.setItem(
        DELETED_TEAMS_KEY,
        JSON.stringify([...deletedIds, teamId])
      );
    }

    const projsToDelete = projects.filter((p) => p.team_id === teamId);
    const projIdsToDelete = new Set(projsToDelete.map((p) => p.id));

    const remainingTeams = teams.filter((t) => t.id !== teamId);
    setTeams(remainingTeams);
    setProjects((prev) => prev.filter((p) => p.team_id !== teamId));
    setMilestones((prev) =>
      prev.filter((m) => !projIdsToDelete.has(m.project_id))
    );
    setTasks((prev) => prev.filter((t) => !projIdsToDelete.has(t.project_id)));
    setDocuments((prev) =>
      prev.filter((d) => !projIdsToDelete.has(d.project_id))
    );
    setDocRequirements((prev) =>
      prev.filter((r) => !projIdsToDelete.has(r.project_id))
    );

    if (activeTeamId === teamId && remainingTeams.length > 0) {
      handleSelectTeam(remainingTeams[0].id);
    }

    showToast(`Deleted team "${targetTeam.name}".`);
  };

  const handleUpdateMemberRole = async (
    userId: string,
    newRole: UserProfile['role']
  ) => {
    const targetUser = users.find((u) => u.id === userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    if (currentUser?.id === userId) {
      const updated = { ...currentUser, role: newRole };
      setCurrentUser(updated);
      persistAuthUser(updated);
    }
    if (targetUser) {
      try {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/users/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetUser.email, role: newRole }),
        });
      } catch {
        // Fallback local update
      }
      showToast(
        `Updated position for ${targetUser.full_name} to ${newRole}.`
      );
    }
  };

  const handleSaveProfile = async (
    updatedUser: UserProfile,
    passwordHash?: string
  ) => {
    const userToSave: UserProfile = {
      ...updatedUser,
      password_hash: passwordHash ?? updatedUser.password_hash,
    };
    delete (userToSave as Record<string, unknown>).password;
    setCurrentUser(userToSave);
    persistAuthUser(userToSave);
    setUsers((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === userToSave.email.toLowerCase()
          ? userToSave
          : u
      )
    );
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/users/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userToSave.email,
          fullName: userToSave.full_name,
          avatarInitials: userToSave.avatar_initials,
          avatarUrl: userToSave.avatar_url,
          role: userToSave.role,
          password_hash: passwordHash,
        }),
      });
    } catch {
      // Local profile updated
    }
    showToast('Profile updated successfully.');
  };

  const handleUpdateProjectMembers = (
    projectId: string,
    nextMembers: ProjectMember[],
    newShareToken?: string,
    defaultInviteRole?: 'viewer' | 'writer'
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          members: nextMembers,
          share_token: newShareToken ?? p.share_token,
          invite_default_role: defaultInviteRole ?? p.invite_default_role,
        };
      })
    );
  };

  const handleUpdateMemberProjectRole = (
    targetUser: UserProfile,
    newRole: ProjectMemberRole
  ) => {
    if (!activeProject) return;
    const existingMembers = activeProject.members || [];
    const isAlready = existingMembers.some(
      (m) =>
        m.email.toLowerCase() === targetUser.email.toLowerCase() ||
        m.user_id === targetUser.id
    );
    let nextMembers: ProjectMember[];
    if (isAlready) {
      nextMembers = existingMembers.map((m) =>
        m.email.toLowerCase() === targetUser.email.toLowerCase() ||
        m.user_id === targetUser.id
          ? { ...m, role: newRole }
          : m
      );
    } else {
      nextMembers = [
        ...existingMembers,
        {
          user_id: targetUser.id,
          email: targetUser.email,
          full_name: targetUser.full_name,
          avatar_initials: targetUser.avatar_initials,
          role: newRole,
          added_at: new Date().toISOString().slice(0, 10),
          added_by: currentUser?.full_name || 'James Nhan',
        },
      ];
    }
    handleUpdateProjectMembers(activeProject.id, nextMembers);
    showToast(
      `Updated ${targetUser.full_name}'s access role to ${newRole.toUpperCase()} on project ${activeProject.code}.`
    );
  };

  const handleCreateNewAccount = async (
    newUser: UserProfile,
    assignTeamIds: string[]
  ) => {
    setUsers((prev) => [...prev, newUser]);
    if (assignTeamIds.length > 0) {
      setTeams((prev) =>
        prev.map((t) =>
          assignTeamIds.includes(t.id) && !t.member_ids?.includes(newUser.id)
            ? { ...t, member_ids: [...(t.member_ids || []), newUser.id] }
            : t
        )
      );
    }
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/users/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
          password_hash: newUser.password_hash,
        }),
      });
    } catch {
      // Local profile saved
    }
    showToast(`Created account for ${newUser.full_name} (${newUser.email}).`);
  };

  const handleRegisterNewDirectoryUser = (newUser: UserProfile) => {
    setUsers((prev) => {
      if (
        prev.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase())
      ) {
        return prev;
      }
      return [...prev, newUser];
    });
  };

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
    if (!requireWriteAccess()) return;
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
    if (!requireWriteAccess()) return;
    const nextTasks = tasks.map((t) => (t.id === updated.id ? updated : t));
    setTasks(nextTasks);
    syncMilestoneProgress(nextTasks, updated.milestone_id);
    setSelectedTask(updated);
  };

  const handleOpenCreateTask = (defaultMsId?: string) => {
    if (!requireWriteAccess()) return;
    setEditingTask(null);
    setTaskModalMilestoneId(defaultMsId);
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: ProjectTask, defaultMsId?: string) => {
    if (!requireWriteAccess()) return;
    setEditingTask(task);
    setTaskModalMilestoneId(defaultMsId ?? task.milestone_id);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (savedTask: ProjectTask) => {
    if (!requireWriteAccess()) return;
    const exists = tasks.some((t) => t.id === savedTask.id);
    const nextTasks = exists
      ? tasks.map((t) => (t.id === savedTask.id ? savedTask : t))
      : [...tasks, savedTask];

    setTasks(nextTasks);
    syncMilestoneProgress(nextTasks, savedTask.milestone_id);
    if (selectedTask?.id === savedTask.id) {
      setSelectedTask(savedTask);
    }
    showToast(
      exists
        ? `Updated task ${savedTask.code}: ${savedTask.title}.`
        : `Created task ${savedTask.code}: ${savedTask.title}.`
    );
  };

  const handleDeleteTask = (taskId: string) => {
    if (!requireWriteAccess()) return;
    const target = tasks.find((t) => t.id === taskId);
    const nextTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(nextTasks);
    if (target) {
      syncMilestoneProgress(nextTasks, target.milestone_id);
    }
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    showToast(`Deleted task ${target?.code ?? ''}.`);
  };

  const handleResetUserPassword = async (targetUser: UserProfile) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.email.toLowerCase() === targetUser.email.toLowerCase()
          ? { ...u, password_hash: undefined }
          : u
      )
    );
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/users/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetUser.email,
          resetPassword: true,
        }),
      });
    } catch {
      // Local state updated
    }
  };

  const handleShiftMilestoneEnd = (milestoneId: string, deltaDays: number) => {
    if (!requireWriteAccess()) return;
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
        author_name: currentUser?.full_name || 'James Nhan',
        created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      setRevisionLogs((prev) => [revEntry, ...prev]);
    }
    showToast(`Updated ${ms.code} end date: ${previousEnd} → ${newEnd}.`);
  };

  const handleShiftTaskEnd = (taskId: string, deltaDays: number) => {
    if (!requireWriteAccess()) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newEnd = addDaysISO(task.actual_end, deltaDays);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, actual_end: newEnd } : t))
    );
  };

  const handleUpdateMilestoneIcon = (milestoneId: string, icon: string) => {
    if (!requireWriteAccess()) return;
    setMilestones((prev) =>
      prev.map((m) => (m.id === milestoneId ? { ...m, icon } : m))
    );
    showToast(`Updated milestone icon to ${icon}.`);
  };

  const handleToggleMilestoneClosed = (milestoneId: string) => {
    if (!requireWriteAccess()) return;
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId ? { ...m, is_closed: !m.is_closed } : m
      )
    );
  };

  const handleCommitBaseline = () => {
    if (!requireWriteAccess()) return;
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
    if (!requireWriteAccess()) return;
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
      assignee_id: currentUser?.id || users[0].id,
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
    avatarUrl?: string;
    teamId?: string;
  }) => {
    const assignedTeamId = payload.teamId || activeTeam?.id || 'team-efms';
    const result = instantiateProjectFromTemplateEngine({
      template: payload.template,
      projectName: payload.projectName,
      projectCode: payload.projectCode,
      clientOrUnit: payload.clientOrUnit,
      startDateISO: payload.startDateISO,
      odooProjectId: payload.odooProjectId,
      odooBaseUrl,
      ownerId: currentUser?.id || 'usr-po-01',
      users,
      teamId: assignedTeamId,
    });

    result.project.team_id = assignedTeamId;

    if (payload.avatarUrl) {
      result.project.avatar_url = payload.avatarUrl;
    }

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
    if (!requireWriteAccess()) return;
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
    if (target && !isProjectCreator(target, currentUser)) {
      showToast(
        'Only the project creator (Creator Owner) has permission to delete this project.'
      );
      return;
    }
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
    if (!requireWriteAccess()) return;
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
    if (!requireWriteAccess()) return;
    setDocRequirements((prev) => prev.filter((r) => r.id !== reqId));
    showToast('Removed document requirement.');
  };

  const handleDeleteDocument = (docId: string) => {
    if (!requireWriteAccess()) return;
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    showToast('Removed uploaded file.');
  };

  const handleTestOdooConnection = async (): Promise<{
    connected: boolean;
    message: string;
  }> => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/odoo/test`, {
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
    if (!requireWriteAccess()) {
      return { createdCount: 0, summary: 'Read-only access (Viewer).' };
    }
    const unlinked = projectTasks.filter((t) => !t.odoo_task_id);
    if (unlinked.length === 0) {
      const summary = `All ${projectTasks.length} tasks are already linked to Execution Tracker Project #${activeProject.odoo_project_id}.`;
      showToast(summary);
      return { createdCount: 0, summary };
    }

    if (odooConfig.apiKey.trim()) {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/odoo/generate`, {
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
              tags?: string[];
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
                tags: hit.tags || ['AI-created'],
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
          tags: t.tags?.length ? t.tags : ['AI-created'],
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
    if (!requireWriteAccess()) {
      return { updatedCount: 0, summary: 'Read-only access (Viewer).' };
    }
    const nowIso = new Date().toISOString();

    if (odooConfig.apiKey.trim()) {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/odoo/sync`, {
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
              tags?: string[];
              odoo_users?: {
                assignees?: { id: number; name: string; login: string; email?: string }[];
                developers?: { id: number; name: string; login: string; email?: string }[];
                qcs?: { id: number; name: string; login: string; email?: string }[];
              };
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

            let nextAssigneeIds = t.assignee_ids ? [...t.assignee_ids] : [t.assignee_id];
            let nextAssigneeRoles = t.assignee_roles ? [...t.assignee_roles] : [];

            if (live.odoo_users) {
              const matchedAssignees: { user_id: string; role: TaskRoleType }[] = [];
              const findTianlaneUser = (ou: { name?: string; login?: string; email?: string }) => {
                const login = (ou.login || '').trim().toLowerCase();
                const email = (ou.email || '').trim().toLowerCase();
                const name = (ou.name || '').trim().toLowerCase();
                return users.find((u) => {
                  const uEmail = u.email.toLowerCase();
                  const uName = u.full_name.toLowerCase();
                  return (
                    uEmail === email ||
                    uEmail === login ||
                    uEmail.startsWith(`${login}@`) ||
                    u.id.toLowerCase().includes(login) ||
                    uName === name
                  );
                });
              };

              // Map Developers
              for (const ou of live.odoo_users.developers || []) {
                const tu = findTianlaneUser(ou);
                if (tu && !matchedAssignees.some((m) => m.user_id === tu.id)) {
                  matchedAssignees.push({ user_id: tu.id, role: 'Developer' });
                }
              }

              // Map QCs
              for (const ou of live.odoo_users.qcs || []) {
                const tu = findTianlaneUser(ou);
                if (tu && !matchedAssignees.some((m) => m.user_id === tu.id)) {
                  matchedAssignees.push({ user_id: tu.id, role: 'QC' });
                }
              }

              // Map Assignees / BA
              for (const ou of live.odoo_users.assignees || []) {
                const tu = findTianlaneUser(ou);
                if (tu && !matchedAssignees.some((m) => m.user_id === tu.id)) {
                  const isBa =
                    tu.role.includes('Owner') ||
                    tu.role.includes('PO') ||
                    tu.role.includes('Analyst') ||
                    tu.role.includes('Lead');
                  matchedAssignees.push({
                    user_id: tu.id,
                    role: isBa ? 'BA' : 'Assignee',
                  });
                }
              }

              if (matchedAssignees.length > 0) {
                nextAssigneeIds = matchedAssignees.map((m) => m.user_id);
                nextAssigneeRoles = matchedAssignees;
              }
            }

            return {
              ...t,
              kanban_status: live.kanban_status,
              is_completed: live.kanban_status === 'done',
              odoo_stage_name: live.odoo_stage_name,
              effective_hours: live.effective_hours || t.effective_hours,
              odoo_task_url: live.odoo_task_url || t.odoo_task_url,
              tags: live.tags?.length ? live.tags : t.tags,
              assignee_id: nextAssigneeIds[0] || t.assignee_id,
              assignee_ids: nextAssigneeIds,
              assignee_roles: nextAssigneeRoles,
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
    setUsers(SEED_USERS);
    setActiveProjectId(SEED_PROJECTS[0].id);
    showToast('Restored default demo data.');
  };

  const inboxBadgeCount = tasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  ).length;

  const invitedProjInfo = pendingInvite
    ? projects.find(
        (p) =>
          p.id === pendingInvite.projectId ||
          p.share_token === pendingInvite.token
      )
    : undefined;

  return (
    <>
      {showLandingPage || !currentUser ? (
        <LandingPage
          users={users}
          onSignInWithTeams={() => {
            setIsAuthModalOpen(true);
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
            activeProjectId={activeProject ? activeProject.id : ''}
            onSelectProject={handleSelectProject}
            teams={teams}
            activeTeamId={activeTeamId}
            onSelectTeam={handleSelectTeam}
            onOpenCreateTeam={() => setIsCreateTeamOpen(true)}
            onDeleteTeam={handleDeleteTeam}
            workspaceOpen={workspaceOpen}
            onToggleWorkspace={() => setWorkspaceOpen((v) => !v)}
            teamsOpen={teamsOpen}
            onToggleTeams={() => setTeamsOpen((v) => !v)}
            inboxBadgeCount={inboxBadgeCount}
            filesCount={projectDocs.length}
            currentUser={currentUser}
            totalTeamMembers={users.length}
            onBackToLanding={() => setShowLandingPage(true)}
            onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
            onOpenEditProject={(projId) => {
              setActiveProjectId(projId);
              setIsEditProjectModalOpen(true);
            }}
            onOpenUserProfile={() => setIsUserProfileOpen(true)}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onSignOut={handleSignOut}
            onResetDemo={handleResetDemo}
          />

          {/* MAIN WORKSPACE */}
          <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Extracted Modular Top Bar */}
            <ProjectTopBar
              activeSection={activeSection}
              activeProject={activeProject}
              activeTeam={activeTeam}
              currentUser={currentUser}
              filterState={filterState}
              onChangeFilter={setFilterState}
              displayState={displayState}
              onChangeDisplay={setDisplayState}
              milestones={projectMilestones}
              users={users}
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
              onOpenMembersModal={() => setIsMembersModalOpen(true)}
              onOpenCreateTask={() => handleOpenCreateTask()}
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
                  users={users}
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
                  users={users}
                  tasks={tasks}
                  currentUser={currentUser}
                  activeProject={activeProject}
                  activeTeam={activeTeam}
                  onFilterByMember={(userId) => {
                    setFilterState((prev) => ({ ...prev, assigneeId: userId }));
                    setActiveSection('projects');
                  }}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onUpdateProjectMemberRole={handleUpdateMemberProjectRole}
                  onOpenCreateTeam={() => setIsCreateTeamOpen(true)}
                  onDeleteTeam={handleDeleteTeam}
                  onOpenMembersModal={() => setIsMembersModalOpen(true)}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  onOpenUserProfile={() => setIsUserProfileOpen(true)}
                />
              )}

              {activeSection === 'accounts' && (
                <AccountManagementView
                  users={users}
                  teams={teams}
                  currentUser={currentUser}
                  onResetPassword={handleResetUserPassword}
                  onUpdateUserRole={handleUpdateMemberRole}
                  onSelectUserLogin={handleAuthenticatedUser}
                  onOpenUserProfile={() => setIsUserProfileOpen(true)}
                  onCreateAccount={handleCreateNewAccount}
                />
              )}

              {activeSection === 'files' && (
                <ProjectFilesView
                  projects={teamProjects}
                  activeProject={activeProject}
                  onSelectProject={handleSelectProject}
                  milestones={projectMilestones}
                  tasks={projectTasks}
                  documents={documents}
                  docRequirements={docRequirements}
                  currentUser={currentUser}
                  referenceTodayISO={REFERENCE_TODAY_ISO}
                  onAddDocument={(doc) => {
                    if (!requireWriteAccess()) return;
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
                !activeProject ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto my-16 bg-white border border-[#E6E8EE] rounded-2xl shadow-clean-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF3FB] text-[#0A4595] flex items-center justify-center text-[24px] mb-3">
                      {activeTeam?.icon || '🏢'}
                    </div>
                    <h3 className="text-[17px] font-semibold text-[#121317]">
                      No projects in {activeTeam?.name || 'this team'}
                    </h3>
                    <p className="text-[13px] text-[#6E717A] mt-1 mb-5">
                      This team currently has no projects. Add a new project from a template or select another team.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[13px] font-medium transition-colors shadow-clean-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Project</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {displayState.viewMode === 'timeline' && (
                      <TimelineView
                        project={activeProject}
                        milestones={filteredMilestones}
                        tasks={filteredTasks}
                        users={users}
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
                        onAddTaskToMilestone={(msId) => handleOpenCreateTask(msId)}
                      />
                    )}

                    {displayState.viewMode === 'board' && (
                      <KanbanView
                        milestones={filteredMilestones}
                        tasks={filteredTasks}
                        users={users}
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
                )
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
        users={users}
        documents={projectDocs}
        odooBaseUrl={odooBaseUrl}
        currentUser={currentUser}
        onClose={() => {
          setSelectedTask(null);
          setSelectedMilestone(null);
        }}
        onUpdateTask={handleUpdateTask}
        onToggleMilestoneClosed={handleToggleMilestoneClosed}
        onOpenTaskModal={(t, msId) =>
          t ? handleOpenEditTask(t, msId) : handleOpenCreateTask(msId)
        }
        onAddDocument={(doc) => {
          if (!requireWriteAccess()) return;
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
        teams={accessibleTeams}
        activeTeamId={activeTeam?.id || 'team-efms'}
        users={users}
        currentUser={currentUser}
        referenceTodayISO={REFERENCE_TODAY_ISO}
        onClose={() => setIsTemplateModalOpen(false)}
        onInstantiate={handleInstantiateFromTemplate}
      />

      {/* Edit / Delete Project Modal */}
      {activeProject && (
        <ProjectEditModal
          isOpen={isEditProjectModalOpen}
          project={activeProject}
          milestones={projectMilestones}
          teams={accessibleTeams}
          totalProjectsCount={projects.length}
          odooBaseUrl={odooBaseUrl}
          canDeleteProject={isProjectCreator(activeProject, currentUser)}
          onClose={() => setIsEditProjectModalOpen(false)}
          onSaveProject={handleSaveProject}
          onDeleteProject={handleDeleteProject}
        />
      )}

      {/* Project Share, Invite Link & Role Permissions Modal */}
      {activeProject && (
        <ProjectMembersModal
          isOpen={isMembersModalOpen}
          project={activeProject}
          currentUser={currentUser}
          directoryUsers={users}
          onClose={() => setIsMembersModalOpen(false)}
          onUpdateProjectMembers={handleUpdateProjectMembers}
          onRegisterNewDirectoryUser={handleRegisterNewDirectoryUser}
        />
      )}

      {/* Create / Edit Project Task Modal */}
      {activeProject && (
        <TaskModal
          isOpen={isTaskModalOpen}
          task={editingTask}
          defaultMilestoneId={taskModalMilestoneId}
          project={activeProject}
          milestones={projectMilestones}
          users={users}
          existingTasks={projectTasks}
          odooBaseUrl={odooBaseUrl}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Microsoft Teams (@logtechub.com) SSO Modal */}
      <TeamsAuthModal
        isOpen={isAuthModalOpen}
        users={users}
        currentUser={currentUser}
        pendingInvite={
          pendingInvite
            ? {
                ...pendingInvite,
                projectName: invitedProjInfo?.name,
                projectCode: invitedProjInfo?.code,
              }
            : null
        }
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticatedUser}
      />

      {/* Edit Profile & Password Modal */}
      <UserProfileModal
        isOpen={isUserProfileOpen}
        currentUser={currentUser}
        onClose={() => setIsUserProfileOpen(false)}
        onSave={handleSaveProfile}
      />

      {/* Create Team Modal (Admin) */}
      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        users={users}
        currentUser={currentUser}
        onClose={() => setIsCreateTeamOpen(false)}
        onCreateTeam={handleCreateTeam}
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
