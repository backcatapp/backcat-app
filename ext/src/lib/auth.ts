/** OIDC PKCE against Keycloak public client `backcat-ext`. */

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  id_token?: string;
};

const STORAGE_KEY = "backcat_tokens";

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
}

function randomString(n = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

function realmBase(): string {
  return `${__KEYCLOAK_URL__}/realms/${__KEYCLOAK_REALM__}`;
}

export async function getStoredTokens(): Promise<TokenSet | null> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return (data[STORAGE_KEY] as TokenSet) ?? null;
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

async function saveTokens(tokens: TokenSet): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
}

async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: __KEYCLOAK_CLIENT_ID__,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const resp = await fetch(`${realmBase()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error(`token exchange failed (${resp.status})`);
  const json = await resp.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    id_token: json.id_token,
    expires_at: Date.now() + (json.expires_in ?? 300) * 1000,
  };
}

async function refresh(tokens: TokenSet): Promise<TokenSet> {
  if (!tokens.refresh_token) throw new Error("no refresh token");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: __KEYCLOAK_CLIENT_ID__,
    refresh_token: tokens.refresh_token,
  });
  const resp = await fetch(`${realmBase()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error(`refresh failed (${resp.status})`);
  const json = await resp.json();
  const next: TokenSet = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? tokens.refresh_token,
    id_token: json.id_token ?? tokens.id_token,
    expires_at: Date.now() + (json.expires_in ?? 300) * 1000,
  };
  await saveTokens(next);
  return next;
}

/** Return a valid access token, refreshing if needed. Null if signed out. */
export async function getAccessToken(): Promise<string | null> {
  let tokens = await getStoredTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 30_000) return tokens.access_token;
  try {
    tokens = await refresh(tokens);
    return tokens.access_token;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function login(): Promise<TokenSet> {
  // Fail fast with a clear message if Keycloak isn't up (Chrome only says
  // "Authorization page could not be loaded").
  try {
    const probe = await fetch(`${realmBase()}/.well-known/openid-configuration`);
    if (!probe.ok) throw new Error(`Keycloak realm not ready (${probe.status})`);
  } catch (e: unknown) {
    const hint =
      e instanceof TypeError
        ? "Is Keycloak running? Try: docker compose up -d keycloak"
        : e instanceof Error
          ? e.message
          : String(e);
    throw new Error(`Cannot reach Keycloak at ${__KEYCLOAK_URL__}. ${hint}`);
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const verifier = randomString(64);
  const challenge = b64url(await sha256(verifier));
  const state = randomString(16);

  const authUrl = new URL(`${realmBase()}/protocol/openid-connect/auth`);
  authUrl.searchParams.set("client_id", __KEYCLOAK_CLIENT_ID__);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `${msg} (redirect ${redirectUri}). Open ${authUrl.origin} in a tab to confirm Keycloak is up.`
    );
  }
  if (!redirect) throw new Error("login cancelled");
  const returned = new URL(redirect);
  if (returned.searchParams.get("state") !== state) throw new Error("state mismatch");
  const err = returned.searchParams.get("error");
  if (err) throw new Error(err);
  const code = returned.searchParams.get("code");
  if (!code) throw new Error("no authorization code");

  const tokens = await exchangeCode(code, verifier, redirectUri);
  await saveTokens(tokens);
  return tokens;
}

export async function logout(): Promise<void> {
  const tokens = await getStoredTokens();
  await clearTokens();
  if (tokens?.id_token) {
    const end = new URL(`${realmBase()}/protocol/openid-connect/logout`);
    end.searchParams.set("id_token_hint", tokens.id_token);
    end.searchParams.set("post_logout_redirect_uri", chrome.identity.getRedirectURL());
    try {
      await chrome.identity.launchWebAuthFlow({ url: end.toString(), interactive: false });
    } catch {
      /* best-effort */
    }
  }
}
