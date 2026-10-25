import { backendClient } from "./backend-client";

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

export interface CreateApplicationInput {
  issuer_name: string;
  issuer_country: string;
  asset_name: string;
  asset_type: AssetType;
  description: string;
  target_amount: number;
  currency: string;
  min_ticket: number;
  expected_yield_pct?: number;
  term_months?: number;
  max_investors?: number;
  offering_type: "private" | "public";
  investor_countries: string[];
  accepts_us_investors: boolean;
  uses_mass_marketing: boolean;
  milestones: { title: string; amount_pct: number; due?: string }[];
  documents: { name: string; url: string }[];
  ai_summary?: string;
}

export interface Application
  extends Required<
    Omit<
      CreateApplicationInput,
      "expected_yield_pct" | "term_months" | "max_investors" | "ai_summary"
    >
  > {
  id: string;
  account_id: string;
  status: ApplicationStatus;
  expected_yield_pct: number | null;
  term_months: number | null;
  max_investors: number | null;
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

  myApplications: (accessToken: string) =>
    backendClient.get<Application[]>("/v1/launchpad/applications/mine", {
      headers: bearer(accessToken),
    }),
};
