import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import "./dashboard.css";

export const metadata = { title: "backcat — dashboard" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/api/auth/signin?callbackUrl=/dashboard");
  const isAdmin = session.roles?.includes("admin");
  if (!isAdmin && !session.roles?.includes("creator")) {
    // Authenticated but no panel role — nothing to show here yet.
    redirect("/");
  }

  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="dash-brand">
          back<span>cat</span>
        </div>
        <Link className="dash-nav-link" href="/dashboard">
          Catalogs
        </Link>
        <Link className="dash-nav-link" href="/dashboard/ask">
          Test chat
        </Link>
        <Link className="dash-nav-link" href="/dashboard/questions">
          Questions
        </Link>
        <Link className="dash-nav-link" href="/dashboard/graph">
          Graph
        </Link>
        {isAdmin && (
          <Link className="dash-nav-link" href="/dashboard/settings">
            Settings
          </Link>
        )}
        <div className="dash-side-foot">
          {session.user?.email}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="dash-signout">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}
