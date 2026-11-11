import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  getApiBaseUrl,
  type ProjectMemberRole,
  type UserProfile,
} from '../types.ts';
import { authenticateLogtechubUser } from '../data/seedData.ts';
import { AntigravityHeroField } from './AntigravityHeroField.tsx';

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
  onAuthenticated: (user: UserProfile, rememberMe: boolean) => void;
}

// Hidden while Microsoft Teams OAuth is not yet connected
const TEAMS_OAUTH_ENABLED = false;

export const TeamsAuthModal: React.FC<TeamsAuthModalProps> = ({
  isOpen,
  users,
  pendingInvite,
  onClose,
  onAuthenticated,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPassword('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const localCheck = authenticateLogtechubUser(identifier, password, users);
    if (!localCheck.ok) {
      setErrorMsg(localCheck.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localCheck.user.email,
          password: password.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          onAuthenticated(data.user as UserProfile, rememberMe);
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
      // Fallback to verified local directory user if backend is waking up
    } finally {
      setIsSubmitting(false);
    }

    onAuthenticated(localCheck.user, rememberMe);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-white text-[#121317] flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-heading"
    >
      {/* Left Panel — Clean Simple White Sign-in Form */}
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 overflow-y-auto bg-white">
        {/* Top-left Brand Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2.5 text-[#121317] font-semibold text-[18px] tracking-tight hover:opacity-80 transition-opacity"
          >
            <img
              src="/tianlan-logo.png"
              alt="Tianlane logo"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#E6E8EE]"
            />
            <span>Tianlane</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6E717A] hover:text-[#121317] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Center Sign-In Block */}
        <div className="w-full max-w-[360px] mx-auto my-auto py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#070A12] mx-auto mb-5 flex items-center justify-center shadow-clean-sm ring-1 ring-[#E6E8EE]">
            <img
              src="/favicon.png"
              alt="Tianlane icon"
              width={26}
              height={26}
              className="w-6.5 h-6.5 object-contain"
            />
          </div>

          <h1
            id="sign-in-heading"
            className="text-[26px] font-semibold tracking-tight text-[#121317] mb-7"
          >
            Welcome back
          </h1>

          {pendingInvite && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#EEF3FB] border border-[#B7CDF5] text-left text-[12.5px] text-[#0A4595] flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  Project Invite{' '}
                  {pendingInvite.projectCode
                    ? `· ${pendingInvite.projectCode} ${pendingInvite.projectName ?? ''}`
                    : ''}
                </div>
                <div className="text-[#121317] mt-0.5">
                  Sign in to join with{' '}
                  <span className="font-semibold uppercase">
                    {pendingInvite.role}
                  </span>{' '}
                  access.
                </div>
              </div>
            </div>
          )}

          {TEAMS_OAUTH_ENABLED && (
            <>
              <button
                type="button"
                className="w-full py-3 px-4 rounded-full border border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[13.5px] font-medium text-[#121317] transition-colors"
              >
                Continue with Microsoft Teams
              </button>
              <div className="my-4 text-[12px] text-[#6E717A]">or</div>
            </>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-left text-[12.5px] text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
            <div>
              <input
                id="login-identifier-input"
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Enter email or username"
                aria-label="Enter email or username"
                className="w-full px-4 py-3.5 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[14px] text-[#121317] placeholder:text-[#9CA3AF] outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Password"
                aria-label="Password"
                className="w-full pl-4 pr-11 py-3.5 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[14px] text-[#121317] placeholder:text-[#9CA3AF] outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#45474D] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[13px] pt-1 pb-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[#45474D] hover:text-[#121317]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D3D6DF] text-[#0A4595] focus:ring-[#0A4595] accent-[#0A4595] cursor-pointer"
                />
                <span>Ghi nhớ đăng nhập (Remember me)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 rounded-full bg-[#070A12] hover:bg-[#0A4595] disabled:opacity-60 text-white text-[14px] font-medium transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          <p className="mt-6 text-[12px] text-[#6E717A]">
            Logtechub Workspace · Sign in with your{' '}
            <span className="font-mono text-[#121317]">@logtechub.com</span>{' '}
            account.
          </p>
        </div>

        {/* Bottom-left subtle footer */}
        <div className="text-[12px] text-[#9CA3AF]">
          © 2026 Tianlane · Logistics TechHub
        </div>
      </div>

      {/* Right Panel — Tianlane Cosmic Starfield Visual */}
      <div className="hidden lg:flex lg:w-[36%] xl:w-[40%] relative overflow-hidden bg-[#070A12] flex-col justify-between p-10 text-white select-none">
        <AntigravityHeroField brandColor="#0A4595" />

        <div className="relative z-10 flex justify-end">
          <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11.5px] font-medium text-gray-200">
            Tianlane Governance
          </span>
        </div>

        <div className="relative z-10 space-y-2 max-w-xs">
          <div className="text-[18px] font-medium tracking-tight text-white">
            Dedicated project governance built for Product Owners
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed">
            Roadmaps, baselines, phase gates, and execution tracker sync in one
            unified workspace.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-end text-[12px] text-gray-400">
          <span>@logtechub</span>
        </div>
      </div>
    </div>
  );
};
