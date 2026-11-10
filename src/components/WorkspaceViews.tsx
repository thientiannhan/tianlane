import React, { useState } from 'react';
import {
  Bell,
  Check,
  Copy,
  KeyRound,
  Link2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  getUserProjectRole,
  isUserAdmin,
  isUserTeamPM,
  type BaselineRevisionEntry,
  type McpExecutionLog,
  type McpToolName,
  type OdooConnectionConfig,
  type Project,
  type ProjectMemberRole,
  type ProjectMilestone,
  type ProjectTask,
  type ProjectTemplate,
  type TaskPriority,
  type Team,
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
  activeTeam?: Team;
  onFilterByMember: (userId: string) => void;
  onUpdateMemberRole?: (
    userId: string,
    newRole: UserProfile['role']
  ) => Promise<void> | void;
  onUpdateProjectMemberRole?: (
    targetUser: UserProfile,
    newRole: ProjectMemberRole
  ) => void;
  onOpenCreateTeam?: () => void;
  onOpenMembersModal?: () => void;
  onOpenAuthModal?: () => void;
  onOpenUserProfile?: () => void;
}

const POSITION_CHOICES: UserProfile['role'][] = [
  'Owner',
  'Product Owner',
  'Tech Lead',
  'Senior Dev',
  'UI/UX Designer',
  'QA Engineer',
];

export const TeamView: React.FC<TeamViewProps> = ({
  users,
  tasks,
  currentUser,
  activeProject,
  activeTeam,
  onFilterByMember,
  onUpdateMemberRole,
  onUpdateProjectMemberRole,
  onOpenCreateTeam,
  onOpenMembersModal,
  onOpenAuthModal,
  onOpenUserProfile,
}) => {
  const isAdmin = isUserAdmin(currentUser);
  const isPm = isUserTeamPM(activeTeam, currentUser);
  const [showAllCompanyUsers, setShowAllCompanyUsers] = useState(false);

  // If in a team, default to team members unless Admin toggles to view whole directory
  const displayedUsers =
    !activeTeam || showAllCompanyUsers
      ? users
      : users.filter((u) => activeTeam.member_ids?.includes(u.id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E8EE] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#121317]">
              {activeTeam
                ? `${activeTeam.icon || '🏢'} ${activeTeam.name} · Roles & Access`
                : 'Team Directory & Project Access'}
            </h1>
            {isPm && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#EEF3FB] text-[#0A4595] border border-[#B7CDF5]">
                {isAdmin ? 'Admin' : 'Team PM'}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#45474D] mt-0.5">
            {isPm
              ? 'Manage member access roles (Owner, Writer, Viewer) and share invite links.'
              : 'Team member directory and project permissions.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onOpenCreateTeam && (
            <button
              type="button"
              onClick={onOpenCreateTeam}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[12px] font-medium transition-colors shadow-clean-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Team</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAllCompanyUsers((v) => !v)}
              className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12px] font-medium text-[#45474D] transition-colors"
            >
              {showAllCompanyUsers
                ? 'Show this team only'
                : 'Show all users (Admin)'}
            </button>
          )}

          {onOpenMembersModal && activeProject && (
            <button
              type="button"
              onClick={onOpenMembersModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#B7CDF5] bg-[#EEF3FB] hover:bg-[#E0EAFA] text-[#0A4595] text-[12px] font-medium transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Invite Link ({activeProject.code})</span>
            </button>
          )}

          {onOpenUserProfile && (
            <button
              type="button"
              onClick={onOpenUserProfile}
              className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] bg-white text-[12.5px] font-medium text-[#121317] transition-colors"
            >
              My Profile
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] bg-white shadow-clean-xs">
        {displayedUsers.map((member) => {
          const memberTasks = tasks.filter((t) => t.assignee_id === member.id);
          const doneCount = memberTasks.filter(
            (t) => t.kanban_status === 'done'
          ).length;
          const isCurrent = member.id === currentUser.id;
          const projRole = activeProject
            ? getUserProjectRole(activeProject, member)
            : 'viewer';
          const isTeamLead = activeTeam?.pm_ids?.includes(member.id);

          return (
            <div
              key={member.id}
              className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#F7F8FA] transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative w-10 h-10 rounded-full bg-[#0A4595] text-white flex items-center justify-center text-[13px] font-semibold shrink-0 overflow-hidden ring-2 ring-white">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{member.avatar_initials}</span>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      member.teams_status === 'available'
                        ? 'bg-[#188038]'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#121317]">
                      {member.full_name}
                    </span>
                    {isTeamLead && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EEF3FB] text-[#0A4595]">
                        PM Team
                      </span>
                    )}
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
                  <div className="text-[12px] font-mono text-[#6E717A]">
                    {member.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Position badge (customized by user in profile or admin in accounts) */}
                <span className="px-2.5 py-1 rounded-xl text-[12px] font-medium bg-[#F1F3F7] text-[#45474D]">
                  {member.role}
                </span>

                {/* Team & Project Access Role: Owner, Writer, Viewer */}
                {activeProject && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] text-[#6E717A]">Project Access:</span>
                    {(isAdmin || isPm) && onUpdateProjectMemberRole ? (
                      <select
                        value={projRole}
                        onChange={(e) =>
                          onUpdateProjectMemberRole(
                            member,
                            e.target.value as ProjectMemberRole
                          )
                        }
                        className="px-2.5 py-1 text-[12px] font-medium rounded-xl border border-[#E6E8EE] bg-white text-[#121317] hover:border-[#0A4595] focus:outline-none transition-colors"
                        title="Update project access role (Owner, Writer, Viewer)"
                      >
                        <option value="owner">Owner</option>
                        <option value="writer">Writer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase ${
                          projRole === 'owner'
                            ? 'bg-amber-100 text-amber-800'
                            : projRole === 'writer'
                            ? 'bg-[#EEF3FB] text-[#0A4595]'
                            : 'bg-[#F1F3F7] text-[#45474D]'
                        }`}
                      >
                        {projRole}
                      </span>
                    )}
                  </div>
                )}

                <span className="text-[12px] text-[#6E717A] tabular-nums">
                  {doneCount}/{memberTasks.length} tasks
                </span>

                <button
                  type="button"
                  onClick={() => onFilterByMember(member.id)}
                  className="px-3 py-1 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12px] text-[#121317] transition-colors"
                >
                  Tasks
                </button>

                {isCurrent && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF3FB] text-[#0A4595]">
                    Active session
                  </span>
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

/* ============================================================================
 * 5. ACCOUNT MANAGEMENT VIEW (Admin Directory, Role Assignment & Password Reset)
 * ============================================================================ */
interface AccountManagementViewProps {
  users: UserProfile[];
  teams: Team[];
  currentUser: UserProfile;
  onResetPassword: (user: UserProfile) => Promise<void> | void;
  onUpdateUserRole: (
    userId: string,
    newRole: UserProfile['role']
  ) => Promise<void> | void;
  onSelectUserLogin?: (user: UserProfile) => void;
  onOpenUserProfile?: () => void;
  onCreateAccount?: (newUser: UserProfile, assignTeamIds: string[]) => Promise<void> | void;
}

export const AccountManagementView: React.FC<AccountManagementViewProps> = ({
  users,
  teams,
  currentUser,
  onResetPassword,
  onUpdateUserRole,
  onSelectUserLogin,
  onOpenUserProfile,
  onCreateAccount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserProfile['role']>('all');
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [resetSuccessNotice, setResetSuccessNotice] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<UserProfile['role']>('Owner');
  const [createIsAdmin, setCreateIsAdmin] = useState(true);
  const [createTeamIds, setCreateTeamIds] = useState<string[]>([]);
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const currentYear = new Date().getFullYear();

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanName = createName.trim();
    let cleanEmail = createEmail.trim().toLowerCase();
    if (!cleanName) {
      setCreateError('Please enter full name.');
      return;
    }
    if (!cleanEmail) {
      setCreateError('Please enter email.');
      return;
    }
    if (!cleanEmail.includes('@')) {
      cleanEmail = `${cleanEmail}@logtechub.com`;
    }
    const exists = users.some(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (exists) {
      setCreateError(`Account ${cleanEmail} already exists.`);
      return;
    }

    const username = cleanEmail.split('@')[0];
    const initials =
      cleanName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'LT';

    const newUser: UserProfile = {
      id: `usr-${username.replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      microsoft_entra_id: `entra-${Date.now()}`,
      full_name: cleanName,
      email: cleanEmail,
      avatar_initials: initials,
      role: createRole,
      is_admin: createIsAdmin || createRole === 'Owner',
      teams_status: 'available',
      teams_webhook_url: '',
      password: createPassword.trim() || `${username}${currentYear}`,
    };

    setIsSubmittingCreate(true);
    try {
      if (onCreateAccount) {
        await onCreateAccount(newUser, createTeamIds);
      }
      setShowCreateModal(false);
      setResetSuccessNotice(
        `Created account ${newUser.full_name} (${newUser.email}) with role ${newUser.role}. Default password: ${newUser.password}`
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    if (
      q &&
      !u.full_name.toLowerCase().includes(q) &&
      !u.email.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (roleFilter !== 'all' && u.role !== roleFilter) {
      return false;
    }
    return true;
  });

  const handleTriggerReset = async (u: UserProfile) => {
    const username = u.email.split('@')[0];
    const defaultPassword = `${username}${currentYear}`;
    const confirmed = confirm(
      `Reset password for ${u.full_name} (${u.email})?\n\nPassword will revert to default format: ${defaultPassword}`
    );
    if (!confirmed) return;

    setResettingEmail(u.email);
    try {
      await onResetPassword(u);
      setResetSuccessNotice(
        `Password for ${u.full_name} has been reset to default: ${defaultPassword}`
      );
      setTimeout(() => {
        setResetSuccessNotice(null);
      }, 6000);
    } finally {
      setResettingEmail(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E8EE] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEF3FB] text-[#0A4595] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-[20px] font-semibold text-[#121317]">
              Account Directory &amp; Access
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-800 uppercase">
              Admin Control
            </span>
          </div>
          <p className="text-[13px] text-[#45474D] mt-1">
            Corporate directory (@logtechub.com), role assignments, and password reset to default format (<span className="font-mono text-[#0A4595]">&lt;username&gt;{currentYear}</span>).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onCreateAccount && (
            <button
              type="button"
              onClick={() => {
                setCreateName('');
                setCreateEmail('');
                setCreateRole('Owner');
                setCreateIsAdmin(true);
                setCreateTeamIds(teams.map((t) => t.id));
                setCreatePassword('');
                setCreateError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[12.5px] font-medium transition-colors shadow-clean-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Account</span>
            </button>
          )}

          {onOpenUserProfile && (
            <button
              type="button"
              onClick={onOpenUserProfile}
              className="px-4 py-2 rounded-full border border-[#0A4595] text-[#0A4595] hover:bg-[#EEF3FB] text-[12.5px] font-medium transition-colors"
            >
              My Profile
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {resetSuccessNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{resetSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setResetSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-[12px] underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#F7F8FA] border border-[#E6E8EE]">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#6E717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or @logtechub.com email..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] placeholder:text-[#6E717A] focus:outline-none focus:border-[#0A4595]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#6E717A]">Filter role:</span>
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as 'all' | UserProfile['role'])
            }
            className="px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317] focus:outline-none focus:border-[#0A4595]"
          >
            <option value="all">All roles ({users.length})</option>
            {POSITION_CHOICES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Accounts List */}
      <div className="divide-y divide-[#E6E8EE] rounded-3xl border border-[#E6E8EE] bg-white shadow-clean-xs overflow-hidden">
        {filteredUsers.map((u) => {
          const username = u.email.split('@')[0];
          const isCurrent = currentUser.id === u.id;
          const isUserAdm = isUserAdmin(u);
          const userTeams = teams.filter(
            (t) => t.member_ids?.includes(u.id) || t.pm_ids?.includes(u.id)
          );

          return (
            <div
              key={u.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                isCurrent ? 'bg-[#EEF3FB]/30' : 'hover:bg-[#F7F8FA]'
              }`}
            >
              {/* User Identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-10 h-10 rounded-full bg-[#0A4595] text-white flex items-center justify-center font-semibold text-[13px] shrink-0 overflow-hidden">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={u.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{u.avatar_initials}</span>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                      u.teams_status === 'available'
                        ? 'bg-[#188038]'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14.5px] font-semibold text-[#121317] truncate">
                      {u.full_name}
                    </span>
                    {isUserAdm && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        Admin
                      </span>
                    )}
                    {isCurrent && (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-[#EEF3FB] text-[#0A4595]">
                        Active session
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] font-mono text-[#6E717A]">
                    {u.email}
                  </div>

                  {/* Teams tag list */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {userTeams.length > 0 ? (
                      userTeams.map((tm) => (
                        <span
                          key={tm.id}
                          className="px-2 py-0.2 rounded-full text-[10px] font-medium bg-[#F1F3F7] text-[#45474D]"
                        >
                          {tm.icon || '🏢'} {tm.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#6E717A] italic">
                        No team assigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Role selection */}
              <div className="flex items-center gap-2.5 flex-wrap sm:justify-end">
                {/* Position Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11.5px] text-[#6E717A]">Role:</span>
                  <select
                    value={u.role}
                    onChange={(e) =>
                      onUpdateUserRole(
                        u.id,
                        e.target.value as UserProfile['role']
                      )
                    }
                    className="px-2.5 py-1 text-[12px] font-medium rounded-xl border border-[#E6E8EE] bg-white text-[#121317] hover:border-[#0A4595] focus:outline-none transition-colors"
                  >
                    {POSITION_CHOICES.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reset Password Button */}
                <button
                  type="button"
                  disabled={resettingEmail === u.email}
                  onClick={() => handleTriggerReset(u)}
                  title={`Reset password to default (${username}${currentYear})`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-[12px] font-medium transition-colors shadow-clean-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    {resettingEmail === u.email
                      ? 'Resetting...'
                      : 'Reset Password'}
                  </span>
                </button>

                {/* Quick login switch */}
                {onSelectUserLogin && !isCurrent && (
                  <button
                    type="button"
                    onClick={() => onSelectUserLogin(u)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] bg-white text-[#45474D] hover:text-[#0A4595] text-[12px] font-medium transition-colors shadow-clean-xs"
                    title={`Switch active session to ${u.full_name}`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Switch Account</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Account Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-account-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[#121317]">
            <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between bg-[#F7F8FA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#0A4595] text-white flex items-center justify-center text-[13px] font-semibold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="create-account-title"
                    className="text-[15px] font-semibold text-[#121317]"
                  >
                    Add Corporate Account
                  </h2>
                  <p className="text-[11.5px] text-[#6E717A]">
                    Create new access credentials and team permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
                className="p-1.5 rounded-full text-[#6E717A] hover:text-[#121317] hover:bg-[#E6E8EE] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {createError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
                >
                  {createError}
                </div>
              )}

              <div>
                <label
                  htmlFor="new-account-name"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Full Name
                </label>
                <input
                  id="new-account-name"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Victor Nguyen"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="new-account-email"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Corporate Email
                </label>
                <input
                  id="new-account-email"
                  type="text"
                  required
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="victor.nguyen@logtechub.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="new-account-role"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Position / Role
                </label>
                <select
                  id="new-account-role"
                  value={createRole}
                  onChange={(e) => {
                    const r = e.target.value as UserProfile['role'];
                    setCreateRole(r);
                    if (r === 'Owner') setCreateIsAdmin(true);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] bg-white outline-none"
                >
                  {POSITION_CHOICES.map((r) => (
                    <option key={r} value={r}>
                      {r} {r === 'Owner' ? '(Full Admin Rights)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#E6E8EE] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-medium text-[#121317]">
                  <input
                    type="checkbox"
                    checked={createIsAdmin || createRole === 'Owner'}
                    disabled={createRole === 'Owner'}
                    onChange={(e) => setCreateIsAdmin(e.target.checked)}
                    className="rounded border-[#E6E8EE] text-[#0A4595] focus:ring-[#0A4595]"
                  />
                  <span>Admin &amp; Owner Privileges</span>
                </label>
                <p className="text-[11px] text-[#6E717A] ml-5">
                  Allows managing teams, editing directory accounts, and project administration.
                </p>
              </div>

              {teams.length > 0 && (
                <div>
                  <label className="block text-[12px] font-medium text-[#45474D] mb-1.5">
                    Assign to Teams
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA]">
                    {teams.map((tm) => {
                      const isChecked = createTeamIds.includes(tm.id);
                      return (
                        <label
                          key={tm.id}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white text-[12px] cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setCreateTeamIds((prev) =>
                                  isChecked
                                    ? prev.filter((id) => id !== tm.id)
                                    : [...prev, tm.id]
                                );
                              }}
                              className="rounded border-[#E6E8EE] text-[#0A4595] focus:ring-[#0A4595]"
                            />
                            <span className="font-medium text-[#121317]">
                              {tm.icon || '🏢'} {tm.name}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-[#6E717A] font-mono">
                            {tm.code}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="new-account-password"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Initial Password (Optional)
                </label>
                <input
                  id="new-account-password"
                  type="text"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder={`Defaults to <username>${currentYear}`}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none font-mono"
                />
                <p className="text-[11px] text-[#6E717A] mt-1">
                  Leave blank to auto-generate standard corporate format (<span className="font-mono text-[#0A4595]">&lt;username&gt;{currentYear}</span>).
                </p>
              </div>

              <div className="pt-3 border-t border-[#E6E8EE] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 rounded-full border border-[#E6E8EE] hover:bg-[#F1F3F7] text-[13px] font-medium text-[#45474D] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] disabled:opacity-60 text-white text-[13px] font-medium transition-colors"
                >
                  {isSubmittingCreate ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
