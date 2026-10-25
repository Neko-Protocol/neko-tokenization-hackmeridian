import { Networks } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet" | "mainnet";

export interface NetworkConfig {
  network: StellarNetwork;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
}

export const NETWORK_DEFAULTS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    network: "testnet",
    passphrase: Networks.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    network: "mainnet",
    passphrase: Networks.PUBLIC,
    rpcUrl: "https://mainnet.sorobanrpc.com",
    horizonUrl: "https://horizon.stellar.org",
  },
};

function resolveNetwork(raw: string | undefined): StellarNetwork {
  if (raw === "mainnet") {
    return "mainnet";
  }
  if (raw === "testnet") {
    return "testnet";
  }
  return "testnet";
}

export function getNetworkConfig(): NetworkConfig {
  const network = resolveNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK);
  const defaults = NETWORK_DEFAULTS[network];

  const passphrase =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? defaults.passphrase;
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? defaults.rpcUrl;
  const horizonUrl =
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? defaults.horizonUrl;

  return {
    network,
    passphrase,
    rpcUrl,
    horizonUrl,
  };
}
