"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  XCircle,
} from "lucide-react";

import { SectionCard } from "@/components/ui/SectionCard";
import { Spinner } from "@/components/ui/Spinner";
import type {
  AdminApplicationView,
  ComplianceStatus,
  EnrichedCitation,
  EnrichedComplianceCheck,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  ComplianceStatus,
  { label: string; Icon: typeof CheckCircle2; className: string }
> = {
  pass: {
    label: "Pass",
    Icon: CheckCircle2,
    className: "text-[#7fe3a6]",
  },
  warn: {
    label: "Warning",
    Icon: AlertTriangle,
    className: "text-amber-200",
  },
  fail: {
    label: "Blocker",
    Icon: XCircle,
    className: "text-[#ff8a83]",
  },
  info: {
    label: "Info",
    Icon: Info,
    className: "text-[#8fd0f2]",
  },
};

function CitationBlock({ cite }: { cite: EnrichedCitation }) {
  if ("unavailable" in cite && cite.unavailable) {
    return (
      <div className="rounded-lg border border-white/5 bg-[#141414] px-3 py-2 text-[12px] text-white/40">
        {cite.norm} art. {cite.article} (unavailable)
      </div>
    );
  }

  const full = cite as EnrichedCitation & {
    id: string;
    title: string;
    version: string;
    text: string;
    sourceUrl: string;
  };

  return (
    <div className="rounded-lg border border-white/5 bg-[#141414] px-3 py-2.5">
      <p className="text-[12px] font-medium text-white">{full.title}</p>
      <p className="mt-0.5 text-[11px] text-white/40">
        {full.id} | version {full.version}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/60">
        {full.text}
      </p>
      {full.sourceUrl ? (
        <a
          href={full.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[11px] text-[#229EDF] hover:underline"
        >
          Source
        </a>
      ) : null}
    </div>
  );
}

function CheckRow({ check }: { check: EnrichedComplianceCheck }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[check.status];
  const Icon = meta.Icon;
  const hasCitations = check.citations.length > 0;

  return (
    <div className="border-t border-white/5 first:border-t-0">
      <button
        type="button"
        onClick={() => hasCitations && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start gap-3 px-1 py-3 text-left",
          hasCitations ? "cursor-pointer" : "cursor-default"
        )}
        disabled={!hasCitations}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white">{check.title}</p>
          <p className="mt-0.5 text-[12px] text-white/45">{check.detail}</p>
        </div>
        {hasCitations && (
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-white/30 transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {open && hasCitations && (
        <div className="flex flex-col gap-2 pb-3 pl-7">
          {check.citations.map((cite) => (
            <CitationBlock key={`${cite.norm}-${cite.article}`} cite={cite} />
          ))}
        </div>
      )}
    </div>
  );
}

type PanelState =
  | { id: string; status: "ok"; checks: EnrichedComplianceCheck[] }
  | { id: string; status: "error"; message: string };

export function CompliancePanel({
  application,
}: {
  application: AdminApplicationView;
}) {
  const [load, setLoad] = useState<PanelState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Compliance request failed");
        return (await res.json()) as { checks: EnrichedComplianceCheck[] };
      })
      .then((data) => {
        if (!cancelled) {
          setLoad({ id: application.id, status: "ok", checks: data.checks });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoad({
            id: application.id,
            status: "error",
            message: "Could not load the compliance checklist.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [application]);

  const loading = load?.id !== application.id;
  const error = !loading && load?.status === "error" ? load.message : null;
  const checks = !loading && load?.status === "ok" ? load.checks : null;

  const blockers = checks?.filter((c) => c.status === "fail").length ?? 0;
  const warnings = checks?.filter((c) => c.status === "warn").length ?? 0;

  return (
    <SectionCard title="Legal compliance">
      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-white/45">
          <Spinner />
          Evaluating checklist...
        </div>
      ) : error ? (
        <p className="text-[13px] text-[#ff8a83]">{error}</p>
      ) : (
        <>
          <p className="text-[13px] text-white/60">
            {blockers} blocker{blockers === 1 ? "" : "s"}, {warnings} warning
            {warnings === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col">
            {checks?.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
          <p className="border-t border-white/5 pt-3 text-[11px] text-white/35">
            Legal texts from Neko Legal KB. Not legal advice.
          </p>
        </>
      )}
    </SectionCard>
  );
}
