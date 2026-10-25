import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-white/10 bg-[#141414] px-3.5 py-2.5 text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#229EDF]/50",
        className
      )}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-y rounded-xl border border-white/10 bg-[#141414] px-3.5 py-2.5 text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#229EDF]/50",
        className
      )}
    />
  );
}
