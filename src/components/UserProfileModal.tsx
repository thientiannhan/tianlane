import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Shield, User, X } from 'lucide-react';
import type { UserProfile } from '../types.ts';
import { hashPassword } from '../engine/cryptoUtils.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSave: (updated: UserProfile, passwordHash?: string) => Promise<void> | void;
}

const JOB_ROLES: UserProfile['role'][] = [
  'Owner',
  'Product Owner',
  'Tech Lead',
  'Senior Dev',
  'UI/UX Designer',
  'QA Engineer',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSave,
}) => {
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [avatarInitials, setAvatarInitials] = useState(
    currentUser.avatar_initials
  );
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [role, setRole] = useState<UserProfile['role']>(currentUser.role);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(currentUser.full_name);
      setAvatarInitials(currentUser.avatar_initials);
      setAvatarUrl(currentUser.avatar_url || '');
      setRole(currentUser.role);
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!avatarUrl) {
      const generated =
        val
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w.charAt(0).toUpperCase())
          .join('') || 'LT';
      setAvatarInitials(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.trim().length < 6) {
        setErrorMsg('New password must be at least 6 characters.');
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const passwordHash = newPassword.trim()
        ? await hashPassword(newPassword.trim())
        : currentUser.password_hash;

      const updatedUser: UserProfile = {
        ...currentUser,
        full_name: cleanName,
        avatar_initials: avatarInitials.trim().toUpperCase() || 'LT',
        avatar_url: avatarUrl.trim() || undefined,
        role,
        password_hash: passwordHash,
      };

      await onSave(
        updatedUser,
        newPassword.trim() ? passwordHash : undefined
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update profile'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[#121317]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between bg-[#F7F8FA]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A4595] text-white flex items-center justify-center text-[13px] font-semibold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="profile-modal-title"
                className="text-[15px] font-semibold text-[#121317]"
              >
                Profile &amp; Security
              </h2>
              <p className="text-[11.5px] text-[#6E717A]">
                Update account details, role, and password
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-[#6E717A] hover:text-[#121317] hover:bg-[#E6E8EE] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          {/* Avatar Preview & URL */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F7F8FA] border border-[#E6E8EE]">
            <div className="relative w-14 h-14 rounded-full bg-[#0A4595] text-white flex items-center justify-center text-[18px] font-bold shadow-clean-sm shrink-0 overflow-hidden ring-2 ring-white">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <span>{avatarInitials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <label
                htmlFor="profile-avatar-url"
                className="block text-[11.5px] font-medium text-[#45474D]"
              >
                Avatar URL (or initials fallback)
              </label>
              <input
                id="profile-avatar-url"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-3 py-1.5 rounded-lg border border-[#E6E8EE] focus:border-[#0A4595] text-[12.5px] text-[#121317] outline-none"
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label
              htmlFor="profile-fullname"
              className="block text-[12px] font-medium text-[#45474D] mb-1"
            >
              Full Name
            </label>
            <input
              id="profile-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
            />
          </div>

          {/* Email (Readonly) */}
          <div>
            <label
              htmlFor="profile-email"
              className="block text-[12px] font-medium text-[#45474D] mb-1"
            >
              Corporate Email
            </label>
            <input
              id="profile-email"
              type="text"
              readOnly
              value={currentUser.email}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] bg-[#F1F3F7] text-[13px] text-[#6E717A] outline-none cursor-not-allowed font-mono"
            />
          </div>

          {/* Position / Role */}
          <div>
            <label
              htmlFor="profile-role"
              className="block text-[12px] font-medium text-[#45474D] mb-1"
            >
              Position / Role
            </label>
            <select
              id="profile-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserProfile['role'])}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] bg-white outline-none"
            >
              {JOB_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Change Password Section */}
          <div className="pt-3 border-t border-[#E6E8EE] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#121317] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#0A4595]" />
                <span>Change Account Password</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[11.5px] text-[#6E717A] hover:text-[#0A4595] flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <div>
              <label
                htmlFor="profile-new-pass"
                className="block text-[11.5px] text-[#6E717A] mb-1"
              >
                New password (leave blank to keep unchanged)
              </label>
              <input
                id="profile-new-pass"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
              />
            </div>

            {newPassword.trim() && (
              <div>
                <label
                  htmlFor="profile-confirm-pass"
                  className="block text-[11.5px] text-[#6E717A] mb-1"
                >
                  Confirm new password
                </label>
                <input
                  id="profile-confirm-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
                />
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#E6E8EE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full border border-[#E6E8EE] hover:bg-[#F1F3F7] text-[13px] font-medium text-[#45474D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] disabled:opacity-60 text-white text-[13px] font-medium transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
