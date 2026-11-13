import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";

const API_URL = process.env.API_URL;

type ApiErrorBody = {
  status?: number;
  code?: string;
  detail?: string;
};

/** Every response the API sends — confirmed live against a running instance, not assumed from
 * its docs — is wrapped by its global `ResponseEnvelopeInterceptor`: `{ data }` for a single
 * resource, `{ data, meta }` for a paginated list. */
type Envelope<T> = {
  data: T;
  meta?: { page: number; pageSize: number; totalCount: number; totalPages: number };
};

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function send(path: string, init?: RequestInit): Promise<Envelope<unknown> | undefined> {
  if (!API_URL) throw new Error("API_URL is not set.");

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 204) return undefined;

  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
    // proxy.ts already redirects a signed-out visit to /login before it reaches a page or
    // action; a 401 here means the session expired mid-request, a case proxy.ts can't catch.
    if (res.status === 401) redirect("/login");
    throw new ApiError(res.status, body?.code ?? "UNKNOWN", body?.detail ?? res.statusText);
  }

  return res.json() as Promise<Envelope<unknown>>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const envelope = await send(path, init);
  return envelope?.data as T;
}

async function requestPaged<T>(path: string, init?: RequestInit): Promise<Paged<T>> {
  const envelope = await send(path, init);
  const meta = envelope?.meta;
  if (!meta) throw new Error(`Expected a paginated response from ${path}, got no "meta".`);
  return { items: (envelope?.data ?? []) as T[], ...meta };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getPaged: <T>(path: string) => requestPaged<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
