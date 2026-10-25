import { getNetworkConfig } from "@neko-tokenization/stellar";

export default function Home() {
  const { network, rpcUrl } = getNetworkConfig();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Neko Tokenization Admin</h1>
      <p className="max-w-md text-neutral-600">
        Review and approve tokenization requests.
      </p>
      <p className="text-sm text-neutral-500">
        Stellar {network} · {rpcUrl}
      </p>
    </main>
  );
}
