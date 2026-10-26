import { backendBaseUrl, backendClient } from "./backend-client";

export type VerificationKind = "kyc" | "kyb";
export type VerificationStatus =
  "pending" | "in_progress" | "in_review" | "approved" | "declined" | "expired";

export interface Verification {
  id: string;
  kind: VerificationKind;
  provider: "didit" | "mock";
  status: VerificationStatus;
  full_name: string | null;
  business_name: string | null;
  country: string | null;
  claimed: boolean;
}

export interface StartedVerification {
  verification: Verification;
  session_url: string | null;
  claim_token: string;
}

export interface LaunchpadAccount {
  account: {
    id: string;
    email: string;
    display_name: string | null;
    privy_user_id: string;
  };
  verification: Verification;
  wallet: {
    address: string;
    network: string;
    funded: boolean;
    funding_tx_hash: string | null;
  };
}

export type ApplicationStatus =
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected";

export type AssetType =
  | "real_estate"
  | "private_credit"
  | "invoices"
  | "agriculture"
  | "energy"
  | "other";

export interface ApplicationMilestone {
  title: string;
  /** Share of the total repayment, principal plus interest. */
  amount_pct: number;
  /** YYYY-MM-DD. */
  due?: string;
}

export type DeploymentStatus = "launching" | "live" | "failed";

/** The launch steps the backend runs, in order. */
export type LaunchStep =
  | "create_vault"
  | "wire_vault"
  | "accept_admin"
  | "bind_compliance"
  | "bind_registry"
  | "register_milestones";

/** The on-chain side of an approved application, once the issuer launches it. */
export interface Deployment {
  /** 64 hex characters; the factory derives every contract address from it. */
  vault_id: string;
  token_symbol: string;
  /** ISO timestamp. */
  funding_deadline: string;
  token: string | null;
  compliance: string | null;
  vault: string | null;
  status: DeploymentStatus;
  /** Transaction hash of every step that has run, or `"skipped"` when it was already done on-chain. */
  steps: Partial<Record<LaunchStep, string>>;
  /** The step that failed and why, when `status` is `failed`. */
  error: { step: LaunchStep; message: string } | null;
  launched_at: string | null;
}

export interface LaunchInput {
  token_symbol: string;
  /** ISO timestamp. */
  funding_deadline: string;
}

export interface CreateApplicationInput {
  issuer_name: string;
  issuer_country: string;
  asset_name: string;
  asset_type: AssetType;
  description: string;
  target_amount: number;
  currency: string;
  min_ticket: number;
  /** Below this by the funding deadline, the raise fails and investors are refunded. */
  min_target: number;
  expected_yield_pct?: number;
  term_months?: number;
  max_investors?: number;
  offering_type: "private" | "public";
  investor_countries: string[];
  accepts_us_investors: boolean;
  uses_mass_marketing: boolean;
  /** The repayment schedule: one vault tranche and one tracked milestone each. */
  milestones: ApplicationMilestone[];
  documents: { name: string; url: string }[];
  /** The backend closes this assistant session and writes the reviewer summary. */
  assistant_session_id?: string;
}

export interface Application
  extends Required<
    Omit<
      CreateApplicationInput,
      | "expected_yield_pct"
      | "term_months"
      | "max_investors"
      | "min_target"
      | "assistant_session_id"
    >
  > {
  id: string;
  account_id: string;
  status: ApplicationStatus;
  deployment: Deployment | null;
  expected_yield_pct: number | null;
  term_months: number | null;
  max_investors: number | null;
  /** Null on applications sent before the minimum raise was asked for. */
  min_target: number | null;
  ai_summary: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const claim = (claimToken: string) => ({ "x-claim-token": claimToken });
const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const launchpadApi = {
  startVerification: (kind: VerificationKind) =>
    backendClient.post<StartedVerification>("/v1/launchpad/verifications", {
      kind,
    }),

  startMockVerification: (kind: VerificationKind, name: string) =>
    backendClient.post<StartedVerification>(
      "/v1/launchpad/verifications/mock",
      { kind, name }
    ),

  getVerification: (id: string, claimToken: string) =>
    backendClient.get<Verification>(
      `/v1/launchpad/verifications/${encodeURIComponent(id)}`,
      { headers: claim(claimToken) }
    ),

  createAccount: (verificationId: string, claimToken: string, email: string) =>
    backendClient.post<LaunchpadAccount>(
      "/v1/launchpad/accounts",
      { verification_id: verificationId, email },
      { headers: claim(claimToken) }
    ),

  me: (accessToken: string) =>
    backendClient.get<LaunchpadAccount>("/v1/launchpad/me", {
      headers: bearer(accessToken),
    }),

  createApplication: (accessToken: string, input: CreateApplicationInput) =>
    backendClient.post<Application>("/v1/launchpad/applications", input, {
      headers: bearer(accessToken),
    }),

  /**
   * Deploy the approved application's token, compliance contract and vault.
   * Safe to call again after a failure: the backend resumes from the last step
   * that went through.
   */
  launchApplication: (accessToken: string, id: string, input: LaunchInput) =>
    backendClient.post<Application>(
      `/v1/launchpad/applications/${encodeURIComponent(id)}/launch`,
      input,
      { headers: bearer(accessToken) }
    ),

  /** Testnet only: send test USDC to an address that already trusts it. */
  faucetUsdc: (accessToken: string, address: string, amount: number) =>
    backendClient.post<{ tx_hash: string }>(
      "/v1/launchpad/faucet/usdc",
      { address, amount },
      { headers: bearer(accessToken) }
    ),

  /** Upload a file to the issuer's document store; returns a signed link to it. */
  uploadDocument: async (
    accessToken: string,
    file: File
  ): Promise<{ name: string; url: string }> => {
    const data = new FormData();
    data.set("file", file);
    const res = await fetch(
      `${backendBaseUrl}/v1/launchpad/applications/documents`,
      { method: "POST", headers: bearer(accessToken), body: data }
    );
    const body = (await res.json().catch(() => ({}))) as {
      document?: { name: string; url: string };
      message?: string;
    };
    if (!res.ok || !body.document) throw new Error(body.message ?? "Upload failed.");
    return body.document;
  },

  myApplications: (accessToken: string) =>
    backendClient.get<Application[]>("/v1/launchpad/applications/mine", {
      headers: bearer(accessToken),
    }),
};
