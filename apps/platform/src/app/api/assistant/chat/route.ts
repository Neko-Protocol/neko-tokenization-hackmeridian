import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/auth";
import {
  ASSISTANT_MODEL,
  PROPOSE_TOOL,
  PROPOSE_TOOL_DEF,
  SYSTEM_PROMPT,
  documentBlocks,
  formContext,
  parseProposals,
} from "@/lib/server/assistant";
import { RAG_PREFIX, callRagTool, ragTools } from "@/lib/server/rag";
import { isSessionClosed, listDocuments, sessionPrefix } from "@/lib/server/storage";
import {
  emptyForm,
  isFieldKey,
  type ApplicationFormValues,
} from "@/features/application/utils/fields";
import { errorResponse } from "../http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_TURNS = 60;
const MAX_TEXT = 8000;
const MAX_TOOL_ROUNDS = 8;

type ChatTurn = { role: "user" | "assistant"; text: string };

interface ChatBody {
  sessionId?: string;
  messages?: ChatTurn[];
  form?: ApplicationFormValues;
  activeField?: string | null;
}

const client = new Anthropic();

function toolLabel(name: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  const query = typeof args.query === "string" ? `: "${args.query}"` : "";
  switch (name.slice(RAG_PREFIX.length)) {
    case "search_law":
      return `Searching the law${query}`;
    case "search_kb":
      return `Searching compliance guides${query}`;
    case "get_article":
      return `Reading ${String(args.norm ?? "")} art. ${String(args.article ?? "")}`;
    case "get_document":
      return "Reading a compliance guide";
    default:
      return "Checking the knowledge base";
  }
}

export async function POST(req: NextRequest) {
  let account;
  let body: ChatBody;
  let prefix: string;
  try {
    account = await requireAccount(req);
    body = (await req.json()) as ChatBody;
    prefix = sessionPrefix(account.account.id, body.sessionId ?? "");
  } catch (err) {
    return errorResponse(err);
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      {
        code: "ASSISTANT_NOT_CONFIGURED",
        message: "The assistant isn't configured: set ANTHROPIC_API_KEY in apps/platform/.env.local.",
      },
      { status: 500 }
    );
  }

  if (isSessionClosed(prefix)) {
    return NextResponse.json({ code: "SESSION_CLOSED" }, { status: 410 });
  }

  const turns = (body.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim()
  );
  if (turns.length === 0 || turns.length > MAX_TURNS || turns.at(-1)?.role !== "user") {
    return NextResponse.json({ code: "INVALID_MESSAGES" }, { status: 400 });
  }
  if (turns.some((m) => m.text.length > MAX_TEXT)) {
    return NextResponse.json({ code: "MESSAGE_TOO_LONG" }, { status: 413 });
  }

  const form = { ...emptyForm(), ...(body.form ?? {}) };
  const activeField = isFieldKey(body.activeField) ? body.activeField : null;

  let docs: Awaited<ReturnType<typeof documentBlocks>> = [];
  try {
    docs = await documentBlocks(await listDocuments(prefix));
  } catch (err) {
    console.error("[assistant] documents unavailable", err);
  }

  // Documents on the first turn, live form context on the last: keeps the prefix cacheable.
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((turn, i) => {
    if (turn.role === "assistant") return { role: "assistant", content: turn.text };
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (i === 0) content.push(...docs);
    content.push({ type: "text", text: turn.text });
    if (i === turns.length - 1) {
      content.push({ type: "text", text: formContext(form, activeField) });
    }
    return { role: "user", content };
  });

  const tools = [PROPOSE_TOOL_DEF, ...(await ragTools())];
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = client.beta.messages.stream(
            {
              model: ASSISTANT_MODEL,
              max_tokens: 16000,
              system: [
                { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              ],
              messages,
              tools,
              thinking: { type: "adaptive" },
              output_config: { effort: "medium" },
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            },
            { signal: req.signal }
          );

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "text", text: event.delta.text });
            }
          }

          const message = await response.finalMessage();

          if (message.stop_reason === "refusal") {
            send({
              type: "error",
              message: "I can't help with that one. Try rephrasing your question.",
            });
            break;
          }

          const toolUses = message.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
          );
          // max_tokens may have cut a tool input short.
          if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

          messages.push({ role: "assistant", content: message.content });

          const results = await Promise.all(
            toolUses.map(async (use): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
              if (use.name === PROPOSE_TOOL) {
                const proposals = parseProposals(use.input);
                if (!proposals) {
                  return {
                    type: "tool_result",
                    tool_use_id: use.id,
                    is_error: true,
                    content: "Invalid input: expected { proposals: [{ field, value, reason }] } with field keys from the form.",
                  };
                }
                send({ type: "proposal", id: use.id, proposals });
                return {
                  type: "tool_result",
                  tool_use_id: use.id,
                  content: "Shown to the issuer with Apply buttons. They decide whether to apply each value.",
                };
              }
              if (use.name.startsWith(RAG_PREFIX)) {
                send({ type: "tool", label: toolLabel(use.name, use.input) });
                const input =
                  use.input && typeof use.input === "object"
                    ? (use.input as Record<string, unknown>)
                    : {};
                const result = await callRagTool(use.name, input);
                return {
                  type: "tool_result",
                  tool_use_id: use.id,
                  is_error: result.isError,
                  content: result.text,
                };
              }
              return {
                type: "tool_result",
                tool_use_id: use.id,
                is_error: true,
                content: `Unknown tool ${use.name}`,
              };
            })
          );
          messages.push({ role: "user", content: results });
          send({ type: "break" });
        }
        send({ type: "done" });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[assistant] chat failed", err);
          const message =
            err instanceof Anthropic.RateLimitError
              ? "The assistant is busy right now. Try again in a moment."
              : err instanceof Anthropic.AuthenticationError
                ? "The assistant isn't configured (missing Anthropic API key)."
                : err instanceof Anthropic.APIError
                  ? `The assistant request failed (${err.status ?? "network"}). Try again.`
                  : "Something went wrong talking to the assistant. Try again.";
          send({ type: "error", message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
