// ─── Shape Types ─────────────────────────────────────────────

export type ShapeType = 'rectangle' | 'circle' | 'text' | 'line' | 'arrow';

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  text?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface RectangleShape extends BaseShape {
  type: 'rectangle';
  rx?: number;
  ry?: number;
}

export interface CircleShape extends BaseShape {
  type: 'circle';
}

export interface TextShape extends BaseShape {
  type: 'text';
  fontSize: number;
}

export interface LineShape extends BaseShape {
  type: 'line';
  x2: number;
  y2: number;
  curved: boolean;
  dashed: boolean;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x2: number;
  y2: number;
  curved: boolean;
  dashed: boolean;
}

export type Shape = RectangleShape | CircleShape | TextShape | LineShape | ArrowShape;

// ─── User / Presence ────────────────────────────────────────

export interface UserPresence {
  userId: string;
  name: string;
  color: string;
  avatar?: string;
  cursor: { x: number; y: number } | null;
  lastActive: number;
}

export interface DocumentMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ─── WebSocket Events ───────────────────────────────────────

export const WsEvent = {
  // Yjs sync protocol
  SyncStep1: 'yjs:sync-step-1',
  SyncStep2: 'yjs:sync-step-2',
  Update: 'yjs:update',

  // Awareness / Presence
  AwarenessUpdate: 'awareness:update',
  AwarenessQuery: 'awareness:query',

  // Room management
  JoinDocument: 'document:join',
  LeaveDocument: 'document:leave',
  DocumentJoined: 'document:joined',
  DocumentError: 'document:error',
} as const;

export type WsEvent = (typeof WsEvent)[keyof typeof WsEvent];

// ─── Constants ──────────────────────────────────────────────

export const PRESENCE_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
] as const;

export const THROTTLE_MS = 16; // ~60fps for mouse move
export const PERSIST_DEBOUNCE_MS = 2000;
export const ROOM_CLEANUP_TIMEOUT_MS = 60_000;
