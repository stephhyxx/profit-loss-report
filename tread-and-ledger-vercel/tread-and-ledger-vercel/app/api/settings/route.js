import { sql } from '@vercel/postgres';

export async function GET() {
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'monthlyRent';`;
  const monthlyRent = rows.length ? Number(rows[0].value) : 0;
  return Response.json({ monthlyRent });
}

export async function POST(request) {
  const body = await request.json();
  const monthlyRent = Number(body?.monthlyRent) || 0;
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('monthlyRent', ${String(monthlyRent)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
  return Response.json({ monthlyRent });
}
