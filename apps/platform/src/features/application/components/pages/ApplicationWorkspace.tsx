"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Notice } from "@/components/ui/Notice";
import { BackendError } from "@/lib/services/backend-client";
import {
  launchpadApi,
  type Application,
  type LaunchpadAccount,
} from "@/lib/services/launchpad.api";
import { useAssistant, type Proposal } from "../../hooks/useAssistant";
import { useCreateApplication } from "../../hooks/useApplications";
import {
  COUNTRY_CODES,
  STEPS,
  emptyForm,
  type ApplicationFormValues,
  type FieldKey,
} from "../../utils/fields";
import {
  applicationResolver,
  buildPayload,
  coerceProposal,
  firstIncompleteStep,
} from "../../utils/validation";
import { ApplicationWizard } from "../ui/ApplicationWizard";
import { AssistantPanel } from "../ui/AssistantPanel";
import { SkipReview } from "../ui/SkipReview";

const FORM_KEY = "neko-launchpad-form";

interface Draft {
  values: ApplicationFormValues;
  step: number;
}

function loadDraft(account: LaunchpadAccount): Draft {
  try {
    const raw = window.sessionStorage.getItem(FORM_KEY);
    if (raw) {
      const draft = JSON.parse(raw) as Partial<Draft>;
      if (draft.values) {
        return {
          values: { ...emptyForm(), ...draft.values, currency: "USD" },
          step: Math.min(Math.max(Number(draft.step) || 0, 0), STEPS.length),
        };
      }
    }
  } catch {}
  const { verification } = account;
  const country = verification.country?.toUpperCase() ?? "";
  return {
    step: 0,
    values: {
      ...emptyForm(),
      issuer_name: verification.business_name ?? verification.full_name ?? "",
      issuer_country: COUNTRY_CODES.has(country) ? country : "",
    },
  };
}

export function hasDraft(): boolean {
  try {
    return window.sessionStorage.getItem(FORM_KEY) !== null;
  } catch {
    return false;
  }
}

function clearForm() {
  try {
    window.sessionStorage.removeItem(FORM_KEY);
  } catch {}
}

export function ApplicationWorkspace({
  account,
  onExit,
  canExit,
}: {
  account: LaunchpadAccount;
  onExit: () => void;
  canExit: boolean;
}) {
  const { getAccessToken } = usePrivy();
  // Only rendered client-side after login, so sessionStorage is available.
  const [initial] = useState(() => loadDraft(account));
  const form = useForm<ApplicationFormValues>({
    defaultValues: initial.values,
    resolver: applicationResolver,
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control }) as ApplicationFormValues;
  const [step, setStep] = useState(initial.step);
  const [activeField, setActiveField] = useState<FieldKey | null>(
    STEPS[initial.step]?.fields[0] ?? null
  );
  const [highlighted, setHighlighted] = useState<Set<FieldKey>>(new Set());
  const [submitted, setSubmitted] = useState<Application | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const timers = useRef<number[]>([]);
  // Auto-advance fires from a timer, before the new step has rendered.
  const stepRef = useRef(step);

  const assistant = useAssistant({ form: values, activeField });
  const create = useCreateApplication();

  useEffect(() => {
    if (submitted) return;
    try {
      window.sessionStorage.setItem(FORM_KEY, JSON.stringify({ values, step }));
    } catch {}
  }, [values, step, submitted]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const applyProposal = useCallback(
    (p: Proposal): boolean => {
      const value = coerceProposal(p.field, p.value);
      if (value === undefined) return false;
      form.setValue(p.field, value as never, { shouldDirty: true });
      form.clearErrors(p.field);
      setHighlighted((prev) => new Set(prev).add(p.field));
      timers.current.push(
        window.setTimeout(
          () =>
            setHighlighted((prev) => {
              const next = new Set(prev);
              next.delete(p.field);
              return next;
            }),
          1700
        )
      );
      return true;
    },
    [form]
  );

  const goTo = useCallback(
    (next: number) => {
      stepRef.current = next;
      setStep(next);
      form.clearErrors();
      setActiveField(STEPS[next]?.fields[0] ?? null);
    },
    [form]
  );

  const continueStep = useCallback(async () => {
    const spec = STEPS[stepRef.current];
    if (!spec) return;
    if (await form.trigger(spec.fields)) goTo(stepRef.current + 1);
  }, [form, goTo]);

  const send = async (valid: ApplicationFormValues) => {
    setError(null);
    const { payload } = buildPayload(valid);
    if (!payload) return;
    try {
      setSending(true);
      const application = await create.mutateAsync({
        ...payload,
        assistant_session_id: assistant.sessionId,
      });
      setSubmitted(application);
      clearForm();
      assistant.markClosed();
    } catch (err) {
      setError(
        err instanceof BackendError && err.code === "ISSUER_NOT_VERIFIED"
          ? "Your verification has to be approved before you can submit."
          : err instanceof BackendError && err.status === 400
            ? "Some values were rejected. Check the form and try again."
            : "We couldn't send your application. Try again in a moment."
      );
    } finally {
      setSending(false);
    }
  };

  const submit = () =>
    form.handleSubmit(send, (errors) => {
      goTo(firstIncompleteStep(form.getValues()));
      for (const [key, err] of Object.entries(errors)) {
        if (err?.message) form.setError(key as FieldKey, { type: "validate", message: String(err.message) });
      }
    })();

  const uploadDocument = async (file: File): Promise<{ name: string; url: string }> => {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session expired. Sign in again.");
    return launchpadApi.uploadDocument(token, file);
  };

  const discard = async () => {
    setDiscarding(true);
    clearForm();
    try {
      await assistant.discard();
    } catch {}
    onExit();
  };

  return (
    <div className="grid gap-6 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] xl:gap-10">
      <div className="flex min-h-0 min-w-0 flex-col pt-2">
        {submitted ? (
          <div className="mx-auto flex w-full max-w-[540px] flex-col gap-6 pt-6 animate-[lp-rise_0.35s_ease-out]">
            <CheckCircle2 className="h-10 w-10 text-[#2ed06e]" strokeWidth={1.75} />
            <div className="flex flex-col gap-2">
              <h1 className="text-[28px] font-medium leading-tight tracking-tight text-white">
                {submitted.status === "approved" ? "Application approved" : "Application sent"}
              </h1>
              {submitted.status === "approved" ? (
                <p className="text-[15px] leading-relaxed text-white/60">
                  <span className="text-white">{submitted.asset_name}</span> skipped pre-approval for the
                  demo. You can launch it from your dashboard.
                </p>
              ) : (
                <p className="text-[15px] leading-relaxed text-white/60">
                  <span className="text-white">{submitted.asset_name}</span> is now with Neko&apos;s legal
                  and compliance team. You&apos;ll see the status change on your dashboard.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onExit}
              className="h-12 w-full rounded-xl bg-white text-[15px] font-medium text-[#111] hover:opacity-90"
            >
              Go to my assets
            </button>
            <SkipReview app={submitted} onApproved={setSubmitted} />
          </div>
        ) : (
          <>
            <ApplicationWizard
              form={form}
              step={step}
              goTo={goTo}
              onContinue={continueStep}
              onCancel={canExit ? () => setConfirmDiscard(true) : undefined}
              onFocusField={setActiveField}
              highlighted={highlighted}
              onSubmit={submit}
              onUploadDocument={uploadDocument}
              submitting={sending}
              submitLabel={sending ? "Sending" : "Submit for review"}
            />
            {error && (
              <Notice tone="error" className="mx-auto mt-3 w-full max-w-[540px]">
                {error}
              </Notice>
            )}
          </>
        )}
      </div>

      <div className="h-[75dvh] min-h-[520px] lg:h-full lg:min-h-0">
        <AssistantPanel assistant={assistant} activeField={activeField} onApply={applyProposal} />
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this application?"
        description="Your answers and the assistant chat will be deleted."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        busy={discarding}
        onConfirm={discard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
