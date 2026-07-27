import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        sale_price NUMERIC NOT NULL,
        cost NUMERIC NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(date);`;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        paid_date TEXT NOT NULL,
        week_monday TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_week ON expenses(week_monday);`;

    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_costs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        person TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_daily_costs_date ON daily_costs(date);`;

    await sql`
      CREATE TABLE IF NOT EXISTS rent_months (
        month TEXT PRIMARY KEY,
        amount NUMERIC NOT NULL
      );
    `;

    return Response.json({ ok: true, message: 'Database ready. You can close this page and start using the app.' });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
