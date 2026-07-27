import { sql } from '@vercel/postgres';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (month) {
    const { rows } = await sql`SELECT month, amount FROM rent_months WHERE month = ${month};`;
    return Response.json(rows[0] || { month, amount: 0 });
  }
  const { rows } = await sql`SELECT month, amount FROM rent_months ORDER BY month ASC;`;
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const { month, amount } = body || {};
  if (!month || amount == null) {
    return Response.json({ error: 'month and amount are required' }, { status: 400 });
  }
  await sql`
    INSERT INTO rent_months (month, amount)
    VALUES (${month}, ${amount})
    ON CONFLICT (month) DO UPDATE SET amount = EXCLUDED.amount;
  `;
  return Response.json({ month, amount });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  if (!month) return Response.json({ error: 'month is required' }, { status: 400 });
  await sql`DELETE FROM rent_months WHERE month = ${month};`;
  return Response.json({ ok: true });
}
