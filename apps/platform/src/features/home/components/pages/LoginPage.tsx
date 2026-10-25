"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { EmailLogin } from "@/features/auth";
import { Heading } from "@/features/onboarding";
import { PRIVY_ENABLED } from "@/lib/privy";
import { ROUTES } from "@/lib/routes";
import { Redirect } from "@/components/routing/Redirect";

/** `/login`: one-time email code for users who already verified. */
export function LoginPage() {
  return PRIVY_ENABLED ? <PrivyLoginPage /> : <Redirect to={ROUTES.signup} />;
}

function PrivyLoginPage() {
  const { authenticated } = usePrivy();
  // The dashboard layout sends users without an account back to sign up.
  if (authenticated) return <Redirect to={ROUTES.dashboard} />;

  return (
    <div className="flex w-full flex-col gap-6">
      <Heading
        title="Welcome back"
        subtitle="Log in with the email you verified with."
      />
      <EmailLogin />
      <Link
        href={ROUTES.signup}
        className="text-center text-[13px] text-white/50 hover:text-white"
      >
        New here? Get verified
      </Link>
    </div>
  );
}
