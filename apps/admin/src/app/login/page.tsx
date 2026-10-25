"use client";

import { useEffect, useState } from "react";
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
      <main className="flex min-h-screen items-center justify-center bg-[#141414] text-[13px] text-white/45">
        Loading...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141414] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 sm:p-8">
        <h1 className="text-lg font-semibold text-white">
          Neko Tokenization Admin
        </h1>
        <p className="mt-1 mb-6 text-[13px] text-white/45">
          Sign in with your admin email to review applications.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
