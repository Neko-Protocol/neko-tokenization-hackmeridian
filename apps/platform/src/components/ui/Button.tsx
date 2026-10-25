import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#229EDF] text-white hover:bg-[#1a8bc7]",
  secondary: "bg-[#2A2A2A] text-white hover:bg-[#333]",
  ghost: "text-white/60 hover:bg-white/5 hover:text-white",
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
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
