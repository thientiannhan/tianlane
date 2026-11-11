import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  FolderOpen,
  Inbox,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SquarePen,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {
  canUserAccessTeam,
  getUserProjectRole,
  isUserAdmin,
  isUserTeamPM,
  type Project,
  type Team,
  type UserProfile,
} from '../types.ts';

export type SidebarSection =
  | 'inbox'
  | 'agent'
  | 'projects'
  | 'files'
  | 'team'
  | 'settings'
  | 'accounts';

interface SidebarProps {
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
  teams: Team[];
  activeTeamId: string;
  onSelectTeam: (teamId: string) => void;
  onOpenCreateTeam?: () => void;
  onDeleteTeam?: (teamId: string) => void;
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
  onOpenUserProfile: () => void;
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
  teams,
  activeTeamId,
  onSelectTeam,
  onOpenCreateTeam,
  onDeleteTeam,
  workspaceOpen,
  onToggleWorkspace,
  teamsOpen,
  onToggleTeams,
  inboxBadgeCount,
  filesCount,
  currentUser,
  onOpenTemplateModal,
  onOpenEditProject,
  onOpenUserProfile,
  onOpenAuthModal,
  onSignOut,
  onResetDemo,
}) => {
  const [showBrandMenu, setShowBrandMenu] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);
  const teamMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = isUserAdmin(currentUser);
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0];

  // Admin sees all teams; other users only see teams they belong to
  const accessibleTeams = teams.filter((t) => canUserAccessTeam(t, currentUser));

  // Projects strictly filtered by the currently active team (1:1 boundary)
  const visibleProjects = projects.filter(
    (p) => p.team_id === activeTeam?.id
  );

  const isPmOfActiveTeam = isUserTeamPM(activeTeam, currentUser);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        brandMenuRef.current &&
        !brandMenuRef.current.contains(e.target as Node)
      ) {
        setShowBrandMenu(false);
      }
      if (
        teamMenuRef.current &&
        !teamMenuRef.current.contains(e.target as Node)
      ) {
        setShowTeamMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[#F7F8FA] border-b lg:border-b-0 lg:border-r border-[#E6E8EE] flex flex-col justify-between select-none lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <div className="p-3.5 space-y-4 flex-1">
        {/* Top Workspace Header Row: Brand Button with Profile / Options Menu */}
        <div className="relative" ref={brandMenuRef}>
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowBrandMenu((v) => !v)}
              className="flex items-center gap-2 text-[#121317] font-semibold text-[14px] hover:bg-[#ECEEF3] px-2 py-1.5 rounded-xl transition-colors"
              title="Workspace & account options"
            >
              <img
                src="/favicon.png"
                alt="Tianlane"
                className="w-5 h-5 rounded-md object-contain shadow-clean-xs"
              />
              <span className="truncate">tianlane</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#6E717A] transition-transform ${
                  showBrandMenu ? 'rotate-180 text-[#0A4595]' : ''
                }`}
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

          {/* Brand Dropdown Menu (Profile, Settings, Log out) */}
          {showBrandMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-60 z-40 bg-white border border-[#E6E8EE] rounded-2xl shadow-clean-lg p-2 animate-in fade-in">
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] border border-[#E6E8EE] mb-2 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#0A4595] text-white flex items-center justify-center font-semibold text-[13px] shrink-0 overflow-hidden">
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{currentUser.avatar_initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#121317] truncate flex items-center gap-1">
                    <span>{currentUser.full_name}</span>
                    {isAdmin && (
                      <span className="text-[9.5px] px-1 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[#6E717A] truncate">
                    {currentUser.email}
                  </div>
                  <div className="text-[11px] text-[#0A4595] truncate">
                    {currentUser.role}
                  </div>
                </div>
              </div>

              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowBrandMenu(false);
                    onOpenUserProfile();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left text-[12.5px] font-medium text-[#121317] hover:bg-[#F1F3F7] flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-[#0A4595]" />
                  <span>Profile &amp; Password</span>
                </button>

                <div className="border-t border-[#E6E8EE] my-1" />

                {onSignOut && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBrandMenu(false);
                      onSignOut();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
         * TEAM SWITCHER DROPDOWN (Right directly above Inbox)
         * ========================================================================= */}
        <div className="relative" ref={teamMenuRef}>
          <button
            type="button"
            onClick={() => setShowTeamMenu((v) => !v)}
            className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#E6E8EE] hover:border-[#0A4595] shadow-clean-xs flex items-center justify-between transition-all group cursor-pointer"
            title="Switch active team"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-[#EEF3FB] text-[#0A4595] flex items-center justify-center text-[13px] shrink-0">
                {activeTeam?.icon || '🏢'}
              </span>
              <div className="text-left truncate">
                <div className="text-[12.5px] font-semibold text-[#121317] truncate leading-tight">
                  {activeTeam?.name || 'Select Team'}
                </div>
                <div className="text-[10.5px] text-[#6E717A] truncate">
                  {isAdmin
                    ? 'Admin · Full access'
                    : isPmOfActiveTeam
                    ? 'Team PM'
                    : 'Member'}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#6E717A] group-hover:text-[#0A4595] shrink-0 ml-1 transition-transform ${
                showTeamMenu ? 'rotate-180 text-[#0A4595]' : ''
              }`}
            />
          </button>

          {showTeamMenu && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white border border-[#E6E8EE] rounded-2xl shadow-clean-lg p-1.5 overflow-hidden animate-in fade-in">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6E717A] border-b border-[#E6E8EE] flex items-center justify-between">
                <span>{isAdmin ? 'All Teams (Admin)' : 'Your Teams'}</span>
                <span className="text-[10px] text-[#0A4595] font-mono">
                  {accessibleTeams.length}
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                {accessibleTeams.map((team) => {
                  const isSelected = team.id === activeTeam?.id;
                  const isPm = team.pm_ids?.includes(currentUser.id);
                  return (
                    <div
                      key={team.id}
                      className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-[12.5px] transition-colors group ${
                        isSelected
                          ? 'bg-[#EEF3FB] text-[#0A4595] font-semibold'
                          : 'text-[#121317] hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTeam(team.id);
                          setShowTeamMenu(false);
                        }}
                        className="flex items-center gap-2 truncate text-left flex-1"
                      >
                        <span className="text-[14px]">{team.icon || '🏢'}</span>
                        <div className="truncate">
                          <div className="truncate leading-snug">{team.name}</div>
                          <div className="text-[10.5px] text-[#6E717A] font-normal truncate">
                            {team.code} · {team.member_ids?.length || 0} members
                            {isPm && (
                              <span className="ml-1 text-[#0A4595] font-semibold">
                                · PM
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#0A4595]" />
                        )}
                        {isAdmin && onDeleteTeam && teams.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTeamMenu(false);
                              onDeleteTeam(team.id);
                            }}
                            title={`Delete team ${team.name}`}
                            className="p-1 rounded text-[#6E717A] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAdmin && onOpenCreateTeam && (
                <div className="border-t border-[#E6E8EE] pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeamMenu(false);
                      onOpenCreateTeam();
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-[12px] font-semibold text-[#0A4595] hover:bg-[#EEF3FB] rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create new team...</span>
                  </button>
                </div>
              )}
            </div>
          )}
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

        {/* Workspace Collapsible Section: Projects belonging to activeTeam */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={onToggleWorkspace}
            className="px-2 flex items-center gap-1 text-[12px] font-medium text-[#6E717A] hover:text-[#121317]"
          >
            <span>Projects ({activeTeam?.code || 'Team'})</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                workspaceOpen ? '' : '-rotate-90'
              }`}
              aria-hidden="true"
            />
          </button>

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
                  {visibleProjects.length}
                </span>
              </button>

              <div className="pl-6 space-y-0.5">
                {visibleProjects.map((proj) => {
                  const isSelected =
                    activeSection === 'projects' && activeProjectId === proj.id;
                  const myRole = getUserProjectRole(proj, currentUser);

                  return (
                    <div
                      key={proj.id}
                      onClick={() => {
                        onSelectProject(proj.id);
                        onSelectSection('projects');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          onSelectProject(proj.id);
                          onSelectSection('projects');
                        }
                      }}
                      className={`group w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] flex items-center justify-between gap-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                          : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 truncate">
                        {proj.avatar_url ? (
                          <img
                            src={proj.avatar_url}
                            alt={proj.name}
                            className="w-4 h-4 rounded object-cover border border-[#E6E8EE] shrink-0"
                          />
                        ) : (
                          <span className="w-4 h-4 rounded bg-[#EEF3FB] text-[#0A4595] text-[9.5px] font-bold flex items-center justify-center shrink-0">
                            {proj.code.slice(0, 2)}
                          </span>
                        )}
                        <span className="truncate">{proj.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9.5px] font-semibold uppercase px-1 rounded ${
                            myRole === 'owner'
                              ? 'bg-amber-100 text-amber-800'
                              : myRole === 'writer'
                              ? 'bg-[#EEF3FB] text-[#0A4595]'
                              : 'bg-gray-100 text-[#6E717A]'
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

                {(isAdmin || isPmOfActiveTeam) && (
                  <button
                    type="button"
                    onClick={onOpenTemplateModal}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] text-[#0A4595] hover:bg-[#ECEEF3]/60 flex items-center gap-1.5 font-medium cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Add project ({activeTeam?.code})</span>
                  </button>
                )}
              </div>

              {/* Files Hub */}
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

        {/* Your Team Section */}
        <div className="space-y-1">
          <div className="px-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onToggleTeams}
              className="flex items-center gap-1 text-[12px] font-medium text-[#6E717A] hover:text-[#121317]"
            >
              <span>Team &amp; Access</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  teamsOpen ? '' : '-rotate-90'
                }`}
                aria-hidden="true"
              />
            </button>
            {isAdmin && onOpenCreateTeam && (
              <button
                type="button"
                onClick={onOpenCreateTeam}
                title="Create new team (Admin)"
                className="w-5 h-5 rounded hover:bg-[#ECEEF3] text-[#6E717A] hover:text-[#0A4595] flex items-center justify-center transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {teamsOpen && (
            <div className="space-y-1">
              {accessibleTeams.map((team) => {
                const isActive = team.id === activeTeam?.id;
                const isPm = team.pm_ids?.includes(currentUser.id);
                return (
                  <div key={team.id} className="space-y-0.5">
                    <div
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13px] transition-colors group ${
                        isActive
                          ? 'bg-[#ECEEF3] text-[#121317] font-semibold'
                          : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTeam(team.id);
                        }}
                        className="flex items-center gap-2 truncate text-left flex-1 cursor-pointer"
                      >
                        <span className="text-[13px] shrink-0">
                          {team.icon || '🏢'}
                        </span>
                        <span className="truncate">{team.name}</span>
                        {isPm && (
                          <span className="text-[9.5px] px-1 rounded bg-[#EEF3FB] text-[#0A4595] font-semibold shrink-0">
                            PM
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span className="text-[11.5px] font-mono text-[#6E717A] tabular-nums">
                          {team.member_ids?.length || 0}
                        </span>
                        {isAdmin && onDeleteTeam && teams.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTeam(team.id);
                            }}
                            title={`Delete team ${team.name}`}
                            className="p-1 rounded text-[#6E717A] hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-item: Members & Roles under the active team */}
                    {isActive && (
                      <div className="pl-6 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => onSelectSection('team')}
                          className={`w-full text-left px-2.5 py-1 rounded-lg text-[12px] flex items-center gap-2 transition-colors cursor-pointer ${
                            activeSection === 'team'
                              ? 'text-[#0A4595] font-medium bg-[#EEF3FB]'
                              : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Members &amp; Roles</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isAdmin && onOpenCreateTeam && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenCreateTeam}
                    className="w-full text-left px-2.5 py-1 rounded-lg text-[12px] text-[#0A4595] hover:bg-[#ECEEF3]/60 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create new team...</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account Directory (Admin) */}
        {isAdmin && (
          <div className="pt-2 border-t border-[#E6E8EE]">
            <button
              type="button"
              onClick={() => onSelectSection('accounts')}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[13.5px] transition-colors ${
                activeSection === 'accounts'
                  ? 'bg-[#ECEEF3] text-[#121317] font-medium'
                  : 'text-[#45474D] hover:bg-[#ECEEF3]/60 hover:text-[#121317]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
                <span>Accounts</span>
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                Admin
              </span>
            </button>
          </div>
        )}

        {/* Settings (Standards) */}
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

      {/* Sidebar Footer: Profile Trigger & Reset (Sticky at bottom of sidebar) */}
      <div className="p-3.5 border-t border-[#E6E8EE] space-y-2.5 bg-[#F7F8FA] sticky bottom-0 z-10">
        <div
          onClick={onOpenUserProfile}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenUserProfile();
          }}
          className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-[#ECEEF3] cursor-pointer transition-colors"
          title="Account Profile &amp; Settings"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0A4595] text-white flex items-center justify-center font-semibold text-[12px] shrink-0 overflow-hidden">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser.avatar_initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[#121317] truncate flex items-center gap-1">
                <span>{currentUser.full_name}</span>
                {isAdmin && (
                  <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                    Admin
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#6E717A] truncate">
                {currentUser.role}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-[#0A4595] px-2 py-0.5 rounded-full border border-[#B7CDF5] bg-[#EEF3FB] shrink-0">
            Profile
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="py-1.5 px-2.5 rounded-full border border-[#E6E8EE] bg-white hover:border-rose-300 text-[11.5px] text-[#45474D] hover:text-rose-700 flex items-center justify-center gap-1 transition-colors"
            >
              <LogOut className="w-3 h-3" aria-hidden="true" />
              <span>Sign out</span>
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
