import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-white/10 bg-[#141414] px-3 py-2 text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#229EDF]/50",
        className
      )}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}
