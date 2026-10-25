"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountUrl } from "@neko-tokenization/stellar";
import { ArrowLeft, ExternalLink, FileText, Sparkles } from "lucide-react";

import { Notice } from "@/components/ui/Notice";
import { SectionCard } from "@/components/ui/SectionCard";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/features/auth/AuthContext";
import { DecisionPanel } from "@/features/applications/DecisionPanel";
import {
  ASSET_TYPE_LABELS,
  StatusBadge,
  VerificationBadge,
} from "@/features/applications/StatusBadge";
import { CompliancePanel } from "@/features/compliance/CompliancePanel";
import { AdminApiError, getApplication } from "@/lib/admin-api";
import type { AdminApplicationView } from "@/lib/types";
import { cn, formatCurrency, formatDate, truncateAddress } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-white/5 py-3 text-[13px] first:border-t-0 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-white/40">{label}</dt>
      <dd className="min-w-0 break-words text-white/85">{value}</dd>
    </div>
  );
}

function KeyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/5 bg-[#141414] px-4 py-3">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={value ? "text-amber-200" : "text-white/70"}>
      {value ? "Yes" : "No"}
    </span>
  );
}

type DetailState =
  | { key: string; status: "ok"; app: AdminApplicationView }
  | { key: string; status: "error"; message: string };

export function ApplicationDetail({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const requestKey = `${accessToken ?? ""}:${id}`;
  const [load, setLoad] = useState<DetailState | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void getApplication(accessToken, id)
      .then((data) => {
        if (!cancelled) {
          setLoad({ key: requestKey, status: "ok", app: data });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        let message = "Could not load the application.";
        if (err instanceof AdminApiError) {
          if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
            message = "Backend unreachable. Try again in a moment.";
          } else if (err.status === 404) {
            message = "Application not found.";
          } else {
            message = err.message || message;
          }
        }
        setLoad({ key: requestKey, status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id, requestKey]);

  const loading = load?.key !== requestKey;
  const error = !loading && load?.status === "error" ? load.message : null;
  const app = !loading && load?.status === "ok" ? load.app : null;

  const onUpdated = (next: AdminApplicationView) => {
    setLoad({ key: requestKey, status: "ok", app: next });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-white/45">
        <Spinner />
        Loading application...
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-[13px] text-white/45 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to applications
        </Link>
        <Notice tone="error">{error ?? "Application not found."}</Notice>
      </div>
    );
  }

  const milestoneSum = app.milestones.reduce(
    (acc, m) => acc + Number(m.amount_pct),
    0
  );
  const issuerName =
    app.issuer.verification.business_name ||
    app.issuer.verification.full_name ||
    app.issuer.display_name ||
    app.issuer_name;

  const milestonesOk = Math.abs(milestoneSum - 100) < 0.001;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/applications"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-white/45 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All applications
      </Link>

      <div className="flex flex-col gap-5 rounded-2xl border border-white/5 bg-[#1C1C1C] p-5 sm:rounded-[24px] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#229EDF]">
              {ASSET_TYPE_LABELS[app.asset_type] ?? app.asset_type} ·{" "}
              {app.offering_type} offering
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
              {app.asset_name}
            </h1>
            <p className="mt-1.5 text-[13px] text-white/50">
              {app.issuer_name} · {app.issuer_country} · Submitted{" "}
              {formatDate(app.created_at)}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KeyFigure
            label="Target amount"
            value={formatCurrency(app.target_amount, app.currency)}
          />
          <KeyFigure
            label="Min ticket"
            value={formatCurrency(app.min_ticket, app.currency)}
          />
          <KeyFigure
            label="Expected yield"
            value={
              app.expected_yield_pct != null
                ? `${app.expected_yield_pct}%`
                : "Not set"
            }
          />
          <KeyFigure
            label="Term"
            value={
              app.term_months != null ? `${app.term_months} months` : "Not set"
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SectionCard title="About the asset">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/75">
              {app.description}
            </p>
          </SectionCard>

          {app.ai_summary ? (
            <SectionCard
              title="AI summary from the issuer"
              description="Text sent by the issuer's Launchpad form together with the application. Neko does not generate or check it, so read it as the issuer's own pitch, not as a review."
              action={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  <Sparkles className="h-3 w-3" />
                  Not verified
                </span>
              }
            >
              <p className="whitespace-pre-wrap rounded-xl border border-white/5 bg-[#141414] px-4 py-3 text-[13px] leading-relaxed text-white/70">
                {app.ai_summary}
              </p>
            </SectionCard>
          ) : null}

          <SectionCard title="Offering details">
            <dl className="flex flex-col">
              <Row
                label="Max investors"
                value={
                  app.max_investors != null
                    ? String(app.max_investors)
                    : "Not set"
                }
              />
              <Row
                label="Investor countries"
                value={
                  app.investor_countries.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {app.investor_countries.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-white/5 px-2 py-0.5 text-[12px] text-white/70"
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "None listed"
                  )
                }
              />
              <Row
                label="Accepts US investors"
                value={<YesNo value={app.accepts_us_investors} />}
              />
              <Row
                label="Mass marketing"
                value={<YesNo value={app.uses_mass_marketing} />}
              />
            </dl>
          </SectionCard>

          <SectionCard
            title="Milestones"
            action={
              app.milestones.length > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    milestonesOk
                      ? "bg-[#2ed06e]/15 text-[#7fe3a6]"
                      : "bg-amber-500/15 text-amber-200"
                  )}
                >
                  {milestonesOk
                    ? "Adds up to 100%"
                    : `Adds up to ${milestoneSum}%, should be 100%`}
                </span>
              ) : null
            }
          >
            {app.milestones.length === 0 ? (
              <p className="text-[13px] text-white/35">No milestones.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {app.milestones.map((m, i) => (
                  <li
                    key={`${m.title}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#141414] px-4 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A] text-[12px] font-medium text-white/60">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-white">
                        {m.title}
                      </p>
                      <p className="text-[12px] text-white/40">
                        {m.due ? `Due ${formatDate(m.due)}` : "No due date"}
                      </p>
                    </div>
                    <span className="text-[14px] font-semibold text-white">
                      {m.amount_pct}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title="Documents">
            {app.documents.length === 0 ? (
              <p className="text-[13px] text-white/35">No documents.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {app.documents.map((doc) => (
                  <li key={`${doc.name}-${doc.url}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-xl border border-white/5 bg-[#141414] px-4 py-3 transition-colors hover:border-[#229EDF]/40"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-white/40" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">
                        {doc.name}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/30 group-hover:text-[#229EDF]" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Issuer"
            action={
              <VerificationBadge
                status={app.issuer.verification.status}
                kind={app.issuer.verification.kind}
              />
            }
          >
            <dl className="flex flex-col">
              <Row label="Name" value={issuerName} />
              <Row label="Email" value={app.issuer.email} />
              <Row
                label="Wallet"
                value={
                  app.issuer.wallet_address ? (
                    <a
                      href={accountUrl(app.issuer.wallet_address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-[#229EDF] hover:underline"
                    >
                      {truncateAddress(app.issuer.wallet_address)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "Not linked"
                  )
                }
              />
            </dl>
          </SectionCard>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <DecisionPanel application={app} onUpdated={onUpdated} />
          <CompliancePanel application={app} />
        </div>
      </div>
    </div>
  );
}
