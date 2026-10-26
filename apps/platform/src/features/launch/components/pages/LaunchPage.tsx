"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Rocket } from "lucide-react";
import {
  contractUrl,
  formatUsdc,
  isValidTokenSymbol,
  splitTranches,
  suggestTokenSymbol,
  totalRepayment,
  txUrl,
} from "@neko-tokenization/stellar";
import { FullPageSpinner } from "@/components/routing/Redirect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { money, surface, useMyApplications } from "@/features/application";
import { chainErrorMessage } from "@/features/vault/utils/chainError";
import type { Application } from "@/lib/services/launchpad.api";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useLaunch, type LaunchPhase } from "../../hooks/useLaunch";

const caption =
  "text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45";
const inputClass =
  "w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/25";

/** Exit fee terms every vault launches with. Set by the platform, not the issuer. */
const EXIT_FEE_PCT = 5;
const MAX_EXIT_FEE_PCT = 10;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** `/assets/[id]/launch`: turn an approved application into a live vault. */
export function LaunchPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const applications = useMyApplications();

  if (applications.isPending) return <FullPageSpinner />;
  const app = applications.data?.find((a) => a.id === id);

  if (!app || app.status !== "approved" || app.deployment?.status === "live") {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 animate-[lp-rise_0.3s_ease-out]">
        <Link
          href={ROUTES.dashboard}
          className="inline-flex items-center gap-2 self-start text-[14.5px] text-white/55 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> All assets
        </Link>
        <Notice tone={app?.deployment?.status === "live" ? "success" : "error"}>
          {!app
            ? "We couldn't find this asset."
            : app.deployment?.status === "live"
              ? "This asset is already live."
              : "Only approved assets can be launched."}
        </Notice>
        {app && (
          <Link
            href={ROUTES.asset(app.id)}
            className="self-start text-[13px] text-white/60 hover:text-white"
          >
            Open {app.asset_name}
          </Link>
        )}
      </div>
    );
  }

  return (
    <LaunchForm app={app} onDone={() => router.push(ROUTES.asset(app.id))} />
  );
}

function LaunchForm({ app, onDone }: { app: Application; onDone: () => void }) {
  const launch = useLaunch(app);
  const [symbol, setSymbol] = useState(
    app.deployment?.token_symbol ?? suggestTokenSymbol(app.asset_name)
  );
  const [deadline, setDeadline] = useState(
    app.deployment?.funding_deadline?.slice(0, 10) ?? daysFromNow(30)
  );
  const [confirming, setConfirming] = useState(false);

  const plan = useMemo(() => {
    const total = totalRepayment(
      app.target_amount,
      app.expected_yield_pct ?? 0,
      app.term_months ?? 12
    );
    return {
      total,
      amounts: splitTranches(
        total,
        app.milestones.map((m) => m.amount_pct)
      ),
    };
  }, [app]);

  const firstDue = app.milestones[0]?.due;
  const today = isoDate(new Date());
  const symbolError = isValidTokenSymbol(symbol)
    ? null
    : "2 to 12 capital letters or digits";
  const deadlineError =
    !deadline || deadline <= today
      ? "Pick a date after today"
      : firstDue && deadline >= firstDue
        ? "Must close before your first repayment is due"
        : null;
  const scheduleMissing = app.milestones.length === 0;
  const canLaunch =
    !symbolError && !deadlineError && !scheduleMissing && !launch.isPending;

  const start = () => {
    setConfirming(false);
    launch.mutate({
      token_symbol: symbol,
      funding_deadline: new Date(`${deadline}T23:59:59Z`).toISOString(),
    });
  };

  const terms = [
    { label: "Target raise", value: money(app.target_amount, "USD") },
    {
      label: "Minimum raise",
      value: app.min_target != null ? money(app.min_target, "USD") : "Not set",
    },
    { label: "Minimum investment", value: money(app.min_ticket, "USD") },
    {
      label: "Annual yield",
      value: `${app.expected_yield_pct ?? 0}% for ${app.term_months ?? 0} months`,
    },
    { label: "Investors get back", value: formatUsdc(plan.total) },
    {
      label: "Early exit fee",
      value: `${EXIT_FEE_PCT}% (never above ${MAX_EXIT_FEE_PCT}%)`,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 animate-[lp-rise_0.3s_ease-out]">
      <Link
        href={ROUTES.asset(app.id)}
        className="inline-flex items-center gap-2 self-start text-[14.5px] text-white/55 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> {app.asset_name}
      </Link>

      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2ed06e]/12 px-3 py-1 text-[13px] font-medium text-[#7fe3a6]">
          <Check className="h-3.5 w-3.5" /> Approved
        </span>
        <h1 className="text-[30px] font-medium leading-tight tracking-tight text-white">
          Launch {app.asset_name}
        </h1>
        <p className="text-[15px] leading-relaxed text-white/55">
          Neko issues a token for your asset and opens a vault on Stellar
          testnet. Verified investors deposit USDC into the vault and receive
          your token one for one. When the raise closes, the vault sends the
          money to your wallet.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <span className={cn(caption, "px-1")}>Approved terms</span>
        <dl
          className={cn(
            surface,
            "grid grid-cols-1 divide-y divide-white/[0.05] px-5 sm:grid-cols-2 sm:divide-y-0"
          )}
        >
          {terms.map((t) => (
            <div
              key={t.label}
              className="flex items-baseline justify-between gap-4 py-3 sm:flex-col sm:items-start sm:gap-1"
            >
              <dt className="text-[13.5px] text-white/45">{t.label}</dt>
              <dd className="text-[15px] font-medium text-white">{t.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <span className={cn(caption, "px-1")}>Repayment schedule</span>
        {scheduleMissing ? (
          <Notice tone="error">
            This application has no repayment schedule, so a vault can&apos;t be
            created from it. Submit a new application with one.
          </Notice>
        ) : (
          <ol
            className={cn(
              surface,
              "flex flex-col divide-y divide-white/[0.05] px-5"
            )}
          >
            {app.milestones.map((m, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-4 py-3 text-[14.5px]"
              >
                <span className="min-w-0">
                  <span className="block text-white">{m.title}</span>
                  <span className="text-[13px] text-white/45">
                    Due {m.due ?? "n/a"} · {m.amount_pct}%
                  </span>
                </span>
                <span className="shrink-0 font-medium text-white">
                  {formatUsdc(plan.amounts[i])}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <span className={cn(caption, "px-1")}>Your token</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={cn(
              surface,
              "flex flex-col gap-2 px-4 pb-4 pt-3.5",
              symbolError && "ring-1 ring-[#ff3b30]/50"
            )}
          >
            <span className={caption}>Token symbol</span>
            <input
              value={symbol}
              maxLength={12}
              disabled={launch.isPending}
              onChange={(e) =>
                setSymbol(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                )
              }
              className={cn(inputClass, "font-label tracking-wider")}
            />
            {symbolError && (
              <span className="text-[12.5px] text-[#ff8a83]">
                {symbolError}
              </span>
            )}
          </label>
          <label
            className={cn(
              surface,
              "flex flex-col gap-2 px-4 pb-4 pt-3.5",
              deadlineError && "ring-1 ring-[#ff3b30]/50"
            )}
          >
            <span className={caption}>Funding deadline</span>
            <input
              type="date"
              value={deadline}
              min={daysFromNow(1)}
              max={firstDue}
              disabled={launch.isPending}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(inputClass, "[color-scheme:dark]")}
            />
            {deadlineError && (
              <span className="text-[12.5px] text-[#ff8a83]">
                {deadlineError}
              </span>
            )}
          </label>
        </div>
        <p className="px-1 text-[13.5px] leading-relaxed text-white/45">
          Investors can join until the deadline. If less than the minimum raise
          comes in, the raise fails and every investor can take their money
          back.
        </p>
      </section>

      {(launch.isPending || launch.isSuccess || launch.isError) && (
        <LaunchProgress
          phase={launch.phase}
          failed={launch.isError}
          trustlineTx={launch.trustlineTx}
          app={launch.data ?? app}
        />
      )}

      {launch.isError && (
        <Notice tone="error">{chainErrorMessage(launch.error)}</Notice>
      )}

      <div className="flex gap-3 border-t border-white/[0.06] pt-4">
        {launch.isSuccess ? (
          <button
            type="button"
            onClick={onDone}
            className="h-12 flex-1 rounded-xl bg-white text-[15px] font-medium text-[#111] hover:opacity-90"
          >
            Go to your live asset
          </button>
        ) : (
          <button
            type="button"
            disabled={!canLaunch}
            onClick={() => setConfirming(true)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-[#111] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {launch.isPending ? (
              <Spinner className="border-black/20 border-t-black" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {launch.isPending
              ? "Launching"
              : launch.isError || app.deployment
                ? "Resume launch"
                : "Launch to tokenize"}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Launch ${symbol}?`}
        description={
          <>
            You sign once to accept USDC, then Neko deploys the token
            and the vault. The terms above are written to the ledger and
            can&apos;t be changed afterwards.
          </>
        }
        confirmLabel="Launch"
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

type StepState = "todo" | "running" | "done" | "failed";

function LaunchProgress({
  phase,
  failed,
  trustlineTx,
  app,
}: {
  phase: LaunchPhase;
  failed: boolean;
  trustlineTx: string | null;
  app: Application;
}) {
  const order: LaunchPhase[] = ["trustline", "deploy", "done"];
  const at = order.indexOf(phase);
  const state = (step: LaunchPhase): StepState => {
    const i = order.indexOf(step);
    if (i < at || phase === "done") return "done";
    if (i === at) return failed ? "failed" : "running";
    return "todo";
  };
  const d = app.deployment;

  const steps = [
    {
      key: "trustline" as const,
      title: "Accept USDC in your wallet",
      detail: "One signature, so the vault can pay the raise out to you.",
      links: trustlineTx
        ? [{ label: "Transaction", href: txUrl(trustlineTx) }]
        : [],
    },
    {
      key: "deploy" as const,
      title: "Deploy the token and the vault",
      detail:
        "Neko creates the token, its compliance contract and the vault, and opens your milestone record.",
      links: Object.entries(d?.steps ?? {})
        // A resumed launch marks steps that were already done on-chain.
        .filter(([, hash]) => hash !== "skipped")
        .map(([step, hash]) => ({
          label: step.replace(/_/g, " "),
          href: txUrl(hash),
        })),
    },
    {
      key: "done" as const,
      title: "Live",
      detail: "Verified investors can now find it on Neko Pro.",
      links: [
        ...(d?.vault ? [{ label: "Vault", href: contractUrl(d.vault) }] : []),
        ...(d?.token ? [{ label: "Token", href: contractUrl(d.token) }] : []),
      ],
    },
  ];

  return (
    <ol className={cn(surface, "flex flex-col gap-4 p-5")}>
      {steps.map((s) => {
        const st = state(s.key);
        return (
          <li key={s.key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]",
                st === "done" && "bg-[#2ed06e] text-[#0c2a17]",
                st === "running" && "bg-[#229EDF]/20",
                st === "failed" && "bg-[#ff3b30]/20 text-[#ff8a83]",
                st === "todo" && "bg-white/[0.06]"
              )}
            >
              {st === "done" ? (
                <Check className="h-3.5 w-3.5" />
              ) : st === "running" ? (
                <Spinner />
              ) : st === "failed" ? (
                "!"
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[15px] font-medium",
                  st === "todo" ? "text-white/40" : "text-white"
                )}
              >
                {s.title}
              </p>
              <p className="text-[13.5px] text-white/45">{s.detail}</p>
              {s.links.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {s.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] capitalize text-[#8fd0f2] hover:text-white"
                    >
                      {l.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
