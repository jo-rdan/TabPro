// pawaPay API v2 client — https://docs.pawapay.io/v2
//
// Config (server/.env):
//   PAWAPAY_API_TOKEN   API token from the pawaPay dashboard (sandbox or production)
//   PAWAPAY_ENV         "sandbox" (default) or "production"
//   PAWAPAY_BASE_URL    optional override of the base URL (used by tests)

import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URLS = {
  sandbox: 'https://api.sandbox.pawapay.io',
  production: 'https://api.pawapay.io',
} as const;

export const PAWAPAY_ENV: keyof typeof BASE_URLS = process.env.PAWAPAY_ENV === 'production' ? 'production' : 'sandbox';
const BASE_URL = process.env.PAWAPAY_BASE_URL || BASE_URLS[PAWAPAY_ENV];
const API_TOKEN = process.env.PAWAPAY_API_TOKEN || '';

export const isPawapayConfigured = () => API_TOKEN.length > 0;

// Rwanda mobile money providers pawaPay supports. RWF has no decimals.
export const RWANDA_PROVIDERS = {
  MTN_MOMO_RWA: 'MTN MoMo',
  AIRTEL_RWA: 'Airtel Money',
} as const;
export type RwandaProvider = keyof typeof RWANDA_PROVIDERS;

// Infrastructure / configuration failure talking to pawaPay. Never shown to
// customers verbatim.
export class PawapayError extends Error {
  constructor(message: string, public failureCode?: string) {
    super(message);
  }
}

// A problem the customer can act on (wrong number, insufficient balance…).
export class PaymentRefusedError extends Error {
  constructor(message: string, public failureCode: string) {
    super(message);
  }
}

// Customer-facing wording for pawaPay failure codes.
const FAILURE_MESSAGES: Record<string, string> = {
  INVALID_PHONE_NUMBER: "That number isn't a valid MTN MoMo or Airtel Money number.",
  INVALID_PROVIDER: "That number isn't a valid MTN MoMo or Airtel Money number.",
  AMOUNT_OUT_OF_BOUNDS: 'This amount is outside Mobile Money limits. Please pay your waiter.',
  PROVIDER_TEMPORARILY_UNAVAILABLE: 'Mobile Money is temporarily unavailable. Please try again shortly or pay your waiter.',
  PAYER_NOT_FOUND: 'This number has no Mobile Money account.',
  PAYMENT_NOT_APPROVED: "The payment wasn't approved on your phone. You can try again.",
  PAYER_LIMIT_REACHED: 'Your Mobile Money transaction limit has been reached.',
  INSUFFICIENT_BALANCE: 'Not enough balance on your Mobile Money account.',
  PAYMENT_IN_PROGRESS: 'You already have a Mobile Money payment waiting for approval on your phone.',
  WALLET_LIMIT_REACHED: 'Your Mobile Money wallet limit has been reached.',
};
export const failureMessage = (code?: string) =>
  (code && FAILURE_MESSAGES[code]) || "The payment didn't go through. Please try again or pay your waiter.";

// Failure codes that mean our setup is wrong, not the customer's.
const CONFIG_FAILURES = new Set([
  'AUTHENTICATION_ERROR', 'AUTHORISATION_ERROR', 'DEPOSITS_NOT_ALLOWED', 'PAYOUTS_NOT_ALLOWED',
  'INVALID_CURRENCY', 'MISSING_PARAMETER', 'INVALID_PARAMETER', 'UNSUPPORTED_PARAMETER', 'INVALID_INPUT',
  'INVALID_AMOUNT', 'UNKNOWN_ERROR',
]);

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; data: T }> {
  if (!API_TOKEN) throw new PawapayError('PAWAPAY_API_TOKEN is not configured');
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TOKEN}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err: any) {
    throw new PawapayError(`pawaPay ${method} ${path} network error: ${err.message}`, 'NETWORK_ERROR');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (res.status === 401 || res.status === 403) {
    throw new PawapayError(`pawaPay rejected the API token (${res.status}) on ${path}`, 'AUTHENTICATION_ERROR');
  }
  if (res.status >= 500) throw new PawapayError(`pawaPay ${path} failed with ${res.status}: ${text.slice(0, 200)}`, 'UNKNOWN_ERROR');
  return { status: res.status, data };
}

// Turns an ACCEPTED/REJECTED/DUPLICATE_IGNORED initiation answer into
// success or the right kind of error.
function assertAccepted(what: string, data: any) {
  if (data?.status === 'ACCEPTED' || data?.status === 'DUPLICATE_IGNORED') return;
  const code: string = data?.failureReason?.failureCode ?? 'UNKNOWN_ERROR';
  const detail = data?.failureReason?.failureMessage ?? JSON.stringify(data)?.slice(0, 200);
  if (CONFIG_FAILURES.has(code)) throw new PawapayError(`pawaPay ${what} rejected: ${code} — ${detail}`, code);
  throw new PaymentRefusedError(failureMessage(code), code);
}

// ─── Toolkit ──────────────────────────────────────────────────────────────────

/** 07XXXXXXXX / +250 7XX… / 7XXXXXXXX → 2507XXXXXXXX */
export function toRwandaMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('250')) return digits;
  if (digits.startsWith('0')) return '250' + digits.slice(1);
  if (digits.length === 9 && digits.startsWith('7')) return '250' + digits;
  return digits;
}

// Prefix fallback, only used if predict-provider itself is unreachable.
function providerFromPrefix(msisdn: string): RwandaProvider | null {
  if (/^2507[23]/.test(msisdn)) return 'AIRTEL_RWA';
  if (/^2507[89]/.test(msisdn)) return 'MTN_MOMO_RWA';
  return null;
}

/**
 * Validates a Rwandan mobile money number and finds its provider. pawaPay's
 * prediction also handles numbers ported between networks.
 */
export async function predictProvider(phone: string): Promise<{ phoneNumber: string; provider: RwandaProvider }> {
  const msisdn = toRwandaMsisdn(phone);
  try {
    const { status, data } = await request<any>('POST', '/v2/predict-provider', { phoneNumber: msisdn });
    if (status === 200 && data?.country === 'RWA' && data.provider in RWANDA_PROVIDERS) {
      return { phoneNumber: data.phoneNumber, provider: data.provider };
    }
    throw new PaymentRefusedError(failureMessage('INVALID_PHONE_NUMBER'), 'INVALID_PHONE_NUMBER');
  } catch (err) {
    if (!(err instanceof PawapayError) || err.failureCode === 'AUTHENTICATION_ERROR') throw err;
    const provider = providerFromPrefix(msisdn);
    if (!provider) throw new PaymentRefusedError(failureMessage('INVALID_PHONE_NUMBER'), 'INVALID_PHONE_NUMBER');
    return { phoneNumber: msisdn, provider };
  }
}

// ─── Deposits (customer pays) and payouts (venue gets paid) ──────────────────

export type TransferStatus = 'pending' | 'successful' | 'failed' | 'not_found';

export interface TransferResult {
  status: TransferStatus;
  rawStatus: string;
  failureCode?: string;
}

function toTransferResult(data: any): TransferResult {
  if (data?.status === 'NOT_FOUND') return { status: 'not_found', rawStatus: 'NOT_FOUND' };
  const raw: string = data?.data?.status ?? 'UNKNOWN';
  const failureCode: string | undefined = data?.data?.failureReason?.failureCode;
  // ACCEPTED, SUBMITTED, PROCESSING, IN_RECONCILIATION: still in flight.
  const status: TransferStatus = raw === 'COMPLETED' ? 'successful' : raw === 'FAILED' ? 'failed' : 'pending';
  return { status, rawStatus: raw, failureCode };
}

export interface TransferRequest {
  id: string;             // our UUIDv4, stored before calling pawaPay
  phoneNumber: string;    // 2507XXXXXXXX
  provider: RwandaProvider;
  amountRwf: number;      // whole francs — RWF has no decimals
  customerMessage: string; // 4–22 letters, digits, spaces
  metadata?: Record<string, string>;
}

const metadataList = (m?: Record<string, string>) =>
  m ? Object.entries(m).slice(0, 10).map(([k, v]) => ({ [k]: v })) : undefined;

async function initiate(kind: 'deposits' | 'payouts', body: object, id: string): Promise<void> {
  try {
    const { data } = await request<any>('POST', `/v2/${kind}`, body);
    assertAccepted(kind === 'deposits' ? 'deposit' : 'payout', data);
  } catch (err) {
    // pawaPay: on a timeout or server error, the request may still have
    // arrived. Only treat it as failed if pawaPay has never heard of it.
    if (err instanceof PawapayError && ['NETWORK_ERROR', 'UNKNOWN_ERROR'].includes(err.failureCode ?? '')) {
      const check = await getTransfer(kind, id).catch(() => null);
      if (check && check.status !== 'not_found') return;
    }
    throw err;
  }
}

export function initiateDeposit(r: TransferRequest) {
  return initiate('deposits', {
    depositId: r.id,
    amount: String(Math.round(r.amountRwf)),
    currency: 'RWF',
    payer: { type: 'MMO', accountDetails: { phoneNumber: r.phoneNumber, provider: r.provider } },
    customerMessage: r.customerMessage,
    metadata: metadataList(r.metadata),
  }, r.id);
}

export function initiatePayout(r: TransferRequest) {
  return initiate('payouts', {
    payoutId: r.id,
    amount: String(Math.round(r.amountRwf)),
    currency: 'RWF',
    recipient: { type: 'MMO', accountDetails: { phoneNumber: r.phoneNumber, provider: r.provider } },
    customerMessage: r.customerMessage,
    metadata: metadataList(r.metadata),
  }, r.id);
}

async function getTransfer(kind: 'deposits' | 'payouts', id: string): Promise<TransferResult> {
  const { data } = await request<any>('GET', `/v2/${kind}/${id}`);
  return toTransferResult(data);
}

export const getDeposit = (depositId: string) => getTransfer('deposits', depositId);
export const getPayout = (payoutId: string) => getTransfer('payouts', payoutId);

// ─── Account checks (used by `yarn pawapay:check`) ───────────────────────────

export const getActiveConfig = () => request<any>('GET', '/v2/active-conf?country=RWA').then((r) => r.data);
export const getWalletBalances = () => request<any>('GET', '/v2/wallet-balances?country=RWA').then((r) => r.data);
export const pawapayBaseUrl = () => BASE_URL;
