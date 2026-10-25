import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/auth";
import { ASSISTANT_MODEL } from "@/lib/server/assistant";
import { errorResponse } from "../http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    await requireAccount(req);
    const body = (await req.json()) as {
      application?: unknown;
      transcript?: { role: string; text: string }[];
    };
    const transcript = (body.transcript ?? [])
      .slice(-40)
      .map((m) => `${m.role === "user" ? "Issuer" : "Assistant"}: ${String(m.text).slice(0, 2000)}`)
      .join("\n\n");

    const message = await client.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You write short briefs for Neko's tokenization compliance reviewers. Plain prose, at most 120 words, no headings, no em dashes. Cover: what is being tokenized and raised, offering type and investor reach, and any risks or open questions raised in the conversation. Do not invent facts.",
      messages: [
        {
          role: "user",
          content: `Application:\n${JSON.stringify(body.application ?? {})}\n\nConversation with the assistant:\n${transcript || "(none)"}`,
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ summary: null });
    }
    const summary = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .slice(0, 4000);
    return NextResponse.json({ summary: summary || null });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("[assistant] summary failed", err.status, err.message);
      return NextResponse.json({ summary: null });
    }
    return errorResponse(err);
  }
}
