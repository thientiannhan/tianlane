#!/usr/bin/env node
/**
 * TIANLANE — STANDALONE STDIO MCP SERVER
 * Connects Claude Desktop, Cursor, or Antigravity directly to Tianlane Governance & Odoo (https://support.logtechub.com / bitnami_odoo).
 */
import readline from 'node:readline';
import { MCP_TOOLS_MANIFEST } from '../server/apiRouter.mjs';
import {
  DEFAULT_ODOO_CONNECTION,
  batchCreateOdooTasks,
  syncOdooTasks,
  testOdooConnection,
} from '../server/odooClient.mjs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendRpcResponse(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let rpc;
  try {
    rpc = JSON.parse(trimmed);
  } catch {
    return;
  }

  const id = rpc.id ?? null;

  try {
    if (rpc.method === 'initialize') {
      sendRpcResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'tianlane-po-governance-mcp',
            version: '2.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      });
      return;
    }

    if (rpc.method === 'notifications/initialized') {
      return;
    }

    if (rpc.method === 'tools/list') {
      sendRpcResponse({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS_MANIFEST,
        },
      });
      return;
    }

    if (rpc.method === 'tools/call') {
      const name = rpc.params?.name;
      const args = rpc.params?.arguments || {};

      if (name === 'sync_tasks_status_with_odoo') {
        const res = await syncOdooTasks(DEFAULT_ODOO_CONNECTION, {
          odooProjectId: args.odoo_project_id || Number(process.env.ODOO_PROJECT_ID || 58),
          tasks: args.tasks || [],
          direction: args.sync_direction || 'odoo_to_app',
        });
        sendRpcResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
          },
        });
        return;
      }

      if (name === 'generate_odoo_tasks_from_app') {
        const res = await batchCreateOdooTasks(DEFAULT_ODOO_CONNECTION, {
          odooProjectId: args.odoo_project_id || Number(process.env.ODOO_PROJECT_ID || 58),
          tasks: args.tasks || [],
        });
        sendRpcResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
          },
        });
        return;
      }

      if (name === 'get_project_roadmap_and_blockers') {
        const connInfo = DEFAULT_ODOO_CONNECTION.apiKey
          ? await testOdooConnection(DEFAULT_ODOO_CONNECTION)
          : {
              connected: false,
              url: DEFAULT_ODOO_CONNECTION.url,
              db: DEFAULT_ODOO_CONNECTION.db,
              username: DEFAULT_ODOO_CONNECTION.username,
            };
        sendRpcResponse({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    project_code: args.project_code || process.env.PROJECT_CODE || '26-11',
                    odoo_context: connInfo,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        });
        return;
      }

      sendRpcResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ tool: name, status: 'executed', args }),
            },
          ],
        },
      });
      return;
    }

    if (id !== null) {
      sendRpcResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${rpc.method}` },
      });
    }
  } catch (err) {
    if (id !== null) {
      sendRpcResponse({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: err instanceof Error ? err.message : 'Tool execution error',
        },
      });
    }
  }
});
