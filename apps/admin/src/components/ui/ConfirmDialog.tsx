"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Same look as the Neko admin and web-app confirm dialogs. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "success" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  // Portal to <body> so the overlay also covers the sidebar, whatever
  // stacking context the caller sits in.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity duration-200",
        entered ? "opacity-100" : "opacity-0"
      )}
      onClick={onCancel}
    >
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616] p-6 shadow-2xl transition-all duration-300",
          entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <p
          id="confirm-dialog-title"
          className="mb-1 text-base font-semibold text-white"
        >
          {title}
        </p>
        <div className="mb-6 text-sm leading-relaxed text-white/50">
          {description}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-white/6 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors",
              variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
              variant === "success" &&
                "bg-[#2ed06e] text-[#0b2a17] hover:bg-[#27b860]",
              variant === "default" &&
                "bg-[#229EDF] text-white hover:bg-[#1a8bc7]"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
