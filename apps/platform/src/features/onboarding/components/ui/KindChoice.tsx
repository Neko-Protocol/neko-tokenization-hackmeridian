import { cn } from "@/lib/utils";

export function KindChoice({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 text-left transition-colors",
        active
          ? "border-[#229EDF] bg-[#229EDF]/[0.07]"
          : "border-white/10 hover:border-white/25"
      )}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-[12px] text-white/50">{body}</span>
      </span>
      <span
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
          active ? "border-[#229EDF]" : "border-white/25"
        )}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-[#229EDF]" />}
      </span>
    </button>
  );
}
