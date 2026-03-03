type MessageHandler = (data: any) => void;

function getWsBase(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") return `ws://${window.location.hostname}:8000`;
  return "ws://127.0.0.1:8000";
}
const WS_BASE = getWsBase();

export class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private token: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(token: string) {
    this.token = token;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_BASE}/ws?token=${this.token}`);

    this.ws.onopen = () => {
      this._connected = true;
      this.emit("_connected", {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      } catch {
        // ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.emit("_disconnected", {});
      // Auto-reconnect after 3 seconds
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, data: any) {
    this.handlers.get(type)?.forEach((h) => {
      try {
        h(data);
      } catch {
        // prevent handler errors from crashing ws
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }
}

// Singleton instance
let _instance: WSClient | null = null;

export function getWSClient(token?: string): WSClient {
  if (!_instance && token) {
    _instance = new WSClient(token);
  }
  return _instance!;
}

export function destroyWSClient() {
  _instance?.disconnect();
  _instance = null;
}
