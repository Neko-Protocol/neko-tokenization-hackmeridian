import { cn } from "@/lib/utils";
import type { ApplicationStatus, VerificationStatus } from "@/lib/types";

const APP_STATUS: Record<
  ApplicationStatus,
  { label: string; className: string }
> = {
  submitted: {
    label: "Submitted",
    className: "bg-[#229EDF]/15 text-[#8fd0f2]",
  },
  in_review: {
    label: "In review",
    className: "bg-amber-500/15 text-amber-200",
  },
  changes_requested: {
    label: "Changes requested",
    className: "bg-orange-500/15 text-orange-200",
  },
  approved: {
    label: "Approved",
    className: "bg-[#2ed06e]/15 text-[#7fe3a6]",
  },
  rejected: {
    label: "Rejected",
    className: "bg-[#ff3b30]/15 text-[#ff8a83]",
  },
};

const VERIFICATION_STATUS: Record<
  VerificationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-white/10 text-white/60",
  },
  in_progress: {
    label: "In progress",
    className: "bg-[#229EDF]/15 text-[#8fd0f2]",
  },
  in_review: {
    label: "In review",
    className: "bg-amber-500/15 text-amber-200",
  },
  approved: {
    label: "Approved",
    className: "bg-[#2ed06e]/15 text-[#7fe3a6]",
  },
  declined: {
    label: "Declined",
    className: "bg-[#ff3b30]/15 text-[#ff8a83]",
  },
  expired: {
    label: "Expired",
    className: "bg-white/10 text-white/50",
  },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = APP_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

export function VerificationBadge({
  status,
  kind,
}: {
  status: VerificationStatus;
  kind: "kyc" | "kyb";
}) {
  const meta = VERIFICATION_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium",
        meta.className
      )}
    >
      <span className="uppercase tracking-wide opacity-70">{kind}</span>
      {meta.label}
    </span>
  );
}

export const STATUS_FILTERS: Array<{
  key: "all" | ApplicationStatus;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In review" },
  { key: "changes_requested", label: "Changes requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export const ASSET_TYPE_LABELS: Record<string, string> = {
  real_estate: "Real estate",
  private_credit: "Private credit",
  invoices: "Invoices",
  agriculture: "Agriculture",
  energy: "Energy",
  other: "Other",
};
