"use client";

import { getNetworkConfig } from "@neko-tokenization/stellar";
import { FileText, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Applications", href: "/applications", icon: FileText },
] as const;

function NetworkBadge({ network }: { network: string }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2ed06e]" />
      {network}
    </span>
  );
}

function Logo() {
  return (
    <Link href="/applications" className="flex items-center gap-3">
      <Image src="/Neko.svg" alt="Neko" width={90} height={26} priority />
      <span className="inline-block h-5 w-px bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
        Admin
      </span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { email, signOut } = useAuth();
  const { network } = getNetworkConfig();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[#121212]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[270px] flex-col border-r border-white/5 bg-[#121212] lg:flex">
        <div className="px-7 pt-12 pb-8">
          <Logo />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-3 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-[#222222] text-white"
                    : "text-white/35 hover:text-white/65"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#1C1C1C] p-4">
            <NetworkBadge network={network} />
            <div className="min-w-0">
              <p className="text-[11px] text-white/35">Signed in as</p>
              <p className="truncate text-[13px] text-white/80">
                {email ?? "Admin"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2A2A2A] px-3 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-[#333] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#121212]/90 backdrop-blur-md lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <NetworkBadge network={network} />
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-w-0 lg:pl-[270px]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
