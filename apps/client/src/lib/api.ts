export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";

export interface Meta { total: number; page: number; limit: number; pages: number }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path?: string; message: string }[]) { super(message); }
}

const KEYS = { csrf: "km_csrf_token", business: "km_business" };
export const session = {
  csrf: () => sessionStorage.getItem(KEYS.csrf) ?? "",
  setCsrf: (v: string | null) => (v ? sessionStorage.setItem(KEYS.csrf, v) : sessionStorage.removeItem(KEYS.csrf)),
  business: () => localStorage.getItem(KEYS.business),
  setBusiness: (v: string | null) => (v ? localStorage.setItem(KEYS.business, v) : localStorage.removeItem(KEYS.business)),
};

function headers(extra?: Record<string, string>, tenant = true) {
  const h: Record<string, string> = { Accept: "application/json", ...extra };
  const csrf = session.csrf(); if (csrf) h["x-csrf-token"] = csrf;
  const b = session.business(); if (tenant && b) h["x-business-id"] = b;
  return h;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string; details?: { path?: string; message: string }[] } } = {};
  try { body = await res.json(); } catch { /* corps vide */ }
  if (res.status === 401) window.dispatchEvent(new Event("km:unauthorized"));
  return new ApiError(res.status, body.error?.code ?? "ERROR", body.error?.message ?? "Une erreur est survenue. Reessayez.", body.error?.details);
}

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, opts: { idempotencyKey?: string; tenant?: boolean } = {}): Promise<{ data: T; meta?: Meta }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, credentials: "include",
      headers: headers({ ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}) }, opts.tenant),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Impossible de joindre le serveur. Verifiez votre connexion.");
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return { data: undefined as T };
  return res.json() as Promise<{ data: T; meta?: Meta }>;
}

export const get = <T>(p: string) => api<T>("GET", p);
export const qs = (params: Record<string, unknown>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString(); return s ? `?${s}` : "";
};

/** Telechargement authentifie (exports CSV / Excel / PDF). */
export async function download(path: string, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() });
  if (!res.ok) throw await parseError(res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function upload(file: File): Promise<{ id: string }> {
  const fd = new FormData(); fd.append("file", file);
  const res = await fetch(`${API_BASE}/uploads`, { method: "POST", credentials: "include", headers: headers(), body: fd });
  if (!res.ok) throw await parseError(res);
  return (await res.json()).data;
}
export const fileUrl = (id: string) => `${API_BASE}/uploads/${id}`;
export const newKey = () => crypto.randomUUID();
