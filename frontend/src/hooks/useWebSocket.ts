import { useEffect, useRef, useCallback } from "react";
import type { WsEvent } from "../types";

export function useProjectWebSocket(
  projectId: number | undefined,
  token: string | null,
  onMessage: (event: WsEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!projectId || !token) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/ws/projects/${projectId}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const parsed: WsEvent = JSON.parse(e.data);
        onMessageRef.current(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      // reconnect after 3 seconds on unexpected close
      setTimeout(connect, 3000);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25000);

    ws.onclose = () => {
      clearInterval(ping);
      setTimeout(connect, 3000);
    };
  }, [projectId, token]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);
}
