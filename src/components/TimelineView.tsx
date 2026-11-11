import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flag,
  GitCommitHorizontal,
  MoreVertical,
  Plus,
} from 'lucide-react';
import type {
  BaselineRevisionEntry,
  Project,
  ProjectDocRequirement,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  TaskPriority,
  UserProfile,
} from '../types.ts';
import { getTaskAssignees } from '../types.ts';
import type { DisplayPropertyKey } from './ProjectHeaderControls.tsx';
import { PriorityIconBadge } from './PriorityIconBadge.tsx';
import {
  diffDaysISO,
  evaluateMilestoneHealth,
} from '../engine/scheduleEngine.ts';

interface TimelineViewProps {
  project: Project;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  users: UserProfile[];
  documents: ProjectDocument[];
  docRequirements?: ProjectDocRequirement[];
  revisionLogs: BaselineRevisionEntry[];
  referenceTodayISO: string;
  showBaselineGhost: boolean;
  displayProperties: Record<DisplayPropertyKey, boolean>;
  onSelectMilestone: (milestone: ProjectMilestone) => void;
  onSelectTask: (task: ProjectTask) => void;
  onShiftMilestoneEnd: (milestoneId: string, deltaDays: number) => void;
  onShiftTaskEnd: (taskId: string, deltaDays: number) => void;
  onUpdateMilestoneIcon: (milestoneId: string, icon: string) => void;
  onUpdateTask: (task: ProjectTask) => void;
  onCommitBaseline: () => void;
  onAddTaskToMilestone?: (milestoneId: string) => void;
}

// Wide multi-month scrollable timeline window: Aug 1, 2026 -> Apr 30, 2027 (273 days)
const TIMELINE_START_ISO = '2026-08-01';
const TIMELINE_TOTAL_DAYS = 273;
const CANVAS_WIDTH_PX = 2730; // 10px per day for wide horizontal panning

const MONTH_RULER: {
  label: string;
  startIso: string;
  days: number;
  ticks: { dayNum: number; iso: string }[];
}[] = [
  {
    label: 'AUG 2026',
    startIso: '2026-08-01',
    days: 31,
    ticks: [
      { dayNum: 3, iso: '2026-08-03' },
      { dayNum: 17, iso: '2026-08-17' },
      { dayNum: 31, iso: '2026-08-31' },
    ],
  },
  {
    label: 'SEP',
    startIso: '2026-09-01',
    days: 30,
    ticks: [
      { dayNum: 14, iso: '2026-09-14' },
      { dayNum: 28, iso: '2026-09-28' },
    ],
  },
  {
    label: 'OCT',
    startIso: '2026-10-01',
    days: 31,
    ticks: [
      { dayNum: 12, iso: '2026-10-12' },
      { dayNum: 26, iso: '2026-10-26' },
    ],
  },
  {
    label: 'NOV',
    startIso: '2026-11-01',
    days: 30,
    ticks: [
      { dayNum: 9, iso: '2026-11-09' },
      { dayNum: 23, iso: '2026-11-23' },
    ],
  },
  {
    label: 'DEC',
    startIso: '2026-12-01',
    days: 31,
    ticks: [
      { dayNum: 7, iso: '2026-12-07' },
      { dayNum: 21, iso: '2026-12-21' },
    ],
  },
  {
    label: 'JAN 2027',
    startIso: '2027-01-01',
    days: 31,
    ticks: [
      { dayNum: 4, iso: '2027-01-04' },
      { dayNum: 18, iso: '2027-01-18' },
    ],
  },
  {
    label: 'FEB',
    startIso: '2027-02-01',
    days: 28,
    ticks: [
      { dayNum: 1, iso: '2027-02-01' },
      { dayNum: 15, iso: '2027-02-15' },
    ],
  },
  {
    label: 'MAR',
    startIso: '2027-03-01',
    days: 31,
    ticks: [
      { dayNum: 1, iso: '2027-03-01' },
      { dayNum: 15, iso: '2027-03-15' },
      { dayNum: 29, iso: '2027-03-29' },
    ],
  },
  {
    label: 'APR',
    startIso: '2027-04-01',
    days: 30,
    ticks: [
      { dayNum: 12, iso: '2027-04-12' },
      { dayNum: 26, iso: '2027-04-26' },
    ],
  },
];

const MILESTONE_ICONS = [
  '🧭',
  '🎨',
  '⚡',
  '🛡️',
  '🚀',
  '📦',
  '🔗',
  '🏁',
  '🎯',
  '📐',
  '💎',
  '🔥',
];

function dateToPercent(isoDate: string | null, fallbackPercent: number): number {
  if (!isoDate) return fallbackPercent;
  const delta = diffDaysISO(TIMELINE_START_ISO, isoDate);
  const pct = (delta / TIMELINE_TOTAL_DAYS) * 100;
  return Math.max(0.5, Math.min(98.5, pct));
}

function dateToPx(isoDate: string | null, fallbackPx: number): number {
  if (!isoDate) return fallbackPx;
  const delta = diffDaysISO(TIMELINE_START_ISO, isoDate);
  const px = (delta / TIMELINE_TOTAL_DAYS) * CANVAS_WIDTH_PX;
  return Math.max(16, Math.min(CANVAS_WIDTH_PX - 40, Math.round(px)));
}

function formatReadableDateRange(
  startIso: string,
  endIso: string | null,
  includeYear = true
): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${months[(m - 1) % 12]} ${d}`;
  };
  if (!endIso) return `${fmt(startIso)} → Ongoing`;
  if (!includeYear) return `${fmt(startIso)} - ${fmt(endIso)}`;
  const year = endIso.slice(0, 4);
  return `${fmt(startIso)} – ${fmt(endIso)}, ${year}`;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  project,
  milestones,
  tasks,
  users,
  documents,
  docRequirements = [],
  referenceTodayISO,
  showBaselineGhost,
  displayProperties,
  onSelectMilestone,
  onSelectTask,
  onShiftMilestoneEnd,
  onShiftTaskEnd,
  onUpdateMilestoneIcon,
  onUpdateTask,
  onCommitBaseline,
  onAddTaskToMilestone,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [collapsedMilestones, setCollapsedMilestones] = useState<
    Record<string, boolean>
  >({});
  const [iconPickerMsId, setIconPickerMsId] = useState<string | null>(null);
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{
    scrollLeft: number;
    clientWidth: number;
  }>({
    scrollLeft: 0,
    clientWidth: 1100,
  });

  const todayPct = dateToPercent(referenceTodayISO, 36);
  const todayPx = dateToPx(referenceTodayISO, 990);

  const syncViewportState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setViewport({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth || 1100,
    });
  }, []);

  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const targetScrollLeft = Math.max(
        0,
        todayPx - container.clientWidth * 0.38
      );
      container.scrollTo({ left: targetScrollLeft, behavior });
      setTimeout(syncViewportState, 60);
    },
    [todayPx, syncViewportState]
  );

  const scrollToCoordinate = (targetLeftPx: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const centered = Math.max(0, targetLeftPx - container.clientWidth * 0.22);
    container.scrollTo({ left: centered, behavior: 'smooth' });
  };

  const panHorizontal = (deltaPx: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: deltaPx, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToToday('auto');
    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    return () => window.removeEventListener('resize', syncViewportState);
  }, [project.id, scrollToToday, syncViewportState]);

  const cycleTaskPriority = (task: ProjectTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const current: TaskPriority =
      task.priority ?? (task.is_gate_blocker ? 'high' : 'medium');
    const next: TaskPriority =
      current === 'low' ? 'medium' : current === 'medium' ? 'high' : 'low';
    onUpdateTask({ ...task, priority: next });
  };

  const viewLeft = viewport.scrollLeft;
  const viewRight = viewport.scrollLeft + viewport.clientWidth;

  return (
    <div className="space-y-4">
      {/* Top Action & Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[#45474D]">
          {showBaselineGhost && (
            <span className="inline-flex items-center gap-2">
              <span className="w-5 h-1.5 rounded-full bg-[#B7BFD9] inline-block" />
              <span>Baseline</span>
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <PriorityIconBadge priority="high" size="sm" />
              <span className="text-[11.5px]">High</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <PriorityIconBadge priority="medium" size="sm" />
              <span className="text-[11.5px]">Medium</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <PriorityIconBadge priority="low" size="sm" />
              <span className="text-[11.5px]">Low</span>
            </span>
          </span>
          <span className="text-[#6E717A] hidden sm:inline">
            Each milestone is a phase swimlane · Off-screen milestones show a clickable anchor point
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-[#E6E8EE] bg-white p-0.5 shadow-clean-xs">
            <button
              type="button"
              onClick={() => panHorizontal(-360)}
              aria-label="Scroll timeline left"
              title="Scroll earlier"
              className="p-1.5 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-[#F7F8FA]"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollToToday('smooth')}
              className="px-3 py-1 rounded-full text-[12.5px] font-medium text-[#121317] hover:bg-[#F7F8FA] transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => panHorizontal(360)}
              aria-label="Scroll timeline right"
              title="Scroll later"
              className="p-1.5 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-[#F7F8FA]"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={onCommitBaseline}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12.5px] font-medium text-[#121317] shadow-clean-xs transition-colors"
          >
            <GitCommitHorizontal
              className="w-3.5 h-3.5 text-[#0A4595]"
              aria-hidden="true"
            />
            <span>Re-lock Baseline</span>
          </button>
        </div>
      </div>

      {/* Main Timeline Container with Sticky Today Button & Horizontal Scroll */}
      <div className="relative rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-xs overflow-hidden">
        {/* Floating "Today" Pill Button in top-right corner of the ruler */}
        <div className="absolute right-4 top-2.5 z-30">
          <button
            type="button"
            onClick={() => scrollToToday('smooth')}
            className="px-3.5 py-1 rounded-full bg-white border border-[#E6E8EE] hover:border-[#0A4595] shadow-clean-sm text-[12px] font-medium text-[#121317] hover:text-[#0A4595] transition-colors"
          >
            Today
          </button>
        </div>

        {/* Horizontally Scrollable Canvas */}
        <div
          ref={scrollContainerRef}
          onScroll={syncViewportState}
          className="overflow-x-auto overflow-y-visible scroll-smooth"
        >
          <div
            className="relative select-none"
            style={{ width: `${CANVAS_WIDTH_PX}px`, minHeight: '560px' }}
          >
            {/* 1. TOP CALENDAR RULER */}
            <div className="sticky top-0 z-20 bg-white border-b border-[#E6E8EE]">
              {/* Month Names Row */}
              <div className="flex border-b border-[#F1F3F7]">
                {MONTH_RULER.map((m) => {
                  const widthPct = (m.days / TIMELINE_TOTAL_DAYS) * 100;
                  return (
                    <div
                      key={m.label}
                      style={{ width: `${widthPct}%` }}
                      className="px-3 py-2 text-[11.5px] font-semibold tracking-wider text-[#6E717A] border-r border-[#F1F3F7] uppercase"
                    >
                      {m.label}
                    </div>
                  );
                })}
              </div>

              {/* Day Tick Numbers Row */}
              <div className="relative h-7 bg-[#FAFBFD]">
                {MONTH_RULER.flatMap((m) => m.ticks).map((tick) => {
                  const pct = dateToPercent(tick.iso, 0);
                  const isTodayTick = tick.iso === referenceTodayISO;
                  return (
                    <div
                      key={tick.iso}
                      style={{ left: `${pct}%` }}
                      className="absolute top-1 -translate-x-1/2 flex flex-col items-center"
                    >
                      {isTodayTick ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#0A4595] text-white text-[10.5px] font-semibold font-mono shadow-clean-xs">
                          NOV 9
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-[#6E717A]">
                          {tick.dayNum}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. BACKGROUND VERTICAL GRID & TODAY HIGHLIGHT COLUMN */}
            <div
              className="absolute inset-x-0 bottom-0 top-14 pointer-events-none"
              aria-hidden="true"
            >
              {MONTH_RULER.flatMap((m) => m.ticks).map((tick) => {
                const pct = dateToPercent(tick.iso, 0);
                return (
                  <div
                    key={`grid-${tick.iso}`}
                    style={{ left: `${pct}%` }}
                    className="absolute top-0 bottom-0 w-px bg-[#F1F3F7]"
                  />
                );
              })}

              {/* Today shaded strip + vertical line */}
              <div
                style={{ left: `${todayPct}%` }}
                className="absolute top-0 bottom-0 -translate-x-1/2 w-14 bg-[#0A4595]/[0.03] border-x border-[#0A4595]/10"
              />
              <div
                style={{ left: `${todayPct}%` }}
                className="absolute top-0 bottom-0 w-[1.5px] bg-[#0A4595]/60"
              />
            </div>

            {/* 3. MILESTONE SWIMLANES & OFF-SCREEN ANCHOR POINTS */}
            <div className="relative z-10 divide-y divide-[#E6E8EE]/80">
              {milestones.map((ms, msIndex) => {
                const msTasks = tasks.filter((t) => t.milestone_id === ms.id);
                const healthInfo = evaluateMilestoneHealth(
                  ms,
                  msTasks,
                  referenceTodayISO
                );
                const isCollapsed = Boolean(collapsedMilestones[ms.id]);
                const msIcon =
                  ms.icon ?? MILESTONE_ICONS[msIndex % MILESTONE_ICONS.length];

                // Exact pixel positions for Milestone Start & End
                const msStartPx = dateToPx(ms.actual_start, 240);
                const msEndRawPx = dateToPx(
                  ms.actual_end,
                  Math.min(CANVAS_WIDTH_PX - 120, msStartPx + 360)
                );

                // Compute task pixel bounds so the Milestone Swimlane encloses all its tasks
                const taskCoords = msTasks.map((t) => {
                  const tStart = dateToPx(t.actual_start, msStartPx);
                  const tEnd = dateToPx(t.actual_end, tStart + 140);
                  const cardWidth = Math.max(290, Math.min(420, tEnd - tStart));
                  return {
                    task: t,
                    leftPx: tStart,
                    rightPx: tStart + cardWidth,
                    widthPx: cardWidth,
                  };
                });

                const swimlaneLeftPx =
                  taskCoords.length > 0
                    ? Math.min(
                        msStartPx,
                        ...taskCoords.map((tc) => tc.leftPx)
                      )
                    : msStartPx;
                const swimlaneRightPx =
                  taskCoords.length > 0
                    ? Math.max(
                        msEndRawPx,
                        swimlaneLeftPx + 380,
                        ...taskCoords.map((tc) => tc.rightPx + 16)
                      )
                    : Math.max(msEndRawPx, msStartPx + 380);
                const swimlaneWidthPx = swimlaneRightPx - swimlaneLeftPx;

                // Baseline width ratio
                const baseStartPx = dateToPx(ms.planned_start, msStartPx);
                const baseEndPx = dateToPx(ms.planned_end, msEndRawPx);
                const baseWidthRatio = Math.min(
                  100,
                  Math.max(
                    15,
                    Math.round(
                      ((baseEndPx - baseStartPx) / Math.max(1, swimlaneWidthPx)) *
                        100
                    )
                  )
                );

                // Determine if Milestone Swimlane is scrolled off-screen to Left or Right (Image 3)
                const isOffscreenLeft = swimlaneRightPx < viewLeft + 88;
                const isOffscreenRight = swimlaneLeftPx > viewRight - 88;

                // If milestone is partially clipped on the left edge (Image 2 fix), slide header content so it stays readable
                const stickyHeaderOffsetPx =
                  !isOffscreenLeft &&
                  !isOffscreenRight &&
                  swimlaneLeftPx < viewLeft + 12
                    ? Math.min(
                        Math.max(0, swimlaneWidthPx - 350),
                        viewLeft - swimlaneLeftPx + 14
                      )
                    : 0;

                const shortMsTag =
                  ms.code.split('·')[1]?.trim() || ms.code.slice(0, 6);

                // Lead / primary assignee for anchor avatar (Matches Image 3)
                const leadUser =
                  users.find((u) =>
                    msTasks.some((t) => t.assignee_id === u.id)
                  ) ?? users[0];
                const hasGateBlocker = msTasks.some(
                  (t) => t.is_gate_blocker && !t.is_completed
                );
                const msReqs = docRequirements.filter(
                  (r) => r.milestone_id === ms.id
                );
                const msDocs = documents.filter((d) => d.milestone_id === ms.id);

                return (
                  <section
                    key={ms.id}
                    aria-label={ms.title}
                    className="relative py-5 px-4 transition-colors hover:bg-[#FAFBFD]/60"
                  >
                    {/* CASE 1: OFF-SCREEN LEFT ANCHOR (Matches Image 3 when scrolled to the right past this milestone) */}
                    {isOffscreenLeft && (
                      <div
                        style={{
                          marginLeft: `${Math.max(8, viewLeft + 8)}px`,
                        }}
                        className="inline-flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D8E0F0] shadow-clean-md z-30 transition-all hover:border-[#0A4595]"
                      >
                        <button
                          type="button"
                          onClick={() => scrollToCoordinate(swimlaneLeftPx)}
                          title={`Jump left to ${ms.code} · ${ms.title}`}
                          aria-label={`Jump left to ${ms.title}`}
                          className="w-7 h-7 rounded-full bg-[#F4F6FA] hover:bg-[#0A4595] text-[#45474D] hover:text-white border border-[#E6E8EE] flex items-center justify-center transition-colors shrink-0"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        <div
                          onClick={() => scrollToCoordinate(swimlaneLeftPx)}
                          className="cursor-pointer pr-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px]">{msIcon}</span>
                            <span className="text-[13px] font-semibold text-[#121317] whitespace-nowrap">
                              {shortMsTag} · {ms.title}
                            </span>
                            <PriorityIconBadge
                              priority={hasGateBlocker ? 'high' : 'medium'}
                              size="sm"
                            />
                            {leadUser && (
                              <span className="w-4.5 h-4.5 rounded-full bg-[#E11D48] text-white text-[8.5px] font-bold inline-flex items-center justify-center">
                                {leadUser.avatar_initials}
                              </span>
                            )}
                            <span
                              title={`${ms.progress_pct}% complete`}
                              className="w-4 h-4 rounded-full border-2 border-dotted border-amber-500 inline-block shrink-0"
                            />
                          </div>
                          <div className="text-[11.5px] text-[#6E717A] font-mono tabular-nums">
                            {formatReadableDateRange(
                              ms.actual_start,
                              ms.actual_end,
                              false
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASE 2: OFF-SCREEN RIGHT ANCHOR (Matches Image 3 mirrored when scrolled to the left before this milestone) */}
                    {isOffscreenRight && (
                      <div
                        style={{
                          marginLeft: `${Math.max(
                            16,
                            viewRight - 310
                          )}px`,
                        }}
                        className="inline-flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D8E0F0] shadow-clean-md z-30 transition-all hover:border-[#0A4595]"
                      >
                        <div
                          onClick={() => scrollToCoordinate(swimlaneLeftPx)}
                          className="cursor-pointer pl-1 text-right"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[13px]">{msIcon}</span>
                            <span className="text-[13px] font-semibold text-[#121317] whitespace-nowrap">
                              {shortMsTag} · {ms.title}
                            </span>
                            <PriorityIconBadge
                              priority={hasGateBlocker ? 'high' : 'medium'}
                              size="sm"
                            />
                            {leadUser && (
                              <span className="w-4.5 h-4.5 rounded-full bg-[#0A4595] text-white text-[8.5px] font-bold inline-flex items-center justify-center">
                                {leadUser.avatar_initials}
                              </span>
                            )}
                            <span
                              title={`${ms.progress_pct}% complete`}
                              className="w-4 h-4 rounded-full border-2 border-dotted border-amber-500 inline-block shrink-0"
                            />
                          </div>
                          <div className="text-[11.5px] text-[#6E717A] font-mono tabular-nums">
                            {formatReadableDateRange(
                              ms.actual_start,
                              ms.actual_end,
                              false
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => scrollToCoordinate(swimlaneLeftPx)}
                          title={`Jump right to ${ms.code} · ${ms.title}`}
                          aria-label={`Jump right to ${ms.title}`}
                          className="w-7 h-7 rounded-full bg-[#F4F6FA] hover:bg-[#0A4595] text-[#45474D] hover:text-white border border-[#E6E8EE] flex items-center justify-center transition-colors shrink-0"
                        >
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    {/* CASE 3: VISIBLE MILESTONE SWIMLANE CONTAINER (Spans Start -> End and contains its Tasks) */}
                    {!isOffscreenLeft && !isOffscreenRight && (
                      <div
                        style={{
                          marginLeft: `${swimlaneLeftPx}px`,
                          width: `${swimlaneWidthPx}px`,
                        }}
                        className="relative rounded-2xl bg-[#F4F6FA]/90 border border-[#DCE2EE] p-3.5 shadow-clean-xs transition-all"
                      >
                        {/* Vertical Milestone Gate Line at Milestone End Date */}
                        {ms.actual_end && (
                          <div
                            style={{
                              left: `${Math.max(
                                24,
                                Math.min(
                                  swimlaneWidthPx - 4,
                                  msEndRawPx - swimlaneLeftPx
                                )
                              )}px`,
                            }}
                            className="absolute top-0 bottom-0 z-10 pointer-events-none"
                          >
                            <div className="h-full border-r-2 border-dashed border-[#0A4595]/30" />
                            <div className="-translate-x-1/2 -top-3 absolute whitespace-nowrap px-2.5 py-0.5 rounded-full bg-[#EEF3FB] border border-[#B7BFD9] text-[10.5px] font-mono font-medium text-[#0A4595] shadow-clean-xs flex items-center gap-1">
                              <span>{msIcon}</span>
                              <span>{shortMsTag} Gate</span>
                              <span>· {ms.actual_end.slice(5)}</span>
                            </div>
                          </div>
                        )}

                        {/* Optional Captured Baseline Ghost Bar */}
                        {showBaselineGhost && (
                          <div
                            style={{ width: `${baseWidthRatio}%` }}
                            title={`Baseline: ${ms.planned_start} → ${
                              ms.planned_end ?? 'Ongoing'
                            }`}
                            className="h-1 rounded-full bg-[#B7BFD9] mb-2.5"
                          />
                        )}

                        {/* Swimlane Header Bar (Clamped horizontally so title never clips when partially scrolled) */}
                        <div
                          style={{
                            paddingLeft: `${stickyHeaderOffsetPx}px`,
                          }}
                          className="flex items-center justify-between gap-3 transition-[padding] duration-75"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Expand/Collapse Swimlane Tasks */}
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedMilestones((prev) => ({
                                  ...prev,
                                  [ms.id]: !prev[ms.id],
                                }))
                              }
                              aria-label="Toggle milestone swimlane tasks"
                              className="w-6 h-6 rounded-full bg-white border border-[#E6E8EE] flex items-center justify-center text-[#45474D] hover:text-[#121317] shrink-0"
                            >
                              {isCollapsed ? (
                                <Plus
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronDown
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            {/* Milestone Icon Picker */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIconPickerMsId((prev) =>
                                    prev === ms.id ? null : ms.id
                                  );
                                }}
                                title="Change milestone icon"
                                className="w-7 h-7 rounded-lg bg-white border border-[#E6E8EE] hover:border-[#0A4595] flex items-center justify-center text-[15px] shadow-clean-xs"
                              >
                                {msIcon}
                              </button>

                              {iconPickerMsId === ms.id && (
                                <div
                                  role="dialog"
                                  aria-label="Choose milestone icon"
                                  className="absolute left-0 top-9 z-40 p-2 rounded-xl bg-white border border-[#E6E8EE] shadow-clean-lg grid grid-cols-6 gap-1 w-48"
                                >
                                  {MILESTONE_ICONS.map((ic) => (
                                    <button
                                      key={ic}
                                      type="button"
                                      onClick={() => {
                                        onUpdateMilestoneIcon(ms.id, ic);
                                        setIconPickerMsId(null);
                                      }}
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[14px] hover:bg-[#F1F3F7] ${
                                        ic === msIcon
                                          ? 'bg-[#EEF3FB] ring-1 ring-[#0A4595]'
                                          : ''
                                      }`}
                                    >
                                      {ic}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Milestone Title, Progress, Health & Required Deliverables */}
                            <div
                              onClick={() => onSelectMilestone(ms)}
                              className="min-w-0 cursor-pointer"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13.5px] font-semibold text-[#121317] truncate">
                                  {ms.code} · {ms.title}
                                </span>
                                <span className="text-[12px] font-mono text-[#0A4595] font-semibold tabular-nums shrink-0">
                                  {ms.progress_pct}%
                                </span>
                                {displayProperties.health && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium shrink-0 ${
                                      healthInfo.health === 'critical'
                                        ? 'bg-rose-50 text-rose-700'
                                        : healthInfo.health === 'warning'
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'bg-white text-[#45474D] border border-[#E6E8EE]'
                                    }`}
                                  >
                                    {healthInfo.reasonLabel}
                                  </span>
                                )}

                                {/* Required Deliverable Badges on Milestone Swimlane */}
                                {msReqs.map((req) => {
                                  const uploaded = msDocs.some(
                                    (d) =>
                                      d.doc_type.toLowerCase() ===
                                      req.doc_type.toLowerCase()
                                  );
                                  return (
                                    <span
                                      key={req.id}
                                      title={`Required deliverable: ${req.doc_type} (${
                                        uploaded ? 'Uploaded' : 'Pending upload'
                                      })`}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                                        uploaded
                                          ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
                                          : 'bg-white text-[#45474D] border-[#E6E8EE]'
                                      }`}
                                    >
                                      <span>{req.icon}</span>
                                      <span>{req.doc_type}</span>
                                    </span>
                                  );
                                })}
                              </div>

                              <div className="text-[11.5px] text-[#6E717A] tabular-nums mt-0.5">
                                {ms.actual_end
                                  ? `${formatReadableDateRange(
                                      ms.actual_start,
                                      ms.actual_end
                                    )} · ${msTasks.length} tasks in swimlane`
                                  : `Ongoing phase · Review ${
                                      ms.review_cycle_date ?? 'scheduled'
                                    }`}
                              </div>
                            </div>
                          </div>

                          {/* Quick Shift Milestone Dates & Add Task */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onAddTaskToMilestone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddTaskToMilestone(ms.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#B7CDF5] hover:bg-[#EEF3FB] text-[11.5px] font-medium text-[#0A4595] shadow-clean-xs transition-colors shrink-0"
                                title={`Add new task to milestone ${ms.code}`}
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Task</span>
                              </button>
                            )}

                            {!ms.is_ongoing_phase && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onShiftMilestoneEnd(ms.id, -2)}
                                  className="px-2 py-0.5 rounded-md bg-white border border-[#E6E8EE] hover:border-[#B7BFD9] text-[11px] font-mono text-[#45474D]"
                                  title="Pull milestone end date -2 days"
                                >
                                  -2d
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onShiftMilestoneEnd(ms.id, 2)}
                                  className="px-2 py-0.5 rounded-md bg-white border border-[#E6E8EE] hover:border-[#B7BFD9] text-[11px] font-mono text-[#45474D]"
                                  title="Extend milestone end date +2 days"
                                >
                                  +2d
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tasks Track Inside Milestone Swimlane */}
                        {!isCollapsed && (
                          <div className="space-y-2.5 pt-3 mt-2.5 border-t border-[#E6E8EE]/90">
                            {taskCoords.length === 0 ? (
                              <div className="py-3 px-4 rounded-xl bg-white/70 border border-dashed border-[#B7CDF5] flex items-center justify-between gap-3">
                                <span className="text-[12.5px] text-[#6E717A]">
                                  No tasks in this milestone yet.
                                </span>
                                {onAddTaskToMilestone && (
                                  <button
                                    type="button"
                                    onClick={() => onAddTaskToMilestone(ms.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0A4595] text-white hover:bg-[#083778] text-[12px] font-medium transition-colors shadow-clean-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Add Task</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              taskCoords.map(({ task, leftPx, widthPx }) => {
                              // Relative offset inside the milestone swimlane so task aligns with global timeline ruler
                              const relativeLeftPx = Math.max(
                                0,
                                leftPx - swimlaneLeftPx
                              );

                              const taskAssignees = getTaskAssignees(task, users);
                              const assignee =
                                taskAssignees[0]?.user ??
                                users.find((u) => u.id === task.assignee_id) ??
                                users[0];
                              const priority: TaskPriority =
                                task.priority ??
                                (task.is_gate_blocker ? 'high' : 'medium');
                              const taskVariance = diffDaysISO(
                                task.due_date,
                                task.actual_end
                              );

                              const accentBarColor =
                                task.kanban_status === 'done'
                                  ? 'bg-[#188038]'
                                  : priority === 'high'
                                  ? 'bg-[#0A4595]'
                                  : priority === 'medium'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-400';

                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    marginLeft: `${relativeLeftPx}px`,
                                    width: `${widthPx}px`,
                                  }}
                                  onClick={() => onSelectTask(task)}
                                  className="group relative rounded-2xl bg-white border border-[#E6E8EE] hover:border-[#0A4595]/60 shadow-clean-sm hover:shadow-clean-md p-3.5 cursor-pointer transition-all"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <span
                                        className={`w-1 self-stretch rounded-full shrink-0 ${accentBarColor}`}
                                        aria-hidden="true"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-[13.5px] font-medium text-[#121317] truncate flex items-center gap-1.5">
                                          <span className="truncate">{task.title}</span>
                                          {task.tags?.includes('AI-created') && (
                                            <span className="shrink-0 px-1 py-0.2 rounded bg-purple-50 text-purple-700 text-[9.5px] font-medium border border-purple-200">
                                              AI
                                            </span>
                                          )}
                                        </div>
                                        {displayProperties.target_date && (
                                          <div className="flex items-center gap-1.5 text-[11.5px] text-[#6E717A] tabular-nums mt-0.5">
                                            <Calendar
                                              className="w-3 h-3 shrink-0"
                                              aria-hidden="true"
                                            />
                                            <span className="truncate">
                                              {formatReadableDateRange(
                                                task.actual_start,
                                                task.actual_end
                                              )}
                                            </span>
                                            {taskVariance > 0 && (
                                              <span className="text-rose-600 font-mono text-[10.5px]">
                                                +{taskVariance}d
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* 3-Dots Quick Shift Menu */}
                                    <div className="relative shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveCardMenuId((prev) =>
                                            prev === task.id ? null : task.id
                                          );
                                        }}
                                        aria-label="Task timeline actions"
                                        className="p-1 rounded-lg text-[#6E717A] hover:text-[#121317] hover:bg-[#F1F3F7]"
                                      >
                                        <MoreVertical
                                          className="w-3.5 h-3.5"
                                          aria-hidden="true"
                                        />
                                      </button>

                                      {activeCardMenuId === task.id && (
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          className="absolute right-0 top-7 z-30 w-36 rounded-xl bg-white border border-[#E6E8EE] shadow-clean-lg p-1.5 text-[12px] space-y-1"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onShiftTaskEnd(task.id, -2);
                                              setActiveCardMenuId(null);
                                            }}
                                            className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-[#F7F8FA] text-[#121317]"
                                          >
                                            Pull date -2 days
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onShiftTaskEnd(task.id, 2);
                                              setActiveCardMenuId(null);
                                            }}
                                            className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-[#F7F8FA] text-[#121317]"
                                          >
                                            Extend +2 days
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              cycleTaskPriority(task, e);
                                              setActiveCardMenuId(null);
                                            }}
                                            className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-[#F7F8FA] text-[#0A4595] font-medium"
                                          >
                                            Cycle Priority
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bottom Section: Tag Icons & Handler Avatar */}
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                      {displayProperties.milestones && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4F5F8] text-[#45474D] text-[11px] font-medium">
                                          <span>{msIcon}</span>
                                          <span>{shortMsTag}</span>
                                        </span>
                                      )}

                                      <PriorityIconBadge
                                        priority={task.priority}
                                        isGateBlocker={task.is_gate_blocker}
                                        onClick={(e) =>
                                          cycleTaskPriority(task, e)
                                        }
                                      />

                                      {displayProperties.gate_blocker &&
                                        task.is_gate_blocker && (
                                          <span
                                            title="Phase-Gate Blocker"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10.5px] font-medium"
                                          >
                                            <Flag
                                              className="w-2.5 h-2.5"
                                              aria-hidden="true"
                                            />
                                            <span>Gate</span>
                                          </span>
                                        )}

                                      {displayProperties.odoo_link &&
                                        task.odoo_task_id && (
                                          <a
                                            href={task.odoo_task_url ?? '#'}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            title={`Open Tracker Task #${task.odoo_task_id}`}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#EEF3FB] text-[#0A4595] text-[10.5px] font-mono"
                                          >
                                            <span>#{task.odoo_task_id}</span>
                                            <ExternalLink
                                              className="w-2.5 h-2.5"
                                              aria-hidden="true"
                                            />
                                          </a>
                                        )}

                                      {!task.odoo_task_id &&
                                        displayProperties.odoo_link && (
                                          <span
                                            title="Not linked to execution tracker"
                                            className="inline-flex items-center text-amber-600"
                                          >
                                            <AlertTriangle
                                              className="w-3 h-3"
                                              aria-hidden="true"
                                            />
                                          </span>
                                        )}
                                    </div>

                                    {displayProperties.lead && taskAssignees.length > 0 && (
                                      <div
                                        className="flex items-center -space-x-1.5 shrink-0"
                                        title={taskAssignees
                                          .map((a) => `${a.user.full_name} (${a.role})`)
                                          .join(' • ')}
                                      >
                                        {taskAssignees.slice(0, 2).map((item, idx) => {
                                          const roleBg =
                                            item.role === 'QC'
                                              ? 'bg-[#188038]'
                                              : item.role === 'Developer'
                                              ? 'bg-[#0A4595]'
                                              : item.role === 'BA'
                                              ? 'bg-[#7B1FA2]'
                                              : 'bg-[#1E293B]';
                                          return (
                                            <div
                                              key={`${item.user.id}-${idx}`}
                                              className={`relative w-6 h-6 rounded-full ${roleBg} text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-white`}
                                              title={`${item.user.full_name} (${item.role})`}
                                            >
                                              {item.user.avatar_initials}
                                              <span
                                                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white ${
                                                  item.user.teams_status ===
                                                  'available'
                                                    ? 'bg-[#188038]'
                                                    : 'bg-amber-500'
                                                }`}
                                              />
                                            </div>
                                          );
                                        })}
                                        {taskAssignees.length > 2 && (
                                          <span
                                            className="w-5 h-5 rounded-full bg-[#E6E8EE] text-[#45474D] text-[9.5px] font-semibold flex items-center justify-center ring-2 ring-white tabular-nums"
                                            title={taskAssignees
                                              .slice(2)
                                              .map(
                                                (a) =>
                                                  `${a.user.full_name} (${a.role})`
                                              )
                                              .join(', ')}
                                          >
                                            +{taskAssignees.length - 2}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
