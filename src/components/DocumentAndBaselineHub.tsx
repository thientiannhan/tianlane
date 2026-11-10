import React from 'react';
import { ExternalLink } from 'lucide-react';
import type {
  BaselineRevisionEntry,
  Project,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
} from '../types.ts';
import { diffDaysISO } from '../engine/scheduleEngine.ts';

interface DocumentAndBaselineHubProps {
  project: Project;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  documents: ProjectDocument[];
  revisionLogs: BaselineRevisionEntry[];
  onSelectMilestone: (ms: ProjectMilestone) => void;
  onSelectTask: (task: ProjectTask) => void;
}

export const DocumentAndBaselineHub: React.FC<DocumentAndBaselineHubProps> = ({
  project,
  milestones,
  tasks,
  documents,
  revisionLogs,
  onSelectMilestone,
  onSelectTask,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-[#E6E8EE] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E6E8EE] bg-[#F7F8FA] flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13.5px] font-medium text-[#121317]">
            Milestones & Baseline List
          </h2>
          <span className="text-[12px] text-[#45474D] font-mono tabular-nums">
            Baseline: {project.baseline_committed_at?.slice(0, 10) ?? 'None'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#E6E8EE] text-[#45474D]">
                <th className="py-3 px-5 font-medium">Milestone</th>
                <th className="py-3 px-5 font-medium">Baseline</th>
                <th className="py-3 px-5 font-medium">Actual</th>
                <th className="py-3 px-5 font-medium">Variance</th>
                <th className="py-3 px-5 font-medium">Gate Blocker</th>
                <th className="py-3 px-5 font-medium text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8EE] tabular-nums">
              {milestones.map((ms) => {
                const variance = diffDaysISO(ms.planned_end, ms.actual_end);
                const msTasks = tasks.filter((t) => t.milestone_id === ms.id);
                const openBlockers = msTasks.filter(
                  (t) => t.is_gate_blocker && t.kanban_status !== 'done'
                );

                return (
                  <tr
                    key={ms.id}
                    onClick={() => onSelectMilestone(ms)}
                    className="hover:bg-[#F7F8FA] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-[#121317]">
                      <span className="font-mono text-[#45474D] mr-2">
                        {ms.code}
                      </span>
                      {ms.title}
                    </td>
                    <td className="py-3 px-5 font-mono text-[#45474D]">
                      {ms.planned_start} → {ms.planned_end ?? 'No end date'}
                    </td>
                    <td className="py-3 px-5 font-mono text-[#121317]">
                      {ms.actual_start} → {ms.actual_end ?? 'No end date'}
                    </td>
                    <td className="py-3 px-5 font-mono text-[#45474D]">
                      {ms.is_ongoing_phase
                        ? 'Ongoing'
                        : variance > 0
                        ? `+${variance}d`
                        : variance < 0
                        ? `${variance}d`
                        : '0d'}
                    </td>
                    <td className="py-3 px-5 text-[#45474D]">
                      {openBlockers.length > 0
                        ? `${openBlockers.length} open`
                        : 'Clear'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-medium text-[#121317]">
                      {ms.progress_pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-[#E6E8EE] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-medium text-[#121317]">
              Documents (50 MB max)
            </h3>
            <span className="text-[12px] text-[#45474D] tabular-nums">
              {documents.length} files
            </span>
          </div>

          <div className="divide-y divide-[#E6E8EE]">
            {documents.map((doc) => {
              const linkedTask = tasks.find((t) => t.id === doc.task_id);
              return (
                <div
                  key={doc.id}
                  className="py-3 flex items-center justify-between gap-3 text-[13px]"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#121317] truncate">
                      {doc.file_name}{' '}
                      <span className="font-mono text-[11.5px] text-[#45474D]">
                        ({doc.version_tag})
                      </span>
                    </div>
                    <div className="text-[12px] text-[#45474D] tabular-nums">
                      {(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB ·{' '}
                      {linkedTask ? (
                        <button
                          type="button"
                          onClick={() => onSelectTask(linkedTask)}
                          className="text-[#0A4595] hover:underline"
                        >
                          {linkedTask.code}
                        </button>
                      ) : (
                        'Project'
                      )}
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[12px] text-[#121317] shrink-0"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#E6E8EE] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-medium text-[#121317]">
              Baseline Revisions
            </h3>
            <span className="text-[12px] text-[#45474D] tabular-nums">
              {revisionLogs.length} entries
            </span>
          </div>

          <div className="divide-y divide-[#E6E8EE] text-[13px]">
            {revisionLogs.map((rev) => (
              <div key={rev.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#121317]">
                    {rev.target_title}
                  </span>
                  <span className="font-mono text-[12px] text-[#45474D] tabular-nums">
                    {rev.delta_days > 0 ? `+${rev.delta_days}d` : `${rev.delta_days}d`}
                  </span>
                </div>
                <p className="text-[12.5px] text-[#45474D]">{rev.reason}</p>
                <div className="text-[11.5px] font-mono text-[#45474D] tabular-nums">
                  {rev.previous_end} → {rev.new_end} · {rev.author_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
