export const ACCOUNT_QUERY_ROOT = "launchpad-account";

export const accountKeys = {
  all: [ACCOUNT_QUERY_ROOT] as const,
  me: (privyUserId: string | null) =>
    [ACCOUNT_QUERY_ROOT, "me", privyUserId] as const,
};
