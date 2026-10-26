"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  FileText,
  Image as ImageIcon,
  Lock,
  Paperclip,
  Search,
  Square,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { FIELD_BY_KEY, type FieldKey } from "../../utils/fields";
import { describeValue } from "../../utils/validation";
import type { ChatItem, Proposal, useAssistant } from "../../hooks/useAssistant";
import { ChatMarkdown } from "./ChatMarkdown";

type Assistant = ReturnType<typeof useAssistant>;

const HELP_STEP = "Help me answer this step";

function suggestions(field: FieldKey | null): string[] {
  const general = ["Pre-fill the form from my documents", "Which documents should I include?"];
  if (!field) return [...general, "Which rules apply in Costa Rica?", "What happens after I submit?"];
  const label = FIELD_BY_KEY.get(field)!.label.toLowerCase();
  const typical =
    field === "documents" ? "Which documents should I include?" : `What's a typical ${label}?`;
  return [HELP_STEP, typical, ...general];
}

function ProposalCard({
  item,
  decisions,
  onApply,
  onDismiss,
  disabled,
}: {
  item: ChatItem;
  decisions: Record<string, "applied" | "dismissed">;
  onApply: (key: string, p: Proposal) => void;
  onDismiss: (key: string) => void;
  disabled: boolean;
}) {
  const proposals = item.proposals ?? [];
  const pending = proposals
    .map((p, i) => ({ p, key: `${item.id}:${i}` }))
    .filter(({ key }) => !decisions[key]);

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="text-[12px] text-white/45">Suggested answers</span>
        {pending.length > 1 && !disabled && (
          <button
            type="button"
            onClick={() => pending.forEach(({ p, key }) => onApply(key, p))}
            className="text-[12px] font-medium text-[#229EDF] hover:text-[#5bb9ea]"
          >
            Apply all
          </button>
        )}
      </div>
      <ul className="flex flex-col px-3.5 pb-1">
        {proposals.map((p, i) => {
          const key = `${item.id}:${i}`;
          const state = decisions[key];
          return (
            <li
              key={key}
              className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-white/40">{FIELD_BY_KEY.get(p.field)?.label}</p>
                <p className="break-words text-[14px] text-white">
                  {describeValue(p.field, p.value) || "Empty"}
                </p>
                {p.reason && <p className="text-[12px] text-white/35">{p.reason}</p>}
              </div>
              {state === "applied" ? (
                <span className="inline-flex items-center gap-1 text-[12px] text-[#7fe3a6]">
                  <Check className="h-3.5 w-3.5" /> Applied
                </span>
              ) : state === "dismissed" ? (
                <span className="text-[12px] text-white/30">Skipped</span>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Skip"
                    disabled={disabled}
                    onClick={() => onDismiss(key)}
                    className="rounded-full p-1.5 text-white/35 hover:bg-white/5 hover:text-white disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onApply(key, p)}
                    className="h-7 rounded-full bg-[#229EDF] px-3 text-[12px] font-medium text-white hover:bg-[#1a8bc7] disabled:opacity-40"
                  >
                    Apply
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AssistantPanel({
  assistant,
  activeField,
  onApply,
}: {
  assistant: Assistant;
  activeField: FieldKey | null;
  onApply: (p: Proposal) => boolean;
}) {
  const { items, busy, closed, documents, uploading } = assistant;
  const [draft, setDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "applied" | "dismissed">>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const active = activeField ? FIELD_BY_KEY.get(activeField) : null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [items]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = (text: string) => {
    if (!text.trim() || busy || closed) return;
    assistant.send(text);
    setDraft("");
  };

  const ask = (q: string) =>
    submit(q === HELP_STEP && active ? `Help me answer: "${active.question}"` : q);

  const apply = (key: string, p: Proposal) => {
    const ok = onApply(p);
    setDecisions((d) => ({ ...d, [key]: ok ? "applied" : "dismissed" }));
  };

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#171717]"
      onDragOver={(e) => {
        if (closed || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!closed && e.dataTransfer.files.length) assistant.upload(e.dataTransfer.files);
      }}
    >
      <header className="flex h-12 shrink-0 items-center px-5">
        <span className="text-[13px] text-white/50">Assistant</span>
      </header>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-7 py-8 text-center">
            <h2 className="text-[26px] font-medium leading-[1.2] tracking-tight text-white/90">
              Your tokenization{" "}
              <span className="font-serif text-[28px] font-normal italic text-white">assistant</span>
              <br />
              is ready to help.
            </h2>
            {!closed && (
              <div className="flex max-w-[400px] flex-wrap justify-center gap-2">
                {suggestions(activeField).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-lg bg-[#229EDF]/10 px-3 py-1.5 text-[13px] text-[#9ccfee] transition-colors hover:bg-[#229EDF]/20 hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          items.map((item) =>
            item.role === "user" ? (
              <div
                key={item.id}
                className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.07] px-3.5 py-2 text-[14px] text-white"
              >
                {item.text}
              </div>
            ) : (
              <div key={item.id} className="flex flex-col gap-3 text-[14px] leading-relaxed text-white/75">
                {item.steps?.map((step, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[12px] text-white/35">
                    <Search className="h-3 w-3" /> {step}
                  </span>
                ))}
                {item.text && <ChatMarkdown text={item.text} />}
                {item.proposals?.length ? (
                  <ProposalCard
                    item={item}
                    decisions={decisions}
                    disabled={closed}
                    onApply={apply}
                    onDismiss={(key) => setDecisions((d) => ({ ...d, [key]: "dismissed" }))}
                  />
                ) : null}
                {!item.text && !item.proposals?.length && !item.error && busy && (
                  <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                )}
                {item.error && <p className="text-[13px] text-[#ff8a83]">{item.error}</p>}
              </div>
            )
          )
        )}
      </div>

      {closed ? (
        <div className="m-3 flex items-start gap-2.5 rounded-xl bg-white/[0.03] px-4 py-3 text-[13px] text-white/50">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>This conversation is closed and the files you shared were deleted.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {assistant.notice && (
            <div className="flex items-center gap-3 rounded-xl bg-[#ff3b30]/10 px-4 py-2.5 text-[13px] text-[#ff8a83]">
              <p className="flex-1">{assistant.notice}</p>
              <button type="button" aria-label="Dismiss" onClick={assistant.dismissNotice}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {items.length > 0 && active && !busy && (
            <button
              type="button"
              onClick={() => ask(HELP_STEP)}
              className="self-start truncate px-1 text-left text-[12px] text-white/40 hover:text-white"
            >
              Help with &ldquo;{active.question}&rdquo;
            </button>
          )}

          <div className="flex flex-col rounded-2xl border border-white/10 bg-[#121212] transition-colors focus-within:border-white/25">
            {(documents.length > 0 || uploading) && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                {documents.map((doc) => (
                  <span
                    key={doc.path}
                    title={doc.name}
                    className="inline-flex max-w-[200px] items-center gap-1.5 rounded-lg bg-white/[0.06] py-1 pl-2 pr-1 text-[12px] text-white/70"
                  >
                    {doc.mediaType.startsWith("image/") ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    )}
                    <span className="truncate">{doc.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${doc.name}`}
                      onClick={() => assistant.removeDocument(doc.path)}
                      className="rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {uploading && (
                  <span className="inline-flex items-center gap-1.5 px-1 text-[12px] text-white/40">
                    <Spinner className="h-3 w-3" /> Uploading
                  </span>
                )}
              </div>
            )}
            <textarea
              ref={textRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Ask anything..."
              className="max-h-40 min-h-11 resize-none bg-transparent px-4 pt-3 text-[14px] text-white outline-none placeholder:text-white/30"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                type="button"
                aria-label="Attach files"
                title="PDF, text or images, up to 10 MB each"
                onClick={() => fileRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/5 hover:text-white"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif"
                onChange={(e) => {
                  if (e.target.files?.length) assistant.upload(e.target.files);
                  e.target.value = "";
                }}
              />
              {busy ? (
                <button
                  type="button"
                  aria-label="Stop"
                  onClick={assistant.stop}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Send"
                  disabled={!draft.trim()}
                  onClick={() => submit(draft)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                    draft.trim()
                      ? "bg-[#229EDF] text-white hover:bg-[#1a8bc7]"
                      : "bg-white/[0.06] text-white/30"
                  )}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border border-dashed border-[#229EDF]/60 bg-[#121212]/90 text-[14px] text-white">
          Drop files to share them with the assistant
        </div>
      )}
    </section>
  );
}
