export type Tool = 'select' | 'hand' | 'rectangle' | 'circle' | 'text' | 'line' | 'arrow' | 'freedraw' | 'laser';

export interface DragState {
  isDragging: boolean;
  shapeId: string | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
}

export interface ResizeState {
  isResizing: boolean;
  shapeId: string | null;
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end' | 'mid' | null;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

export interface SelectionBoxState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end' | 'mid';

export interface HandleInfo {
  id: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
}

export interface LaserStroke {
  points: number[]; // flat array [x1, y1, x2, y2, ...]
  createdAt: number;
  opacity: number;
}
