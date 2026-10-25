import type { LaunchpadAccount } from "@/lib/services/launchpad.api";
import { ApplicationPanel } from "../ui/ApplicationPanel";
import { ProfilePanel } from "../ui/ProfilePanel";

export function Dashboard({ data }: { data: LaunchpadAccount }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
      <ProfilePanel data={data} />
      <ApplicationPanel />
    </div>
  );
}
