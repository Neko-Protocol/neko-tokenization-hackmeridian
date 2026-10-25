import { getNetworkConfig, type StellarNetwork } from "./network";

function explorerSegment(network: StellarNetwork): "public" | "testnet" {
  return network === "mainnet" ? "public" : "testnet";
}

function explorerBase(network?: StellarNetwork): string {
  const resolved = network ?? getNetworkConfig().network;
  return `https://stellar.expert/explorer/${explorerSegment(resolved)}`;
}

export function txUrl(hash: string, network?: StellarNetwork): string {
  return `${explorerBase(network)}/tx/${hash}`;
}

export function accountUrl(address: string, network?: StellarNetwork): string {
  return `${explorerBase(network)}/account/${address}`;
}

export function contractUrl(
  contractId: string,
  network?: StellarNetwork
): string {
  return `${explorerBase(network)}/contract/${contractId}`;
}
