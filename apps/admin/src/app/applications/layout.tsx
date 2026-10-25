"use client";

import { AdminShell } from "@/components/layout/AdminShell";
import { AuthGate } from "@/features/auth/AuthContext";

export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
