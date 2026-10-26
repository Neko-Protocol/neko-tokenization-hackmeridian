"use client";

import { Plus, X } from "lucide-react";
import { formatUsdc } from "@neko-tokenization/stellar";
import { cn } from "@/lib/utils";
import { MAX_REPAYMENTS, type RepaymentValue } from "../../utils/fields";
import { repaymentPctTotal } from "../../utils/validation";

function addMonths(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

/**
 * A starting schedule: three equal payments spread over the term, so the
 * issuer edits a sensible plan instead of filling in a blank table.
 */
export function suggestedRepayments(termMonths: number): RepaymentValue[] {
  const count = termMonths >= 3 ? 3 : 1;
  const pct = Math.floor((100 / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => ({
    title: count === 1 ? "Full repayment" : `Payment ${i + 1}`,
    amount_pct: String(
      i === count - 1 ? Math.round((100 - pct * (count - 1)) * 100) / 100 : pct
    ),
    due: addMonths(Math.max(1, Math.round((termMonths * (i + 1)) / count))),
  }));
}

export function RepaymentField({
  value,
  onChange,
  termMonths,
  plan,
  surface,
  inputClass,
}: {
  value: RepaymentValue[];
  onChange: (next: RepaymentValue[]) => void;
  termMonths: number | null;
  /** Total repayment and each payment in USDC base units, or null if the terms are incomplete. */
  plan: { total: bigint; amounts: bigint[] } | null;
  surface: string;
  inputClass: string;
}) {
  const total = repaymentPctTotal(value);
  const update = (i: number, patch: Partial<RepaymentValue>) =>
    onChange(value.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(surface, "flex items-center justify-between px-4 py-3.5")}
      >
        <span className="text-[13.5px] text-white/50">
          Investors get back in total
        </span>
        <span className="text-[15px] font-medium text-white">
          {plan
            ? formatUsdc(plan.total)
            : "Set the raise, yield and term first"}
        </span>
      </div>

      {value.length === 0 ? (
        <button
          type="button"
          onClick={() => onChange(suggestedRepayments(termMonths ?? 12))}
          className={cn(
            surface,
            "h-14 text-[15px] font-medium text-white/70 hover:text-white"
          )}
        >
          Start from three equal payments
        </button>
      ) : (
        value.map((row, i) => (
          <div
            key={i}
            className={cn(surface, "flex flex-col gap-3 px-4 pb-4 pt-3.5")}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45">
                Payment {i + 1}
              </span>
              <span className="flex items-center gap-2">
                {plan?.amounts[i] !== undefined && (
                  <span className="font-label text-[12.5px] text-white/60">
                    {formatUsdc(plan.amounts[i])}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove payment ${i + 1}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="rounded-md p-0.5 text-white/35 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            </div>
            <input
              value={row.title}
              maxLength={120}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="What you will have done by then, e.g. Structure complete"
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-white/40">
                  Share of total (%)
                </span>
                <input
                  value={row.amount_pct}
                  inputMode="decimal"
                  maxLength={6}
                  onChange={(e) => update(i, { amount_pct: e.target.value })}
                  placeholder="33.33"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-white/40">Due</span>
                <input
                  type="date"
                  value={row.due}
                  onChange={(e) => update(i, { due: e.target.value })}
                  className={cn(inputClass, "[color-scheme:dark]")}
                />
              </label>
            </div>
          </div>
        ))
      )}

      {value.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span
            className={cn(
              "text-[13px]",
              total === 100 ? "text-white/45" : "text-[#ffb35c]"
            )}
          >
            {total}% of 100% allocated
          </span>
          {value.length < MAX_REPAYMENTS && (
            <button
              type="button"
              onClick={() =>
                onChange([
                  ...value,
                  {
                    title: "",
                    amount_pct:
                      total < 100
                        ? String(Math.round((100 - total) * 100) / 100)
                        : "",
                    due: "",
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 text-[13.5px] text-white/60 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add payment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
