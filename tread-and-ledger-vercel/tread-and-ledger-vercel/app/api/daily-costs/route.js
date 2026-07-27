import { sql } from '@vercel/postgres';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return Response.json({ error: 'start and end query params are required' }, { status: 400 });
  }
  const { rows } = await sql`
    SELECT id, date, person, amount, note
    FROM daily_costs
    WHERE date >= ${start} AND date <= ${end}
    ORDER BY date ASC, created_at ASC;
  `;
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const { date, person, amount, note } = body || {};
  if (!date || !person || amount == null) {
    return Response.json({ error: 'date, person and amount are required' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO daily_costs (id, date, person, amount, note)
    VALUES (${id}, ${date}, ${person}, ${amount}, ${note || ''});
  `;
  return Response.json({ id, date, person, amount, note: note || '' });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await sql`DELETE FROM daily_costs WHERE id = ${id};`;
  return Response.json({ ok: true });
}
