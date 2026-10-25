import { AccountShell } from "@/features/dashboard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
