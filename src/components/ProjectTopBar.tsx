import React from 'react';
import { Download, ExternalLink, Pencil, RefreshCw } from 'lucide-react';
import type { Project, ProjectMilestone, UserProfile } from '../types.ts';
import type { SidebarSection } from './Sidebar.tsx';
import {
  ProjectHeaderControls,
  type ProjectDisplayState,
  type ProjectFilterState,
} from './ProjectHeaderControls.tsx';

interface ProjectTopBarProps {
  activeSection: SidebarSection;
  activeProject: Project;
  filterState: ProjectFilterState;
  onChangeFilter: (next: ProjectFilterState) => void;
  displayState: ProjectDisplayState;
  onChangeDisplay: (next: ProjectDisplayState) => void;
  milestones: ProjectMilestone[];
  users: UserProfile[];
  onResetDisplay: () => void;
  onSyncOdoo: () => void;
  onInstallApp: () => void;
  onOpenEditProject: () => void;
}

export const ProjectTopBar: React.FC<ProjectTopBarProps> = ({
  activeSection,
  activeProject,
  filterState,
  onChangeFilter,
  displayState,
  onChangeDisplay,
  milestones,
  users,
  onResetDisplay,
  onSyncOdoo,
  onInstallApp,
  onOpenEditProject,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E6E8EE] px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Breadcrumb / Active View Title */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {activeSection === 'projects' ? (
            <>
              <span className="text-[13px] text-[#6E717A]">Projects</span>
              <span className="text-[#E6E8EE]">/</span>
              <span className="font-mono text-[12.5px] text-[#45474D] tabular-nums">
                {activeProject.code}
              </span>
              <h1 className="text-[16px] font-medium text-[#121317] truncate">
                {activeProject.name}
              </h1>
              <a
                href={activeProject.odoo_project_url}
                target="_blank"
                rel="noreferrer"
                title="Open execution tracker"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] text-[11.5px] font-mono text-[#45474D] hover:text-[#121317] transition-colors tabular-nums"
              >
                <span>Tracker #{activeProject.odoo_project_id}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={onOpenEditProject}
                title="Edit project details, milestone dates, or delete project"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] bg-[#F7F8FA] hover:bg-[#EEF3FB] text-[11.5px] font-medium text-[#45474D] hover:text-[#0A4595] transition-colors"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" />
                <span>Edit Project</span>
              </button>
            </>
          ) : (
            <h1 className="text-[16px] font-medium text-[#121317] capitalize">
              {activeSection === 'team'
                ? 'Your team'
                : activeSection === 'settings'
                ? 'Project Standard Settings'
                : activeSection === 'files'
                ? `Files & Deliverables · ${activeProject.code}`
                : activeSection}
            </h1>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSyncOdoo}
            title="Sync progress from execution tracker"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12.5px] font-medium text-[#121317] transition-colors"
          >
            <RefreshCw
              className="w-3.5 h-3.5 text-[#45474D]"
              aria-hidden="true"
            />
            <span>Sync Progress</span>
          </button>

          <button
            type="button"
            onClick={onInstallApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12.5px] font-medium text-[#121317] transition-colors"
          >
            <Download
              className="w-3.5 h-3.5 text-[#45474D]"
              aria-hidden="true"
            />
            <span>Install app</span>
          </button>

          {activeSection === 'projects' && (
            <ProjectHeaderControls
              filterState={filterState}
              onChangeFilter={onChangeFilter}
              displayState={displayState}
              onChangeDisplay={onChangeDisplay}
              milestones={milestones}
              users={users}
              onResetDisplay={onResetDisplay}
            />
          )}
        </div>
      </div>
    </header>
  );
};
