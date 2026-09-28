import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { WsEvent } from '@tabpro/shared';
import { db } from './db';
import { venues, staff, tabs } from '../models/schema';

// Map: venueId -> Set of connected WebSocket clients
const venueClients = new Map<string, Set<WebSocket>>();

// Track liveness per-socket so we can detect and clean up connections that
// were silently dropped by a proxy/load balancer without a proper close
// handshake. Without this, a connection can look "OPEN" to the server
// indefinitely while actually being dead on the wire — new_order/customer_away/
// etc. broadcasts sent to it just vanish with no error and no retry.
const aliveMap = new WeakMap<WebSocket, boolean>();

// Customers connect without a token and only see events about their own tab.
// Staff and owners see the whole venue.
const customerTabOf = new WeakMap<WebSocket, string>();

// Who may listen to this venue: its owner, one of its active staff, or (for
// customer sockets) a client holding a tab that is at this venue.
async function authorize(venueId: string, token: string | null, tabId: string | null): Promise<'venue' | 'tab' | null> {
  if (token) {
    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return null;
    }
    if (payload.ownerId) {
      const venue = await db.query.venues.findFirst({ where: eq(venues.id, venueId) });
      return venue?.ownerId === payload.ownerId ? 'venue' : null;
    }
    if (payload.staffId) {
      const member = await db.query.staff.findFirst({ where: eq(staff.id, payload.staffId) });
      return member?.isActive && member.venueId === venueId ? 'venue' : null;
    }
    return null;
  }
  if (tabId) {
    const tab = await db.query.tabs.findFirst({ where: eq(tabs.id, tabId), with: { table: true } });
    return tab?.table?.venueId === venueId ? 'tab' : null;
  }
  return null;
}

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const venueId = url.searchParams.get('venueId');
    const tabId = url.searchParams.get('tabId');

    if (!venueId) {
      ws.close(1008, 'Missing venueId');
      return;
    }

    let access: 'venue' | 'tab' | null;
    try {
      access = await authorize(venueId, token, tabId);
    } catch {
      access = null; // e.g. malformed ids
    }
    if (!access) {
      ws.close(1008, 'Unauthorized');
      return;
    }
    if (access === 'tab') customerTabOf.set(ws, tabId!);

    // Register client under venueId
    if (!venueClients.has(venueId)) {
      venueClients.set(venueId, new Set());
    }
    venueClients.get(venueId)!.add(ws);
    aliveMap.set(ws, true);

    ws.on('pong', () => {
      aliveMap.set(ws, true);
    });

    ws.on('close', () => {
      venueClients.get(venueId)?.delete(ws);
      if (venueClients.get(venueId)?.size === 0) {
        venueClients.delete(venueId);
      }
    });

    ws.on('error', (err) => {
      console.error(`WS error for venue ${venueId}:`, err.message);
    });

    // Heartbeat
    ws.send(JSON.stringify({ type: 'connected', venueId }));
  });

  // Ping every connection every 25s. Browsers reply to a ping frame with a
  // pong automatically (no client-side code needed). Any socket that didn't
  // answer the previous ping is presumed dead and terminated, so it's
  // removed from venueClients instead of silently accumulating as a
  // zombie that broadcastToVenue thinks is still open.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveMap.get(ws) === false) {
        ws.terminate();
        return;
      }
      aliveMap.set(ws, false);
      ws.ping();
    });
  }, 25_000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log('✅ WebSocket server ready at /ws');
  return wss;
}

// Broadcast an event to all clients connected to a specific venue
export function broadcastToVenue(venueId: string, event: WsEvent) {
  const clients = venueClients.get(venueId);
  if (!clients) return;

  const message = JSON.stringify(event);
  const eventTabId = (event.payload as any)?.tabId;
  clients.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const customerTab = customerTabOf.get(ws);
    if (customerTab && customerTab !== eventTabId) return;
    ws.send(message);
  });
}
