"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Heading } from "./Heading";
import { Pill } from "./Pill";

export function EmailStep({
  verifiedName,
  busy,
  onSubmit,
}: {
  verifiedName: string | null;
  busy: boolean;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };
  return (
    <>
      <Heading
        title="Create your account"
        subtitle={
          verifiedName
            ? `Verified as ${verifiedName}. Which email should we use?`
            : "You're verified. Which email should we use?"
        }
      />
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email"
          className="h-11 rounded-full px-5"
        />
        <Pill type="submit" loading={busy}>
          {busy ? "Creating your wallet…" : "Continue"}
        </Pill>
      </form>
    </>
  );
}
