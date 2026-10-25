import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/auth";
import { forgetDocuments } from "@/lib/server/assistant";
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SESSION,
  closeSession,
  isSessionClosed,
  listDocuments,
  removeDocuments,
  resolveMediaType,
  sessionPrefix,
  uploadDocument,
} from "@/lib/server/storage";
import { errorResponse } from "../http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const prefix = sessionPrefix(
      account.account.id,
      req.nextUrl.searchParams.get("sessionId") ?? ""
    );
    return NextResponse.json({ documents: await listDocuments(prefix) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const form = await req.formData();
    const prefix = sessionPrefix(account.account.id, String(form.get("sessionId") ?? ""));
    if (isSessionClosed(prefix)) {
      return NextResponse.json({ code: "SESSION_CLOSED" }, { status: 410 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ code: "FILE_REQUIRED" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { code: "FILE_TOO_LARGE", message: "Files can be up to 10 MB." },
        { status: 413 }
      );
    }
    const mediaType = resolveMediaType(file.name, file.type);
    if (!mediaType) {
      return NextResponse.json(
        {
          code: "UNSUPPORTED_TYPE",
          message: "Use PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP or GIF. Export Word files as PDF.",
        },
        { status: 415 }
      );
    }
    const existing = await listDocuments(prefix);
    if (existing.length >= MAX_FILES_PER_SESSION) {
      return NextResponse.json(
        { code: "TOO_MANY_FILES", message: `Up to ${MAX_FILES_PER_SESSION} files per application.` },
        { status: 409 }
      );
    }
    const document = await uploadDocument(prefix, file, mediaType);
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
      path?: string;
      close?: boolean;
    };
    const prefix = sessionPrefix(account.account.id, body.sessionId ?? "");
    const all = await listDocuments(prefix);
    const targets = body.path ? all.filter((d) => d.path === body.path) : all;
    const paths = targets.map((d) => d.path);
    await removeDocuments(paths);
    forgetDocuments(paths);
    if (body.close) closeSession(prefix);
    return NextResponse.json({ deleted: paths.length });
  } catch (err) {
    return errorResponse(err);
  }
}
