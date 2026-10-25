import "server-only";

import type { ArticleExcerpt } from "@/lib/types";

const FETCH_TIMEOUT_MS = 10_000;
const TEXT_MAX = 600;

interface JsonRpcResponse {
  result?: {
    isError?: boolean;
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: { message?: string };
}

function parseArticleMarkdown(markdown: string): ArticleExcerpt | null {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (lines.length < 2) return null;

  const titleLine = lines[0]?.replace(/^#+\s*/, "").trim() ?? "";
  const citeLine = lines[1] ?? "";

  const citeMatch = citeLine.match(
    /\[cite:\s*([^|]+)\|[^|]*\|[^|]*\|\s*version\s+([^|]+)\|/i
  );
  const id = citeMatch?.[1]?.trim() ?? "";
  const version = citeMatch?.[2]?.trim() ?? "";

  let sourceUrl = "";
  const sourceLine = [...lines].reverse().find((l) => /^Source:\s*/i.test(l));
  if (sourceLine) {
    sourceUrl = sourceLine.replace(/^Source:\s*/i, "").trim();
  }

  const blankIdx = lines.findIndex((l, i) => i >= 2 && l.trim() === "");
  const bodyStart = blankIdx >= 0 ? blankIdx + 1 : 3;
  const bodyLines = lines
    .slice(bodyStart)
    .filter((l) => !/^Source:\s*/i.test(l));
  let text = bodyLines.join("\n").trim();
  if (text.length > TEXT_MAX) {
    text = `${text.slice(0, TEXT_MAX).trimEnd()}...`;
  }

  if (!titleLine && !text) return null;

  return {
    id: id || "unknown",
    title: titleLine || "Untitled article",
    version: version || "unknown",
    text,
    sourceUrl,
  };
}

/**
 * Fetch a single article from the Neko Legal KB MCP connector.
 * Never throws to callers; returns null on any failure.
 */
export async function fetchArticle(
  norm: string,
  article: string
): Promise<ArticleExcerpt | null> {
  const url = process.env.NEKO_LEGAL_KB_URL?.trim();
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_article",
          arguments: { norm, article },
        },
      }),
      signal: controller.signal,
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as JsonRpcResponse;
    if (data.error || data.result?.isError) return null;

    const text = data.result?.content?.[0]?.text;
    if (!text || typeof text !== "string") return null;

    return parseArticleMarkdown(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
