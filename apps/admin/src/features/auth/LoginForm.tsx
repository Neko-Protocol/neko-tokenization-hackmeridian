"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";

import { Spinner } from "@/components/ui/Spinner";
import {
  AdminApiError,
  requestAdminCode,
  verifyAdminCode,
} from "@/lib/admin-api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Step = "email" | "code";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

const INPUT_CLASS =
  "w-full rounded-lg border border-white/10 bg-[#141414] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#229EDF]/50 disabled:opacity-60";

const PRIMARY_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#229EDF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a85bd] disabled:cursor-not-allowed disabled:opacity-60";

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
    return "That code is not valid. Check the digits or ask for a new one.";
  }
  if (err instanceof AdminApiError) {
    if (err.code === "BACKEND_UNREACHABLE" || err.status === 502) {
      return "Backend unreachable. Try again in a moment.";
    }
  }
  return "Could not verify the code. Try again.";
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-center text-sm text-red-400">
      {children}
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const lastSubmitted = useRef<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const requestCode = async (): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestAdminCode(email.trim());
      if (!result.ok) {
        setError(
          result.reason === "not_authorized"
            ? "This email is not on the admin list."
            : "Could not send a code. Try again later."
        );
        return false;
      }
      setResendIn(RESEND_SECONDS);
      return true;
    } catch (err) {
      setError(mapRequestError(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (await requestCode()) {
      setCode("");
      lastSubmitted.current = null;
      setStep("code");
    }
  };

  const verify = async (value: string) => {
    if (loading || value.length !== CODE_LENGTH) return;
    lastSubmitted.current = value;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyAdminCode(email.trim(), value);
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
        setError(mapVerifyError("invalid_code", null));
        return;
      }

      router.replace("/applications");
    } catch (err) {
      setError(mapVerifyError(undefined, err));
    } finally {
      setLoading(false);
    }
  };

  const onCodeChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(next);
    if (error) setError(null);
    // Submit on its own once the last digit is typed or a code is pasted.
    if (next.length === CODE_LENGTH && next !== lastSubmitted.current) {
      void verify(next);
    }
  };

  if (step === "email") {
    return (
      <>
        <p className="mb-6 text-center text-sm text-white/40">
          Sign in with your authorized email. We&apos;ll send you a code, no
          password needed.
        </p>
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            disabled={loading}
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className={PRIMARY_CLASS}
          >
            {loading ? (
              <>
                <Spinner className="border-white/30 border-t-white" />
                Sending...
              </>
            ) : (
              "Send code"
            )}
          </button>
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#229EDF]/15 text-[#229EDF]">
          <Mail className="h-4 w-4" />
        </span>
        <p className="text-sm text-white/40">
          Enter the {CODE_LENGTH}-digit code we sent to
          <span className="mt-0.5 block break-words text-white">{email}</span>
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="text"
          name="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="000000"
          aria-label="Code"
          aria-invalid={error ? true : undefined}
          disabled={loading}
          className={`${INPUT_CLASS} text-center font-mono text-lg tracking-[0.5em] ${
            error ? "border-red-400/50" : ""
          }`}
        />
        <button
          type="submit"
          disabled={loading || code.length < CODE_LENGTH}
          className={PRIMARY_CLASS}
        >
          {loading ? (
            <>
              <Spinner className="border-white/30 border-t-white" />
              Verifying...
            </>
          ) : (
            "Verify code"
          )}
        </button>
        {error && <ErrorText>{error}</ErrorText>}
      </form>

      <div className="mt-5 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
          className="inline-flex items-center gap-1 text-white/40 transition hover:text-white/70"
        >
          <ArrowLeft className="h-3 w-3" />
          Different email
        </button>
        <button
          type="button"
          disabled={loading || resendIn > 0}
          onClick={() => {
            setCode("");
            lastSubmitted.current = null;
            void requestCode();
          }}
          className="text-[#229EDF] transition hover:text-[#5bbbec] disabled:cursor-not-allowed disabled:text-white/30"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
        </button>
      </div>
    </>
  );
}
