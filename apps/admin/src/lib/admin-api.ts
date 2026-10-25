import type {
  AdminApplicationView,
  ApplicationStatus,
  ApplicationView,
  Decision,
} from "@/lib/types";

const PROXY_BASE = "/api/backend-proxy";

export interface AdminApiErrorBody {
  code?: string;
  message?: string;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    body: AdminApiErrorBody,
    fallbackMessage: string
  ) {
    super(body.message ?? fallbackMessage);
    this.name = "AdminApiError";
    this.status = status;
    this.code = body.code ?? "UNKNOWN_ERROR";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
};

async function request<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {}
): Promise<T> {
  const url = `${PROXY_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError(
      0,
      { code: "BACKEND_UNREACHABLE" },
      "Backend unreachable"
    );
  }

  if (!res.ok) {
    let errorBody: AdminApiErrorBody = {};
    try {
      errorBody = (await res.json()) as AdminApiErrorBody;
    } catch {
      errorBody = {};
    }
    throw new AdminApiError(
      res.status,
      errorBody,
      `Request failed with status ${res.status}`
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface RequestCodeResult {
  ok: boolean;
  reason?: "not_authorized" | "send_failed";
}

export interface VerifyCodeResult {
  ok: boolean;
  tokenHash?: string;
  reason?: "invalid_code";
}

export function requestAdminCode(email: string): Promise<RequestCodeResult> {
  return request<RequestCodeResult>("/v1/admin-auth/request-code", {
    method: "POST",
    body: { email },
  });
}

export function verifyAdminCode(
  email: string,
  code: string
): Promise<VerifyCodeResult> {
  return request<VerifyCodeResult>("/v1/admin-auth/verify-code", {
    method: "POST",
    body: { email, code },
  });
}

export function listApplications(
  token: string,
  status?: ApplicationStatus
): Promise<ApplicationView[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<ApplicationView[]>(
    `/v1/launchpad/admin/applications${query}`,
    { token }
  );
}

export function getApplication(
  token: string,
  id: string
): Promise<AdminApplicationView> {
  return request<AdminApplicationView>(
    `/v1/launchpad/admin/applications/${encodeURIComponent(id)}`,
    { token }
  );
}

export function decideApplication(
  token: string,
  id: string,
  decision: Decision,
  note?: string
): Promise<AdminApplicationView> {
  return request<AdminApplicationView>(
    `/v1/launchpad/admin/applications/${encodeURIComponent(id)}/decision`,
    {
      method: "POST",
      token,
      body: note !== undefined ? { decision, note } : { decision },
    }
  );
}
