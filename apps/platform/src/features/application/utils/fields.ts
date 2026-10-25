// Mirrors CreateApplicationDto in neko-backend-hackmeridian.

export const ASSET_TYPES = [
  { value: "real_estate", label: "Real estate", hint: "Buildings, land, rental units" },
  { value: "private_credit", label: "Private credit", hint: "Loans to businesses or people" },
  { value: "invoices", label: "Invoices", hint: "Money customers owe you" },
  { value: "agriculture", label: "Agriculture", hint: "Harvests, livestock, farmland" },
  { value: "energy", label: "Energy", hint: "Solar, wind, hydro projects" },
  { value: "other", label: "Other", hint: "Something else that earns" },
] as const;

export const OFFERING_TYPES = [
  {
    value: "private",
    label: "Private",
    hint: "Only invited, verified investors. Usually lighter rules.",
  },
  {
    value: "public",
    label: "Public",
    hint: "Listed for everyone on Neko Pro. Usually needs regulator approval.",
  },
] as const;

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "CR", name: "Costa Rica" },
  { code: "MX", name: "Mexico" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
  { code: "SV", name: "El Salvador" },
  { code: "PA", name: "Panama" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "NI", name: "Nicaragua" },
  { code: "DO", name: "Dominican Republic" },
  { code: "PE", name: "Peru" },
  { code: "CL", name: "Chile" },
  { code: "EC", name: "Ecuador" },
  { code: "BO", name: "Bolivia" },
  { code: "PY", name: "Paraguay" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "BR", name: "Brazil" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "CH", name: "Switzerland" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
];

export const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code));

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

export interface DocumentLinkValue {
  name: string;
  url: string;
}

/** Numbers stay strings while editing so inputs can be empty. */
export interface ApplicationFormValues {
  issuer_name: string;
  issuer_country: string;
  asset_name: string;
  asset_type: string;
  description: string;
  target_amount: string;
  currency: string;
  min_ticket: string;
  expected_yield_pct: string;
  term_months: string;
  max_investors: string;
  offering_type: string;
  investor_countries: string[];
  accepts_us_investors: boolean | null;
  uses_mass_marketing: boolean | null;
  documents: DocumentLinkValue[];
}

export type FieldKey = keyof ApplicationFormValues;

export interface FieldSpec {
  key: FieldKey;
  label: string;
  question: string;
  help: string;
  required: boolean;
  format: string;
}

export const FIELDS: FieldSpec[] = [
  {
    key: "issuer_name",
    label: "Legal name",
    question: "What's the issuer's legal name?",
    help: "The company that owns the asset and will issue the token, exactly as it appears in the company registry.",
    required: true,
    format: "string, max 200 characters",
  },
  {
    key: "issuer_country",
    label: "Country",
    question: "Where is the company incorporated?",
    help: "This decides which securities, anti money laundering and data protection laws apply first.",
    required: true,
    format: "ISO 3166-1 alpha-2 code, e.g. CR",
  },
  {
    key: "asset_type",
    label: "Asset type",
    question: "What kind of asset is it?",
    help: "Pick the category that best describes what backs the token.",
    required: true,
    format: `one of: ${ASSET_TYPES.map((t) => t.value).join(", ")}`,
  },
  {
    key: "asset_name",
    label: "Asset name",
    question: "What should investors call it?",
    help: "A short, clear name, like 'Escazú Office Tower, Floor 4' or 'Q3 2026 Coffee Harvest'.",
    required: true,
    format: "string, max 200 characters",
  },
  {
    key: "description",
    label: "Description",
    question: "How does it make money?",
    help: "What the asset is, how it produces returns, who operates it and what investors receive. Plain language, no hype.",
    required: true,
    format: "string, max 4000 characters",
  },
  {
    key: "target_amount",
    label: "Target raise",
    question: "How much do you want to raise?",
    help: "The total you need from investors. Funds are released to you in one go when the raise closes.",
    required: true,
    format: "positive number, no symbols, e.g. 250000",
  },
  {
    key: "currency",
    label: "Currency",
    question: "In which currency?",
    help: "Fixed to USD for now: investments settle in USDC on Stellar.",
    required: true,
    format: "always USD, do not propose another currency",
  },
  {
    key: "min_ticket",
    label: "Minimum investment",
    question: "What's the smallest amount someone can invest?",
    help: "Lower minimums reach more people. Private offerings often ask for more.",
    required: true,
    format: "positive number, e.g. 100",
  },
  {
    key: "expected_yield_pct",
    label: "Annual yield (%)",
    question: "What yearly return can investors expect?",
    help: "As a percentage. Only state what the asset can realistically pay.",
    required: true,
    format: "number, e.g. 9.5",
  },
  {
    key: "term_months",
    label: "Term (months)",
    question: "When do investors get their money back?",
    help: "The length of the investment, in months.",
    required: true,
    format: "whole number of months, e.g. 18",
  },
  {
    key: "offering_type",
    label: "Offering type",
    question: "Who can invest?",
    help: "Private offerings go to a limited group of verified investors. Public offerings are open to everyone and normally need regulator authorization.",
    required: true,
    format: "one of: private, public",
  },
  {
    key: "investor_countries",
    label: "Investor countries",
    question: "Where are your investors?",
    help: "Each country adds its own rules, so start with the ones you need.",
    required: true,
    format: 'array of ISO 3166-1 alpha-2 codes, e.g. ["CR", "MX"]',
  },
  {
    key: "max_investors",
    label: "Maximum investors",
    question: "Is there a limit on how many people can invest?",
    help: "Private offerings usually stay under a legal cap on the number of investors.",
    required: false,
    format: "whole number, e.g. 50",
  },
  {
    key: "accepts_us_investors",
    label: "US investors",
    question: "Will you accept investors from the United States?",
    help: "Selling to US persons brings in SEC rules (Regulation D, S or Crowdfunding).",
    required: true,
    format: "boolean",
  },
  {
    key: "uses_mass_marketing",
    label: "Public advertising",
    question: "Will you advertise the offering publicly?",
    help: "Social media ads, newsletters or events aimed at the general public can turn a private offering into a public one.",
    required: true,
    format: "boolean",
  },
  {
    key: "documents",
    label: "Documents",
    question: "Anything reviewers should see?",
    help: "Files or links to title deeds, appraisals, financial statements or contracts. Files shared in the assistant chat are not attached and are deleted when you submit.",
    required: false,
    format: "array of { name: string, url: https URL }, max 12",
  },
];

export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && FIELD_BY_KEY.has(value as FieldKey);
}

export interface StepSpec {
  id: string;
  title: string;
  subtitle: string;
  fields: FieldKey[];
  /** A single choice: picking an option moves on. */
  choice?: boolean;
}

export const STEPS: StepSpec[] = [
  {
    id: "issuer",
    title: "Who's issuing",
    subtitle: "The company that owns the asset, as it appears in the registry.",
    fields: ["issuer_name", "issuer_country"],
  },
  {
    id: "type",
    title: "Asset type",
    subtitle: "What backs the token?",
    fields: ["asset_type"],
    choice: true,
  },
  {
    id: "asset",
    title: "The asset",
    subtitle: "How investors will see it and how it makes money.",
    fields: ["asset_name", "description"],
  },
  {
    id: "raise",
    title: "Your raise",
    subtitle: "Funds are released to you in one go when the raise closes.",
    fields: ["target_amount", "currency", "min_ticket"],
  },
  {
    id: "returns",
    title: "Returns",
    subtitle: "What investors can expect back, and when.",
    fields: ["expected_yield_pct", "term_months"],
  },
  {
    id: "offering",
    title: "Offering",
    subtitle: "Who can invest?",
    fields: ["offering_type"],
    choice: true,
  },
  {
    id: "investors",
    title: "Investors",
    subtitle: "Where they are and how many you'll accept.",
    fields: ["investor_countries", "max_investors"],
  },
  {
    id: "us",
    title: "US investors",
    subtitle: "Will you accept investors from the United States?",
    fields: ["accepts_us_investors"],
    choice: true,
  },
  {
    id: "marketing",
    title: "Advertising",
    subtitle: "Will you promote the offering to the general public?",
    fields: ["uses_mass_marketing"],
    choice: true,
  },
  {
    id: "documents",
    title: "Documents",
    subtitle: "Upload or link what reviewers should see: deeds, appraisals, financials, contracts.",
    fields: ["documents"],
  },
];

export function emptyForm(): ApplicationFormValues {
  return {
    issuer_name: "",
    issuer_country: "",
    asset_name: "",
    asset_type: "",
    description: "",
    target_amount: "",
    currency: "USD",
    min_ticket: "",
    expected_yield_pct: "",
    term_months: "",
    max_investors: "",
    offering_type: "",
    investor_countries: [],
    accepts_us_investors: null,
    uses_mass_marketing: null,
    documents: [],
  };
}
