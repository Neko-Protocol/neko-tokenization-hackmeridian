import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

const TIMEOUT_MS = 15_000;
const TOOLS_TTL_MS = 10 * 60_000;
const RESULT_MAX_CHARS = 24_000;

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

let toolsCache: { url: string; tools: McpTool[]; until: number } | null = null;

export function ragUrl(): string | null {
  return (
    process.env.LAUNCHPAD_RAG_URL?.trim() ||
    process.env.NEKO_LEGAL_KB_URL?.trim() ||
    null
  );
}

async function rpc<T>(url: string, method: string, params?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 404) {
      throw new Error("RAG server answered 404: the token in the URL doesn't match the server's");
    }
    if (!res.ok) throw new Error(`RAG server answered ${res.status}`);
    const data = (await res.json()) as JsonRpcResponse<T>;
    if (data.error) throw new Error(data.error.message ?? "RAG error");
    if (data.result === undefined) throw new Error("Empty RAG response");
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

export const RAG_PREFIX = "kb_";

export async function ragTools(): Promise<Anthropic.Beta.BetaTool[]> {
  const url = ragUrl();
  if (!url) return [];
  if (!toolsCache || toolsCache.url !== url || toolsCache.until < Date.now()) {
    try {
      const { tools } = await rpc<{ tools: McpTool[] }>(url, "tools/list");
      toolsCache = { url, tools, until: Date.now() + TOOLS_TTL_MS };
    } catch (err) {
      console.error("[assistant] RAG tools/list failed", err);
      return [];
    }
  }
  return toolsCache.tools
    .map((t) => ({
      name: `${RAG_PREFIX}${t.name}`.slice(0, 64),
      description: `Knowledge base: ${t.description ?? t.name}`,
      input_schema: {
        type: "object" as const,
        ...(t.inputSchema ?? {}),
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function callRagTool(
  prefixedName: string,
  args: Record<string, unknown>
): Promise<{ text: string; isError: boolean }> {
  const url = ragUrl();
  if (!url) return { text: "Knowledge base is not configured.", isError: true };
  const name = prefixedName.slice(RAG_PREFIX.length);
  try {
    const result = await rpc<{
      isError?: boolean;
      content?: { type?: string; text?: string }[];
    }>(url, "tools/call", { name, arguments: args });
    const text = (result.content ?? [])
      .map((c) => (c.type === "text" ? c.text ?? "" : ""))
      .join("\n")
      .slice(0, RESULT_MAX_CHARS);
    return { text: text || "(no results)", isError: Boolean(result.isError) };
  } catch (err) {
    return {
      text: `Knowledge base request failed: ${err instanceof Error ? err.message : "unknown error"}`,
      isError: true,
    };
  }
}
