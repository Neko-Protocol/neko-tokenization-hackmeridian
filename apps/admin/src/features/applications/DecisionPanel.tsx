"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/features/auth/AuthContext";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { AdminApiError, decideApplication } from "@/lib/admin-api";
import type { AdminApplicationView, Decision } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const FINAL: ReadonlySet<string> = new Set(["approved", "rejected"]);

const SAVED_MESSAGES: Record<Decision, string> = {
  in_review: "Marked as in review.",
  approved: "Application approved.",
  rejected: "Application rejected.",
  changes_requested: "Changes requested. The issuer will see your note.",
};

const CONFIRM_COPY: Partial<
  Record<
    Decision,
    {
      title: string;
      description: string;
      confirmLabel: string;
      variant: "default" | "success" | "danger";
    }
  >
> = {
  approved: {
    title: "Approve this application?",
    description:
      "The issuer can then move on to tokenizing the asset. This decision is final and cannot be undone.",
    confirmLabel: "Approve",
    variant: "success",
  },
  rejected: {
    title: "Reject this application?",
    description:
      "The issuer sees your note. This decision is final and cannot be undone.",
    confirmLabel: "Reject",
    variant: "danger",
  },
  changes_requested: {
    title: "Request changes?",
    description: "The issuer will see your note. You can still decide later.",
    confirmLabel: "Send request",
    variant: "default",
  },
};

export function DecisionPanel({
  application,
  onUpdated,
}: {
  application: AdminApplicationView;
  onUpdated: (next: AdminApplicationView) => void;
}) {
  const { accessToken } = useAuth();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<Decision | null>(null);
  const [pending, setPending] = useState<Decision | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const isFinal = FINAL.has(application.status);
  const launchBlocker = launchReadiness(application);

  const runDecision = async (decision: Decision) => {
    if (!accessToken) return;
    setPending(null);
    setError(null);
    setSaved(null);
    setLoading(decision);
    try {
      const next = await decideApplication(
        accessToken,
        application.id,
        decision,
        note.trim() ? note.trim() : undefined
      );
      onUpdated(next);
      setNote("");
      setSaved(SAVED_MESSAGES[decision]);
    } catch (err) {
      if (err instanceof AdminApiError) {
        if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
          setError("Backend unreachable. Try again in a moment.");
        } else {
          setError(err.message || "Could not record the decision.");
        }
      } else {
        setError("Could not record the decision.");
      }
    } finally {
      setLoading(null);
    }
  };

  const ask = (decision: Decision) => {
    const needsNote =
      decision === "rejected" || decision === "changes_requested";
    if (needsNote && !note.trim()) {
      setError("Write a note for the issuer first. They will see it.");
      noteRef.current?.focus();
      return;
    }
    setError(null);
    if (decision === "in_review") {
      void runDecision(decision);
      return;
    }
    setPending(decision);
  };

  const dialog = pending ? CONFIRM_COPY[pending] : null;

  if (isFinal) {
    return (
      <SectionCard title="Decision">
        <div className="flex flex-col gap-3 text-[13px]">
          {saved && <Notice tone="success">{saved}</Notice>}
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={application.status} />
            {application.reviewed_at && (
              <span className="text-[12px] text-white/40">
                Decided {formatDate(application.reviewed_at)}
              </span>
            )}
          </div>
          {application.review_note ? (
            <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-[#141414] px-4 py-3 text-white/70">
              {application.review_note}
            </p>
          ) : (
            <p className="text-white/35">No note recorded.</p>
          )}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Decision"
      description="Approve to move the asset to tokenization. A note is required to reject or request changes, and the issuer sees it."
    >
      <div className="flex flex-col gap-3">
        {saved && <Notice tone="success">{saved}</Notice>}
        <Textarea
          ref={noteRef}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the issuer"
          aria-label="Note for the issuer"
        />

        {error && <Notice tone="error">{error}</Notice>}
        {launchBlocker && (
          <Notice tone="error">
            {launchBlocker} Request changes instead: a vault can&apos;t be launched from it.
          </Notice>
        )}

        <Button
          variant="success"
          className="w-full"
          loading={loading === "approved"}
          disabled={loading !== null || launchBlocker !== null}
          onClick={() => ask("approved")}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            loading={loading === "changes_requested"}
            disabled={loading !== null}
            onClick={() => ask("changes_requested")}
          >
            Request changes
          </Button>
          <Button
            variant="danger"
            loading={loading === "rejected"}
            disabled={loading !== null}
            onClick={() => ask("rejected")}
          >
            Reject
          </Button>
        </div>
        {application.status === "submitted" && (
          <Button
            variant="ghost"
            className="w-full"
            loading={loading === "in_review"}
            disabled={loading !== null}
            onClick={() => ask("in_review")}
          >
            Mark as in review
          </Button>
        )}
      </div>
      {dialog && pending && (
        <ConfirmDialog
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          variant={dialog.variant}
          onConfirm={() => void runDecision(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </SectionCard>
  );
}

/**
 * Approval lets the issuer launch a vault straight away, so it needs every
 * term the vault's constructor takes. Older applications were sent without a
 * minimum raise or a repayment schedule.
 */
function launchReadiness(app: AdminApplicationView): string | null {
  if (app.min_target == null) return "This application has no minimum raise.";
  if (app.expected_yield_pct == null || app.term_months == null)
    return "This application has no yield or term.";
  if (app.milestones.length === 0) return "This application has no repayment schedule.";
  const total = app.milestones.reduce((sum, m) => sum + Number(m.amount_pct), 0);
  if (Math.abs(total - 100) > 0.001) return "The repayment schedule doesn't add up to 100%.";
  if (app.milestones.some((m) => !m.due)) return "A repayment has no due date.";
  return null;
}
