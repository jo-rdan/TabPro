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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

// CLIENT_URL is the site's main address (used in links we generate).
// EXTRA_CLIENT_ORIGINS lists other addresses serving the same site, comma
// separated — e.g. the onrender.com address and www. while moving domains.
const allowedOrigins = [process.env.CLIENT_URL || 'http://localhost:5173',
  ...(process.env.EXTRA_CLIENT_ORIGINS || '').split(',')]
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Passport ─────────────────────────────────────────────────────────────────

initPassport();
app.use(passport.initialize());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorMiddleware);

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
import { startHeartbeatChecker } from './services/heartbeat.service';
import { startPaymentReconciler } from './services/pawapay.service';
import { startKeepAlive } from './lib/keepAlive';
import { isPawapayConfigured, PAWAPAY_ENV } from './lib/pawapay';

// Last line of defence: a failure in a background job (heartbeat checker,
// push send, etc.) must never take every venue offline.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const server = createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`✅ TabPro server running on http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(isPawapayConfigured()
    ? `✅ Mobile Money: pawaPay ${PAWAPAY_ENV}`
    : '⚠️  Mobile Money: OFF — PAWAPAY_API_TOKEN not set, customers will be asked to pay their waiter');
  startHeartbeatChecker();
  startPaymentReconciler();
  startKeepAlive();
});

export default app;
