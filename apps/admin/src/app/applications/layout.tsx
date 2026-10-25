"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { AuthGate } from "@/features/auth/AuthContext";

export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-[#141414]">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
