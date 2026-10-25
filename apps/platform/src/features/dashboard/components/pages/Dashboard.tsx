"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { BannerPage } from "@/components/ui/BannerPage";
import { FullPageSpinner } from "@/components/routing/Redirect";
import { Notice } from "@/components/ui/Notice";
import { AssetCard, money, surface, useMyApplications } from "@/features/application";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAccount } from "../../hooks/useAccount";
import { ProfilePanel } from "../ui/ProfilePanel";

/** `/dashboard`: the issuer's assets, their stats and profile. */
export function Dashboard() {
  const router = useRouter();
  const data = useAccount();
  const applications = useMyApplications();
  const apps = applications.data ?? [];
  const isEmpty = applications.isSuccess && apps.length === 0;

  // Nothing to show yet: start the first asset.
  useEffect(() => {
    if (isEmpty) router.replace(ROUTES.newAsset);
  }, [isEmpty, router]);

  if (applications.isPending || isEmpty) return <FullPageSpinner />;

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
      <BannerPage
        badge="Launchpad"
        title="Your assets"
        subtitle="Track each asset from submission to launch. Open one to see everything you sent."
        actions={
          <Link
            href={ROUTES.newAsset}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#121212] px-5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New asset
          </Link>
        }
      />

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
                <AssetCard key={app.id} app={app} onOpen={() => router.push(ROUTES.asset(app.id))} />
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
