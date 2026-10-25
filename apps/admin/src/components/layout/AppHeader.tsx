"use client";

import { getNetworkConfig } from "@neko-tokenization/stellar";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthContext";

export function AppHeader() {
  const { email, signOut } = useAuth();
  const { network } = getNetworkConfig();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#121212]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/applications"
            className="truncate text-[15px] font-semibold text-white"
          >
            Neko Tokenization Admin
          </Link>
          <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">
            {network}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden truncate text-[12px] text-white/45 sm:inline">
              {email}
            </span>
          )}
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
