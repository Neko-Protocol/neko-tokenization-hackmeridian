"use client";

import { useEffect, useState } from "react";
import {
  contractUrl,
  formatUsdc,
  readMilestones,
  readUsdcAccount,
  readVault,
  txUrl,
  type Milestone,
  type UsdcAccount,
  type VaultSnapshot,
  type VaultState,
} from "@neko-tokenization/stellar";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { SectionCard } from "@/components/ui/SectionCard";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/features/auth/AuthContext";
import {
  AdminApiError,
  closeFunding,
  releaseFunds,
  reviewMilestone,
  type ChainActionResult,
} from "@/lib/admin-api";
import type { AdminApplicationView, DeploymentView } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<VaultState, { label: string; tone: string }> = {
  Funding: { label: "Raising", tone: "bg-[#229EDF]/15 text-[#8fd0f2]" },
  Funded: { label: "Funded", tone: "bg-[#2ed06e]/15 text-[#7fe3a6]" },
  Active: { label: "Repaying", tone: "bg-[#2ed06e]/15 text-[#7fe3a6]" },
  Settled: { label: "Settled", tone: "bg-[#2ed06e]/15 text-[#7fe3a6]" },
  Failed: { label: "Failed", tone: "bg-[#ff3b30]/15 text-[#ff8a83]" },
};

interface ChainView {
  vault: VaultSnapshot;
  milestones: Milestone[];
  issuer: UsdcAccount | null;
  /** Unix seconds when this was read. */
  readAt: number;
}

type Pending =
  | { kind: "close" }
  | { kind: "release" }
  | { kind: "review"; index: number; approved: boolean };

function dateOf(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * What happens after approval, from the platform's side: wait for the issuer
 * to launch, then run the vault's manager-only steps. Every number here is
 * read from the ledger; the actions go through the backend, which holds the
 * manager key.
 */
export function VaultOpsPanel({
  application,
}: {
  application: AdminApplicationView;
}) {
  const d = application.deployment;

  if (application.status !== "approved") return null;

  if (!d || d.status !== "live" || !d.vault) {
    return (
      <SectionCard title="Tokenization">
        {d?.status === "failed" ? (
          <Notice tone="error">
            The issuer&apos;s launch stopped at{" "}
            {d.error?.step.replace(/_/g, " ") ?? "a step"}
            {d.error?.message ? `: ${d.error.message}` : "."} They can resume it
            from the Launchpad.
          </Notice>
        ) : d?.status === "launching" ? (
          <p className="flex items-center gap-2 text-[13px] text-white/50">
            <Spinner /> The issuer is launching the vault.
          </p>
        ) : (
          <p className="text-[13px] text-white/50">
            Waiting for the issuer to launch. They choose a token symbol and a
            funding deadline in the Launchpad; the rest of the terms are the
            ones you approved.
          </p>
        )}
      </SectionCard>
    );
  }

  return (
    <LiveVault
      application={application}
      deployment={{ ...d, vault: d.vault }}
    />
  );
}

function LiveVault({
  application,
  deployment,
}: {
  application: AdminApplicationView;
  deployment: DeploymentView & { vault: string };
}) {
  const { accessToken } = useAuth();
  const [chain, setChain] = useState<ChainView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<Pending["kind"] | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
    tx?: string;
  } | null>(null);
  const issuerWallet = application.issuer.wallet_address;

  const [reloads, setReloads] = useState(0);
  const load = () => setReloads((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readVault(deployment.vault),
      readMilestones(deployment.vault_id),
      issuerWallet ? readUsdcAccount(issuerWallet) : Promise.resolve(null),
    ])
      .then(([vault, milestones, issuer]) => {
        if (cancelled) return;
        setChain({ vault, milestones, issuer, readAt: Date.now() / 1000 });
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError("Could not read the vault from the ledger.");
      });
    return () => {
      cancelled = true;
    };
  }, [deployment.vault, deployment.vault_id, issuerWallet, reloads]);

  const run = async (p: Pending) => {
    if (!accessToken) return;
    setPending(null);
    setBusy(p.kind);
    setResult(null);
    try {
      let res: ChainActionResult;
      let text: string;
      if (p.kind === "close") {
        res = await closeFunding(accessToken, application.id);
        text = "Funding closed.";
      } else if (p.kind === "release") {
        res = await releaseFunds(accessToken, application.id);
        text = "The raise was sent to the issuer.";
      } else {
        res = await reviewMilestone(
          accessToken,
          application.id,
          p.index,
          p.approved,
          note.trim()
        );
        text = p.approved
          ? "Milestone approved."
          : "Milestone turned back to the issuer.";
        setNote("");
      }
      setResult({ tone: "success", text, tx: res.tx_hash });
    } catch (err) {
      setResult({
        tone: "error",
        text:
          err instanceof AdminApiError
            ? err.code === "BACKEND_UNREACHABLE"
              ? "Backend unreachable. Try again in a moment."
              : err.message
            : "The transaction failed.",
      });
    } finally {
      setBusy(null);
      load();
    }
  };

  if (!chain) {
    return (
      <SectionCard title="Vault">
        {loadError ? (
          <Notice tone="error">{loadError}</Notice>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-white/45">
            <Spinner /> Reading the vault...
          </p>
        )}
      </SectionCard>
    );
  }

  const { vault, milestones, issuer } = chain;
  const { state, config, raised, repaid, tranches } = vault;
  const label = STATE_LABEL[state];
  const pastDeadline = chain.readAt > Number(config.funding_deadline);
  const belowMinimum = raised < config.min_target;
  const paidCount = tranches.filter((t) => t.paid_amount > 0n).length;
  const submitted = milestones.filter((m) => m.status === "Submitted");

  return (
    <SectionCard
      title={`Vault · ${deployment.token_symbol}`}
      action={
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            label.tone
          )}
        >
          {label.label}
        </span>
      }
    >
      <div className="flex flex-col gap-4 text-[13px]">
        <dl className="grid grid-cols-2 gap-2">
          {[
            ["Raised", `${formatUsdc(raised)} of ${formatUsdc(config.target)}`],
            ["Minimum", formatUsdc(config.min_target)],
            ["Deadline", dateOf(config.funding_deadline)],
            [
              "Repaid",
              `${formatUsdc(repaid)} of ${formatUsdc(config.expected_repayment)}`,
            ],
            ["Tranches paid", `${paidCount} of ${tranches.length}`],
            [
              "Issuer USDC",
              issuer
                ? issuer.trustline
                  ? formatUsdc(issuer.balance)
                  : "No trustline"
                : "No wallet",
            ],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-white/5 bg-[#141414] px-3 py-2"
            >
              <dt className="text-[11px] text-white/40">{k}</dt>
              <dd className="mt-0.5 truncate text-white">{v}</dd>
            </div>
          ))}
        </dl>

        {result && (
          <Notice tone={result.tone}>
            {result.text}{" "}
            {result.tx && (
              <a
                href={txUrl(result.tx)}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View transaction
              </a>
            )}
          </Notice>
        )}

        {state === "Funding" && (
          <div className="flex flex-col gap-2">
            <Button
              variant={belowMinimum ? "danger" : "success"}
              disabled={busy !== null}
              loading={busy === "close"}
              onClick={() => setPending({ kind: "close" })}
            >
              Close funding
            </Button>
            <p className="text-[12px] text-white/40">
              {belowMinimum
                ? "Below the minimum raise: closing now fails the round and investors get refunds."
                : pastDeadline
                  ? "The deadline has passed and the minimum is met."
                  : "The minimum is met. You can close before the deadline."}
            </p>
          </div>
        )}

        {state === "Funded" && (
          <div className="flex flex-col gap-2">
            <Button
              variant="success"
              disabled={busy !== null || !issuer?.trustline}
              loading={busy === "release"}
              onClick={() => setPending({ kind: "release" })}
            >
              Release {formatUsdc(raised)} to the issuer
            </Button>
            {!issuer?.trustline && (
              <p className="text-[12px] text-amber-200">
                The issuer&apos;s wallet has no USDC trustline, so the release
                would fail.
              </p>
            )}
          </div>
        )}

        {submitted.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-white/40">
              Milestones to review
            </p>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (only its hash goes on-chain)"
              aria-label="Review note"
            />
            {submitted.map((m) => (
              <div
                key={m.index}
                className="flex flex-col gap-2 rounded-xl border border-white/5 bg-[#141414] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-white">{m.title}</span>
                  {m.evidence_uri && (
                    <a
                      href={m.evidence_uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[#229EDF] hover:underline"
                    >
                      Evidence <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="success"
                    disabled={busy !== null}
                    onClick={() =>
                      setPending({
                        kind: "review",
                        index: m.index,
                        approved: true,
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy !== null}
                    onClick={() =>
                      setPending({
                        kind: "review",
                        index: m.index,
                        approved: false,
                      })
                    }
                  >
                    Turn back
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ol className="flex flex-col gap-1 border-t border-white/5 pt-3">
          {milestones.map((m) => (
            <li
              key={m.index}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate text-white/70">{m.title}</span>
              <span className="shrink-0 text-[12px] text-white/45">
                {m.status}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-3">
          {[
            ["Vault", deployment.vault],
            ["Token", deployment.token],
            ["Compliance", deployment.compliance],
          ]
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([k, id]) => (
              <a
                key={k}
                href={contractUrl(id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#229EDF] hover:underline"
              >
                {k} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={
            pending?.kind === "close"
              ? "Close funding?"
              : pending?.kind === "release"
                ? "Release the raise?"
                : pending?.approved
                  ? "Approve this milestone?"
                  : "Turn this milestone back?"
          }
          description={
            pending?.kind === "close"
              ? belowMinimum
                ? "The raise is below its minimum, so the vault moves to Failed and investors can refund. This can't be undone."
                : "No more investments are accepted. The vault moves to Funded."
              : pending?.kind === "release"
                ? `${formatUsdc(raised)} USDC leaves the vault for the issuer's wallet and repayments begin.`
                : "The decision is recorded on-chain with a hash of your note."
          }
          confirmLabel="Confirm"
          variant={
            pending.kind === "close" && belowMinimum ? "danger" : "success"
          }
          onConfirm={() => void run(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </SectionCard>
  );
}
