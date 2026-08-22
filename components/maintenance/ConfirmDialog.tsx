"use client";

import Modal from "./Modal";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-[15px] leading-relaxed text-[#1d1d1f]">{message}</p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-[#e5e5ea] py-3 text-[15px] font-medium text-[#1d1d1f]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="flex-1 rounded-xl bg-[#ff3b30] py-3 text-[15px] font-semibold text-white"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
