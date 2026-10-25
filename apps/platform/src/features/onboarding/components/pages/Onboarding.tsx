"use client";

import { useState } from "react";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { WalletAddress } from "@/components/ui/WalletAddress";
import { EmailLogin } from "@/features/auth";
import type { VerificationKind } from "@/lib/services/launchpad.api";
import { PRIVY_ENABLED } from "@/lib/privy";
import { useOnboarding } from "../../hooks/useOnboarding";
import { DemoSkip } from "../ui/DemoSkip";
import { EmailStep } from "../ui/EmailStep";
import { Heading } from "../ui/Heading";
import { KindChoice } from "../ui/KindChoice";
import { Pill } from "../ui/Pill";

const MOCK_ENABLED = process.env.NEXT_PUBLIC_KYC_MOCK_ENABLED === "true";

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting for you to finish the steps above.",
  in_progress: "Checking your documents…",
  in_review: "Under review. This page updates on its own.",
  approved: "Verified.",
  declined: "This verification was declined.",
  expired: "This verification session expired.",
};

export function Onboarding({
  notice,
  onLogin,
}: {
  notice?: React.ReactNode;
  onLogin?: () => void;
}) {
  const flow = useOnboarding();
  const [kind, setKind] = useState<VerificationKind>("kyb");
  const status = flow.verification?.status ?? "pending";

  return (
    <div className="flex w-full flex-col gap-6">
      {notice}
      {flow.error && <Notice tone="error">{flow.error}</Notice>}

      {flow.step === "choose" && (
        <>
          <Heading
            title="Welcome to Launchpad"
            subtitle="Tokenize a real-world asset and offer it to verified investors."
          />
          <div className="flex flex-col gap-2" role="radiogroup">
            <KindChoice
              active={kind === "kyb"}
              onClick={() => setKind("kyb")}
              title="I represent a business"
              body="Company documents and a registry check"
            />
            <KindChoice
              active={kind === "kyc"}
              onClick={() => setKind("kyc")}
              title="I'm an individual"
              body="An ID document and a quick selfie"
            />
          </div>
          <Pill loading={flow.busy} onClick={() => flow.start(kind)}>
            Continue
          </Pill>
          {PRIVY_ENABLED && onLogin && (
            <p className="text-center text-[13px] text-white/50">
              Already verified?{" "}
              <button
                type="button"
                onClick={onLogin}
                className="font-medium text-white hover:underline"
              >
                Log in
              </button>
            </p>
          )}
        </>
      )}

      {flow.step === "verify" && (
        <>
          <Heading
            title={
              flow.session?.kind === "kyc"
                ? "Verify your identity"
                : "Verify your business"
            }
            subtitle="This takes a few minutes. Keep this tab open."
          />
          {flow.session?.sessionUrl ? (
            <iframe
              title="Didit verification"
              src={flow.session.sessionUrl}
              allow="camera; microphone; fullscreen; autoplay; encrypted-media"
              className="h-[560px] w-full rounded-2xl border border-white/10 bg-white"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl bg-[#1C1C1C]">
              <Spinner />
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-center text-[13px] text-white/55">
            {(status === "pending" ||
              status === "in_progress" ||
              status === "in_review") && <Spinner className="h-3 w-3" />}
            {STATUS_COPY[status]}
          </p>
          <div className="flex justify-center gap-5 text-[13px]">
            <button
              type="button"
              onClick={flow.checkNow}
              className="font-medium text-white hover:underline"
            >
              I&apos;m done, check now
            </button>
            <button
              type="button"
              onClick={flow.reset}
              className="text-white/50 hover:text-white"
            >
              Start over
            </button>
          </div>
        </>
      )}

      {flow.step === "email" && (
        <EmailStep
          verifiedName={
            flow.verification?.business_name ??
            flow.verification?.full_name ??
            null
          }
          busy={flow.busy}
          onSubmit={flow.createAccount}
        />
      )}

      {flow.step === "done" && flow.account && (
        <>
          <Heading
            title="Your account is ready"
            subtitle={`${
              flow.account.account.display_name ?? "You"
            } is verified and has a Stellar wallet.`}
          />
          <WalletAddress address={flow.account.wallet.address} />
          {PRIVY_ENABLED && (
            <div className="flex flex-col gap-3 border-t border-white/5 pt-6">
              <p className="text-center text-[13px] text-white/55">
                Log in with a one-time code to open your dashboard.
              </p>
              <EmailLogin defaultEmail={flow.account.account.email} lockEmail />
            </div>
          )}
        </>
      )}

      {MOCK_ENABLED && (flow.step === "choose" || flow.step === "verify") && (
        <DemoSkip
          kind={flow.session?.kind ?? kind}
          busy={flow.busy}
          onSkip={(skipKind, name) => {
            flow.reset();
            flow.startMock(skipKind, name);
          }}
        />
      )}
    </div>
  );
}
