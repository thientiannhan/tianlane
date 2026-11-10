import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  ExternalLink,
  Link2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChecklistItem,
  KanbanStatus,
  Project,
  ProjectMilestone,
  ProjectTask,
  TaskPriority,
  UserProfile,
} from '../types.ts';
import { mapKanbanToOdooStage } from '../engine/scheduleEngine.ts';

interface TaskModalProps {
  isOpen: boolean;
  task: ProjectTask | null; // null = create new, non-null = edit existing
  defaultMilestoneId?: string;
  project: Project;
  milestones: ProjectMilestone[];
  users: UserProfile[];
  existingTasks: ProjectTask[];
  odooBaseUrl: string;
  onClose: () => void;
  onSave: (task: ProjectTask) => void;
  onDelete?: (taskId: string) => void;
}

const KANBAN_STATUS_OPTIONS: { id: KanbanStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'In Review' },
  { id: 'done', label: 'Done' },
  { id: 'backlog', label: 'Backlog' },
];

const PRIORITY_OPTIONS: { id: TaskPriority; label: string; color: string }[] = [
  { id: 'low', label: 'Low', color: 'text-slate-600 bg-slate-100' },
  { id: 'medium', label: 'Medium', color: 'text-amber-700 bg-amber-50' },
  { id: 'high', label: 'High (Blocker)', color: 'text-rose-700 bg-rose-50' },
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  defaultMilestoneId,
  project,
  milestones,
  users,
  existingTasks,
  odooBaseUrl,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditing = Boolean(task);

  const [milestoneId, setMilestoneId] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [kanbanStatus, setKanbanStatus] = useState<KanbanStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [isGateBlocker, setIsGateBlocker] = useState<boolean>(false);
  const [plannedStart, setPlannedStart] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [odooTaskId, setOdooTaskId] = useState<string>('');
  const [odooTaskUrl, setOdooTaskUrl] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form state whenever modal opens or task changes
  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setMilestoneId(task.milestone_id);
      setCode(task.code);
      setTitle(task.title);
      setDescription(task.description || '');
      setKanbanStatus(task.kanban_status);
      setPriority(task.priority || 'medium');
      setAssigneeId(task.assignee_id || users[0]?.id || '');
      setIsGateBlocker(Boolean(task.is_gate_blocker));
      setPlannedStart(task.planned_start || '');
      setDueDate(task.due_date || '');
      setOdooTaskId(task.odoo_task_id ? String(task.odoo_task_id) : '');
      setOdooTaskUrl(task.odoo_task_url || '');
      setChecklist(task.checklist || []);
    } else {
      const targetMs =
        milestones.find((m) => m.id === defaultMilestoneId) ??
        milestones[0];
      const selectedMsId = targetMs?.id ?? '';
      const nextNum = existingTasks.length + 1;
      const genCode = `${project.code}-T${String(nextNum).padStart(2, '0')}`;
      const defaultStart = targetMs?.actual_start || new Date().toISOString().slice(0, 10);
      const defaultEnd = targetMs?.actual_end || defaultStart;

      setMilestoneId(selectedMsId);
      setCode(genCode);
      setTitle('');
      setDescription('');
      setKanbanStatus('todo');
      setPriority('medium');
      setAssigneeId(users[0]?.id || '');
      setIsGateBlocker(false);
      setPlannedStart(defaultStart);
      setDueDate(defaultEnd);
      setOdooTaskId('');
      setOdooTaskUrl('');
      setChecklist([
        { id: `chk-${Date.now()}-1`, label: 'Verify deliverable completion', done: false },
      ]);
    }
    setErrorMsg(null);
    setNewChecklistText('');
  }, [isOpen, task, defaultMilestoneId, project, milestones, users, existingTasks]);

  const handleOdooIdChange = (idVal: string) => {
    setOdooTaskId(idVal);
    const cleanId = idVal.trim();
    if (cleanId && !isNaN(Number(cleanId))) {
      setOdooTaskUrl(
        `${odooBaseUrl}/web#id=${cleanId}&model=project.task&view_type=form`
      );
    } else if (!cleanId) {
      setOdooTaskUrl('');
    }
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = newChecklistText.trim();
    if (!txt) return;
    setChecklist((prev) => [
      ...prev,
      { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: txt, done: false },
    ]);
    setNewChecklistText('');
  };

  const handleToggleChecklist = (chkId: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === chkId ? { ...c, done: !c.done } : c))
    );
  };

  const handleRemoveChecklist = (chkId: string) => {
    setChecklist((prev) => prev.filter((c) => c.id !== chkId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a task title.');
      return;
    }
    if (!milestoneId) {
      setErrorMsg('Please select a parent milestone for this task.');
      return;
    }

    const numericOdooId = odooTaskId.trim() ? parseInt(odooTaskId.trim(), 10) : null;
    const isCompleted = kanbanStatus === 'done';

    const savedTask: ProjectTask = {
      id: task?.id || `task-${Date.now()}`,
      project_id: project.id,
      milestone_id: milestoneId,
      code: code.trim() || `${project.code}-T00`,
      title: title.trim(),
      description: description.trim(),
      kanban_status: kanbanStatus,
      priority,
      is_completed: isCompleted,
      is_gate_blocker: isGateBlocker,
      assignee_id: assigneeId,
      planned_start: plannedStart || new Date().toISOString().slice(0, 10),
      due_date: dueDate || plannedStart || new Date().toISOString().slice(0, 10),
      actual_start: task?.actual_start || plannedStart,
      actual_end: dueDate || plannedStart,
      float_days: task?.float_days ?? (isGateBlocker ? 0 : 2),
      odoo_task_id: isNaN(numericOdooId as number) ? null : numericOdooId,
      odoo_task_url: odooTaskUrl.trim() || null,
      odoo_stage_name: mapKanbanToOdooStage(kanbanStatus),
      effective_hours: task?.effective_hours || 0,
      last_synced_at: task?.last_synced_at || null,
      checklist,
    };

    onSave(savedTask);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-3xl border border-[#E6E8EE] shadow-clean-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#E6E8EE] flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#EEF3FB] text-[#0A4595] border border-[#B7CDF5]">
                {project.code}
              </span>
              <h2 className="text-[17px] font-semibold text-[#121317]">
                {isEditing ? `Edit Task · ${task?.code}` : 'New Task'}
              </h2>
            </div>
            <p className="text-[12.5px] text-[#6E717A] mt-0.5">
              Hierarchy: {project.name} &gt; Milestone &gt; Task (Odoo Sync)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E717A] hover:text-[#121317] hover:bg-[#F1F3F7] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Milestone & Task Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[12.5px] font-medium text-[#121317] flex items-center justify-between">
                <span>Parent Milestone <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors"
                required
              >
                <option value="" disabled>-- Select Milestone --</option>
                {milestones.map((ms) => (
                  <option key={ms.id} value={ms.id}>
                    {ms.code} · {ms.title} ({ms.progress_pct}%)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[12.5px] font-medium text-[#121317]">
                Task Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="19-03-T10"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] font-mono text-[13px] text-[#121317] focus:outline-none focus:border-[#0A4595] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Title */}
          <div className="space-y-1">
            <label className="text-[12.5px] font-medium text-[#121317]">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Data Flow Diagram and Odoo API Spec"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] text-[#121317] placeholder:text-[#6E717A] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors"
              required
            />
          </div>

          {/* Row 3: Description */}
          <div className="space-y-1">
            <label className="text-[12.5px] font-medium text-[#121317]">
              Description &amp; Acceptance Criteria
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Technical specifications, deliverable requirements, or reference links..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13px] text-[#121317] placeholder:text-[#6E717A] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors resize-none"
            />
          </div>

          {/* Row 4: Assignee, Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[12.5px] font-medium text-[#121317]">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[12.5px] font-medium text-[#121317]">
                Kanban Status
              </label>
              <select
                value={kanbanStatus}
                onChange={(e) => setKanbanStatus(e.target.value as KanbanStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors"
              >
                {KANBAN_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[12.5px] font-medium text-[#121317]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] hover:border-[#B7BFD9] focus:outline-none focus:border-[#0A4595] transition-colors"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Planned Start, Due Date & Phase Gate Blocker */}
          <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-[#E6E8EE] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#45474D]">
                  Planned Start Date
                </label>
                <input
                  type="date"
                  value={plannedStart}
                  onChange={(e) => setPlannedStart(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] focus:outline-none focus:border-[#0A4595]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-[#45474D]">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317] focus:outline-none focus:border-[#0A4595]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isGateBlocker}
                onChange={(e) => setIsGateBlocker(e.target.checked)}
                className="w-4 h-4 rounded text-[#0A4595] border-[#E6E8EE] focus:ring-0"
              />
              <span className="text-[12.5px] font-medium text-[#121317]">
                Phase Gate Blocker (Must be completed to close parent milestone gate)
              </span>
            </label>
          </div>

          {/* Row 6: Odoo Integration */}
          <div className="p-4 rounded-2xl bg-[#EEF3FB]/60 border border-[#B7CDF5] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0A4595]" />
                <span className="text-[13px] font-semibold text-[#0A4595]">
                  Execution Tracker Integration (Odoo Task)
                </span>
              </div>
              {odooTaskUrl && (
                <a
                  href={odooTaskUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#0A4595] hover:underline"
                >
                  <span>Open in Odoo</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11.5px] font-medium text-[#45474D]">
                  Odoo Task ID (#)
                </label>
                <input
                  type="number"
                  value={odooTaskId}
                  onChange={(e) => handleOdooIdChange(e.target.value)}
                  placeholder="204"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#B7CDF5] bg-white font-mono text-[13px] text-[#121317] focus:outline-none focus:border-[#0A4595]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11.5px] font-medium text-[#45474D]">
                  Odoo Task Direct URL
                </label>
                <input
                  type="url"
                  value={odooTaskUrl}
                  onChange={(e) => setOdooTaskUrl(e.target.value)}
                  placeholder={`${odooBaseUrl}/web#id=204&model=project.task&view_type=form`}
                  className="w-full px-3 py-1.5 rounded-xl border border-[#B7CDF5] bg-white font-mono text-[12px] text-[#121317] focus:outline-none focus:border-[#0A4595]"
                />
              </div>
            </div>
            <p className="text-[11.5px] text-[#45474D]">
              Directly links to Odoo project.task for bidirectional progress synchronization.
            </p>
          </div>

          {/* Row 7: Checklist Items */}
          <div className="space-y-2">
            <label className="text-[12.5px] font-medium text-[#121317] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#0A4595]" />
                <span>Deliverable Checklist ({checklist.filter((c) => c.done).length}/{checklist.length})</span>
              </span>
            </label>

            <div className="divide-y divide-[#E6E8EE] rounded-2xl border border-[#E6E8EE] overflow-hidden bg-white">
              {checklist.length === 0 ? (
                <div className="p-3 text-[12px] text-[#6E717A] text-center">
                  No checklist items yet. Add one below.
                </div>
              ) : (
                checklist.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F8FA] transition-colors"
                  >
                    <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklist(item.id)}
                        className="w-3.5 h-3.5 rounded text-[#0A4595] border-[#E6E8EE] focus:ring-0"
                      />
                      <span
                        className={`text-[12.5px] truncate ${
                          item.done ? 'line-through text-[#6E717A]' : 'text-[#121317]'
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklist(item.id)}
                      className="p-1 rounded text-[#6E717A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove checklist item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="Add deliverable checklist item..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#E6E8EE] text-[12.5px] text-[#121317] placeholder:text-[#6E717A] focus:outline-none focus:border-[#0A4595]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem(e);
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="px-3.5 py-1.5 rounded-xl border border-[#E6E8EE] hover:border-[#0A4595] bg-[#F7F8FA] hover:bg-[#EEF3FB] text-[12px] font-medium text-[#0A4595] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#E6E8EE] flex items-center justify-between bg-[#F7F8FA] sticky bottom-0">
          <div>
            {isEditing && onDelete && task && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete task "${task.code}: ${task.title}"?`)) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-[12px] font-medium flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Task</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[13px] font-medium text-[#45474D] hover:text-[#121317] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium shadow-clean-sm flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Create Task'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
