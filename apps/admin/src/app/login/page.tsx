"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/features/auth/LoginForm";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#121212] text-[13px] text-white/45">
        Loading...
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#121212] px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-240px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#229EDF]/20 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Image src="/Neko.svg" alt="Neko" width={110} height={31} priority />
          <span className="inline-block h-6 w-px bg-white/10" />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
            Admin
          </span>
        </div>
        <div className="rounded-[24px] border border-white/5 bg-[#1C1C1C] p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-white">
            Tokenization admin
          </h1>
          <p className="mt-1 mb-6 text-[13px] text-white/45">
            Sign in with your admin email to review applications.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
