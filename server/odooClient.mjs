/**
 * TIANLANE — LIVE ODOO JSON-RPC CLIENT
 * Default profile aligned with Logistics TechHub (https://support.logtechub.com, DB: bitnami_odoo, login: james.nhan)
 */

export const DEFAULT_ODOO_CONNECTION = {
  url: process.env.ODOO_URL || 'https://support.logtechub.com',
  db: process.env.ODOO_DB || 'bitnami_odoo',
  username: process.env.ODOO_USERNAME || 'james.nhan',
  apiKey: process.env.ODOO_API_KEY || '',
  companyId: Number(process.env.ODOO_COMPANY_ID || 1),
  companyName: 'Logistics TechHub',
};

export function normalizeOdooUrl(rawUrl) {
  return String(rawUrl || DEFAULT_ODOO_CONNECTION.url)
    .trim()
    .replace(/\/+$/, '');
}

/**
 * Maps real Odoo stage names (including Logistics TechHub stages like
 * "Sprint Backlog", "Sprint in Progress", "Sprint Complete", "Doing", "Finalize",
 * "Ready to Deploy", "Deployed in Production") to Tianlane's 5 Kanban columns.
 */
export function mapOdooStageToKanbanStatus(stageName) {
  const s = String(stageName || '').trim().toLowerCase();
  if (!s) return 'todo';
  if (
    s.includes('done') ||
    s.includes('complete') ||
    s.includes('deployed') ||
    s.includes('finalize') ||
    s.includes('closed') ||
    s.includes('cancel')
  ) {
    return 'done';
  }
  if (
    s.includes('review') ||
    s.includes('qa') ||
    s.includes('test') ||
    s.includes('ready to deploy') ||
    s.includes('uat') ||
    s.includes('verify')
  ) {
    return 'review';
  }
  if (
    s.includes('progress') ||
    s.includes('proccess') ||
    s.includes('doing') ||
    s.includes('process') ||
    s.includes('begin')
  ) {
    return 'in_progress';
  }
  if (s === 'backlog' || s.includes('brainstorm') || s.includes('inbox')) {
    return 'backlog';
  }
  return 'todo';
}

export function mapKanbanStatusToOdooStageLabel(status) {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'todo':
      return 'Sprint Backlog';
    case 'in_progress':
      return 'Sprint in Progress';
    case 'review':
      return 'Ready to Deploy';
    case 'done':
      return 'Sprint Complete';
    default:
      return 'Sprint Backlog';
  }
}

async function odooJsonRpc(baseUrl, service, method, args) {
  const endpoint = `${normalizeOdooUrl(baseUrl)}/jsonrpc`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP ${response.status} from ${endpoint}`);
  }

  const payload = await response.json();
  if (payload.error) {
    const msg =
      payload.error?.data?.message ||
      payload.error?.message ||
      'Odoo JSON-RPC error';
    throw new Error(msg);
  }
  return payload.result;
}

export async function authenticateOdoo(conn = {}) {
  const url = normalizeOdooUrl(conn.url || DEFAULT_ODOO_CONNECTION.url);
  const db = (conn.db || DEFAULT_ODOO_CONNECTION.db).trim();
  const username = (conn.username || DEFAULT_ODOO_CONNECTION.username).trim();
  const apiKey = (conn.apiKey || DEFAULT_ODOO_CONNECTION.apiKey).trim();

  if (!apiKey) {
    throw new Error(
      'Missing Odoo API Key. Enter your Odoo API Key in Agent -> MCP Config or set ODOO_API_KEY in .env.'
    );
  }

  const uid = await odooJsonRpc(url, 'common', 'authenticate', [
    db,
    username,
    apiKey,
    {},
  ]);

  if (!uid || typeof uid !== 'number') {
    throw new Error(
      `Authentication failed for ${username} on ${url} (DB: ${db}). Verify your Odoo API Key.`
    );
  }

  return { uid, url, db, username, apiKey };
}

export async function executeKw(session, model, method, args = [], kwargs = {}) {
  return odooJsonRpc(session.url, 'object', 'execute_kw', [
    session.db,
    session.uid,
    session.apiKey,
    model,
    method,
    args,
    kwargs,
  ]);
}

/**
 * Verifies connection to Odoo and returns active project.project list.
 */
export async function testOdooConnection(conn = {}) {
  const session = await authenticateOdoo(conn);
  const projects = await executeKw(
    session,
    'project.project',
    'search_read',
    [[['active', '=', true]]],
    {
      fields: ['id', 'name', 'company_id'],
      limit: 25,
      order: 'id asc',
    }
  );

  return {
    connected: true,
    uid: session.uid,
    url: session.url,
    db: session.db,
    username: session.username,
    projects: Array.isArray(projects)
      ? projects.map((p) => ({
          id: p.id,
          name: p.name,
          company: Array.isArray(p.company_id) ? p.company_id[1] : 'Logistics TechHub',
        }))
      : [],
  };
}

/**
 * Batch creates unlinked Tianlane tasks into Odoo `project.task` and returns new IDs & URLs.
 * Automatically attaches the 'AI-created' tag (Tag ID 57 on Logistics TechHub).
 */
export async function batchCreateOdooTasks(
  conn = {},
  { odooProjectId, tasks = [] }
) {
  const session = await authenticateOdoo(conn);
  const unlinked = tasks.filter((t) => !t.odoo_task_id);
  const created = [];

  // Resolve or look up 'AI-created' tag ID (default 57 on support.logtechub.com)
  let aiTagId = 57;
  try {
    const foundTags = await executeKw(session, 'project.tags', 'search_read', [
      [['name', '=', 'AI-created']],
      ['id', 'name'],
    ]);
    if (foundTags && foundTags.length > 0) {
      aiTagId = Number(foundTags[0].id);
    } else {
      const newTagId = await executeKw(session, 'project.tags', 'create', [
        { name: 'AI-created', color: 11 },
      ]);
      if (newTagId) aiTagId = Number(newTagId);
    }
  } catch (err) {
    console.warn('[OdooClient] Tag search error, fallback to 57:', err?.message || err);
  }

  for (const task of unlinked) {
    const newId = await executeKw(session, 'project.task', 'create', [
      {
        name: task.title,
        project_id: Number(odooProjectId),
        description: task.description || `Created by Tianlane PO Governance (${task.code})`,
        date_deadline: task.actual_end || task.due_date || false,
        priority: task.priority === 'high' ? '1' : '0',
        tag_ids: [[4, aiTagId, 0]],
      },
    ]);

    created.push({
      task_id: task.id,
      code: task.code,
      odoo_task_id: Number(newId),
      odoo_task_url: `${session.url}/web#id=${newId}&model=project.task&view_type=form`,
      odoo_stage_name: 'Backlog',
      tags: ['AI-created'],
    });
  }

  return {
    createdCount: created.length,
    created,
  };
}

/**
 * Syncs task statuses between Odoo `project.task` and Tianlane.
 */
export async function syncOdooTasks(
  conn = {},
  { odooProjectId, tasks = [], direction = 'odoo_to_app' }
) {
  const session = await authenticateOdoo(conn);
  const linkedIds = tasks
    .map((t) => Number(t.odoo_task_id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const domain =
    linkedIds.length > 0
      ? [
          '|',
          ['id', 'in', linkedIds],
          ['project_id', '=', Number(odooProjectId)],
        ]
      : [['project_id', '=', Number(odooProjectId)]];

  const odooRecords = await executeKw(
    session,
    'project.task',
    'search_read',
    [domain],
    {
      fields: [
        'id',
        'name',
        'stage_id',
        'date_deadline',
        'priority',
        'kanban_state',
        'total_hours_spent',
        'tag_ids',
      ],
      limit: 100,
      order: 'id desc',
    }
  );

  const byId = new Map();
  for (const rec of odooRecords || []) {
    const stageName = Array.isArray(rec.stage_id) ? rec.stage_id[1] : 'Backlog';
    const isAiCreated =
      Array.isArray(rec.tag_ids) && rec.tag_ids.includes(57);
    byId.set(Number(rec.id), {
      odoo_task_id: Number(rec.id),
      title: rec.name,
      odoo_stage_name: stageName,
      kanban_status: mapOdooStageToKanbanStatus(stageName),
      effective_hours: Number(rec.total_hours_spent || 0),
      due_date: typeof rec.date_deadline === 'string' ? rec.date_deadline : null,
      odoo_task_url: `${session.url}/web#id=${rec.id}&model=project.task&view_type=form`,
      tags: isAiCreated ? ['AI-created'] : [],
    });
  }

  return {
    direction,
    syncedAt: new Date().toISOString(),
    records: [...byId.values()],
  };
}
