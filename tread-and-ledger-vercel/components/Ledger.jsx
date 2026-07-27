'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, Settings as SettingsIcon,
  Receipt, CalendarDays, Loader2, Wrench, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  fetchJobs, createJob, deleteJobApi,
  fetchExpenses, createExpense, deleteExpenseApi,
  fetchDailyCosts, createDailyCost, deleteDailyCostApi,
  fetchRentMonths, saveRentMonthApi, deleteRentMonthApi,
} from '../lib/api';

// ---------- palette / tokens ----------
const C = {
  paper: '#F6F2E8',
  paperDark: '#ECE5D4',
  ink: '#221F1A',
  inkSoft: '#6B6558',
  amber: '#E0A32C',
  amberDark: '#A97418',
  green: '#3E6E52',
  greenSoft: '#E4EEE7',
  red: '#A8452E',
  redSoft: '#F4E5DF',
  line: '#DCD3BE',
  card: '#FFFDF8',
};

const FONT_DISPLAY = "'Oswald', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const CATS = {
  wages: { label: 'Wages', color: '#7A5C3E' },
  consumables: { label: 'Consumables', color: '#3E6E52' },
  other: { label: 'Other', color: '#5B5344' },
  tyreDisposal: { label: 'Tyre Disposal', color: '#8A4B3E' },
};

// Daily costs: paid out per-person, logged against the specific day worked
// (not spread across the week like wages/consumables/other above).
const DAILY_WAGES = {
  steph: { label: 'Steph Wages', color: '#B5762E' },
  jared: { label: 'Jared Wages', color: '#5C7A8A' },
  jack: { label: 'Jack Wages', color: '#6E5C8A' },
  corey: { label: 'Corey Wages', color: '#3E6E6E' },
};

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
const mondayOf = (k) => {
  const d = parseKey(k);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toKey(d);
};
const daysInMonth = (k) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const isSunday = (k) => parseKey(k).getDay() === 0;
// Number of Monday-Saturday days in the month that date key `k` falls in.
// Bills/rent are spread across these days only, never onto a Sunday.
const weekdaysInMonth = (k) => {
  const total = daysInMonth(k);
  const [y, m] = k.split('-').map(Number);
  let sundays = 0;
  for (let d = 1; d <= total; d++) {
    if (new Date(y, m - 1, d).getDay() === 0) sundays++;
  }
  return total - sundays;
};
const monthKeyOf = (k) => k.slice(0, 7);
const fmtDisplay = (k) =>
  parseKey(k).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (k) => parseKey(k).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const todayKey = () => toKey(new Date());
const daysBetween = (startK, endK) => {
  const out = [];
  let cur = startK;
  let guard = 0;
  while (cur <= endK && guard++ < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
};
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- small UI atoms ----------
function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        boxShadow: '0 1px 2px rgba(34,31,26,0.04)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

function StatBlock({ label, value, tone = 'ink' }) {
  const color = tone === 'green' ? C.green : tone === 'red' ? C.red : C.ink;
  return (
    <div style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontFamily: FONT_BODY, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, color }}>${money(value)}</div>
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.redSoft, border: `1px solid ${C.red}`, borderRadius: 8, padding: 10, fontSize: 12.5, color: C.ink }}>
      <AlertTriangle size={16} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

// ---------- main component ----------
export default function Ledger() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [jobs, setJobs] = useState([]);
  const [weekExpenses, setWeekExpenses] = useState([]);
  const [dailyCosts, setDailyCosts] = useState([]);
  const [rentMonths, setRentMonths] = useState({}); // { 'YYYY-MM': amount }
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState('');
  const [tab, setTab] = useState('day');
  const [showJobForm, setShowJobForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [showDailyCostForm, setShowDailyCostForm] = useState(false);

  const loadDay = useCallback(async (dk) => {
    setDayLoading(true);
    setDayError('');
    const monday = mondayOf(dk);
    try {
      const [dayJobs, weekExp, dayCosts, rentRows] = await Promise.all([
        fetchJobs(dk, dk),
        fetchExpenses(monday, monday),
        fetchDailyCosts(dk, dk),
        fetchRentMonths(),
      ]);
      setJobs(dayJobs);
      setWeekExpenses(weekExp);
      setDailyCosts(dayCosts);
      setRentMonths(Object.fromEntries(rentRows.map((r) => [r.month, Number(r.amount)])));
    } catch (err) {
      setDayError(`Couldn't load data: ${err.message}. If this is a fresh deployment, visit /api/init once to set up the database.`);
    }
    setDayLoading(false);
  }, []);

  useEffect(() => {
    loadDay(dateKey);
  }, [dateKey, loadDay]);

  const addJob = async (job) => {
    const saved = await createJob({ ...job, date: dateKey });
    setJobs((prev) => [...prev, saved]);
  };
  const deleteJob = async (id) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await deleteJobApi(id);
  };

  const addExpense = async (entry) => {
    await createExpense(entry);
    await loadDay(dateKey);
  };
  const deleteExpense = async (entry) => {
    await deleteExpenseApi(entry.id);
    await loadDay(dateKey);
  };

  const addDailyCost = async (entry) => {
    const saved = await createDailyCost({ ...entry, date: dateKey });
    setDailyCosts((prev) => [...prev, saved]);
  };
  const deleteDailyCost = async (id) => {
    setDailyCosts((prev) => prev.filter((c) => c.id !== id));
    await deleteDailyCostApi(id);
  };

  const saveRentMonth = async (month, amount) => {
    await saveRentMonthApi({ month, amount });
    setRentMonths((prev) => ({ ...prev, [month]: amount }));
  };
  const deleteRentMonth = async (month) => {
    await deleteRentMonthApi(month);
    setRentMonths((prev) => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
  };

  // ----- derived day totals -----
  const dayIsSunday = isSunday(dateKey);
  const dayRevenue = jobs.reduce((s, j) => s + Number(j.salePrice || 0), 0);
  const dayCost = jobs.reduce((s, j) => s + Number(j.cost || 0), 0);
  const monthRent = rentMonths[monthKeyOf(dateKey)] || 0;
  const dayRent = dayIsSunday ? 0 : monthRent / weekdaysInMonth(dateKey);
  const wagesTotal = weekExpenses.filter((e) => e.category === 'wages').reduce((s, e) => s + Number(e.amount || 0), 0);
  const consumablesTotal = weekExpenses.filter((e) => e.category === 'consumables').reduce((s, e) => s + Number(e.amount || 0), 0);
  const otherTotal = weekExpenses.filter((e) => e.category === 'other').reduce((s, e) => s + Number(e.amount || 0), 0);
  const tyreDisposalTotal = weekExpenses.filter((e) => e.category === 'tyreDisposal').reduce((s, e) => s + Number(e.amount || 0), 0);
  const dayWeeklyShare = dayIsSunday ? 0 : (wagesTotal + consumablesTotal + otherTotal + tyreDisposalTotal) / 6;
  const dayDailyWagesTotal = dailyCosts.reduce((s, c) => s + Number(c.amount || 0), 0);
  const dayNetProfit = dayRevenue - dayCost - dayRent - dayWeeklyShare - dayDailyWagesTotal;

  return (
    <div style={{ fontFamily: FONT_BODY, background: C.paper, minHeight: '100vh', color: C.ink, paddingBottom: 84 }}>
      <header style={{ background: C.ink, color: C.paper, padding: '18px 16px 14px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wrench size={18} color={C.amber} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Tread &amp; Ledger
          </div>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: '#B8B1A0', marginTop: 2 }}>Daily takings, weekly bills, one running total</div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        {tab === 'day' && (
          <DayTab
            dateKey={dateKey}
            setDateKey={setDateKey}
            jobs={jobs}
            loading={dayLoading}
            error={dayError}
            addJob={addJob}
            deleteJob={deleteJob}
            weekExpenses={weekExpenses}
            addExpense={addExpense}
            deleteExpense={deleteExpense}
            dailyCosts={dailyCosts}
            addDailyCost={addDailyCost}
            deleteDailyCost={deleteDailyCost}
            showJobForm={showJobForm}
            setShowJobForm={setShowJobForm}
            showExpForm={showExpForm}
            setShowExpForm={setShowExpForm}
            showDailyCostForm={showDailyCostForm}
            setShowDailyCostForm={setShowDailyCostForm}
            dayRevenue={dayRevenue}
            dayCost={dayCost}
            dayRent={dayRent}
            dayWeeklyShare={dayWeeklyShare}
            dayDailyWagesTotal={dayDailyWagesTotal}
            dayNetProfit={dayNetProfit}
            wagesTotal={wagesTotal}
            consumablesTotal={consumablesTotal}
            otherTotal={otherTotal}
            tyreDisposalTotal={tyreDisposalTotal}
            dayIsSunday={dayIsSunday}
          />
        )}
        {tab === 'pnl' && <PnlTab dateKey={dateKey} />}
        {tab === 'settings' && (
          <SettingsTab rentMonths={rentMonths} saveRentMonth={saveRentMonth} deleteRentMonth={deleteRentMonth} />
        )}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.line}`, display: 'flex', zIndex: 30 }}>
        {[
          { id: 'day', label: 'Today', icon: Receipt },
          { id: 'pnl', label: 'P&L', icon: TrendingUp },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, padding: '10px 0 12px', background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer',
              color: tab === id ? C.amberDark : C.inkSoft,
            }}
          >
            <Icon size={19} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------- Day tab ----------
function DayTab(props) {
  const {
    dateKey, setDateKey, jobs, loading, error, addJob, deleteJob,
    weekExpenses, addExpense, deleteExpense,
    dailyCosts, addDailyCost, deleteDailyCost,
    showJobForm, setShowJobForm, showExpForm, setShowExpForm,
    showDailyCostForm, setShowDailyCostForm,
    dayRevenue, dayCost, dayRent, dayWeeklyShare, dayDailyWagesTotal, dayNetProfit,
    wagesTotal, consumablesTotal, otherTotal, tyreDisposalTotal, dayIsSunday,
  } = props;

  const isToday = dateKey === todayKey();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => setDateKey(addDays(dateKey, -1))} style={navBtnStyle}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600, textTransform: 'uppercase' }}>{fmtDisplay(dateKey)}</div>
          {!isToday && (
            <button onClick={() => setDateKey(todayKey())} style={{ background: 'none', border: 'none', color: C.amberDark, fontSize: 11, cursor: 'pointer', padding: 0 }}>
              Jump to today
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ cursor: 'pointer', color: C.inkSoft, display: 'flex', position: 'relative' }}>
            <CalendarDays size={17} />
            <input type="date" value={dateKey} onChange={(e) => e.target.value && setDateKey(e.target.value)} style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
          </label>
          <button onClick={() => setDateKey(addDays(dateKey, 1))} style={navBtnStyle}><ChevronRight size={18} /></button>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: C.inkSoft }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          <Card style={{ padding: 14, background: dayNetProfit >= 0 ? C.greenSoft : C.redSoft, border: `1px solid ${dayNetProfit >= 0 ? C.green : C.red}` }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft }}>Net profit for the day</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 600, color: dayNetProfit >= 0 ? C.green : C.red }}>
              {dayNetProfit < 0 ? '-' : ''}${money(Math.abs(dayNetProfit))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              <MiniStat label="Revenue" value={dayRevenue} />
              <MiniStat label="Tyre cost" value={dayCost} />
              <MiniStat label="Rent (today)" value={dayRent} />
              <MiniStat label="Bills (today's share)" value={dayWeeklyShare} />
              <MiniStat label="Daily wages (today)" value={dayDailyWagesTotal} />
            </div>
            {dayIsSunday && (
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 8, fontStyle: 'italic' }}>
                Sunday doesn't carry a share of rent or weekly bills — only jobs and any daily wages you log will show here.
              </div>
            )}
          </Card>

          <Card style={{ padding: 14 }}>
            <SectionHeader title="Jobs today" onAdd={() => setShowJobForm((v) => !v)} addLabel="Add job" />
            {showJobForm && <JobForm onSubmit={(j) => { addJob(j); setShowJobForm(false); }} onCancel={() => setShowJobForm(false)} />}
            {jobs.length === 0 && !showJobForm && <EmptyState text="No jobs logged yet for this day. Add the first one." />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: jobs.length ? 10 : 0 }}>
              {jobs.map((j) => <JobRow key={j.id} job={j} onDelete={() => deleteJob(j.id)} />)}
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <SectionHeader title="This week's bills" onAdd={() => setShowExpForm((v) => !v)} addLabel="Log a bill" />
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: -4, marginBottom: showExpForm ? 10 : 0 }}>
              Wages, parts, disposal fees etc. that recur weekly (like tyre disposal or Bursons orders). Log the full amount when it's paid — it's spread evenly across Monday–Saturday of that week automatically, skipping Sunday.
            </div>
            {showExpForm && (
              <ExpenseForm defaultDate={dateKey} onSubmit={(e) => { addExpense(e); setShowExpForm(false); }} onCancel={() => setShowExpForm(false)} />
            )}
            {weekExpenses.length === 0 && !showExpForm && <EmptyState text="No bills logged for this week yet." />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: weekExpenses.length ? 10 : 0 }}>
              {weekExpenses.map((e) => <ExpenseRow key={e.id} entry={e} onDelete={() => deleteExpense(e)} />)}
            </div>
            {weekExpenses.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <MiniStat label="Wages / wk" value={wagesTotal} />
                <MiniStat label="Consumables / wk" value={consumablesTotal} />
                <MiniStat label="Other / wk" value={otherTotal} />
                <MiniStat label="Tyre disposal / wk" value={tyreDisposalTotal} />
              </div>
            )}
          </Card>

          <Card style={{ padding: 14 }}>
            <SectionHeader title="Daily costs" onAdd={() => setShowDailyCostForm((v) => !v)} addLabel="Log a wage" />
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: -4, marginBottom: showDailyCostForm ? 10 : 0 }}>
              Steph, Jared, Jack and Corey's wages — logged against the actual day worked, not spread across the week.
            </div>
            {showDailyCostForm && (
              <DailyCostForm onSubmit={(c) => { addDailyCost(c); setShowDailyCostForm(false); }} onCancel={() => setShowDailyCostForm(false)} />
            )}
            {dailyCosts.length === 0 && !showDailyCostForm && <EmptyState text="No daily wages logged for this day yet." />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: dailyCosts.length ? 10 : 0 }}>
              {dailyCosts.map((c) => <DailyCostRow key={c.id} entry={c} onDelete={() => deleteDailyCost(c.id)} />)}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const navBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: C.ink, padding: 4, display: 'flex' };

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: C.inkSoft }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 600 }}>${money(value)}</div>
    </div>
  );
}

function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{title}</div>
      <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.amber, color: C.ink, border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: '16px 4px', color: C.inkSoft, fontSize: 13, fontStyle: 'italic' }}>{text}</div>;
}

function JobForm({ onSubmit, onCancel }) {
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [cost, setCost] = useState('');
  const profit = (Number(salePrice) || 0) - (Number(cost) || 0);

  return (
    <div style={{ background: C.paperDark, borderRadius: 8, padding: 12, marginTop: 10, marginBottom: 4 }}>
      <FieldRow label="Job description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 2x 205/55R16 + fitting" style={inputStyle} />
      </FieldRow>
      <div style={{ display: 'flex', gap: 10 }}>
        <FieldRow label="Sale price ($)" style={{ flex: 1 }}>
          <input type="number" inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0.00" style={inputStyle} />
        </FieldRow>
        <FieldRow label="Tyre cost ($)" style={{ flex: 1 }}>
          <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" style={inputStyle} />
        </FieldRow>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: profit >= 0 ? C.green : C.red, marginBottom: 10 }}>Profit: ${money(profit)}</div>
      <FormButtons onCancel={onCancel} onSubmit={() => { if (!description.trim() || salePrice === '') return; onSubmit({ description: description.trim(), salePrice: Number(salePrice), cost: Number(cost) || 0 }); }} />
    </div>
  );
}

function JobRow({ job, onDelete }) {
  const profit = Number(job.salePrice) - Number(job.cost || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '8px 10px', background: C.paper }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.description}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft }}>
          ${money(job.salePrice)} sale · ${money(job.cost || 0)} cost · <span style={{ color: profit >= 0 ? C.green : C.red }}>${money(profit)} profit</span>
        </div>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 6, flexShrink: 0 }}><Trash2 size={15} /></button>
    </div>
  );
}

function ExpenseForm({ defaultDate, onSubmit, onCancel }) {
  const [category, setCategory] = useState('wages');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paidDate, setPaidDate] = useState(defaultDate);

  return (
    <div style={{ background: C.paperDark, borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <FieldRow label="Category" style={{ flex: 1 }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Amount ($)" style={{ flex: 1 }}>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
        </FieldRow>
      </div>
      <FieldRow label="Paid on">
        <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={inputStyle} />
      </FieldRow>
      <FieldRow label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. tyre disposal, weekly wages" style={inputStyle} />
      </FieldRow>
      {amount !== '' && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
          = ${money((Number(amount) || 0) / 7)} / day across the week of {fmtShort(mondayOf(paidDate))}
        </div>
      )}
      <FormButtons onCancel={onCancel} onSubmit={() => { if (amount === '') return; onSubmit({ category, amount: Number(amount), note: note.trim(), paidDate }); }} />
    </div>
  );
}

function ExpenseRow({ entry, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '8px 10px', background: C.paper }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          <span style={{ color: CATS[entry.category].color }}>{CATS[entry.category].label}</span>
          {entry.note ? ` — ${entry.note}` : ''}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft }}>
          ${money(entry.amount)} paid {fmtShort(entry.paidDate)} · ${money(entry.amount / 7)}/day
        </div>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 6, flexShrink: 0 }}><Trash2 size={15} /></button>
    </div>
  );
}

function DailyCostForm({ onSubmit, onCancel }) {
  const [person, setPerson] = useState('steph');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <div style={{ background: C.paperDark, borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <FieldRow label="Person" style={{ flex: 1 }}>
          <select value={person} onChange={(e) => setPerson(e.target.value)} style={inputStyle}>
            {Object.entries(DAILY_WAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Amount ($)" style={{ flex: 1 }}>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
        </FieldRow>
      </div>
      <FieldRow label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. half day" style={inputStyle} />
      </FieldRow>
      <FormButtons onCancel={onCancel} onSubmit={() => { if (amount === '') return; onSubmit({ person, amount: Number(amount), note: note.trim() }); }} />
    </div>
  );
}

function DailyCostRow({ entry, onDelete }) {
  const cfg = DAILY_WAGES[entry.person] || { label: entry.person, color: C.ink };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px dashed ${C.line}`, borderRadius: 8, padding: '8px 10px', background: C.paper }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          <span style={{ color: cfg.color }}>{cfg.label}</span>
          {entry.note ? ` — ${entry.note}` : ''}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft }}>${money(entry.amount)}</div>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 6, flexShrink: 0 }}><Trash2 size={15} /></button>
    </div>
  );
}

function FieldRow({ label, children, style }) {
  return (
    <div style={{ marginBottom: 8, ...style }}>
      <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 9px', border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 14, background: '#fff', color: C.ink };

function FormButtons({ onCancel, onSubmit }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onSubmit} style={{ background: C.ink, color: C.paper, border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
      <button onClick={onCancel} style={{ background: 'none', color: C.inkSoft, border: `1px solid ${C.line}`, borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
    </div>
  );
}

// ---------- P&L tab ----------
function PnlTab({ dateKey }) {
  const [rangeType, setRangeType] = useState('week');
  const [customStart, setCustomStart] = useState(addDays(dateKey, -6));
  const [customEnd, setCustomEnd] = useState(dateKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { start, end } = useMemo(() => {
    const today = dateKey;
    if (rangeType === 'week') return { start: mondayOf(today), end: addDays(mondayOf(today), 6) };
    if (rangeType === 'month') {
      const mk = today.slice(0, 7);
      return { start: `${mk}-01`, end: `${mk}-${pad(daysInMonth(today))}` };
    }
    if (rangeType === '7d') return { start: addDays(today, -6), end: today };
    if (rangeType === '30d') return { start: addDays(today, -29), end: today };
    return { start: customStart, end: customEnd };
  }, [rangeType, dateKey, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError('');
      try {
        const weekFrom = mondayOf(start);
        const weekTo = mondayOf(end);
        const [jobRows, expenseRows, dailyCostRows, rentRows] = await Promise.all([
          fetchJobs(start, end),
          fetchExpenses(weekFrom, weekTo),
          fetchDailyCosts(start, end),
          fetchRentMonths(),
        ]);
        if (cancelled) return;

        const rentByMonth = Object.fromEntries(rentRows.map((r) => [r.month, Number(r.amount)]));

        const jobsByDate = {};
        jobRows.forEach((j) => {
          (jobsByDate[j.date] ||= []).push(j);
        });
        const dailyCostsByDate = {};
        dailyCostRows.forEach((c) => {
          (dailyCostsByDate[c.date] ||= []).push(c);
        });

        const days = daysBetween(start, end).map((d) => {
          const sunday = isSunday(d);
          const dayJobs = jobsByDate[d] || [];
          const revenue = dayJobs.reduce((s, j) => s + Number(j.salePrice || 0), 0);
          const tyreCost = dayJobs.reduce((s, j) => s + Number(j.cost || 0), 0);
          const monday = mondayOf(d);
          const weekly = expenseRows.filter((e) => e.weekMonday === monday);
          const weeklyDivisor = sunday ? Infinity : 6;
          const wages = weekly.filter((e) => e.category === 'wages').reduce((s, e) => s + Number(e.amount || 0), 0) / weeklyDivisor;
          const consumables = weekly.filter((e) => e.category === 'consumables').reduce((s, e) => s + Number(e.amount || 0), 0) / weeklyDivisor;
          const other = weekly.filter((e) => e.category === 'other').reduce((s, e) => s + Number(e.amount || 0), 0) / weeklyDivisor;
          const tyreDisposal = weekly.filter((e) => e.category === 'tyreDisposal').reduce((s, e) => s + Number(e.amount || 0), 0) / weeklyDivisor;
          const rent = sunday ? 0 : (rentByMonth[monthKeyOf(d)] || 0) / weekdaysInMonth(d);
          const dailyWages = (dailyCostsByDate[d] || []).reduce((s, c) => s + Number(c.amount || 0), 0);
          const totalCost = tyreCost + wages + consumables + other + tyreDisposal + rent + dailyWages;
          const netProfit = revenue - totalCost;
          return { date: d, revenue, tyreCost, wages, consumables, other, tyreDisposal, rent, dailyWages, totalCost, netProfit, jobCount: dayJobs.length };
        });

        const totals = days.reduce((acc, d) => {
          acc.revenue += d.revenue; acc.tyreCost += d.tyreCost; acc.wages += d.wages;
          acc.consumables += d.consumables; acc.other += d.other; acc.tyreDisposal += d.tyreDisposal;
          acc.rent += d.rent; acc.dailyWages += d.dailyWages;
          acc.totalCost += d.totalCost; acc.netProfit += d.netProfit;
          return acc;
        }, { revenue: 0, tyreCost: 0, wages: 0, consumables: 0, other: 0, tyreDisposal: 0, rent: 0, dailyWages: 0, totalCost: 0, netProfit: 0 });

        setData({ days, totals });
      } catch (err) {
        setError(`Couldn't load report: ${err.message}. If this is a fresh deployment, visit /api/init once to set up the database.`);
      }
      setLoading(false);
    }
    run();
    return () => { cancelled = true; };
  }, [start, end]);

  const chartData = data?.days.map((d) => ({ name: fmtShort(d.date), Revenue: Number(d.revenue.toFixed(2)), Costs: Number(d.totalCost.toFixed(2)) })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'week', label: 'This week' },
            { id: 'month', label: 'This month' },
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last 30 days' },
            { id: 'custom', label: 'Custom' },
          ].map((r) => (
            <button key={r.id} onClick={() => setRangeType(r.id)} style={{ padding: '6px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${rangeType === r.id ? C.amberDark : C.line}`, background: rangeType === r.id ? C.amber : '#fff', color: C.ink }}>
              {r.label}
            </button>
          ))}
        </div>
        {rangeType === 'custom' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <FieldRow label="From" style={{ flex: 1 }}><input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={inputStyle} /></FieldRow>
            <FieldRow label="To" style={{ flex: 1 }}><input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={inputStyle} /></FieldRow>
          </div>
        )}
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{fmtShort(start)} – {fmtShort(end)}</div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {loading || !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: C.inkSoft }}>
          <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          <Card style={{ padding: 14, background: data.totals.netProfit >= 0 ? C.greenSoft : C.redSoft, border: `1px solid ${data.totals.netProfit >= 0 ? C.green : C.red}` }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.inkSoft }}>Net profit</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 600, color: data.totals.netProfit >= 0 ? C.green : C.red }}>
              {data.totals.netProfit < 0 ? '-' : ''}${money(Math.abs(data.totals.netProfit))}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>
              Margin: {data.totals.revenue > 0 ? ((data.totals.netProfit / data.totals.revenue) * 100).toFixed(1) : '0.0'}%
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Breakdown</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <StatBlock label="Revenue" value={data.totals.revenue} />
              <StatBlock label="Tyre cost" value={data.totals.tyreCost} tone="red" />
              <StatBlock label="Rent" value={data.totals.rent} tone="red" />
              <StatBlock label="Weekly wages" value={data.totals.wages} tone="red" />
              <StatBlock label="Daily wages" value={data.totals.dailyWages} tone="red" />
              <StatBlock label="Consumables" value={data.totals.consumables} tone="red" />
              <StatBlock label="Tyre disposal" value={data.totals.tyreDisposal} tone="red" />
              <StatBlock label="Other bills" value={data.totals.other} tone="red" />
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Revenue vs costs by day</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: FONT_BODY, fill: C.inkSoft }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: FONT_BODY, fill: C.inkSoft }} />
                  <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 12, borderRadius: 6, border: `1px solid ${C.line}` }} formatter={(v) => `$${money(v)}`} />
                  <Bar dataKey="Revenue" fill={C.green} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Costs" fill={C.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Day by day</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.days.map((d) => (
                <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '5px 0', borderBottom: `1px dashed ${C.line}` }}>
                  <span style={{ color: C.inkSoft }}>{fmtShort(d.date)} {d.jobCount ? `· ${d.jobCount} job${d.jobCount > 1 ? 's' : ''}` : ''}</span>
                  <span style={{ fontFamily: FONT_MONO, color: d.netProfit >= 0 ? C.green : C.red }}>{d.netProfit < 0 ? '-' : ''}${money(Math.abs(d.netProfit))}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------- Settings tab ----------
function monthLabel(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

function SettingsTab({ rentMonths, saveRentMonth, deleteRentMonth }) {
  const thisMonth = todayKey().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);

  const sortedMonths = Object.keys(rentMonths).sort().reverse();

  const handleSave = () => {
    if (amount === '') return;
    saveRentMonth(month, Number(amount));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Rent</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
          Rent changes a bit each month, so add it here as each bill comes in. It's automatically split across Monday–Saturday of that month — Sunday doesn't carry a share.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <FieldRow label="Month" style={{ flex: 1 }}>
            <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSaved(false); }} style={inputStyle} />
          </FieldRow>
          <FieldRow label="Rent for that month ($)" style={{ flex: 1 }}>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setSaved(false); }} placeholder="0.00" style={inputStyle} />
          </FieldRow>
        </div>
        <button onClick={handleSave} style={{ background: C.ink, color: C.paper, border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
        {saved && <span style={{ marginLeft: 10, fontSize: 12, color: C.green }}>Saved</span>}

        {sortedMonths.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${C.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedMonths.map((mk) => (
              <div key={mk} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{monthLabel(mk)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT_MONO }}>${money(rentMonths[mk])}</span>
                  <button onClick={() => deleteRentMonth(mk)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 4, display: 'flex' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>About this ledger</div>
        <ul style={{ fontSize: 12.5, color: C.inkSoft, paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Jobs (sale price and tyre cost) are logged against the day they happen.</li>
          <li>Daily costs (Steph, Jared, Jack and Corey's wages) are logged against the specific day worked — no spreading.</li>
          <li>Weekly bills — wages, consumables, tyre disposal, other — are logged on the day they're paid and spread evenly across Monday–Saturday of that week.</li>
          <li>Rent is added month by month above and split evenly across Monday–Saturday of that month.</li>
          <li>Sunday is still there in case you work it, but it never carries a share of rent or weekly bills — only what you log directly against it.</li>
          <li>Data lives in one shared database — any device or staff member using this web address sees the same figures.</li>
        </ul>
      </Card>
    </div>
  );
}
