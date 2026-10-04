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
let r = await call('POST', '/venues', { name: 'Test Bar', location: 'Kigali' }, ownerTok);
check('Venue without payout number is refused', r.status === 400, r.json?.error);
r = await call('POST', '/venues', { name: 'Test Bar', location: 'Kigali', momoPhone: '0788 000 000' }, ownerTok);
check('Owner creates venue', r.status === 201, `payout number stored as ${r.json?.data?.momoPhone}`);
const venueId = r.json?.data?.id;

const codes = [rnd() + rnd(), rnd() + rnd(), rnd() + rnd()];
for (const [i, c] of codes.entries()) {
  await pg.query(`insert into qr_stickers (code,status) values ($1,'unclaimed')`, [c]);
  r = await call('POST', '/tables/claim-scan', { venueId, label: `Table ${i + 1}`, scannedCode: `https://app/t/${c}` }, ownerTok);
  check(`Owner claims sticker → Table ${i + 1}`, r.status === 201, `status ${r.status}`);
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
r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788111222', name: 'Bob' });
const tabId = r.json?.data?.tab?.id;
check('Customer scans QR → tab opens with waiter', r.status === 201 && !!r.json?.data?.tab?.staffId, `status ${r.status}`);
const vkeys = Object.keys(r.json?.data?.venue ?? {}).sort().join(',');
check('Customers only see public venue info', vkeys === 'acceptsMobileMoney,id,isDemo,logoUrl,name', vkeys);
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
r = await call('POST', '/tabs/open', { qrCode: codes[0], phone: '0788333444' });
check('Friend scanning same table joins the same tab', r.json?.data?.tab?.id === tabId && r.json?.data?.tab?.status === 'bill_requested');

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
check('Customer is told Mobile Money is available', r.json?.data?.venue?.acceptsMobileMoney === true);
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
const demo = await q1(`insert into venues (owner_id,name,trial_ends_at,is_demo) values ($1,'Demo Lounge',now()+interval '30 days',true) returning id`, [owner1.owner_id]);
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
const awayBefore = ownerWs.events.filter((e) => e.type === 'customer_away').length;
console.log('… waiting for the "stepped away" check (≤ 35s)');
await sleep(35_000);
const awayAlerts = ownerWs.events.filter((e) => e.type === 'customer_away').length - awayBefore;
check('Quiet 5+ min → tab stays open, one alert', (await q1('select status from tabs where id=$1', [t4])).status === 'open' && awayAlerts === 1, `alerts=${awayAlerts}`);
r = await call('POST', '/orders', { tabId: t4, items: [{ menuItemId: item('Primus').id, quantity: 1 }] });
check('Customer can keep ordering after phone was locked', r.status === 201);
await pg.query(`update tabs set status='abandoned' where id=$1`, [t4]);
r = await call('POST', '/tabs/open', { qrCode: codes[1], phone: '0788999111' });
check('Old "abandoned" tab recovered on re-scan', r.json?.data?.tab?.id === t4 && r.json?.data?.tab?.status === 'open');

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
pushServer.close();

const strangerPhone = phone();
await call('POST', '/staff/join', { code: clockCode, name: 'Stranger', phone: strangerPhone, pin: '9999' });
const strangerId = (await q1('select id from staff where phone=$1', [strangerPhone]))?.id;
r = await call('DELETE', `/staff/${strangerId}/join-request`, null, ownerTok);
check('Owner declines a stranger → removed', r.status === 200 && !(await q1('select id from staff where id=$1', [strangerId])));

// ── Website: "Book a demo" ─────────────────────────────────────────────────
console.log('\n── Book a demo');
r = await call('POST', '/demo-requests', { name: 'Aline', venueName: 'Bichu Lounge', phone: '0788 123 456', area: 'Kimihurura', bestTime: 'Afternoon' });
const demoRow = await q1(`select * from demo_requests where venue_name='Bichu Lounge' order by created_at desc limit 1`);
check('Venue owner books a demo from the website', r.status === 201 && demoRow?.phone === '0788 123 456', r.json?.error);
r = await call('POST', '/demo-requests', { name: 'Bot', venueName: 'x', phone: 'call me' });
check('Demo form refuses junk', r.status === 400, r.json?.error);
for (let i = 0; i < 5; i++) await call('POST', '/demo-requests', { name: 'Spam', venueName: 'Spam bar', phone: '0788000000' });
r = await call('POST', '/demo-requests', { name: 'Spam', venueName: 'Spam bar', phone: '0788000000' });
check('Demo form blocks spam bursts', r.status === 429, `status ${r.status}`);

// ── 5. Security ──────────────────────────────────────────────────────────────
console.log('\n── Security');
const rivalTok = await newOwner('Rival');
for (const [name, path] of [['revenue', `/dashboard/stats/${venueId}`], ['staff list', `/staff/${venueId}`], ['orders', `/orders/venue/${venueId}`], ['ratings', `/ratings/leaderboard/${venueId}`], ['shifts', `/shifts/${venueId}`]]) {
  r = await call('GET', path, null, rivalTok);
  check(`Another owner CANNOT read my ${name}`, r.status === 403, `status ${r.status}`);
}
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
r = await call('POST', '/venues', { name: 'Other Bar', momoPhone: '0789000000' }, owner2Tok);
const venue2 = r.json?.data?.id;
r = await call('POST', '/staff', { venueId: venue2, name: 'Alice', phone: waiterPhone }, owner2Tok);
check('Same waiter can join a second venue', r.status === 201 && r.json?.data?.staff?.venueId === venue2);
check('Server survived the whole run', await alive());

// ── Done ─────────────────────────────────────────────────────────────────────
for (const s of [ownerWs, staffWs, bobWs, anonWs, rivalWs]) s.ws.close();
await pg.end();
pawa.close();
const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ` - ${f.name}: ${f.detail}`).join('\n'));
process.exit(failed.length ? 1 : 0);
