import type { Resolver } from "react-hook-form";
import type { CreateApplicationInput } from "@/lib/services/launchpad.api";
import {
  ASSET_TYPES,
  OFFERING_TYPES,
  STEPS,
  countryName,
  type ApplicationFormValues,
  type FieldKey,
  type StepSpec,
} from "./fields";

export type FieldErrors = Partial<Record<FieldKey, string>>;

const ISO2 = /^[A-Z]{2}$/;

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validate(v: ApplicationFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!v.issuer_name.trim()) errors.issuer_name = "Enter the company's legal name";
  if (!ISO2.test(v.issuer_country)) errors.issuer_country = "Pick a country";
  if (!ASSET_TYPES.some((t) => t.value === v.asset_type)) errors.asset_type = "Pick an asset type";
  if (!v.asset_name.trim()) errors.asset_name = "Give the asset a name";
  if (!v.description.trim()) errors.description = "Describe the asset";
  else if (v.description.length > 4000) errors.description = "Max 4000 characters";

  const target = num(v.target_amount);
  if (target === null || Number.isNaN(target) || target <= 0)
    errors.target_amount = "Enter an amount above 0";
  const ticket = num(v.min_ticket);
  if (ticket === null || Number.isNaN(ticket) || ticket <= 0)
    errors.min_ticket = "Enter an amount above 0";
  else if (target && ticket > target) errors.min_ticket = "Can't be more than the target raise";

  const yieldPct = num(v.expected_yield_pct);
  if (yieldPct === null) errors.expected_yield_pct = "Enter the expected yearly return";
  else if (Number.isNaN(yieldPct) || yieldPct < 0) errors.expected_yield_pct = "Enter a number of 0 or more";
  const term = num(v.term_months);
  if (term === null) errors.term_months = "Enter the term in months";
  else if (Number.isNaN(term) || term < 1 || !Number.isInteger(term))
    errors.term_months = "Whole months, 1 or more";

  if (!OFFERING_TYPES.some((t) => t.value === v.offering_type))
    errors.offering_type = "Pick who can invest";
  if (v.investor_countries.length === 0) errors.investor_countries = "Add at least one country";
  const maxInv = num(v.max_investors);
  if (Number.isNaN(maxInv) || (maxInv !== null && (maxInv < 1 || !Number.isInteger(maxInv))))
    errors.max_investors = "Whole number, 1 or more";

  if (v.accepts_us_investors === null) errors.accepts_us_investors = "Choose yes or no";
  if (v.uses_mass_marketing === null) errors.uses_mass_marketing = "Choose yes or no";

  if (v.documents.length > 12) errors.documents = "Max 12 links";
  else if (v.documents.some((d) => !d.name.trim() || !isHttpUrl(d.url)))
    errors.documents = "Each link needs a name and a valid URL";

  return errors;
}

export const applicationResolver: Resolver<ApplicationFormValues> = async (values) => {
  const entries = Object.entries(validate(values));
  if (entries.length === 0) return { values, errors: {} };
  return {
    values: {},
    errors: Object.fromEntries(
      entries.map(([key, message]) => [key, { type: "validate", message }])
    ),
  };
};

export function stepErrors(v: ApplicationFormValues, step: StepSpec): FieldErrors {
  const all = validate(v);
  const errors: FieldErrors = {};
  for (const key of step.fields) if (all[key]) errors[key] = all[key];
  return errors;
}

export function firstIncompleteStep(v: ApplicationFormValues): number {
  const index = STEPS.findIndex((step) => Object.keys(stepErrors(v, step)).length > 0);
  return index === -1 ? STEPS.length : index;
}

export function buildPayload(
  v: ApplicationFormValues
): { payload: CreateApplicationInput; errors: null } | { payload: null; errors: FieldErrors } {
  const errors = validate(v);
  if (Object.keys(errors).length > 0) return { payload: null, errors };

  const yieldPct = num(v.expected_yield_pct);
  const term = num(v.term_months);
  const maxInv = num(v.max_investors);

  return {
    errors: null,
    payload: {
      issuer_name: v.issuer_name.trim(),
      issuer_country: v.issuer_country,
      asset_name: v.asset_name.trim(),
      asset_type: v.asset_type as CreateApplicationInput["asset_type"],
      description: v.description.trim(),
      target_amount: num(v.target_amount)!,
      currency: "USD",
      min_ticket: num(v.min_ticket)!,
      ...(yieldPct !== null && { expected_yield_pct: yieldPct }),
      ...(term !== null && { term_months: term }),
      ...(maxInv !== null && { max_investors: maxInv }),
      offering_type: v.offering_type as CreateApplicationInput["offering_type"],
      investor_countries: v.investor_countries,
      accepts_us_investors: v.accepts_us_investors!,
      uses_mass_marketing: v.uses_mass_marketing!,
      // Funds are released in one go; the backend still expects the list.
      milestones: [],
      documents: v.documents.map((d) => ({ name: d.name.trim(), url: d.url.trim() })),
    },
  };
}

export function coerceProposal(
  key: FieldKey,
  raw: unknown
): ApplicationFormValues[FieldKey] | undefined {
  switch (key) {
    case "accepts_us_investors":
    case "uses_mass_marketing":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "false") return raw === "true";
      return undefined;
    case "investor_countries": {
      const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : null;
      if (!list) return undefined;
      const codes = list.map((c) => String(c).trim().toUpperCase()).filter((c) => ISO2.test(c));
      return codes.length ? [...new Set(codes)] : undefined;
    }
    case "documents": {
      if (!Array.isArray(raw)) return undefined;
      return raw.slice(0, 12).map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return { name: String(o.name ?? ""), url: String(o.url ?? "") };
      });
    }
    case "currency":
      return typeof raw === "string" && raw.trim().toUpperCase() === "USD" ? "USD" : undefined;
    case "issuer_country":
      return typeof raw === "string" ? raw.trim().toUpperCase() : undefined;
    default:
      if (typeof raw === "number") return String(raw);
      if (typeof raw === "string") return raw;
      return undefined;
  }
}

export function describeValue(key: FieldKey, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "asset_type") return ASSET_TYPES.find((t) => t.value === value)?.label ?? String(value);
  if (key === "offering_type")
    return OFFERING_TYPES.find((t) => t.value === value)?.label ?? String(value);
  if (key === "issuer_country") return countryName(String(value));
  if (key === "target_amount" || key === "min_ticket" || key === "max_investors") {
    const n = num(String(value));
    return n === null || Number.isNaN(n) ? String(value) : n.toLocaleString("en-US");
  }
  if (key === "expected_yield_pct") return `${String(value).replace(/\s*%$/, "")}%`;
  if (key === "term_months") return `${value} months`;
  if (key === "investor_countries" && Array.isArray(value))
    return value.map((c) => countryName(String(c))).join(", ");
  if (key === "documents" && Array.isArray(value))
    return (value as { name: string }[]).map((d) => d.name).join(", ");
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
