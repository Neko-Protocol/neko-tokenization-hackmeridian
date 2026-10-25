"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FullPageSpinner } from "@/components/routing/Redirect";
import {
  ApplicationWorkspace,
  applicationKeys,
  useMyApplications,
} from "@/features/application";
import { ROUTES } from "@/lib/routes";
import { useAccount } from "../../hooks/useAccount";

/** `/assets/new`: the application form for a new asset. */
export function NewAssetPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useAccount();
  const applications = useMyApplications();

  if (applications.isPending) return <FullPageSpinner />;

  return (
    <ApplicationWorkspace
      account={account}
      // First-time issuers have nowhere to go back to.
      canExit={(applications.data?.length ?? 0) > 0}
      onExit={() => {
        void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
        router.push(ROUTES.dashboard);
      }}
    />
  );
}
