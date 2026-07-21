import postgres from "postgres";

// Server-only. The dashboard reads product Postgres directly (no API layer);
// writes go through role-guarded Server Actions. Singleton across HMR reloads.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "postgresql://backcat:backcat@localhost:5432/backcat", {
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
