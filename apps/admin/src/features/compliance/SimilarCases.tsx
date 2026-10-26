"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  ASSET_TYPE_LABELS,
  StatusBadge,
} from "@/features/applications/StatusBadge";
import { useAuth } from "@/features/auth/AuthContext";
import { getSimilarApplications } from "@/lib/admin-api";
import type { SimilarApplicationsResponse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type CasesState = {
  id: string;
  token: string;
  attempt: number;
} & ({ status: "ok"; data: SimilarApplicationsResponse } | { status: "error" });

export function SimilarCases({ applicationId }: { applicationId: string }) {
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<CasesState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    const key = { id: applicationId, token: accessToken, attempt };
    void getSimilarApplications(accessToken, applicationId)
      .then((data) => {
        if (!cancelled) setLoad({ ...key, status: "ok", data });
      })
      .catch(() => {
        if (!cancelled) setLoad({ ...key, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, accessToken, attempt]);

  const current =
    load?.id === applicationId &&
    load.token === accessToken &&
    load.attempt === attempt
      ? load
      : null;
  const data = current?.status === "ok" ? current.data : null;
  const summary = data
    ? [
        [data.summary.approved, "approved"],
        [data.summary.rejected, "rejected"],
        [data.summary.changes_requested, "changes requested"],
      ]
        .filter(([count]) => Number(count) > 0)
        .map(([count, label]) => `${count} ${label}`)
        .join(", ")
    : "";

  return (
    <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
      <div>
        <h3 className="text-[14px] font-semibold text-white">Similar cases</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-white/40">
          Learns from every decision. Past reviews with similar proposal
          details.
        </p>
      </div>
      <div aria-live="polite" aria-busy={!!accessToken && !current}>
        {!accessToken ? (
          <p className="text-[13px] text-white/45">
            Sign in to load similar cases.
          </p>
        ) : !current ? (
          <div className="flex items-center gap-2 text-[13px] text-white/45">
            <Spinner />
            Finding similar cases...
          </div>
        ) : current.status === "error" ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[13px] text-[#ff8a83]">
              Could not load similar cases.
            </p>
            <Button
              variant="secondary"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </Button>
          </div>
        ) : data && data.cases.length > 0 ? (
          <>
            <p className="text-[13px] text-white/70">
              {data.cases.length} similar: {summary}.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {data.cases.map((item) => (
                <li
                  key={item.id}
                  className="min-w-0 rounded-xl border border-white/5 bg-[#141414] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/applications/${encodeURIComponent(item.id)}`}
                      className="min-w-0 break-words text-[13px] font-medium text-[#8fd0f2] hover:underline"
                    >
                      {item.asset_name}
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-[12px] text-white/45">
                    {ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}
                    {" · "}
                    {item.issuer_country} · {item.offering_type} ·{" "}
                    {formatCurrency(item.target_amount, item.currency)}
                  </p>
                  {item.reviewed_at && (
                    <p className="mt-1 text-[11px] text-white/35">
                      Reviewed {formatDate(item.reviewed_at)}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-white/70">
                    {item.review_note || "No reviewer note recorded."}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                    Matched: {item.matched.join(", ")}.
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-white/45">
            No similar decided cases yet. Each review you make here is
            remembered for the next one.
          </p>
        )}
      </div>
    </div>
  );
}
