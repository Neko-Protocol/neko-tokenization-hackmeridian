"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { FullPageSpinner, Redirect } from "@/components/routing/Redirect";
import { PRIVY_ENABLED } from "@/lib/privy";
import { ROUTES } from "@/lib/routes";

/** `/`: sends signed-in users to their dashboard, everyone else to sign up. */
export function EntryRedirect() {
  return PRIVY_ENABLED ? <PrivyEntryRedirect /> : <Redirect to={ROUTES.signup} />;
}

function PrivyEntryRedirect() {
  const { ready, authenticated } = usePrivy();
  // Don't hold the page hostage to Privy's init; treat a slow init as logged out.
  const [privySlow, setPrivySlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setPrivySlow(true), 1500);
    return () => window.clearTimeout(id);
  }, [ready]);

  if (!ready && !privySlow) return <FullPageSpinner />;
  return <Redirect to={authenticated ? ROUTES.dashboard : ROUTES.signup} />;
}
