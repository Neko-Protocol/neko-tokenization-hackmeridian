"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import {
  ApplicationWorkspace,
  AssetCard,
  AssetDetail,
  hasDraft,
  money,
  surface,
  useMyApplications,
} from "@/features/application";
import type { LaunchpadAccount } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";
import { ProfilePanel } from "../ui/ProfilePanel";

export function Dashboard({ data }: { data: LaunchpadAccount }) {
  const applications = useMyApplications();
  const [creating, setCreating] = useState(hasDraft);
  const [openId, setOpenId] = useState<string | null>(null);

  if (applications.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const apps = applications.data ?? [];
  const hasAssets = apps.length > 0;

  if (creating || (!hasAssets && !applications.isError)) {
    return (
      <ApplicationWorkspace
        account={data}
        canExit={hasAssets}
        onExit={() => {
          setCreating(false);
          applications.refetch();
        }}
      />
    );
  }

  const open = apps.find((a) => a.id === openId);
  if (open) {
    return <AssetDetail app={open} onBack={() => setOpenId(null)} />;
  }

  const usd = apps.filter((a) => a.currency === "USD");
  const stats = [
    { label: "Assets", value: String(apps.length) },
    { label: "Total target raise", value: money(usd.reduce((sum, a) => sum + a.target_amount, 0), "USD") },
    {
      label: "In review",
      value: String(apps.filter((a) => ["submitted", "in_review", "changes_requested"].includes(a.status)).length),
    },
    { label: "Approved", value: String(apps.filter((a) => a.status === "approved").length) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-medium leading-tight tracking-tight text-white">Your assets</h1>
          <p className="text-[15px] text-white/50">
            Track each asset from submission to launch. Open one to see everything you sent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-[#111] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New asset
        </button>
      </div>

      {applications.isError ? (
        <Notice tone="error">We couldn&apos;t load your assets. Try again shortly.</Notice>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className={cn(surface, "flex flex-col gap-1.5 p-5")}>
                <dt className="text-[13.5px] text-white/45">{s.label}</dt>
                <dd className="text-[26px] font-medium tracking-tight text-white">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              {apps.map((app) => (
                <AssetCard key={app.id} app={app} onOpen={() => setOpenId(app.id)} />
              ))}
            </div>
            <div className="lg:sticky lg:top-24">
              <ProfilePanel data={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
