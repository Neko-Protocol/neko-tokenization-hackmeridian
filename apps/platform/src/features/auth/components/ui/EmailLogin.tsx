"use client";

import { useState, type FormEvent } from "react";
import { useLoginWithEmail } from "@privy-io/react-auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

export function EmailLogin({
  defaultEmail = "",
  lockEmail = false,
}: {
  defaultEmail?: string;
  lockEmail?: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { sendCode, loginWithCode, state } = useLoginWithEmail({
    onError: () =>
      setError("We couldn't log you in. Check the code and try again."),
  });

  const codeSent =
    state.status === "awaiting-code-input" ||
    state.status === "submitting-code" ||
    (state.status === "error" && code !== "");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await sendCode({ email: email.trim(), disableSignup: true });
    } catch {
      setError(
        "We couldn't send a code to that email. Use the email you verified with."
      );
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await loginWithCode({ code: code.trim() });
    } catch {
      setError("That code didn't work. Check it or send a new one.");
    }
  };

  if (!codeSent) {
    return (
      <form onSubmit={send} className="flex flex-col gap-4">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          readOnly={lockEmail}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Email"
          className="h-11 rounded-full px-5"
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          type="submit"
          loading={state.status === "sending-code"}
          className="min-h-11 rounded-full text-sm"
        >
          Send login code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <p className="text-center text-[13px] text-white/60">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-white">{email}</span>.
      </p>
      <Input
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="123456"
        aria-label="Code"
        className="h-11 rounded-full text-center font-label text-base tracking-[0.5em]"
        autoFocus
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        type="submit"
        loading={state.status === "submitting-code"}
        disabled={code.length < 6}
        className="min-h-11 rounded-full text-sm"
      >
        Log in
      </Button>
      <button
        type="button"
        onClick={() => {
          setCode("");
          void sendCode({ email: email.trim(), disableSignup: true });
        }}
        className="text-xs text-white/50 hover:text-white"
      >
        Send a new code
      </button>
    </form>
  );
}
