import type { Resolver } from "react-hook-form";
import { splitTranches, totalRepayment } from "@neko-tokenization/stellar";
import type { CreateApplicationInput } from "@/lib/services/launchpad.api";
import {
  ASSET_TYPES,
  MAX_REPAYMENTS,
  STEPS,
  countryName,
  type ApplicationFormValues,
  type RepaymentValue,
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
  const minTarget = num(v.min_target);
  if (minTarget === null || Number.isNaN(minTarget) || minTarget <= 0)
    errors.min_target = "Enter an amount above 0";
  else if (target && minTarget > target) errors.min_target = "Can't be more than the target raise";
  else if (ticket && minTarget < ticket) errors.min_target = "Can't be less than the minimum investment";

  const yieldPct = num(v.expected_yield_pct);
  if (yieldPct === null) errors.expected_yield_pct = "Enter the expected yearly return";
  else if (Number.isNaN(yieldPct) || yieldPct < 0) errors.expected_yield_pct = "Enter a number of 0 or more";
  const term = num(v.term_months);
  if (term === null) errors.term_months = "Enter the term in months";
  else if (Number.isNaN(term) || term < 1 || !Number.isInteger(term))
    errors.term_months = "Whole months, 1 or more";

  if (v.investor_countries.length === 0) errors.investor_countries = "Add at least one country";
  const maxInv = num(v.max_investors);
  if (Number.isNaN(maxInv) || (maxInv !== null && (maxInv < 1 || !Number.isInteger(maxInv))))
    errors.max_investors = "Whole number, 1 or more";

  const repaymentError = validateRepayments(v.milestones ?? [], term);
  if (repaymentError) errors.milestones = repaymentError;

  if (v.accepts_us_investors === null) errors.accepts_us_investors = "Choose yes or no";
  if (v.uses_mass_marketing === null) errors.uses_mass_marketing = "Choose yes or no";

  if (v.documents.length > 12) errors.documents = "Max 12 links";
  else if (v.documents.some((d) => !d.name.trim() || !isHttpUrl(d.url)))
    errors.documents = "Each link needs a name and a valid URL";

  return errors;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Sum of the repayment percentages, rounded to cents of a percent. */
export function repaymentPctTotal(rows: RepaymentValue[]): number {
  const total = rows.reduce((sum, r) => sum + (num(r.amount_pct) || 0), 0);
  return Math.round(total * 100) / 100;
}

function validateRepayments(rows: RepaymentValue[], term: number | null): string | null {
  if (rows.length === 0) return "Add at least one repayment";
  if (rows.length > MAX_REPAYMENTS) return `At most ${MAX_REPAYMENTS} repayments`;
  if (rows.some((r) => !r.title.trim())) return "Give every repayment a title";
  if (rows.some((r) => r.title.trim().length > 120)) return "Titles can be at most 120 characters";
  const pcts = rows.map((r) => num(r.amount_pct));
  if (pcts.some((p) => p === null || Number.isNaN(p) || p <= 0))
    return "Every repayment needs a share above 0%";
  if (repaymentPctTotal(rows) !== 100) return "The shares must add up to 100%";
  if (rows.some((r) => !DATE.test(r.due) || Number.isNaN(Date.parse(r.due))))
    return "Every repayment needs a due date";
  const today = new Date().toISOString().slice(0, 10);
  if (rows[0].due <= today) return "The first repayment must be after today";
  for (let i = 1; i < rows.length; i++)
    if (rows[i].due <= rows[i - 1].due) return "Due dates must be in order, one after another";
  if (term && Number.isInteger(term)) {
    const end = new Date();
    end.setMonth(end.getMonth() + term + 3);
    if (rows[rows.length - 1].due > end.toISOString().slice(0, 10))
      return "The last repayment is well past the term you set";
  }
  return null;
}

/**
 * The total investors get back and each payment in USDC base units, as the
 * vault will be created with them. `null` while the inputs are incomplete.
 */
export function repaymentPlan(
  v: Pick<ApplicationFormValues, "target_amount" | "expected_yield_pct" | "term_months" | "milestones">
): { total: bigint; amounts: bigint[] } | null {
  const target = num(v.target_amount);
  const yieldPct = num(v.expected_yield_pct);
  const term = num(v.term_months);
  if (!target || target <= 0 || yieldPct === null || Number.isNaN(yieldPct) || !term || term < 1)
    return null;
  const total = totalRepayment(target, yieldPct, term);
  const pcts = (v.milestones ?? []).map((r) => num(r.amount_pct) || 0);
  return { total, amounts: splitTranches(total, pcts) };
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
      min_target: num(v.min_target)!,
      ...(yieldPct !== null && { expected_yield_pct: yieldPct }),
      ...(term !== null && { term_months: term }),
      ...(maxInv !== null && { max_investors: maxInv }),
      offering_type: "public",
      investor_countries: v.investor_countries,
      accepts_us_investors: v.accepts_us_investors!,
      uses_mass_marketing: v.uses_mass_marketing!,
      milestones: v.milestones.map((r) => ({
        title: r.title.trim(),
        amount_pct: num(r.amount_pct)!,
        due: r.due,
      })),
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
    case "milestones": {
      if (!Array.isArray(raw)) return undefined;
      return raw.slice(0, MAX_REPAYMENTS).map((r) => {
        const o = (r ?? {}) as Record<string, unknown>;
        const due = String(o.due ?? "");
        return {
          title: String(o.title ?? ""),
          amount_pct: o.amount_pct === undefined ? "" : String(o.amount_pct),
          due: DATE.test(due.slice(0, 10)) ? due.slice(0, 10) : "",
        };
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
  if (key === "issuer_country") return countryName(String(value));
  if (key === "milestones" && Array.isArray(value)) {
    const rows = value as RepaymentValue[];
    return rows.length === 1 ? "1 repayment" : `${rows.length} repayments`;
  }
  if (
    key === "target_amount" ||
    key === "min_ticket" ||
    key === "min_target" ||
    key === "max_investors"
  ) {
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
