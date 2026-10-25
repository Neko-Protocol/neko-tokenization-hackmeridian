export const VERIFICATION_QUERY_ROOT = "launchpad-verification";

export const verificationKeys = {
  all: [VERIFICATION_QUERY_ROOT] as const,
  detail: (id: string | null) => [VERIFICATION_QUERY_ROOT, id] as const,
};
