"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { FullPageSpinner, Redirect } from "@/components/routing/Redirect";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { applicationKeys } from "@/features/application";
import { PRIVY_ENABLED } from "@/lib/privy";
import { ROUTES } from "@/lib/routes";
import { accountKeys } from "../../hooks/accountKeys";
import { useLaunchpadAccount } from "../../hooks/useLaunchpadAccount";

/**
 * Layout for signed-in routes. Children render only once the Launchpad
 * account has loaded, so they can rely on `useAccount()`.
 */
export function AccountShell({ children }: { children: React.ReactNode }) {
  return PRIVY_ENABLED ? (
    <PrivyAccountShell>{children}</PrivyAccountShell>
  ) : (
    <Redirect to={ROUTES.signup} />
  );
}

function PrivyAccountShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ready, authenticated, logout } = usePrivy();
  const account = useLaunchpadAccount();
  const [privySlow, setPrivySlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setPrivySlow(true), 1500);
    return () => window.clearTimeout(id);
  }, [ready]);

  if (!ready && !privySlow) return <FullPageSpinner />;
  if (!authenticated) return <Redirect to={ROUTES.login} />;
  if (account.isPending) return <FullPageSpinner />;
  // Logged in but never verified: sign-up explains and creates the account.
  if (account.data === null) return <Redirect to={ROUTES.signup} />;

  return (
    <div className="min-h-dvh">
      <AppHeader
        wide
        actions={
          <Button
            variant="ghost"
            onClick={async () => {
              await logout();
              queryClient.removeQueries({ queryKey: accountKeys.all });
              queryClient.removeQueries({ queryKey: applicationKeys.all });
              router.replace(ROUTES.login);
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
        {account.data ? (
          children
        ) : (
          <Notice tone="error">
            We couldn&apos;t load your account. Try again shortly.
          </Notice>
        )}
      </main>
    </div>
  );
}
