import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error";

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: {
    box: "border-[#229EDF]/20 bg-[#229EDF]/10 text-[#8fd0f2]",
    Icon: Info,
  },
  success: {
    box: "border-[#2ed06e]/20 bg-[#2ed06e]/10 text-[#7fe3a6]",
    Icon: CheckCircle2,
  },
  error: {
    box: "border-[#ff3b30]/20 bg-[#ff3b30]/10 text-[#ff8a83]",
    Icon: AlertCircle,
  },
};

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]",
        box,
        className
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
