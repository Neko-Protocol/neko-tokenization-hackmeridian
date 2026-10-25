"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getNetworkConfig } from "@neko-tokenization/stellar";

import { Spinner } from "@/components/ui/Spinner";
import { LoginForm } from "@/features/auth/LoginForm";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { network } = getNetworkConfig();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          router.replace("/applications");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#121212] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#229EDF]/10 blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-8 shadow-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/Neko.svg"
              alt="Neko"
              width={90}
              height={26}
              priority
              className="mb-4 h-auto w-auto"
            />
            <h1 className="text-xl font-bold text-white">Tokenization Admin</h1>
          </div>

          {ready ? (
            <LoginForm />
          ) : (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-white/30">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2ed06e]" />
          <span className="uppercase tracking-[0.14em]">{network}</span>
          <span>·</span>
          <span>Only authorized Neko admins</span>
        </p>
      </div>
    </main>
  );
}
