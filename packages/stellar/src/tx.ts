import {
  Asset,
  BASE_FEE,
  Contract,
  Operation,
  rpc,
  Transaction,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";

import { getHorizonServer, getRpcServer } from "./clients";
import { ContractCallError, contractErrorCode } from "./contracts";
import { getUsdcAsset } from "./deployments";
import { getNetworkConfig, type NetworkConfig } from "./network";

/**
 * Transactions a user signs themselves: the issuer repaying a tranche or
 * reporting a milestone, an investor opening a trustline. The signer is passed
 * in, so the same builder serves a Privy embedded wallet and a browser wallet.
 */

/** Signs a built transaction in place, or returns it signed. */
export type TransactionSigner = (tx: Transaction) => Promise<Transaction>;

/** A contract call from `source`, simulated and assembled, ready to sign. */
export async function buildInvocation(
  source: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  config: NetworkConfig = getNetworkConfig()
): Promise<Transaction> {
  const server = getRpcServer(config);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();
  try {
    return await server.prepareTransaction(tx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ContractCallError(message, contractErrorCode(message));
  }
}

/** Open the trustline that lets `source` hold the test USDC. */
export async function buildUsdcTrustline(
  source: string,
  config: NetworkConfig = getNetworkConfig()
): Promise<Transaction> {
  const { code, issuer } = getUsdcAsset();
  const account = await getHorizonServer(config).loadAccount(source);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) }))
    .setTimeout(120)
    .build();
}

/** Send a signed transaction through RPC and wait for the ledger to take it. */
export async function submitTransaction(
  tx: Transaction,
  config: NetworkConfig = getNetworkConfig()
): Promise<string> {
  const server = getRpcServer(config);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new ContractCallError(
      `Transaction was not accepted (${sent.status})`,
      null
    );
  }

  const result = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: () => 1000,
  });
  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    const detail =
      result.status === rpc.Api.GetTransactionStatus.FAILED
        ? result.resultXdr.result().switch().name
        : result.status;
    throw new ContractCallError(`Transaction failed: ${detail}`, null);
  }
  return sent.hash;
}

/** Build, sign and submit in one go; returns the transaction hash. */
export async function signAndSubmit(
  build: () => Promise<Transaction>,
  sign: TransactionSigner,
  config: NetworkConfig = getNetworkConfig()
): Promise<string> {
  const tx = await build();
  const signed = await sign(tx);
  return submitTransaction(signed, config);
}
