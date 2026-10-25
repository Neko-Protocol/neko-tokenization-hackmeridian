"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { EmailLogin } from "@/features/auth";
import {
  accountKeys,
  Dashboard,
  useLaunchpadAccount,
} from "@/features/dashboard";
import { Heading, Onboarding } from "@/features/onboarding";
import { PRIVY_ENABLED } from "@/lib/privy";
import { SplitLayout } from "../ui/SplitLayout";

export function Home() {
  return PRIVY_ENABLED ? (
    <AuthedHome />
  ) : (
    <SplitLayout>
      <Onboarding />
    </SplitLayout>
  );
}

function AuthedHome() {
  const { ready, authenticated, logout } = usePrivy();
  const queryClient = useQueryClient();
  const account = useLaunchpadAccount();
  const [showLogin, setShowLogin] = useState(false);
  // Don't hold the page hostage to Privy's init; logged-out visitors see onboarding right away.
  const [privySlow, setPrivySlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setPrivySlow(true), 1500);
    return () => window.clearTimeout(id);
  }, [ready]);

  const loading =
    (!ready && !privySlow) ||
    (authenticated && account.data === undefined && !account.isError);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (authenticated && (account.data || account.isError)) {
    return (
      <div className="min-h-dvh">
        <AppHeader
          actions={
            <Button
              variant="ghost"
              onClick={async () => {
                await logout();
                queryClient.removeQueries({ queryKey: accountKeys.all });
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          }
        />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {account.data ? (
            <Dashboard data={account.data} />
          ) : (
            <Notice tone="error">
              We couldn&apos;t load your account. Try again shortly.
            </Notice>
          )}
        </main>
      </div>
    );
  }

  return (
    <SplitLayout>
      {showLogin && !authenticated ? (
        <div className="flex w-full flex-col gap-6">
          <Heading
            title="Welcome back"
            subtitle="Log in with the email you verified with."
          />
          <EmailLogin />
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="text-center text-[13px] text-white/50 hover:text-white"
          >
            New here? Get verified
          </button>
        </div>
      ) : (
        <Onboarding
          onLogin={() => setShowLogin(true)}
          notice={
            authenticated && account.data === null ? (
              <Notice>
                This email doesn&apos;t have a Launchpad account yet. Verify to
                create one.
              </Notice>
            ) : undefined
          }
        />
      )}
    </SplitLayout>
  );
}
