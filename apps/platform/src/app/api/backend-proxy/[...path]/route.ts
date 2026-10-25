import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_PREFIX = "v1/launchpad/";
const BLOCKED_PREFIX = "v1/launchpad/webhooks/";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

async function forward(
  req: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  const baseUrl = process.env.BACKEND_URL;
  const key = process.env.BACKEND_INTERNAL_KEY;
  if (!baseUrl || !key) {
    return NextResponse.json(
      { code: "BACKEND_PROXY_MISCONFIGURED" },
      { status: 500 }
    );
  }

  const path = pathSegments.map(encodeURIComponent).join("/");
  if (!path.startsWith(ALLOWED_PREFIX) || path.startsWith(BLOCKED_PREFIX)) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }

  const headers: Record<string, string> = { "X-Internal-Key": key };
  for (const name of [
    "content-type",
    "accept",
    "x-claim-token",
    "authorization",
  ]) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/${path}${req.nextUrl.search}`,
      {
        method: req.method,
        headers,
        body: hasBody ? await req.arrayBuffer() : undefined,
        redirect: "manual",
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json({ code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP.has(name.toLowerCase())) responseHeaders.set(name, value);
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return forward(req, path);
}
