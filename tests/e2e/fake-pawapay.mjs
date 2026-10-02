// Strict stand-in for the pawaPay v2 API, used by the end-to-end tests.
// Anything that doesn't match pawaPay's documented request format is
// REJECTED and recorded in `schemaErrors`, so format mistakes fail the tests.
import http from 'http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROVIDERS = ['MTN_MOMO_RWA', 'AIRTEL_RWA'];
const FIELDS = ['depositId', 'payoutId', 'amount', 'currency', 'payer', 'recipient', 'customerMessage', 'metadata', 'clientReferenceId'];

function validateTransfer(body, idField, partyField) {
  const errs = [];
  if (!UUID.test(body[idField] ?? '')) errs.push(`${idField} not UUIDv4`);
  if (!/^([0]|([1-9][0-9]{0,17}))$/.test(body.amount ?? '')) errs.push('amount must be a whole-number string (RWF has no decimals)');
  if (body.currency !== 'RWF') errs.push('currency must be RWF');
  const party = body[partyField];
  if (party?.type !== 'MMO') errs.push(`${partyField}.type must be MMO`);
  if (!/^2507\d{8}$/.test(party?.accountDetails?.phoneNumber ?? '')) errs.push(`${partyField}.accountDetails.phoneNumber must be 2507XXXXXXXX`);
  if (!PROVIDERS.includes(party?.accountDetails?.provider)) errs.push(`invalid provider ${party?.accountDetails?.provider}`);
  if (body.customerMessage !== undefined && !/^[A-Za-z0-9 ]{4,22}$/.test(body.customerMessage)) errs.push(`invalid customerMessage "${body.customerMessage}"`);
  if (body.metadata !== undefined && (!Array.isArray(body.metadata) || body.metadata.length > 10)) errs.push('metadata must be an array of at most 10');
  for (const k of Object.keys(body)) if (!FIELDS.includes(k)) errs.push(`unsupported field ${k}`);
  return errs;
}

export function startFakePawapay({ port = 3098, token = 'fake-test-token' } = {}) {
  const state = {
    deposits: new Map(),
    payouts: [],
    schemaErrors: [],
    rejectNextPayout: false,
    fail500NextDeposit: false,
  };

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      const send = (o, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      if (req.headers.authorization !== `Bearer ${token}`) return send({ failureReason: { failureCode: 'AUTHENTICATION_ERROR' } }, 401);
      const reject = (idField, errs) => {
        state.schemaErrors.push(...errs);
        return send({ [idField]: body[idField], status: 'REJECTED', failureReason: { failureCode: 'INVALID_PARAMETER', failureMessage: errs.join('; ') } });
      };
      const [, , kind, id] = req.url.split('/');

      if (req.method === 'POST' && req.url === '/v2/predict-provider') {
        const d = String(body.phoneNumber ?? '').replace(/\D/g, '');
        if (/^2507[89]\d{7}$/.test(d)) return send({ country: 'RWA', provider: 'MTN_MOMO_RWA', phoneNumber: d });
        if (/^2507[23]\d{7}$/.test(d)) return send({ country: 'RWA', provider: 'AIRTEL_RWA', phoneNumber: d });
        return send({ failureReason: { failureCode: 'INVALID_PHONE_NUMBER' } }, 400);
      }
      if (req.method === 'POST' && req.url === '/v2/deposits') {
        const errs = validateTransfer(body, 'depositId', 'payer');
        if (errs.length) return reject('depositId', errs);
        state.deposits.set(body.depositId, { ...body, status: 'ACCEPTED' });
        if (state.fail500NextDeposit) { state.fail500NextDeposit = false; return send({ error: 'gateway timeout' }, 504); }
        return send({ depositId: body.depositId, status: 'ACCEPTED', created: new Date().toISOString() });
      }
      if (req.method === 'GET' && kind === 'deposits') {
        const d = state.deposits.get(id);
        if (!d) return send({ status: 'NOT_FOUND' });
        return send({ status: 'FOUND', data: { depositId: d.depositId, status: d.status, amount: d.amount, currency: 'RWF', ...(d.failureCode ? { failureReason: { failureCode: d.failureCode } } : {}) } });
      }
      if (req.method === 'POST' && req.url === '/v2/payouts') {
        const errs = validateTransfer(body, 'payoutId', 'recipient');
        if (errs.length) return reject('payoutId', errs);
        if (state.rejectNextPayout) {
          state.rejectNextPayout = false;
          return send({ payoutId: body.payoutId, status: 'REJECTED', failureReason: { failureCode: 'PROVIDER_TEMPORARILY_UNAVAILABLE' } });
        }
        state.payouts.push(body);
        return send({ payoutId: body.payoutId, status: 'ACCEPTED', created: new Date().toISOString() });
      }
      if (req.method === 'GET' && kind === 'payouts') {
        const p = state.payouts.find((x) => x.payoutId === id);
        return send(p ? { status: 'FOUND', data: { payoutId: p.payoutId, status: 'COMPLETED' } } : { status: 'NOT_FOUND' });
      }
      send({}, 404);
    });
  });
  server.listen(port);
  return { state, close: () => server.close() };
}
