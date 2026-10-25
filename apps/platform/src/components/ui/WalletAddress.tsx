"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, truncateAddress } from "@/lib/utils";

export function WalletAddress({
  address,
  label = "Wallet",
  className,
}: {
  address: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2 rounded-lg bg-[#2A2A2A] py-2 pl-3 pr-1.5">
        <span
          className="truncate font-label text-[13px] text-white/85"
          title={address}
        >
          {truncateAddress(address, 6)}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy wallet address"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
