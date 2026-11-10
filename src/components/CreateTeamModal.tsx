import React, { useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import type { Team, UserProfile } from '../types.ts';

interface CreateTeamModalProps {
  isOpen: boolean;
  users: UserProfile[];
  currentUser: UserProfile;
  onClose: () => void;
  onCreateTeam: (team: Team) => void;
}

const ICON_PRESETS = ['🏢', '🚢', '⚡', '📦', '🎯', '🛠️', '🧭', '🎨'];

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  users,
  currentUser,
  onClose,
  onCreateTeam,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [selectedPmId, setSelectedPmId] = useState<string>(currentUser.id);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([
    currentUser.id,
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length === 1) return;
      setSelectedMemberIds(selectedMemberIds.filter((m) => m !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanName || !cleanCode) {
      setErrorMsg('Please enter both team name and code.');
      return;
    }

    const memberSet = new Set(selectedMemberIds);
    memberSet.add(selectedPmId);

    const newTeam: Team = {
      id: `team-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      code: cleanCode,
      name: cleanName,
      description: description.trim(),
      icon,
      pm_ids: [selectedPmId],
      member_ids: Array.from(memberSet),
      created_at: new Date().toISOString().slice(0, 10),
    };

    onCreateTeam(newTeam);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden text-[#121317]">
        <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between bg-[#F7F8FA]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A4595] text-white flex items-center justify-center text-[13px] font-semibold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="create-team-title"
                className="text-[15px] font-semibold text-[#121317]"
              >
                Create New Team (Admin)
              </h2>
              <p className="text-[11.5px] text-[#6E717A]">
                Organize projects and members into dedicated functional teams
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="team-name"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Team Name
              </label>
              <input
                id="team-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Logistics Operations"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="team-code"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Team Code
              </label>
              <input
                id="team-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OPS"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] font-mono uppercase outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#45474D] mb-1.5">
              Team Icon
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ICON_PRESETS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`w-9 h-9 rounded-xl text-[16px] flex items-center justify-center border transition-all ${
                    icon === ic
                      ? 'border-[#0A4595] bg-[#EEF3FB] scale-105'
                      : 'border-[#E6E8EE] hover:bg-[#F7F8FA]'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="team-desc"
              className="block text-[12px] font-medium text-[#45474D] mb-1"
            >
              Team Mission &amp; Objectives
            </label>
            <textarea
              id="team-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe scope, responsibilities, and team objectives..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none resize-none"
            />
          </div>

          <div>
            <label
              htmlFor="team-pm-select"
              className="block text-[12px] font-medium text-[#45474D] mb-1"
            >
              Team Lead / PM
            </label>
            <select
              id="team-pm-select"
              value={selectedPmId}
              onChange={(e) => setSelectedPmId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] bg-white outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) · {u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#45474D] mb-1.5">
              Assign Team Members ({selectedMemberIds.length})
            </label>
            <div className="max-h-48 overflow-y-auto divide-y divide-[#E6E8EE] rounded-xl border border-[#E6E8EE]">
              {users.map((u) => {
                const isSelected = selectedMemberIds.includes(u.id);
                const isPm = u.id === selectedPmId;
                return (
                  <label
                    key={u.id}
                    className="p-2.5 flex items-center justify-between gap-2 hover:bg-[#F7F8FA] cursor-pointer text-[12.5px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected || isPm}
                        disabled={isPm}
                        onChange={() => toggleMember(u.id)}
                        className="rounded border-[#E6E8EE] text-[#0A4595] focus:ring-[#0A4595]"
                      />
                      <div>
                        <div className="font-medium text-[#121317]">
                          {u.full_name}{' '}
                          {isPm && (
                            <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#EEF3FB] text-[#0A4595] font-semibold">
                              PM
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6E717A]">{u.email}</div>
                      </div>
                    </div>
                    <span className="text-[11.5px] text-[#6E717A]">{u.role}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E6E8EE] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#E6E8EE] hover:bg-[#F1F3F7] text-[13px] font-medium text-[#45474D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#1264D4] text-white text-[13px] font-medium transition-colors"
            >
              Create Team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
