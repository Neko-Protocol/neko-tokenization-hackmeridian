"use client";

import { ArrowLeft, ExternalLink, FileText, Link2 } from "lucide-react";
import type { Application } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";
import { FIELD_BY_KEY, type FieldKey } from "../../utils/fields";
import { describeValue } from "../../utils/validation";
import { isUploadedDocument } from "../ui/DocumentsField";
import {
  AssetIcon,
  assetTypeLabel,
  formatDate,
  money,
  surface,
} from "../ui/AssetList";
import { StatusPill, StatusTrack } from "../ui/StatusTrack";

const NOTE_TONE: Record<string, string> = {
  approved: "bg-[#2ed06e]/10 text-[#b5f0cb]",
  rejected: "bg-[#ff3b30]/10 text-[#ffc2bd]",
  changes_requested: "bg-[#f5a524]/10 text-[#fbe0ad]",
};

const GROUPS: { title: string; fields: FieldKey[] }[] = [
  { title: "Issuer", fields: ["issuer_name", "issuer_country", "asset_type"] },
  {
    title: "Offering and investors",
    fields: [
      "offering_type",
      "investor_countries",
      "max_investors",
      "accepts_us_investors",
      "uses_mass_marketing",
    ],
  },
];

const caption = "text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45";

export function AssetDetail({ app, onBack }: { app: Application; onBack: () => void }) {
  const metrics = [
    { label: "Target raise", value: money(app.target_amount, app.currency) },
    { label: "Min. investment", value: money(app.min_ticket, app.currency) },
    { label: "Expected yield", value: app.expected_yield_pct != null ? `${app.expected_yield_pct}%` : "n/a" },
    { label: "Term", value: app.term_months != null ? `${app.term_months} months` : "n/a" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-8 animate-[lp-rise_0.3s_ease-out]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 self-start text-[14.5px] text-white/55 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> All assets
      </button>

      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start gap-4">
          <AssetIcon type={app.asset_type} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[30px] font-medium leading-tight tracking-tight text-white">
              {app.asset_name}
            </h1>
            <p className="text-[15px] text-white/50">
              {assetTypeLabel(app.asset_type)} · Submitted {formatDate(app.created_at)}
            </p>
          </div>
          <StatusPill status={app.status} />
        </div>
        <div className={cn(surface, "p-5")}>
          <StatusTrack status={app.status} />
        </div>
        {app.review_note && (
          <div className={cn("rounded-2xl px-5 py-4", NOTE_TONE[app.status] ?? "bg-white/[0.04] text-white/75")}>
            <p className={cn(caption, "text-current opacity-70")}>Note from Neko</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{app.review_note}</p>
          </div>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className={cn(surface, "flex flex-col gap-1.5 p-5")}>
            <dt className="text-[13.5px] text-white/45">{m.label}</dt>
            <dd className="text-[22px] font-medium text-white">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <span className={cn(caption, "px-1")}>Description</span>
        <p className={cn(surface, "whitespace-pre-wrap px-5 py-4 text-[15px] leading-relaxed text-white/85")}>
          {app.description}
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <span className={cn(caption, "px-1")}>{g.title}</span>
            <dl className={cn(surface, "flex flex-col divide-y divide-white/[0.05] px-5")}>
              {g.fields.map((k) => {
                const text = describeValue(k, app[k as keyof Application]);
                return (
                  <div key={k} className="flex items-start justify-between gap-4 py-3.5 text-[15px]">
                    <dt className="shrink-0 text-white/50">{FIELD_BY_KEY.get(k)!.label}</dt>
                    <dd className={cn("min-w-0 text-right", text ? "text-white" : "text-white/30")}>
                      {text || "Not provided"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className={cn(caption, "px-1")}>Documents</span>
        {app.documents.length === 0 ? (
          <p className={cn(surface, "px-5 py-4 text-[15px] text-white/40")}>No documents attached.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {app.documents.map((d, i) => {
              const Icon = isUploadedDocument(d) ? FileText : Link2;
              return (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(surface, "group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#202020]")}
                >
                  <Icon className="h-5 w-5 shrink-0 text-white/40" />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-white">{d.name}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-white/30 group-hover:text-white/70" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
