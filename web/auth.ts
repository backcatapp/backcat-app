import NextAuth, { customFetch } from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

// Roles come from the Keycloak access token (realm_access.roles) — the Auth.js
// session only mirrors them. Provider config via AUTH_KEYCLOAK_{ID,SECRET,ISSUER}.
//
// AUTH_KEYCLOAK_ISSUER is the browser-facing URL (Keycloak's KC_HOSTNAME is
// pinned to match it — see docker-compose.yml) — every OIDC endpoint,
// including the `iss` claim Keycloak embeds in tokens, is built from this one
// string, and openid-client rejects a token whose `iss` doesn't match the
// issuer used for discovery. In Docker, "browser-facing" (localhost) isn't
// reachable from inside this container, so AUTH_KEYCLOAK_INTERNAL_HOST
// rewrites the actual network destination of every provider-related fetch
// (discovery, token exchange, userinfo, jwks) to the internal service DNS
// name — the URL string Keycloak signed stays the same, only where the bytes
// are sent changes. Plain local dev leaves the var unset, so fetch is
// untouched.
const internalKeycloakHost = process.env.AUTH_KEYCLOAK_INTERNAL_HOST;

function keycloakFetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  if (!internalKeycloakHost) return fetch(...args);
  const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);
  url.host = internalKeycloakHost;
  url.protocol = "http:";
  return fetch(url, args[0] instanceof Request ? args[0] : args[1]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Keycloak({ [customFetch]: keycloakFetch })],
  trustHost: true,
  callbacks: {
    jwt({ token, account }) {
      if (account?.access_token) {
        try {
          const payload = JSON.parse(
            Buffer.from(account.access_token.split(".")[1], "base64url").toString()
          );
          token.roles = payload.realm_access?.roles ?? [];
        } catch {
          token.roles = [];
        }
      }
      return token;
    },
    session({ session, token }) {
      session.roles = (token.roles as string[]) ?? [];
      return session;
    },
  },
});
