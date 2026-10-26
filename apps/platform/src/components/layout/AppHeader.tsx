import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AppHeader({
  actions,
  wide = false,
}: {
  actions?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#191918]/90 backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6",
          wide ? "max-w-[1320px]" : "max-w-5xl"
        )}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <Image src="/Neko.svg" alt="Neko" width={90} height={26} priority />
          </Link>
          <span className="inline-block h-5 w-px bg-white/10" />
          <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Launchpad
          </span>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
