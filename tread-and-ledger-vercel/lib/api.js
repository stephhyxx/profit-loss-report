async function handle(res) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch (e) {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchJobs(start, end) {
  return handle(await fetch(`/api/jobs?start=${start}&end=${end}`));
}
export async function createJob(job) {
  return handle(await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job) }));
}
export async function deleteJobApi(id) {
  return handle(await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' }));
}

export async function fetchExpenses(weekMondayFrom, weekMondayTo) {
  return handle(await fetch(`/api/expenses?weekMondayFrom=${weekMondayFrom}&weekMondayTo=${weekMondayTo}`));
}
export async function createExpense(entry) {
  return handle(await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }));
}
export async function deleteExpenseApi(id) {
  return handle(await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' }));
}

export async function fetchSettings() {
  return handle(await fetch('/api/settings'));
}
export async function saveSettingsApi(settings) {
  return handle(await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }));
}
