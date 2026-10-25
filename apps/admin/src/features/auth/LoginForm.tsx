"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import {
  AdminApiError,
  requestAdminCode,
  verifyAdminCode,
} from "@/lib/admin-api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Step = "email" | "code";

function mapRequestError(err: unknown): string {
  if (err instanceof AdminApiError) {
    if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
      return "Backend unreachable. Try again in a moment.";
    }
  }
  return "Could not send a code. Check the email and try again.";
}

function mapVerifyError(reason: string | undefined, err: unknown): string {
  if (reason === "invalid_code") {
    return "Invalid code. Check the digits and try again.";
  }
  if (err instanceof AdminApiError) {
    if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
      return "Backend unreachable. Try again in a moment.";
    }
  }
  return "Could not verify the code. Try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await requestAdminCode(email.trim());
      if (!result.ok) {
        if (result.reason === "not_authorized") {
          setError("This email is not an admin.");
        } else {
          setError("Could not send a code. Try again later.");
        }
        return;
      }
      setStep("code");
    } catch (err) {
      setError(mapRequestError(err));
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await verifyAdminCode(email.trim(), code.trim());
      if (!result.ok || !result.tokenHash) {
        setError(mapVerifyError(result.reason, null));
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: "magiclink",
      });
      if (otpError) {
        setError("Invalid code. Check the digits and try again.");
        return;
      }

      router.replace("/applications");
    } catch (err) {
      setError(mapVerifyError(undefined, err));
    } finally {
      setLoading(false);
    }
  };

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
            Admin email
          </span>
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@neko.fi"
            aria-label="Email"
            className="h-11 px-4"
          />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={loading} className="min-h-11 text-sm">
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-4">
      <p className="text-[13px] text-white/60">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-white">{email}</span>.
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          Code
        </span>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          aria-label="Code"
          className="h-11 text-center font-mono text-base tracking-[0.5em]"
          autoFocus
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button
        type="submit"
        loading={loading}
        disabled={code.length < 6}
        className="min-h-11 text-sm"
      >
        Sign in
      </Button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
        }}
        className="text-xs text-white/50 hover:text-white"
      >
        Use a different email
      </button>
    </form>
  );
}
