import { Horizon, rpc } from "@stellar/stellar-sdk";

import { getNetworkConfig, type NetworkConfig } from "./network";

export function getRpcServer(config: NetworkConfig = getNetworkConfig()) {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: config.rpcUrl.startsWith("http://"),
  });
}

export function getHorizonServer(config: NetworkConfig = getNetworkConfig()) {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  });
}
