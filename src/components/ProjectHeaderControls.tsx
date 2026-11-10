import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  ChevronRight,
  Diamond,
  Flag,
  GitFork,
  LayoutGrid,
  List,
  ListFilter,
  SlidersHorizontal,
  Sparkles,
  Tag,
  User,
  Users,
} from 'lucide-react';
import type { KanbanStatus, ProjectMilestone, UserProfile } from '../types.ts';

export type ProjectViewMode = 'list' | 'board' | 'timeline';

export type DisplayPropertyKey =
  | 'id'
  | 'milestones'
  | 'summary'
  | 'gate_blocker'
  | 'status'
  | 'health'
  | 'odoo_link'
  | 'lead'
  | 'target_date'
  | 'checklist';

export interface ProjectFilterState {
  searchQuery: string;
  status: KanbanStatus | 'all';
  gateBlockerOnly: boolean;
  odooLink: 'all' | 'linked' | 'unlinked';
  assigneeId: string | 'all';
  milestoneId: string | 'all';
}

export interface ProjectDisplayState {
  viewMode: ProjectViewMode;
  groupByMilestone: boolean;
  ordering: 'manual' | 'due_date' | 'progress';
  showBaseline: boolean;
  showEmptyColumns: boolean;
  properties: Record<DisplayPropertyKey, boolean>;
}

export const DEFAULT_DISPLAY_PROPERTIES: Record<DisplayPropertyKey, boolean> = {
  id: true,
  milestones: true,
  summary: true,
  gate_blocker: true,
  status: true,
  health: true,
  odoo_link: true,
  lead: true,
  target_date: true,
  checklist: true,
};

interface ProjectHeaderControlsProps {
  filterState: ProjectFilterState;
  onChangeFilter: (next: ProjectFilterState) => void;
  displayState: ProjectDisplayState;
  onChangeDisplay: (next: ProjectDisplayState) => void;
  milestones: ProjectMilestone[];
  users: UserProfile[];
  onResetDisplay: () => void;
}

const PROPERTY_LABELS: { key: DisplayPropertyKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'summary', label: 'Summary' },
  { key: 'gate_blocker', label: 'Gate Blocker' },
  { key: 'status', label: 'Status' },
  { key: 'health', label: 'Health' },
  { key: 'odoo_link', label: 'Tracker Link' },
  { key: 'lead', label: 'Lead' },
  { key: 'target_date', label: 'Target date' },
  { key: 'checklist', label: 'Checklist' },
];

export const ProjectHeaderControls: React.FC<ProjectHeaderControlsProps> = ({
  filterState,
  onChangeFilter,
  displayState,
  onChangeDisplay,
  milestones,
  users,
  onResetDisplay,
}) => {
  const [openMenu, setOpenMenu] = useState<'filter' | 'display' | null>(null);
  const [expandedFilterCategory, setExpandedFilterCategory] = useState<
    string | null
  >(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilter =
    filterState.status !== 'all' ||
    filterState.gateBlockerOnly ||
    filterState.odooLink !== 'all' ||
    filterState.assigneeId !== 'all' ||
    filterState.milestoneId !== 'all' ||
    filterState.searchQuery.trim().length > 0;

  const toggleProperty = (key: DisplayPropertyKey) => {
    onChangeDisplay({
      ...displayState,
      properties: {
        ...displayState.properties,
        [key]: !displayState.properties[key],
      },
    });
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* Button 1: Circular Filter Icon Button (Image 2 & Image 4) */}
      <button
        type="button"
        onClick={() =>
          setOpenMenu((prev) => (prev === 'filter' ? null : 'filter'))
        }
        aria-label="Filter tasks"
        title="Filter"
        className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          openMenu === 'filter'
            ? 'border-[#B7BFD9] bg-[#F1F3F7] text-[#121317]'
            : 'border-[#E6E8EE] bg-white hover:bg-[#F7F8FA] text-[#45474D] hover:text-[#121317]'
        }`}
      >
        <ListFilter className="w-4 h-4" aria-hidden="true" />
        {hasActiveFilter && (
          <span
            className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#0A4595] ring-2 ring-white"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Button 2: Circular Display / View Switcher Icon Button (Image 2 & Image 3) */}
      <button
        type="button"
        onClick={() =>
          setOpenMenu((prev) => (prev === 'display' ? null : 'display'))
        }
        aria-label="Display options and view switcher"
        title="View & display options"
        className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          openMenu === 'display'
            ? 'border-[#B7BFD9] bg-[#F1F3F7] text-[#121317]'
            : 'border-[#E6E8EE] bg-white hover:bg-[#F7F8FA] text-[#45474D] hover:text-[#121317]'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        <span
          className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#0A4595] ring-2 ring-white"
          aria-hidden="true"
        />
      </button>

      {/* POPOVER 1: FILTER MENU (Matches Image 4) */}
      {openMenu === 'filter' && (
        <div
          role="dialog"
          aria-label="Filter menu"
          className="absolute right-0 top-11 z-50 w-72 rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[13px] text-[#121317]"
        >
          {/* Search Input Row */}
          <div className="px-3.5 py-2.5 border-b border-[#E6E8EE] flex items-center justify-between gap-2">
            <input
              type="text"
              value={filterState.searchQuery}
              onChange={(e) =>
                onChangeFilter({ ...filterState, searchQuery: e.target.value })
              }
              placeholder="Add Filter..."
              className="w-full bg-transparent text-[13px] text-[#121317] placeholder:text-[#6E717A] focus:outline-none"
            />
            <span className="px-1.5 py-0.5 rounded border border-[#E6E8EE] text-[11px] font-mono text-[#6E717A]">
              F
            </span>
          </div>

          {/* AI Filter & Clear Filter */}
          <div className="py-1 border-b border-[#E6E8EE]">
            <button
              type="button"
              onClick={() =>
                onChangeFilter({
                  ...filterState,
                  gateBlockerOnly: !filterState.gateBlockerOnly,
                })
              }
              className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA] text-left"
            >
              <span className="flex items-center gap-2.5 text-[#121317]">
                <Sparkles className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                <span>AI filter (Gate Blockers)</span>
              </span>
              {filterState.gateBlockerOnly && (
                <span className="w-2 h-2 rounded-full bg-[#0A4595]" />
              )}
            </button>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() =>
                  onChangeFilter({
                    searchQuery: '',
                    status: 'all',
                    gateBlockerOnly: false,
                    odooLink: 'all',
                    assigneeId: 'all',
                    milestoneId: 'all',
                  })
                }
                className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA] text-left text-[#0A4595] font-medium"
              >
                <span>Clear all filters</span>
              </button>
            )}
          </div>

          {/* Filter Categories (Matches Image 4) */}
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {/* Status */}
            <div>
              <button
                type="button"
                onClick={() =>
                  setExpandedFilterCategory((p) =>
                    p === 'status' ? null : 'status'
                  )
                }
                className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA]"
              >
                <span className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                  <span>Status</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
              </button>
              {expandedFilterCategory === 'status' && (
                <div className="px-4 py-1.5 bg-[#F7F8FA] space-y-1">
                  {(['all', 'backlog', 'todo', 'in_progress', 'review', 'done'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          onChangeFilter({ ...filterState, status: st })
                        }
                        className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] flex items-center justify-between ${
                          filterState.status === st
                            ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                            : 'text-[#45474D] hover:text-[#121317]'
                        }`}
                      >
                        <span className="capitalize">
                          {st === 'all' ? 'All statuses' : st.replace('_', ' ')}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Priority / Gate Blocker */}
            <button
              type="button"
              onClick={() =>
                onChangeFilter({
                  ...filterState,
                  gateBlockerOnly: !filterState.gateBlockerOnly,
                })
              }
              className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA]"
            >
              <span className="flex items-center gap-2.5">
                <Flag className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                <span>Gate Blocker</span>
              </span>
              <span className="text-[11.5px] text-[#45474D]">
                {filterState.gateBlockerOnly ? 'Only blockers' : 'All'}
              </span>
            </button>

            {/* Labels / Tracker Link */}
            <div>
              <button
                type="button"
                onClick={() =>
                  setExpandedFilterCategory((p) =>
                    p === 'odoo' ? null : 'odoo'
                  )
                }
                className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA]"
              >
                <span className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                  <span>Tracker Link</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
              </button>
              {expandedFilterCategory === 'odoo' && (
                <div className="px-4 py-1.5 bg-[#F7F8FA] space-y-1">
                  {(['all', 'linked', 'unlinked'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        onChangeFilter({ ...filterState, odooLink: opt })
                      }
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] ${
                        filterState.odooLink === opt
                          ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                          : 'text-[#45474D] hover:text-[#121317]'
                      }`}
                    >
                      {opt === 'all'
                        ? 'All tasks'
                        : opt === 'linked'
                        ? 'Linked to Tracker (#ID)'
                        : 'Unlinked tasks'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lead / Members */}
            <div>
              <button
                type="button"
                onClick={() =>
                  setExpandedFilterCategory((p) =>
                    p === 'lead' ? null : 'lead'
                  )
                }
                className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA]"
              >
                <span className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                  <span>Lead / Assignee</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
              </button>
              {expandedFilterCategory === 'lead' && (
                <div className="px-4 py-1.5 bg-[#F7F8FA] space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilter({ ...filterState, assigneeId: 'all' })
                    }
                    className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] ${
                      filterState.assigneeId === 'all'
                        ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                        : 'text-[#45474D]'
                    }`}
                  >
                    All members
                  </button>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        onChangeFilter({ ...filterState, assigneeId: u.id })
                      }
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] ${
                        filterState.assigneeId === u.id
                          ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                          : 'text-[#45474D] hover:text-[#121317]'
                      }`}
                    >
                      {u.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Milestones */}
            <div>
              <button
                type="button"
                onClick={() =>
                  setExpandedFilterCategory((p) =>
                    p === 'milestones' ? null : 'milestones'
                  )
                }
                className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#F7F8FA]"
              >
                <span className="flex items-center gap-2.5">
                  <Diamond className="w-4 h-4 text-[#45474D]" aria-hidden="true" />
                  <span>Milestones</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
              </button>
              {expandedFilterCategory === 'milestones' && (
                <div className="px-4 py-1.5 bg-[#F7F8FA] space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilter({ ...filterState, milestoneId: 'all' })
                    }
                    className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] ${
                      filterState.milestoneId === 'all'
                        ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                        : 'text-[#45474D]'
                    }`}
                  >
                    All milestones
                  </button>
                  {milestones.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onChangeFilter({ ...filterState, milestoneId: m.id })
                      }
                      className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] truncate ${
                        filterState.milestoneId === m.id
                          ? 'bg-white font-medium text-[#0A4595] shadow-clean-xs'
                          : 'text-[#45474D] hover:text-[#121317]'
                      }`}
                    >
                      {m.code} — {m.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Static rows matching Image 4 */}
            <div className="px-3.5 py-2 flex items-center justify-between text-[#45474D]">
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4" aria-hidden="true" />
                <span>Members</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
            </div>
            <div className="px-3.5 py-2 flex items-center justify-between text-[#45474D]">
              <span className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>Dates</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#6E717A]" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}

      {/* POPOVER 2: DISPLAY & VIEW SWITCHER (Matches Image 3) */}
      {openMenu === 'display' && (
        <div
          role="dialog"
          aria-label="View and display options"
          className="absolute right-0 top-11 z-50 w-80 rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[13px] text-[#121317]"
        >
          {/* Top 3-Pill View Switcher: List | Board | Timeline */}
          <div className="p-3.5 border-b border-[#E6E8EE]">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onChangeDisplay({ ...displayState, viewMode: 'list' })
                }
                className={`py-1.5 px-2.5 rounded-full border text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  displayState.viewMode === 'list'
                    ? 'bg-[#F1F3F7] border-[#B7BFD9] text-[#121317]'
                    : 'bg-white border-[#E6E8EE] text-[#45474D] hover:text-[#121317]'
                }`}
              >
                <List className="w-3.5 h-3.5" aria-hidden="true" />
                <span>List</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeDisplay({ ...displayState, viewMode: 'board' })
                }
                className={`py-1.5 px-2.5 rounded-full border text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  displayState.viewMode === 'board'
                    ? 'bg-[#F1F3F7] border-[#B7BFD9] text-[#121317]'
                    : 'bg-white border-[#E6E8EE] text-[#45474D] hover:text-[#121317]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Board</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeDisplay({ ...displayState, viewMode: 'timeline' })
                }
                className={`py-1.5 px-2.5 rounded-full border text-[12.5px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                  displayState.viewMode === 'timeline'
                    ? 'bg-[#F1F3F7] border-[#B7BFD9] text-[#121317]'
                    : 'bg-white border-[#E6E8EE] text-[#45474D] hover:text-[#121317]'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Timeline</span>
              </button>
            </div>

            {/* Grouping & Ordering Rows */}
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#45474D]">Columns</span>
                <select
                  aria-label="Columns grouping"
                  value="status"
                  disabled
                  className="px-3 py-1 rounded-full border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317]"
                >
                  <option value="status">Status</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#45474D]">Rows</span>
                <select
                  aria-label="Rows grouping"
                  value={displayState.groupByMilestone ? 'milestones' : 'none'}
                  onChange={(e) =>
                    onChangeDisplay({
                      ...displayState,
                      groupByMilestone: e.target.value === 'milestones',
                    })
                  }
                  className="px-3 py-1 rounded-full border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317]"
                >
                  <option value="milestones">Milestones</option>
                  <option value="none">No grouping</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#45474D]">Ordering</span>
                <select
                  aria-label="Ordering"
                  value={displayState.ordering}
                  onChange={(e) =>
                    onChangeDisplay({
                      ...displayState,
                      ordering: e.target.value as ProjectDisplayState['ordering'],
                    })
                  }
                  className="px-3 py-1 rounded-full border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317]"
                >
                  <option value="manual">Manual</option>
                  <option value="due_date">Target date</option>
                  <option value="progress">Progress</option>
                </select>
              </div>
            </div>
          </div>

          {/* Show Baseline Row */}
          <div className="px-3.5 py-2.5 border-b border-[#E6E8EE] flex items-center justify-between">
            <span className="text-[#45474D]">Show baseline</span>
            <select
              aria-label="Show baseline"
              value={displayState.showBaseline ? 'all' : 'none'}
              onChange={(e) =>
                onChangeDisplay({
                  ...displayState,
                  showBaseline: e.target.value === 'all',
                })
              }
              className="px-3 py-1 rounded-full border border-[#E6E8EE] bg-white text-[12.5px] text-[#121317]"
            >
              <option value="all">All</option>
              <option value="none">Hidden</option>
            </select>
          </div>

          {/* Board options & Display properties */}
          <div className="p-3.5 space-y-3">
            <div className="text-[12px] font-medium text-[#121317]">
              View options
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[#45474D]">Show empty columns</span>
              <input
                type="checkbox"
                checked={displayState.showEmptyColumns}
                onChange={(e) =>
                  onChangeDisplay({
                    ...displayState,
                    showEmptyColumns: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#0A4595]"
              />
            </label>

            <div className="space-y-2 pt-1">
              <div className="text-[12px] text-[#45474D]">Display properties</div>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_LABELS.map((prop) => {
                  const active = displayState.properties[prop.key];
                  return (
                    <button
                      key={prop.key}
                      type="button"
                      onClick={() => toggleProperty(prop.key)}
                      className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                        active
                          ? 'bg-[#F1F3F7] border-[#B7BFD9] text-[#121317] font-medium'
                          : 'bg-white border-[#E6E8EE] text-[#6E717A] hover:text-[#121317]'
                      }`}
                    >
                      {prop.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Reset & Set Default Footer */}
          <div className="px-3.5 py-2.5 border-t border-[#E6E8EE] flex items-center justify-end gap-4 text-[12.5px]">
            <button
              type="button"
              onClick={onResetDisplay}
              className="text-[#45474D] hover:text-[#121317]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="text-[#0A4595] font-medium hover:underline"
            >
              Set default for everyone
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
