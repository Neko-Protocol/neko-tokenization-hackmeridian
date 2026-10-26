import { ChevronRight } from "lucide-react";
import type { Application } from "@/lib/services/launchpad.api";
import { ASSET_TYPES, countryName } from "../../utils/fields";
import { ASSET_ICONS } from "../../utils/assetIcons";
import { StatusPill, StatusTrack, assetStage } from "./StatusTrack";

export const surface = "rounded-2xl border border-white/10 bg-[#1b1b1b]";

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function assetTypeLabel(type: string): string {
  return ASSET_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function AssetIcon({ type, size = "md" }: { type: string; size?: "md" | "lg" }) {
  const Icon = ASSET_ICONS[type] ?? ASSET_ICONS.other;
  return (
    <span
      className={
        size === "lg"
          ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]"
          : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]"
      }
    >
      <Icon className={size === "lg" ? "h-6 w-6 text-white/80" : "h-5 w-5 text-white/80"} strokeWidth={1.75} />
    </span>
  );
}

export function AssetCard({ app, onOpen }: { app: Application; onOpen: () => void }) {
  const metrics = [
    { label: "Target raise", value: money(app.target_amount, app.currency) },
    { label: "Min. investment", value: money(app.min_ticket, app.currency) },
    { label: "Yield", value: app.expected_yield_pct != null ? `${app.expected_yield_pct}%` : "n/a" },
    { label: "Term", value: app.term_months != null ? `${app.term_months} months` : "n/a" },
  ];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${surface} group flex w-full flex-col gap-6 p-6 text-left transition-colors hover:bg-[#202020]`}
    >
      <div className="flex items-start gap-4">
        <AssetIcon type={app.asset_type} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[19px] font-medium text-white">{app.asset_name}</h3>
          <p className="truncate text-[14.5px] text-white/50">
            {assetTypeLabel(app.asset_type)} · {app.issuer_name}, {countryName(app.issuer_country)}
          </p>
        </div>
        <StatusPill status={assetStage(app)} className="hidden sm:inline-flex" />
        <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-white/25 transition-colors group-hover:text-white/70" />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <dt className="text-[13px] text-white/45">{m.label}</dt>
            <dd className="text-[18px] font-medium text-white">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <StatusTrack status={assetStage(app)} />
        <p className="text-[13px] text-white/40">
          Submitted {formatDate(app.created_at)}
        </p>
      </div>
    </button>
  );
}
