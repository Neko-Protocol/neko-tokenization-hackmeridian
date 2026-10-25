export type ApplicationStatus =
  "submitted" | "in_review" | "changes_requested" | "approved" | "rejected";

export type AssetType =
  | "real_estate"
  | "private_credit"
  | "invoices"
  | "agriculture"
  | "energy"
  | "other";

export type OfferingType = "private" | "public";

export type VerificationKind = "kyc" | "kyb";

export type VerificationProvider = "didit" | "mock";

export type VerificationStatus =
  "pending" | "in_progress" | "in_review" | "approved" | "declined" | "expired";

export type Decision =
  "in_review" | "approved" | "rejected" | "changes_requested";

export interface ApplicationMilestone {
  title: string;
  amount_pct: number;
  due?: string;
}

export interface ApplicationDocument {
  name: string;
  url: string;
}

export interface VerificationView {
  id: string;
  kind: VerificationKind;
  provider: VerificationProvider;
  status: VerificationStatus;
  full_name: string | null;
  business_name: string | null;
  country: string | null;
  claimed: boolean;
}

export interface ApplicationView {
  id: string;
  account_id: string;
  status: ApplicationStatus;
  issuer_name: string;
  issuer_country: string;
  asset_name: string;
  asset_type: AssetType;
  description: string;
  target_amount: number;
  currency: string;
  min_ticket: number;
  expected_yield_pct: number | null;
  term_months: number | null;
  max_investors: number | null;
  offering_type: OfferingType;
  investor_countries: string[];
  accepts_us_investors: boolean;
  uses_mass_marketing: boolean;
  milestones: ApplicationMilestone[];
  documents: ApplicationDocument[];
  ai_summary: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminApplicationView extends ApplicationView {
  issuer: {
    account_id: string;
    email: string;
    display_name: string | null;
    verification: VerificationView;
    wallet_address: string | null;
  };
}

export type ComplianceStatus = "pass" | "warn" | "fail" | "info";

export interface ComplianceCitation {
  norm: string;
  article: string;
}

export interface ComplianceCheck {
  id: string;
  title: string;
  status: ComplianceStatus;
  detail: string;
  citations: ComplianceCitation[];
}

export interface ArticleExcerpt {
  id: string;
  title: string;
  version: string;
  text: string;
  sourceUrl: string;
}

export type EnrichedCitation =
  | (ComplianceCitation & ArticleExcerpt)
  | (ComplianceCitation & { unavailable: true });

export interface EnrichedComplianceCheck extends Omit<
  ComplianceCheck,
  "citations"
> {
  citations: EnrichedCitation[];
}
