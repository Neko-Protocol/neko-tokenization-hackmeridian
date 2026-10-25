import { cn } from "@/lib/utils";

export function StatCard({
  icon,
  label,
  value,
  hint,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-white/5 bg-[#1C1C1C] p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/40">{label}</p>
        {icon && (
          <div className="rounded-lg bg-[#2A2A2A] p-1.5 text-white/40">
            {icon}
          </div>
        )}
      </div>
      <div className="truncate text-2xl font-semibold text-white sm:text-[1.75rem]">
        {value}
      </div>
      {hint && <p className="-mt-1 text-[12px] text-white/35">{hint}</p>}
    </div>
  );
}
