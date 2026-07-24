import { sql } from '@vercel/postgres';

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('weekMondayFrom');
  const to = searchParams.get('weekMondayTo');
  if (!from || !to) {
    return Response.json({ error: 'weekMondayFrom and weekMondayTo query params are required' }, { status: 400 });
  }
  const { rows } = await sql`
    SELECT id, paid_date AS "paidDate", week_monday AS "weekMonday", category, amount, note
    FROM expenses
    WHERE week_monday >= ${from} AND week_monday <= ${to}
    ORDER BY paid_date ASC;
  `;
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const { paidDate, category, amount, note } = body || {};
  if (!paidDate || !category || amount == null) {
    return Response.json({ error: 'paidDate, category and amount are required' }, { status: 400 });
  }
  const weekMonday = mondayOf(paidDate);
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO expenses (id, paid_date, week_monday, category, amount, note)
    VALUES (${id}, ${paidDate}, ${weekMonday}, ${category}, ${amount}, ${note || ''});
  `;
  return Response.json({ id, paidDate, weekMonday, category, amount, note: note || '' });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await sql`DELETE FROM expenses WHERE id = ${id};`;
  return Response.json({ ok: true });
}
