import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neko Launchpad",
  description: "Tokenize a real-world asset on Stellar, from KYB to launch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
