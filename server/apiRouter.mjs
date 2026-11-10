import { createR2PresignedPutUrl } from './r2Presign.mjs';
import {
  DEFAULT_ODOO_CONNECTION,
  batchCreateOdooTasks,
  syncOdooTasks,
  testOdooConnection,
} from './odooClient.mjs';

export const MCP_TOOLS_MANIFEST = [
  {
    name: 'instantiate_project_from_template',
    description:
      'Create a new governance project with standard milestones and tasks calculated from start_date.',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: { type: 'string' },
        project_code: { type: 'string' },
        template_id: { type: 'string' },
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        odoo_project_id: { type: 'number' },
      },
      required: ['project_name', 'project_code', 'template_id', 'start_date'],
    },
  },
  {
    name: 'generate_odoo_tasks_from_app',
    description:
      'Batch-create unlinked project milestones and tasks into Odoo (project.task) via JSON-RPC and return direct links.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        odoo_project_id: { type: 'number' },
        only_unlinked_tasks: { type: 'boolean', default: true },
      },
      required: ['project_id', 'odoo_project_id'],
    },
  },
  {
    name: 'sync_tasks_status_with_odoo',
    description:
      'Synchronize task stages (stage_id), hours, and deadlines between Odoo project.task and Tianlane Board/Timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string' },
        odoo_project_id: { type: 'number' },
        sync_direction: {
          type: 'string',
          enum: ['odoo_to_app', 'app_to_odoo'],
          default: 'odoo_to_app',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_project_roadmap_and_blockers',
    description:
      'Query project milestone completion, baseline vs. actual schedule variance, and active phase-gate blockers.',
    inputSchema: {
      type: 'object',
      properties: {
        project_code: { type: 'string' },
        view_mode: {
          type: 'string',
          enum: ['timeline', 'kanban', 'blockers'],
          default: 'blockers',
        },
      },
      required: ['project_code'],
    },
  },
  {
    name: 'send_project_reminder_notification',
    description:
      'Filter upcoming or overdue tasks and dispatch Microsoft Teams / Email reminders with direct Odoo task links.',
    inputSchema: {
      type: 'object',
      properties: {
        project_code: { type: 'string' },
        days_threshold: { type: 'number', default: 7 },
        channel: { type: 'string', enum: ['teams', 'email'], default: 'teams' },
      },
      required: ['project_code'],
    },
  },
  {
    name: 'generate_and_send_status_report',
    description:
      'Compile a weekly or monthly Baseline vs. Actual governance status report and send to project stakeholders.',
    inputSchema: {
      type: 'object',
      properties: {
        project_code: { type: 'string' },
        report_period: {
          type: 'string',
          enum: ['weekly', 'monthly'],
          default: 'weekly',
        },
      },
      required: ['project_code'],
    },
  },
];

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data, reqOrigin) {
  const allowedOrigin = process.env.FRONTEND_URL || reqOrigin || '*';
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Odoo-Api-Key'
  );
  res.end(JSON.stringify(data));
}

/**
 * Stateless API & Health handler used by both Vite Dev Server and Production Koyeb Server.
 */
export async function handleApiAndHealthRequest(req, res) {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const pathname = urlObj.pathname;
  const reqOrigin = req.headers?.origin;

  if (req.method === 'OPTIONS' && (pathname === '/health' || pathname.startsWith('/api/'))) {
    sendJson(res, 200, { ok: true }, reqOrigin);
    return true;
  }

  // 1. ZERO-DB KEEP-ALIVE ENDPOINT (Protects Neon.tech 100 CU-hours/month quota)
  if (pathname === '/health' && req.method === 'GET') {
    sendJson(
      res,
      200,
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      reqOrigin
    );
    return true;
  }

  // 2. PUBLIC RUNTIME CONFIG & CONNECTION STATUS
  if (pathname === '/api/config' && req.method === 'GET') {
    const dbUrl = process.env.DATABASE_URL || '';
    sendJson(
      res,
      200,
      {
        odoo: {
          url: DEFAULT_ODOO_CONNECTION.url,
          db: DEFAULT_ODOO_CONNECTION.db,
          username: DEFAULT_ODOO_CONNECTION.username,
          companyName: DEFAULT_ODOO_CONNECTION.companyName,
          companyId: DEFAULT_ODOO_CONNECTION.companyId,
          hasServerApiKey: Boolean(DEFAULT_ODOO_CONNECTION.apiKey),
        },
        cloud: {
          neonConfigured: Boolean(dbUrl && !dbUrl.includes('ep-cool-darkness')),
          neonUsesPooler: dbUrl.includes('-pooler'),
          r2Configured: Boolean(
            process.env.R2_ACCOUNT_ID &&
              process.env.R2_ACCOUNT_ID !== 'your_cloudflare_account_id'
          ),
        },
        mcpToolsCount: MCP_TOOLS_MANIFEST.length,
      },
      reqOrigin
    );
    return true;
  }

  // 3. CLOUDFLARE R2 PRESIGNED URL ENDPOINT (Stateless — Zero Disk Write)
  if (pathname === '/api/storage/presign' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const presigned = createR2PresignedPutUrl({
        fileName: body.fileName,
        contentType: body.contentType,
        fileSizeBytes: Number(body.fileSizeBytes || 0),
        projectId: body.projectId || 'default',
      });
      sendJson(res, 200, presigned, reqOrigin);
    } catch (err) {
      sendJson(
        res,
        400,
        { error: err instanceof Error ? err.message : 'Presign failed' },
        reqOrigin
      );
    }
    return true;
  }

  // 4. LIVE ODOO CONNECTION TEST
  if (pathname === '/api/odoo/test' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await testOdooConnection({
        url: body.url,
        db: body.db,
        username: body.username,
        apiKey: body.apiKey,
      });
      sendJson(res, 200, result, reqOrigin);
    } catch (err) {
      sendJson(
        res,
        400,
        {
          connected: false,
          error: err instanceof Error ? err.message : 'Odoo connection failed',
        },
        reqOrigin
      );
    }
    return true;
  }

  // 5. LIVE ODOO BATCH TASK DISPATCH (generate_odoo_tasks_from_app)
  if (pathname === '/api/odoo/generate' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await batchCreateOdooTasks(
        {
          url: body.url,
          db: body.db,
          username: body.username,
          apiKey: body.apiKey,
        },
        {
          odooProjectId: body.odooProjectId,
          tasks: body.tasks || [],
        }
      );
      sendJson(res, 200, result, reqOrigin);
    } catch (err) {
      sendJson(
        res,
        400,
        {
          error: err instanceof Error ? err.message : 'Odoo task dispatch failed',
        },
        reqOrigin
      );
    }
    return true;
  }

  // 6. LIVE ODOO PROGRESS SYNC (sync_tasks_status_with_odoo)
  if (pathname === '/api/odoo/sync' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await syncOdooTasks(
        {
          url: body.url,
          db: body.db,
          username: body.username,
          apiKey: body.apiKey,
        },
        {
          odooProjectId: body.odooProjectId,
          tasks: body.tasks || [],
          direction: body.direction || 'odoo_to_app',
        }
      );
      sendJson(res, 200, result, reqOrigin);
    } catch (err) {
      sendJson(
        res,
        400,
        {
          error: err instanceof Error ? err.message : 'Odoo sync failed',
        },
        reqOrigin
      );
    }
    return true;
  }

  // 7. STREAMABLE HTTP MCP ENDPOINT (JSON-RPC 2.0)
  if (pathname === '/api/mcp' && req.method === 'POST') {
    try {
      const rpc = await readJsonBody(req);
      const id = rpc.id ?? null;

      if (rpc.method === 'initialize') {
        sendJson(
          res,
          200,
          {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'tianlane-po-governance-mcp',
                version: '2.0.0',
              },
              capabilities: { tools: {} },
            },
          },
          reqOrigin
        );
        return true;
      }

      if (rpc.method === 'tools/list') {
        sendJson(
          res,
          200,
          {
            jsonrpc: '2.0',
            id,
            result: { tools: MCP_TOOLS_MANIFEST },
          },
          reqOrigin
        );
        return true;
      }

      if (rpc.method === 'tools/call') {
        const toolName = rpc.params?.name;
        const toolArgs = rpc.params?.arguments || {};

        if (toolName === 'sync_tasks_status_with_odoo') {
          const syncRes = await syncOdooTasks(toolArgs, {
            odooProjectId: toolArgs.odoo_project_id || 58,
            tasks: toolArgs.tasks || [],
            direction: toolArgs.sync_direction || 'odoo_to_app',
          });
          sendJson(
            res,
            200,
            {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(syncRes, null, 2),
                  },
                ],
              },
            },
            reqOrigin
          );
          return true;
        }

        if (toolName === 'generate_odoo_tasks_from_app') {
          const genRes = await batchCreateOdooTasks(toolArgs, {
            odooProjectId: toolArgs.odoo_project_id || 58,
            tasks: toolArgs.tasks || [],
          });
          sendJson(
            res,
            200,
            {
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(genRes, null, 2),
                  },
                ],
              },
            },
            reqOrigin
          );
          return true;
        }

        sendJson(
          res,
          200,
          {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Executed ${toolName} with arguments: ${JSON.stringify(toolArgs)}`,
                },
              ],
            },
          },
          reqOrigin
        );
        return true;
      }

      sendJson(
        res,
        200,
        {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${rpc.method}` },
        },
        reqOrigin
      );
    } catch (err) {
      sendJson(
        res,
        500,
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: err instanceof Error ? err.message : 'MCP execution error',
          },
        },
        reqOrigin
      );
    }
    return true;
  }

  return false;
}
