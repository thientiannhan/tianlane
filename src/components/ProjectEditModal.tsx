import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Project, ProjectMilestone } from '../types.ts';
import { addDaysISO, diffDaysISO } from '../engine/scheduleEngine.ts';

interface ProjectEditModalProps {
  isOpen: boolean;
  project: Project;
  milestones: ProjectMilestone[];
  totalProjectsCount: number;
  odooBaseUrl: string;
  canDeleteProject?: boolean;
  onClose: () => void;
  onSaveProject: (payload: {
    updatedProject: Project;
    updatedMilestones: ProjectMilestone[];
    shiftDeltaDays: number;
    previousCode: string;
  }) => void;
  onDeleteProject: (projectId: string) => void;
}

const MILESTONE_ICONS = ['🧭', '🎨', '⚡', '🛡️', '🚀', '📦', '🔗', '🏁', '🎯', '📐'];

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({
  isOpen,
  project,
  milestones,
  totalProjectsCount,
  odooBaseUrl,
  canDeleteProject = true,
  onClose,
  onSaveProject,
  onDeleteProject,
}) => {
  const [code, setCode] = useState(project.code);
  const [name, setName] = useState(project.name);
  const [clientOrUnit, setClientOrUnit] = useState(project.client_or_unit);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<Project['status']>(project.status);
  const [startDate, setStartDate] = useState(project.start_date);
  const [trackerProjectId, setTrackerProjectId] = useState(
    String(project.odoo_project_id)
  );
  const [shiftScheduleWithStart, setShiftScheduleWithStart] = useState(true);
  const [draftMilestones, setDraftMilestones] =
    useState<ProjectMilestone[]>(milestones);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCode(project.code);
      setName(project.name);
      setClientOrUnit(project.client_or_unit);
      setDescription(project.description);
      setStatus(project.status);
      setStartDate(project.start_date);
      setTrackerProjectId(String(project.odoo_project_id));
      setDraftMilestones(milestones);
      setConfirmDelete(false);
      setFormError(null);
    }
  }, [isOpen, project, milestones]);

  if (!isOpen) return null;

  const startDeltaDays = diffDaysISO(project.start_date, startDate);

  const handleAddDraftMilestone = () => {
    const nextOrder = draftMilestones.length + 1;
    const lastMs = draftMilestones[draftMilestones.length - 1];
    const defaultStart =
      lastMs?.actual_end ?? addDaysISO(startDate, (nextOrder - 1) * 14);
    const defaultEnd = addDaysISO(defaultStart, 14);

    const newMs: ProjectMilestone = {
      id: `ms-${project.id}-${Date.now()}`,
      project_id: project.id,
      code: `${code.trim() || project.code} · P${nextOrder}`,
      title: `Phase ${nextOrder} Deliverable`,
      icon: MILESTONE_ICONS[(nextOrder - 1) % MILESTONE_ICONS.length],
      order_index: nextOrder,
      planned_start: defaultStart,
      planned_end: defaultEnd,
      actual_start: defaultStart,
      actual_end: defaultEnd,
      is_ongoing_phase: false,
      progress_pct: 0,
      odoo_milestone_id: null,
      is_closed: false,
    };
    setDraftMilestones((prev) => [...prev, newMs]);
  };

  const handleRemoveDraftMilestone = (msId: string) => {
    if (draftMilestones.length <= 1) {
      setFormError('A project must retain at least 1 milestone phase.');
      return;
    }
    setDraftMilestones((prev) =>
      prev
        .filter((m) => m.id !== msId)
        .map((m, idx) => ({ ...m, order_index: idx + 1 }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) {
      setFormError('Project Code and Project Name are required.');
      return;
    }
    const parsedTrackerId = Number.parseInt(trackerProjectId, 10);
    if (Number.isNaN(parsedTrackerId) || parsedTrackerId <= 0) {
      setFormError('Tracker Project ID must be a positive integer.');
      return;
    }

    const effectiveDelta =
      shiftScheduleWithStart && startDeltaDays !== 0 ? startDeltaDays : 0;

    const updatedMilestones = draftMilestones.map((m) => {
      const updatedCode = m.code.startsWith(project.code)
        ? `${cleanCode}${m.code.slice(project.code.length)}`
        : m.code;

      if (effectiveDelta === 0) {
        return { ...m, code: updatedCode };
      }

      return {
        ...m,
        code: updatedCode,
        planned_start: addDaysISO(m.planned_start, effectiveDelta),
        planned_end: m.planned_end
          ? addDaysISO(m.planned_end, effectiveDelta)
          : null,
        actual_start: addDaysISO(m.actual_start, effectiveDelta),
        actual_end: m.actual_end
          ? addDaysISO(m.actual_end, effectiveDelta)
          : null,
      };
    });

    const updatedProject: Project = {
      ...project,
      code: cleanCode,
      name: cleanName,
      client_or_unit: clientOrUnit.trim() || 'Enterprise Unit',
      description: description.trim(),
      status,
      start_date: startDate,
      odoo_project_id: parsedTrackerId,
      odoo_project_url: `${odooBaseUrl}/web#id=${parsedTrackerId}&model=project.project&view_type=form`,
    };

    onSaveProject({
      updatedProject,
      updatedMilestones,
      shiftDeltaDays: effectiveDelta,
      previousCode: project.code,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-project-modal-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between bg-[#FAFBFD]">
          <div>
            <h2
              id="edit-project-modal-title"
              className="text-[17.5px] font-semibold text-[#121317]"
            >
              Edit Project Settings &amp; Phases
            </h2>
            <p className="text-[12.5px] text-[#45474D]">
              Update project information, adjust milestone phase dates, or remove redundant projects
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-[#F1F3F7]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 overflow-y-auto flex-1"
        >
          {formError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
            >
              {formError}
            </div>
          )}

          {/* Core Project Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <label
                htmlFor="edit-project-code"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Project Code
              </label>
              <input
                id="edit-project-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] font-mono text-[#121317] outline-none"
                placeholder="19-03"
              />
            </div>

            <div className="md:col-span-5">
              <label
                htmlFor="edit-project-name"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Project Name
              </label>
              <input
                id="edit-project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] text-[#121317] outline-none"
                placeholder="SMSC Platform"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="edit-project-unit"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Client / Business Unit
              </label>
              <input
                id="edit-project-unit"
                type="text"
                value={clientOrUnit}
                onChange={(e) => setClientOrUnit(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] text-[#121317] outline-none"
                placeholder="Enterprise Digital"
              />
            </div>

            <div className="md:col-span-12">
              <label
                htmlFor="edit-project-desc"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Description
              </label>
              <textarea
                id="edit-project-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
                placeholder="Describe project governance scope and deliverables..."
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="edit-project-start"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Kickoff / Start Date
              </label>
              <input
                id="edit-project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] text-[#121317] tabular-nums outline-none"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="edit-project-status"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Delivery Status
              </label>
              <select
                id="edit-project-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as Project['status'])
                }
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] text-[#121317] bg-white outline-none"
              >
                <option value="on_track">On Track</option>
                <option value="at_risk">At Risk</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="edit-project-tracker"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Tracker Project ID (Odoo / Jira)
              </label>
              <input
                id="edit-project-tracker"
                type="number"
                value={trackerProjectId}
                onChange={(e) => setTrackerProjectId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] font-mono text-[#121317] tabular-nums outline-none"
              />
            </div>
          </div>

          {startDeltaDays !== 0 && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#EEF3FB] border border-[#B7BFD9] text-[12.5px] text-[#121317] cursor-pointer">
              <input
                type="checkbox"
                checked={shiftScheduleWithStart}
                onChange={(e) => setShiftScheduleWithStart(e.target.checked)}
                className="w-4 h-4 accent-[#0A4595]"
              />
              <Calendar className="w-4 h-4 text-[#0A4595] shrink-0" />
              <span>
                Automatically shift all milestone &amp; task dates by{' '}
                <strong>
                  {startDeltaDays > 0 ? `+${startDeltaDays}` : startDeltaDays} days
                </strong>{' '}
                to match the new start date
              </span>
            </label>
          )}

          {/* Milestone Phases Swimlane Schedule Editor */}
          <div className="space-y-3 pt-2 border-t border-[#E6E8EE]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#121317]">
                  Milestone Phases ({draftMilestones.length})
                </h3>
                <p className="text-[12px] text-[#6E717A]">
                  Each milestone acts as a swimlane on the timeline with its own start and end date
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddDraftMilestone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] text-[12px] font-medium text-[#0A4595] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Milestone</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {draftMilestones.map((ms) => (
                <div
                  key={ms.id}
                  className="p-2.5 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  <div className="sm:col-span-5 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-white border border-[#E6E8EE] flex items-center justify-center text-[14px] shrink-0">
                      {ms.icon ?? '🧭'}
                    </span>
                    <input
                      type="text"
                      value={ms.title}
                      onChange={(e) =>
                        setDraftMilestones((prev) =>
                          prev.map((item) =>
                            item.id === ms.id
                              ? { ...item, title: e.target.value }
                              : item
                          )
                        )
                      }
                      aria-label="Milestone title"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] bg-white text-[12.5px] font-medium text-[#121317]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="date"
                      value={ms.actual_start}
                      onChange={(e) =>
                        setDraftMilestones((prev) =>
                          prev.map((item) =>
                            item.id === ms.id
                              ? { ...item, actual_start: e.target.value }
                              : item
                          )
                        )
                      }
                      aria-label="Milestone start date"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] bg-white text-[12px] font-mono text-[#121317] tabular-nums"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    {ms.is_ongoing_phase ? (
                      <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-[#E6E8EE] text-[12px] text-[#6E717A] text-center">
                        Ongoing phase
                      </span>
                    ) : (
                      <input
                        type="date"
                        value={ms.actual_end ?? ''}
                        onChange={(e) =>
                          setDraftMilestones((prev) =>
                            prev.map((item) =>
                              item.id === ms.id
                                ? {
                                    ...item,
                                    actual_end: e.target.value || null,
                                  }
                                : item
                            )
                          )
                        }
                        aria-label="Milestone end date"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6E8EE] bg-white text-[12px] font-mono text-[#121317] tabular-nums"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveDraftMilestone(ms.id)}
                      title="Remove milestone"
                      aria-label="Remove milestone"
                      className="p-1.5 rounded-lg text-[#6E717A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone: Delete Project */}
          <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                <span>Delete this project</span>
              </div>
              <p className="text-[12px] text-rose-600/90">
                {!canDeleteProject
                  ? 'Only the project creator (Creator Owner) has permission to delete this project.'
                  : totalProjectsCount <= 1
                  ? 'At least one project must remain in the workspace.'
                  : 'Remove this project along with its milestones, tasks, and attached deliverables.'}
              </p>
            </div>

            {canDeleteProject && totalProjectsCount > 1 && (
              <div>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rose-300 bg-white hover:bg-rose-600 hover:text-white text-rose-700 text-[12.5px] font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Delete Project</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[12px] text-[#45474D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteProject(project.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Confirm Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-[#E6E8EE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#E6E8EE] text-[13px] font-medium text-[#45474D] hover:text-[#121317]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Project Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
