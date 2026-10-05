// Checks the pawaPay setup: token, Rwanda providers, callback URLs, wallet.
//
//   yarn pawapay:check              read-only checks
//   yarn pawapay:check --live-test  sandbox only: also sends a 100 RWF test
//                                   deposit and payout to pawaPay's test number
//
// Exits non-zero if something needs fixing.
import { v4 as uuidv4 } from 'uuid';
import {
  PAWAPAY_ENV,
  RWANDA_PROVIDERS,
  isPawapayConfigured,
  pawapayBaseUrl,
  getActiveConfig,
  getWalletBalances,
  predictProvider,
  initiateDeposit,
  initiatePayout,
  getDeposit,
  getPayout,
} from '../lib/pawapay';

const problems: string[] = [];
const ok = (msg: string) => console.log(`  ✔ ${msg}`);
const bad = (msg: string) => { console.log(`  ✘ ${msg}`); problems.push(msg); };
const info = (msg: string) => console.log(`    ${msg}`);

async function main() {
  console.log(`\npawaPay ${PAWAPAY_ENV} · ${pawapayBaseUrl()}\n`);

  console.log('Credentials');
  if (!isPawapayConfigured()) {
    bad('PAWAPAY_API_TOKEN is empty in server/.env');
    return;
  }
  let conf: any;
  try {
    conf = await getActiveConfig();
    ok(`token accepted — account "${conf.companyName}"`);
  } catch (err: any) {
    bad(`token rejected: ${err.message}`);
    return;
  }

  if (conf.signatureConfiguration?.signedRequestsOnly) {
    bad('account requires signed requests — Skuzi sends unsigned requests; turn off "signed requests only" in the pawaPay dashboard');
  }

  console.log('\nRwanda providers');
  const publicApi = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  const expected = {
    DEPOSIT: publicApi && `${publicApi}/api/tabpayment/callback/deposit`,
    PAYOUT: publicApi && `${publicApi}/api/tabpayment/callback/payout`,
  };
  const rwanda = conf.countries?.find((c: any) => c.country === 'RWA');
  if (!rwanda) bad('Rwanda is not enabled on this pawaPay account');
  for (const code of Object.keys(RWANDA_PROVIDERS)) {
    const p = rwanda?.providers?.find((x: any) => x.provider === code);
    if (!p) { bad(`${code} is not enabled`); continue; }
    const ops = p.currencies?.find((c: any) => c.currency === 'RWF')?.operationTypes ?? {};
    for (const op of ['DEPOSIT', 'PAYOUT'] as const) {
      const o = ops[op];
      if (!o) { bad(`${code} ${op}: not enabled`); continue; }
      const line = `${code} ${op}: ${o.status}, ${o.minAmount}–${o.maxAmount} RWF`;
      o.status === 'OPERATIONAL' ? ok(line) : bad(line);
      if (!o.callbackUrl) bad(`${code} ${op}: no callback URL set in the pawaPay dashboard${expected[op] ? ` (set ${expected[op]})` : ''}`);
      else if (expected[op] && o.callbackUrl !== expected[op]) bad(`${code} ${op}: callback URL is ${o.callbackUrl}, expected ${expected[op]}`);
      else info(`callback → ${o.callbackUrl}`);
    }
  }
  if (!publicApi) info('(set PUBLIC_API_URL to also verify the callback URLs match this server)');

  console.log('\nWallet');
  try {
    const { balances } = await getWalletBalances();
    const rwf = balances?.filter((b: any) => b.currency === 'RWF') ?? [];
    if (rwf.length === 0) bad('no RWF wallet found');
    for (const b of rwf) ok(`RWF balance ${b.balance}${b.provider ? ` (${b.provider})` : ''} — venue payouts are paid from this`);
  } catch (err: any) {
    bad(`could not read wallet balance: ${err.message}`);
  }

  console.log('\nNumber check (predict-provider)');
  for (const n of ['0788123456', '0733123456']) {
    try {
      const r = await predictProvider(n);
      ok(`${n} → ${r.provider} (${r.phoneNumber})`);
    } catch (err: any) {
      bad(`${n}: ${err.message}`);
    }
  }

  if (process.argv.includes('--live-test')) await liveTest();
}

async function waitFor(get: () => Promise<{ status: string; rawStatus: string; failureCode?: string }>) {
  for (let i = 0; i < 30; i++) {
    const r = await get();
    if (r.status === 'successful' || r.status === 'failed') return r;
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { status: 'timeout', rawStatus: 'TIMEOUT' };
}

// pawaPay sandbox test number that always completes (docs: v2/docs/test_numbers).
const SANDBOX_OK = '250783456789';

async function liveTest() {
  console.log('\nLive sandbox test');
  if (PAWAPAY_ENV !== 'sandbox') {
    bad('--live-test only runs against the sandbox (it would move real money in production)');
    return;
  }
  const depositId = uuidv4();
  await initiateDeposit({ id: depositId, phoneNumber: SANDBOX_OK, provider: 'MTN_MOMO_RWA', amountRwf: 100, customerMessage: 'Skuzi setup test' });
  const d = await waitFor(() => getDeposit(depositId));
  d.status === 'successful' ? ok(`100 RWF deposit completed (${depositId})`) : bad(`deposit ended ${d.rawStatus} ${d.failureCode ?? ''}`);

  const payoutId = uuidv4();
  await initiatePayout({ id: payoutId, phoneNumber: SANDBOX_OK, provider: 'MTN_MOMO_RWA', amountRwf: 100, customerMessage: 'Skuzi setup test' });
  const p = await waitFor(() => getPayout(payoutId));
  p.status === 'successful' ? ok(`100 RWF payout completed (${payoutId})`) : bad(`payout ended ${p.rawStatus} ${p.failureCode ?? ''}`);
}

main()
  .catch((err) => bad(`unexpected error: ${err.message}`))
  .finally(() => {
    console.log(problems.length ? `\n${problems.length} problem(s) to fix.\n` : '\nAll good — pawaPay is ready.\n');
    process.exit(problems.length ? 1 : 0);
  });
