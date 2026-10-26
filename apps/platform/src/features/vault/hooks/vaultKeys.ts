export const vaultKeys = {
  all: ["neko-vault"] as const,
  snapshot: (vault: string) => ["neko-vault", "snapshot", vault] as const,
  milestones: (vaultId: string) =>
    ["neko-vault", "milestones", vaultId] as const,
  usdc: (address: string) => ["neko-vault", "usdc", address] as const,
};
