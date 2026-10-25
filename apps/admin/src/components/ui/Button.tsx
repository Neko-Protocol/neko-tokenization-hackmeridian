import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#229EDF] text-white hover:bg-[#1a8bc7]",
  secondary: "bg-[#2A2A2A] text-white hover:bg-[#333]",
  ghost: "text-white/60 hover:bg-white/5 hover:text-white",
  danger: "bg-[#ff3b30]/15 text-[#ff8a83] hover:bg-[#ff3b30]/25",
  success: "bg-[#2ed06e] text-[#0b2a17] hover:bg-[#27b860]",
};

export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
