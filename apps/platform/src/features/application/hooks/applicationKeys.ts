export const applicationKeys = {
  all: ["launchpad-applications"] as const,
  mine: (privyUserId: string | null) =>
    ["launchpad-applications", "mine", privyUserId] as const,
};
