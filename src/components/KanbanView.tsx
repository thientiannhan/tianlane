import React, { useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import type {
  KanbanStatus,
  ProjectMilestone,
  ProjectTask,
  UserProfile,
} from '../types.ts';
import type { DisplayPropertyKey } from './ProjectHeaderControls.tsx';
import { PriorityIconBadge } from './PriorityIconBadge.tsx';

interface KanbanViewProps {
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  users: UserProfile[];
  groupByMilestone: boolean;
  showEmptyColumns: boolean;
  displayProperties: Record<DisplayPropertyKey, boolean>;
  onSelectTask: (task: ProjectTask) => void;
  onMoveTaskStatus: (taskId: string, newStatus: KanbanStatus) => void;
  onCreateTaskQuick: (
    milestoneId: string,
    status: KanbanStatus,
    title: string
  ) => void;
}

export const KANBAN_COLUMNS: {
  id: KanbanStatus;
  title: string;
}[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review / QA' },
  { id: 'done', title: 'Done' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  milestones,
  tasks,
  users,
  groupByMilestone,
  showEmptyColumns,
  displayProperties,
  onSelectTask,
  onMoveTaskStatus,
  onCreateTaskQuick,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState<string>('');
  const [quickTaskMilestoneId, setQuickTaskMilestoneId] = useState<string>(
    milestones[0]?.id ?? ''
  );
  const [showQuickAdd, setShowQuickAdd] = useState<boolean>(false);

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    const targetMs = quickTaskMilestoneId || milestones[0]?.id;
    if (!targetMs) return;
    onCreateTaskQuick(targetMs, 'todo', quickTaskTitle.trim());
    setQuickTaskTitle('');
    setShowQuickAdd(false);
  };

  const renderTaskCard = (task: ProjectTask) => {
    const assignee = users.find((u) => u.id === task.assignee_id);
    const doneChecks = task.checklist.filter((c) => c.done).length;

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => {
          setDraggedTaskId(task.id);
          e.dataTransfer.setData('text/plain', task.id);
        }}
        onDragEnd={() => {
          setDraggedTaskId(null);
          setDragOverColumn(null);
        }}
        className={`rounded-xl bg-white border border-[#E6E8EE] hover:border-[#B7BFD9] p-3.5 shadow-clean-xs transition-all cursor-grab active:cursor-grabbing ${
          draggedTaskId === task.id ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5 text-[12px] text-[#45474D] tabular-nums">
          <div className="flex items-center gap-1.5">
            <PriorityIconBadge
              priority={task.priority}
              isGateBlocker={task.is_gate_blocker}
              size="sm"
            />
            {displayProperties.id && (
              <span className="font-mono text-[#121317] font-medium">
                {task.code}
              </span>
            )}
            {displayProperties.gate_blocker && task.is_gate_blocker && (
              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10.5px] font-medium">
                Gate
              </span>
            )}
          </div>

          {displayProperties.odoo_link &&
            (task.odoo_task_id ? (
              <a
                href={task.odoo_task_url ?? '#'}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11.5px] font-mono text-[#45474D] hover:text-[#0A4595]"
              >
                <span>#{task.odoo_task_id}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-[11px] text-[#6E717A]">Unlinked</span>
            ))}
        </div>

        <button
          type="button"
          onClick={() => onSelectTask(task)}
          className="text-left w-full text-[13.5px] font-medium text-[#121317] hover:text-[#0A4595] transition-colors line-clamp-2 mb-3"
        >
          {task.title}
        </button>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E6E8EE] text-[12px] text-[#45474D] tabular-nums">
          <div className="flex items-center gap-2">
            {displayProperties.lead && (
              <span className="text-[#121317] font-medium">
                {assignee?.avatar_initials ?? 'PO'}
              </span>
            )}
            {displayProperties.checklist && task.checklist.length > 0 && (
              <span>
                · {doneChecks}/{task.checklist.length}
              </span>
            )}
            {displayProperties.target_date && (
              <span>· {task.actual_end.slice(5)}</span>
            )}
          </div>

          {displayProperties.status && (
            <select
              aria-label={`Change status for ${task.code}`}
              value={task.kanban_status}
              onChange={(e) =>
                onMoveTaskStatus(task.id, e.target.value as KanbanStatus)
              }
              className="px-2 py-0.5 rounded-full border border-[#E6E8EE] bg-white text-[11.5px] text-[#121317]"
            >
              {KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  const renderColumnsGrid = (subsetTasks: ProjectTask[], swimlaneKey: string) => {
    const visibleColumns = showEmptyColumns
      ? KANBAN_COLUMNS
      : KANBAN_COLUMNS.filter((c) =>
          subsetTasks.some((t) => t.kanban_status === c.id)
        );

    const colsToRender =
      visibleColumns.length > 0 ? visibleColumns : KANBAN_COLUMNS;

    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {colsToRender.map((col) => {
          const colTasks = subsetTasks.filter(
            (t) => t.kanban_status === col.id
          );
          const dropTargetKey = `${swimlaneKey}-${col.id}`;
          const isOver = dragOverColumn === dropTargetKey;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(dropTargetKey);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId =
                  e.dataTransfer.getData('text/plain') || draggedTaskId;
                if (droppedId) {
                  onMoveTaskStatus(droppedId, col.id);
                }
                setDragOverColumn(null);
                setDraggedTaskId(null);
              }}
              className={`rounded-2xl p-3 border transition-colors min-h-[160px] flex flex-col ${
                isOver
                  ? 'border-[#0A4595] bg-[#EEF3FB]/50'
                  : 'border-[#E6E8EE] bg-[#F7F8FA]'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-2.5 mb-2 border-b border-[#E6E8EE]">
                <span className="text-[13px] font-medium text-[#121317]">
                  {col.title}
                </span>
                <span className="text-[12px] text-[#45474D] tabular-nums">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2.5 flex-1">
                {colTasks.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-[12px] text-[#6E717A]">
                    No tasks
                  </div>
                ) : (
                  colTasks.map(renderTaskCard)
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-[#45474D] tabular-nums">
          Showing {tasks.length} tasks
        </span>

        <button
          type="button"
          onClick={() => setShowQuickAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New task</span>
        </button>
      </div>

      {showQuickAdd && (
        <form
          onSubmit={handleQuickAddSubmit}
          className="p-4 rounded-2xl bg-white border border-[#E6E8EE] flex flex-wrap items-center gap-2.5"
        >
          <select
            aria-label="Select milestone"
            value={quickTaskMilestoneId}
            onChange={(e) => setQuickTaskMilestoneId(e.target.value)}
            className="px-3.5 py-2 rounded-full border border-[#E6E8EE] bg-[#F7F8FA] text-[13px] text-[#121317]"
          >
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={quickTaskTitle}
            onChange={(e) => setQuickTaskTitle(e.target.value)}
            placeholder="Task title..."
            className="flex-1 min-w-[240px] px-4 py-2 rounded-full border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium"
          >
            Save
          </button>
        </form>
      )}

      {groupByMilestone ? (
        <div className="space-y-6">
          {milestones.map((ms) => {
            const msTasks = tasks.filter((t) => t.milestone_id === ms.id);
            return (
              <div key={ms.id} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[12.5px] text-[#45474D]">
                      {ms.code}
                    </span>
                    <h3 className="text-[14.5px] font-medium text-[#121317]">
                      {ms.title}
                    </h3>
                  </div>
                  <span className="text-[12.5px] text-[#45474D] tabular-nums">
                    {ms.progress_pct}% complete
                  </span>
                </div>
                {renderColumnsGrid(msTasks, ms.id)}
              </div>
            );
          })}
        </div>
      ) : (
        renderColumnsGrid(tasks, 'flat')
      )}
    </div>
  );
};
