import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    const signIn = new URL("/api/auth/signin", req.nextUrl.origin);
    signIn.searchParams.set("callbackUrl", req.nextUrl.href);
    return Response.redirect(signIn);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
