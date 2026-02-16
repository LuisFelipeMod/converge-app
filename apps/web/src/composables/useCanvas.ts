import { ref, computed } from 'vue';
import type { Shape } from '@realtime-collab/shared';
import type { Tool, DragState, DrawState } from '@/types';
import { THROTTLE_MS, PRESENCE_COLORS } from '@realtime-collab/shared';

export function useCanvas(
  shapes: { value: Map<string, Shape> },
  userId: string,
  callbacks: {
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>) => void;
    onCursorMove: (x: number, y: number) => void;
  },
) {
  const activeTool = ref<Tool>('select');
  const selectedShapeId = ref<string | null>(null);

  const drag = ref<DragState>({
    isDragging: false,
    shapeId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const draw = ref<DrawState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
  });

  const previewShape = ref<Shape | null>(null);
  const sortedShapes = computed(() => {
    return Array.from(shapes.value.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  });

  let lastThrottleTime = 0;

  function getColor(): string {
    const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
  }

  function generateId(): string {
    return `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSvgPoint(e: MouseEvent, svgEl: SVGSVGElement): { x: number; y: number } {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handleMouseDown(e: MouseEvent, svgEl: SVGSVGElement) {
    const point = getSvgPoint(e, svgEl);

    if (activeTool.value === 'select') {
      const hit = findShapeAt(point.x, point.y);
      if (hit) {
        selectedShapeId.value = hit.id;
        drag.value = {
          isDragging: true,
          shapeId: hit.id,
          startX: point.x,
          startY: point.y,
          offsetX: point.x - hit.x,
          offsetY: point.y - hit.y,
        };
      } else {
        selectedShapeId.value = null;
      }
    } else {
      draw.value = {
        isDrawing: true,
        startX: point.x,
        startY: point.y,
      };
      previewShape.value = null;
    }
  }

  function handleMouseMove(e: MouseEvent, svgEl: SVGSVGElement) {
    const now = Date.now();
    const point = getSvgPoint(e, svgEl);

    if (now - lastThrottleTime >= THROTTLE_MS) {
      lastThrottleTime = now;
      callbacks.onCursorMove(point.x, point.y);
    }

    if (drag.value.isDragging && drag.value.shapeId) {
      const newX = point.x - drag.value.offsetX;
      const newY = point.y - drag.value.offsetY;
      callbacks.updateShape(drag.value.shapeId, { x: newX, y: newY });
    }

    if (draw.value.isDrawing) {
      const width = Math.abs(point.x - draw.value.startX);
      const height = Math.abs(point.y - draw.value.startY);
      const x = Math.min(point.x, draw.value.startX);
      const y = Math.min(point.y, draw.value.startY);

      previewShape.value = {
        id: 'preview',
        type: activeTool.value as 'rectangle' | 'circle',
        x,
        y,
        width,
        height,
        fill: getColor() + '33',
        stroke: getColor(),
        strokeWidth: 2,
        createdBy: userId,
        createdAt: 0,
      };
    }
  }

  function handleMouseUp(e: MouseEvent, svgEl: SVGSVGElement) {
    if (drag.value.isDragging) {
      drag.value.isDragging = false;
      drag.value.shapeId = null;
    }

    if (draw.value.isDrawing) {
      draw.value.isDrawing = false;
      const point = getSvgPoint(e, svgEl);

      const width = Math.abs(point.x - draw.value.startX);
      const height = Math.abs(point.y - draw.value.startY);

      if (width > 5 && height > 5) {
        const shape: Shape = {
          id: generateId(),
          type: activeTool.value as 'rectangle' | 'circle',
          x: Math.min(point.x, draw.value.startX),
          y: Math.min(point.y, draw.value.startY),
          width,
          height,
          fill: getColor() + '33',
          stroke: getColor(),
          strokeWidth: 2,
          createdBy: userId,
          createdAt: Date.now(),
        };
        callbacks.addShape(shape);
      }
      previewShape.value = null;
    }
  }

  function findShapeAt(x: number, y: number): Shape | null {
    const allShapes = sortedShapes.value;
    for (let i = allShapes.length - 1; i >= 0; i--) {
      const s = allShapes[i];
      if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
        return s;
      }
    }
    return null;
  }

  return {
    activeTool,
    selectedShapeId,
    previewShape,
    sortedShapes,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
