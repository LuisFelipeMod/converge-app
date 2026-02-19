// ─── Shape Types ─────────────────────────────────────────────

export type ShapeType = 'rectangle' | 'circle' | 'text' | 'line' | 'arrow' | 'freedraw';

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
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
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
}

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ShapeConnection {
  shapeId: string;
  anchor: AnchorPosition;
}

export interface LineShape extends BaseShape {
  type: 'line';
  x2: number;
  y2: number;
  curved: boolean;
  dashed: boolean;
  curveDirection?: number; // +1 or -1, controls which side the curve bows to
  curveOffsetX?: number;   // custom control point offset from midpoint (set by midpoint drag)
  curveOffsetY?: number;
  connectedStart?: ShapeConnection | null;
  connectedEnd?: ShapeConnection | null;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x2: number;
  y2: number;
  curved: boolean;
  dashed: boolean;
  curveDirection?: number; // +1 or -1, controls which side the curve bows to
  curveOffsetX?: number;   // custom control point offset from midpoint (set by midpoint drag)
  curveOffsetY?: number;
  connectedStart?: ShapeConnection | null;
  connectedEnd?: ShapeConnection | null;
}

export interface FreehandShape extends BaseShape {
  type: 'freedraw';
  points: number[]; // flat array of [x1, y1, x2, y2, ...]
}

export type Shape = RectangleShape | CircleShape | TextShape | LineShape | ArrowShape | FreehandShape;

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
  ownerId: string | null;
  owner?: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Sharing Types ─────────────────────────────────────────

export interface DocumentShareInfo {
  id: string;
  sharedWith: { name: string; email: string };
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface InvitationInfo {
  id: string;
  document: { id: string; name: string };
  sharedBy: { name: string; email: string; avatar?: string };
  createdAt: string;
}

export interface ShareLinkInfo {
  id: string;
  token: string;
  documentName: string;
  active: boolean;
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
