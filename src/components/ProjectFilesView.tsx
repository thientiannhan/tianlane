import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  Project,
  ProjectDocRequirement,
  ProjectDocument,
  ProjectMilestone,
  ProjectTask,
  UserProfile,
} from '../types.ts';

interface ProjectFilesViewProps {
  projects: Project[];
  activeProject: Project;
  onSelectProject: (projectId: string) => void;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  documents: ProjectDocument[];
  docRequirements: ProjectDocRequirement[];
  currentUser: UserProfile;
  referenceTodayISO: string;
  onAddDocument: (doc: Omit<ProjectDocument, 'id' | 'uploaded_at'>) => void;
  onDeleteDocument: (docId: string) => void;
  onSaveDocRequirement: (req: ProjectDocRequirement) => void;
  onDeleteDocRequirement: (reqId: string) => void;
}

const DOC_ICONS = [
  '📐',
  '📄',
  '🎨',
  '🏗️',
  '✅',
  '🛡️',
  '📊',
  '🚀',
  '📘',
  '🧪',
  '🗂️',
  '🔑',
];

const DOC_COLORS = [
  { label: 'Tianlane Blue', hex: '#0A4595', bg: '#EEF3FB' },
  { label: 'Ocean Blue', hex: '#2563EB', bg: '#EFF6FF' },
  { label: 'Violet', hex: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Teal', hex: '#0D9488', bg: '#F0FDFA' },
  { label: 'Emerald', hex: '#188038', bg: '#ECFDF5' },
  { label: 'Amber', hex: '#D97706', bg: '#FFFBEB' },
  { label: 'Crimson', hex: '#E11D48', bg: '#FFF1F2' },
];

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const ProjectFilesView: React.FC<ProjectFilesViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  milestones,
  tasks,
  documents,
  docRequirements,
  currentUser,
  onAddDocument,
  onDeleteDocument,
  onSaveDocRequirement,
  onDeleteDocRequirement,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterMilestoneId, setFilterMilestoneId] = useState<string>('all');
  const [filterDocType, setFilterDocType] = useState<string>('all');
  const [showTypeStudio, setShowTypeStudio] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Upload Form State
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSize, setUploadFileSize] = useState<number>(2_450_000);
  const [uploadDocType, setUploadDocType] = useState<string>('Blueprint');
  const [uploadMilestoneId, setUploadMilestoneId] = useState<string>(
    milestones[0]?.id ?? ''
  );
  const [uploadTaskId, setUploadTaskId] = useState<string>('');
  const [uploadVersion, setUploadVersion] = useState<string>('v1.0');

  // New / Edit Deliverable Type Studio State
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [reqDocType, setReqDocType] = useState<string>('Blueprint');
  const [reqIcon, setReqIcon] = useState<string>('📐');
  const [reqColor, setReqColor] = useState<string>('#0A4595');
  const [reqDescription, setReqDescription] = useState<string>(
    'Service blueprint & end-to-end process architecture.'
  );
  const [reqMilestoneId, setReqMilestoneId] = useState<string>(
    milestones[0]?.id ?? ''
  );
  const [reqMandatory, setReqMandatory] = useState<boolean>(true);

  const projectDocs = documents.filter(
    (d) => d.project_id === activeProject.id
  );
  const projectReqs = docRequirements.filter(
    (r) => r.project_id === activeProject.id
  );

  // Compute fulfilled count
  const fulfilledReqsCount = projectReqs.filter((req) =>
    projectDocs.some(
      (d) =>
        d.doc_type.toLowerCase() === req.doc_type.toLowerCase() &&
        (!req.milestone_id || d.milestone_id === req.milestone_id)
    )
  ).length;

  const openQuickUploadForRequirement = (req: ProjectDocRequirement) => {
    setUploadDocType(req.doc_type);
    setUploadMilestoneId(req.milestone_id ?? milestones[0]?.id ?? '');
    setUploadVersion('v1.0');
    setUploadFileName(
      `${activeProject.code.replace(/[^a-zA-Z0-9]/g, '_')}_${req.doc_type.replace(
        /\s+/g,
        '_'
      )}_v1.0.pdf`
    );
    setShowUploadModal(true);
  };

  const [selectedRawFile, setSelectedRawFile] = useState<File | null>(null);

  const handleFileSelectedFromDisk = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedRawFile(file);
    setUploadFileName(file.name);
    setUploadFileSize(Math.min(52_428_800, file.size));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = uploadFileName.trim();
    if (!cleanName) return;

    let finalUrl = `https://storage.tianlane.vn/buckets/${activeProject.code}/${encodeURIComponent(
      cleanName
    )}`;

    try {
      const presignRes = await fetch('/api/storage/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: cleanName,
          contentType: selectedRawFile?.type || 'application/octet-stream',
          fileSizeBytes: uploadFileSize,
          projectId: activeProject.code,
        }),
      });
      if (presignRes.ok) {
        const presignData = await presignRes.json();
        if (presignData.publicUrl) {
          finalUrl = presignData.publicUrl;
        }
        if (presignData.configured && presignData.uploadUrl && selectedRawFile) {
          await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type':
                selectedRawFile.type || 'application/octet-stream',
            },
            body: selectedRawFile,
          });
        }
      }
    } catch {
      // Fallback to Smart Link URL when offline
    }

    onAddDocument({
      project_id: activeProject.id,
      milestone_id: uploadMilestoneId || null,
      task_id: uploadTaskId || null,
      file_name: cleanName,
      file_url: finalUrl,
      file_size_bytes: uploadFileSize,
      version_tag: uploadVersion.trim() || 'v1.0',
      doc_type: uploadDocType.trim() || 'Blueprint',
      uploaded_by: currentUser.full_name,
    });

    setShowUploadModal(false);
    setUploadFileName('');
    setSelectedRawFile(null);
  };

  const handleSaveRequirementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanType = reqDocType.trim();
    if (!cleanType) return;

    const payload: ProjectDocRequirement = {
      id: editingReqId ?? `req-${activeProject.id}-${Date.now()}`,
      project_id: activeProject.id,
      doc_type: cleanType,
      icon: reqIcon,
      accent_color: reqColor,
      description:
        reqDescription.trim() || `${cleanType} deliverable specification.`,
      milestone_id: reqMilestoneId || null,
      is_mandatory: reqMandatory,
    };

    onSaveDocRequirement(payload);
    setEditingReqId(null);
    setReqDocType('');
    setReqDescription('');
  };

  const startEditRequirement = (req: ProjectDocRequirement) => {
    setEditingReqId(req.id);
    setReqDocType(req.doc_type);
    setReqIcon(req.icon);
    setReqColor(req.accent_color);
    setReqDescription(req.description);
    setReqMilestoneId(req.milestone_id ?? '');
    setReqMandatory(req.is_mandatory);
    setShowTypeStudio(true);
  };

  const filteredDocs = projectDocs.filter((doc) => {
    if (filterMilestoneId !== 'all' && doc.milestone_id !== filterMilestoneId) {
      return false;
    }
    if (
      filterDocType !== 'all' &&
      doc.doc_type.toLowerCase() !== filterDocType.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  // Collect all unique doc types for filter pills
  const availableDocTypes = Array.from(
    new Set([
      ...projectReqs.map((r) => r.doc_type),
      ...projectDocs.map((d) => d.doc_type),
    ])
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header & Project Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E8EE] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[20px] font-semibold text-[#121317]">
              Project Files &amp; Deliverable Standards
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#EEF3FB] text-[#0A4595] text-[12px] font-medium tabular-nums">
              {fulfilledReqsCount}/{projectReqs.length} Required Uploaded
            </span>
          </div>
          <p className="text-[13px] text-[#45474D]">
            Configure required document types (Blueprint, PRD, UI/UX, Architecture) and map each deliverable to its project milestone
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Project Switcher */}
          <div className="inline-flex items-center p-1 rounded-full bg-[#F7F8FA] border border-[#E6E8EE]">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectProject(p.id);
                  setFilterMilestoneId('all');
                }}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                  p.id === activeProject.id
                    ? 'bg-white text-[#0A4595] shadow-clean-xs'
                    : 'text-[#45474D] hover:text-[#121317]'
                }`}
              >
                {p.code} · {p.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingReqId(null);
              setReqDocType('Blueprint');
              setReqIcon('📐');
              setReqColor('#0A4595');
              setReqDescription(
                'Service blueprint & process flow required for milestone sign-off.'
              );
              setReqMilestoneId(milestones[0]?.id ?? '');
              setShowTypeStudio((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[12.5px] font-medium transition-colors ${
              showTypeStudio
                ? 'border-[#0A4595] bg-[#EEF3FB] text-[#0A4595]'
                : 'border-[#E6E8EE] hover:border-[#B7BFD9] bg-white text-[#121317]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Configure Document Types</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUploadDocType(projectReqs[0]?.doc_type ?? 'Blueprint');
              setUploadMilestoneId(milestones[0]?.id ?? '');
              setUploadFileName('');
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium shadow-clean-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT TYPE CONFIGURATION STUDIO (Customize Blueprint, PRD, etc. & map to Milestone) */}
      {showTypeStudio && (
        <section
          aria-label="Document Type Configuration Studio"
          className="rounded-2xl border border-[#B7BFD9] bg-[#F7F8FA] p-5 space-y-4 shadow-clean-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-[#121317]">
                {editingReqId
                  ? 'Edit Required Document Type'
                  : 'Add Required Document Type for Project'}
              </h2>
              <p className="text-[12.5px] text-[#45474D]">
                Style your document badge (e.g. Blueprint, System Spec, Security Audit) and assign which Milestone requires it
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTypeStudio(false)}
              className="p-1.5 rounded-full text-[#45474D] hover:text-[#121317] hover:bg-white"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <form
            onSubmit={handleSaveRequirementSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-xl border border-[#E6E8EE]"
          >
            {/* Live Preview Badge */}
            <div className="md:col-span-12 flex items-center justify-between pb-3 border-b border-[#F1F3F7]">
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] text-[#6E717A]">Badge preview:</span>
                <span
                  style={{
                    backgroundColor: `${reqColor}15`,
                    color: reqColor,
                    borderColor: `${reqColor}40`,
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-semibold"
                >
                  <span>{reqIcon}</span>
                  <span>{reqDocType || 'Blueprint'}</span>
                </span>
                {reqMilestoneId && (
                  <span className="text-[12px] text-[#45474D] font-mono">
                    →{' '}
                    {milestones.find((m) => m.id === reqMilestoneId)?.code ??
                      'Milestone'}
                  </span>
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-[12.5px] text-[#121317] cursor-pointer">
                <input
                  type="checkbox"
                  checked={reqMandatory}
                  onChange={(e) => setReqMandatory(e.target.checked)}
                  className="w-4 h-4 accent-[#0A4595]"
                />
                <span>Mandatory for Milestone Gate</span>
              </label>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="req-doc-type-input"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Document Type Name (e.g. Blueprint)
              </label>
              <input
                id="req-doc-type-input"
                type="text"
                value={reqDocType}
                onChange={(e) => setReqDocType(e.target.value)}
                placeholder="e.g. Blueprint, API Spec, Cutover Plan"
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
              />
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="req-milestone-select"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Required in Milestone
              </label>
              <select
                id="req-milestone-select"
                value={reqMilestoneId}
                onChange={(e) => setReqMilestoneId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] bg-white outline-none"
              >
                <option value="">General Project Level</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon ?? '🧭'} {m.code} · {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="req-desc-input"
                className="block text-[12px] font-medium text-[#45474D] mb-1"
              >
                Deliverable Description
              </label>
              <input
                id="req-desc-input"
                type="text"
                value={reqDescription}
                onChange={(e) => setReqDescription(e.target.value)}
                placeholder="What must be included in this file..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] focus:border-[#0A4595] text-[13px] text-[#121317] outline-none"
              />
            </div>

            {/* Icon & Color Pickers */}
            <div className="md:col-span-6">
              <span className="block text-[12px] font-medium text-[#45474D] mb-1.5">
                Choose Icon
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DOC_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setReqIcon(ic)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[15px] transition-all ${
                      reqIcon === ic
                        ? 'border-[#0A4595] bg-[#EEF3FB] ring-1 ring-[#0A4595]'
                        : 'border-[#E6E8EE] bg-white hover:bg-[#F7F8FA]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-6">
              <span className="block text-[12px] font-medium text-[#45474D] mb-1.5">
                Choose Badge Color
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {DOC_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setReqColor(c.hex)}
                    title={c.label}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      reqColor === c.hex
                        ? 'scale-110 ring-2 ring-offset-2 ring-[#121317]'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="md:col-span-12 flex items-center justify-end gap-2 pt-2 border-t border-[#F1F3F7]">
              {editingReqId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingReqId(null);
                    setReqDocType('Blueprint');
                  }}
                  className="px-3.5 py-1.5 rounded-full border border-[#E6E8EE] text-[12.5px] text-[#45474D]"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {editingReqId
                    ? 'Update Document Type'
                    : 'Save Document Type to Project'}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 1. REQUIRED DELIVERABLES BY MILESTONE CARDS */}
      <section aria-label="Required Deliverables by Milestone" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#121317] flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
            <span>Required Project Deliverables by Milestone</span>
          </h2>
          <span className="text-[12px] text-[#6E717A]">
            Click any milestone selector on a card to reassign which phase requires that document
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectReqs.map((req) => {
            const linkedMs = milestones.find((m) => m.id === req.milestone_id);
            const matchingDocs = projectDocs.filter(
              (d) =>
                d.doc_type.toLowerCase() === req.doc_type.toLowerCase() &&
                (!req.milestone_id || d.milestone_id === req.milestone_id)
            );
            const isUploaded = matchingDocs.length > 0;
            const latestDoc = matchingDocs[0];

            return (
              <div
                key={req.id}
                className="rounded-2xl border border-[#E6E8EE] bg-white p-4 flex flex-col justify-between gap-3 shadow-clean-xs hover:border-[#B7BFD9] transition-all"
              >
                <div className="space-y-2.5">
                  {/* Top Row: Styled Doc Type Badge + Status Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{
                        backgroundColor: `${req.accent_color}14`,
                        color: req.accent_color,
                        borderColor: `${req.accent_color}35`,
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-semibold"
                    >
                      <span>{req.icon}</span>
                      <span>{req.doc_type}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      {isUploaded ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                          <CheckCircle2
                            className="w-3 h-3"
                            aria-hidden="true"
                          />
                          <span>Uploaded</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <span>Required</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => startEditRequirement(req)}
                        title="Edit document type & style"
                        className="p-1 rounded-lg text-[#6E717A] hover:text-[#0A4595] hover:bg-[#F7F8FA] text-[11px]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDocRequirement(req.id)}
                        title="Remove document type requirement"
                        aria-label={`Remove ${req.doc_type}`}
                        className="p-1 rounded-lg text-[#6E717A] hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[12.5px] text-[#45474D] leading-relaxed">
                    {req.description}
                  </p>

                  {/* Target Milestone Selector right on the card */}
                  <div className="pt-1">
                    <label className="block text-[11px] font-medium text-[#6E717A] mb-1">
                      Required for Milestone Phase:
                    </label>
                    <select
                      aria-label={`Milestone for ${req.doc_type}`}
                      value={req.milestone_id ?? ''}
                      onChange={(e) =>
                        onSaveDocRequirement({
                          ...req,
                          milestone_id: e.target.value || null,
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[#E6E8EE] bg-[#F7F8FA] hover:border-[#B7BFD9] text-[12px] font-medium text-[#121317] outline-none"
                    >
                      <option value="">General Project Deliverable</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.icon ?? '🧭'} {m.code} · {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bottom Action / Linked File */}
                <div className="pt-3 border-t border-[#F1F3F7]">
                  {isUploaded && latestDoc ? (
                    <div className="flex items-center justify-between gap-2 bg-[#F7F8FA] px-3 py-2 rounded-xl border border-[#E6E8EE]">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[#121317] truncate">
                          {latestDoc.file_name}
                        </div>
                        <div className="text-[11px] text-[#6E717A] font-mono tabular-nums">
                          {latestDoc.version_tag} ·{' '}
                          {formatFileSize(latestDoc.file_size_bytes)} ·{' '}
                          {linkedMs ? linkedMs.code : 'Project'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openQuickUploadForRequirement(req)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E8EE] hover:border-[#0A4595] text-[11px] font-medium text-[#0A4595] shrink-0"
                      >
                        + Version
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openQuickUploadForRequirement(req)}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-[#B7BFD9] hover:border-[#0A4595] bg-[#EEF3FB]/40 hover:bg-[#EEF3FB] text-[#0A4595] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        Upload {req.doc_type} for{' '}
                        {linkedMs ? linkedMs.code : 'Project'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. ALL UPLOADED PROJECT FILES REPOSITORY */}
      <section
        aria-label="Uploaded Project Files"
        className="rounded-2xl border border-[#E6E8EE] bg-white overflow-hidden shadow-clean-xs"
      >
        <div className="px-5 py-4 border-b border-[#E6E8EE] bg-[#FAFBFD] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#0A4595]" aria-hidden="true" />
            <h2 className="text-[14.5px] font-semibold text-[#121317]">
              Uploaded Project Files ({filteredDocs.length})
            </h2>
          </div>

          {/* Filter by Milestone & Document Type */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter files by milestone"
              value={filterMilestoneId}
              onChange={(e) => setFilterMilestoneId(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[12px] text-[#121317]"
            >
              <option value="all">All Milestones</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.icon ?? '🧭'} {m.code} · {m.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter files by document type"
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[12px] text-[#121317]"
            >
              <option value="all">All Document Types</option>
              {availableDocTypes.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[#6E717A]">
            No files uploaded matching the current filter. Click &ldquo;Upload File&rdquo; to attach a project deliverable.
          </div>
        ) : (
          <div className="divide-y divide-[#E6E8EE]">
            {filteredDocs.map((doc) => {
              const ms = milestones.find((m) => m.id === doc.milestone_id);
              const task = tasks.find((t) => t.id === doc.task_id);
              const matchedReq = projectReqs.find(
                (r) => r.doc_type.toLowerCase() === doc.doc_type.toLowerCase()
              );
              const badgeColor = matchedReq?.accent_color ?? '#0A4595';
              const badgeIcon = matchedReq?.icon ?? '📄';

              return (
                <div
                  key={doc.id}
                  className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F7F8FA] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      style={{
                        backgroundColor: `${badgeColor}14`,
                        color: badgeColor,
                        borderColor: `${badgeColor}35`,
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11.5px] font-semibold shrink-0"
                    >
                      <span>{badgeIcon}</span>
                      <span>{doc.doc_type}</span>
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13.5px] font-medium text-[#121317] hover:text-[#0A4595] truncate inline-flex items-center gap-1"
                        >
                          <span>{doc.file_name}</span>
                          <ExternalLink
                            className="w-3 h-3 text-[#6E717A]"
                            aria-hidden="true"
                          />
                        </a>
                        <span className="px-2 py-0.5 rounded-full bg-[#F1F3F7] text-[11px] font-mono text-[#45474D]">
                          {doc.version_tag}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#6E717A] mt-0.5 tabular-nums">
                        <span>{formatFileSize(doc.file_size_bytes)}</span>
                        <span>·</span>
                        <span>
                          Milestone:{' '}
                          <strong className="text-[#45474D] font-medium">
                            {ms ? `${ms.icon ?? '🧭'} ${ms.code} · ${ms.title}` : 'General'}
                          </strong>
                        </span>
                        {task && (
                          <>
                            <span>·</span>
                            <span>Task: {task.code}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>
                          By {doc.uploaded_by} on {doc.uploaded_at}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(doc.id)}
                      title="Delete file"
                      aria-label={`Delete ${doc.file_name}`}
                      className="p-1.5 rounded-lg text-[#6E717A] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* UPLOAD FILE MODAL */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-file-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E6E8EE] shadow-clean-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E6E8EE] flex items-center justify-between bg-[#FAFBFD]">
              <div>
                <h3
                  id="upload-file-modal-title"
                  className="text-[16px] font-semibold text-[#121317]"
                >
                  Upload Project Deliverable
                </h3>
                <p className="text-[12px] text-[#45474D]">
                  Attach file to {activeProject.code} · {activeProject.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-full text-[#45474D] hover:text-[#121317]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* File Picker Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl border-2 border-dashed border-[#B7BFD9] hover:border-[#0A4595] bg-[#F7F8FA] text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelectedFromDisk}
                  className="hidden"
                />
                <Upload
                  className="w-5 h-5 text-[#0A4595] mx-auto mb-1"
                  aria-hidden="true"
                />
                <div className="text-[13px] font-medium text-[#121317]">
                  Click to choose file from your computer
                </div>
                <div className="text-[11.5px] text-[#6E717A]">
                  Supports PDF, Figma (.fig), DOCX, XLSX, Markdown (Max 50 MB)
                </div>
              </div>

              <div>
                <label
                  htmlFor="upload-file-name"
                  className="block text-[12px] font-medium text-[#45474D] mb-1"
                >
                  File Name
                </label>
                <input
                  id="upload-file-name"
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="e.g. SMSC_Service_Blueprint_v1.1.pdf"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13px] text-[#121317]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="upload-doc-type"
                    className="block text-[12px] font-medium text-[#45474D] mb-1"
                  >
                    Document Type
                  </label>
                  <select
                    id="upload-doc-type"
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    {availableDocTypes.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                    {!availableDocTypes.includes('Blueprint') && (
                      <option value="Blueprint">Blueprint</option>
                    )}
                    <option value="External Link">External Link</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="upload-version"
                    className="block text-[12px] font-medium text-[#45474D] mb-1"
                  >
                    Version Tag
                  </label>
                  <input
                    id="upload-version"
                    type="text"
                    value={uploadVersion}
                    onChange={(e) => setUploadVersion(e.target.value)}
                    placeholder="v1.0"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8EE] text-[13px] font-mono text-[#121317]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="upload-milestone"
                    className="block text-[12px] font-medium text-[#45474D] mb-1"
                  >
                    Target Milestone
                  </label>
                  <select
                    id="upload-milestone"
                    value={uploadMilestoneId}
                    onChange={(e) => setUploadMilestoneId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    <option value="">General Project</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.icon ?? '🧭'} {m.code} · {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="upload-task"
                    className="block text-[12px] font-medium text-[#45474D] mb-1"
                  >
                    Linked Task (Optional)
                  </label>
                  <select
                    id="upload-task"
                    value={uploadTaskId}
                    onChange={(e) => setUploadTaskId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E6E8EE] bg-white text-[13px] text-[#121317]"
                  >
                    <option value="">None</option>
                    {tasks
                      .filter(
                        (t) =>
                          !uploadMilestoneId ||
                          t.milestone_id === uploadMilestoneId
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} · {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E6E8EE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-full border border-[#E6E8EE] text-[12.5px] text-[#45474D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[12.5px] font-medium"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Attach Deliverable</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
