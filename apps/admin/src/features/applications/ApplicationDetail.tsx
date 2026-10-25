"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountUrl } from "@neko-tokenization/stellar";
import { ArrowLeft, ExternalLink } from "lucide-react";

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
import { formatCurrency, formatDate, truncateAddress } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-[13px]">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/85">{value}</dd>
    </div>
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/applications"
            className="mb-2 inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Applications
          </Link>
          <h1 className="text-xl font-semibold text-white">{app.asset_name}</h1>
          <p className="mt-1 text-[13px] text-white/45">{app.issuer_name}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <SectionCard title="Asset summary">
            <dl className="flex flex-col gap-2.5">
              <Row label="Name" value={app.asset_name} />
              <Row
                label="Type"
                value={ASSET_TYPE_LABELS[app.asset_type] ?? app.asset_type}
              />
              <Row
                label="Description"
                value={
                  <span className="whitespace-pre-wrap">{app.description}</span>
                }
              />
              <Row
                label="Issuer"
                value={`${app.issuer_name} (${app.issuer_country})`}
              />
              <Row
                label="Target amount"
                value={formatCurrency(app.target_amount, app.currency)}
              />
              <Row
                label="Min ticket"
                value={formatCurrency(app.min_ticket, app.currency)}
              />
              <Row
                label="Yield"
                value={
                  app.expected_yield_pct != null
                    ? `${app.expected_yield_pct}%`
                    : "Not set"
                }
              />
              <Row
                label="Term"
                value={
                  app.term_months != null
                    ? `${app.term_months} months`
                    : "Not set"
                }
              />
              <Row
                label="Max investors"
                value={
                  app.max_investors != null
                    ? String(app.max_investors)
                    : "Not set"
                }
              />
              <Row
                label="Offering type"
                value={<span className="capitalize">{app.offering_type}</span>}
              />
              <Row
                label="Investor countries"
                value={
                  app.investor_countries.length > 0
                    ? app.investor_countries.join(", ")
                    : "None listed"
                }
              />
              <Row
                label="Accepts US investors"
                value={app.accepts_us_investors ? "Yes" : "No"}
              />
              <Row
                label="Mass marketing"
                value={app.uses_mass_marketing ? "Yes" : "No"}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Milestones">
            {app.milestones.length === 0 ? (
              <p className="text-[13px] text-white/35">No milestones.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="text-[11px] uppercase tracking-[0.12em] text-white/40">
                      <tr>
                        <th className="pb-2 font-medium">Title</th>
                        <th className="pb-2 font-medium">Amount %</th>
                        <th className="pb-2 font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/80">
                      {app.milestones.map((m, i) => (
                        <tr
                          key={`${m.title}-${i}`}
                          className="border-t border-white/5"
                        >
                          <td className="py-2 pr-3">{m.title}</td>
                          <td className="py-2 pr-3">{m.amount_pct}%</td>
                          <td className="py-2 text-white/45">
                            {m.due ? formatDate(m.due) : "Not set"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p
                  className={
                    Math.abs(milestoneSum - 100) < 0.001
                      ? "text-[12px] text-[#7fe3a6]"
                      : "text-[12px] text-amber-200"
                  }
                >
                  Sum of amount_pct: {milestoneSum}%
                  {Math.abs(milestoneSum - 100) < 0.001
                    ? " (ok)"
                    : " (should be 100%)"}
                </p>
              </>
            )}
          </SectionCard>

          <SectionCard title="Documents">
            {app.documents.length === 0 ? (
              <p className="text-[13px] text-white/35">No documents.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {app.documents.map((doc) => (
                  <li key={`${doc.name}-${doc.url}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] text-[#229EDF] hover:underline"
                    >
                      {doc.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {app.ai_summary ? (
            <SectionCard title="AI summary">
              <p className="whitespace-pre-wrap text-[13px] text-white/70">
                {app.ai_summary}
              </p>
            </SectionCard>
          ) : null}

          <SectionCard title="Issuer">
            <div className="mb-3">
              <VerificationBadge
                status={app.issuer.verification.status}
                kind={app.issuer.verification.kind}
              />
            </div>
            <dl className="flex flex-col gap-2.5">
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
                      className="inline-flex items-center gap-1.5 text-[#229EDF] hover:underline"
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

        <div className="flex flex-col gap-5">
          <CompliancePanel application={app} />
          <DecisionPanel application={app} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}
