import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page banner matching neko-web's BannerPage (light-blue card with badge,
 * title and subtitle), without the illustration.
 */
export function BannerPage({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  /** Rendered on the right on wide screens, below the text on mobile. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 overflow-hidden rounded-2xl bg-[#229EDF] sm:rounded-[24px]",
        "flex min-h-[140px] flex-col gap-4 px-4 py-6 sm:min-h-[210px] sm:flex-row sm:items-center sm:justify-between sm:px-8",
        className
      )}
    >
      <div className="flex min-w-0 flex-col justify-center gap-2 sm:gap-2.5">
        {badge && (
          <span className="inline-flex w-fit items-center rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {badge}
          </span>
        )}
        <h1 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs leading-relaxed text-white sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
