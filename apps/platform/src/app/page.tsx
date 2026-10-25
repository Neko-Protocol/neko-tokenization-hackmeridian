import { getNetworkConfig } from "@neko-tokenization/stellar";

export default function Home() {
  const { network, rpcUrl } = getNetworkConfig();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Neko Launchpad</h1>
      <p className="max-w-md text-neutral-600">
        Tokenize a real-world asset on Stellar, from KYB to launch.
      </p>
      <p className="text-sm text-neutral-500">
        Stellar {network} · {rpcUrl}
      </p>
    </main>
  );
}
