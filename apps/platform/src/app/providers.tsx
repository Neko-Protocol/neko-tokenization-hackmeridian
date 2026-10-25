"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, PRIVY_ENABLED } from "@/lib/privy";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {PRIVY_ENABLED ? (
        <PrivyProvider
          appId={PRIVY_APP_ID}
          clientId={PRIVY_CLIENT_ID}
          config={{
            loginMethods: ["email"],
            appearance: {
              theme: "dark",
              accentColor: "#229EDF",
              logo: "/Neko.svg",
              showWalletLoginFirst: false,
            },
            embeddedWallets: {
              ethereum: { createOnLogin: "off" },
              solana: { createOnLogin: "off" },
              showWalletUIs: false,
            },
          }}
        >
          {children}
        </PrivyProvider>
      ) : (
        children
      )}
    </QueryClientProvider>
  );
}
