import React from 'react';
import {
  Box,
  ChevronDown,
  FolderOpen,
  Inbox,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  SquarePen,
  Users,
} from 'lucide-react';
import { getUserProjectRole, type Project, type UserProfile } from '../types.ts';

export type SidebarSection =
  | 'inbox'
  | 'agent'
  | 'projects'
  | 'files'
  | 'team'
  | 'settings';

interface SidebarProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  workspaceOpen: boolean;
  onToggleWorkspace: () => void;
  teamsOpen: boolean;
  onToggleTeams: () => void;
  inboxBadgeCount: number;
  filesCount: number;
  currentUser: UserProfile;
  totalTeamMembers: number;
  onBackToLanding: () => void;
  onOpenTemplateModal: () => void;
  onOpenEditProject: (projectId: string) => void;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
  onResetDemo: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  projects,
  activeProjectId,
  onSelectProject,
  workspaceOpen,
  onToggleWorkspace,
  teamsOpen,
  onToggleTeams,
  inboxBadgeCount,
  filesCount,
  currentUser,
  totalTeamMembers,
  onBackToLanding,
  onOpenTemplateModal,
  onOpenEditProject,
  onOpenAuthModal,
  onSignOut,
  onResetDemo,
}) => {
  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[#F7F8FA] border-b lg:border-b-0 lg:border-r border-[#E6E8EE] flex flex-col justify-between select-none">
      <div className="p-3.5 space-y-5">
        {/* Top Workspace Header Row (Matches Linear / Google Antigravity style) */}
        <div className="flex items-center justify-between px-1.5">
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-[#121317] font-medium text-[14px] hover:opacity-80 transition-opacity"
            title="Back to Tianlane landing page"
          >
            <img
              src="/favicon.png"
              alt="Tianlane"
              className="w-5 h-5 rounded-md object-contain shadow-clean-xs"
            />
            <span className="truncate">tianlane</span>
            <ChevronDown
              className="w-3.5 h-3.5 text-[#6E717A]"
              aria-hidden="true"
            />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onSelectSection('projects');
                const el = document.querySelector<HTMLInputElement>(
                  'input[placeholder="Add Filter..."]'
                );
                el?.focus();
              }}
              aria-label="Search workspace"
              title="Filter & search"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#45474D] hover:text-[#121317] hover:bg-[#ECEEF3] transition-colors"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenTemplateModal}
              aria-label="New project from template"
              title="New project from template"
              className="w-7 h-7 rounded-full bg-white border border-[#E6E8EE] hover:border-[#B7BFD9] flex items-center justify-center text-[#121317] shadow-clean-xs transition-colors"
            >
              <SquarePen className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Primary Navigation: Inbox & Agent */}
        <nav aria-label="Main navigation" className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectSection('inbox')}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
              activeSection === 'inbox'
                ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Inbox className="w-4 h-4" aria-hidden="true" />
              <span>Inbox</span>
            </span>
            {inboxBadgeCount > 0 && (
              <span className="text-[12px] font-mono text-[#45474D] tabular-nums">
                {inboxBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('agent')}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
              activeSection === 'agent'
                ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Agent</span>
            </span>
          </button>
        </nav>

        {/* Workspace Collapsible Section -> Projects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={onToggleWorkspace}
              className="flex items-center gap-1 text-[12px] font-medium text-[#6E717A] hover:text-[#121317]"
            >
              <span>Workspace</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  workspaceOpen ? '' : '-rotate-90'
                }`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={onOpenTemplateModal}
              title="New project from template"
              aria-label="Add project"
              className="w-5 h-5 rounded flex items-center justify-center text-[#6E717A] hover:text-[#0A4595] hover:bg-[#ECEEF3]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {workspaceOpen && (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectSection('projects')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
                  activeSection === 'projects'
                    ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                    : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Box className="w-4 h-4" aria-hidden="true" />
                  <span>Projects</span>
                </span>
                <span className="text-[11.5px] font-mono text-[#6E717A] tabular-nums">
                  {projects.length}
                </span>
              </button>

              {/* Project items nested under Projects */}
              <div className="pl-6 space-y-0.5 pt-0.5">
                {projects.map((proj) => {
                  const isSelected =
                    activeSection === 'projects' && proj.id === activeProjectId;
                  const myRole = getUserProjectRole(proj, currentUser);
                  return (
                    <div
                      key={proj.id}
                      className={`group w-full px-2.5 py-1.5 rounded-lg text-[12.5px] flex items-center justify-between gap-1.5 transition-colors ${
                        isSelected
                          ? 'bg-white text-[#0A4595] font-medium shadow-clean-xs'
                          : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProject(proj.id);
                          onSelectSection('projects');
                        }}
                        className="flex-1 text-left truncate"
                      >
                        {proj.name}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          title={`Quyền của bạn: ${myRole.toUpperCase()}`}
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-semibold uppercase ${
                            myRole === 'owner'
                              ? 'bg-amber-100 text-amber-800'
                              : myRole === 'writer'
                              ? 'bg-[#EEF3FB] text-[#0A4595]'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {myRole === 'owner'
                            ? 'Owner'
                            : myRole === 'writer'
                            ? 'Writer'
                            : 'View'}
                        </span>
                        <span className="font-mono text-[11px] text-[#6E717A]">
                          {proj.code}
                        </span>
                        {myRole !== 'viewer' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProject(proj.id);
                              onOpenEditProject(proj.id);
                            }}
                            title="Edit or delete project"
                            aria-label={`Edit ${proj.name}`}
                            className="p-1 rounded text-[#6E717A] hover:text-[#0A4595] hover:bg-[#ECEEF3] opacity-75 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={onOpenTemplateModal}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] text-[#0A4595] hover:bg-[#ECEEF3]/60 flex items-center gap-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add project</span>
                </button>
              </div>

              {/* Files & Deliverables Hub */}
              <button
                type="button"
                onClick={() => onSelectSection('files')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors mt-1 ${
                  activeSection === 'files'
                    ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                    : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4" aria-hidden="true" />
                  <span>Files</span>
                </span>
                <span className="text-[11.5px] font-mono text-[#6E717A] tabular-nums">
                  {filesCount}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Your teams Collapsible Section */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={onToggleTeams}
            className="px-2 flex items-center gap-1 text-[12px] font-medium text-[#6E717A] hover:text-[#121317]"
          >
            <span>Your teams</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                teamsOpen ? '' : '-rotate-90'
              }`}
              aria-hidden="true"
            />
          </button>

          {teamsOpen && (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectSection('team')}
                className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
                  activeSection === 'team'
                    ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                    : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded bg-[#0A4595] text-white text-[10px] font-semibold inline-flex items-center justify-center">
                    T
                  </span>
                  <span>Tianlane Team</span>
                </span>
                <span className="text-[11.5px] font-mono text-[#6E717A] tabular-nums">
                  {totalTeamMembers}
                </span>
              </button>

              <div className="pl-6 space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectSection('team')}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-[12.5px] text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317] flex items-center gap-2"
                >
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Members ({totalTeamMembers})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSection('projects')}
                  className="w-full text-left px-2.5 py-1 rounded-lg text-[12.5px] text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317] flex items-center gap-2"
                >
                  <Box className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Projects</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings (Project Standard Settings) */}
        <div className="pt-2 border-t border-[#E6E8EE]">
          <button
            type="button"
            onClick={() => onSelectSection('settings')}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
              activeSection === 'settings'
                ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" aria-hidden="true" />
              <span>Settings</span>
            </span>
            <span className="text-[11px] font-mono text-[#6E717A]">
              Standards
            </span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer: Active SSO Profile & Reset */}
      <div className="p-3.5 border-t border-[#E6E8EE] space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-[#121317] truncate">
              {currentUser.full_name}
            </div>
            <div className="text-[10.5px] font-mono text-[#0A4595] truncate">
              {currentUser.email}
            </div>
            <div className="text-[11px] text-[#6E717A] truncate">
              {currentUser.role}
            </div>
          </div>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-2.5 py-1 rounded-full border border-[#E6E8EE] bg-white hover:border-[#0A4595] text-[11px] text-[#0A4595] font-medium shrink-0"
            >
              Đổi TK
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="py-1.5 px-2.5 rounded-full border border-[#E6E8EE] bg-white hover:border-rose-300 text-[11.5px] text-[#45474D] hover:text-rose-700 flex items-center justify-center gap-1 transition-colors"
            >
              <LogOut className="w-3 h-3" aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetDemo}
            className="py-1.5 px-2.5 rounded-full border border-[#E6E8EE] bg-white hover:border-[#B7BFD9] text-[11.5px] text-[#45474D] hover:text-[#121317] flex items-center justify-center gap-1 transition-colors col-span-1"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
