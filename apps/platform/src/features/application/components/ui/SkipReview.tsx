"use client";

import { Notice } from "@/components/ui/Notice";
import { BackendError } from "@/lib/services/backend-client";
import type { Application } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";
import { useSkipReview } from "../../hooks/useApplications";

const REVIEW_SKIP_ENABLED = process.env.NEXT_PUBLIC_REVIEW_SKIP_ENABLED === "true";
const PENDING: ReadonlySet<Application["status"]> = new Set([
  "submitted",
  "in_review",
  "changes_requested",
]);

/** Demo only: approves the issuer's own pending application (backend REVIEW_SKIP_ENABLED). */
export function SkipReview({
  app,
  onApproved,
  className,
}: {
  app: Application;
  onApproved?: (app: Application) => void;
  className?: string;
}) {
  const skip = useSkipReview();
  if (!REVIEW_SKIP_ENABLED || !PENDING.has(app.status)) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => skip.mutate(app.id, { onSuccess: onApproved })}
        disabled={skip.isPending}
        className="text-center text-[14px] text-white/45 hover:text-white/80 disabled:opacity-50"
      >
        {skip.isPending ? "Approving…" : "Skip Pre-Approval (demo)"}
      </button>
      {skip.isError && (
        <Notice tone="error">
          {skip.error instanceof BackendError && skip.error.code === "REVIEW_SKIP_DISABLED"
            ? "Skipping pre-approval is turned off on this server."
            : "We couldn't skip pre-approval. Try again in a moment."}
        </Notice>
      )}
    </div>
  );
}
