import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

// Roles come from the Keycloak access token (realm_access.roles) — the Auth.js
// session only mirrors them. Provider config via AUTH_KEYCLOAK_{ID,SECRET,ISSUER}.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Keycloak],
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
