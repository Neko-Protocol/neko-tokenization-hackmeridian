import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SESSION = 8;

export const ALLOWED_TYPES: Record<string, "pdf" | "text" | "image"> = {
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "text",
  "text/csv": "text",
  "application/json": "text",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
};

const EXTENSION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Browsers often send "" or octet-stream for .md/.csv; fall back to the extension. */
export function resolveMediaType(name: string, type: string): string | null {
  if (ALLOWED_TYPES[type]) return type;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

let client: SupabaseClient | null = null;
const bucketsReady = new Map<string, Promise<void>>();

export function bucketName(): string {
  return process.env.LAUNCHPAD_ASSISTANT_BUCKET?.trim() || "launchpad-assistant-docs";
}

function applicationBucketName(): string {
  return process.env.LAUNCHPAD_APPLICATION_BUCKET?.trim() || "launchpad-application-docs";
}

function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("STORAGE_NOT_CONFIGURED");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

async function bucket(name = bucketName(), fileSizeLimit = MAX_FILE_BYTES) {
  const sb = supabase();
  let ready = bucketsReady.get(name);
  if (!ready) {
    ready = (async () => {
      const { data } = await sb.storage.getBucket(name);
      if (data) return;
      const { error } = await sb.storage.createBucket(name, { public: false, fileSizeLimit });
      if (error && !/already exists/i.test(error.message)) throw error;
    })();
    bucketsReady.set(name, ready);
    ready.catch(() => bucketsReady.delete(name));
  }
  await ready;
  return sb.storage.from(name);
}

// Files attached to the application itself. Unlike assistant uploads they are
// kept, so reviewers can open them from the application's document links.
export const MAX_APPLICATION_FILE_BYTES = 20 * 1024 * 1024;
const LINK_TTL_SECONDS = 60 * 60 * 24 * 365;

const APPLICATION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

export function applicationMediaType(name: string): string | null {
  return APPLICATION_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export async function uploadApplicationDocument(
  accountId: string,
  file: File,
  mediaType: string
): Promise<{ name: string; url: string }> {
  const store = await bucket(applicationBucketName(), MAX_APPLICATION_FILE_BYTES);
  const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || "file";
  const path = `${accountId}/${crypto.randomUUID()}__${safe}`;
  const { error } = await store.upload(path, file, { contentType: mediaType, upsert: false });
  if (error) throw error;
  const { data, error: signError } = await store.createSignedUrl(path, LINK_TTL_SECONDS);
  if (signError || !data) throw signError ?? new Error("SIGN_FAILED");
  return { name: safe, url: data.signedUrl };
}

const SESSION_ID = /^[0-9a-f-]{36}$/i;

// Per server instance only; the client also locks the chat.
const closedSessions = new Set<string>();

export function closeSession(prefix: string) {
  closedSessions.add(prefix);
}

export function isSessionClosed(prefix: string): boolean {
  return closedSessions.has(prefix);
}

export function sessionPrefix(accountId: string, sessionId: string): string {
  if (!SESSION_ID.test(sessionId)) throw new Error("INVALID_SESSION");
  return `${accountId}/${sessionId}`;
}

export interface StoredDocument {
  path: string;
  name: string;
  size: number;
  mediaType: string;
}

function toDocument(prefix: string, file: { name: string; metadata?: Record<string, unknown> | null }): StoredDocument {
  const [, ...rest] = file.name.split("__");
  return {
    path: `${prefix}/${file.name}`,
    name: rest.join("__") || file.name,
    size: Number(file.metadata?.size ?? 0),
    mediaType: String(file.metadata?.mimetype ?? ""),
  };
}

export async function listDocuments(prefix: string): Promise<StoredDocument[]> {
  const store = await bucket();
  const { data, error } = await store.list(prefix, {
    limit: 100,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (error) throw error;
  return (data ?? []).filter((f) => f.id).map((f) => toDocument(prefix, f));
}

export async function uploadDocument(
  prefix: string,
  file: File,
  mediaType: string
): Promise<StoredDocument> {
  const store = await bucket();
  const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120) || "file";
  const path = `${prefix}/${crypto.randomUUID().slice(0, 8)}__${safe}`;
  const { error } = await store.upload(path, file, {
    contentType: mediaType,
    upsert: false,
  });
  if (error) throw error;
  return { path, name: safe, size: file.size, mediaType };
}

export async function downloadDocument(path: string): Promise<Buffer> {
  const store = await bucket();
  const { data, error } = await store.download(path);
  if (error || !data) throw error ?? new Error("DOWNLOAD_FAILED");
  return Buffer.from(await data.arrayBuffer());
}

export async function removeDocuments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const store = await bucket();
  const { error } = await store.remove(paths);
  if (error) throw error;
}
