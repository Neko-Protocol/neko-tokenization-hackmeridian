"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { ApplicationFormValues, FieldKey } from "../utils/fields";
import { describeValue } from "../utils/validation";

export interface Proposal {
  field: FieldKey;
  value: unknown;
  reason: string;
}

export interface ChatItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  proposals?: Proposal[];
  error?: string;
}

export interface AssistantDocument {
  path: string;
  name: string;
  size: number;
  mediaType: string;
}

const STORAGE_KEY = "neko-launchpad-assistant";

interface Persisted {
  sessionId: string;
  items: ChatItem[];
}

function loadPersisted(): Persisted | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function savePersisted(value: Persisted | null) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function historyText(item: ChatItem): string {
  const parts = [item.text.trim()];
  if (item.proposals?.length) {
    parts.push(
      `[Suggested values: ${item.proposals
        .map((p) => `${p.field} = ${describeValue(p.field, p.value)}`)
        .join("; ")}]`
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    if (body.message) return body.message;
    if (body.code === "SESSION_CLOSED") return "This assistant session is closed.";
    if (body.code === "STORAGE_NOT_CONFIGURED") return "Document storage isn't configured.";
    if (body.code === "ISSUER_NOT_VERIFIED") return "Your verification must be approved first.";
  } catch {}
  return `Request failed (${res.status}).`;
}

export function useAssistant({
  form,
  activeField,
}: {
  form: ApplicationFormValues;
  activeField: FieldKey | null;
}) {
  const { getAccessToken } = usePrivy();
  // Only rendered client-side after login, so sessionStorage is available.
  const [saved] = useState(loadPersisted);
  const [sessionId] = useState<string>(() => saved?.sessionId ?? crypto.randomUUID());
  const [items, setItems] = useState<ChatItem[]>(() => saved?.items ?? []);
  const [documents, setDocuments] = useState<AssistantDocument[]>([]);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Refs so send() isn't recreated on every keystroke.
  const formRef = useRef(form);
  const activeRef = useRef(activeField);
  formRef.current = form;
  activeRef.current = activeField;

  const authed = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAccessToken();
    if (!token) throw new Error("You're logged out. Log in again.");
    return { Authorization: `Bearer ${token}` };
  }, [getAccessToken]);

  useEffect(() => {
    if (!sessionId || closed) return;
    savePersisted({ sessionId, items });
  }, [sessionId, items, closed]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/assistant/documents?sessionId=${encodeURIComponent(sessionId)}`,
          { headers: await authed() }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { documents: AssistantDocument[] };
        if (!cancelled) setDocuments(body.documents);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, authed]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || closed || !sessionId) return;

      const user: ChatItem = { id: crypto.randomUUID(), role: "user", text: trimmed };
      const reply: ChatItem = { id: crypto.randomUUID(), role: "assistant", text: "" };
      const history = [...items.filter((i) => !i.error || i.text), user];
      setItems([...items, user, reply]);
      setBusy(true);

      const patch = (fn: (item: ChatItem) => ChatItem) =>
        setItems((prev) => prev.map((i) => (i.id === reply.id ? fn(i) : i)));

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authed()) },
          body: JSON.stringify({
            sessionId,
            messages: history
              .map((i) => ({ role: i.role, text: i.role === "user" ? i.text : historyText(i) }))
              .filter((m) => m.text),
            form: formRef.current,
            activeField: activeRef.current,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          if (res.status === 410) setClosed(true);
          throw new Error(await readError(res));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            if (!chunk.startsWith("data: ")) continue;
            const event = JSON.parse(chunk.slice(6)) as
              | { type: "text"; text: string }
              | { type: "tool"; label: string }
              | { type: "proposal"; proposals: Proposal[] }
              | { type: "break" }
              | { type: "error"; message: string }
              | { type: "done" };
            if (event.type === "text") patch((i) => ({ ...i, text: i.text + event.text }));
            else if (event.type === "break")
              patch((i) => (i.text && !i.text.endsWith("\n\n") ? { ...i, text: `${i.text}\n\n` } : i));
            else if (event.type === "tool")
              patch((i) => ({ ...i, steps: [...(i.steps ?? []), event.label] }));
            else if (event.type === "proposal")
              patch((i) => ({ ...i, proposals: [...(i.proposals ?? []), ...event.proposals] }));
            else if (event.type === "error") patch((i) => ({ ...i, error: event.message }));
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        patch((i) => ({
          ...i,
          error: err instanceof Error ? err.message : "Something went wrong.",
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusy(false);
      }
    },
    [authed, busy, closed, items, sessionId]
  );

  const upload = useCallback(
    async (files: FileList | File[]) => {
      if (closed || !sessionId) return;
      setNotice(null);
      for (const file of Array.from(files)) {
        setUploading((n) => n + 1);
        try {
          const data = new FormData();
          data.set("sessionId", sessionId);
          data.set("file", file);
          const res = await fetch("/api/assistant/documents", {
            method: "POST",
            headers: await authed(),
            body: data,
          });
          if (!res.ok) throw new Error(`${file.name}: ${await readError(res)}`);
          const body = (await res.json()) as { document: AssistantDocument };
          setDocuments((prev) => [...prev, body.document]);
        } catch (err) {
          setNotice(err instanceof Error ? err.message : "Upload failed.");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [authed, closed, sessionId]
  );

  const removeDocument = useCallback(
    async (path: string) => {
      setDocuments((prev) => prev.filter((d) => d.path !== path));
      try {
        await fetch("/api/assistant/documents", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...(await authed()) },
          body: JSON.stringify({ sessionId, path }),
        });
      } catch {
        setNotice("Couldn't delete that file. It will be removed when you submit.");
      }
    },
    [authed, sessionId]
  );

  const close = useCallback(async () => {
    abortRef.current?.abort();
    setClosed(true);
    savePersisted(null);
    if (!sessionId) return;
    const res = await fetch("/api/assistant/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(await authed()) },
      body: JSON.stringify({ sessionId, close: true }),
    });
    if (!res.ok) throw new Error(await readError(res));
    setDocuments([]);
  }, [authed, sessionId]);

  return {
    sessionId,
    items,
    documents,
    uploading: uploading > 0,
    busy,
    closed,
    notice,
    dismissNotice: () => setNotice(null),
    send,
    stop: () => abortRef.current?.abort(),
    upload,
    removeDocument,
    close,
  };
}
