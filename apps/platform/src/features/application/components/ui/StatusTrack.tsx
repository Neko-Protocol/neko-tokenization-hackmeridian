import { Check, Clock, FileCheck2, FileX2, MessageSquareWarning, Search } from "lucide-react";
import type { ApplicationStatus } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";

export const STATUS: Record<
  ApplicationStatus,
  { label: string; pill: string; Icon: typeof Clock }
> = {
  submitted: { label: "Submitted", pill: "bg-[#229EDF]/12 text-[#8fd0f2]", Icon: Clock },
  in_review: { label: "In review", pill: "bg-[#229EDF]/12 text-[#8fd0f2]", Icon: Search },
  changes_requested: {
    label: "Changes requested",
    pill: "bg-[#f5a524]/12 text-[#f5c26b]",
    Icon: MessageSquareWarning,
  },
  approved: { label: "Approved", pill: "bg-[#2ed06e]/12 text-[#7fe3a6]", Icon: FileCheck2 },
  rejected: { label: "Rejected", pill: "bg-[#ff3b30]/12 text-[#ff8a83]", Icon: FileX2 },
};

export function StatusPill({ status, className }: { status: ApplicationStatus; className?: string }) {
  const { label, pill, Icon } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium",
        pill,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

type StageState = "done" | "current" | "todo" | "warn" | "fail";

function stages(status: ApplicationStatus): { label: string; state: StageState }[] {
  const decision =
    status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Decision";
  return [
    { label: "Submitted", state: "done" },
    {
      label: status === "changes_requested" ? "Changes requested" : "In review",
      state:
        status === "submitted"
          ? "current"
          : status === "changes_requested"
            ? "warn"
            : status === "in_review"
              ? "current"
              : "done",
    },
    {
      label: decision,
      state: status === "approved" ? "done" : status === "rejected" ? "fail" : "todo",
    },
  ];
}

const BAR: Record<StageState, string> = {
  done: "bg-[#2ed06e]",
  current: "bg-[#229EDF]",
  warn: "bg-[#f5a524]",
  fail: "bg-[#ff3b30]",
  todo: "bg-white/[0.08]",
};

const TEXT: Record<StageState, string> = {
  done: "text-white/80",
  current: "text-[#8fd0f2]",
  warn: "text-[#f5c26b]",
  fail: "text-[#ff8a83]",
  todo: "text-white/35",
};

export function StatusTrack({ status }: { status: ApplicationStatus }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stages(status).map((s) => (
        <div key={s.label} className="flex flex-col gap-2">
          <span className={cn("h-1.5 rounded-full", BAR[s.state])} />
          <span className={cn("inline-flex items-center gap-1 text-[13px] font-medium", TEXT[s.state])}>
            {s.state === "done" && <Check className="h-3.5 w-3.5" />}
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
