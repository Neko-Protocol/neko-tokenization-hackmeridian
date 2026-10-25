"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Notice } from "@/components/ui/Notice";
import { useLaunchpadAccount } from "@/features/dashboard";
import { Onboarding } from "@/features/onboarding";
import { PRIVY_ENABLED } from "@/lib/privy";
import { ROUTES } from "@/lib/routes";
import { FullPageSpinner, Redirect } from "@/components/routing/Redirect";

/** `/signup`: verification (KYB/KYC) and account creation. */
export function SignupPage() {
  return PRIVY_ENABLED ? <PrivySignupPage /> : <Onboarding />;
}

function PrivySignupPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const account = useLaunchpadAccount();

  if (authenticated && account.isPending) return <FullPageSpinner />;
  // Logged in with an account (e.g. right after the post-signup login).
  if (authenticated && account.data) return <Redirect to={ROUTES.dashboard} />;

  return (
    <Onboarding
      onLogin={() => router.push(ROUTES.login)}
      notice={
        authenticated && account.data === null ? (
          <Notice>
            This email doesn&apos;t have a Launchpad account yet. Verify to
            create one.
          </Notice>
        ) : undefined
      }
    />
  );
}
