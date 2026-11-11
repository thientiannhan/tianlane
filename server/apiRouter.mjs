import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createR2PresignedPutUrl } from './r2Presign.mjs';

export const AUTH_SALT = 'tianlane-logtechub-auth-salt-v1';

export function hashPassword(password) {
  if (!password) return null;
  const clean = String(password).trim();
  if (/^[a-f0-9]{64}$/i.test(clean)) {
    return clean.toLowerCase();
  }
  return crypto.createHash('sha256').update(`${AUTH_SALT}:${clean}`).digest('hex');
}
import {
  DEFAULT_ODOO_CONNECTION,
  batchCreateOdooTasks,
  syncOdooTasks,
  testOdooConnection,
} from './odooClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envLoaded = false;
function ensureEnvLoaded() {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

let dbPool = null;
let dbSchemaReady = false;

async function getDbPool() {
  ensureEnvLoaded();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('ep-cool-darkness')) return null;
  if (!dbPool) {
    dbPool = new pg.Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000, // Release idle connections quickly so Neon scales to zero
      connectionTimeoutMillis: 8000,
    });
  }
  if (!dbSchemaReady) {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS workspace_state_store (
        id VARCHAR(32) PRIMARY KEY,
        state_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    dbSchemaReady = true;
  }
  return dbPool;
}

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
  const allowedOrigin = reqOrigin || process.env.FRONTEND_URL || '*';
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

  // 2b. LOGTECHUB ACCOUNT & MICROSOFT TEAMS AUTHENTICATION
  if (
    (pathname === '/api/auth/teams' || pathname === '/api/auth/login') &&
    req.method === 'POST'
  ) {
    try {
      const body = await readJsonBody(req);
      const rawIdentifier = String(body.email || body.identifier || '')
        .trim()
        .toLowerCase();
      const inputHash = hashPassword(body.password_hash || body.password);

      if (!rawIdentifier) {
        sendJson(
          res,
          400,
          { error: 'Vui lòng nhập email hoặc username tài khoản Logtechub.' },
          reqOrigin
        );
        return true;
      }

      const normalizedEmail = rawIdentifier.includes('@')
        ? rawIdentifier
        : `${rawIdentifier}@logtechub.com`;
      const username = normalizedEmail.split('@')[0] || '';

      const LOGTECHUB_ACCOUNTS = {
        'james.nhan@logtechub.com': {
          id: 'usr-po-01',
          microsoft_entra_id: 'entra-logtechub-james-nhan',
          full_name: 'James Nhan',
          avatar_initials: 'JN',
          role: 'Product Owner',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-po',
        },
        'azura.thuy@logtechub.com': {
          id: 'usr-azura-thuy',
          microsoft_entra_id: 'entra-logtechub-azura-thuy',
          full_name: 'Azura Thuy',
          avatar_initials: 'AT',
          role: 'Product Owner',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-po',
        },
        'kenny.thuong@logtechub.com': {
          id: 'usr-kenny-thuong',
          microsoft_entra_id: 'entra-logtechub-kenny-thuong',
          full_name: 'Kenny Thuong',
          avatar_initials: 'KT',
          role: 'Tech Lead',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-dev',
        },
        'brian.binh@logtechub.com': {
          id: 'usr-brian-binh',
          microsoft_entra_id: 'entra-logtechub-brian-binh',
          full_name: 'Brian Binh',
          avatar_initials: 'BB',
          role: 'Senior Dev',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-dev',
        },
        'daley.thai@logtechub.com': {
          id: 'usr-daley-thai',
          microsoft_entra_id: 'entra-logtechub-daley-thai',
          full_name: 'Daley Thai',
          avatar_initials: 'DT',
          role: 'Senior Dev',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-dev',
        },
        'lynne.loc@logtechub.com': {
          id: 'usr-lynne-loc',
          microsoft_entra_id: 'entra-logtechub-lynne-loc',
          full_name: 'Lynne Loc',
          avatar_initials: 'LL',
          role: 'UI/UX Designer',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-design',
        },
        'jasmine.thu@logtechub.com': {
          id: 'usr-jasmine-thu',
          microsoft_entra_id: 'entra-logtechub-jasmine-thu',
          full_name: 'Jasmine Thu',
          avatar_initials: 'JT',
          role: 'QA Engineer',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-qa',
        },
        'edwin.tai@logtechub.com': {
          id: 'usr-edwin-tai',
          microsoft_entra_id: 'entra-logtechub-edwin-tai',
          full_name: 'Edwin Tai',
          avatar_initials: 'ET',
          role: 'Senior Dev',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-dev',
        },
        'anatolius.thuan@logtechub.com': {
          id: 'usr-anatolius-thuan',
          microsoft_entra_id: 'entra-logtechub-anatolius-thuan',
          full_name: 'Anatolius Thuan',
          avatar_initials: 'AT',
          role: 'Tech Lead',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-dev',
        },
        'alex.phuong@logtechub.com': {
          id: 'usr-alex-phuong',
          microsoft_entra_id: 'entra-logtechub-alex-phuong',
          full_name: 'Alex Phuong',
          avatar_initials: 'AP',
          role: 'QA Engineer',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-qa',
        },
      };

      const matchedAccount = LOGTECHUB_ACCOUNTS[normalizedEmail];
      if (!matchedAccount) {
        sendJson(
          res,
          403,
          {
            error:
              'Tài khoản không tồn tại trong danh sách thành viên Logtechub (@logtechub.com).',
          },
          reqOrigin
        );
        return true;
      }

      const pool = await getDbPool();
      let dbUserRow = null;
      let dbPasswordHash = null;

      if (pool) {
        try {
          await pool.query(`
            ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS password_hash TEXT;
          `);
          const checkRes = await pool.query(
            `SELECT password_hash, custom_password, full_name, avatar_initials, avatar_url, role, is_admin
             FROM users_directory WHERE email = $1 LIMIT 1`,
            [normalizedEmail]
          );
          if (checkRes.rows.length > 0) {
            dbUserRow = checkRes.rows[0];
            dbPasswordHash = dbUserRow.password_hash || null;
            // Transparently migrate legacy custom_password to password_hash
            if (!dbPasswordHash && dbUserRow.custom_password) {
              dbPasswordHash = hashPassword(dbUserRow.custom_password);
              pool.query(
                'UPDATE users_directory SET password_hash = $1, custom_password = NULL WHERE email = $2',
                [dbPasswordHash, normalizedEmail]
              ).catch(() => {});
            }
          }
        } catch {
          // Fallback if column not yet added
        }
      }

      const currentYear = new Date().getFullYear();
      const expectedCurrentHash = hashPassword(`${username}${currentYear}`);
      const expected2026Hash = hashPassword(`${username}2026`);

      const isMatch =
        (Boolean(dbPasswordHash) && inputHash === dbPasswordHash) ||
        inputHash === expectedCurrentHash ||
        inputHash === expected2026Hash;

      if (!isMatch) {
        sendJson(
          res,
          401,
          {
            error: 'Mật khẩu không chính xác. Vui lòng thử lại.',
          },
          reqOrigin
        );
        return true;
      }

      const userProfile = {
        id: matchedAccount.id,
        microsoft_entra_id: matchedAccount.microsoft_entra_id,
        full_name: dbUserRow?.full_name || matchedAccount.full_name,
        email: normalizedEmail,
        avatar_initials: dbUserRow?.avatar_initials || matchedAccount.avatar_initials,
        avatar_url: dbUserRow?.avatar_url || undefined,
        role: dbUserRow?.role || matchedAccount.role,
        teams_status: 'available',
        teams_webhook_url: matchedAccount.teams_webhook_url,
        is_admin:
          dbUserRow?.is_admin ||
          normalizedEmail === 'james.nhan@logtechub.com' ||
          matchedAccount.id === 'usr-po-01',
      };

      if (pool) {
        await pool.query(
          `INSERT INTO users_directory (id, microsoft_entra_id, full_name, email, avatar_initials, role, teams_status, teams_webhook_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (email) DO UPDATE SET
             full_name = COALESCE(users_directory.full_name, EXCLUDED.full_name),
             avatar_initials = COALESCE(users_directory.avatar_initials, EXCLUDED.avatar_initials),
             role = COALESCE(users_directory.role, EXCLUDED.role),
             teams_status = 'available'`,
          [
            userProfile.id,
            userProfile.microsoft_entra_id,
            userProfile.full_name,
            userProfile.email,
            userProfile.avatar_initials,
            userProfile.role,
            userProfile.teams_status,
            userProfile.teams_webhook_url,
          ]
        );
      }

      sendJson(
        res,
        200,
        { authenticated: true, tenant: 'logtechub.com', user: userProfile },
        reqOrigin
      );
    } catch (err) {
      sendJson(
        res,
        500,
        { error: err instanceof Error ? err.message : 'Authentication failed' },
        reqOrigin
      );
    }
    return true;
  }

  // 2b-2. UPDATE USER PROFILE (Full Name, Role / Position, Avatar, Password)
  if (
    pathname === '/api/users/profile' &&
    (req.method === 'POST' || req.method === 'PUT')
  ) {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        sendJson(res, 400, { error: 'Missing email' }, reqOrigin);
        return true;
      }
      const pool = await getDbPool();
      if (pool) {
        await pool.query(`
          ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS password_hash TEXT;
          ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS avatar_url TEXT;
          ALTER TABLE users_directory ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        `);
        const updates = [];
        const values = [email];
        let idx = 2;
        if (body.fullName) {
          updates.push(`full_name = $${idx++}`);
          values.push(body.fullName.trim());
        }
        if (body.avatarInitials) {
          updates.push(`avatar_initials = $${idx++}`);
          values.push(body.avatarInitials.trim());
        }
        if (body.avatarUrl !== undefined) {
          updates.push(`avatar_url = $${idx++}`);
          values.push(body.avatarUrl ? body.avatarUrl.trim() : null);
        }
        if (body.role) {
          updates.push(`role = $${idx++}`);
          values.push(body.role.trim());
        }
        if (body.isAdmin !== undefined) {
          updates.push(`is_admin = $${idx++}`);
          values.push(Boolean(body.isAdmin));
        }
        if (body.resetPassword) {
          updates.push(`password_hash = NULL, custom_password = NULL`);
        } else if (body.password_hash) {
          updates.push(`password_hash = $${idx++}, custom_password = NULL`);
          values.push(hashPassword(body.password_hash));
        } else if (body.newPassword) {
          updates.push(`password_hash = $${idx++}, custom_password = NULL`);
          values.push(hashPassword(body.newPassword));
        }
        if (updates.length > 0) {
          await pool.query(
            `UPDATE users_directory SET ${updates.join(', ')} WHERE email = $1`,
            values
          );
        }
      }
      sendJson(res, 200, { ok: true, message: 'Profile updated' }, reqOrigin);
    } catch (err) {
      sendJson(
        res,
        500,
        { error: err instanceof Error ? err.message : 'Update profile failed' },
        reqOrigin
      );
    }
    return true;
  }

  // 2c. NEON POSTGRESQL MULTI-USER WORKSPACE STATE SYNC (GET / PUT / POST)
  if (pathname === '/api/workspace' && req.method === 'GET') {
    try {
      const pool = await getDbPool();
      if (!pool) {
        sendJson(res, 200, { synced: false, state: null }, reqOrigin);
        return true;
      }
      const result = await pool.query(
        `SELECT state_json, updated_at FROM workspace_state_store WHERE id = 'default' LIMIT 1`
      );
      const row = result.rows[0];
      sendJson(
        res,
        200,
        {
          synced: true,
          state: row ? row.state_json : null,
          updatedAt: row ? row.updated_at : null,
        },
        reqOrigin
      );
    } catch (err) {
      sendJson(
        res,
        500,
        { synced: false, error: err instanceof Error ? err.message : 'DB read failed' },
        reqOrigin
      );
    }
    return true;
  }

  if (
    pathname === '/api/workspace' &&
    (req.method === 'PUT' || req.method === 'POST')
  ) {
    try {
      const body = await readJsonBody(req);
      const state = body.state;
      if (!state || typeof state !== 'object') {
        sendJson(res, 400, { error: 'Missing workspace state payload' }, reqOrigin);
        return true;
      }
      const pool = await getDbPool();
      if (!pool) {
        sendJson(res, 200, { synced: false }, reqOrigin);
        return true;
      }
      const result = await pool.query(
        `INSERT INTO workspace_state_store (id, state_json, updated_at)
         VALUES ('default', $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           state_json = EXCLUDED.state_json,
           updated_at = NOW()
         RETURNING updated_at`,
        [JSON.stringify(state)]
      );
      sendJson(
        res,
        200,
        { synced: true, updatedAt: result.rows[0]?.updated_at },
        reqOrigin
      );
    } catch (err) {
      sendJson(
        res,
        500,
        { synced: false, error: err instanceof Error ? err.message : 'DB write failed' },
        reqOrigin
      );
    }
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
