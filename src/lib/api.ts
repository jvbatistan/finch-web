const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_CHANGING_PATHS = new Set([
  "/api/login",
  "/api/register",
  "/api/logout",
  "/api/data_environment/switch",
]);

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function responseError(res: Response): Promise<Error> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");
  const message =
    (typeof payload === "string" ? payload : payload?.error || payload?.message) ||
    `HTTP ${res.status}`;
  return new Error(message);
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  if (!csrfRequest) {
    csrfRequest = (async () => {
      const res = await fetch("/api/csrf", {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw await responseError(res);

      const payload: unknown = await res.json();
      if (
        typeof payload !== "object" || payload === null ||
        !("csrf_token" in payload) || typeof payload.csrf_token !== "string" ||
        payload.csrf_token.length === 0
      ) {
        throw new Error("Token CSRF indisponível");
      }

      csrfToken = payload.csrf_token;
      return csrfToken;
    })().finally(() => {
      csrfRequest = null;
    });
  }

  return csrfRequest;
}

export async function api(path: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  if (!SAFE_METHODS.has(method)) headers.set("x-csrf-token", await getCsrfToken());

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) csrfToken = null;
    throw await responseError(res);
  }

  if (SESSION_CHANGING_PATHS.has(path) && !SAFE_METHODS.has(method)) csrfToken = null;

  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}
