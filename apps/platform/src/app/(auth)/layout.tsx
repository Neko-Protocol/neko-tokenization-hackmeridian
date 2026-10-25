import { SplitLayout } from "@/features/home";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SplitLayout>{children}</SplitLayout>;
}
