// End-to-end tests: a whole night at a venue, run against a real server.
//
// Needs a running server (built from this repo) pointed at an empty test
// database and at the fake pawaPay this script starts on :3098:
//   PAWAPAY_API_TOKEN=fake-test-token PAWAPAY_BASE_URL=http://localhost:3098
//
// Env: API_URL (default http://localhost:3099), DATABASE_URL, JWT_SECRET.
// Exits 1 if any check fails.
import { createRequire } from 'module';
import { startFakePawapay } from './fake-pawapay.mjs';
import https from 'https';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(new URL('../../server/package.json', import.meta.url));
const jwt = require('jsonwebtoken');
const { Client } = require('pg');
const WebSocket = require('ws');

const ORIGIN = (process.env.API_URL || 'http://localhost:3099').replace(/\/$/, '');
const BASE = `${ORIGIN}/api`;
const WS_BASE = ORIGIN.replace(/^http/, 'ws') + '/ws';
const { DATABASE_URL, JWT_SECRET } = process.env;
if (!DATABASE_URL || !JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required');
  process.exit(2);
}

const pawa = startFakePawapay();
const pg = new Client({ connectionString: DATABASE_URL });
await pg.connect();
await pg.query("SET TIME ZONE 'UTC'"); // the app stores UTC

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
async function call(method, path, body, token) {
  try {
    const res = await fetch(BASE + path, {
      method,
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json };
  } catch {
    return { status: 'NO ANSWER', json: null };
  }
}
const alive = () => fetch(`${ORIGIN}/health`).then((r) => r.ok).catch(() => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = () => Math.random().toString(36).slice(2, 8);
const phone = () => '078' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
const q1 = async (sql, args = []) => (await pg.query(sql, args)).rows[0];
function socket(qs) {
  const ws = new WebSocket(`${WS_BASE}?${qs}`);
  const s = { ws, events: [], closed: null };
  ws.on('message', (m) => s.events.push(JSON.parse(m.toString())));
  ws.on('close', (code, reason) => (s.closed = `${code} ${reason}`));
  ws.on('error', () => {});
  return s;
}
async function newOwner(name) {
  const o = await q1(`insert into owners (name,email,google_id) values ($1,$2,$3) returning id,email`, [name, `${rnd()}@test.local`, `g-${rnd()}`]);
  return jwt.sign({ ownerId: o.id, email: o.email }, JWT_SECRET, { expiresIn: '1d' });
}

// ── 1. Setup ─────────────────────────────────────────────────────────────────
console.log('\n── Setup');
const ownerTok = await newOwner('Owner');
let r = await call('POST', '/venues', { name: 'No Code Bar', location: 'Kigali', acceptTerms: true }, await newOwner('No code owner'));
check('A venue can start without a MoMo Pay code (added later in Plan)', r.status === 201 && r.json?.data?.momoPayCode == null, r.json?.error);
r = await call('POST', '/venues', { name: 'Test Bar', location: 'Kigali', momoPhone: '0788 000 000', acceptTerms: false }, ownerTok);
check('Venue with "I agree" unticked is refused', r.status === 400 && /terms/i.test(r.json?.error ?? ''), r.json?.error);
{ // The old TabPro site doesn't send acceptTerms: the venue is made, no agreement recorded
  const oldSiteTok = await newOwner('Old site owner');
  const o = await call('POST', '/venues', { name: 'Old Site Bar', momoPhone: '0788 000 001' }, oldSiteTok);
  check('Old site can still create a venue (terms asked later, in the app)', o.status === 201 && !o.json?.data?.termsVersion, `termsVersion ${o.json?.data?.termsVersion}`);
}
r = await call('POST', '/venues', { name: 'Test Bar', location: 'Kigali', momoPhone: '0788 000 000', acceptTerms: true }, ownerTok);
check('Owner creates venue', r.status === 201, `payout number stored as ${r.json?.data?.momoPhone}`);
const venueId = r.json?.data?.id;
{
  const ownTok = await newOwner('Code Owner');
  const cv = await call('POST', '/venues', { name: 'Code Bar', momoPayCode: '55 1234', acceptTerms: true }, ownTok);
  check('Setup takes the MoMo Pay code (no payout number needed)', cv.status === 201 && cv.json?.data?.momoPayCode === '551234', JSON.stringify({ s: cv.status, c: cv.json?.data?.momoPayCode, e: cv.json?.error }));
}
{
  const st = await call('POST', '/venues', { name: 'Starter Cafe', acceptTerms: true, plan: 'basic' }, await newOwner('Starter owner'));
  const days = (new Date(st.json?.data?.trialEndsAt) - Date.now()) / 864e5;
  check('Sign-up picks the package: Go gets 2 weeks free', st.status === 201 && st.json?.data?.plan === 'basic' && days > 13 && days < 15, `${st.json?.data?.plan}, ${days.toFixed(1)} days`);
}
check('New venues start on Pro with a free month', r.json?.data?.plan === 'pro' && new Date(r.json?.data?.trialEndsAt) > new Date(Date.now() + 28 * 864e5), `${r.json?.data?.plan} until ${r.json?.data?.trialEndsAt}`);
await pg.query("update venues set plan='elite' where id=$1", [venueId]); // Bar+: everything below is available
check('Agreeing to the terms is recorded (version, time, name)', r.json?.data?.termsVersion === 3 && !!r.json?.data?.termsAcceptedAt && r.json?.data?.termsAcceptedBy === 'Owner', `v${r.json?.data?.termsVersion} by ${r.json?.data?.termsAcceptedBy}`);
r = await call('GET', '/auth/me', null, ownerTok);
check('App knows which terms version is current', r.json?.data?.currentTermsVersion === 3 && r.json?.data?.name === 'Owner', `v${r.json?.data?.currentTermsVersion}`);

const codes = [rnd() + rnd(), rnd() + rnd(), rnd() + rnd()];
for (const [i, c] of codes.entries()) {
  await pg.query(`insert into qr_stickers (code,status) values ($1,'unclaimed')`, [c]);
  r = await call('POST', '/tables/claim-scan', { venueId, label: `Table ${i + 1}`, scannedCode: `https://app/t/${c}` }, ownerTok);
  check(`Owner claims sticker → Table ${i + 1}`, r.status === 201, `status ${r.status}`);
}
{ // Stickers carry a big printed number: scanning one suggests "Table 7"
  const numbered = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,printed_label) values ($1,'unclaimed','7')`, [numbered]);
  const si = await call('GET', `/tables/sticker-info?code=${encodeURIComponent('https://skuzi.app/t/' + numbered)}`, null, ownerTok);
  check('Scanning a numbered sticker knows its printed number', si.json?.data?.printedLabel === '7' && si.json?.data?.claimed === false, JSON.stringify(si.json?.data));
}
r = await call('POST', '/tables/claim-scan', { venueId, label: 'Dup', scannedCode: codes[0] }, ownerTok);
check('Re-claiming a used sticker → clear error, server stays up', r.status === 400 && (await alive()), r.json?.error);

r = await call('POST', '/menu', { venueId, items: [
  { name: 'Primus', category: 'Drinks', priceRwf: 1500 },
  { name: 'Brochette', category: 'Food', priceRwf: 3000 },
  { name: 'Fanta', category: 'Drinks', priceRwf: 800 },
] }, ownerTok);
check('Owner adds menu', r.status === 201, `status ${r.status}`);
r = await call('GET', `/menu/${venueId}`);
const menu = r.json?.data?.items ?? [];
const item = (n) => menu.find((m) => m.name === n);

const waiterPhone = phone();
r = await call('POST', '/staff', { venueId, name: 'Alice', phone: waiterPhone.replace(/^0/, '+250 ') }, ownerTok);
check('Owner invites waiter (phone typed as +250 …)', r.status === 201 && r.json?.data?.staff?.phone === waiterPhone, `stored as ${r.json?.data?.staff?.phone}`);
const inviteToken = r.json?.data?.token;
r = await call('GET', `/staff/invite/${inviteToken}`);
check('Waiter opens invite link', r.status === 200);
r = await call('GET', `/staff/invite/${inviteToken}`);
check('Invite link still works until a PIN is set', r.status === 200, `status ${r.status}`);
let staffTok = r.json?.data?.token;
await call('POST', '/staff/me/set-pin', { pin: '1234' }, staffTok);
r = await call('GET', `/staff/invite/${inviteToken}`);
check('Invite link is used up once the PIN is set', r.status === 400, r.json?.error);
r = await call('POST', '/staff/login', { phone: waiterPhone, pin: '1234' });
check('Waiter logs in with phone + PIN', r.status === 200);
staffTok = r.json?.data?.token;
r = await call('GET', '/tables/my-tables', null, staffTok);
check('Waiter auto-assigned all tables', r.json?.data?.length === 3, `${r.json?.data?.length} tables`);

// ── 2. A night paid in cash ──────────────────────────────────────────────────
console.log('\n── Customer night (cash)');
const ownerWs = socket(`venueId=${venueId}&token=${ownerTok}`);
const staffWs = socket(`venueId=${venueId}&token=${staffTok}`);
await sleep(500);
// Menu first: scanning shows the venue and menu without asking for a number
{
  const tabsBefore = (await q1('select count(*)::int n from tabs')).n;
  r = await call('GET', `/tabs/preview/${codes[0]}`);
  check('Scan shows the menu before asking for a number', r.status === 200 && !!r.json?.data?.venue?.name && Object.keys(r.json?.data?.menuGrouped ?? {}).length > 0 && !!r.json?.data?.table?.label, JSON.stringify(r.json?.error ?? ''));
  check('…and opens no tab until the first order', (await q1('select count(*)::int n from tabs')).n === tabsBefore);
  r = await call('GET', '/tabs/preview/not-a-sticker');
  check('Unknown sticker → clear message', r.status === 404 && /set up/.test(r.json?.error ?? ''));
}
r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788111222', name: 'Bob' });
const tabId = r.json?.data?.tab?.id;
check('Customer scans QR → tab opens with waiter', r.status === 201 && !!r.json?.data?.tab?.staffId, `status ${r.status}`);
const vkeys = Object.keys(r.json?.data?.venue ?? {}).sort().join(',');
check('Customers only see public venue info', vkeys === 'acceptsMobileMoney,id,isDemo,logoUrl,momoPayCode,name,orderingPaused', vkeys);
const bobWs = socket(`venueId=${venueId}&tabId=${tabId}`);
const anonWs = socket(`venueId=${venueId}`);
await sleep(600);
check('Owner sees "guests seated" live', ownerWs.events.some((e) => e.type === 'tab_opened' && e.payload?.tabId === tabId));

r = await call('POST', '/orders', { tabId, items: [{ menuItemId: item('Primus').id, quantity: 2 }, { menuItemId: item('Brochette').id, quantity: 1 }] });
check('Customer places order', r.status === 201, `status ${r.status}`);
const orderId = r.json?.data?.order?.id ?? r.json?.data?.orderPayload?.orderId ?? r.json?.data?.id;
r = await call('POST', '/orders', { tabId, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
check('Second round', r.status === 201);
r = await call('POST', '/orders', { tabId, items: [{ menuItemId: item('Fanta').id, quantity: -3 }] });
check('Negative quantity refused', r.status === 400);

r = await call('GET', `/orders/venue/${venueId}`, null, staffTok);
check('Waiter sees orders', r.status === 200 && JSON.stringify(r.json).includes(tabId));
r = await call('PATCH', `/orders/${orderId}/status`, { status: 'preparing' }, staffTok);
check('Waiter marks preparing', r.status === 200);
r = await call('PATCH', `/orders/${orderId}/status`, { status: 'delivered' }, ownerTok);
check('Owner can also update order status', r.status === 200);
r = await call('POST', `/tabs/${tabId}/nudge`);
check('Customer calls waiter', r.status === 200);
r = await call('POST', `/tabs/${tabId}/request-bill`);
check('Customer requests bill', r.status === 200);
r = await call('GET', `/tabs/${tabId}/bill`);
check('Bill total correct (6,800)', r.json?.data?.grandTotal === 6800, `got ${r.json?.data?.grandTotal}`);
r = await call('POST', '/orders', { tabId, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
check('Ordering after bill → clear error, server stays up', r.status === 400 && (await alive()), r.json?.error);
r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788333444', choice: 'join' });
check('Another phone scanning the table gets its OWN bill, never this one', !!r.json?.data?.tab?.id && r.json?.data?.tab?.id !== tabId && !JSON.stringify(r.json).includes(tabId));
await call('POST', `/tabs/${r.json?.data?.tab?.id}/close`, { paidWith: 'cash' }, staffTok);
{ // "Add a friend": the only way onto Bob's bill is the code on Bob's phone
  r = await call('POST', `/tabs/${tabId}/join-code`);
  const joinCode = r.json?.data?.code;
  check('Bob\'s phone gets a join code for the QR', r.status === 200 && /^[A-Z2-9]{8}$/.test(joinCode ?? '') && r.json?.data?.qrCode === codes[0], JSON.stringify(r.json?.data));
  r = await call('POST', `/tabs/${tabId}/join-code`);
  check('…the same code every time (until the bill closes)', r.json?.data?.code === joinCode);
  r = await call('GET', `/tabs/join/${joinCode}`);
  check('The friend sees whose bill and which table', r.json?.data?.hostName === 'Bob' && r.json?.data?.tableLabel === 'Table 1', JSON.stringify(r.json?.data));
  r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: '0788 300 300', joinCode });
  check('The code only works at that table', r.status >= 400 && /expired/i.test(r.json?.error ?? ''), r.json?.error);
  const b0 = bobWs.events.length;
  r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788 300 300', joinCode: joinCode.toLowerCase() });
  await sleep(400);
  check('Friend with the code joins Bob\'s bill', r.json?.data?.tab?.id === tabId && r.json?.data?.isExisting === true, r.json?.error);
  check('…Bob\'s phone hears that they joined', bobWs.events.slice(b0).some((e) => e.type === 'bill_joined' && e.payload?.tabId === tabId && e.payload?.name === '…300'));
  const friend = await q1(`select id from customers where phone='0788300300'`);
  check('…the friend is saved as a guest on the bill', !!(await q1('select 1 as ok from tab_members where tab_id=$1 and customer_id=$2', [tabId, friend?.id])));
  r = await call('POST', '/guests/invites', { tabId, optIn: true, phone: '0788 300 300' });
  const optIns = await q1(`select (select invites_opt_in from customers where phone='0788300300') friend, (select invites_opt_in from customers where phone='0788111222') bob`);
  check('The friend\'s "yes" to invites is theirs, not Bob\'s', r.status === 200 && optIns.friend === true && optIns.bob === false, JSON.stringify(optIns));
  r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788 300 301', joinCode: 'WRONGCODE' });
  check('A made-up code doesn\'t work', r.status >= 400);
  globalThis.bobJoinCode = joinCode;
}

r = await call('POST', `/tabs/${tabId}/close`);
check('Anonymous CANNOT close a tab', r.status === 401, `status ${r.status}`);
r = await call('POST', `/tabs/${tabId}/close`, null, staffTok);
check('Waiter closes tab (cash)', r.status === 200);
r = await call('POST', '/ratings', { tabId, foodScore: 5, waiterScore: 4, overallScore: 5 });
check('Customer rates visit', r.status === 201);
r = await call('POST', '/ratings', { tabId, foodScore: 1, waiterScore: 1, overallScore: 1 });
check('Double rating → clear error, server stays up', r.status === 400 && (await alive()), r.json?.error);
await sleep(400);
check('Owner & waiter get live events', ['new_order', 'new_nudge', 'bill_requested', 'tab_closed'].every((t) => ownerWs.events.some((e) => e.type === t) && staffWs.events.some((e) => e.type === t)));
check('Customer socket only sees own tab events', bobWs.events.length > 1 && bobWs.events.every((e) => e.type === 'connected' || e.payload?.tabId === tabId), `${bobWs.events.length} events`);
check('Socket without login or tab is refused', !!anonWs.closed, anonWs.closed);

r = await call('GET', `/dashboard/stats/${venueId}`, null, ownerTok);
check('Dashboard revenue = 6,800', r.json?.data?.revenueTonight === 6800, `revenueTonight=${r.json?.data?.revenueTonight}`);
r = await call('GET', `/dashboard/tonight/${venueId}`, null, ownerTok);
check("Tonight's money for the chart & coin jar = 6,800", r.json?.data?.total === 6800 && r.json?.data?.hourly?.at(-1)?.cumulative === 6800, `total=${r.json?.data?.total}`);
for (const p of ['report', 'busy-hours', 'activity']) {
  r = await call('GET', `/dashboard/${p}/${venueId}`, null, ownerTok);
  check(`Owner ${p} works`, r.status === 200);
}
r = await call('GET', `/ratings/leaderboard/${venueId}`, null, ownerTok);
check('Leaderboard works', r.status === 200 && r.json?.data?.[0]?.name === 'Alice');

// ── 3. Mobile Money ──────────────────────────────────────────────────────────
console.log('\n── Mobile Money (fake pawaPay v2)');
r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: '0788555666' });
const t2 = r.json?.data?.tab?.id;
check('No MoMo Pay code yet → guests are asked to pay the waiter', r.json?.data?.venue?.acceptsMobileMoney === false);
await call('POST', '/orders', { tabId: t2, items: [{ menuItemId: item('Primus').id, quantity: 4 }] }); // 6,000
await call('POST', `/tabs/${t2}/request-bill`);
r = await call('POST', `/tabpayment/${t2}/pay`, { phone: '0711111111' });
check('Invalid Mobile Money number refused before any charge', r.status === 400 && pawa.state.deposits.size === 0, r.json?.error);
r = await call('POST', `/tabpayment/${t2}/pay`, { phone: '+250 788 555 666' });
const dep = r.json?.data?.depositId;
check('Customer starts payment (number typed as +250 …)', r.status === 200 && pawa.state.deposits.get(dep)?.payer?.accountDetails?.phoneNumber === '250788555666');
check('8% split correct (480 / 5,520)', r.json?.data?.commission === 480 && r.json?.data?.venuePayout === 5520);
r = await call('POST', `/tabpayment/${t2}/pay`, { phone: '0788555666' });
check('Tapping pay again re-uses the request (no double charge)', r.json?.data?.depositId === dep && pawa.state.deposits.size === 1);
r = await call('GET', `/tabpayment/${t2}/pay/status/${dep}`);
check('Status is pending while customer approves', r.json?.data?.status === 'pending');

pawa.state.deposits.get(dep).status = 'COMPLETED';
const [poll] = await Promise.all([
  call('GET', `/tabpayment/${t2}/pay/status/${dep}`),
  call('POST', '/tabpayment/callback/deposit', { depositId: dep, status: 'COMPLETED' }),
  call('GET', `/tabs/${t2}/pay/${dep}`),
]);
await sleep(800);
check('Payment confirmed', poll.json?.data?.status === 'successful');
check('Tab closed as paid', (await q1('select status from tabs where id=$1', [t2])).status === 'closed');
check('Venue paid out exactly once (no double payout in race)', pawa.state.payouts.length === 1 && pawa.state.payouts[0].amount === '5520', `${pawa.state.payouts.length} payouts`);
r = await call('POST', `/tabpayment/${t2}/pay`, { phone: '0788555666' });
check('Paid tab cannot be charged again', r.status === 400, r.json?.error);
check('Owner saw "tab paid" live', ownerWs.events.some((e) => e.type === 'tab_paid'));

r = await call('POST', '/tabs/open', { qrCode: codes[2], phone: '0788777888' });
const t3 = r.json?.data?.tab?.id;
await call('POST', '/orders', { tabId: t3, items: [{ menuItemId: item('Fanta').id, quantity: 5 }] }); // 4,000
r = await call('POST', `/tabs/${t3}/pay`, { phone: '0722777888' });
const dep3 = r.json?.data?.depositId;
check('Airtel number routed to Airtel', pawa.state.deposits.get(dep3)?.payer?.accountDetails?.provider === 'AIRTEL_RWA');
pawa.state.deposits.get(dep3).status = 'COMPLETED';
pawa.state.rejectNextPayout = true;
await call('POST', '/tabpayment/callback/deposit', { depositId: dep3 });
await sleep(800);
let p3 = await q1('select status, disbursement_status from momo_payments where reference_id=$1', [dep3]);
check('Webhook alone settles payment (customer left)', p3.status === 'successful' && (await q1('select status from tabs where id=$1', [t3])).status === 'closed');
check('Failed payout recorded, tab still closed', p3.disbursement_status === 'failed', p3.disbursement_status);
console.log('… waiting for the background job to retry the payout (≤ 130s)');
let retried = null;
for (let i = 0; i < 26 && !retried; i++) {
  await sleep(5000);
  const p = await q1('select disbursement_reference_id r, disbursement_status s from momo_payments where reference_id=$1', [dep3]);
  const po = pawa.state.payouts.find((x) => x.payoutId === p.r);
  if (po) retried = { po, s: p.s };
}
check('Failed payout retried automatically', retried?.po?.amount === '3680' && retried.s === 'pending', retried ? `${retried.po.amount} RWF` : 'no retry');

// History: MoMo bills show their payout; any past night can be opened.
r = await call('GET', `/dashboard/activity/${venueId}`, null, ownerTok);
const momoBills = (r.json?.data ?? []).filter((t) => t.payment?.method === 'momo');
check('History shows MoMo bills with their payout', momoBills.length >= 1 && momoBills.every((t) => ['pending', 'successful', 'failed'].includes(t.payment.payoutStatus) && t.payment.amountRwf > 0), `${momoBills.length} MoMo bills`);
r = await call('GET', `/dashboard/activity/${venueId}?night=2026-01-01`, null, ownerTok);
check('History opens a past night', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length === 0, `status ${r.status}`);
r = await call('GET', `/dashboard/activity/${venueId}?night=yesterday`, null, ownerTok);
check('History refuses a badly written date', r.status === 400, `status ${r.status}`);
const thisMonth = new Date(Date.now() + 2 * 3600e3 - 6 * 3600e3).toISOString().slice(0, 7);
r = await call('GET', `/dashboard/nights/${venueId}?month=${thisMonth}`, null, ownerTok);
check('Calendar shows this month\'s nights with their sales', r.status === 200 && (r.json?.data?.nights ?? []).some((n) => n.total > 0 && n.bills > 0), `${r.json?.data?.nights?.length} nights`);
r = await call('GET', `/dashboard/nights/${venueId}?month=2026-13`, null, ownerTok);
check('Calendar refuses a month that doesn\'t exist', r.status === 400, `status ${r.status}`);

r = await call('POST', '/tabs/open', { qrCode: codes[2], phone: '0788121212' });
const t6 = r.json?.data?.tab?.id;
await call('POST', '/orders', { tabId: t6, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
r = await call('POST', `/tabpayment/${t6}/pay`, { phone: '0788121212' });
const dep6 = r.json?.data?.depositId;
pawa.state.deposits.get(dep6).status = 'FAILED';
pawa.state.deposits.get(dep6).failureCode = 'PAYMENT_NOT_APPROVED';
r = await call('GET', `/tabpayment/${t6}/pay/status/${dep6}`);
check('Customer declines on phone → clear reason, bill stays open', r.json?.data?.status === 'failed' && /approved/.test(r.json?.data?.failureMessage ?? '') && (await q1('select status from tabs where id=$1', [t6])).status !== 'closed', r.json?.data?.failureMessage);
pawa.state.fail500NextDeposit = true;
r = await call('POST', `/tabpayment/${t6}/pay`, { phone: '0788121212' });
const dep7 = r.json?.data?.depositId;
check('pawaPay timeout but request arrived → payment still tracked', r.status === 200 && pawa.state.deposits.has(dep7), `status ${r.status}`);

await pg.query('update venues set momo_phone=null where id=$1', [venueId]);
r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: '0788999111' });
const t4 = r.json?.data?.tab?.id;
check('No payout number → customer told Mobile Money is unavailable', r.json?.data?.venue?.acceptsMobileMoney === false);
await call('POST', '/orders', { tabId: t4, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
const before = pawa.state.deposits.size;
r = await call('POST', `/tabpayment/${t4}/pay`, { phone: '0788999111' });
check('…and no money is requested', r.status === 400 && pawa.state.deposits.size === before, r.json?.error);
r = await call('PATCH', `/venues/${venueId}/momo-phone`, { momoPhone: '0788 123 456' }, ownerTok);
check('Owner can set payout number later', r.status === 200 && r.json?.data?.momoPhone === '0788123456');
check('Every request matched the pawaPay v2 format', pawa.state.schemaErrors.length === 0, pawa.state.schemaErrors.join(' | '));

// ── Demo venue: payments are simulated, no money moves ───────────────────────
console.log('\n── Demo venue');
const owner1 = await q1(`select owner_id from venues where id=$1`, [venueId]);
const demo = await q1(`insert into venues (owner_id,name,trial_ends_at,is_demo,plan) values ($1,'Demo Lounge',now()+interval '30 days',true,'elite') returning id`, [owner1.owner_id]);
const demoTable = await q1(`insert into tables (venue_id,label) values ($1,'Table 1') returning id`, [demo.id]);
const demoCode = rnd() + rnd();
await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [demoCode, demoTable.id]);
const demoItem = await q1(`insert into menu_items (venue_id,name,category,price_rwf) values ($1,'Primus','Beers',1500) returning id`, [demo.id]);
r = await call('POST', '/tabs/open', { qrCode: demoCode, phone: '0788444333' });
const td = r.json?.data?.tab?.id;
check('Demo venue: customer sees "demo" and can pay', r.json?.data?.venue?.isDemo === true && r.json?.data?.venue?.acceptsMobileMoney === true, `status ${r.status}`);
await call('POST', '/orders', { tabId: td, items: [{ menuItemId: demoItem.id, quantity: 2 }] });
const depsBefore = pawa.state.deposits.size, payoutsBefore = pawa.state.payouts.length;
r = await call('POST', `/tabpayment/${td}/pay`, { phone: '0788444333' });
const depD = r.json?.data?.depositId;
check('Demo payment starts without asking pawaPay for money', r.status === 200 && !!depD && pawa.state.deposits.size === depsBefore, r.json?.error);
r = await call('GET', `/tabpayment/${td}/pay/status/${depD}`);
check('Demo payment shows "waiting" first', r.json?.data?.status === 'pending');
await sleep(4500);
r = await call('GET', `/tabpayment/${td}/pay/status/${depD}`);
check('Demo payment "succeeds" after a few seconds, tab closed', r.json?.data?.status === 'successful' && (await q1('select status from tabs where id=$1', [td])).status === 'closed');
check('Demo venue: no money paid out', pawa.state.payouts.length === payoutsBefore && pawa.state.deposits.size === depsBefore);

// ── 4. Locked phone ──────────────────────────────────────────────────────────
console.log('\n── Locked phone');
await pg.query(`update tabs set last_seen_at = now() - interval '11 minutes' where id=$1`, [t4]);
const awayOf = () => ownerWs.events.filter((e) => e.type === 'customer_away' && e.payload?.tabId === t4).length;
const awayBefore = awayOf();
// The check walks every quiet bill in turn, so on a slow machine it can take
// more than one 30s round to reach this one: wait for it, up to 90s.
console.log('… waiting for the "stepped away" check (≤ 90s)');
for (let waited = 0; waited < 90_000 && awayOf() === awayBefore; waited += 2_000) await sleep(2_000);
await sleep(3_000); // …and make sure it doesn't come twice
const awayAlerts = awayOf() - awayBefore;
check('Quiet 5+ min → tab stays open, one alert', (await q1('select status from tabs where id=$1', [t4])).status === 'open' && awayAlerts === 1, `alerts=${awayAlerts}`);
r = await call('POST', '/orders', { tabId: t4, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
check('Customer can keep ordering after phone was locked', r.status === 201);
await pg.query(`update tabs set status='abandoned' where id=$1`, [t4]);
r = await call('POST', '/orders', { tabId: t4, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
check('Old "abandoned" bill: its own phone can still order on it', r.status === 201 && (await q1('select status from tabs where id=$1', [t4])).status === 'open', r.json?.error);

// ── Join the team (waiter scans the clock-in sticker) ────────────────────────
console.log('\n── Join the team');
const rivalTokEarly = await newOwner('Rival early');
const clockCode = ('CK' + rnd()).toUpperCase();
r = await call('POST', `/clockin/claim/${venueId}`, { code: clockCode }, ownerTok);
check('Owner claims the clock-in sticker', r.status === 200, r.json?.error);
const newPhone = phone();
r = await call('POST', '/staff/join', { code: clockCode, name: 'Eric', phone: newPhone, pin: '4321' });
const ericId = (await q1('select id from staff where phone=$1 and venue_id=$2', [newPhone, venueId]))?.id;
check('New waiter asks to join by scanning the sticker', r.status === 201 && !!ericId, r.json?.error);
await sleep(300);
check('Owner is told live "Eric wants to join"', ownerWs.events.some((e) => e.type === 'staff_join_request' && e.payload?.name === 'Eric'));
r = await call('POST', '/staff/login', { phone: newPhone, pin: '4321' });
check('Waiter cannot log in before approval (clear reason)', r.status !== 200 && /approved/.test(r.json?.error ?? ''), r.json?.error);
r = await call('POST', '/staff/join', { code: 'NOPE123', name: 'Eve', phone: phone(), pin: '1111' });
check('Unknown sticker → join refused', r.status === 400);
r = await call('POST', `/staff/${ericId}/approve`, null, rivalTokEarly);
check('Another owner CANNOT approve my join requests', r.status === 403, `status ${r.status}`);
r = await call('POST', `/staff/${ericId}/approve`, null, ownerTok);
check('Owner approves with one tap', r.status === 200, r.json?.error);
r = await call('POST', '/staff/login', { phone: newPhone, pin: '4321' });
check('Approved waiter logs in with the PIN they chose', r.status === 200, r.json?.error);
r = await call('GET', `/tables/assignments/${venueId}`, null, ownerTok);
check('Approved waiter gets tables automatically', (r.json?.data ?? []).some((a) => a.staffId === ericId && a.tableIds.length > 0));
r = await call('POST', '/staff/join', { code: clockCode, name: 'Eric', phone: newPhone, pin: '4321' });
check('Already on the team → told to log in instead', r.status === 400 && /already on the team/.test(r.json?.error ?? ''), r.json?.error);

// ── Notifications reach the right phones (fake push service on :3097) ───────
console.log('\n── Notifications');
const pushHits = [];
// Push services are always https: serve a throwaway self-signed certificate
// (the test server runs with NODE_TLS_REJECT_UNAUTHORIZED=0).
const certDir = mkdtempSync(join(tmpdir(), 'tabpro-push-'));
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${certDir}/k.pem -out ${certDir}/c.pem -days 1 -subj /CN=localhost`, { stdio: 'ignore' });
const pushServer = https
  .createServer({ key: readFileSync(`${certDir}/k.pem`), cert: readFileSync(`${certDir}/c.pem`) }, (req, res) => { pushHits.push(req.url); req.resume(); res.statusCode = 201; res.end(); })
  .listen(3097);
const device = (name) => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint: `https://localhost:3097/${name}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
};
const ericTok = r.json?.data?.token ?? (await call('POST', '/staff/login', { phone: newPhone, pin: '4321' })).json?.data?.token;
const sameDevice = device('jordan-phone');
r = await call('POST', '/push/subscribe', { venueId, subscription: device('owner') }, ownerTok);
check('Owner turns on notifications', r.status === 201, r.json?.error);
r = await call('POST', '/push/subscribe', { venueId, subscription: device('alice') }, staffTok);
check('Waiter turns on notifications', r.status === 201, r.json?.error);
await call('POST', '/push/subscribe', { venueId, subscription: device('eric') }, ericTok);
await call('POST', '/push/subscribe', { venueId, subscription: sameDevice }, ownerTok);
r = await call('POST', '/push/subscribe', { venueId, subscription: sameDevice }, ericTok);
const sameRows = await q1('select count(*)::int n from push_subscriptions where endpoint=$1', [sameDevice.endpoint]);
check('One phone can get alerts as owner AND as waiter', r.status === 201 && sameRows.n === 2, `${sameRows.n} rows`);
const pushTableRow = await q1(`insert into tables (venue_id,label) values ($1,'Terrace 1') returning id`, [venueId]);
const pushCode = rnd() + rnd();
await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [pushCode, pushTableRow.id]);
await pg.query(`insert into table_assignments (table_id,staff_id,shift_date) values ($1,$2,'permanent')`, [pushTableRow.id, ericId]);
const ericTable = { code: pushCode };
pushHits.length = 0;
r = await call('POST', '/tabs/open', { qrCode: ericTable.code, phone: phone() });
const pushTab = r.json?.data?.tab?.id;
await sleep(800);
check('Guests seated → their waiter and the owner are told', pushHits.includes('/eric') && pushHits.includes('/owner'), pushHits.join(' '));
await call('POST', '/push/subscribe-tab', { tabId: pushTab, subscription: device('guest') });
pushHits.length = 0;
r = await call('POST', '/orders', { tabId: pushTab, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
const pushOrderId = r.json?.data?.order?.id;
await sleep(800);
check('New order → that table\'s waiter and the owner are notified', pushHits.includes('/eric') && pushHits.includes('/owner'), pushHits.join(' '));
check('…and other waiters are not disturbed', !pushHits.includes('/alice'), pushHits.join(' '));
check('A phone signed in twice gets the alert once', pushHits.filter((h) => h === '/jordan-phone').length === 1, pushHits.join(' '));
check('Guest is not told about their own order', !pushHits.includes('/guest'), pushHits.join(' '));
pushHits.length = 0;
await call('PATCH', `/orders/${pushOrderId}/status`, { status: 'preparing' }, ericTok);
await sleep(800);
check('Waiter starts the order → guest gets "being prepared"', pushHits.includes('/guest'), pushHits.join(' '));
// An order nobody starts for 10 minutes: waiter and owner are reminded once.
r = await call('POST', '/orders', { tabId: pushTab, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
await pg.query(`update orders set placed_at = now() - interval '11 minutes' where id=$1`, [r.json?.data?.order?.id]);
pushHits.length = 0;
console.log('… waiting for the "order waiting" check (≤ 65s)');
for (let i = 0; i < 65 && !pushHits.includes('/owner'); i++) await sleep(1000);
check('Order waiting 10+ min → waiter and owner reminded', pushHits.includes('/eric') && pushHits.includes('/owner'), pushHits.join(' '));
// Customer closes the page: never an alarm (people talk for hours with their
// phone away), just a quiet sign on staff screens that clears when they're back.
pushHits.length = 0;
const awayBefore2 = ownerWs.events.filter((e) => e.type === 'customer_away' && e.payload?.tabId === pushTab).length;
await call('POST', `/tabs/${pushTab}/left`);
await sleep(2000);
await call('POST', `/tabs/${pushTab}/heartbeat`);
console.log('… checking the "phone closed" sign (≈45s)');
await sleep(21000);
check('Customer reloads the page → no sign, no alert', ownerWs.events.filter((e) => e.type === 'customer_away' && e.payload?.tabId === pushTab).length === awayBefore2);
await call('POST', `/tabs/${pushTab}/left`);
await sleep(21500);
check('Customer closes the page → quiet "phone closed" sign on staff screens', ownerWs.events.filter((e) => e.type === 'customer_away' && e.payload?.tabId === pushTab).length === awayBefore2 + 1);
check('…and nobody\'s phone buzzes for it', pushHits.length === 0, pushHits.join(' '));
await call('POST', `/tabs/${pushTab}/heartbeat`);
await sleep(500);
check('Guest opens TabPro again → the sign goes away', ownerWs.events.some((e) => e.type === 'customer_back' && e.payload?.tabId === pushTab));
// A bill nobody has touched for hours shows up for the owner, with the guest's number.
await pg.query(`update tabs set last_seen_at = now() - interval '3 hours', opened_at = now() - interval '4 hours' where id=$1`, [pushTab]);
r = await call('GET', `/dashboard/open-bills/${venueId}`, null, ownerTok);
const leftOpen = (r.json?.data ?? []).find((b) => b.tabId === pushTab);
check('Owner sees bills left open, with amount and guest phone', !!leftOpen && leftOpen.total > 0 && /^07\d{8}$/.test(leftOpen.phone ?? ''), JSON.stringify(leftOpen));
r = await call('GET', `/dashboard/open-bills/${venueId}`, null, rivalTokEarly);
check('Another owner CANNOT see my open bills', r.status === 403, `status ${r.status}`);
pushHits.length = 0;
await call('POST', `/tabs/${pushTab}/close`, null, ericTok);
await sleep(800);
check('Waiter closes a bill (cash) → owner is told', pushHits.includes('/owner'), pushHits.join(' '));
pushHits.length = 0;
await call('POST', '/ratings', { tabId: pushTab, foodScore: 2, waiterScore: 2, overallScore: 2, comment: 'Slow service' });
await sleep(800);
check('Bad rating → owner is told tonight', pushHits.includes('/owner'), pushHits.join(' '));

// ── Managers and waiters without a smartphone ───────────────────────────────
console.log('\n── Managers & waiters without a smartphone');
r = await call('POST', '/staff', { venueId, name: 'Grace', phone: phone(), hasSmartphone: false }, ownerTok);
const graceId = r.json?.data?.staff?.id;
check('Owner adds a waiter without a smartphone (no invite needed)', r.status === 201 && !r.json?.data?.token && r.json?.data?.inviteUrl === null, r.json?.error);
r = await call('GET', `/staff/${venueId}`, null, ownerTok);
check('Staff list shows "no smartphone"', (r.json?.data ?? []).find((m) => m.id === graceId)?.inviteStatus === 'no_phone');
const managerPhone = phone();
r = await call('POST', '/staff', { venueId, name: 'Mama Kevin', phone: managerPhone, role: 'manager' }, ownerTok);
const managerId = r.json?.data?.staff?.id;
const mInvite = r.json?.data?.token;
check('Owner adds a manager', r.status === 201 && r.json?.data?.staff?.role === 'manager', r.json?.error);
let managerTok = (await call('GET', `/staff/invite/${mInvite}`)).json?.data?.token;
await call('POST', '/staff/me/set-pin', { pin: '2468' }, managerTok);
r = await call('POST', '/staff/login', { phone: managerPhone, pin: '2468' });
managerTok = r.json?.data?.token;
check('Manager logs in like a waiter', r.status === 200 && r.json?.data?.role === 'manager', r.json?.error);
r = await call('GET', '/staff/me', null, managerTok);
check('App knows they are a manager', r.json?.data?.role === 'manager');
r = await call('GET', `/tables/assignments/${venueId}`, null, ownerTok);
check('Manager is not given tables (waiters serve them)', !(r.json?.data ?? []).some((a) => a.staffId === managerId && a.tableIds.length > 0));
r = await call('GET', '/tables/my-tables', null, managerTok);
check('Manager sees the whole floor with each table\'s waiter', (r.json?.data ?? []).length >= 3 && (r.json?.data ?? []).some((t) => t.waiterName === 'Grace' && t.waiterHasSmartphone === false), JSON.stringify((r.json?.data ?? []).map((t) => t.waiterName)));
r = await call('PATCH', `/staff/${graceId}`, { role: 'manager' }, rivalTokEarly);
check('Another owner CANNOT change my staff', r.status === 403, `status ${r.status}`);

// Grace's table: alerts go to the manager's phone, naming Grace
const graceTable = await q1(`insert into tables (venue_id,label) values ($1,'Garden 1') returning id`, [venueId]);
const graceCode = rnd() + rnd();
await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [graceCode, graceTable.id]);
await pg.query(`insert into table_assignments (table_id,staff_id,shift_date) values ($1,$2,'permanent')`, [graceTable.id, graceId]);
r = await call('POST', '/tabs/open', { qrCode: graceCode, phone: phone() });
const graceTab = r.json?.data?.tab?.id;
await sleep(600);
pushHits.length = 0;
await call('POST', `/tabs/${graceTab}/nudge`);
await sleep(800);
check('No manager phone signed up yet → the owner covers Grace\'s table', pushHits.includes('/owner') && !pushHits.includes('/eric'), pushHits.join(' '));
await call('POST', '/push/subscribe', { venueId, subscription: device('manager') }, managerTok);
pushHits.length = 0;
await call('POST', `/tabs/${graceTab}/nudge`);
await sleep(800);
check('Customer calls at Grace\'s table → her manager\'s phone buzzes', pushHits.includes('/manager') && !pushHits.includes('/eric') && !pushHits.includes('/alice'), pushHits.join(' '));
check('…and the owner still hears about it', pushHits.includes('/owner'), pushHits.join(' '));
// A table whose waiter has their own phone: that waiter is told, not the manager.
const phoneWaiterTable = await q1(`select t.id, s.code from tables t join qr_stickers s on s.table_id=t.id join table_assignments a on a.table_id=t.id join staff w on w.id=a.staff_id where t.venue_id=$1 and w.has_smartphone and w.role='waiter' and w.name in ('Alice','Eric') and not exists (select 1 from tabs x where x.table_id=t.id and x.status<>'closed') limit 1`, [venueId]);
r = await call('POST', '/tabs/open', { qrCode: phoneWaiterTable.code, phone: phone() });
pushHits.length = 0;
await call('POST', '/orders', { tabId: r.json?.data?.tab?.id, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
await sleep(800);
check('Waiters with their own phone are not covered by the manager', (pushHits.includes('/eric') || pushHits.includes('/alice')) && !pushHits.includes('/manager'), pushHits.join(' '));
pushServer.close();

const strangerPhone = phone();
await call('POST', '/staff/join', { code: clockCode, name: 'Stranger', phone: strangerPhone, pin: '9999' });
const strangerId = (await q1('select id from staff where phone=$1', [strangerPhone]))?.id;
r = await call('DELETE', `/staff/${strangerId}/join-request`, null, ownerTok);
check('Owner declines a stranger → removed', r.status === 200 && !(await q1('select id from staff where id=$1', [strangerId])));

// ── Guests' own Skuzi: Explore, venue page, bookings, campaigns ─────────────
console.log('\n── Explore, bookings & campaigns');
{
  const kigaliKey = (d) => new Date(d.getTime() + 2 * 3600e3).toISOString().slice(0, 10);
  const addDays = (k, n) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const today = kigaliKey(new Date());
  const tomorrow = addDays(today, 1);
  const crypto = await import('crypto');
  const fakeDevice = () => {
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    return { endpoint: `https://push.invalid/${rnd()}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  };
  // A request nobody answers expires on its own (checked at the end of the run).
  await pg.query(`insert into bookings (venue_id,name,phone,party_size,starts_at,access_token) values ($1,'Late Larry','0788000777',2,now() - interval '2 minutes','tok-expire')`, [venueId]);

  const slugRow = await q1('select slug from venues where id=$1', [venueId]);
  check('Every venue gets its own web address', slugRow?.slug === 'test-bar', slugRow?.slug);
  r = await call('GET', '/guests/v/test-bar');
  check('Venue page shows the real menu and 3 dishes', r.status === 200 && Object.keys(r.json?.data?.menu ?? {}).length > 0 && r.json?.data?.picks?.items?.length > 0, `${r.json?.data?.picks?.label}`);
  r = await call('GET', '/guests/explore');
  check('Explore lists the venue', (r.json?.data?.venues ?? []).some((v) => v.slug === 'test-bar'));
  check('Explore never shows a demo venue', !(r.json?.data?.venues ?? []).some((v) => v.name === 'Demo Lounge'));
  r = await call('GET', '/guests/v/nope-nope');
  check('Unknown venue page → 404', r.status === 404);

  // Chef's picks: max 3
  await call('POST', '/menu', { venueId, items: [{ name: 'Water', category: 'Drinks', priceRwf: 500 }] }, ownerTok);
  const all = (await call('GET', `/menu/${venueId}`)).json?.data?.items ?? [];
  const byName = (n) => all.find((m) => m.name === n);
  for (const n of ['Primus', 'Brochette', 'Fanta']) await call('PATCH', `/menu/items/${byName(n).id}`, { featured: true }, ownerTok);
  r = await call('PATCH', `/menu/items/${byName('Water').id}`, { featured: true }, ownerTok);
  check("A 4th chef's pick is refused (3 max)", r.status === 400, r.json?.error);
  r = await call('GET', '/guests/v/test-bar');
  check("Venue page leads with the chef's picks", r.json?.data?.picks?.label === "Chef's picks" && r.json?.data?.picks?.items?.length === 3);

  // Opening hours
  r = await call('PATCH', `/venues/${venueId}/settings`, { openingHours: { mon: { open: '25:00', close: '02:00' } } }, ownerTok);
  check('Broken opening hours are refused', r.status === 400, r.json?.error);
  const night = { open: '10:00', close: '02:00' };
  r = await call('PATCH', `/venues/${venueId}/settings`, { openingHours: { mon: night, tue: night, wed: night, thu: night, fri: night, sat: night, sun: null } }, ownerTok);
  check('Owner sets opening hours (past midnight, closed Sundays)', r.status === 200);
  const nextWeekday = (() => { for (let i = 1; i < 8; i++) { const k = addDays(today, i); if (new Date(k + 'T12:00:00Z').getUTCDay() !== 0) return k; } })();
  const nextSunday = (() => { for (let i = 1; i < 8; i++) { const k = addDays(today, i); if (new Date(k + 'T12:00:00Z').getUTCDay() === 0) return k; } })();
  r = await call('GET', `/guests/v/test-bar/times?date=${nextWeekday}`);
  const times = r.json?.data?.times ?? [];
  check('Booking times run from opening to an hour before closing (past midnight)', times[0] === '10:00' && times.includes('01:00') && !times.includes('01:30'), `${times[0]}…${times.at(-1)}`);
  r = await call('GET', `/guests/v/test-bar/times?date=${nextSunday}`);
  check('No booking times on a closed day', r.json?.data?.open === false && r.json?.data?.times?.length === 0);

  // Bookings
  const booking = { slug: 'test-bar', date: nextWeekday, time: '20:00', partySize: 4, name: 'Grace', phone: '+250 788 600 700', note: 'Birthday!' };
  r = await call('POST', '/guests/bookings', booking);
  const b1 = r.json?.data;
  check('Guest books a table (request sent)', r.status === 201 && b1?.status === 'pending' && !!b1?.token, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, time: '21:00' });
  check('Same guest, same night, same venue → told they already booked', r.status === 409, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '0788600711', time: '20:15' });
  check('A time that is not offered is refused', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '0788600712', date: addDays(today, -2) });
  check('A day in the past is refused', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '0788600713', date: addDays(today, 45) });
  check('More than 30 days ahead is refused', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '0788600714', partySize: 0 });
  check('A party of 0 is refused', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '12345' });
  check('A phone that is not Rwandan mobile is refused', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, date: nextSunday });
  check('Booking a closed day is refused', r.status === 400, r.json?.error);
  r = await call('GET', `/guests/bookings/${b1?.id}?t=${b1?.token}`);
  check('Guest can see their booking with their private link', r.status === 200 && r.json?.data?.name === 'Grace');
  r = await call('GET', `/guests/bookings/${b1?.id}?t=wrong`);
  check('…but not without the right link', r.status === 404);
  r = await call('GET', `/venue-bookings/${venueId}?date=${nextWeekday}`, null, ownerTok);
  check('Owner sees the request on that night', (r.json?.data?.bookings ?? []).some((b) => b.id === b1?.id && b.status === 'pending' && b.partySize === 4) && r.json?.data?.pendingTotal >= 1);
  r = await call('GET', `/venue-bookings/${venueId}?date=${nextWeekday}`, null, rivalTokEarly);
  check('Another owner CANNOT see my bookings', r.status === 403, `status ${r.status}`);
  r = await call('POST', `/venue-bookings/${venueId}/${b1?.id}/accept`, {}, rivalTokEarly);
  check('Another owner CANNOT accept my bookings', r.status === 403, `status ${r.status}`);
  const tbl = await q1(`select id,label from tables where venue_id=$1 order by label limit 1`, [venueId]);
  r = await call('POST', `/venue-bookings/${venueId}/${b1?.id}/accept`, { tableId: tbl.id }, ownerTok);
  check('Owner accepts and picks a table', r.status === 200 && r.json?.data?.status === 'confirmed' && r.json?.data?.tableId === tbl.id, r.json?.error);
  r = await call('POST', `/venue-bookings/${venueId}/${b1?.id}/accept`, {}, ownerTok);
  check('Accepting twice is refused politely', r.status === 400, r.json?.error);
  r = await call('POST', '/guests/bookings', { ...booking, phone: '0788600800', name: 'Eric', time: '21:00' });
  const b2 = r.json?.data;
  r = await call('POST', `/venue-bookings/${venueId}/${b2?.id}/accept`, { tableId: tbl.id }, ownerTok);
  check('Same table within 2 hours → owner told to pick another', r.status === 409 && /already booked/.test(r.json?.error ?? ''), r.json?.error);
  r = await call('POST', `/guests/bookings/${b2?.id}/cancel`, { t: b2?.token });
  check('Guest cancels with their link', r.status === 200 && r.json?.data?.status === 'cancelled');
  r = await call('GET', `/guests/bookings/${b1?.id}?t=${b1?.token}`);
  check('Guest sees "confirmed" and their table', r.json?.data?.status === 'confirmed' && r.json?.data?.table === tbl.label);

  // Arrival: guests scan the table → booking marked arrived
  const arrTable = await q1(`insert into tables (venue_id,label) values ($1,'Table 9') returning id`, [venueId]);
  const arrCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [arrCode, arrTable.id]);
  const arrCust = await q1(`insert into customers (phone,name) values ('0788600900','Aline') returning id`);
  const arr = await q1(`insert into bookings (venue_id,customer_id,name,phone,party_size,starts_at,status,table_id,access_token) values ($1,$2,'Aline','0788600900',6,now() + interval '20 minutes','confirmed',$3,'tok-arr') returning id`, [venueId, arrCust.id, arrTable.id]);
  await call('POST', '/tabs/open', { qrCode: arrCode, phone: '0788 600 900' });
  check('Booked guests scan their table → booking marked arrived', (await q1('select status from bookings where id=$1', [arr.id])).status === 'seated');
  r = await call('GET', `/venue-bookings/${venueId}/tables`, null, ownerTok);
  check('Tables screen knows tonight\'s reservations', Array.isArray(r.json?.data));

  // Campaigns: only guests who said yes, and who have a device
  r = await call('GET', `/campaigns/audience/${venueId}`, null, ownerTok);
  check('A new venue starts with an audience of 0 (honest)', r.json?.data?.total === 0, JSON.stringify(r.json?.data));
  r = await call('POST', '/guests/invites', { tabId: t2, optIn: true, subscription: fakeDevice() });
  const guestTok = r.json?.data?.guestToken;
  check('Guest says yes to invites after paying (device saved)', r.status === 200 && !!guestTok, r.json?.error);
  r = await call('GET', '/guests/me', null, guestTok);
  check('Guest can see their own invite setting', r.json?.data?.invitesOptIn === true && r.json?.data?.hasDevice === true);
  r = await call('GET', '/guests/me');
  check('…but nobody else can', r.status === 401);
  r = await call('POST', '/guests/invites', { tabId: td, optIn: true, subscription: fakeDevice() });
  check('A guest of another venue says yes too', r.status === 200);
  r = await call('GET', `/campaigns/audience/${venueId}`, null, ownerTok);
  check('Audience: 1 regular, 1 other Skuzi guest', r.json?.data?.regulars === 1 && r.json?.data?.others === 1, JSON.stringify(r.json?.data));
  r = await call('POST', '/campaigns', { venueId, title: 'Karaoke Friday', message: 'Come sing with us from 20:00!', offerType: 'free_item', audience: 'regulars' }, ownerTok);
  check('A free-item offer needs to say what it is', r.status === 400, r.json?.error);
  const eventAt = new Date(Date.now() + 26 * 3600e3).toISOString();
  r = await call('POST', '/campaigns', { venueId, title: 'Karaoke Friday', message: 'Come sing with us from 20:00!', offerType: 'discount_10', audience: 'regulars', eventAt }, ownerTok);
  const c1 = r.json?.data;
  check('Owner sends a campaign to regulars → only regulars get it', r.status === 201 && c1?.status === 'sent' && c1?.recipientCount === 1, `${c1?.recipientCount} reached`);
  r = await call('GET', '/guests/explore');
  check('The campaign shows on Explore as an event', (r.json?.data?.events ?? []).some((e) => e.id === c1?.id && /10% off/.test(e.offer ?? '')));
  r = await call('GET', `/campaigns/${venueId}`, null, rivalTokEarly);
  check('Another owner CANNOT see my campaigns', r.status === 403);

  // The campaign brings the guest back: 10% off with Skuzi, Skuzi takes 15%
  const backTable = await q1(`insert into tables (venue_id,label) values ($1,'Table 10') returning id`, [venueId]);
  const backCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [backCode, backTable.id]);
  r = await call('POST', '/tabs/open', { qrCode: backCode, phone: '0788555666' });
  const tBack = r.json?.data?.tab?.id;
  check('Guest comes back → Skuzi knows the campaign brought them', r.json?.data?.offer?.offerType === 'discount_10', JSON.stringify(r.json?.data?.offer));
  await call('POST', '/orders', { tabId: tBack, items: [{ menuItemId: item('Primus').id, quantity: 2 }] }); // 3,000
  r = await call('GET', `/tabs/${tBack}/bill`);
  check('Bill shows 10% off when paying with Skuzi', r.json?.data?.grandTotal === 3000 && r.json?.data?.payWithSkuziTotal === 2700, `${r.json?.data?.payWithSkuziTotal}`);
  r = await call('POST', `/tabpayment/${tBack}/pay`, { phone: '0788555666' });
  check('Guest pays 2,700; Skuzi takes 15% (405), venue gets 2,295', r.json?.data?.grandTotal === 2700 && r.json?.data?.commission === 405 && r.json?.data?.venuePayout === 2295, JSON.stringify(r.json?.data));
  r = await call('GET', `/campaigns/${venueId}/${c1?.id}`, null, ownerTok);
  check('Campaign results: 1 guest came, a regular', r.json?.data?.results?.came === 1 && r.json?.data?.results?.regulars === 1, JSON.stringify(r.json?.data?.results));

  // Limits: 2 campaigns a week per venue, 2 invites a week per guest
  r = await call('POST', '/campaigns', { venueId, title: 'Live band', message: 'Live band tonight!', offerType: 'free_item', offerLabel: 'Free shot', audience: 'everyone' }, ownerTok);
  check('Second campaign to everyone reaches both guests', r.status === 201 && r.json?.data?.recipientCount === 2, `${r.json?.data?.recipientCount}`);
  r = await call('POST', '/campaigns', { venueId, title: 'Third', message: 'One more thing!', offerType: 'none', audience: 'everyone' }, ownerTok);
  check('A third campaign in one week is refused (keeps invites special)', r.status === 429, r.json?.error);
  r = await call('POST', '/campaigns', { venueId: demo.id, title: 'Demo night', message: 'Come try Skuzi!', offerType: 'none', audience: 'everyone' }, ownerTok);
  check('A guest who already got 2 invites this week is skipped', r.status === 201 && r.json?.data?.recipientCount === 1, `${r.json?.data?.recipientCount}`);
  const sched = await call('POST', '/campaigns', { venueId: demo.id, title: 'Later', message: 'Next week!', offerType: 'none', audience: 'regulars', sendAt: new Date(Date.now() + 3 * 86400e3).toISOString() }, ownerTok);
  check('A campaign can be scheduled for later', sched.status === 201 && sched.json?.data?.status === 'scheduled');
  r = await call('POST', `/campaigns/${demo.id}/${sched.json?.data?.id}/cancel`, {}, ownerTok);
  check('…and cancelled before it goes out', r.json?.data?.status === 'cancelled');

  // Waiters see the offer of a guest the campaign brought
  const wTable = await q1(`insert into tables (venue_id,label) values ($1,'Table 11') returning id`, [venueId]);
  const wCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [wCode, wTable.id]);
  r = await call('POST', '/tabs/open', { qrCode: wCode, phone: '0788555666' });
  await call('POST', '/orders', { tabId: r.json?.data?.tab?.id, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
  r = await call('GET', `/orders/venue/${venueId}`, null, staffTok);
  check('Waiter sees the guest\'s offer (Free shot) on their order', (r.json?.data ?? []).some((t) => /Free shot/.test(t.offer ?? '')), JSON.stringify((r.json?.data ?? []).map((t) => t.offer)));

  // A confirmed booking 1 hour from now gets its reminder (checked at the end of the run)
  const remCust = await q1(`insert into customers (phone,name) values ('0788600999','Rita') returning id`);
  await pg.query(`insert into bookings (venue_id,customer_id,name,phone,party_size,starts_at,status,access_token) values ($1,$2,'Reminder Rita','0788600999',2,now() + interval '1 hour','confirmed','tok-remind')`, [venueId, remCust.id]);

  // Guests stay in control
  r = await call('POST', '/guests/me/link-code', {}, guestTok);
  const code = r.json?.data?.code;
  r = await call('POST', '/guests/claim', { code });
  check('iPhone Home Screen icon connects with a one-time code', r.status === 200 && !!r.json?.data?.guestToken);
  r = await call('POST', '/guests/claim', { code });
  check('…which works only once', r.status === 404);
  r = await call('POST', '/guests/me/invites', { optIn: false }, guestTok);
  r = await call('GET', `/campaigns/audience/${venueId}`, null, ownerTok);
  check('Guest switches invites off → they leave every audience', r.json?.data?.regulars === 0, JSON.stringify(r.json?.data));
  const strays = await q1(`select count(*)::int n from push_subscriptions where endpoint like 'https://push.invalid/%' and customer_id is null`);
  check('Guest devices are never counted as the owner\'s', strays.n === 0, `${strays.n}`);
  r = await call('POST', `/venue-bookings/${venueId}/not-an-id/accept`, {}, ownerTok);
  check('A broken booking link → "not found", not an error', r.status === 404, `status ${r.status}`);
}


// ── Skuzi Creators ───────────────────────────────────────────────────────────
console.log('\n── Creators');
{
  const founder = await q1(`insert into owners (name,email,google_id) values ('Founder','jordankayinamura@gmail.com',$1) on conflict (email) do update set name='Founder' returning id,email`, [`g-${rnd()}`]);
  const founderTok = jwt.sign({ ownerId: founder.id, email: founder.email }, JWT_SECRET, { expiresIn: '1d' });
  r = await call('GET', '/auth/me', null, founderTok);
  check('The founder account is recognised as Skuzi team', r.json?.data?.isAdmin === true);
  r = await call('GET', '/auth/me', null, ownerTok);
  check('…a restaurant owner is not', r.json?.data?.isAdmin === false);

  r = await call('POST', '/creators/apply', { name: 'Aline Uwase', handle: 'aline.eats', phone: '+250 788 900 100', wantedCode: 'aline' });
  check('A creator signs up', r.status === 201, r.json?.error);
  r = await call('POST', '/creators/apply', { name: 'Aline Uwase', phone: '0788900100' });
  check('Signing up twice with one number is refused politely', r.status === 409, r.json?.error);
  r = await call('POST', '/creators/apply', { name: 'Bot', phone: '12345' });
  check('A sign-up without a MoMo number is refused', r.status === 400, r.json?.error);
  r = await call('GET', '/creators/admin', null, ownerTok);
  check('A restaurant owner CANNOT see the creators list', r.status === 403);
  r = await call('GET', '/creators/admin', null, founderTok);
  const aline = (r.json?.data ?? []).find((c) => c.phone === '0788900100');
  check('The founder sees the sign-up waiting, with the code they asked for', aline?.status === 'applied' && aline?.wantedCode === 'ALINE' && aline?.handle === '@aline.eats');
  r = await call('POST', `/creators/admin/${aline?.id}/approve`, { code: 'aline' }, founderTok);
  check('Founder approves them with their code', r.json?.data?.status === 'active' && r.json?.data?.code === 'ALINE', r.json?.error);
  r = await call('POST', '/creators/admin', { name: 'Eric M', phone: '0788900200', code: 'ALINE' }, founderTok);
  check('A code already taken is refused', r.status === 409, r.json?.error);
  r = await call('POST', '/creators/admin', { name: 'Eric M', phone: '0788900200', code: 'ERICM' }, founderTok);
  check('Founder adds a creator directly', r.status === 201 && r.json?.data?.code === 'ERICM', r.json?.error);
  r = await call('GET', '/creators/code/aline');
  check('Guests can check a code (first name only)', r.json?.data?.name === 'Aline' && r.json?.data?.code === 'ALINE');
  r = await call('GET', '/creators/code/NOPE123');
  check('An unknown code is just "unknown"', r.status === 404);

  // Paying with a code
  const crTable = await q1(`insert into tables (venue_id,label) values ($1,'Table 20') returning id`, [venueId]);
  const crCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [crCode, crTable.id]);
  const payWithCode = async (phoneNo, qty, code, { fail = false } = {}) => {
    const o = await call('POST', '/tabs/open', { qrCode: crCode, phone: phoneNo });
    const tId = o.json?.data?.tab?.id;
    await call('POST', '/orders', { tabId: tId, items: [{ menuItemId: item('Primus').id, quantity: qty }] });
    const bill = (await call('GET', `/tabs/${tId}/bill`)).json?.data;
    const p = await call('POST', `/tabpayment/${tId}/pay`, { phone: phoneNo, creatorCode: code });
    const d = p.json?.data?.depositId;
    const dep = pawa.state.deposits.get(d);
    if (dep) { dep.status = fail ? 'FAILED' : 'COMPLETED'; if (fail) dep.failureCode = 'PAYMENT_NOT_APPROVED'; }
    const st = await call('GET', `/tabpayment/${tId}/pay/status/${d}`);
    await sleep(300);
    return { tId, bill, pay: p.json?.data, sent: dep?.amount, status: st.json?.data };
  };
  const refs = async () => (await q1(`select count(*)::int n, coalesce(sum(earning_rwf),0)::int s from creator_referrals where creator_id=$1`, [aline.id]));
  const credits = async (msisdn) => (await q1(`select coalesce(sum(amount_rwf),0)::int s from guest_credits where phone=$1`, [msisdn])).s;
  // 7,500 RWF bill → Skuzi's 8% = 600, minus pawaPay's costs (worst case 362) = 238 kept → creator 25% = 59, guest 25% = 59
  let x = await payWithCode('0788901001', 5, 'aline');
  let rf = await refs();
  check('New person pays 7,500 with Skuzi + code → creator earns 25% of what Skuzi keeps (59)', rf.n === 1 && rf.s === 59, JSON.stringify(rf));
  check('…and the guest gets 59 Skuzi money back', (await credits('250788901001')) === 59 && x.status?.welcomeRwf === 59, JSON.stringify(x.status));
  check('…the restaurant still gets its full 92% (6,900)', x.pay?.venuePayout === 6900 && x.pay?.walletUsedRwf === 0, JSON.stringify(x.pay));
  // Same person again: no new creator money; their 59 comes off the bill, out of what Skuzi keeps only
  x = await payWithCode('0788901001', 5, 'ALINE');
  rf = await refs();
  check('Same person again → counts once only', rf.n === 1, JSON.stringify(rf));
  check('Their bill shows the 59 Skuzi money before paying', x.bill?.walletRwf === 59, JSON.stringify({ w: x.bill?.walletRwf }));
  check('…MoMo asks for 7,441, restaurant still gets 6,900, Skuzi\'s fee is 541', x.sent === '7441' && x.pay?.grandTotal === 7441 && x.pay?.venuePayout === 6900 && x.pay?.commission === 541 && x.pay?.walletUsedRwf === 59, JSON.stringify({ sent: x.sent, ...x.pay }));
  check('…and the Skuzi money is used up (no welcome twice)', (await credits('250788901001')) === 59 && (await q1(`select coalesce(sum(wallet_used_rwf),0)::int s from momo_payments where phone='250788901001' and status='successful'`)).s === 59 && !x.status?.welcomeRwf);
  check('Owner sees the whole bill (7,500) in History', (await q1(`select amount_rwf + wallet_used_rwf as b from momo_payments where tab_id=$1`, [x.tId])).b === 7500);
  // 3,000 RWF bill → fee 240, costs 181 → 59 kept → creator 14, guest 14
  await payWithCode('0788901002', 2, 'ALINE');
  rf = await refs();
  check('Smaller bill (3,000) → creator earns 14 (25% of the 59 Skuzi keeps)', rf.n === 2 && rf.s === 73, JSON.stringify(rf));
  await payWithCode('0788555666', 5, 'ALINE');
  rf = await refs();
  check('Someone who already paid with Skuzi before → not counted', rf.n === 2, JSON.stringify(rf));
  await payWithCode('0788900100', 5, 'ALINE');
  rf = await refs();
  check("The creator's own number → not counted", rf.n === 2, JSON.stringify(rf));
  await payWithCode('0788901003', 5, 'NOPE123');
  check('An unknown code never blocks the payment', (await q1(`select count(*)::int n from momo_payments where phone='250788901003' and status='successful'`)).n === 1);
  check('…and gives no Skuzi money', (await credits('250788901003')) === 0);
  // Skuzi money never covers more than what Skuzi keeps on a bill
  await pg.query(`insert into guest_credits (phone, amount_rwf, momo_payment_id) values ('250788901004', 1000, gen_random_uuid())`);
  x = await payWithCode('0788901004', 5, null); // 7,500 RWF → Skuzi keeps 238
  check('Big Skuzi money → only what Skuzi keeps (238) is used, restaurant still gets 6,900', x.pay?.walletUsedRwf === 238 && x.pay?.venuePayout === 6900 && x.pay?.commission === 362 && x.sent === '7262', JSON.stringify(x.pay));
  // A declined payment gives the Skuzi money back
  await pg.query(`insert into guest_credits (phone, amount_rwf, momo_payment_id) values ('250788901005', 100, gen_random_uuid())`);
  x = await payWithCode('0788901005', 5, null, { fail: true });
  const again = (await call('GET', `/tabs/${x.tId}/bill`)).json?.data;
  check('Payment declined → the Skuzi money is still there', x.pay?.walletUsedRwf === 100 && x.status?.status === 'failed' && again?.walletRwf === 100, JSON.stringify({ used: x.pay?.walletUsedRwf, w: again?.walletRwf }));
  // The guest sees their Skuzi money on their own page
  const firstTab = (await q1(`select tab_id from momo_payments where phone='250788901002' and status='successful' order by created_at limit 1`)).tab_id;
  r = await call('POST', '/guests/invites', { tabId: firstTab, optIn: true });
  r = await call('GET', '/guests/me', null, r.json?.data?.guestToken);
  check('Guest page shows Skuzi money (14) and where it came from', r.json?.data?.wallet?.balanceRwf === 14 && r.json?.data?.wallet?.history?.[0]?.from === 'Aline', JSON.stringify(r.json?.data?.wallet));

  r = await call('GET', `/creators/me/${aline.accessToken}`);
  check("Creator's own page shows people and money, never who", r.json?.data?.people === 2 && r.json?.data?.earnedRwf === 73 && r.json?.data?.unpaidRwf === 73 && !JSON.stringify(r.json?.data).includes('0788901001'), JSON.stringify({ p: r.json?.data?.people, e: r.json?.data?.earnedRwf }));
  r = await call('GET', '/creators/me/not-a-real-token');
  check('A wrong private link shows nothing', r.status === 404);
  r = await call('POST', `/creators/admin/${aline.id}/paid`, {}, founderTok);
  check('Founder records the MoMo payout', r.json?.data?.amountRwf === 73 && r.json?.data?.people === 2, r.json?.error);
  r = await call('GET', `/creators/me/${aline.accessToken}`);
  check('…creator sees it as paid', r.json?.data?.unpaidRwf === 0 && r.json?.data?.paidRwf === 73 && r.json?.data?.payouts?.length === 1);
  r = await call('POST', `/creators/admin/${aline.id}/paid`, {}, founderTok);
  check('Paying twice is refused (nothing left to pay)', r.status === 400, r.json?.error);
  await call('POST', `/creators/admin/${aline.id}/status`, { status: 'paused' }, founderTok);
  r = await call('GET', '/creators/code/ALINE');
  check('A paused creator\'s code stops working', r.status === 404);
}

// ── Website: "Book a demo" ─────────────────────────────────────────────────
console.log('\n── Book a demo');
r = await call('POST', '/demo-requests', { name: 'Aline', venueName: 'Bichu Lounge', phone: '0788 123 456', area: 'Kimihurura', bestTime: 'Afternoon' });
const demoRow = await q1(`select * from demo_requests where venue_name='Bichu Lounge' order by created_at desc limit 1`);
check('Venue owner books a demo from the website', r.status === 201 && demoRow?.phone === '0788 123 456', r.json?.error);
r = await call('POST', '/demo-requests', { name: 'Aline', venueName: 'Sunset Lounge', phone: '0788 555 111', area: 'Kimihurura', venueType: 'Lounge', source: 'waitlist' });
check('Owner joins the launch waitlist and sees their place in line', r.status === 201 && r.json?.data?.position >= 1, `#${r.json?.data?.position}`);
const wl = await q1(`select source, venue_type from demo_requests where venue_name='Sunset Lounge'`);
check('Waitlist sign-up is saved as waitlist, with the type of place', wl?.source === 'waitlist' && wl?.venue_type === 'Lounge', `${wl?.source} · ${wl?.venue_type}`);
r = await call('POST', '/demo-requests', { name: 'Bot', venueName: 'x', phone: 'call me' });
check('Demo form refuses junk', r.status === 400, r.json?.error);
for (let i = 0; i < 5; i++) await call('POST', '/demo-requests', { name: 'Spam', venueName: 'Spam bar', phone: '0788000000' });
r = await call('POST', '/demo-requests', { name: 'Spam', venueName: 'Spam bar', phone: '0788000000' });
check('Demo form blocks spam bursts', r.status === 429, `status ${r.status}`);

// Owners who joined before agree once in the app; old versions are refused.
r = await call('POST', `/venues/${venueId}/terms`, { version: 0 }, ownerTok);
check('Agreeing to an old version of the terms is refused', r.status === 400, `status ${r.status}`);
r = await call('POST', `/venues/${venueId}/terms`, { version: 3 }, ownerTok);
check('Owner can agree to the current terms in the app', r.status === 200 && r.json?.data?.termsVersion === 3, `status ${r.status}`);

// ── Stock (bars) ─────────────────────────────────────────────────────────────
console.log('\n── Stock');
{
  await call('POST', '/menu', { venueId, items: [{ name: 'Stock Beer', category: 'Beers', priceRwf: 1500 }] }, ownerTok);
  const beer = (await call('GET', `/stock/${venueId}`, null, ownerTok)).json?.data?.items?.find((i) => i.name === 'Stock Beer');
  check('Owner sees every menu item on the Stock page', !!beer && beer.tracked === false);
  r = await call('PUT', `/stock/items/${beer.id}`, { tracked: true, qty: 5, alertAt: 3 }, ownerTok);
  check('Owner starts tracking an item with its count', r.status === 200);
  r = await call('POST', '/tabs/open', { qrCode: codes[2], phone: phone(), choice: 'new' });
  const st = r.json?.data?.tab?.id;
  r = await call('POST', '/orders', { tabId: st, items: [{ menuItemId: beer.id, quantity: 2 }] });
  check('An order takes bottles off the count', r.status === 201 && (await q1('select stock_qty from menu_items where id=$1', [beer.id])).stock_qty === 3);
  r = await call('POST', '/orders', { tabId: st, items: [{ menuItemId: beer.id, quantity: 4 }] });
  check('Ordering more than is left is refused, nothing saved', r.status >= 400 && /Only 3/.test(r.json?.error ?? '') && (await q1('select stock_qty from menu_items where id=$1', [beer.id])).stock_qty === 3, r.json?.error);
  r = await call('POST', '/orders', { tabId: st, items: [{ menuItemId: beer.id, quantity: 3 }] });
  const out = await q1('select stock_qty, is_available from menu_items where id=$1', [beer.id]);
  check('The last bottle sells it out on the menu', r.status === 201 && out.stock_qty === 0 && out.is_available === false);
  r = await call('POST', `/stock/${venueId}/delivery`, { items: [{ menuItemId: beer.id, qty: 24 }], supplier: 'Bralirwa' }, ownerTok);
  const back = await q1('select stock_qty, is_available from menu_items where id=$1', [beer.id]);
  check('A delivery adds bottles and puts it back on the menu', r.status === 200 && back.stock_qty === 24 && back.is_available === true);
  r = await call('POST', `/stock/${venueId}/count`, { items: [{ menuItemId: beer.id, counted: 21 }] }, ownerTok);
  check('The closing count shows what went missing', r.status === 200 && r.json?.data?.missing?.[0]?.qty === 3 && r.json?.data?.missingValueRwf === 4500, JSON.stringify(r.json?.data));
  r = await call('GET', `/stock/items/${beer.id}/history`, null, ownerTok);
  check('Item history: sales, delivery, count', r.status === 200 && r.json?.data?.week?.sold === 5 && r.json?.data?.week?.delivered === 24 && r.json?.data?.week?.missing === 3, JSON.stringify(r.json?.data?.week));
  r = await call('GET', `/stock/${venueId}`, null, staffTok);
  check('Waiters cannot see stock', r.status === 401 || r.status === 403, `status ${r.status}`);
  {
    const mgr = await q1(`insert into staff (venue_id,name,phone,role) values ($1,'Stock Manager',$2,'manager') returning id`, [venueId, phone()]);
    const mgrTok = jwt.sign({ staffId: mgr.id, venueId }, JWT_SECRET, { expiresIn: '1d' });
    r = await call('GET', `/stock/${venueId}`, null, mgrTok);
    check('A manager can see stock', r.status === 200, `status ${r.status}`);
    r = await call('POST', `/stock/${venueId}/kitchen/spend`, { amountRwf: 1000, note: 'Market' }, mgrTok);
    check('A manager can log food spending', r.status === 200, `status ${r.status}`);
    if (r.json?.data?.id) await call('DELETE', `/stock/${venueId}/kitchen/spend/${r.json.data.id}`, null, mgrTok);
  }
  r = await call('GET', `/stock/${venueId}`, null, rivalTokEarly);
  check('Another owner cannot see this stock', r.status === 403 || r.status === 404, `status ${r.status}`);
  // Kitchen, in money: food spending against the food Skuzi sold
  let k = (await call('GET', `/stock/${venueId}/kitchen?range=tonight`, null, ownerTok)).json?.data;
  check('Kitchen counts food categories, not drinks', k?.categories?.kitchen?.includes('Food') && !k.categories.kitchen.includes('Drinks') && !k.categories.kitchen.includes('Beers'), JSON.stringify(k?.categories));
  const soldBefore = k?.soldRwf ?? 0;
  await call('POST', '/orders', { tabId: st, items: [{ menuItemId: item('Brochette').id, quantity: 2 }, { menuItemId: item('Primus').id, quantity: 1 }] });
  r = await call('POST', `/stock/${venueId}/kitchen/spend`, { amountRwf: 2500, note: 'Butcher' }, ownerTok);
  const spendId = r.json?.data?.id;
  k = (await call('GET', `/stock/${venueId}/kitchen?range=tonight`, null, ownerTok)).json?.data;
  check('Food sold counts only food (2 brochettes = 6,000)', k?.soldRwf === soldBefore + 6000, `${soldBefore} → ${k?.soldRwf}`);
  check('Food spending and profit add up', k?.spentRwf === 2500 && k?.profitRwf === k.soldRwf - 2500, JSON.stringify({ spent: k?.spentRwf, profit: k?.profitRwf }));
  r = await call('POST', `/stock/${venueId}/kitchen/spend`, { amountRwf: 0 }, ownerTok);
  check('An empty amount is refused', r.status === 400);
  r = await call('DELETE', `/stock/${venueId}/kitchen/spend/${spendId}`, null, rivalTokEarly);
  check('Another owner cannot delete my spending', r.status === 403 || r.status === 404, `status ${r.status}`);
  r = await call('DELETE', `/stock/${venueId}/kitchen/spend/${spendId}`, null, ownerTok);
  check('Owner can remove a mistake', r.status === 200 && (await call('GET', `/stock/${venueId}/kitchen?range=tonight`, null, ownerTok)).json?.data?.spentRwf === 0);
}

// ── Kitchen screen (Bar+) ────────────────────────────────────────────────────
console.log('\n── Kitchen screen');
{
  r = await call('POST', '/staff', { venueId, name: 'Chef Paul', phone: phone(), role: 'kitchen' }, ownerTok);
  check('Owner adds a kitchen staff member', r.status === 201 && r.json?.data?.staff?.role === 'kitchen', r.json?.error);
  const chefId = r.json?.data?.staff?.id;
  const chefTok = jwt.sign({ staffId: chefId, venueId }, JWT_SECRET, { expiresIn: '1d' });
  check('The kitchen gets no tables', (await q1('select count(*)::int n from table_assignments where staff_id=$1', [chefId])).n === 0);
  { // A waiter moved to the kitchen loses their tables
    r = await call('POST', '/staff', { venueId, name: 'Bea', phone: phone() }, ownerTok);
    const beaId = r.json?.data?.staff?.id;
    const had = (await q1('select count(*)::int n from table_assignments where staff_id=$1', [beaId])).n;
    r = await call('PATCH', `/staff/${beaId}`, { role: 'kitchen' }, ownerTok);
    const left = (await q1('select count(*)::int n from table_assignments where staff_id=$1', [beaId])).n;
    check('A waiter moved to the kitchen hands their tables back', r.status === 200 && had > 0 && left === 0, `had ${had}, left ${left}`);
    await pg.query('update staff set is_active=false where id=$1', [beaId]);
  }
  await call('POST', '/menu', { venueId, items: [{ name: 'Chips', category: 'Food', priceRwf: 2000 }] }, ownerTok);
  const chips = (await call('GET', `/menu/${venueId}`)).json?.data?.items?.find((m) => m.name === 'Chips');
  await call('PUT', `/stock/items/${chips.id}`, { tracked: true, qty: 10 }, ownerTok);
  const kt = await q1(`insert into tables (venue_id,label) values ($1,'Kitchen Test') returning id`, [venueId]);
  const kCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [kCode, kt.id]);
  r = await call('POST', '/tabs/open', { qrCode: kCode, phone: phone() });
  const kTab = r.json?.data?.tab?.id;
  const guestWs = socket(`venueId=${venueId}&tabId=${kTab}`);
  await sleep(300);
  r = await call('POST', '/orders', { tabId: kTab, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
  const drinksOnly = r.json?.data?.order?.id;
  r = await call('POST', '/orders', { tabId: kTab, items: [{ menuItemId: item('Primus').id, quantity: 2 }, { menuItemId: item('Brochette').id, quantity: 2 }, { menuItemId: chips.id, quantity: 1 }] });
  const foodOrder = r.json?.data?.order?.id;
  check('An order with food goes to the kitchen; drinks only do not', (await q1('select kitchen_status k from orders where id=$1', [foodOrder])).k === 'new' && (await q1('select kitchen_status k from orders where id=$1', [drinksOnly])).k === null);
  r = await call('GET', `/kitchen/${venueId}/tickets`, null, chefTok);
  const ticket = (r.json?.data ?? []).find((t) => t.orderId === foodOrder);
  check('The kitchen sees food only (no drinks), with the table', r.status === 200 && ticket?.tableLabel === 'Kitchen Test' && ticket.items.map((i) => i.name).sort().join() === 'Brochette,Chips' && !(r.json?.data ?? []).some((t) => t.orderId === drinksOnly), JSON.stringify(ticket));
  r = await call('GET', `/kitchen/${venueId}/tickets`, null, staffTok);
  check('Waiters cannot open the kitchen screen', r.status === 403, `status ${r.status}`);
  r = await call('GET', `/kitchen/${venueId}/tickets`, null, rivalTokEarly);
  check('Another owner cannot see my kitchen', r.status === 403 || r.status === 404, `status ${r.status}`);
  r = await call('POST', `/kitchen/orders/${foodOrder}/start`, null, staffTok);
  check('Waiters cannot press the kitchen buttons', r.status === 403, `status ${r.status}`);
  let g0 = guestWs.events.length;
  r = await call('POST', `/kitchen/orders/${foodOrder}/start`, null, chefTok);
  await sleep(400);
  check('Start: the guest sees "Preparing"', r.status === 200 && (await q1('select status from orders where id=$1', [foodOrder])).status === 'preparing' && guestWs.events.slice(g0).some((e) => e.type === 'order_status_update' && e.payload?.status === 'preparing'));
  // The kitchen has no chips
  const billBefore = (await call('GET', `/tabs/${kTab}/bill`)).json?.data?.grandTotal;
  const chipsLine = ticket.items.find((i) => i.name === 'Chips');
  g0 = guestWs.events.length; let s0 = staffWs.events.length;
  r = await call('POST', `/kitchen/items/${chipsLine.id}/unavailable`, { soldOut: true }, chefTok);
  await sleep(400);
  const billAfter = (await call('GET', `/tabs/${kTab}/bill`)).json?.data?.grandTotal;
  const chipsNow = await q1('select is_available, stock_qty from menu_items where id=$1', [chips.id]);
  check('Not available: off the bill', r.status === 200 && billBefore - billAfter === 2000, `${billBefore} → ${billAfter}`);
  check('…the guest and the waiter are told', guestWs.events.slice(g0).some((e) => e.type === 'item_unavailable' && e.payload?.name === 'Chips') && staffWs.events.slice(s0).some((e) => e.type === 'item_unavailable'));
  check('…sold out on the menu, and the counted stock comes back', chipsNow.is_available === false && chipsNow.stock_qty === 10, JSON.stringify(chipsNow));
  g0 = guestWs.events.length; s0 = staffWs.events.length;
  r = await call('POST', `/kitchen/orders/${foodOrder}/ready`, null, chefTok);
  await sleep(400);
  const ready = staffWs.events.slice(s0).find((e) => e.type === 'food_ready');
  check('Ready: the waiter is told which table and what to pick up', r.status === 200 && ready?.payload?.tableLabel === 'Kitchen Test' && /2 Brochette/.test(ready?.payload?.food ?? ''), JSON.stringify(ready?.payload));
  check('Ready: the guest is told their food is on its way', guestWs.events.slice(g0).some((e) => e.type === 'food_ready' && e.payload?.tabId === kTab));
  r = await call('GET', `/kitchen/${venueId}/tickets`, null, chefTok);
  check('The ticket moves to "Ready"', (r.json?.data ?? []).find((t) => t.orderId === foodOrder)?.status === 'ready');
  { // Managers can use the kitchen screen too
    const m = await q1(`insert into staff (venue_id,name,phone,role) values ($1,'Kitchen Manager',$2,'manager') returning id`, [venueId, phone()]);
    r = await call('GET', `/kitchen/${venueId}/tickets`, null, jwt.sign({ staffId: m.id, venueId }, JWT_SECRET, { expiresIn: '1d' }));
    check('A manager can open the kitchen screen', r.status === 200, `status ${r.status}`);
    await pg.query('update staff set is_active=false where id=$1', [m.id]);
  }
  // Go (paid, after the trial) has no kitchen screen
  await pg.query("update venues set plan='basic', trial_ends_at = now() - interval '1 day', paid_until = now() + interval '20 days' where id=$1", [venueId]);
  r = await call('GET', `/kitchen/${venueId}/tickets`, null, chefTok);
  check('Go: the kitchen screen is locked (Pro)', r.status === 403 && /Pro/.test(r.json?.error ?? ''), r.json?.error);
  r = await call('POST', '/orders', { tabId: kTab, items: [{ menuItemId: item('Brochette').id, quantity: 1 }] });
  check('Go: food orders go to the waiter as before', (await q1('select kitchen_status k from orders where id=$1', [r.json?.data?.order?.id])).k === null);
  await pg.query("update venues set plan='elite', trial_ends_at = now() + interval '30 days', paid_until = null where id=$1", [venueId]);
  await pg.query("update menu_items set is_available=true where id=$1", [chips.id]);
  await call('POST', `/tabs/${kTab}/close`, { paidWith: 'cash' }, ownerTok);
  guestWs.ws.close();
}

// ── Two groups, one table (the previous group left without paying) ───────────
console.log('\n── New group at a table with an unpaid bill');
{
  const gt = await q1(`insert into tables (venue_id,label) values ($1,'Window') returning id`, [venueId]);
  const gCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [gCode, gt.id]);
  r = await call('POST', '/tabs/open', { qrCode: gCode, phone: '0788 400 001' });
  const oldTab = r.json?.data?.tab?.id;
  await call('POST', '/orders', { tabId: oldTab, items: [{ menuItemId: item('Primus').id, quantity: 2 }] });
  // The group leaves without the bill being closed. A new group sits down:
  r = await call('POST', '/tabs/open', { qrCode: gCode, phone: '0788 400 002' });
  const newTab = r.json?.data?.tab?.id;
  check('A new group gets a NEW bill, with no question', !!newTab && newTab !== oldTab && r.json?.data?.isExisting === false && !JSON.stringify(r.json).includes(oldTab));
  await call('POST', '/orders', { tabId: newTab, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
  const newBill = (await call('GET', `/tabs/${newTab}/bill`)).json?.data?.grandTotal;
  const oldBill = (await call('GET', `/tabs/${oldTab}/bill`)).json?.data?.grandTotal;
  check('…the new group pays only for what they ordered', newBill === 800 && oldBill === 3000, `new ${newBill}, old ${oldBill}`);
  check('…and the old bill is still there to be collected', (await q1('select status from tabs where id=$1', [oldTab])).status === 'open');
  r = await call('POST', '/tabs/open', { qrCode: gCode, phone: '0788 400 001' });
  check('Typing a number never brings a bill back (numbers aren\'t secret)', r.json?.data?.tab?.id !== oldTab && r.json?.data?.tab?.id !== newTab);
  const typedTab = r.json?.data?.tab?.id;
  await call('POST', '/orders', { tabId: typedTab, items: [{ menuItemId: item('Fanta').id, quantity: 1 }] });
  r = await call('POST', '/tabs/staff-open', { tableId: gt.id }, staffTok);
  check('Waiter adding an order is asked which bill, with the amount', r.json?.data?.needsChoice === true && typeof r.json?.data?.totalRwf === 'number', JSON.stringify(r.json?.data));
  r = await call('POST', '/tabs/staff-open', { tableId: gt.id, choice: 'new' }, staffTok);
  const walkIn = r.json?.data?.tab?.id;
  check('Waiter: "New group" opens a separate bill', !!walkIn && ![oldTab, newTab, typedTab].includes(walkIn));
  r = await call('POST', `/tabs/${oldTab}/join-code`);
  const oldCode = r.json?.data?.code;
  await call('POST', `/tabs/${oldTab}/close`, { paidWith: 'cash' }, staffTok);
  r = await call('POST', '/tabs/open', { qrCode: gCode, phone: '0788 400 009', joinCode: oldCode });
  check('A code stops working once its bill is closed', r.status >= 400 && (await call('GET', `/tabs/join/${oldCode}`)).status === 404);
  for (const t of [newTab, typedTab, walkIn]) await call('POST', `/tabs/${t}/close`, { paidWith: 'cash' }, staffTok);
}

// ── Night report (2am) ───────────────────────────────────────────────────────
console.log('\n── Night report');
{
  r = await call('GET', `/dashboard/night-report/${venueId}`, null, ownerTok);
  const nr = r.json?.data;
  const sumPaid = nr ? nr.paid.momoRwf + nr.paid.cashRwf + nr.paid.otherRwf : -1;
  check('Owner gets tonight\'s report: sales = paid + unpaid', r.status === 200 && nr.salesRwf > 0 && nr.bills > 0 && sumPaid + nr.unpaidRwf === nr.salesRwf, JSON.stringify(nr && { sales: nr.salesRwf, paid: sumPaid, unpaid: nr.unpaidRwf, bills: nr.bills }));
  check('…with best sellers and waiters', nr?.topItems?.length > 0 && nr.topItems[0].salesRwf >= nr.topItems.at(-1).salesRwf && nr?.waiters?.length > 0);
  r = await call('GET', `/dashboard/night-report/${venueId}?night=2026-01-01`, null, ownerTok);
  check('A past night opens (empty here)', r.status === 200 && r.json?.data?.bills === 0 && r.json?.data?.night === '2026-01-01');
  r = await call('GET', `/dashboard/night-report/${venueId}?night=yesterday`, null, ownerTok);
  check('A badly written night is refused', r.status === 400);
  r = await call('GET', `/dashboard/night-report/${venueId}`, null, rivalTokEarly);
  check('Another owner cannot read my night report', r.status === 403, `status ${r.status}`);
  r = await call('GET', `/dashboard/night-report/${venueId}`, null, staffTok);
  check('Waiters cannot read the night report', r.status === 401 || r.status === 403, `status ${r.status}`);
}

// ── Waiter tips & badges (points only go up) ─────────────────────────────────
console.log('\n── Waiter tips');
{
  const aliceId = (await call('GET', '/staff/me', null, staffTok)).json?.data?.id;
  const tt = await q1(`insert into tables (venue_id,label) values ($1,'Tip Table') returning id`, [venueId]);
  const tCode = rnd() + rnd();
  await pg.query(`insert into qr_stickers (code,status,table_id,claimed_at) values ($1,'claimed',$2,now())`, [tCode, tt.id]);
  await pg.query(`insert into table_assignments (table_id,staff_id,shift_date) values ($1,$2,'permanent')`, [tt.id, aliceId]);
  r = await call('POST', '/tabs/open', { qrCode: tCode, phone: phone() });
  const tTab = r.json?.data?.tab?.id;
  r = await call('GET', `/tabs/${tTab}/waiter`);
  check('Tips are on by default once the waiter has opened the app (their own number)', r.json?.data?.name === 'Alice' && r.json?.data?.tipMomo === waiterPhone, JSON.stringify(r.json?.data));
  { // A brand-new waiter: tips switch on the first time they open the app, and they're told
    const tinaPhone = phone();
    const tina = await q1(`insert into staff (venue_id,name,phone,role) values ($1,'Tina',$2,'waiter') returning id`, [venueId, tinaPhone]);
    const tinaTok = jwt.sign({ staffId: tina.id, venueId }, JWT_SECRET, { expiresIn: '1d' });
    r = await call('GET', '/staff/me', null, tinaTok);
    check('New waiter opens the app: tips are on with their number, and they\'re told', r.json?.data?.tipsJustOn === true && r.json?.data?.tipMomo === tinaPhone, JSON.stringify(r.json?.data));
    r = await call('GET', '/staff/me', null, tinaTok);
    check('…told only once', r.json?.data?.tipsJustOn === false && r.json?.data?.tipMomo === tinaPhone);
    await call('PATCH', '/staff/me/tips', { tipMomo: null }, tinaTok);
    r = await call('GET', '/staff/me', null, tinaTok);
    check('A waiter who turns tips off stays off (not switched back on)', r.json?.data?.tipMomo === null && r.json?.data?.tipsJustOn === false);
    await pg.query('update staff set is_active=false where id=$1', [tina.id]);
  }
  r = await call('PATCH', '/staff/me/tips', { tipMomo: '12345' }, staffTok);
  check('A tip number must be a Rwandan MoMo number', r.status === 400, r.json?.error);
  r = await call('PATCH', '/staff/me/tips', { tipMomo: '+250 788 111 222' }, staffTok);
  check('Waiter turns tips on with their MoMo number', r.status === 200 && r.json?.data?.tipMomo === '0788111222', JSON.stringify(r.json?.data));
  r = await call('PATCH', '/staff/me/tips', { tipMomo: '0788111222' });
  check('Only the waiter can change their tip number', r.status === 401, `status ${r.status}`);
  r = await call('GET', `/tabs/${tTab}/waiter`);
  check('…the guest now sees where to send a tip', r.json?.data?.tipMomo === '0788111222');
  r = await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 50 });
  check('A tip below 100 RWF is refused', r.status === 400);
  const s0 = staffWs.events.length;
  r = await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 1000 });
  await sleep(400);
  check('"I\'ve sent it": the waiter is told live', r.status === 200 && staffWs.events.slice(s0).some((e) => e.type === 'tip_sent' && e.payload?.staffId === aliceId && e.payload?.amountRwf === 1000 && e.payload?.tableLabel === 'Tip Table'), r.json?.error);
  r = await call('GET', `/staff/${venueId}`, null, ownerTok);
  const aliceRow = (r.json?.data ?? []).find((m) => m.id === aliceId);
  check('The owner sees the tips on the Staff page', aliceRow?.tipsWeekRwf >= 1000 && aliceRow?.tipsOn === true, JSON.stringify(aliceRow && { tips: aliceRow.tipsWeekRwf, on: aliceRow.tipsOn }));
  await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 500 });
  await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 500 });
  r = await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 500 });
  check('At most 3 tips per bill (no spamming the waiter)', r.status === 400);
  // Skuzi! costs the waiter nothing; older penalties stop counting
  let before = (await call('GET', '/staff/me/points', null, staffTok)).json?.data?.totalPoints;
  r = await call('POST', `/tabs/${tTab}/nudge`);
  await pg.query(`insert into staff_points (staff_id,points,reason) values ($1,-5,'Nudge penalty [old]')`, [aliceId]);
  let after = (await call('GET', '/staff/me/points', null, staffTok)).json?.data;
  check('A guest tapping Skuzi! costs the waiter no points', r.status === 200 && after?.totalPoints === before && !(after?.history ?? []).some((h) => h.points <= 0), `${before} → ${after?.totalPoints}`);
  r = await call('GET', `/staff/${venueId}`, null, ownerTok);
  check('…the owner still sees the Skuzi! taps', ((r.json?.data ?? []).find((m) => m.id === aliceId)?.skuziCallsWeek ?? 0) >= 1);
  await pg.query(`insert into staff_points (staff_id,points,reason) values ($1,500,'Fast delivery bonus (2m)')`, [aliceId]);
  r = await call('GET', `/tabs/${tTab}/waiter`);
  check('The week\'s top waiter gets the 🏆 badge on the bill', r.json?.data?.topThisWeek === true, JSON.stringify(r.json?.data));
  await call('POST', `/tabs/${tTab}/close`, { paidWith: 'cash' }, staffTok);
  await pg.query("update tabs set closed_at = now() - interval '7 hours' where id=$1", [tTab]);
  r = await call('POST', `/tabs/${tTab}/tip`, { amountRwf: 500 });
  check('No tips on a bill closed hours ago', r.status === 400);
  r = await call('PATCH', '/staff/me/tips', { tipMomo: null }, staffTok);
  check('Waiter can turn tips off', r.status === 200 && r.json?.data?.tipMomo === null);
  r = await call('GET', `/tabs/${tTab}/waiter`);
  check('…then guests see no tip number', r.json?.data?.tipMomo === null);
}

// ── Packages and paying the venue's own MoMo Pay code ───────────────────────
console.log('\n── Packages & direct MoMo');
{
  // The owner sets the MoMo Pay code; guests see it on the venue
  r = await call('PATCH', `/plans/${venueId}/momo-code`, { code: 'abc' }, ownerTok);
  check('A MoMo Pay code must be digits', r.status === 400);
  r = await call('PATCH', `/plans/${venueId}/momo-code`, { code: '482910' }, ownerTok);
  check('Owner saves the MoMo Pay code', r.status === 200 && r.json?.data?.momoPayCode === '482910');
  r = await call('GET', `/tabs/preview/${codes[1]}`);
  check('Guests see the code and can pay by MoMo', r.json?.data?.venue?.momoPayCode === '482910' && r.json?.data?.venue?.acceptsMobileMoney === true, JSON.stringify(r.json?.data?.venue));
  // A guest pays the code directly and says so; the waiter confirms
  r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: phone(), choice: 'new' });
  const mt = r.json?.data?.tab?.id;
  await call('POST', '/orders', { tabId: mt, items: [{ menuItemId: item('Brochette').id, quantity: 1 }] });
  const before = staffWs.events.length;
  r = await call('POST', `/tabs/${mt}/paid-by-momo`);
  await sleep(500);
  check('"I\'ve paid" alerts the waiter with the amount', r.status === 200 && staffWs.events.slice(before).some((e) => e.type === 'payment_claimed' && e.payload?.tabId === mt && e.payload?.total > 0));
  r = await call('POST', `/tabs/${mt}/close`, { paidWith: 'momo' }, staffTok);
  const closed = await q1('select status, paid_with from tabs where id=$1', [mt]);
  check('Waiter taps Paid ✓ MoMo: bill closed as MoMo', r.status === 200 && closed.status === 'closed' && closed.paid_with === 'momo', JSON.stringify(closed));
  r = await call('GET', `/dashboard/activity/${venueId}`, null, ownerTok);
  check('History shows it as MoMo straight to the venue', (r.json?.data ?? []).some((t) => t.tabId === mt && t.payment?.method === 'momo_direct' && t.payment?.amountRwf >= 3000), JSON.stringify((r.json?.data ?? []).find((t) => t.tabId === mt)?.payment));
  // Packages: the free trial has everything; after it, the package decides
  await pg.query("update venues set plan='basic' where id=$1", [venueId]);
  r = await call('GET', `/stock/${venueId}`, null, ownerTok);
  check('Free trial: everything is open, even on Go', r.status === 200, `status ${r.status}`);
  r = await call('GET', '/auth/me', null, ownerTok);
  const ps = r.json?.data?.venues?.find((v) => v.id === venueId)?.planStatus;
  check('The app gets the package status', ps?.state === 'trial' && ps?.effectivePlan === 'elite' && ps?.plan === 'basic', JSON.stringify(ps));
  r = await call('PATCH', `/plans/${venueId}`, { plan: 'elite' }, ownerTok);
  check('In the free trial the owner can switch package', r.status === 200 && r.json?.data?.plan === 'elite' && r.json?.data?.state === 'trial', JSON.stringify(r.json?.data));
  await pg.query("update venues set plan='basic', trial_ends_at = now() - interval '1 day', paid_until = now() + interval '20 days' where id=$1", [venueId]);
  r = await call('GET', `/stock/${venueId}`, null, ownerTok);
  check('Paid Go: stock is locked (Pro)', r.status === 403 && /Pro/.test(r.json?.error ?? ''), r.json?.error);
  r = await call('GET', `/dashboard/activity/${venueId}`, null, ownerTok);
  check('Paid Go: history is locked (Pro)', r.status === 403);
  r = await call('GET', `/tabs/preview/${codes[1]}`);
  check('Paid Go: guests pay the waiter, no MoMo code shown', r.json?.data?.venue?.acceptsMobileMoney === false && r.json?.data?.venue?.momoPayCode === null);
  r = await call('PATCH', `/plans/${venueId}`, { plan: 'elite' }, ownerTok);
  check('After the trial, you switch package by paying for it', r.status === 400 && /Pay/.test(r.json?.error ?? ''), r.json?.error);
  r = await call('GET', '/plans/admin/all', null, ownerTok);
  check('Only the founder sees every venue\'s plan', r.status === 403);

  // Unpaid: grace, then paying with MoMo
  await pg.query("update venues set plan='pro', paid_until = null where id=$1", [venueId]);
  r = await call('GET', `/plans/${venueId}`, null, ownerTok);
  check('Unpaid 1 day: grace, nothing switched off yet', r.json?.data?.state === 'grace' && (await call('GET', `/dashboard/activity/${venueId}`, null, ownerTok)).status === 200, r.json?.data?.state);
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'elite', phone: '0788 123 456' }, rivalTokEarly);
  check('Another owner cannot pay or start payments for my venue', r.status === 403, `status ${r.status}`);
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'elite', phone: '0788 123 456' }, ownerTok);
  const pdep = r.json?.data?.depositId;
  check('Owner pays Max: their phone is asked for 100,000', r.status === 200 && pawa.state.deposits.get(pdep)?.amount === '100000' && pawa.state.deposits.get(pdep)?.payer?.accountDetails?.phoneNumber === '250788123456', r.json?.error);
  r = await call('GET', `/plans/${venueId}/pay/${pdep}`, null, ownerTok);
  check('…nothing changes until MoMo confirms', r.json?.data?.status === 'pending' && (await q1('select paid_until from venues where id=$1', [venueId])).paid_until === null);
  r = await call('GET', `/plans/${venueId}/pay/${pdep}`, null, rivalTokEarly);
  check('Another owner cannot check my payment', r.status === 403, `status ${r.status}`);
  pawa.state.deposits.get(pdep).status = 'COMPLETED';
  r = await call('GET', `/plans/${venueId}/pay/${pdep}`, null, ownerTok);
  let pv = await q1('select plan, paid_until from venues where id=$1', [venueId]);
  let paidDays = (new Date(pv.paid_until + 'Z') - Date.now()) / 864e5;
  check('MoMo confirms: Max for 30 days, automatically', r.json?.data?.status === 'successful' && r.json?.data?.plan?.state === 'paid' && pv.plan === 'elite' && paidDays > 29.5 && paidDays < 30.5, `${pv.plan}, ${paidDays.toFixed(2)} days`);
  await call('GET', `/plans/${venueId}/pay/${pdep}`, null, ownerTok);
  await fetch(`${BASE}/tabpayment/callback/deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depositId: pdep, status: 'COMPLETED' }) });
  await sleep(500);
  pv = await q1('select plan, paid_until from venues where id=$1', [venueId]);
  check('The month is added only once (screen + MoMo callback)', Math.abs((new Date(pv.paid_until + 'Z') - Date.now()) / 864e5 - paidDays) < 0.01);
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'pro', phone: '0788123456' }, ownerTok);
  const early = r.json?.data?.depositId;
  pawa.state.deposits.get(early).status = 'COMPLETED';
  await fetch(`${BASE}/tabpayment/callback/deposit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ depositId: early, status: 'COMPLETED' }) });
  await sleep(800);
  pv = await q1('select plan, paid_until from venues where id=$1', [venueId]);
  paidDays = (new Date(pv.paid_until + 'Z') - Date.now()) / 864e5;
  check('Paying early adds a month on top (via the MoMo callback)', pv.plan === 'pro' && paidDays > 59.5 && paidDays < 60.5, `${pv.plan}, ${paidDays.toFixed(2)} days`);
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'pro', phone: '0788123456' }, ownerTok);
  const declined = r.json?.data?.depositId;
  Object.assign(pawa.state.deposits.get(declined), { status: 'FAILED', failureCode: 'PAYMENT_NOT_APPROVED' });
  r = await call('GET', `/plans/${venueId}/pay/${declined}`, null, ownerTok);
  check('A declined payment says so and changes nothing', r.json?.data?.status === 'failed' && !!r.json?.data?.error && !/waiter/.test(r.json?.data?.error) && Math.abs((new Date((await q1('select paid_until from venues where id=$1', [venueId])).paid_until + 'Z') - Date.now()) / 864e5 - paidDays) < 0.01, r.json?.data?.error);

  // Max for a year, 20% off
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'pro', phone: '0788123456', period: 'year' }, ownerTok);
  check('Only Max can be paid for a year', r.status === 400, r.json?.error);
  const beforeYear = new Date((await q1('select paid_until from venues where id=$1', [venueId])).paid_until + 'Z').getTime();
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'elite', phone: '0788123456', period: 'year' }, ownerTok);
  const ydep = r.json?.data?.depositId;
  check('Max yearly: the phone is asked for 960,000 (20% off)', r.status === 200 && pawa.state.deposits.get(ydep)?.amount === '960000', r.json?.error);
  pawa.state.deposits.get(ydep).status = 'COMPLETED';
  await call('GET', `/plans/${venueId}/pay/${ydep}`, null, ownerTok);
  const afterYear = new Date((await q1('select paid_until from venues where id=$1', [venueId])).paid_until + 'Z').getTime();
  check('…and it adds a full year', Math.abs((afterYear - beforeYear) / 864e5 - 365) < 0.01, `${((afterYear - beforeYear) / 864e5).toFixed(2)} days`);

  // Never paid: the wall, then guest ordering pauses
  await pg.query("update venues set trial_ends_at = now() - interval '40 days', paid_until = now() - interval '5 days' where id=$1", [venueId]);
  r = await call('GET', `/plans/${venueId}`, null, ownerTok);
  check('Unpaid 5 days: the owner\'s dashboard is locked', r.json?.data?.state === 'locked' && r.json?.data?.orderingPaused === false, JSON.stringify(r.json?.data?.state));
  r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: phone(), choice: 'new' });
  const pt = r.json?.data?.tab?.id;
  r = await call('POST', '/orders', { tabId: pt, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
  check('…guests can still order', r.status === 201, r.json?.error);
  await pg.query("update venues set paid_until = now() - interval '11 days' where id=$1", [venueId]);
  r = await call('GET', `/tabs/preview/${codes[1]}`);
  check('Unpaid 11 days: guests see ordering is paused', r.json?.data?.venue?.orderingPaused === true);
  r = await call('POST', '/orders', { tabId: pt, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
  check('…a guest order is refused, kindly', r.status >= 400 && /call your waiter/i.test(r.json?.error ?? ''), r.json?.error);
  r = await call('POST', '/orders', { tabId: pt, source: 'staff', items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
  check('…a guest pretending to be staff is refused too', r.status >= 400, `status ${r.status}`);
  r = await call('POST', '/orders', { tabId: pt, source: 'staff', items: [{ menuItemId: item('Primus').id, quantity: 1 }] }, staffTok);
  check('…the waiter can still enter orders', r.status === 201, r.json?.error);
  r = await call('GET', '/staff/me', null, staffTok);
  check('…and the waiter is told why', r.json?.data?.planNotice?.orderingPaused === true, JSON.stringify(r.json?.data?.planNotice));
  r = await call('POST', `/plans/${venueId}/pay`, { plan: 'pro', phone: '0788123456' }, ownerTok);
  const back = r.json?.data?.depositId;
  pawa.state.deposits.get(back).status = 'COMPLETED';
  await call('GET', `/plans/${venueId}/pay/${back}`, null, ownerTok);
  r = await call('POST', '/orders', { tabId: pt, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
  check('Paid: guest ordering is back straight away', r.status === 201 && (await call('GET', `/plans/${venueId}`, null, ownerTok)).json?.data?.state === 'paid', r.json?.error);
  await call('POST', `/tabs/${pt}/close`, { paidWith: 'cash' }, staffTok);
  await pg.query("update venues set trial_ends_at = now() + interval '30 days', plan='elite', paid_until = null where id=$1", [venueId]);
}

// ── 5. Security ──────────────────────────────────────────────────────────────
console.log('\n── Security');
const rivalTok = await newOwner('Rival');
for (const [name, path] of [['revenue', `/dashboard/stats/${venueId}`], ['staff list', `/staff/${venueId}`], ['orders', `/orders/venue/${venueId}`], ['ratings', `/ratings/leaderboard/${venueId}`], ['shifts', `/shifts/${venueId}`], ["tonight's money", `/dashboard/tonight/${venueId}`], ['history calendar', `/dashboard/nights/${venueId}?month=2026-10`]]) {
  r = await call('GET', path, null, rivalTok);
  check(`Another owner CANNOT read my ${name}`, r.status === 403, `status ${r.status}`);
}
r = await call('POST', `/venues/${venueId}/terms`, { version: 3 }, rivalTok);
check('Another owner CANNOT agree to terms for my venue', r.status === 403, `status ${r.status}`);
r = await call('POST', '/menu', { venueId, items: [{ name: 'Free beer', category: 'Drinks', priceRwf: 1 }] }, rivalTok);
check('Another owner CANNOT edit my menu', r.status === 403);
r = await call('PATCH', `/menu/items/${item('Primus').id}`, { priceRwf: 1 }, rivalTok);
check('Another owner CANNOT change my prices', r.status === 403);
r = await call('GET', `/dashboard/stats/${venueId}`, null, staffTok);
check('Waiter CANNOT read owner dashboard', r.status === 401);
r = await call('GET', `/orders/venue/${venueId}`);
check('Anonymous CANNOT list orders', r.status === 401);
r = await call('PATCH', `/orders/${orderId}/status`, { status: 'preparing' });
check('Anonymous CANNOT change order status', r.status === 401);
const rivalWs = socket(`venueId=${venueId}&token=${rivalTok}`);
await sleep(600);
check('Another owner CANNOT listen to my live events', !!rivalWs.closed, rivalWs.closed);
for (let i = 0; i < 5; i++) await call('POST', '/staff/login', { phone: waiterPhone, pin: '0000' });
r = await call('POST', '/staff/login', { phone: waiterPhone, pin: '1234' });
check('PIN guessing locked out after 5 tries', r.status === 400 && /Too many/.test(r.json?.error ?? ''), r.json?.error);
const owner2Tok = await newOwner('Owner 2');
r = await call('POST', '/venues', { name: 'Other Bar', momoPhone: '0789000000', acceptTerms: true }, owner2Tok);
const venue2 = r.json?.data?.id;
r = await call('POST', '/staff', { venueId: venue2, name: 'Alice', phone: waiterPhone }, owner2Tok);
check('Same waiter can join a second venue', r.status === 201 && r.json?.data?.staff?.venueId === venue2);
// ── Google sign-in returns to the site it started from ───────────────────────
console.log('\n── Sign-in');
{
  const stateFor = async (from) => {
    const res = await fetch(`${BASE}/auth/google?from=${encodeURIComponent(from)}`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    return loc.startsWith('https://accounts.google.com') ? new URL(loc).searchParams.get('state') : `no Google redirect (${res.status})`;
  };
  let s = await stateFor('http://localhost:5198');
  check('Sign-in started on the second site returns there', s === 'http://localhost:5198', s);
  s = await stateFor('https://evil.example');
  check('Sign-in from an unknown address returns to the main site', s === 'http://localhost:5199', s);
  const cb = await fetch(`${BASE}/auth/google/callback?state=${encodeURIComponent('https://evil.example')}`, { redirect: 'manual' });
  check('Sign-in callback never sends anyone to an unknown address', !(cb.headers.get('location') || '').includes('evil.example'), cb.headers.get('location'));
}

{
  // The request nobody answered (created at the start of the bookings section).
  let st;
  for (let i = 0; i < 40; i++) {
    st = (await q1(`select status from bookings where access_token='tok-expire'`))?.status;
    const reminded = (await q1(`select reminder_sent_at from bookings where access_token='tok-remind'`))?.reminder_sent_at;
    if (st === 'expired' && reminded) break;
    await sleep(2000);
  }
  check('An unanswered booking request expires by itself', st === 'expired', st);
  const rem = await q1(`select reminder_sent_at from bookings where access_token='tok-remind'`);
  check('A confirmed booking gets its reminder 2 hours before', !!rem?.reminder_sent_at);
}
check('Server survived the whole run', await alive());

// ── Done ─────────────────────────────────────────────────────────────────────
for (const s of [ownerWs, staffWs, bobWs, anonWs, rivalWs]) s.ws.close();
await pg.end();
pawa.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ` - ${f.name}: ${f.detail}`).join('\n'));
process.exit(failed.length ? 1 : 0);
