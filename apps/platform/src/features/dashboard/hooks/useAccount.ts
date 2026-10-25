"use client";

import type { LaunchpadAccount } from "@/lib/services/launchpad.api";
import { useLaunchpadAccount } from "./useLaunchpadAccount";

/** The signed-in account. Only call under `AccountShell`, which waits for it. */
export function useAccount(): LaunchpadAccount {
  const { data } = useLaunchpadAccount();
  if (!data) throw new Error("useAccount() used outside AccountShell");
  return data;
}
