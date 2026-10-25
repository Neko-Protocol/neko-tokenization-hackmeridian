import { BadgeCheck } from "lucide-react";
import { WalletAddress } from "@/components/ui/WalletAddress";
import { surface } from "@/features/application";
import { countryName } from "@/features/application/utils/fields";
import type { LaunchpadAccount } from "@/lib/services/launchpad.api";
import { cn } from "@/lib/utils";

export function ProfilePanel({ data }: { data: LaunchpadAccount }) {
  const { account, verification, wallet } = data;
  const name =
    verification.business_name ?? verification.full_name ?? account.display_name ?? account.email;

  return (
    <aside className={cn(surface, "flex flex-col gap-5 p-6")}>
      <div className="flex flex-col gap-2">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45">
          {verification.kind === "kyb" ? "Business account" : "Personal account"}
        </p>
        <p className="text-[19px] font-medium leading-snug text-white">{name}</p>
        <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#2ed06e]/12 px-3 py-1 text-[13px] font-medium text-[#7fe3a6]">
          <BadgeCheck className="h-3.5 w-3.5" />
          {verification.kind === "kyb" ? "KYB verified" : "KYC verified"}
          {verification.provider === "mock" && <span className="font-normal text-[#7fe3a6]/60">· demo</span>}
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-white/[0.05] text-[14.5px]">
        <InfoRow label="Email">{account.email}</InfoRow>
        {verification.country && <InfoRow label="Country">{countryName(verification.country.toUpperCase())}</InfoRow>}
        <InfoRow label="Network">Stellar testnet</InfoRow>
      </dl>

      <WalletAddress address={wallet.address} />
    </aside>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-white/50">{label}</dt>
      <dd className="truncate text-right text-white/90">{children}</dd>
    </div>
  );
}
