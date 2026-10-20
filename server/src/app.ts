import express from 'express';
// Routes thrown errors from async handlers into errorMiddleware; without it
// Express 4 leaves them unhandled and Node kills the whole process.
import 'express-async-errors';
import cors from 'cors';
import passport from 'passport';
import { createServer } from 'http';
import * as dotenv from 'dotenv';

import { initPassport } from './services/auth.service';
import { initWebSocket } from './lib/websocket';
import routes from './routes/index';
import { errorMiddleware } from './middleware/error.middleware';
import { logError } from './lib/errorLog';
import { allowedOrigins } from './lib/origins';
import { markActive } from './lib/activity';
import { db } from './lib/db';
import { sql } from 'drizzle-orm';

dotenv.config();

const app = express();
// Render sits in front of us: trust its X-Forwarded-For so req.ip is the visitor.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: allowedOrigins(),
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Passport ─────────────────────────────────────────────────────────────────

initPassport();
app.use(passport.initialize());

// ─── Routes ───────────────────────────────────────────────────────────────────

// A real request means Skuzi is in use, so the background timers may query
// again (lib/activity.ts). Mounted before the routes and only on /api, so the
// keep-alive ping and Render's own /health check never wake the database.
app.use('/api', (_req, _res, next) => { markActive(); next(); });

app.use('/api', routes);

// Health check: the server is up. Deliberately does NOT touch the database —
// Render polls this and our keep-alive pings it every 10 minutes, and on
// Neon's free plan every query keeps the database awake and burns the monthly
// compute allowance.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// The database is up too. This one DOES query, so the watchdog must call it
// sparingly (see .github/workflows/watchdog.yml). On 2026-10-19 the database
// was out of compute for hours while /health happily answered "ok", so the
// watchdog saw nothing and Jordan found out from a restaurant manager.
app.get('/health/db', async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err?.message ?? 'unreachable' });
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorMiddleware);

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
import { startUnpaidBillsChecker } from './services/unpaid.service';
import { startHeartbeatChecker } from './services/heartbeat.service';
import { startPaymentReconciler } from './services/pawapay.service';
import { startKeepAlive } from './lib/keepAlive';
import { startScheduler } from './lib/scheduler';
import { isPawapayConfigured, PAWAPAY_ENV } from './lib/pawapay';

// Last line of defence: a failure in a background job (heartbeat checker,
// push send, etc.) must never take every venue offline.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  void logError('background', reason);
});

const server = createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`✅ Skuzi server running on http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(isPawapayConfigured()
    ? `✅ Mobile Money: pawaPay ${PAWAPAY_ENV}`
    : '⚠️  Mobile Money: OFF — PAWAPAY_API_TOKEN not set, customers will be asked to pay their waiter');
  startHeartbeatChecker();
  startUnpaidBillsChecker();
  startPaymentReconciler();
  startKeepAlive();
  startScheduler();
});

export default app;
