"use client";

import { useEffect, useRef } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import {
  Ban,
  Lock,
  Megaphone,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import {
  ASSET_TYPES,
  COUNTRIES,
  FIELD_BY_KEY,
  STEPS,
  countryName,
  type ApplicationFormValues,
  type FieldKey,
} from "../../utils/fields";
import { describeValue, repaymentPlan } from "../../utils/validation";
import { ASSET_ICONS } from "../../utils/assetIcons";
import { DocumentsField } from "./DocumentsField";
import { RepaymentField } from "./RepaymentField";

type TextKey =
  | "issuer_name"
  | "asset_name"
  | "target_amount"
  | "min_ticket"
  | "min_target"
  | "expected_yield_pct"
  | "term_months"
  | "max_investors";

type YesNoKey = "accepts_us_investors" | "uses_mass_marketing";

const ADVANCE_DELAY_MS = 220;



const YES_NO: Record<
  YesNoKey,
  Record<"yes" | "no", { hint: string; icon: LucideIcon }>
> = {
  accepts_us_investors: {
    yes: { hint: "SEC rules will apply to US investors.", icon: Users },
    no: { hint: "Only investors outside the United States.", icon: Ban },
  },
  uses_mass_marketing: {
    yes: { hint: "Ads, social media, newsletters or public events.", icon: Megaphone },
    no: { hint: "Only people you invite or already know.", icon: Lock },
  },
};

const PLACEHOLDERS: Partial<Record<FieldKey, string>> = {
  issuer_name: "Inversiones Escazú S.A.",
  asset_name: "Escazú Office Tower, Floor 4",
  description: "What it is, how it earns, who runs it and what investors receive.",
  target_amount: "250,000",
  min_ticket: "100",
  min_target: "125,000",
  expected_yield_pct: "9.5",
  term_months: "18",
  max_investors: "50",
};

const MAX_LENGTH: Partial<Record<FieldKey, number>> = {
  issuer_name: 200,
  asset_name: 200,
  description: 4000,
};

const surface = "rounded-2xl bg-[#1b1b1b] shadow-[0_12px_32px_-20px_rgba(0,0,0,0.9)]";
const labelText = "text-[11.5px] font-medium uppercase tracking-[0.12em] text-white/45";
const bareInput = "w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/25";

function Card({
  label,
  counter,
  error,
  className,
  children,
}: {
  label: string;
  counter?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        surface,
        "flex flex-col gap-2 px-4 pb-4 pt-3.5 transition-shadow focus-within:ring-1",
        error ? "ring-1 ring-[#ff3b30]/50" : "focus-within:ring-white/20",
        className
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className={labelText}>{label}</span>
        {counter && <span className="font-label text-[11px] text-white/30">{counter}</span>}
      </span>
      {children}
    </label>
  );
}

function Tile({
  icon: Icon,
  label,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex h-14 items-center gap-3 rounded-xl px-4 text-[15px] font-medium transition-colors",
        selected
          ? "bg-white text-[#111]"
          : "bg-[#1b1b1b] text-white/60 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.9)] hover:text-white"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ApplicationWizard({
  form,
  step,
  goTo,
  onContinue,
  onCancel,
  onFocusField,
  highlighted,
  onSubmit,
  onUploadDocument,
  submitting,
  submitLabel,
}: {
  form: UseFormReturn<ApplicationFormValues>;
  /** STEPS.length is the review step. */
  step: number;
  goTo: (step: number) => void;
  onContinue: () => void;
  onCancel?: () => void;
  onFocusField: (key: FieldKey) => void;
  highlighted: Set<FieldKey>;
  onSubmit: () => void;
  onUploadDocument: (file: File) => Promise<{ name: string; url: string }>;
  submitting: boolean;
  submitLabel: string;
}) {
  const { control, register, formState } = form;
  const values = useWatch({ control }) as ApplicationFormValues;
  const errors = formState.errors;
  const advanceTimer = useRef<number | null>(null);
  const reviewing = step >= STEPS.length;
  const spec = STEPS[step];

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    []
  );

  const advanceSoon = () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(onContinue, ADVANCE_DELAY_MS);
  };

  const errorOf = (key: FieldKey) => errors[key]?.message as string | undefined;

  const wrap = (key: FieldKey, node: React.ReactNode, className?: string) => (
    <div
      key={key}
      onFocusCapture={() => onFocusField(key)}
      onPointerDownCapture={() => onFocusField(key)}
      className={cn("flex flex-col gap-2 rounded-2xl", highlighted.has(key) && "lp-applied", className)}
    >
      {node}
      {errorOf(key) && <p className="px-1 text-[13px] text-[#ff8a83]">{errorOf(key)}</p>}
    </div>
  );

  const hint = (text?: string) =>
    text ? <p className="px-1 text-[13.5px] text-white/50">{text}</p> : null;

  const textCard = (key: TextKey, autoFocus: boolean) => {
    const f = FIELD_BY_KEY.get(key)!;
    const max = MAX_LENGTH[key];
    const numeric = !["issuer_name", "asset_name"].includes(key);
    return wrap(
      key,
      <Card
        label={f.label}
        counter={max ? `${(values[key] ?? "").length} / ${max}` : undefined}
        error={errorOf(key)}
      >
        <input
          {...register(key)}
          autoFocus={autoFocus}
          inputMode={numeric ? "decimal" : undefined}
          maxLength={max ?? 40}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onContinue();
            }
          }}
          placeholder={PLACEHOLDERS[key]}
          className={bareInput}
        />
      </Card>
    );
  };

  const countryOptions = (exclude: string[] = []) => (
    <>
      <option value="">Select a country</option>
      {COUNTRIES.filter((c) => !exclude.includes(c.code)).map((c) => (
        <option key={c.code} value={c.code} className="text-black">
          {c.name}
        </option>
      ))}
    </>
  );

  const yesNo = (key: YesNoKey) => (
    <Controller
      key={key}
      control={control}
      name={key}
      render={({ field }) =>
        wrap(
          key,
          <>
            <div role="radiogroup" className="grid grid-cols-2 gap-3">
              {(["yes", "no"] as const).map((choice) => (
                <Tile
                  key={choice}
                  icon={YES_NO[key][choice].icon}
                  label={choice === "yes" ? "Yes" : "No"}
                  selected={field.value === (choice === "yes")}
                  onSelect={() => {
                    field.onChange(choice === "yes");
                    advanceSoon();
                  }}
                />
              ))}
            </div>
            {field.value !== null && hint(YES_NO[key][field.value ? "yes" : "no"].hint)}
          </>
        )
      }
    />
  );

  const body = (): React.ReactNode => {
    switch (spec.id) {
      case "issuer":
        return (
          <>
            {textCard("issuer_name", true)}
            {wrap(
              "issuer_country",
              <Card label="Country of incorporation" error={errorOf("issuer_country")}>
                <select
                  {...register("issuer_country")}
                  className={cn(bareInput, "-ml-1 cursor-pointer", !values.issuer_country && "text-white/25")}
                >
                  {countryOptions()}
                </select>
              </Card>
            )}
          </>
        );
      case "type":
        return (
          <Controller
            control={control}
            name="asset_type"
            render={({ field }) =>
              wrap(
                "asset_type",
                <>
                  <div
                    role="radiogroup"
                    className="grid grid-cols-2 gap-3"
                  >
                    {ASSET_TYPES.map((t) => (
                      <Tile
                        key={t.value}
                        icon={ASSET_ICONS[t.value]}
                        label={t.label}
                        selected={field.value === t.value}
                        onSelect={() => {
                          field.onChange(t.value);
                          advanceSoon();
                        }}
                      />
                    ))}
                  </div>
                  {hint(ASSET_TYPES.find((t) => t.value === field.value)?.hint)}
                </>
              )
            }
          />
        );
      case "asset":
        return (
          <>
            {textCard("asset_name", true)}
            {wrap(
              "description",
              <Card
                label="Description"
                counter={`${(values.description ?? "").length} / 4000`}
                error={errorOf("description")}
              >
                <textarea
                  {...register("description")}
                  rows={6}
                  maxLength={4000}
                  placeholder={PLACEHOLDERS.description}
                  className={cn(bareInput, "resize-none leading-relaxed")}
                />
              </Card>
            )}
          </>
        );
      case "raise":
        return (
          <>
            <div className="grid grid-cols-[1fr_120px] items-start gap-3">
              {textCard("target_amount", true)}
              <div className={cn(surface, "flex flex-col gap-2 px-4 pb-4 pt-3.5")}>
                <span className="flex items-center justify-between">
                  <span className={labelText}>Currency</span>
                  <Lock className="h-3.5 w-3.5 text-white/30" aria-label="Fixed for now" />
                </span>
                <span className="text-[15px] text-white/70">USD</span>
              </div>
            </div>
            <div className="grid grid-cols-2 items-start gap-3">
              {textCard("min_ticket", false)}
              {textCard("min_target", false)}
            </div>
            {hint(FIELD_BY_KEY.get("min_target")!.help)}
          </>
        );
      case "returns":
        return (
          <div className="grid grid-cols-2 items-start gap-3">
            {textCard("expected_yield_pct", true)}
            {textCard("term_months", false)}
          </div>
        );
      case "repayment":
        return (
          <Controller
            control={control}
            name="milestones"
            render={({ field }) =>
              wrap(
                "milestones",
                <RepaymentField
                  value={field.value ?? []}
                  onChange={field.onChange}
                  termMonths={Number(values.term_months) || null}
                  plan={repaymentPlan(values)}
                  surface={surface}
                  inputClass={bareInput}
                />
              )
            }
          />
        );
      case "investors":
        return (
          <>
            <Controller
              control={control}
              name="investor_countries"
              render={({ field }) =>
                wrap(
                  "investor_countries",
                  <div className="flex flex-col gap-3">
                    {field.value.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {field.value.map((code) => (
                          <span
                            key={code}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white pl-4 pr-2 text-[14px] font-medium text-[#111]"
                          >
                            {countryName(code)}
                            <button
                              type="button"
                              aria-label={`Remove ${countryName(code)}`}
                              onClick={() => field.onChange(field.value.filter((c) => c !== code))}
                              className="rounded-md p-0.5 text-black/40 hover:bg-black/5 hover:text-black"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <Card label="Investor countries" error={errorOf("investor_countries")}>
                      <select
                        value=""
                        onChange={(e) => e.target.value && field.onChange([...field.value, e.target.value])}
                        className={cn(bareInput, "-ml-1 cursor-pointer text-white/25")}
                      >
                        {countryOptions(field.value)}
                      </select>
                    </Card>
                  </div>
                )
              }
            />
            {textCard("max_investors", false)}
          </>
        );
      case "us":
        return yesNo("accepts_us_investors");
      case "marketing":
        return yesNo("uses_mass_marketing");
      case "documents":
        return (
          <Controller
            control={control}
            name="documents"
            render={({ field }) =>
              wrap(
                "documents",
                <DocumentsField
                  value={field.value}
                  getValue={() => form.getValues("documents")}
                  onChange={field.onChange}
                  onUpload={onUploadDocument}
                  surface={surface}
                  inputClass={bareInput}
                />
              )
            }
          />
        );
      default:
        return null;
    }
  };

  const optionalAndEmpty =
    spec &&
    spec.fields.every((k) => {
      const f = FIELD_BY_KEY.get(k)!;
      const v = values[k];
      return !f.required && (Array.isArray(v) ? v.length === 0 : v === "" || v == null);
    });
  const choiceUnanswered = spec?.choice && spec.fields.some((k) => values[k] === "" || values[k] == null);
  const subtitle = spec?.subtitle;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[540px] flex-col">
      <div className="flex shrink-0 flex-col gap-3 pb-6">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-medium text-white/85">
            {reviewing ? "Final review" : `Step ${step + 1} of ${STEPS.length}`}
          </p>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-[13.5px] text-white/45 hover:text-white">
              Cancel
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              disabled={i > step && !reviewing}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300 disabled:cursor-default",
                i < step || reviewing ? "bg-white/85 hover:bg-white" : i === step ? "bg-[#229EDF]" : "bg-white/[0.09]"
              )}
            />
          ))}
        </div>
      </div>

      <div key={step} className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-4 animate-[lp-rise_0.3s_ease-out]">
        <div className="flex flex-col gap-1.5 pb-6">
          <h1 className="text-[28px] font-medium leading-tight tracking-tight text-white">
            {reviewing ? "Review and submit" : spec.title}
          </h1>
          {subtitle && <p className="text-[15px] text-white/55">{subtitle}</p>}
        </div>

        {reviewing ? (
          <div className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className={labelText}>{s.title}</span>
                  <button type="button" onClick={() => goTo(i)} className="text-[13px] text-white/50 hover:text-white">
                    Edit
                  </button>
                </div>
                <dl className={cn(surface, "flex flex-col divide-y divide-white/[0.05] px-4")}>
                  {s.id === "repayment" &&
                    (values.milestones ?? []).map((row, i) => {
                      const amount = repaymentPlan(values)?.amounts[i];
                      return (
                        <div key={i} className="flex items-start justify-between gap-4 py-3 text-[14.5px]">
                          <dt className="min-w-0 text-white/45">
                            {row.due || "No date"} · {row.title || "Untitled"}
                          </dt>
                          <dd className="shrink-0 text-right text-white">
                            {row.amount_pct}%
                            {amount !== undefined && (
                              <span className="block text-[12.5px] text-white/45">
                                {(Number(amount) / 1e7).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  {s.fields.map((k) => {
                    const text = describeValue(k, values[k]);
                    return (
                      <div key={k} className="flex items-start justify-between gap-4 py-3 text-[14.5px]">
                        <dt className="shrink-0 text-white/45">{FIELD_BY_KEY.get(k)!.label}</dt>
                        <dd
                          className={cn(
                            "min-w-0 text-right",
                            text ? "text-white" : "text-white/25",
                            k === "description" && "line-clamp-2"
                          )}
                        >
                          {text || "Not provided"}
                          {errorOf(k) && <span className="block text-[12.5px] text-[#ff8a83]">{errorOf(k)}</span>}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
            <p className="px-1 text-[13.5px] leading-relaxed text-white/45">
              Submitting sends your application to Neko&apos;s legal and compliance team, closes the
              assistant and deletes the files you shared with it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{body()}</div>
        )}
      </div>

      <div className="flex shrink-0 gap-3 border-t border-white/[0.06] pt-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            className="h-12 rounded-xl px-5 text-[15px] font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Back
          </button>
        )}
        {reviewing ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-medium text-[#111] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Spinner className="border-black/20 border-t-black" />}
            {submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            disabled={choiceUnanswered}
            className="h-12 flex-1 rounded-xl bg-white text-[15px] font-medium text-[#111] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {optionalAndEmpty ? "Skip" : "Continue"}
          </button>
        )}
      </div>
    </div>
  );
}
