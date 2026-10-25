"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FullPageSpinner } from "@/components/routing/Redirect";
import { Notice } from "@/components/ui/Notice";
import { AssetDetail, useMyApplications } from "@/features/application";
import { ROUTES } from "@/lib/routes";

/** `/assets/[id]`: everything the issuer sent for one asset. */
export function AssetDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const applications = useMyApplications();

  if (applications.isPending) return <FullPageSpinner />;

  const app = applications.data?.find((a) => a.id === id);
  if (!app) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Notice tone="error">
          {applications.isError
            ? "We couldn't load this asset. Try again shortly."
            : "We couldn't find this asset."}
        </Notice>
        <Link
          href={ROUTES.dashboard}
          className="text-[13px] text-white/60 hover:text-white"
        >
          Back to your assets
        </Link>
      </div>
    );
  }

  return <AssetDetail app={app} onBack={() => router.push(ROUTES.dashboard)} />;
}
