import React, { useState } from 'react';
import { ExternalLink, Upload, X } from 'lucide-react';
import type {
  KanbanStatus,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  TaskPriority,
  UserProfile,
} from '../types.ts';
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
  currentUser: UserProfile;
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
      uploaded_by: currentUser.full_name,
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
      uploaded_by: currentUser.full_name,
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
            <div className="text-[12px] font-mono text-[#45474D] tabular-nums">
              {selectedTask ? selectedTask.code : activeMilestone?.code}
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
              <div className="grid grid-cols-3 gap-3">
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

                <div>
                  <label className="block text-[12px] text-[#45474D] mb-1">
                    Assignee
                  </label>
                  <select
                    value={selectedTask.assignee_id}
                    onChange={(e) =>
                      onUpdateTask({
                        ...selectedTask,
                        assignee_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
