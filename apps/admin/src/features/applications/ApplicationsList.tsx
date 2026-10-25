"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/AuthContext";
import {
  ASSET_TYPE_LABELS,
  STATUS_FILTERS,
  StatusBadge,
} from "@/features/applications/StatusBadge";
import { AdminApiError, listApplications } from "@/lib/admin-api";
import type { ApplicationStatus, ApplicationView } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/5 bg-[#1C1C1C] px-4 py-4">
      <div className="mb-3 h-4 w-1/3 rounded bg-white/10" />
      <div className="flex gap-4">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-3 w-28 rounded bg-white/5" />
      </div>
    </div>
  );
}

type LoadState =
  | { token: string; status: "ok"; items: ApplicationView[] }
  | { token: string; status: "error"; message: string };

export function ApplicationsList() {
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<LoadState | null>(null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void listApplications(accessToken)
      .then((data) => {
        if (!cancelled) {
          setLoad({ token: accessToken, status: "ok", items: data });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        let message = "Could not load applications.";
        if (err instanceof AdminApiError) {
          if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
            message = "Backend unreachable. Try again in a moment.";
          } else if (err.status === 401 || err.status === 403) {
            message = "Not authorized as an admin.";
          } else {
            message = err.message || message;
          }
        }
        setLoad({ token: accessToken, status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const loading = !accessToken || load?.token !== accessToken;
  const error = !loading && load?.status === "error" ? load.message : null;
  const items = useMemo(
    () => (!loading && load?.status === "ok" ? load.items : []),
    [loading, load]
  );

  const counts = useMemo(() => {
    const map: Record<"all" | ApplicationStatus, number> = {
      all: items.length,
      submitted: 0,
      in_review: 0,
      changes_requested: 0,
      approved: 0,
      rejected: 0,
    };
    for (const item of items) {
      map[item.status] += 1;
    }
    return map;
  }, [items]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Applications</h1>
        <p className="mt-1 text-[13px] text-white/45">
          Review tokenization applications and record a decision.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
              filter === tab.key
                ? "bg-white/10 text-white"
                : "text-white/45 hover:bg-white/5 hover:text-white"
            )}
          >
            {tab.label}
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 py-16 text-center">
          <FileText className="h-5 w-5 text-white/25" />
          <p className="text-[13px] text-white/35">No applications here yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((app) => (
            <li key={app.id}>
              <Link
                href={`/applications/${app.id}`}
                className="block rounded-2xl border border-white/5 bg-[#1C1C1C] px-4 py-4 transition-colors hover:border-white/10 hover:bg-[#1f1f1f]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">
                      {app.asset_name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-white/45">
                      {app.issuer_name}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/45">
                  <span>
                    {ASSET_TYPE_LABELS[app.asset_type] ?? app.asset_type}
                  </span>
                  <span>
                    Target {formatCurrency(app.target_amount, app.currency)}
                  </span>
                  <span>
                    Min ticket {formatCurrency(app.min_ticket, app.currency)}
                  </span>
                  <span className="capitalize">
                    {app.offering_type} offering
                  </span>
                  <span>Submitted {formatDate(app.created_at)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
