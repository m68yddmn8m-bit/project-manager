import json
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # project_id -> list of (user_id, websocket)
        self._connections: dict[int, list[tuple[int, WebSocket]]] = defaultdict(list)

    async def connect(self, project_id: int, user_id: int, ws: WebSocket):
        await ws.accept()
        self._connections[project_id].append((user_id, ws))

    def disconnect(self, project_id: int, user_id: int, ws: WebSocket):
        self._connections[project_id] = [
            (uid, w) for uid, w in self._connections[project_id] if w is not ws
        ]

    async def broadcast(self, project_id: int, event: str, data: dict, exclude_user: int | None = None):
        payload = json.dumps({"event": event, "data": data})
        dead = []
        for uid, ws in self._connections[project_id]:
            if uid == exclude_user:
                continue
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append((uid, ws))
        for entry in dead:
            self._connections[project_id].remove(entry)

    async def send_to_user(self, user_id: int, event: str, data: dict):
        payload = json.dumps({"event": event, "data": data})
        for project_conns in self._connections.values():
            for uid, ws in project_conns:
                if uid == user_id:
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        pass


ws_manager = ConnectionManager()
