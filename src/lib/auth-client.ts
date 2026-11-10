import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";
import { API_BASE } from "./api";

/**
 * Better Auth browser client. The frontend and API are different sites, so we
 * never rely on cookies: sign-in returns a bearer token in `set-auth-token`,
 * which we store in the device profile and send as `Authorization: Bearer`.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE,
  basePath: "/api/auth",
  plugins: [usernameClient()],
  // Resolve fetch at call time so tests and polyfills can replace it.
  fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) },
});

export interface ServerSession {
  token: string;
  crew_id: string;
  name: string;
  username: string | null;
  role: string;
  expires_at: string;
  provenance: string;
  demo: boolean;
}

export interface ServerUser {
  name?: string | null;
  username?: string | null;
  crew_id?: string | null;
  role?: string | null;
  provenance?: string | null;
  demo?: boolean | null;
}

export interface ServerSessionBody {
  user: ServerUser;
  session: { expiresAt: string | Date; id?: string };
}

function toServerSession(token: string, body: ServerSessionBody | null): ServerSession | null {
  if (!body?.user || !body.session) return null;
  const { user, session } = body;
  if (!user.crew_id) return null;
  return {
    token,
    crew_id: user.crew_id,
    name: user.name ?? "Crew member",
    username: user.username ?? null,
    role: user.role ?? "astronaut",
    expires_at: new Date(session.expiresAt).toISOString(),
    provenance: user.provenance ?? "real",
    demo: user.demo === true,
  };
}

function bearer(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** A stalled connection must not freeze the session for the rest of the visit. */
function sessionSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(8000)
    : undefined;
}

/** Reads the live session for a bearer token, renewing it when due. */
export async function fetchServerSession(token: string): Promise<ServerSession | null> {
  const { data, error } = await authClient.getSession({
    fetchOptions: { ...bearer(token), signal: sessionSignal() },
  });
  if (error || !data) return null;
  return toServerSession(token, data as unknown as ServerSessionBody);
}

export class AuthFailure extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.name = "AuthFailure";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Signs in with username and password and returns the bearer token. */
export async function passwordSignIn(
  username: string,
  password: string,
  options: { shared?: boolean } = {}
): Promise<{ token: string; session: ServerSession }> {
  let token = "";
  let retryAfter: number | null = null;
  const { data, error } = await authClient.signIn.username(
    { username, password },
    {
      headers: options.shared ? { "X-Shared-Device": "1" } : {},
      onSuccess: ({ response }) => {
        token = response.headers.get("set-auth-token") ?? "";
      },
      onError: ({ response }) => {
        const value = Number(response.headers.get("Retry-After"));
        retryAfter = Number.isFinite(value) && value > 0 ? value : null;
      },
    }
  );
  if (error) {
    const status = error.status ?? 0;
    if (status === 429) {
      throw new AuthFailure(429, "Too many tries. Wait a minute and try again.", (retryAfter ?? 5) * 1000);
    }
    if (status === 404) throw new AuthFailure(404, "Demo login is switched off on this server.");
    if (status === 401) throw new AuthFailure(401, "That username or password did not work.");
    throw new AuthFailure(status, error.message ?? "Something went wrong. Try again.");
  }
  if (!token) throw new AuthFailure(0, "Signed in, but the server sent no session token.");
  const user = (data as { user?: ServerUser } | null)?.user ?? null;
  const fromServer = await fetchServerSession(token).catch(() => null);
  const session =
    fromServer ??
    toServerSession(token, user ? { user, session: { expiresAt: new Date(Date.now() + 86_400_000).toISOString() } } : null);
  if (!session) throw new AuthFailure(0, "Signed in, but the session could not be read.");
  return { token, session };
}

/** Revokes the session on the server; safe to call while offline. */
export async function remoteSignOut(token: string): Promise<void> {
  await authClient.signOut({ fetchOptions: bearer(token) }).catch(() => undefined);
}

/** Redeems an access code, creating the username/password login and signing in. */
export async function redeemAccessCode(
  code: string,
  username: string,
  password: string,
  options: { shared?: boolean } = {}
): Promise<{ token: string; session: ServerSession }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/redeem-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(options.shared ? { "X-Shared-Device": "1" } : {}) },
      body: JSON.stringify({ code, username, password }),
    });
  } catch {
    throw new AuthFailure(0, "Can't reach the server. Check the connection and try again. Your code has not been used.");
  }
  if (res.status === 401) throw new AuthFailure(401, "That code did not work. Check it and try again.");
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new AuthFailure(409, body?.error ?? "That username is taken. Pick another one.");
  }
  if (res.status === 400) throw new AuthFailure(400, "Use a username of 3–30 letters or digits, and a password of at least 8 characters.");
  if (res.status === 429) throw new AuthFailure(429, "Too many tries. Wait a minute and try again.");
  if (!res.ok) throw new AuthFailure(res.status, "Something went wrong. Try again.");
  const body = (await res.json()) as { token?: string } & Partial<ServerSession>;
  if (!body.token) throw new AuthFailure(0, "Signed in, but the server sent no session token.");
  const session = await fetchServerSession(body.token).catch(() => null);
  if (!session) throw new AuthFailure(0, "Signed in, but the session could not be read.");
  return { token: body.token, session };
}
