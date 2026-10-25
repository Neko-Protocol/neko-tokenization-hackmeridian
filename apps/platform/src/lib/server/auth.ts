import "server-only";

import type { NextRequest } from "next/server";
import type { LaunchpadAccount } from "@/lib/services/launchpad.api";

const CACHE_MS = 60_000;
const cache = new Map<string, { account: LaunchpadAccount; until: number }>();

export class AuthError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

// The backend verifies the Privy token.
export async function requireAccount(req: NextRequest): Promise<LaunchpadAccount> {
  const authorization = req.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthError(401, "MISSING_ACCESS_TOKEN");

  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.account;

  const baseUrl = process.env.BACKEND_URL;
  const key = process.env.BACKEND_INTERNAL_KEY;
  if (!baseUrl || !key) throw new AuthError(500, "BACKEND_PROXY_MISCONFIGURED");

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/launchpad/me`, {
      headers: { "X-Internal-Key": key, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new AuthError(502, "BACKEND_UNREACHABLE");
  }
  if (res.status === 401 || res.status === 404) throw new AuthError(401, "UNAUTHORIZED");
  if (!res.ok) throw new AuthError(502, "BACKEND_ERROR");

  const account = (await res.json()) as LaunchpadAccount;
  if (account.verification.status !== "approved") {
    throw new AuthError(403, "ISSUER_NOT_VERIFIED");
  }
  cache.set(token, { account, until: Date.now() + CACHE_MS });
  return account;
}
