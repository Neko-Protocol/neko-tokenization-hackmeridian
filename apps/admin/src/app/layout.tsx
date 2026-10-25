import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neko Tokenization Admin",
  description: "Review and approve tokenization requests.",
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
