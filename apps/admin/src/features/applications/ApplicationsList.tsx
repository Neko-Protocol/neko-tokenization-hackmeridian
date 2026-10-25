"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  XCircle,
} from "lucide-react";

import { Notice } from "@/components/ui/Notice";
import { PageBanner } from "@/components/ui/PageBanner";
import { StatCard } from "@/components/ui/StatCard";
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
    <div className="animate-pulse border-t border-white/5 px-5 py-4 first:border-t-0">
      <div className="mb-2 h-4 w-1/3 rounded bg-white/10" />
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

  const pending = counts.submitted + counts.in_review;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageBanner
        badge="Tokenization admin"
        title="Applications"
        subtitle="Review each issuer's proposal, check the legal checklist and record a decision."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Total"
          value={loading ? "-" : counts.all}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Waiting for review"
          value={loading ? "-" : pending}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approved"
          value={loading ? "-" : counts.approved}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Rejected"
          value={loading ? "-" : counts.rejected}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5">
            {STATUS_FILTERS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                  filter === tab.key
                    ? "bg-[#222222] text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    filter === tab.key
                      ? "bg-[#229EDF] text-white"
                      : "bg-white/10 text-white/50"
                  )}
                >
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1C1C1C]">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-[#1C1C1C] px-6 py-16 text-center">
            <div className="rounded-xl bg-[#2A2A2A] p-3 text-white/40">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-[14px] font-medium text-white/70">
              No applications here yet
            </p>
            <p className="text-[12px] text-white/35">
              New proposals from the Launchpad will show up in this list.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1C1C1C]">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px_150px_20px] gap-4 border-b border-white/5 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/35 md:grid">
              <span>Asset</span>
              <span>Type</span>
              <span>Target</span>
              <span>Submitted</span>
              <span>Status</span>
              <span />
            </div>
            <ul>
              {visible.map((app) => (
                <li
                  key={app.id}
                  className="border-t border-white/5 first:border-t-0"
                >
                  <Link
                    href={`/applications/${app.id}`}
                    className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03] md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_120px_150px_20px] md:items-center md:gap-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-white">
                          {app.asset_name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-white/45">
                          {app.issuer_name} · {app.issuer_country} ·{" "}
                          <span className="capitalize">
                            {app.offering_type}
                          </span>
                        </p>
                      </div>
                      <div className="md:hidden">
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/55 md:contents md:text-[13px]">
                      <span>
                        {ASSET_TYPE_LABELS[app.asset_type] ?? app.asset_type}
                      </span>
                      <span className="text-white/80">
                        {formatCurrency(app.target_amount, app.currency)}
                      </span>
                      <span className="text-white/40">
                        {formatDate(app.created_at)}
                      </span>
                    </div>
                    <div className="hidden md:block">
                      <StatusBadge status={app.status} />
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-white/25 transition-colors group-hover:text-white/60 md:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
