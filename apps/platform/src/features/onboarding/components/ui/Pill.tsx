import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function Pill({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn("min-h-11 w-full rounded-full text-sm", className)}
    />
  );
}
