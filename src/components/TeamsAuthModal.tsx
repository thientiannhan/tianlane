import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { getApiBaseUrl, type ProjectMemberRole, type UserProfile } from '../types.ts';

interface PendingInviteInfo {
  projectId: string;
  projectName?: string;
  projectCode?: string;
  token: string;
  role: ProjectMemberRole;
}

interface TeamsAuthModalProps {
  isOpen: boolean;
  users: UserProfile[];
  currentUser: UserProfile | null;
  pendingInvite?: PendingInviteInfo | null;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

const JOB_ROLES: UserProfile['role'][] = [
  'Product Owner',
  'Tech Lead',
  'Senior Dev',
  'UI/UX Designer',
  'QA Engineer',
];

export const TeamsAuthModal: React.FC<TeamsAuthModalProps> = ({
  isOpen,
  users,
  currentUser,
  pendingInvite,
  onClose,
  onAuthenticated,
}) => {
  const [email, setEmail] = useState(currentUser?.email ?? 'james.nhan@logtechub.com');
  const [fullName, setFullName] = useState(currentUser?.full_name ?? 'James Nhan');
  const [jobRole, setJobRole] = useState<UserProfile['role']>(
    currentUser?.role ?? 'Product Owner'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    const matched = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (matched) {
      setFullName(matched.full_name);
      setJobRole(matched.role);
    }
  }, [isOpen, email, users]);

  if (!isOpen) return null;

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setErrorMsg(null);
    const clean = val.trim().toLowerCase();
    const matched = users.find((u) => u.email.toLowerCase() === clean);
    if (matched) {
      setFullName(matched.full_name);
      setJobRole(matched.role);
    } else if (clean.includes('@')) {
      const localPart = clean.split('@')[0] || '';
      const autoName = localPart
        .split(/[._-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (autoName) setFullName(autoName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Vui lòng nhập địa chỉ email Microsoft Teams hợp lệ.');
      return;
    }

    if (!cleanEmail.endsWith('@logtechub.com') && !pendingInvite) {
      setErrorMsg(
        'Vui lòng sử dụng tài khoản Microsoft Teams công ty (@logtechub.com). Các email ngoài tổ chức chỉ được vào khi có Link Invite.'
      );
      return;
    }

    const cleanName = fullName.trim() || cleanEmail.split('@')[0];
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);

    setIsSubmitting(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: existing?.id,
          email: cleanEmail,
          fullName: cleanName,
          role: jobRole,
          microsoftEntraId: existing?.microsoft_entra_id,
          allowInvitedExternal: Boolean(pendingInvite),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          onAuthenticated(data.user as UserProfile);
          onClose();
          return;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error) {
          setErrorMsg(errData.error);
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // Fallback to local profile creation if backend is waking up
    } finally {
      setIsSubmitting(false);
    }

    const initials =
      cleanName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join('') || 'LT';
    const localSlug = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '-');

    const fallbackUser: UserProfile = existing
      ? { ...existing, full_name: cleanName, role: jobRole }
      : {
          id: `usr-${localSlug}`,
          microsoft_entra_id: `entra-logtechub-${localSlug}`,
          full_name: cleanName,
          email: cleanEmail,
          avatar_initials: initials,
          role: jobRole,
          teams_status: 'available',
          teams_webhook_url: 'https://outlook.office.com/webhook/logtechub-teams',
        };

    onAuthenticated(fallbackUser);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teams-sso-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[#121317]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#070A12] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A4595] flex items-center justify-center font-semibold text-[14px] ring-1 ring-white/20">
              T
            </div>
            <div>
              <h2
                id="teams-sso-modal-title"
                className="text-[16px] font-semibold tracking-tight text-white"
              >
                Microsoft Teams SSO · Logtechub
              </h2>
              <p className="text-[12px] text-gray-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Tenant: logtechub.com (Microsoft Entra ID)</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in modal"
            className="p-1.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          {pendingInvite && (
            <div className="p-3.5 rounded-xl bg-[#EEF3FB] border border-[#B7CDF5] text-[12.5px] text-[#0A4595] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  Lời mời tham gia dự án{' '}
                  {pendingInvite.projectCode
                    ? `${pendingInvite.projectCode} · ${pendingInvite.projectName}`
                    : ''}
                </div>
                <div className="text-[#121317] mt-0.5">
                  Đăng nhập tài khoản Teams để nhận quyền{' '}
                  <span className="font-semibold uppercase">
                    {pendingInvite.role === 'owner'
                      ? 'Owner (Quản trị)'
                      : pendingInvite.role === 'writer'
                      ? 'Writer (Chỉnh sửa)'
                      : 'Viewer (Chỉ xem)'}
                  </span>{' '}
                  trong dự án này.
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="teams-email-input"
                className="block text-[12.5px] font-medium text-[#121317] mb-1.5"
              >
                Tài khoản Microsoft Teams (@logtechub.com)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6E717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="teams-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="ten.ban@logtechub.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13.5px] text-[#121317] outline-none"
                />
              </div>
              <p className="mt-1 text-[11.5px] text-[#6E717A]">
                Nhập email Microsoft Teams công ty của bạn (ví dụ:{' '}
                <span className="font-mono text-[#121317]">
                  james.nhan@logtechub.com
                </span>
                ) để đồng bộ hồ sơ và quyền dự án.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="teams-fullname-input"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Họ và tên hiển thị
                </label>
                <input
                  id="teams-fullname-input"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="teams-role-select"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  Chức danh chuyên môn
                </label>
                <select
                  id="teams-role-select"
                  value={jobRole}
                  onChange={(e) =>
                    setJobRole(e.target.value as UserProfile['role'])
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] bg-white outline-none"
                >
                  {JOB_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-5 rounded-full bg-[#0A4595] hover:bg-[#1264D4] disabled:opacity-60 text-white text-[13.5px] font-medium flex items-center justify-center gap-2 transition-colors shadow-clean-xs"
            >
              <span>
                {isSubmitting
                  ? 'Đang xác thực với Logtechub Directory...'
                  : 'Đăng nhập bằng Microsoft Teams'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Directory Quick Switch for Team Members */}
          <div className="pt-4 border-t border-[#E6E8EE]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] font-medium text-[#45474D] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#0A4595]" />
                <span>Danh bạ nhân sự @logtechub.com đã đồng bộ:</span>
              </span>
              <span className="text-[11px] text-[#6E717A]">Chọn nhanh</span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {users.map((u) => {
                const isSelected =
                  u.email.toLowerCase() === email.trim().toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setFullName(u.full_name);
                      setJobRole(u.role);
                      setErrorMsg(null);
                    }}
                    className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'border-[#0A4595] bg-[#EEF3FB]/70'
                        : 'border-[#E6E8EE] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#0A4595]/10 text-[#0A4595] font-semibold text-[11px] flex items-center justify-center shrink-0">
                        {u.avatar_initials}
                      </div>
                      <div className="truncate">
                        <div className="text-[12.5px] font-medium text-[#121317] truncate">
                          {u.full_name}{' '}
                          <span className="text-[#6E717A] font-normal">
                            · {u.role}
                          </span>
                        </div>
                        <div className="text-[11.5px] font-mono text-[#45474D] truncate">
                          {u.email}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#0A4595] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11.5px] text-[#6E717A] pt-1">
            <span className="inline-flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Phiên đăng nhập tự động lưu trên trình duyệt</span>
            </span>
            <span>Neon PostgreSQL Directory Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
