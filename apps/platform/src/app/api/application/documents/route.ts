import { NextRequest, NextResponse } from "next/server";
import { requireAccount } from "@/lib/server/auth";
import {
  MAX_APPLICATION_FILE_BYTES,
  applicationMediaType,
  uploadApplicationDocument,
} from "@/lib/server/storage";
import { errorResponse } from "../../assistant/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ code: "FILE_REQUIRED" }, { status: 400 });
    }
    if (file.size > MAX_APPLICATION_FILE_BYTES) {
      return NextResponse.json(
        { code: "FILE_TOO_LARGE", message: "Files can be up to 20 MB." },
        { status: 413 }
      );
    }
    const mediaType = applicationMediaType(file.name);
    if (!mediaType) {
      return NextResponse.json(
        {
          code: "UNSUPPORTED_TYPE",
          message: "Use PDF, Word, Excel, CSV, TXT or an image.",
        },
        { status: 415 }
      );
    }
    const document = await uploadApplicationDocument(account.account.id, file, mediaType);
    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
