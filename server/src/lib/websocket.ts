import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { WsEvent } from '@tabpro/shared';

// Map: venueId -> Set of connected WebSocket clients
const venueClients = new Map<string, Set<WebSocket>>();

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const venueId = url.searchParams.get('venueId');

    if (!venueId) {
      ws.close(1008, 'Missing venueId');
      return;
    }

    // If token provided, verify it — accepts both owner and staff JWTs
    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET!);
      } catch {
        ws.close(1008, 'Invalid token');
        return;
      }
    }

    // Register client under venueId
    if (!venueClients.has(venueId)) {
      venueClients.set(venueId, new Set());
    }
    venueClients.get(venueId)!.add(ws);

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

  console.log('✅ WebSocket server ready at /ws');
  return wss;
}

// Broadcast an event to all clients connected to a specific venue
export function broadcastToVenue(venueId: string, event: WsEvent) {
  const clients = venueClients.get(venueId);
  if (!clients) return;

  const message = JSON.stringify(event);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
