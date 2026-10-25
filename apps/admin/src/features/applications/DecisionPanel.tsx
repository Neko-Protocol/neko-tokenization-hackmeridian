"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/features/auth/AuthContext";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { AdminApiError, decideApplication } from "@/lib/admin-api";
import type { AdminApplicationView, Decision } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const FINAL: ReadonlySet<string> = new Set(["approved", "rejected"]);

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

  const isFinal = FINAL.has(application.status);

  const runDecision = async (decision: Decision) => {
    if (!accessToken) return;

    const needsNote =
      decision === "rejected" || decision === "changes_requested";
    if (needsNote && !note.trim()) {
      setError("A note is required for this decision.");
      return;
    }

    if (decision === "approved" || decision === "rejected") {
      const label = decision === "approved" ? "approve" : "reject";
      const ok = window.confirm(
        `Are you sure you want to ${label} this application? This decision is final.`
      );
      if (!ok) return;
    }

    setError(null);
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

  if (isFinal) {
    return (
      <SectionCard title="Decision">
        <div className="flex flex-col gap-3 text-[13px]">
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
        <Textarea
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the issuer"
          aria-label="Note for the issuer"
        />

        {error && <Notice tone="error">{error}</Notice>}

        <Button
          variant="success"
          className="w-full"
          loading={loading === "approved"}
          disabled={loading !== null}
          onClick={() => void runDecision("approved")}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            loading={loading === "changes_requested"}
            disabled={loading !== null}
            onClick={() => void runDecision("changes_requested")}
          >
            Request changes
          </Button>
          <Button
            variant="danger"
            loading={loading === "rejected"}
            disabled={loading !== null}
            onClick={() => void runDecision("rejected")}
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
            onClick={() => void runDecision("in_review")}
          >
            Mark as in review
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
