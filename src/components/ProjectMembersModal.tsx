import React, { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Eye,
  Link2,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  canUserManageMembers,
  getUserProjectRole,
  isProjectCreator,
  type Project,
  type ProjectMember,
  type ProjectMemberRole,
  type UserProfile,
} from '../types.ts';

interface ProjectMembersModalProps {
  isOpen: boolean;
  project: Project;
  currentUser: UserProfile;
  directoryUsers: UserProfile[];
  onClose: () => void;
  onUpdateProjectMembers: (
    projectId: string,
    nextMembers: ProjectMember[],
    newShareToken?: string,
    defaultInviteRole?: 'viewer' | 'writer'
  ) => void;
  onRegisterNewDirectoryUser: (newUser: UserProfile) => void;
}

export const ROLE_BADGE_META: Record<
  ProjectMemberRole,
  { label: string; shortLabel: string; desc: string; badgeClass: string }
> = {
  owner: {
    label: 'Owner (Full Access)',
    shortLabel: 'Owner',
    desc: 'Full project authority, member management & invite links (Only Project Creator can delete an Owner or delete project)',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  writer: {
    label: 'Writer (Edit)',
    shortLabel: 'Writer',
    desc: 'Create & edit tasks, drag Kanban cards, adjust dates, commit baselines, and upload deliverables',
    badgeClass: 'bg-[#EEF3FB] text-[#0A4595] border-[#B7CDF5]',
  },
  viewer: {
    label: 'Viewer (Read-only)',
    shortLabel: 'Viewer',
    desc: 'Inspect timeline, kanban, deliverables and progress. Editing disabled',
    badgeClass: 'bg-[#F1F3F7] text-[#45474D] border-[#E6E8EE]',
  },
};

export const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  isOpen,
  project,
  currentUser,
  directoryUsers,
  onClose,
  onUpdateProjectMembers,
  onRegisterNewDirectoryUser,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<ProjectMemberRole>('writer');
  const [inviteLinkRole, setInviteLinkRole] = useState<ProjectMemberRole>(
    project.invite_default_role ?? 'writer'
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUserRole = getUserProjectRole(project, currentUser);
  const currentIsCreator = isProjectCreator(project, currentUser);
  const canManage = canUserManageMembers(project, currentUser);

  // Ensure Creator Owner is always present in the rendered member list
  const creatorDirectoryUser =
    directoryUsers.find((u) => u.id === project.owner_id) ?? directoryUsers[0];
  const rawMembers = project.members || [];
  const hasCreatorInList = rawMembers.some(
    (m) =>
      m.user_id === project.owner_id ||
      (creatorDirectoryUser &&
        m.email.toLowerCase() === creatorDirectoryUser.email.toLowerCase())
  );

  const members: ProjectMember[] = hasCreatorInList
    ? rawMembers
    : creatorDirectoryUser
    ? [
        {
          user_id: creatorDirectoryUser.id,
          email: creatorDirectoryUser.email,
          full_name: creatorDirectoryUser.full_name,
          avatar_initials: creatorDirectoryUser.avatar_initials,
          role: 'owner',
          added_at: project.start_date,
          added_by: creatorDirectoryUser.full_name,
        },
        ...rawMembers,
      ]
    : rawMembers;

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://tianlane.huynhthiennhancutehihi.workers.dev';
  const token =
    project.share_token ||
    `tl-${project.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-default`;
  const shareUrl = `${origin}/?project=${encodeURIComponent(
    project.id
  )}&invite=${encodeURIComponent(token)}&role=${encodeURIComponent(
    inviteLinkRole
  )}`;

  const handleCopyInviteLink = async () => {
    try {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        copied = true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      if (copied) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleRegenerateToken = () => {
    if (!canManage) return;
    const cleanCode = project.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const nextToken = `tl-${cleanCode}-${Math.random().toString(36).slice(2, 8)}`;
    onUpdateProjectMembers(project.id, members, nextToken, inviteLinkRole === 'viewer' ? 'viewer' : 'writer');
    setFeedbackMsg('New invite link generated (previous link has been revoked).');
  };

  const handleEmailInputChange = (val: string) => {
    setNewEmail(val);
    setErrorMsg(null);
    setFeedbackMsg(null);
    const clean = val.trim().toLowerCase();
    const matched = directoryUsers.find((u) => u.email.toLowerCase() === clean);
    if (matched) {
      setNewFullName(matched.full_name);
    } else if (clean.includes('@')) {
      const localPart = clean.split('@')[0] || '';
      const derived = localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (derived) setNewFullName(derived);
    }
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (!canManage) {
      setErrorMsg('Only project Owners have permission to add members.');
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address (e.g. member@logtechub.com).');
      return;
    }

    if (newRole === 'owner' && !currentIsCreator) {
      setErrorMsg('Only the Project Creator (Creator Owner) can assign the Owner role.');
      return;
    }

    const existingMember = members.find(
      (m) => m.email.toLowerCase() === cleanEmail
    );
    if (existingMember) {
      setErrorMsg(`Member ${cleanEmail} is already a member of this project.`);
      return;
    }

    const directoryHit = directoryUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    const cleanName =
      newFullName.trim() ||
      directoryHit?.full_name ||
      cleanEmail.split('@')[0];
    const initials =
      directoryHit?.avatar_initials ||
      cleanName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join('') ||
      'LT';
    const userId =
      directoryHit?.id ||
      `usr-${cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '-')}`;

    if (!directoryHit) {
      onRegisterNewDirectoryUser({
        id: userId,
        microsoft_entra_id: `entra-logtechub-${userId}`,
        full_name: cleanName,
        email: cleanEmail,
        avatar_initials: initials,
        role: 'Senior Dev',
        teams_status: 'available',
        teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-teams',
      });
    }

    const addedMember: ProjectMember = {
      user_id: userId,
      email: cleanEmail,
      full_name: cleanName,
      avatar_initials: initials,
      role: newRole,
      added_at: new Date().toISOString().slice(0, 10),
      added_by: currentUser.full_name,
    };

    const nextMembers = [...members, addedMember];
    onUpdateProjectMembers(project.id, nextMembers);
    setNewEmail('');
    setNewFullName('');
    setFeedbackMsg(
      `Added ${cleanName} (${cleanEmail}) as ${ROLE_BADGE_META[newRole].shortLabel}.`
    );
  };

  const handleChangeMemberRole = (
    targetMember: ProjectMember,
    nextRole: ProjectMemberRole
  ) => {
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (!canManage) {
      setErrorMsg('Only an Owner can update member roles.');
      return;
    }

    const targetIsCreator =
      targetMember.user_id === project.owner_id ||
      (project.owner_id === 'usr-po-01' &&
        targetMember.email.toLowerCase() === 'james.nhan@logtechub.com');

    if (targetIsCreator) {
      setErrorMsg('Cannot modify permissions of the Project Creator.');
      return;
    }

    // Rule: Only the Project Creator can demote an existing Owner or promote someone to Owner
    if (
      (targetMember.role === 'owner' || nextRole === 'owner') &&
      !currentIsCreator
    ) {
      setErrorMsg(
        'Only the Project Creator can grant or revoke Owner permissions.'
      );
      return;
    }

    const nextMembers = members.map((m) =>
      m.email.toLowerCase() === targetMember.email.toLowerCase()
        ? { ...m, role: nextRole }
        : m
    );
    onUpdateProjectMembers(project.id, nextMembers);
    setFeedbackMsg(
      `Updated role for ${targetMember.full_name} to ${ROLE_BADGE_META[nextRole].label}.`
    );
  };

  const handleRemoveMember = (targetMember: ProjectMember) => {
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (!canManage) {
      setErrorMsg('Only an Owner can remove members from this project.');
      return;
    }

    const targetIsCreator =
      targetMember.user_id === project.owner_id ||
      (project.owner_id === 'usr-po-01' &&
        targetMember.email.toLowerCase() === 'james.nhan@logtechub.com');

    if (targetIsCreator) {
      setErrorMsg('Cannot remove the Project Creator from this project.');
      return;
    }

    // Strict requirement: Only the project creator can delete an owner
    if (targetMember.role === 'owner' && !currentIsCreator) {
      setErrorMsg(
        'Only the Project Creator can remove an Owner from this project.'
      );
      return;
    }

    const nextMembers = members.filter(
      (m) => m.email.toLowerCase() !== targetMember.email.toLowerCase()
    );
    onUpdateProjectMembers(project.id, nextMembers);
    setFeedbackMsg(`Removed ${targetMember.full_name} from project ${project.code}.`);
  };

  // Directory suggestions not yet in project
  const unaddedDirectoryUsers = directoryUsers.filter(
    (u) => !members.some((m) => m.email.toLowerCase() === u.email.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-members-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E8EE] bg-[#FAFBFD] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#EEF3FB] text-[#0A4595] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="project-members-modal-title"
                className="text-[16px] font-semibold text-[#121317] truncate"
              >
                Members &amp; Project Access · {project.code} {project.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#45474D]">
                <span>Your role ({currentUser.full_name}):</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${ROLE_BADGE_META[currentUserRole].badgeClass}`}
                >
                  {currentIsCreator
                    ? '👑 Project Creator (Owner)'
                    : ROLE_BADGE_META[currentUserRole].label}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-[#F1F3F7]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          {feedbackMsg && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-800"
            >
              {feedbackMsg}
            </div>
          )}

          {/* 1. Share via Invite Link */}
          <div className="p-4 rounded-2xl border border-[#E6E8EE] bg-[#F7F8FA] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0A4595]" />
                <span className="text-[13.5px] font-semibold text-[#121317]">
                  Share via Invite Link
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="invite-role-select"
                  className="text-[12px] text-[#45474D]"
                >
                  Default role via link:
                </label>
                <select
                  id="invite-role-select"
                  value={inviteLinkRole}
                  disabled={!canManage}
                  onChange={(e) =>
                    setInviteLinkRole(e.target.value as ProjectMemberRole)
                  }
                  className="px-2.5 py-1 rounded-lg border border-[#E6E8EE] bg-white text-[12px] font-medium text-[#121317] outline-none disabled:opacity-60"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="writer">Writer (Edit)</option>
                  {currentIsCreator && (
                    <option value="owner">Owner (Full Access)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-white font-mono text-[12px] text-[#121317] outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A4595] hover:bg-[#1264D4] text-white text-[12.5px] font-medium transition-colors shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>

                {canManage && (
                  <button
                    type="button"
                    onClick={handleRegenerateToken}
                    title="Generate a new token to invalidate existing links"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12px] text-[#45474D] hover:text-[#121317] transition-colors shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset link</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11.5px] text-[#6E717A]">
              Anyone opening this link and authenticating with their account will automatically be added to project{' '}
              <span className="font-semibold text-[#121317]">{project.code}</span>{' '}
              with role{' '}
              <span className="font-semibold text-[#0A4595]">
                {ROLE_BADGE_META[inviteLinkRole].label}
              </span>
              .
            </p>
          </div>

          {/* 2. Add Member Directly */}
          {canManage ? (
            <form
              onSubmit={handleAddMember}
              className="p-4 rounded-2xl border border-[#E6E8EE] bg-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold text-[#121317] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#0A4595]" />
                  <span>Add Project Member</span>
                </span>

                {unaddedDirectoryUsers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value=""
                      onChange={(e) => {
                        const hit = directoryUsers.find((u) => u.id === e.target.value);
                        if (hit) {
                          setNewEmail(hit.email);
                          setNewFullName(hit.full_name);
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl border border-[#E6E8EE] bg-[#FAFBFD] text-[11.5px] text-[#45474D] focus:border-[#0A4595] outline-none cursor-pointer"
                    >
                      <option value="">+ Choose colleague from directory...</option>
                      {unaddedDirectoryUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => handleEmailInputChange(e.target.value)}
                    placeholder="Email (e.g. member@logtechub.com)"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[12.5px] text-[#121317] outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[12.5px] text-[#121317] outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={newRole}
                    onChange={(e) =>
                      setNewRole(e.target.value as ProjectMemberRole)
                    }
                    className="w-full px-2.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[12.5px] text-[#121317] bg-white outline-none"
                  >
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="writer">Writer (Edit)</option>
                    {currentIsCreator && (
                      <option value="owner">Owner (Full Access)</option>
                    )}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-full py-2 px-3 rounded-xl bg-[#121317] hover:bg-[#0A4595] text-white text-[12.5px] font-medium transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#E6E8EE] text-[12.5px] text-[#45474D]">
              You currently have{' '}
              <span className="font-semibold text-[#121317]">
                {ROLE_BADGE_META[currentUserRole].label}
              </span>{' '}
              permissions. Only project <span className="font-semibold">Owners</span> can
              manage members or change roles.
            </div>
          )}

          {/* 3. Role Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11.5px]">
            <div className="p-2.5 rounded-xl border border-[#E6E8EE] bg-[#FAFBFD]">
              <div className="font-semibold text-[#121317] flex items-center gap-1.5 mb-0.5">
                <Eye className="w-3.5 h-3.5 text-[#45474D]" />
                <span>Viewer (Read-only)</span>
              </div>
              <p className="text-[#6E717A]">
                Inspect timeline, Kanban cards, and deliverables. Editing is disabled.
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-[#E6E8EE] bg-[#FAFBFD]">
              <div className="font-semibold text-[#0A4595] flex items-center gap-1.5 mb-0.5">
                <Pencil className="w-3.5 h-3.5 text-[#0A4595]" />
                <span>Writer (Edit)</span>
              </div>
              <p className="text-[#6E717A]">
                Create &amp; edit tasks, move Kanban cards, adjust dates, and upload deliverables.
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-[#E6E8EE] bg-[#FAFBFD]">
              <div className="font-semibold text-amber-800 flex items-center gap-1.5 mb-0.5">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>Owner (Project Lead)</span>
              </div>
              <p className="text-[#6E717A]">
                Manage members and access. Only the Project Creator can remove an Owner or delete the project.
              </p>
            </div>
          </div>

          {/* 4. Active Members List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[13px] font-semibold text-[#121317]">
                Project Members ({members.length})
              </h3>
            </div>

            <div className="rounded-2xl border border-[#E6E8EE] divide-y divide-[#E6E8EE] overflow-hidden">
              {members.map((member) => {
                const memberIsCreator =
                  member.user_id === project.owner_id ||
                  (project.owner_id === 'usr-po-01' &&
                    member.email.toLowerCase() === 'james.nhan@logtechub.com');

                // Can current user change or delete this member?
                // 1. Nobody can delete/demote the Creator Owner.
                // 2. If member is an 'owner', ONLY the Creator Owner can change/remove them.
                // 3. Otherwise, any 'owner' can change/remove 'writer' or 'viewer'.
                const canModifyThisMember =
                  canManage &&
                  !memberIsCreator &&
                  (member.role !== 'owner' || currentIsCreator);

                return (
                  <div
                    key={member.email}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-[#FAFBFD]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
                          memberIsCreator
                            ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                            : 'bg-[#EEF3FB] text-[#0A4595]'
                        }`}
                      >
                        {member.avatar_initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-medium text-[#121317] truncate">
                            {member.full_name}
                          </span>
                          {memberIsCreator && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-semibold">
                              <Crown className="w-3 h-3 text-amber-600" />
                              <span>Project Creator</span>
                            </span>
                          )}
                          {member.email.toLowerCase() ===
                            currentUser.email.toLowerCase() && (
                            <span className="px-2 py-0.5 rounded-full bg-[#F1F3F7] text-[#45474D] text-[10.5px]">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] font-mono text-[#6E717A] truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {memberIsCreator ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[12px] font-medium">
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          <span>Owner (Creator)</span>
                        </span>
                      ) : canModifyThisMember ? (
                        <>
                          <select
                            aria-label={`Role for ${member.full_name}`}
                            value={member.role}
                            onChange={(e) =>
                              handleChangeMemberRole(
                                member,
                                e.target.value as ProjectMemberRole
                              )
                            }
                            className="px-2.5 py-1 rounded-lg border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[12px] font-medium text-[#121317] outline-none"
                          >
                            <option value="viewer">Viewer (Read-only)</option>
                            <option value="writer">Writer (Edit)</option>
                            {currentIsCreator && (
                              <option value="owner">Owner (Full Access)</option>
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            title={`Remove ${member.full_name} from project`}
                            className="p-1.5 rounded-lg text-[#6E717A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span
                          title={
                            member.role === 'owner'
                              ? 'Only the Project Creator can modify or remove an Owner'
                              : undefined
                          }
                          className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium border ${
                            ROLE_BADGE_META[member.role].badgeClass
                          }`}
                        >
                          {ROLE_BADGE_META[member.role].label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
