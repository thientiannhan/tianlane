import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ProjectTemplate, UserProfile } from '../types.ts';
import { addDaysISO } from '../engine/scheduleEngine.ts';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: ProjectTemplate[];
  users?: UserProfile[];
  currentUser?: UserProfile;
  referenceTodayISO?: string;
  onInstantiate: (payload: {
    template: ProjectTemplate;
    projectName: string;
    projectCode: string;
    clientOrUnit: string;
    startDateISO: string;
    odooProjectId: number;
    autoPushToOdoo: boolean;
  }) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  templates,
  onInstantiate,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id ?? ''
  );
  const [projectName, setProjectName] = useState('CRM Omni-Channel v2');
  const [projectCode, setProjectCode] = useState('26-12');
  const [clientOrUnit, setClientOrUnit] = useState('Commercial Operations');
  const [startDateISO, setStartDateISO] = useState('2026-11-16');
  const [odooProjectId, setOdooProjectId] = useState('64');
  const [autoPushToOdoo, setAutoPushToOdoo] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? templates[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectCode.trim()) {
      setFormError('Please enter both project code and project name.');
      return;
    }
    const parsedOdooId = Number.parseInt(odooProjectId, 10);
    if (Number.isNaN(parsedOdooId) || parsedOdooId <= 0) {
      setFormError('Tracker Project ID must be a positive integer.');
      return;
    }
    setFormError(null);
    onInstantiate({
      template: activeTemplate,
      projectName: projectName.trim(),
      projectCode: projectCode.trim(),
      clientOrUnit: clientOrUnit.trim() || 'Internal Division',
      startDateISO,
      odooProjectId: parsedOdooId,
      autoPushToOdoo,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-modal-title"
    >
      <div className="w-full max-w-3xl rounded-[24px] bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8EE]">
          <div>
            <h2
              id="template-modal-title"
              className="text-[16px] font-medium text-[#121317]"
            >
              New project from template
            </h2>
            <p className="text-[12.5px] text-[#45474D]">
              Auto-generate milestones and tasks by start date
            </p>
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

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates.map((tpl) => {
              const isSelected = tpl.id === activeTemplate.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-[#0A4595] bg-[#EEF3FB]/50'
                      : 'border-[#E6E8EE] bg-white hover:border-[#B7BFD9]'
                  }`}
                >
                  <div className="text-[11.5px] font-mono text-[#45474D] mb-1 tabular-nums">
                    {tpl.default_milestones_json.length} Phases ·{' '}
                    {tpl.default_tasks_json.length} Tasks
                  </div>
                  <h3 className="text-[14px] font-medium text-[#121317] mb-1">
                    {tpl.template_name}
                  </h3>
                  <p className="text-[12.5px] text-[#45474D] line-clamp-2">
                    {tpl.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-[#E6E8EE]">
            <div className="md:col-span-3">
              <label
                htmlFor="input-project-code"
                className="block text-[12px] text-[#45474D] mb-1"
              >
                Code
              </label>
              <input
                id="input-project-code"
                type="text"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] font-mono text-[#121317] tabular-nums"
              />
            </div>

            <div className="md:col-span-5">
              <label
                htmlFor="input-project-name"
                className="block text-[12px] text-[#45474D] mb-1"
              >
                Project name
              </label>
              <input
                id="input-project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] text-[#121317]"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="input-client-unit"
                className="block text-[12px] text-[#45474D] mb-1"
              >
                Unit / Client
              </label>
              <input
                id="input-client-unit"
                type="text"
                value={clientOrUnit}
                onChange={(e) => setClientOrUnit(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] text-[#121317]"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="input-start-date"
                className="block text-[12px] text-[#45474D] mb-1"
              >
                Start date
              </label>
              <input
                id="input-start-date"
                type="date"
                value={startDateISO}
                onChange={(e) => setStartDateISO(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] text-[#121317] tabular-nums"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="input-odoo-project-id"
                className="block text-[12px] text-[#45474D] mb-1"
              >
                Tracker Project ID (Odoo / Jira)
              </label>
              <input
                id="input-odoo-project-id"
                type="number"
                value={odooProjectId}
                onChange={(e) => setOdooProjectId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13.5px] font-mono text-[#121317] tabular-nums"
              />
            </div>

            <div className="md:col-span-4 flex items-end">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] cursor-pointer w-full">
                <input
                  type="checkbox"
                  checked={autoPushToOdoo}
                  onChange={(e) => setAutoPushToOdoo(e.target.checked)}
                  className="w-4 h-4 accent-[#0A4595]"
                />
                <span className="text-[12.5px] text-[#121317]">
                  Auto-link &amp; dispatch tasks to tracker
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6E8EE] bg-[#F7F8FA] p-4">
            <div className="text-[12.5px] font-medium text-[#121317] mb-2">
              Schedule preview
            </div>
            <div className="divide-y divide-[#E6E8EE] text-[12.5px]">
              {activeTemplate.default_milestones_json.map((m, idx) => {
                const pStart = addDaysISO(startDateISO, m.offset_days);
                const pEnd = m.is_ongoing_phase
                  ? 'No end date'
                  : addDaysISO(pStart, m.duration_days);
                return (
                  <div
                    key={m.key}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-[#121317]">
                      <span className="font-mono text-[#45474D] mr-2">
                        M{idx + 1}
                      </span>
                      {m.title}
                    </span>
                    <span className="font-mono text-[#45474D] tabular-nums">
                      {pStart} → {pEnd}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#D93025] text-[12.5px] text-[#D93025]"
            >
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6E8EE]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[13px] font-medium text-[#121317]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium transition-colors"
            >
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
