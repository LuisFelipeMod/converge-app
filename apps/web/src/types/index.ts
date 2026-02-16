export type Tool = 'select' | 'rectangle' | 'circle';

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
