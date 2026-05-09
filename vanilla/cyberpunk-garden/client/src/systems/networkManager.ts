// ============================================================
// NETWORK MANAGER — typed Socket.io client wrapper
// ============================================================

import { io, Socket } from 'socket.io-client';
import type { Player, Tile, ChatMessage, SerializedChunk, WeatherType, Season } from '../../../shared/src/types.js';

type EventCallback<T> = (data: T) => void;

export interface NetworkEvents {
  welcome: { player: Player; nearbyPlayers: Player[]; chunk: SerializedChunk };
  world_update: { type: 'tile_changed' | 'tile_removed'; tile: Tile };
  player_moved: { id: string; x: number; y: number };
  player_joined: Player;
  player_left: { id: string };
  chat_message: ChatMessage;
  chunk_data: SerializedChunk;
  error: { code: string; message: string };
  weather: { type: WeatherType; intensity: number };
  season: { season: Season };
  connect: void;
  disconnect: void;
}

class NetworkManager {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventCallback<any>>>();

  connect(serverUrl: string): void {
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // Forward all events to local listeners
    const events = [
      'welcome', 'world_update', 'player_moved', 'player_joined',
      'player_left', 'chat_message', 'chunk_data', 'error',
      'weather', 'season', 'connect', 'disconnect',
    ];
    
    for (const event of events) {
      this.socket.on(event, (data: any) => {
        this.emit(event as keyof NetworkEvents, data);
      });
    }
  }

  on<K extends keyof NetworkEvents>(event: K, cb: EventCallback<NetworkEvents[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as any);
    return () => this.listeners.get(event)?.delete(cb as any);
  }

  private emit<K extends keyof NetworkEvents>(event: K, data: NetworkEvents[K]): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  send<K extends string>(event: K, data?: any): void {
    this.socket?.emit(event, data);
  }

  move(x: number, y: number): void { this.send('move', { x, y }); }
  plant(x: number, y: number, plantType: string): void { this.send('plant', { x, y, plantType }); }
  remove(x: number, y: number): void { this.send('remove', { x, y }); }
  chat(text: string, worldMessage = false): void { this.send('chat', { text, worldMessage }); }
  requestChunk(cx: number, cy: number): void { this.send('request_chunk', { cx, cy }); }

  get connected(): boolean { return this.socket?.connected ?? false; }
  get id(): string { return this.socket?.id ?? ''; }

  disconnect(): void { this.socket?.disconnect(); }
}

export const network = new NetworkManager();
