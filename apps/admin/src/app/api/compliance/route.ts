import { NextRequest, NextResponse } from "next/server";

import { evaluateCompliance } from "@/features/compliance/rules";
import { fetchArticle } from "@/features/compliance/legal-kb";
import type {
  AdminApplicationView,
  EnrichedCitation,
  EnrichedComplianceCheck,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

async function proxyBackendJson(res: Response): Promise<NextResponse> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "text/plain",
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const token = parseBearerToken(req);
  if (!token) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const raw = await req.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { code: "PAYLOAD_TOO_LARGE", message: "Body larger than 100 KB" },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const id =
    body !== null &&
    typeof body === "object" &&
    "id" in body &&
    typeof (body as { id: unknown }).id === "string"
      ? (body as { id: string }).id
      : null;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Expected { id: uuid }" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.BACKEND_URL;
  const key = process.env.BACKEND_INTERNAL_KEY;
  if (!baseUrl || !key) {
    return NextResponse.json(
      { code: "BACKEND_PROXY_MISCONFIGURED" },
      { status: 500 }
    );
  }

  const authorization = `Bearer ${token}`;
  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/v1/launchpad/admin/applications/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          "X-Internal-Key": key,
          Authorization: authorization,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json({ code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }

  if (!upstream.ok) {
    return proxyBackendJson(upstream);
  }

  let application: AdminApplicationView;
  try {
    application = (await upstream.json()) as AdminApplicationView;
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_BACKEND_RESPONSE",
        message: "Invalid JSON from backend",
      },
      { status: 502 }
    );
  }

  const checks = evaluateCompliance(application);

  const uniqueKeys = new Map<string, { norm: string; article: string }>();
  for (const check of checks) {
    for (const cite of check.citations) {
      const key = `${cite.norm}::${cite.article}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, { norm: cite.norm, article: cite.article });
      }
    }
  }

  const fetched = await Promise.all(
    [...uniqueKeys.entries()].map(async ([key, { norm, article }]) => {
      const excerpt = await fetchArticle(norm, article);
      return [key, excerpt] as const;
    })
  );
  const byKey = new Map(fetched);

  const enriched: EnrichedComplianceCheck[] = checks.map((check) => ({
    ...check,
    citations: check.citations.map((cite): EnrichedCitation => {
      const key = `${cite.norm}::${cite.article}`;
      const excerpt = byKey.get(key);
      if (!excerpt) {
        return { norm: cite.norm, article: cite.article, unavailable: true };
      }
      return {
        norm: cite.norm,
        article: cite.article,
        id: excerpt.id,
        title: excerpt.title,
        version: excerpt.version,
        text: excerpt.text,
        sourceUrl: excerpt.sourceUrl,
      };
    }),
  }));

  return NextResponse.json({ checks: enriched });
}
