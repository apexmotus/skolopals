// Next's global types add the `next: { revalidate, tags }` fetch option used by `sendPublic`.
/// <reference types="next" />
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

  // proxy.ts already redirects a signed-out visit to /login before it reaches a page or
  // action; a 401 here means the session expired mid-request, a case proxy.ts can't catch.
  if (res.status === 401) redirect("/login");
  return parse(res);
}

/** How long a public read stays cached, by how often its data changes. */
export type PublicFreshness = "reference" | "catalogue";
const REVALIDATE_SECONDS: Record<PublicFreshness, number> = {
  reference: 3600, // phases, grades, subjects, operating hours: change a few times a year
  catalogue: 300, // tutors, packages, prices, timetable, programmes: admins edit these
};

/**
 * An anonymous read of a `@Public()` endpoint, kept in Next's data cache and shared by every
 * visitor. It never reads cookies or sends a token, so the response is the same for everyone —
 * never use it for anything that depends on who is asking. The cache is per-app (client and
 * admin each hold their own), so an admin edit shows on the public site within the TTL above.
 */
async function sendPublic(path: string, freshness: PublicFreshness): Promise<Envelope<unknown> | undefined> {
  if (!API_URL) throw new Error("API_URL is not set.");

  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS[freshness], tags: ["api-public"] },
  });
  return parse(res);
}

async function parse(res: Response): Promise<Envelope<unknown> | undefined> {
  if (res.status === 204) return undefined;

  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
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
  /** Anonymous, cached reads of `@Public()` endpoints — see `sendPublic`. */
  public: {
    get: async <T>(path: string, freshness: PublicFreshness = "catalogue") =>
      (await sendPublic(path, freshness))?.data as T,
    getPaged: async <T>(path: string, freshness: PublicFreshness = "catalogue"): Promise<Paged<T>> => {
      const envelope = await sendPublic(path, freshness);
      const meta = envelope?.meta;
      if (!meta) throw new Error(`Expected a paginated response from ${path}, got no "meta".`);
      return { items: (envelope?.data ?? []) as T[], ...meta };
    },
  },
};
