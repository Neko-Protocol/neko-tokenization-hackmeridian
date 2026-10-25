import type { VerificationKind } from "@/lib/services/launchpad.api";

export interface OnboardingSession {
  kind: VerificationKind;
  verificationId: string;
  claimToken: string;
  sessionUrl: string | null;
}

const STORAGE_KEY = "neko.launchpad.onboarding";

export function loadSession(): OnboardingSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(value: OnboardingSession | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the flow still works, it just won't survive a reload.
  }
}
