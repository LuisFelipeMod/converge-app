export type Tool = 'select' | 'rectangle' | 'circle' | 'text' | 'line' | 'arrow';

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
  handle: 'nw' | 'ne' | 'sw' | 'se' | null;
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

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface HandleInfo {
  id: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
}
