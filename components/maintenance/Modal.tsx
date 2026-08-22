"use client";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Shared modal shell for the maintenance module. Full-screen on phone
 * widths (sm:) and a centered card on larger screens — items get added
 * from a phone most of the time, so a small centered dialog on mobile
 * would just mean cramped tap targets.
 */
export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-white sm:max-h-[85vh] sm:w-full sm:max-w-md sm:rounded-2xl sm:shadow-xl rounded-t-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e5ea] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] hover:bg-[#f5f5f7]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
