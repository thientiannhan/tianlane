import type { Project, Team, ProjectTask } from '../types.ts';
import type { SidebarSection } from '../components/Sidebar.tsx';

export type ViewMode = 'timeline' | 'board' | 'list';

export interface ParsedRoute {
  section: SidebarSection;
  projectId?: string;
  teamId?: string;
  viewMode?: ViewMode;
  taskId?: string;
  rawProjectKey?: string;
  isInvite?: boolean;
  isCanceledOrNotFound?: boolean;
}

/**
 * Parses current location (pathname, query params, hash) into Tianlane workspace state.
 * Supports /project=16, /project/16, ?project=16, /team, /agent, /files, /settings, etc.
 */
export function parseRoute(
  pathname: string,
  search: string,
  hash: string,
  projects: Project[],
  teams: Team[]
): ParsedRoute {
  const decodedPath = decodeURIComponent(pathname || '/');
  const searchParams = new URLSearchParams(search || '');
  const decodedHash = decodeURIComponent(hash || '');

  // 1. Check sections in pathname or search
  let section: SidebarSection = 'projects';
  if (decodedPath.startsWith('/inbox') || searchParams.get('section') === 'inbox') {
    section = 'inbox';
  } else if (decodedPath.startsWith('/agent') || searchParams.get('section') === 'agent') {
    section = 'agent';
  } else if (decodedPath.startsWith('/team') || searchParams.get('section') === 'team') {
    section = 'team';
  } else if (decodedPath.startsWith('/settings') || searchParams.get('section') === 'settings') {
    section = 'settings';
  } else if (decodedPath.startsWith('/accounts') || searchParams.get('section') === 'accounts') {
    section = 'accounts';
  } else if (
    decodedPath.startsWith('/files') ||
    decodedPath.endsWith('/files') ||
    searchParams.get('section') === 'files'
  ) {
    section = 'files';
  }

  // 2. Extract project key:
  // Examples:
  //   /project=16
  //   /project/16
  //   ?project=16
  //   #project=16
  let rawProjectKey: string | undefined;

  const matchEq = decodedPath.match(/\/projects?=([^/?#&]+)/i);
  const matchSlash = decodedPath.match(/\/projects?\/([^/?#&]+)/i);
  const queryProj = searchParams.get('project');
  const hashMatch = decodedHash.match(/projects?[=/]([^/?#&]+)/i);

  if (matchEq && matchEq[1] && matchEq[1] !== 'files') {
    rawProjectKey = matchEq[1];
  } else if (matchSlash && matchSlash[1] && matchSlash[1] !== 'files') {
    rawProjectKey = matchSlash[1];
  } else if (queryProj) {
    rawProjectKey = queryProj;
  } else if (hashMatch && hashMatch[1]) {
    rawProjectKey = hashMatch[1];
  }

  // 3. Match against loaded projects
  let matchedProject: Project | undefined;
  let isCanceledOrNotFound = false;

  if (rawProjectKey) {
    const numKey = Number(rawProjectKey);
    const isNum = Number.isFinite(numKey) && !isNaN(numKey);
    const lowerKey = rawProjectKey.toLowerCase();

    matchedProject = projects.find((p) => {
      if (isNum && p.odoo_project_id === numKey) return true;
      if (p.id.toLowerCase() === lowerKey) return true;
      if (p.code.toLowerCase() === lowerKey) return true;
      if (p.share_token && p.share_token.toLowerCase() === lowerKey) return true;
      return false;
    });

    if (!matchedProject || matchedProject.status === 'canceled') {
      section = 'inbox';
      isCanceledOrNotFound = true;
      matchedProject = undefined;
    }
  }

  // If a team is matched directly or via project
  let teamId = matchedProject?.team_id;
  const queryTeam = searchParams.get('team');
  if (!teamId && queryTeam) {
    const matchedTeam = teams.find(
      (t) => t.id === queryTeam || t.code.toLowerCase() === queryTeam.toLowerCase()
    );
    if (matchedTeam) {
      if (matchedTeam.status === 'canceled') {
        section = 'inbox';
        isCanceledOrNotFound = true;
      } else {
        teamId = matchedTeam.id;
      }
    }
  }

  // 4. View mode
  let viewMode: ViewMode | undefined;
  const rawView =
    searchParams.get('view') ||
    (decodedPath.includes('/board')
      ? 'board'
      : decodedPath.includes('/list')
      ? 'list'
      : decodedPath.includes('/timeline')
      ? 'timeline'
      : undefined);

  if (rawView === 'timeline' || rawView === 'board' || rawView === 'list') {
    viewMode = rawView;
  }

  // 5. Task ID
  const taskId = searchParams.get('task') || undefined;
  const isInvite = Boolean(searchParams.get('invite'));

  return {
    section,
    projectId: matchedProject?.id,
    teamId,
    viewMode,
    taskId,
    rawProjectKey,
    isInvite,
    isCanceledOrNotFound,
  };
}

/**
 * Builds standard Tianlane deep link URL.
 * Example for project 16: /project=16
 */
export function buildRouteUrl(options: {
  section: SidebarSection;
  project?: Project | null;
  viewMode?: ViewMode;
  task?: ProjectTask | null;
}): string {
  const { section, project, viewMode, task } = options;

  if (project?.status === 'canceled') {
    return '/inbox';
  }

  if (section === 'projects' || (section === 'files' && project)) {
    const projKey = project
      ? (project.odoo_project_id ? String(project.odoo_project_id) : (project.code || project.id))
      : '';

    let url = projKey ? `/project=${projKey}` : '/';

    if (section === 'files') {
      url += '/files';
    } else {
      const params = new URLSearchParams();
      if (viewMode && viewMode !== 'timeline') {
        params.set('view', viewMode);
      }
      if (task) {
        params.set('task', String(task.odoo_task_id || task.code || task.id));
      }
      const qs = params.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }
    return url;
  }

  if (section === 'team') return '/team';
  if (section === 'agent') return '/agent';
  if (section === 'settings') return '/settings';
  if (section === 'accounts') return '/accounts';
  if (section === 'inbox') return '/inbox';
  if (section === 'files') return '/files';

  return '/';
}
