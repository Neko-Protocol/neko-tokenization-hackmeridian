import { BadgeCheck } from "lucide-react";
import { WalletAddress } from "@/components/ui/WalletAddress";
import type { LaunchpadAccount } from "@/lib/services/launchpad.api";

export function ProfilePanel({ data }: { data: LaunchpadAccount }) {
  const { account, verification, wallet } = data;
  const name =
    verification.business_name ??
    verification.full_name ??
    account.display_name ??
    account.email;

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#1C1C1C] p-4">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
          {verification.kind === "kyb" ? "Business" : "Individual"}
        </p>
        <p className="text-[15px] font-semibold leading-snug text-white">
          {name}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-[#2ed06e]">
          <BadgeCheck className="h-3.5 w-3.5" />
          {verification.kind === "kyb" ? "KYB verified" : "KYC verified"}
          {verification.provider === "mock" && (
            <span className="text-white/40">· demo</span>
          )}
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-white/5 border-t border-white/5 text-[13px]">
        <InfoRow label="Email">{account.email}</InfoRow>
        {verification.country && (
          <InfoRow label="Country">{verification.country}</InfoRow>
        )}
        <InfoRow label="Network">Stellar testnet</InfoRow>
      </dl>

      <WalletAddress address={wallet.address} />
    </aside>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-white/45">{label}</dt>
      <dd className="truncate text-right text-white/90">{children}</dd>
    </div>
  );
}
