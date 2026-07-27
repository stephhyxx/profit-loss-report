import { sql } from '@vercel/postgres';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return Response.json({ error: 'start and end query params are required' }, { status: 400 });
  }
  const { rows } = await sql`
    SELECT id, date, description, sale_price AS "salePrice", cost
    FROM jobs
    WHERE date >= ${start} AND date <= ${end}
    ORDER BY date ASC, created_at ASC;
  `;
  return Response.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  const { date, description, salePrice, cost } = body || {};
  if (!date || !description || salePrice == null) {
    return Response.json({ error: 'date, description and salePrice are required' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO jobs (id, date, description, sale_price, cost)
    VALUES (${id}, ${date}, ${description}, ${salePrice}, ${cost || 0});
  `;
  return Response.json({ id, date, description, salePrice, cost: cost || 0 });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await sql`DELETE FROM jobs WHERE id = ${id};`;
  return Response.json({ ok: true });
}
