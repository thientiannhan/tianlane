import React, { useState } from 'react';
import {
  Bell,
  Copy,
  Plus,
  Send,
} from 'lucide-react';
import {
  getUserProjectRole,
  type BaselineRevisionEntry,
  type McpExecutionLog,
  type McpToolName,
  type OdooConnectionConfig,
  type Project,
  type ProjectMilestone,
  type ProjectTask,
  type ProjectTemplate,
  type TaskPriority,
  type UserProfile,
} from '../types.ts';
import { diffDaysISO } from '../engine/scheduleEngine.ts';

/* ============================================================================
 * 1. INBOX VIEW (Notifications, Blockers, Tracker Sync & Schedule Updates)
 * ============================================================================ */
interface InboxViewProps {
  projects: Project[];
  tasks: ProjectTask[];
  revisionLogs: BaselineRevisionEntry[];
  mcpLogs: McpExecutionLog[];
  onOpenProjectTask: (projectId: string, task: ProjectTask) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  projects,
  tasks,
  revisionLogs,
  mcpLogs,
  onOpenProjectTask,
}) => {
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  const blockerTasks = tasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-[#E6E8EE] pb-4">
        <div>
          <h1 className="text-[20px] font-medium text-[#121317]">Inbox</h1>
          <p className="text-[13px] text-[#45474D]">
            Gate blockers, tracker sync updates, and baseline changes
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next: Record<string, boolean> = {};
            blockerTasks.forEach((t) => (next[t.id] = true));
            setReadIds(next);
          }}
          className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12.5px] text-[#121317]"
        >
          Mark all as read
        </button>
      </div>

      <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] bg-white">
        {blockerTasks.map((task) => {
          const proj = projects.find((p) => p.id === task.project_id);
          const isRead = Boolean(readIds[task.id]);
          return (
            <div
              key={task.id}
              onClick={() => {
                setReadIds((p) => ({ ...p, [task.id]: true }));
                onOpenProjectTask(task.project_id, task);
              }}
              className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F8FA] cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    isRead ? 'bg-[#E6E8EE]' : 'bg-[#0A4595]'
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12px] text-[#45474D] tabular-nums">
                    <span className="font-mono text-[#121317] font-medium">
                      {task.code}
                    </span>
                    <span>· {proj?.name}</span>
                    <span>· Gate Blocker</span>
                  </div>
                  <p className="text-[14px] font-medium text-[#121317] truncate mt-0.5">
                    {task.title}
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-mono text-[#45474D] tabular-nums shrink-0">
                Due {task.actual_end}
              </span>
            </div>
          );
        })}

        {mcpLogs.map((log) => (
          <div
            key={log.id}
            className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F8FA]"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Bell className="w-4 h-4 text-[#45474D] mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[12px] font-mono text-[#45474D]">
                  Agent · {log.tool_name}
                </div>
                <p className="text-[13.5px] text-[#121317] mt-0.5">
                  {log.output_markdown}
                </p>
              </div>
            </div>
            <span className="text-[12px] font-mono text-[#45474D] tabular-nums shrink-0">
              {log.timestamp}
            </span>
          </div>
        ))}

        {revisionLogs.map((rev) => (
          <div
            key={rev.id}
            className="p-4 flex items-center justify-between gap-4 hover:bg-[#F7F8FA]"
          >
            <div className="min-w-0">
              <div className="text-[12px] text-[#45474D]">
                Baseline revision · {rev.author_name}
              </div>
              <p className="text-[13.5px] font-medium text-[#121317] mt-0.5">
                {rev.target_title} ({rev.delta_days > 0 ? `+${rev.delta_days}d` : `${rev.delta_days}d`})
              </p>
              <p className="text-[12.5px] text-[#45474D]">{rev.reason}</p>
            </div>
            <span className="text-[12px] font-mono text-[#45474D] tabular-nums shrink-0">
              {rev.created_at}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. AGENT VIEW (Clean First-Class Workspace View for the 6 MCP Actions)
 * ============================================================================ */
interface AgentViewProps {
  project: Project;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  users: UserProfile[];
  mcpLogs: McpExecutionLog[];
  odooConfig: OdooConnectionConfig;
  onUpdateOdooConfig: (next: OdooConnectionConfig) => void;
  onTestOdooConnection: () => Promise<{
    connected: boolean;
    message: string;
  }>;
  onOpenTemplateModal: () => void;
  onExecuteBatchGenerateOdoo: () => Promise<{
    createdCount: number;
    summary: string;
  }>;
  onExecuteSyncOdooStatus: (
    direction: 'odoo_to_app' | 'app_to_odoo'
  ) => Promise<{
    updatedCount: number;
    summary: string;
  }>;
  onAppendMcpLog: (log: Omit<McpExecutionLog, 'id' | 'timestamp'>) => void;
}

const AGENT_ACTIONS: {
  name: McpToolName;
  label: string;
  shortDesc: string;
  requiresConfirmation: boolean;
  defaultPrompt: string;
}[] = [
  {
    name: 'instantiate_project_from_template',
    label: 'Create from Template',
    shortDesc: 'Generate milestones and tasks from a standard template.',
    requiresConfirmation: false,
    defaultPrompt: 'Create a new project from the Standard Software template.',
  },
  {
    name: 'generate_odoo_tasks_from_app',
    label: 'Dispatch Tasks',
    shortDesc: 'Batch create unlinked tasks in the execution tracker with direct links.',
    requiresConfirmation: true,
    defaultPrompt: 'Dispatch all unlinked milestone tasks to the execution tracker.',
  },
  {
    name: 'sync_tasks_status_with_odoo',
    label: 'Sync Progress',
    shortDesc: 'Pull latest ground-truth stage updates from the execution tracker.',
    requiresConfirmation: false,
    defaultPrompt: 'Sync task statuses from the execution tracker and update milestone progress.',
  },
  {
    name: 'get_project_roadmap_and_blockers',
    label: 'Blocker Radar',
    shortDesc: 'Check baseline variance and open phase-gate blockers.',
    requiresConfirmation: false,
    defaultPrompt: 'Summarize schedule variance and open gate blockers.',
  },
  {
    name: 'send_project_reminder_notification',
    label: 'Send Reminders',
    shortDesc: 'Notify assignees on Teams and Email for upcoming tasks.',
    requiresConfirmation: true,
    defaultPrompt: 'Send Teams reminders for tasks due this week.',
  },
  {
    name: 'generate_and_send_status_report',
    label: 'Weekly Report',
    shortDesc: 'Compile and send the weekly baseline vs. actual digest.',
    requiresConfirmation: true,
    defaultPrompt: 'Generate and send the weekly status report to the team.',
  },
];

export const AgentView: React.FC<AgentViewProps> = ({
  project,
  milestones,
  tasks,
  users,
  mcpLogs,
  odooConfig,
  onUpdateOdooConfig,
  onTestOdooConnection,
  onOpenTemplateModal,
  onExecuteBatchGenerateOdoo,
  onExecuteSyncOdooStatus,
  onAppendMcpLog,
}) => {
  const [selectedAction, setSelectedAction] = useState<McpToolName>(
    'generate_odoo_tasks_from_app'
  );
  const [promptInput, setPromptInput] = useState<string>(
    AGENT_ACTIONS[1].defaultPrompt
  );
  const [pendingConfirm, setPendingConfirm] = useState<McpToolName | null>(
    null
  );
  const [showConfig, setShowConfig] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [connStatus, setConnStatus] = useState<{
    state: 'idle' | 'testing' | 'ok' | 'error';
    text: string;
  }>({
    state: 'idle',
    text: `Configured for ${odooConfig.url} (DB: ${odooConfig.db}, User: ${odooConfig.username})`,
  });

  const unlinkedTasks = tasks.filter((t) => !t.odoo_task_id);
  const openBlockers = tasks.filter(
    (t) => t.is_gate_blocker && t.kanban_status !== 'done'
  );
  const openTasks = tasks.filter((t) => t.kanban_status !== 'done');

  const runActionConfirmed = async (toolName: McpToolName) => {
    setPendingConfirm(null);

    if (toolName === 'instantiate_project_from_template') {
      onOpenTemplateModal();
      return;
    }

    setIsRunning(true);
    try {
      if (toolName === 'generate_odoo_tasks_from_app') {
        const res = await onExecuteBatchGenerateOdoo();
        onAppendMcpLog({
          tool_name: toolName,
          prompt_summary: promptInput,
          status: 'executed',
          affected_count: res.createdCount,
          output_markdown: res.summary,
        });
        return;
      }

      if (toolName === 'sync_tasks_status_with_odoo') {
        const res = await onExecuteSyncOdooStatus('odoo_to_app');
        onAppendMcpLog({
          tool_name: toolName,
          prompt_summary: promptInput,
          status: 'executed',
          affected_count: res.updatedCount,
          output_markdown: res.summary,
        });
        return;
      }

      if (toolName === 'get_project_roadmap_and_blockers') {
        const delayed = milestones.filter(
          (m) => diffDaysISO(m.planned_end, m.actual_end) > 0
        );
        const output = `${project.code}: ${milestones.length} milestones (${delayed.length} delayed). Open gate blockers: ${openBlockers.length}. Linked to Tracker #${project.odoo_project_id}: ${
          tasks.length - unlinkedTasks.length
        }/${tasks.length} tasks.`;

        onAppendMcpLog({
          tool_name: toolName,
          prompt_summary: promptInput,
          status: 'executed',
          affected_count: openBlockers.length,
          output_markdown: output,
        });
        return;
      }

      if (toolName === 'send_project_reminder_notification') {
        const output = `Sent Teams & Email reminders to ${users.length} members for ${openTasks.length} active tasks in ${project.code}.`;
        onAppendMcpLog({
          tool_name: toolName,
          prompt_summary: promptInput,
          status: 'executed',
          affected_count: openTasks.length,
          output_markdown: output,
        });
        return;
      }

      if (toolName === 'generate_and_send_status_report') {
        const done = tasks.filter((t) => t.kanban_status === 'done').length;
        const pct =
          tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
        const output = `Weekly report sent for ${project.code} (${pct}% complete, ${done}/${tasks.length} tasks done across ${milestones.length} milestones).`;
        onAppendMcpLog({
          tool_name: toolName,
          prompt_summary: promptInput,
          status: 'executed',
          affected_count: milestones.length,
          output_markdown: output,
        });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleRun = () => {
    const meta = AGENT_ACTIONS.find((a) => a.name === selectedAction);
    if (meta?.requiresConfirmation) {
      setPendingConfirm(selectedAction);
    } else {
      void runActionConfirmed(selectedAction);
    }
  };

  const handleTestClick = async () => {
    setConnStatus({ state: 'testing', text: 'Connecting to Odoo JSON-RPC...' });
    const res = await onTestOdooConnection();
    setConnStatus({
      state: res.connected ? 'ok' : 'error',
      text: res.message,
    });
  };

  const mcpJson = JSON.stringify(
    {
      mcpServers: {
        'tianlane-governance': {
          command: 'node',
          args: ['mcp/tianlane-mcp-server.mjs'],
          env: {
            PROJECT_CODE: project.code,
            ODOO_URL: odooConfig.url,
            ODOO_DB: odooConfig.db,
            ODOO_USERNAME: odooConfig.username,
            ODOO_API_KEY: odooConfig.apiKey
              ? '••••••••••••••••'
              : '<your-odoo-api-key>',
            ODOO_COMPANY_ID: String(odooConfig.companyId),
            ODOO_PROJECT_ID: String(project.odoo_project_id),
          },
        },
      },
    },
    null,
    2
  );

  const mcpJsonRawToCopy = JSON.stringify(
    {
      mcpServers: {
        'tianlane-governance': {
          command: 'node',
          args: ['mcp/tianlane-mcp-server.mjs'],
          env: {
            PROJECT_CODE: project.code,
            ODOO_URL: odooConfig.url,
            ODOO_DB: odooConfig.db,
            ODOO_USERNAME: odooConfig.username,
            ODOO_API_KEY: odooConfig.apiKey || '<your-odoo-api-key>',
            ODOO_COMPANY_ID: String(odooConfig.companyId),
            ODOO_PROJECT_ID: String(project.odoo_project_id),
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E8EE] pb-4">
        <div>
          <h1 className="text-[20px] font-medium text-[#121317]">Agent</h1>
          <p className="text-[13px] text-[#45474D]">
            Active project: {project.code} · {project.name} (Tracker #
            {project.odoo_project_id} · {odooConfig.companyName})
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConfig((v) => !v)}
          className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12.5px] font-medium text-[#121317]"
        >
          {showConfig ? 'Hide MCP & API Key' : 'MCP & API Key'}
        </button>
      </div>

      {showConfig && (
        <div className="p-5 rounded-2xl border border-[#E6E8EE] bg-[#F7F8FA] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[13px] font-medium text-[#121317]">
                Live Execution Tracker &amp; MCP Gateway
              </span>
              <p className="text-[12px] text-[#45474D]">
                Aligned with {odooConfig.companyName} ({odooConfig.url} · DB:{' '}
                <code className="font-mono">{odooConfig.db}</code> · User:{' '}
                <code className="font-mono">{odooConfig.username}</code>)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestClick}
                disabled={connStatus.state === 'testing'}
                className="px-3 py-1 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                {connStatus.state === 'testing'
                  ? 'Testing...'
                  : 'Test Live Connection'}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mcpJsonRawToCopy);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E6E8EE] bg-white text-[12px] text-[#121317]"
              >
                <Copy className="w-3 h-3" aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Copy MCP JSON'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#45474D] mb-1">
                Server URL
              </label>
              <input
                type="url"
                value={odooConfig.url}
                onChange={(e) =>
                  onUpdateOdooConfig({ ...odooConfig, url: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[12.5px] font-mono text-[#121317]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#45474D] mb-1">
                Database (ODOO_DB)
              </label>
              <input
                type="text"
                value={odooConfig.db}
                onChange={(e) =>
                  onUpdateOdooConfig({ ...odooConfig, db: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[12.5px] font-mono text-[#121317]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#45474D] mb-1">
                Login / Username
              </label>
              <input
                type="text"
                value={odooConfig.username}
                onChange={(e) =>
                  onUpdateOdooConfig({ ...odooConfig, username: e.target.value })
                }
                className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[12.5px] font-mono text-[#121317]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#45474D] mb-1">
                API Key / Token
              </label>
              <input
                type="password"
                value={odooConfig.apiKey}
                onChange={(e) =>
                  onUpdateOdooConfig({ ...odooConfig, apiKey: e.target.value })
                }
                placeholder="Paste james.nhan API key..."
                className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[12.5px] font-mono text-[#121317]"
              />
            </div>
          </div>

          <div
            className={`px-3.5 py-2 rounded-xl border text-[12px] font-mono flex items-center justify-between ${
              connStatus.state === 'ok'
                ? 'bg-[#EEF7F1] border-[#B8DFC6] text-[#188038]'
                : connStatus.state === 'error'
                ? 'bg-[#FDF2F2] border-[#F5C2C7] text-[#B42318]'
                : 'bg-white border-[#E6E8EE] text-[#45474D]'
            }`}
          >
            <span>{connStatus.text}</span>
            <span className="text-[11px]">
              HTTP MCP: POST /api/mcp · Health: GET /health
            </span>
          </div>

          <pre className="p-3.5 rounded-xl bg-white border border-[#E6E8EE] text-[12px] font-mono text-[#121317] overflow-x-auto">
            {mcpJson}
          </pre>
        </div>
      )}

      {/* Prompt Bar */}
      <div className="p-2 rounded-full border border-[#E6E8EE] bg-[#F7F8FA] flex items-center gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Ask Agent to sync tracker progress, dispatch tasks, or send reports..."
          className="flex-1 px-4 py-2 bg-transparent text-[14px] text-[#121317] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>
      </div>

      {/* Confirmation Gate */}
      {pendingConfirm && (
        <div
          role="alert"
          className="p-4 rounded-2xl border border-[#B7BFD9] bg-[#F7F8FA] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="text-[13px] text-[#121317]">
            <span className="font-medium">Confirm action: </span>
            {pendingConfirm === 'generate_odoo_tasks_from_app'
              ? `Dispatch ${unlinkedTasks.length} new tasks to Execution Tracker Project #${project.odoo_project_id} (${odooConfig.url})?`
              : pendingConfirm === 'send_project_reminder_notification'
              ? `Send reminders for ${openTasks.length} active tasks to ${users.length} members?`
              : `Send weekly report for ${milestones.length} milestones?`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="px-4 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runActionConfirmed(pendingConfirm)}
              className="px-4 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* 6 Concise Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {AGENT_ACTIONS.map((act) => {
          const isSelected = selectedAction === act.name;
          return (
            <button
              key={act.name}
              type="button"
              onClick={() => {
                setSelectedAction(act.name);
                setPromptInput(act.defaultPrompt);
                setPendingConfirm(null);
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                isSelected
                  ? 'border-[#0A4595] bg-[#EEF3FB]/50'
                  : 'border-[#E6E8EE] bg-white hover:border-[#B7BFD9]'
              }`}
            >
              <div className="text-[14px] font-medium text-[#121317] mb-1">
                {act.label}
              </div>
              <p className="text-[12.5px] text-[#45474D]">{act.shortDesc}</p>
            </button>
          );
        })}
      </div>

      {/* Activity Feed */}
      <div className="space-y-2">
        <div className="text-[12.5px] font-medium text-[#45474D]">
          Recent runs ({mcpLogs.length})
        </div>
        <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] bg-white">
          {mcpLogs.map((log) => (
            <div key={log.id} className="p-4 space-y-1 text-[13px]">
              <div className="flex items-center justify-between text-[12px] text-[#45474D] font-mono tabular-nums">
                <span className="text-[#121317] font-medium">{log.tool_name}</span>
                <span>{log.timestamp}</span>
              </div>
              <p className="text-[#45474D]">{log.output_markdown}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. YOUR TEAM VIEW (Members Directory & Task Workload)
 * ============================================================================ */
interface TeamViewProps {
  users: UserProfile[];
  tasks: ProjectTask[];
  currentUser: UserProfile;
  activeProject?: Project;
  onSelectUserAsCurrent: (user: UserProfile) => void;
  onFilterByMember: (userId: string) => void;
  onOpenMembersModal?: () => void;
  onOpenAuthModal?: () => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  users,
  tasks,
  currentUser,
  activeProject,
  onFilterByMember,
  onOpenMembersModal,
  onOpenAuthModal,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E8EE] pb-4">
        <div>
          <h1 className="text-[20px] font-medium text-[#121317]">
            Logtechub Directory &amp; Project Access
          </h1>
          <p className="text-[13px] text-[#45474D]">
            Danh sách 10 tài khoản chính thức (@logtechub.com) &amp; phân quyền theo từng Project
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] bg-white text-[12.5px] font-medium text-[#121317] transition-colors"
            >
              Đổi tài khoản đăng nhập
            </button>
          )}
          {onOpenMembersModal && activeProject && (
            <button
              type="button"
              onClick={onOpenMembersModal}
              className="px-4 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[12.5px] font-medium transition-colors"
            >
              Phân quyền &amp; Link Invite ({activeProject.code})
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] bg-white">
        {users.map((member) => {
          const memberTasks = tasks.filter((t) => t.assignee_id === member.id);
          const doneCount = memberTasks.filter(
            (t) => t.kanban_status === 'done'
          ).length;
          const isCurrent = member.id === currentUser.id;
          const projRole = activeProject
            ? getUserProjectRole(activeProject, member)
            : 'viewer';

          return (
            <div
              key={member.id}
              className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#F7F8FA]"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative w-9 h-9 rounded-full bg-[#F1F3F7] border border-[#E6E8EE] flex items-center justify-center text-[12.5px] font-medium text-[#121317]">
                  {member.avatar_initials}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      member.teams_status === 'available'
                        ? 'bg-[#188038]'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-[#121317]">
                      {member.full_name}
                    </span>
                    <span className="text-[12px] text-[#45474D]">
                      · {member.role}
                    </span>
                    {activeProject && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase ${
                          projRole === 'owner'
                            ? 'bg-amber-100 text-amber-800'
                            : projRole === 'writer'
                            ? 'bg-[#EEF3FB] text-[#0A4595]'
                            : 'bg-[#F1F3F7] text-[#45474D]'
                        }`}
                      >
                        {activeProject.code}: {projRole}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] font-mono text-[#45474D]">
                    {member.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[12.5px] tabular-nums">
                <span className="text-[#45474D]">
                  {doneCount}/{memberTasks.length} tasks done
                </span>

                <button
                  type="button"
                  onClick={() => onFilterByMember(member.id)}
                  className="px-3 py-1 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[#121317]"
                >
                  View tasks
                </button>

                {isCurrent ? (
                  <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-[#EEF3FB] text-[#0A4595]">
                    Active
                  </span>
                ) : (
                  onOpenAuthModal && (
                    <button
                      type="button"
                      onClick={onOpenAuthModal}
                      className="px-3 py-1 rounded-full text-[12px] font-medium border border-[#E6E8EE] text-[#45474D] hover:text-[#121317]"
                    >
                      Sign in
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. PROJECT STANDARD SETTINGS VIEW (Sidebar Settings -> Standard Templates & Rules)
 * ============================================================================ */
interface ProjectStandardsViewProps {
  templates: ProjectTemplate[];
  odooBaseUrl: string;
  onUpdateOdooBaseUrl: (url: string) => void;
  onUpdateTemplates: (next: ProjectTemplate[]) => void;
  onOpenTemplateModal: () => void;
}

const MILESTONE_ICON_CHOICES = ['🧭', '🎨', '⚡', '🛡️', '🚀', '📦', '🔗', '🏁', '🎯', '📐'];

export const ProjectStandardsView: React.FC<ProjectStandardsViewProps> = ({
  templates,
  odooBaseUrl,
  onUpdateOdooBaseUrl,
  onUpdateTemplates,
  onOpenTemplateModal,
}) => {
  const [selectedTplId, setSelectedTplId] = useState<string>(
    templates[0]?.id ?? ''
  );
  const [newPhaseTitle, setNewPhaseTitle] = useState('');
  const [newPhaseCode, setNewPhaseCode] = useState('');
  const [newPhaseIcon, setNewPhaseIcon] = useState('🎯');
  const [newPhaseDuration, setNewPhaseDuration] = useState(10);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskBlocker, setNewTaskBlocker] = useState(false);

  const activeTpl =
    templates.find((t) => t.id === selectedTplId) ?? templates[0];

  const handleAddPhaseToTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTpl || !newPhaseTitle.trim()) return;
    const nextIdx = activeTpl.default_milestones_json.length + 1;
    const lastMs =
      activeTpl.default_milestones_json[
        activeTpl.default_milestones_json.length - 1
      ];
    const nextOffset = lastMs ? lastMs.offset_days + lastMs.duration_days : 0;

    const updatedTpl: ProjectTemplate = {
      ...activeTpl,
      default_milestones_json: [
        ...activeTpl.default_milestones_json,
        {
          key: `phase-${Date.now()}`,
          code: newPhaseCode.trim() || `P${nextIdx}`,
          title: newPhaseTitle.trim(),
          icon: newPhaseIcon,
          offset_days: nextOffset,
          duration_days: Math.max(1, newPhaseDuration),
        },
      ],
    };

    onUpdateTemplates(
      templates.map((t) => (t.id === activeTpl.id ? updatedTpl : t))
    );
    setNewPhaseTitle('');
    setNewPhaseCode('');
  };

  const handleAddTaskToTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTpl || !newTaskTitle.trim()) return;
    const firstMsKey =
      activeTpl.default_milestones_json[0]?.key ?? 'phase-1';

    const updatedTpl: ProjectTemplate = {
      ...activeTpl,
      default_tasks_json: [
        ...activeTpl.default_tasks_json,
        {
          milestone_key: firstMsKey,
          title: newTaskTitle.trim(),
          description: 'Standard template task.',
          offset_days: 0,
          duration_days: 5,
          is_gate_blocker: newTaskBlocker,
          priority: newTaskPriority,
          default_role: 'Senior Dev',
          checklist: ['Complete verification'],
        },
      ],
    };

    onUpdateTemplates(
      templates.map((t) => (t.id === activeTpl.id ? updatedTpl : t))
    );
    setNewTaskTitle('');
    setNewTaskBlocker(false);
  };

  const handleUpdateMilestoneIcon = (msKey: string, icon: string) => {
    if (!activeTpl) return;
    const updatedTpl: ProjectTemplate = {
      ...activeTpl,
      default_milestones_json: activeTpl.default_milestones_json.map((m) =>
        m.key === msKey ? { ...m, icon } : m
      ),
    };
    onUpdateTemplates(
      templates.map((t) => (t.id === activeTpl.id ? updatedTpl : t))
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E8EE] pb-4">
        <div>
          <h1 className="text-[20px] font-medium text-[#121317]">
            Project Standard Settings
          </h1>
          <p className="text-[13px] text-[#45474D]">
            Configure standard project templates, milestone icons, gate rules, and execution tracker defaults
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenTemplateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Create project from standard</span>
        </button>
      </div>

      {/* Global Project Standards Card */}
      <div className="p-5 rounded-2xl border border-[#E6E8EE] bg-[#F7F8FA] grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[#45474D] mb-1">
            Execution Tracker Endpoint (Odoo / ERP)
          </label>
          <input
            type="url"
            value={odooBaseUrl}
            onChange={(e) => onUpdateOdooBaseUrl(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] font-mono text-[#121317]"
          />
        </div>
        <div>
          <div className="text-[12px] font-medium text-[#45474D] mb-1">
            Phase-Gate Governance
          </div>
          <div className="px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]">
            Block milestone close if Gate Blocker or deliverable is missing
          </div>
        </div>
        <div>
          <div className="text-[12px] font-medium text-[#45474D] mb-1">
            Document Hub Storage Policy
          </div>
          <div className="px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]">
            Max 50 MB / file · Smart Link fallback
          </div>
        </div>
      </div>

      {/* Standard Template Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {templates.map((tpl) => {
          const isSelected = tpl.id === activeTpl?.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTplId(tpl.id)}
              className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all ${
                isSelected
                  ? 'border-[#0A4595] bg-[#EEF3FB] text-[#0A4595]'
                  : 'border-[#E6E8EE] bg-white text-[#45474D] hover:text-[#121317]'
              }`}
            >
              <span>{tpl.template_name}</span>
              <span className="ml-2 font-mono text-[11px] opacity-75">
                ({tpl.code_prefix})
              </span>
            </button>
          );
        })}
      </div>

      {activeTpl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Standard Milestones & Icon Config */}
          <div className="rounded-2xl border border-[#E6E8EE] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium text-[#121317]">
                Standard Milestones ({activeTpl.default_milestones_json.length})
              </h2>
              <span className="text-[12px] text-[#6E717A]">
                Click icon to customize
              </span>
            </div>

            <div className="divide-y divide-[#E6E8EE]">
              {activeTpl.default_milestones_json.map((ms, idx) => {
                const currentIcon =
                  ms.icon ?? MILESTONE_ICON_CHOICES[idx % MILESTONE_ICON_CHOICES.length];
                return (
                  <div
                    key={ms.key}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <select
                        aria-label={`Icon for ${ms.title}`}
                        value={currentIcon}
                        onChange={(e) =>
                          handleUpdateMilestoneIcon(ms.key, e.target.value)
                        }
                        className="w-9 h-9 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] text-center text-[15px] cursor-pointer"
                      >
                        {MILESTONE_ICON_CHOICES.map((ic) => (
                          <option key={ic} value={ic}>
                            {ic}
                          </option>
                        ))}
                      </select>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-[#121317] truncate">
                          <span className="font-mono text-[#0A4595] mr-1.5">
                            {ms.code}
                          </span>
                          {ms.title}
                        </div>
                        <div className="text-[11.5px] font-mono text-[#6E717A] tabular-nums">
                          Offset +{ms.offset_days}d · Duration {ms.duration_days}d
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Standard Phase Form */}
            <form
              onSubmit={handleAddPhaseToTemplate}
              className="pt-3 border-t border-[#E6E8EE] flex flex-wrap items-center gap-2"
            >
              <select
                aria-label="New milestone icon"
                value={newPhaseIcon}
                onChange={(e) => setNewPhaseIcon(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] text-[14px]"
              >
                {MILESTONE_ICON_CHOICES.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newPhaseCode}
                onChange={(e) => setNewPhaseCode(e.target.value)}
                placeholder="Code (e.g. P6)"
                className="w-24 px-3 py-1.5 rounded-xl border border-[#E6E8EE] text-[12.5px] font-mono"
              />
              <input
                type="text"
                value={newPhaseTitle}
                onChange={(e) => setNewPhaseTitle(e.target.value)}
                placeholder="Add standard milestone..."
                className="flex-1 min-w-[140px] px-3 py-1.5 rounded-xl border border-[#E6E8EE] text-[12.5px]"
              />
              <input
                type="number"
                value={newPhaseDuration}
                onChange={(e) => setNewPhaseDuration(Number(e.target.value))}
                min={1}
                max={90}
                className="w-16 px-2.5 py-1.5 rounded-xl border border-[#E6E8EE] text-[12.5px] font-mono"
                title="Duration (days)"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-full bg-[#0A4595] text-white text-[12.5px] font-medium"
              >
                Add
              </button>
            </form>
          </div>

          {/* Right: Standard Tasks & Priority / Gate Rules */}
          <div className="rounded-2xl border border-[#E6E8EE] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-medium text-[#121317]">
                Standard Tasks ({activeTpl.default_tasks_json.length})
              </h2>
              <span className="text-[12px] text-[#6E717A]">
                Default work breakdown
              </span>
            </div>

            <div className="divide-y divide-[#E6E8EE] max-h-80 overflow-y-auto pr-1">
              {activeTpl.default_tasks_json.map((tsk, idx) => {
                const prio =
                  tsk.priority ?? (tsk.is_gate_blocker ? 'high' : 'medium');
                return (
                  <div
                    key={`${tsk.milestone_key}-${idx}`}
                    className="py-2.5 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#121317] truncate">
                        {tsk.title}
                      </div>
                      <div className="text-[11.5px] text-[#6E717A] tabular-nums">
                        {tsk.default_role} · {tsk.duration_days}d
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tsk.is_gate_blocker && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-medium">
                          Gate
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize ${
                          prio === 'high'
                            ? 'bg-[#FCE8F3] text-[#9D174D]'
                            : prio === 'medium'
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : 'bg-[#DCFCE7] text-[#166534]'
                        }`}
                      >
                        {prio}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleAddTaskToTemplate}
              className="pt-3 border-t border-[#E6E8EE] flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add standard task..."
                className="flex-1 min-w-[150px] px-3 py-1.5 rounded-xl border border-[#E6E8EE] text-[12.5px]"
              />
              <select
                aria-label="Task priority"
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(e.target.value as TaskPriority)
                }
                className="px-2.5 py-1.5 rounded-xl border border-[#E6E8EE] text-[12px]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <label className="inline-flex items-center gap-1 text-[12px] text-[#45474D]">
                <input
                  type="checkbox"
                  checked={newTaskBlocker}
                  onChange={(e) => setNewTaskBlocker(e.target.checked)}
                  className="accent-[#0A4595]"
                />
                <span>Gate</span>
              </label>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-full bg-[#0A4595] text-white text-[12.5px] font-medium"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
