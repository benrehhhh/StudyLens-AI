import { clearStoredUser } from "./authStorage";

const CSRF_COOKIE_NAME = "studylens_csrf";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const NO_REFRESH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-email-code",
  "/api/auth/verify-2fa",
  "/api/auth/resend-2fa",
  "/api/auth/refresh",
  "/api/auth/reset-otp",
  "/api/auth/verify-reset-otp",
  "/api/auth/reset-password",
  "/api/auth/logout",
  "/api/auth/logout-all",
];

let csrfToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let _loggedOut = false;

export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

const readCookie = (name: string): string | null => {
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  } catch {
    return null;
  }
};

export const authHeaders = (extra?: Record<string, string>, method?: string): Record<string, string> => {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (method && UNSAFE_METHODS.has(method.toUpperCase())) {
    const token = readCookie(CSRF_COOKIE_NAME) ?? csrfToken;
    if (token) headers["X-CSRF-Token"] = token;
  }
  return headers;
};

const expireSession = () => {
  if (_loggedOut) return;
  _loggedOut = true;
  clearStoredUser();
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
  setTimeout(() => { _loggedOut = false; }, 5000);
};

const tryRefreshSession = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) return false;
        const data = await response.json().catch(() => null);
        if (typeof data?.csrfToken === "string") {
          setCsrfToken(data.csrfToken);
        }
        _loggedOut = false;
        return true;
      } catch {
        return false;
      }
    })();
  }
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const shouldAttemptRefresh = (url: string) =>
  !NO_REFRESH_PATHS.some((path) => url.startsWith(path));

const isExpiredSessionResponse = async (response: Response) => {
  const data = await response.clone().json().catch(() => null);
  return data?.code === "INVALID_TOKEN" || data?.code === "AUTH_REQUIRED";
};

export const authFetch = async (
  url: string,
  options?: RequestInit,
  retried = false,
): Promise<Response> => {
  const method = options?.method || "GET";
  const headers = new Headers(options?.headers);
  headers.delete("X-CSRF-Token");
  const token = readCookie(CSRF_COOKIE_NAME) ?? csrfToken;
  if (token && UNSAFE_METHODS.has(method.toUpperCase())) {
    headers.set("X-CSRF-Token", token);
  }

  const response = await fetch(url, { ...options, credentials: "include", headers });
  if (response.status !== 401) return response;
  if (!(await isExpiredSessionResponse(response))) return response;

  if (!retried && shouldAttemptRefresh(url) && await tryRefreshSession()) {
    return authFetch(url, options, true);
  }

  expireSession();
  return response;
};
