import React from 'react';
import {
  Crown,
  Download,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
} from 'lucide-react';
import {
  canUserEditProject,
  getUserProjectRole,
  isProjectCreator,
  type Project,
  type ProjectMilestone,
  type UserProfile,
} from '../types.ts';
import type { SidebarSection } from './Sidebar.tsx';
import {
  ProjectHeaderControls,
  type ProjectDisplayState,
  type ProjectFilterState,
} from './ProjectHeaderControls.tsx';

interface ProjectTopBarProps {
  activeSection: SidebarSection;
  activeProject: Project;
  currentUser: UserProfile;
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
  onOpenMembersModal: () => void;
  onOpenCreateTask?: () => void;
}

export const ProjectTopBar: React.FC<ProjectTopBarProps> = ({
  activeSection,
  activeProject,
  currentUser,
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
  onOpenMembersModal,
  onOpenCreateTask,
}) => {
  const userRole = getUserProjectRole(activeProject, currentUser);
  const userIsCreator = isProjectCreator(activeProject, currentUser);
  const canEdit = canUserEditProject(activeProject, currentUser);
  const memberCount = Math.max(1, activeProject.members?.length ?? 1);

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

              {/* Active User Role Badge in this Project */}
              <button
                type="button"
                onClick={onOpenMembersModal}
                title="View members and project permissions"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                  userRole === 'owner'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    : userRole === 'writer'
                    ? 'bg-[#EEF3FB] text-[#0A4595] border-[#B7CDF5] hover:bg-[#E0EAFA]'
                    : 'bg-[#F1F3F7] text-[#45474D] border-[#E6E8EE] hover:bg-[#E6E8EE]'
                }`}
              >
                {userRole === 'owner' ? (
                  <Crown className="w-3 h-3 text-amber-600" />
                ) : userRole === 'writer' ? (
                  <Pencil className="w-3 h-3 text-[#0A4595]" />
                ) : (
                  <Eye className="w-3 h-3 text-[#45474D]" />
                )}
                <span>
                  {userIsCreator
                    ? 'Owner (Creator)'
                    : userRole === 'owner'
                    ? 'Owner'
                    : userRole === 'writer'
                    ? 'Writer'
                    : 'Viewer'}
                </span>
              </button>

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

              {canEdit && (
                <button
                  type="button"
                  onClick={onOpenEditProject}
                  title="Edit project details, milestone dates, or delete project"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#E6E8EE] hover:border-[#0A4595] bg-[#F7F8FA] hover:bg-[#EEF3FB] text-[11.5px] font-medium text-[#45474D] hover:text-[#0A4595] transition-colors"
                >
                  <Pencil className="w-3 h-3" aria-hidden="true" />
                  <span>Edit Project</span>
                </button>
              )}
            </>
          ) : (
            <h1 className="text-[16px] font-medium text-[#121317] capitalize">
              {activeSection === 'team'
                ? 'Team Members & Roles'
                : activeSection === 'accounts'
                ? 'Account Directory & Access'
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
          {activeSection === 'projects' && canEdit && onOpenCreateTask && (
            <button
              type="button"
              onClick={onOpenCreateTask}
              title="Create a new task in this project"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium transition-colors shadow-clean-xs"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>+ Add Task</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMembersModal}
            title="Manage project members, access roles (Viewer / Writer / Owner), and invite links"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#B7CDF5] bg-[#EEF3FB] hover:bg-[#E0EAFA] text-[12.5px] font-medium text-[#0A4595] transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Share / Members ({memberCount})</span>
          </button>

          {canEdit && (
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
          )}

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
