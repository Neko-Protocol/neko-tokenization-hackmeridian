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

export async function POST(req: NextRequest) {
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

  const application = (body as { application?: AdminApplicationView })
    ?.application;
  if (!application || typeof application !== "object" || !application.id) {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Expected { application }" },
      { status: 400 }
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
