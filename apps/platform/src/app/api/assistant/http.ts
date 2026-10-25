import { NextResponse } from "next/server";
import { AuthError } from "@/lib/server/auth";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ code: err.code }, { status: err.status });
  }
  if (err instanceof Error && err.message === "STORAGE_NOT_CONFIGURED") {
    return NextResponse.json({ code: "STORAGE_NOT_CONFIGURED" }, { status: 500 });
  }
  if (err instanceof Error && err.message === "INVALID_SESSION") {
    return NextResponse.json({ code: "INVALID_SESSION" }, { status: 400 });
  }
  console.error("[assistant]", err);
  return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
}
