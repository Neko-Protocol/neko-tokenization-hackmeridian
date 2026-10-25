import Image from "next/image";
import Link from "next/link";

export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#121212]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
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
