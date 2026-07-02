import { useEffect, useRef, useCallback } from 'react';
import { WsEvent } from '@tabpro/shared';

interface UseWebSocketOptions {
  venueId: string;
  token?: string;
  onEvent: (event: WsEvent) => void;
  enabled?: boolean;
}

export function useWebSocket({ venueId, token, onEvent, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!enabled || !venueId) return;

    const wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
    const params = new URLSearchParams({ venueId });
    if (token) params.set('token', token);

    const ws = new WebSocket(`${wsBase}?${params}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to venue ${venueId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && data.type !== 'connected') {
          onEventRef.current(data as WsEvent);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected — reconnecting in 3s');
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [venueId, token, enabled]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
