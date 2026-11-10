import React from 'react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install Tianlane Desktop App"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white border border-[#E6E8EE] shadow-clean-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <img
            src="/favicon.png"
            alt="Tianlane logo"
            className="w-10 h-10 rounded-xl shadow-clean-xs"
          />
          <div>
            <h2 className="text-[17.5px] font-medium text-[#121317]">
              Install Tianlane Desktop App
            </h2>
            <span className="text-[12px] text-[#6E717A]">
              Progressive Web App
            </span>
          </div>
        </div>
        <p className="text-[13.5px] text-[#45474D] leading-relaxed">
          Tianlane supports Progressive Web App (PWA) installation. Click the
          install icon in your browser address bar (Chrome or Edge) to pin
          Tianlane directly to your Desktop or Taskbar.
        </p>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#0A4595] hover:bg-[#083778] text-white text-[13px] font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
