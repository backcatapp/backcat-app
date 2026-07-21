import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { saveGlobalConfig, saveCatalogConfig, togglePause } from "../actions";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, unknown> = {
  kill_switch: false,
  daily_spend_limit_usd: 5,
  "model.asr": "whisper-large-v3-turbo",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.roles?.includes("admin")) redirect("/dashboard");

  const rows = await sql`SELECT key, value FROM app_config`;
  const config = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  const catalogs = await sql`SELECT id, name, embedding_provider, paused FROM catalogs ORDER BY name`;

  return (
    <>
      <h1>Settings</h1>
      <p className="dash-sub">
        DB-backed config (<span className="mono">app_config</span>) — pipeline and serve read these
        before every paid call. Precedence: DB → env → default.
      </p>

      <form className="dash-form" action={saveGlobalConfig}>
        <div className="switch-row">
          <input
            type="checkbox"
            id="kill_switch"
            name="kill_switch"
            defaultChecked={config.kill_switch === true}
          />
          <label htmlFor="kill_switch">
            <b>Kill-switch</b> — block ALL paid API calls (ingestion + answering)
          </label>
        </div>
        <div className="field">
          <label htmlFor="daily_spend_limit_usd">Daily spend limit (USD)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            id="daily_spend_limit_usd"
            name="daily_spend_limit_usd"
            defaultValue={String(config.daily_spend_limit_usd)}
          />
        </div>
        <div className="field">
          <label htmlFor="model_asr">ASR model (Groq Whisper)</label>
          <input type="text" id="model_asr" name="model_asr" defaultValue={String(config["model.asr"])} />
        </div>
        <button className="btn">Save</button>
      </form>

      <div className="section">
        <h2>Catalogs</h2>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Catalog</th>
              <th>Embedding provider</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {catalogs.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <form className="catalog-row-actions" action={saveCatalogConfig.bind(null, c.id)}>
                    <select name="embedding_provider" defaultValue={c.embedding_provider}>
                      <option value="openai">openai (text-embedding-3-small)</option>
                      <option value="bge-m3">bge-m3 (self-hosted)</option>
                    </select>
                    <button className="btn-ghost">Apply</button>
                  </form>
                  <p className="dash-sub" style={{ margin: "6px 0 0", fontSize: 12 }}>
                    Switching providers requires a re-index — vectors are not comparable across models.
                  </p>
                </td>
                <td>
                  <form action={togglePause.bind(null, c.id)}>
                    <button className="btn-ghost">{c.paused ? "Resume" : "Pause"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
