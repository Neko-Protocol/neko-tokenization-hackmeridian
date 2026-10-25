"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAuth } from "@/features/auth/AuthContext";
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
        <div className="flex flex-col gap-2 text-[13px]">
          <p className="capitalize text-white">
            Status: {application.status.replace(/_/g, " ")}
          </p>
          {application.reviewed_at && (
            <p className="text-white/45">
              Decided {formatDate(application.reviewed_at)}
            </p>
          )}
          {application.review_note ? (
            <p className="whitespace-pre-wrap rounded-lg border border-white/5 bg-[#141414] px-3 py-2 text-white/70">
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
    <SectionCard title="Decision">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
            Note
          </span>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required for reject and request changes"
          />
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-wrap gap-2">
          {application.status === "submitted" && (
            <Button
              variant="secondary"
              loading={loading === "in_review"}
              disabled={loading !== null}
              onClick={() => void runDecision("in_review")}
            >
              Start review
            </Button>
          )}
          <Button
            variant="success"
            loading={loading === "approved"}
            disabled={loading !== null}
            onClick={() => void runDecision("approved")}
          >
            Approve
          </Button>
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
      </div>
    </SectionCard>
  );
}
