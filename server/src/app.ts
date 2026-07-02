import express from 'express';
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

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

const server = createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`✅ TabPro server running on http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
