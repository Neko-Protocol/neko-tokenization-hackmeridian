"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { ExternalLink, Upload } from "lucide-react";
import {
  arg,
  buildInvocation,
  contractUrl,
  formatUsdc,
  fromUnits,
  getSharedContracts,
  getUsdcFaucetUrl,
  sha256Hex,
  signAndSubmit,
  txUrl,
  type MilestoneStatus,
  type VaultState,
} from "@neko-tokenization/stellar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { launchpadApi, type Deployment } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";
import { useIssuerSigner } from "../../hooks/useIssuerSigner";
import {
  useMilestones,
  useUsdcAccount,
  useVaultSnapshot,
} from "../../hooks/useVault";
import { vaultKeys } from "../../hooks/vaultKeys";
import { chainErrorMessage } from "../../utils/chainError";

const surface = "rounded-2xl border border-white/10 bg-[#1b1b1b]";
const caption =
  "text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45";

const STATE_COPY: Record<
  VaultState,
  { label: string; tone: string; detail: string }
> = {
  Funding: {
    label: "Raising",
    tone: "bg-[#229EDF]/12 text-[#8fd0f2]",
    detail:
      "Verified investors are depositing USDC. Neko closes the round at the deadline.",
  },
  Funded: {
    label: "Funded",
    tone: "bg-[#2ed06e]/12 text-[#7fe3a6]",
    detail:
      "The raise reached its minimum. Neko releases it to your wallet next.",
  },
  Active: {
    label: "Repaying",
    tone: "bg-[#2ed06e]/12 text-[#7fe3a6]",
    detail:
      "The raise is in your wallet. Pay each repayment from it as it falls due.",
  },
  Settled: {
    label: "Repaid",
    tone: "bg-[#2ed06e]/12 text-[#7fe3a6]",
    detail: "Everything is repaid. Investors are collecting their share.",
  },
  Failed: {
    label: "Raise failed",
    tone: "bg-[#ff3b30]/12 text-[#ff8a83]",
    detail:
      "The raise closed below its minimum. Investors are taking their money back.",
  },
};

const MILESTONE_TONE: Record<MilestoneStatus, string> = {
  Pending: "text-white/45",
  Submitted: "text-[#8fd0f2]",
  Approved: "text-[#7fe3a6]",
  Rejected: "text-[#ff8a83]",
};

function dateOf(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The live vault behind an asset, and the issuer's side of running it. */
export function VaultPanel({
  appId,
  deployment,
}: {
  appId: string;
  deployment: Deployment & { vault: string };
}) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();
  const { address, sign } = useIssuerSigner();
  const vault = useVaultSnapshot(deployment.vault);
  const milestones = useMilestones(deployment.vault_id);
  const wallet = useUsdcAccount(address);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
    tx?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [evidenceFor, setEvidenceFor] = useState<number | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: vaultKeys.all });

  const run = async (
    key: string,
    action: () => Promise<string>,
    success: string,
    source: "vault" | "tracker" = "vault"
  ) => {
    setBusy(key);
    setResult(null);
    try {
      const tx = await action();
      setResult({ tone: "success", text: success, tx });
    } catch (err) {
      setResult({ tone: "error", text: chainErrorMessage(err, source) });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (vault.isPending) {
    return (
      <div
        className={cn(
          surface,
          "flex items-center gap-3 p-5 text-[14px] text-white/50"
        )}
      >
        <Spinner /> Reading the vault from the ledger
      </div>
    );
  }
  if (vault.isError || !vault.data) {
    return (
      <Notice tone="error">
        We couldn&apos;t read this vault from the ledger. Try again shortly.
      </Notice>
    );
  }

  const { state, config, raised, tranches } = vault.data;
  const copy = STATE_COPY[state];
  const pct =
    config.target > 0n
      ? Math.min(100, Number((raised * 10000n) / config.target) / 100)
      : 0;
  const minPct =
    config.target > 0n
      ? Number((config.min_target * 10000n) / config.target) / 100
      : 0;
  const nextTranche = tranches.find((t) => t.paid_amount === 0n);
  const balance = wallet.data?.balance ?? 0n;

  const repay = (index: number, amount: bigint) =>
    run(
      `repay-${index}`,
      () =>
        signAndSubmit(
          () =>
            buildInvocation(address, deployment.vault, "repay", [
              arg.u32(index),
              arg.i128(amount),
              arg.string(
                `${window.location.origin}/assets/${appId}#repayment-${index + 1}`
              ),
            ]),
          sign
        ),
      `Repayment ${index + 1} sent to the vault.`
    );

  const topUp = (amount: number) =>
    run(
      "faucet",
      async () => {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session expired. Sign in again.");
        return (await launchpadApi.faucetUsdc(token, address, amount)).tx_hash;
      },
      `${amount.toLocaleString("en-US")} test USDC sent to your wallet.`
    );

  const submitEvidence = async (index: number, file: File) =>
    run(
      `milestone-${index}`,
      async () => {
        const token = await getAccessToken();
        if (!token) throw new Error("Your session expired. Sign in again.");
        const [hash, doc] = await Promise.all([
          sha256Hex(await file.arrayBuffer()),
          launchpadApi.uploadDocument(token, file),
        ]);
        return signAndSubmit(
          () =>
            buildInvocation(
              address,
              getSharedContracts().milestoneTracker,
              "submit_milestone",
              [
                arg.bytes32(deployment.vault_id),
                arg.u32(index),
                arg.bytes32(hash),
                arg.string(doc.url),
              ]
            ),
          sign
        );
      },
      "Evidence submitted. Neko will review it.",
      "tracker"
    );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <span className={caption}>
          On-chain vault · {deployment.token_symbol}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[13px] font-medium",
            copy.tone
          )}
        >
          {copy.label}
        </span>
      </div>

      <div className={cn(surface, "flex flex-col gap-4 p-5")}>
        <p className="text-[14.5px] text-white/60">{copy.detail}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[24px] font-medium text-white">
              {formatUsdc(raised)}
            </span>
            <span className="text-[13.5px] text-white/45">
              of {formatUsdc(config.target)}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.08]">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[#229EDF]"
              style={{ width: `${pct}%` }}
            />
            <span
              className="absolute -top-1 h-4 w-0.5 bg-white/50"
              style={{ left: `${minPct}%` }}
              title={`Minimum ${formatUsdc(config.min_target)}`}
            />
          </div>
          <div className="flex justify-between text-[12.5px] text-white/40">
            <span>Minimum {formatUsdc(config.min_target)}</span>
            <span>Deadline {dateOf(config.funding_deadline)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/[0.05] pt-3">
          {[
            { label: "Vault", href: contractUrl(deployment.vault) },
            ...(deployment.token
              ? [{ label: "Token", href: contractUrl(deployment.token) }]
              : []),
            {
              label: "Milestones",
              href: contractUrl(getSharedContracts().milestoneTracker),
            },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-[#8fd0f2] hover:text-white"
            >
              {l.label} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>

      {result && (
        <Notice tone={result.tone}>
          {result.text}{" "}
          {result.tx && (
            <a
              href={txUrl(result.tx)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View transaction
            </a>
          )}
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className={caption}>Repayments</span>
          <span className="text-[13px] text-white/45">
            Your wallet:{" "}
            {wallet.data?.trustline ? formatUsdc(balance) : "no USDC trustline"}
          </span>
        </div>
        <ol
          className={cn(
            surface,
            "flex flex-col divide-y divide-white/[0.05] px-5"
          )}
        >
          {tranches.map((t) => {
            const title =
              milestones.data?.[t.index]?.title ?? `Repayment ${t.index + 1}`;
            const paid = t.paid_amount > 0n;
            const isNext = state === "Active" && nextTranche?.index === t.index;
            const short = balance < t.expected_amount;
            return (
              <li
                key={t.index}
                id={`repayment-${t.index + 1}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] text-white">{title}</span>
                  <span className="text-[13px] text-white/45">
                    {paid
                      ? `Paid ${dateOf(t.paid_at)}`
                      : `Due ${dateOf(t.due_date)}`}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-[15px] font-medium",
                      paid ? "text-[#7fe3a6]" : "text-white"
                    )}
                  >
                    {formatUsdc(paid ? t.paid_amount : t.expected_amount)}
                  </span>
                  {isNext &&
                    (short && getUsdcFaucetUrl() ? (
                      // Circle's USDC: Neko can't mint it, so the interest
                      // comes from Circle's faucet.
                      <a
                        href={getUsdcFaucetUrl()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#2A2A2A] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#333]"
                      >
                        Get test USDC <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : short ? (
                      <Button
                        variant="secondary"
                        loading={busy === "faucet"}
                        disabled={busy !== null || !wallet.data?.trustline}
                        onClick={() =>
                          topUp(
                            Math.ceil(fromUnits(t.expected_amount - balance))
                          )
                        }
                      >
                        Top up test USDC
                      </Button>
                    ) : (
                      <Button
                        loading={busy === `repay-${t.index}`}
                        disabled={busy !== null}
                        onClick={() => repay(t.index, t.expected_amount)}
                      >
                        Repay
                      </Button>
                    ))}
                </span>
              </li>
            );
          })}
        </ol>
        {state === "Active" &&
          nextTranche &&
          balance < nextTranche.expected_amount && (
            <p className="px-1 text-[13px] text-white/45">
              Interest is earned off-chain, so on testnet you can top up the
              difference with test USDC.
            </p>
          )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={cn(caption, "px-1")}>Milestones</span>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && evidenceFor !== null)
              void submitEvidence(evidenceFor, file);
          }}
        />
        {milestones.isPending ? (
          <div
            className={cn(
              surface,
              "flex items-center gap-3 p-5 text-[14px] text-white/50"
            )}
          >
            <Spinner /> Loading milestones
          </div>
        ) : (
          <ol
            className={cn(
              surface,
              "flex flex-col divide-y divide-white/[0.05] px-5"
            )}
          >
            {(milestones.data ?? []).map((m) => {
              const canSubmit =
                m.status === "Pending" || m.status === "Rejected";
              return (
                <li
                  key={m.index}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] text-white">
                      {m.title}
                    </span>
                    <span
                      className={cn("text-[13px]", MILESTONE_TONE[m.status])}
                    >
                      {m.status === "Pending"
                        ? "Waiting for your evidence"
                        : m.status}
                      {m.evidence_uri && (
                        <>
                          {" · "}
                          <a
                            href={m.evidence_uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            evidence
                          </a>
                        </>
                      )}
                    </span>
                  </span>
                  {canSubmit && state !== "Funding" && state !== "Failed" && (
                    <Button
                      variant="secondary"
                      loading={busy === `milestone-${m.index}`}
                      disabled={busy !== null}
                      onClick={() => {
                        setEvidenceFor(m.index);
                        fileRef.current?.click();
                      }}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {m.status === "Rejected"
                        ? "Resubmit evidence"
                        : "Submit evidence"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
