import Image from "next/image";
import { Showcase } from "@/features/onboarding";

export function SplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-8">
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-8">
            <Image
              src="/Neko.svg"
              alt="Neko"
              width={110}
              height={32}
              priority
              className="h-8 w-auto"
            />
            {children}
          </div>
        </div>
      </div>
      <div className="hidden p-4 lg:block">
        <div className="sticky top-4 h-[calc(100dvh-2rem)]">
          <Showcase />
        </div>
      </div>
    </div>
  );
}
