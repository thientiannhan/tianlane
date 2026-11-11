import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Plus, Upload, X } from 'lucide-react';
import type {
  KanbanStatus,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  TaskAssigneeInfo,
  TaskPriority,
  TaskRoleType,
  UserProfile,
} from '../types.ts';
import { getTaskAssignees } from '../types.ts';
import {
  canCloseMilestoneGate,
  validateAttachmentFileSize,
} from '../engine/scheduleEngine.ts';
import { KANBAN_COLUMNS } from './KanbanView.tsx';

interface DetailDrawerProps {
  selectedTask: ProjectTask | null;
  selectedMilestone: ProjectMilestone | null;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  users: UserProfile[];
  documents: ProjectDocument[];
  odooBaseUrl: string;
  onClose: () => void;
  onUpdateTask: (updated: ProjectTask) => void;
  onToggleMilestoneClosed: (milestoneId: string) => void;
  onAddDocument: (doc: Omit<ProjectDocument, 'id' | 'uploaded_at'>) => void;
  currentUser: UserProfile | null;
  onOpenTaskModal?: (task?: ProjectTask | null, defaultMilestoneId?: string) => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  selectedTask,
  selectedMilestone,
  milestones,
  tasks,
  users,
  documents,
  odooBaseUrl,
  onClose,
  onUpdateTask,
  onToggleMilestoneClosed,
  onAddDocument,
  currentUser,
  onOpenTaskModal,
}) => {
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [odooIdInput, setOdooIdInput] = useState(
    selectedTask?.odoo_task_id ? String(selectedTask.odoo_task_id) : ''
  );
  const [docNameInput, setDocNameInput] = useState('');
  const [docVersionInput, setDocVersionInput] = useState('v1.0');
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!selectedTask && !selectedMilestone) return null;

  const activeMilestone =
    selectedMilestone ??
    milestones.find((m) => m.id === selectedTask?.milestone_id) ??
    null;

  const milestoneTasks = activeMilestone
    ? tasks.filter((t) => t.milestone_id === activeMilestone.id)
    : [];

  const gateStatus = activeMilestone
    ? canCloseMilestoneGate(activeMilestone, milestoneTasks, documents)
    : { allowed: true, blockers: [] };

  const relatedDocs = documents.filter((d) =>
    selectedTask
      ? d.task_id === selectedTask.id ||
        d.milestone_id === selectedTask.milestone_id
      : d.milestone_id === activeMilestone?.id
  );

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newChecklistLabel.trim()) return;
    const nextItem = {
      id: `chk-${Date.now()}`,
      label: newChecklistLabel.trim(),
      done: false,
    };
    onUpdateTask({
      ...selectedTask,
      checklist: [...selectedTask.checklist, nextItem],
    });
    setNewChecklistLabel('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!selectedTask) return;
    onUpdateTask({
      ...selectedTask,
      checklist: selectedTask.checklist.map((c) =>
        c.id === itemId ? { ...c, done: !c.done } : c
      ),
    });
  };

  const handleLinkOdooManual = () => {
    if (!selectedTask) return;
    const parsed = Number.parseInt(odooIdInput, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    onUpdateTask({
      ...selectedTask,
      odoo_task_id: parsed,
      odoo_task_url: `${odooBaseUrl}/web#id=${parsed}&model=project.task&view_type=form`,
      odoo_stage_name: selectedTask.odoo_stage_name ?? 'In Progress',
      last_synced_at: new Date().toISOString(),
    });
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeMilestone) return;
    const check = validateAttachmentFileSize(file.size);
    if (!check.valid) {
      setUploadError(check.error ?? 'Invalid file.');
      return;
    }
    setUploadError(null);
    onAddDocument({
      project_id: activeMilestone.project_id,
      milestone_id: activeMilestone.id,
      task_id: selectedTask?.id ?? null,
      file_name: file.name,
      file_url: `https://storage.tianlane.vn/buckets/deliverables/${encodeURIComponent(
        file.name
      )}`,
      file_size_bytes: file.size,
      version_tag: docVersionInput || 'v1.0',
      doc_type: 'PRD',
      uploaded_by: currentUser?.full_name || 'James Nhan',
    });
    e.target.value = '';
  };

  const handleExternalDocAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMilestone || !docNameInput.trim()) return;
    setUploadError(null);
    onAddDocument({
      project_id: activeMilestone.project_id,
      milestone_id: activeMilestone.id,
      task_id: selectedTask?.id ?? null,
      file_name: docNameInput.trim(),
      file_url: `https://sharepoint.tianlane.vn/docs/${encodeURIComponent(
        docNameInput.trim()
      )}`,
      file_size_bytes: 2_400_000,
      version_tag: docVersionInput || 'v1.0',
      doc_type: 'External Link',
      uploaded_by: currentUser?.full_name || 'James Nhan',
    });
    setDocNameInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Details"
    >
      <div className="w-full max-w-lg bg-white h-full border-l border-[#E6E8EE] shadow-clean-lg flex flex-col">
        <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono text-[#45474D] tabular-nums">
                {selectedTask ? selectedTask.code : activeMilestone?.code}
              </span>
              {selectedTask?.tags?.includes('AI-created') && (
                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10.5px] font-medium border border-purple-200">
                  AI-created
                </span>
              )}
            </div>
            <h2 className="text-[16px] font-medium text-[#121317] mt-0.5 line-clamp-1">
              {selectedTask ? selectedTask.title : activeMilestone?.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-[#F1F3F7]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[13.5px]">
          {selectedTask && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-[#45474D] mb-1">
                    Status
                  </label>
                  <select
                    value={selectedTask.kanban_status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as KanbanStatus;
                      onUpdateTask({
                        ...selectedTask,
                        kanban_status: nextStatus,
                        is_completed: nextStatus === 'done',
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    {KANBAN_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] text-[#45474D] mb-1">
                    Priority
                  </label>
                  <select
                    value={
                      selectedTask.priority ??
                      (selectedTask.is_gate_blocker ? 'high' : 'medium')
                    }
                    onChange={(e) =>
                      onUpdateTask({
                        ...selectedTask,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Multi-Assignee & Functional Roles */}
              {(() => {
                const taskAssignees = getTaskAssignees(selectedTask, users);
                const unassignedUsers = users.filter(
                  (u) => !taskAssignees.some((ta) => ta.user.id === u.id)
                );

                const handleAddUser = (uid: string) => {
                  if (!uid) return;
                  const targetUser = users.find((u) => u.id === uid);
                  let defRole: TaskRoleType = 'Assignee';
                  if (targetUser) {
                    if (targetUser.role.includes('QA') || targetUser.role.includes('QC')) defRole = 'QC';
                    else if (targetUser.role.includes('Dev') || targetUser.role.includes('Lead')) defRole = 'Developer';
                    else if (targetUser.role.includes('Owner') || targetUser.role.includes('PO') || targetUser.role.includes('Analyst')) defRole = 'BA';
                  }
                  const nextRoles = [
                    ...taskAssignees.map((ta) => ({ user_id: ta.user.id, role: ta.role })),
                    { user_id: uid, role: defRole },
                  ];
                  onUpdateTask({
                    ...selectedTask,
                    assignee_id: nextRoles[0].user_id,
                    assignee_ids: nextRoles.map((r) => r.user_id),
                    assignee_roles: nextRoles,
                  });
                };

                const handleRemoveUser = (uid: string) => {
                  if (taskAssignees.length <= 1) return;
                  const nextRoles = taskAssignees
                    .filter((ta) => ta.user.id !== uid)
                    .map((ta) => ({ user_id: ta.user.id, role: ta.role }));
                  onUpdateTask({
                    ...selectedTask,
                    assignee_id: nextRoles[0].user_id,
                    assignee_ids: nextRoles.map((r) => r.user_id),
                    assignee_roles: nextRoles,
                  });
                };

                const handleChangeRole = (uid: string, newRole: TaskRoleType) => {
                  const nextRoles = taskAssignees.map((ta) => ({
                    user_id: ta.user.id,
                    role: ta.user.id === uid ? newRole : ta.role,
                  }));
                  onUpdateTask({
                    ...selectedTask,
                    assignee_roles: nextRoles,
                  });
                };

                return (
                  <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-[#E6E8EE] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[12.5px] font-semibold text-[#121317] flex items-center gap-2">
                        <span>Assignees &amp; Functional Roles</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#0A4595]/10 text-[#0A4595] text-[11px] font-semibold">
                          {taskAssignees.length} members
                        </span>
                      </label>
                      <span className="text-[11px] text-[#6E717A]">
                        Assignee • BA • Dev • QC
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {taskAssignees.map((item) => {
                        const roleBadgeClass =
                          item.role === 'QC'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.role === 'Developer'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : item.role === 'BA'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200';
                        return (
                          <div
                            key={item.user.id}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6E8EE] shadow-clean-xs text-[12.5px]"
                          >
                            <span className="w-5 h-5 rounded-full bg-[#0A4595] text-white text-[9px] font-bold inline-flex items-center justify-center shrink-0">
                              {item.user.avatar_initials}
                            </span>
                            <span className="font-medium text-[#121317]">
                              {item.user.full_name}
                            </span>
                            <select
                              value={item.role}
                              onChange={(e) =>
                                handleChangeRole(
                                  item.user.id,
                                  e.target.value as TaskRoleType
                                )
                              }
                              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${roleBadgeClass} cursor-pointer focus:outline-none`}
                            >
                              <option value="Assignee">Assignee</option>
                              <option value="BA">BA</option>
                              <option value="Developer">Developer</option>
                              <option value="QC">QC</option>
                            </select>
                            {taskAssignees.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveUser(item.user.id)}
                                className="text-[#9CA3AF] hover:text-rose-600 transition-colors p-0.5"
                                title="Remove member"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {unassignedUsers.length > 0 && (
                      <div className="pt-1">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddUser(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-dashed border-[#B7BFD9] bg-white text-[12px] text-[#45474D] hover:border-[#0A4595] focus:outline-none transition-colors"
                        >
                          <option value="" disabled>+ Add Assignee, BA, QC, Developer...</option>
                          {unassignedUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] cursor-pointer">
                <div>
                  <div className="text-[13px] font-medium text-[#121317]">
                    Phase-Gate Blocker
                  </div>
                  <p className="text-[12px] text-[#45474D]">
                    Prevents closing milestone until this task is done
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedTask.is_gate_blocker}
                  onChange={(e) =>
                    onUpdateTask({
                      ...selectedTask,
                      is_gate_blocker: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#0A4595]"
                />
              </label>

              <div className="space-y-2 pt-2 border-t border-[#E6E8EE]">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#121317]">
                    Execution Tracker Link
                  </span>
                  {selectedTask.odoo_task_id && (
                    <a
                      href={selectedTask.odoo_task_url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12.5px] font-mono text-[#0A4595] hover:underline tabular-nums"
                    >
                      <span>Open Tracker #{selectedTask.odoo_task_id}</span>
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                  {selectedTask.tags?.includes('AI-created') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-medium">
                      Tag: AI-created (Odoo #57)
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    value={odooIdInput}
                    onChange={(e) => setOdooIdInput(e.target.value)}
                    placeholder="Tracker Task ID (e.g. 4520)"
                    className="flex-1 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] text-[13px] font-mono text-[#121317] tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={handleLinkOdooManual}
                    className="px-4 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12.5px] font-medium text-[#121317]"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#E6E8EE]">
                <span className="text-[13px] font-medium text-[#121317] tabular-nums">
                  Checklist (
                  {selectedTask.checklist.filter((c) => c.done).length}/
                  {selectedTask.checklist.length})
                </span>

                <div className="divide-y divide-[#E6E8EE] rounded-xl border border-[#E6E8EE]">
                  {selectedTask.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] cursor-pointer hover:bg-[#F7F8FA]"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklistItem(item.id)}
                        className="w-3.5 h-3.5 accent-[#0A4595]"
                      />
                      <span
                        className={
                          item.done
                            ? 'line-through text-[#45474D]'
                            : 'text-[#121317]'
                        }
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>

                <form onSubmit={handleAddChecklist} className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistLabel}
                    onChange={(e) => setNewChecklistLabel(e.target.value)}
                    placeholder="Add checklist item..."
                    className="flex-1 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] text-[13px] text-[#121317]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12.5px] font-medium text-[#121317]"
                  >
                    Add
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Milestone Tasks Hierarchy: Project > Milestone > Task */}
          {activeMilestone && (
            <div className="space-y-3 pt-2 border-t border-[#E6E8EE]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-semibold text-[#121317]">
                    Milestone Tasks ({milestoneTasks.length})
                  </span>
                  <div className="text-[11.5px] text-[#6E717A]">
                    Tasks governed under {activeMilestone.code}
                  </div>
                </div>

                {onOpenTaskModal && (
                  <button
                    type="button"
                    onClick={() => onOpenTaskModal(null, activeMilestone.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12px] font-medium transition-colors shadow-clean-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Task</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] bg-white overflow-hidden">
                {milestoneTasks.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-[12.5px] text-[#6E717A]">
                      No tasks in this milestone yet.
                    </p>
                    {onOpenTaskModal && (
                      <button
                        type="button"
                        onClick={() => onOpenTaskModal(null, activeMilestone.id)}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#0A4595] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add first task</span>
                      </button>
                    )}
                  </div>
                ) : (
                  milestoneTasks.map((t) => {
                    const assignee = users.find((u) => u.id === t.assignee_id);
                    return (
                      <div
                        key={t.id}
                        className="p-3 hover:bg-[#F7F8FA] flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                        onClick={() => {
                          if (onOpenTaskModal) {
                            onOpenTaskModal(t, activeMilestone.id);
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-[#0A4595] font-semibold">
                              {t.code}
                            </span>
                            <span className="text-[13px] font-medium text-[#121317] truncate group-hover:text-[#0A4595] transition-colors">
                              {t.title}
                            </span>
                            {t.is_gate_blocker && (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                Blocker
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11.5px] text-[#6E717A]">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium ${
                                t.kanban_status === 'done'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : t.kanban_status === 'in_progress'
                                  ? 'bg-blue-50 text-blue-700'
                                  : t.kanban_status === 'review'
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {t.kanban_status}
                            </span>
                            {assignee && (
                              <span>· {assignee.full_name}</span>
                            )}
                            {t.odoo_task_id && (
                              <span className="font-mono text-[#0A4595]">
                                · Odoo #{t.odoo_task_id}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenTaskModal) {
                              onOpenTaskModal(t, activeMilestone.id);
                            }
                          }}
                          className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border border-[#E6E8EE] hover:border-[#0A4595] hover:text-[#0A4595] bg-white transition-colors shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeMilestone && (
            <div className="p-4 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#121317]">
                  Phase Gate · {activeMilestone.code}
                </span>
                <button
                  type="button"
                  disabled={!gateStatus.allowed && !activeMilestone.is_closed}
                  onClick={() => onToggleMilestoneClosed(activeMilestone.id)}
                  className={`px-3.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                    activeMilestone.is_closed
                      ? 'bg-[#121317] text-white'
                      : gateStatus.allowed
                      ? 'bg-[#0A4595] hover:bg-[#083778] text-white'
                      : 'bg-[#E6E8EE] text-[#45474D] cursor-not-allowed'
                  }`}
                >
                  {activeMilestone.is_closed ? 'Gate closed' : 'Close gate'}
                </button>
              </div>

              {!gateStatus.allowed ? (
                <ul className="space-y-1 text-[12px] text-[#45474D]">
                  {gateStatus.blockers.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-[#45474D]">
                  Ready to close milestone gate.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-[#E6E8EE]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[#121317]">
                Documents (50 MB max)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12px] font-medium text-[#121317] cursor-pointer">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Upload</span>
                <input
                  type="file"
                  onChange={handleFileUploadChange}
                  className="hidden"
                />
              </label>
            </div>

            {uploadError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D93025] text-[12px] text-[#D93025]"
              >
                {uploadError}
              </div>
            )}

            <div className="divide-y divide-[#E6E8EE] rounded-xl border border-[#E6E8EE]">
              {relatedDocs.length === 0 ? (
                <div className="p-3.5 text-[12.5px] text-[#45474D]">
                  No documents attached.
                </div>
              ) : (
                relatedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 flex items-center justify-between gap-2 text-[12.5px]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#121317] truncate">
                        {doc.file_name}{' '}
                        <span className="font-mono text-[11px] text-[#45474D]">
                          ({doc.version_tag})
                        </span>
                      </div>
                      <div className="text-[11.5px] text-[#45474D] tabular-nums">
                        {(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB ·{' '}
                        {doc.uploaded_by}
                      </div>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-full hover:bg-[#F1F3F7] text-[#45474D] hover:text-[#121317]"
                      aria-label={`Open ${doc.file_name}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleExternalDocAdd} className="flex gap-2">
              <input
                type="text"
                value={docNameInput}
                onChange={(e) => setDocNameInput(e.target.value)}
                placeholder="Document name or link..."
                className="flex-1 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] text-[12.5px] text-[#121317]"
              />
              <input
                type="text"
                value={docVersionInput}
                onChange={(e) => setDocVersionInput(e.target.value)}
                placeholder="v1.0"
                className="w-16 px-3 py-1.5 rounded-full border border-[#E6E8EE] text-[12.5px] font-mono text-[#121317]"
              />
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
