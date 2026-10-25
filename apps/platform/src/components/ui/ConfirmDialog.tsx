"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onCancel);
  const busyRef = useRef(busy);

  useEffect(() => {
    dismiss.current = onCancel;
    busyRef.current = busy;
  }, [onCancel, busy]);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) dismiss.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 animate-[lp-fade_0.15s_ease-out]"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1A1A1A] p-5 shadow-2xl animate-[lp-rise_0.15s_ease-out]"
      >
        <h2 id="confirm-title" className="text-[15px] font-semibold text-white">
          {title}
        </h2>
        <p id="confirm-description" className="mt-1.5 text-sm leading-relaxed text-white/55">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 rounded-lg px-3.5 text-sm font-medium text-white/70 outline-none transition-colors hover:bg-white/5 hover:text-white focus-visible:bg-white/5 disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium text-white transition-colors disabled:opacity-60",
              destructive ? "bg-[#ff3b30] hover:bg-[#e6352b]" : "bg-[#229EDF] hover:bg-[#1f8ec9]"
            )}
          >
            {busy && <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
