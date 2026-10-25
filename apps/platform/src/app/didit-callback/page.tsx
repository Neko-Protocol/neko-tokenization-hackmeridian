"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

export default function DiditCallbackPage() {
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "didit:complete", status },
        window.location.origin
      );
    } else {
      window.location.replace("/");
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center gap-3 bg-[#121212] p-8 text-center text-white/60">
      <Spinner /> Verification finished. Checking the result…
    </main>
  );
}
