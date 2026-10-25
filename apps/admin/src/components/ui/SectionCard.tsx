import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border border-white/5 bg-[#1C1C1C] p-4 sm:p-5",
        className
      )}
    >
      {title && (
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
