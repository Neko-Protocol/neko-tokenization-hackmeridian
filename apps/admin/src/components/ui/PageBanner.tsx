import { cn } from "@/lib/utils";

export function PageBanner({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#229EDF] sm:rounded-[24px]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 right-24 h-64 w-64 rounded-full bg-[#081f5c]/25 blur-3xl"
      />
      <div className="relative flex flex-col gap-2 px-5 py-6 sm:gap-2.5 sm:px-8 sm:py-8">
        {badge && (
          <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white">
            {badge}
          </span>
        )}
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-[13px] leading-relaxed text-white/85 sm:text-sm">
            {subtitle}
          </p>
        )}
        {actions && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
