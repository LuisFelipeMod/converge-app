import { ref, computed } from 'vue';
import type { Shape, TextShape, LineShape, ArrowShape } from '@realtime-collab/shared';
import type { Tool, DragState, DrawState, ResizeState, HandleInfo, SelectionBoxState } from '@/types';
import { THROTTLE_MS, PRESENCE_COLORS } from '@realtime-collab/shared';

const HANDLE_SIZE = 8;
const LINE_HIT_TOLERANCE = 8;
const DUPLICATE_GAP = 80;

export function useCanvas(
  shapes: { value: Map<string, Shape> },
  userId: string,
  userName: string,
  callbacks: {
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>) => void;
    deleteShape: (id: string) => void;
    undo: () => void;
    onCursorMove: (x: number, y: number) => void;
  },
) {
  const activeTool = ref<Tool>('select');
  const selectedShapeIds = ref<Set<string>>(new Set());
  const editingShapeId = ref<string | null>(null);
  const editingText = ref('');
  const pendingTextShape = ref<TextShape | null>(null);

  const drag = ref<DragState>({
    isDragging: false,
    shapeId: null,
    startX: 0, startY: 0,
    offsetX: 0, offsetY: 0,
  });

  const draw = ref<DrawState>({
    isDrawing: false,
    startX: 0, startY: 0,
  });

  const resize = ref<ResizeState>({
    isResizing: false,
    shapeId: null,
    handle: null,
    startX: 0, startY: 0,
    origX: 0, origY: 0,
    origW: 0, origH: 0,
  });

  const selectionBox = ref<SelectionBoxState>({
    isSelecting: false,
    startX: 0, startY: 0,
    currentX: 0, currentY: 0,
  });

  const previewShape = ref<Shape | null>(null);

  const sortedShapes = computed(() =>
    Array.from(shapes.value.values()).sort((a, b) => a.createdAt - b.createdAt),
  );

  // Backward-compat: single selected shape (first in set)
  const selectedShapeId = computed<string | null>(() => {
    if (selectedShapeIds.value.size === 0) return null;
    return selectedShapeIds.value.values().next().value ?? null;
  });

  const selectedShape = computed(() => {
    if (selectedShapeIds.value.size !== 1) return null;
    const id = selectedShapeIds.value.values().next().value;
    return id ? shapes.value.get(id) || null : null;
  });

  const resizeHandles = computed<HandleInfo[]>(() => {
    const s = selectedShape.value;
    if (!s || s.type === 'line' || s.type === 'arrow') return [];
    const hs = HANDLE_SIZE / 2;
    return [
      { id: 'nw', x: s.x - hs, y: s.y - hs, cursor: 'nwse-resize' },
      { id: 'ne', x: s.x + s.width - hs, y: s.y - hs, cursor: 'nesw-resize' },
      { id: 'sw', x: s.x - hs, y: s.y + s.height - hs, cursor: 'nesw-resize' },
      { id: 'se', x: s.x + s.width - hs, y: s.y + s.height - hs, cursor: 'nwse-resize' },
    ];
  });

  let lastThrottleTime = 0;

  function getColor(): string {
    const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
  }

  function generateId(): string {
    return `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getSvgPoint(e: MouseEvent, svgEl: SVGSVGElement) {
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (ctm) {
      const worldPt = pt.matrixTransform(ctm.inverse());
      return { x: worldPt.x, y: worldPt.y };
    }
    const rect = svgEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ─── Hit detection ───

  function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function findShapeAt(x: number, y: number): Shape | null {
    const allShapes = sortedShapes.value;
    for (let i = allShapes.length - 1; i >= 0; i--) {
      const s = allShapes[i];
      if (s.type === 'line' || s.type === 'arrow') {
        const ls = s as LineShape | ArrowShape;
        if (distToSegment(x, y, ls.x, ls.y, ls.x2, ls.y2) < LINE_HIT_TOLERANCE) {
          return s;
        }
      } else {
        if (x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height) {
          return s;
        }
      }
    }
    return null;
  }

  function findHandleAt(x: number, y: number): HandleInfo | null {
    for (const h of resizeHandles.value) {
      if (x >= h.x && x <= h.x + HANDLE_SIZE && y >= h.y && y <= h.y + HANDLE_SIZE) {
        return h;
      }
    }
    return null;
  }

  function getBoundingBox(s: Shape): { x1: number; y1: number; x2: number; y2: number } {
    if (s.type === 'line' || s.type === 'arrow') {
      const ls = s as LineShape | ArrowShape;
      return {
        x1: Math.min(ls.x, ls.x2),
        y1: Math.min(ls.y, ls.y2),
        x2: Math.max(ls.x, ls.x2),
        y2: Math.max(ls.y, ls.y2),
      };
    }
    return { x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height };
  }

  function findShapesInRect(rx1: number, ry1: number, rx2: number, ry2: number): Shape[] {
    const minX = Math.min(rx1, rx2);
    const minY = Math.min(ry1, ry2);
    const maxX = Math.max(rx1, rx2);
    const maxY = Math.max(ry1, ry2);
    return sortedShapes.value.filter((s) => {
      const bb = getBoundingBox(s);
      return bb.x1 < maxX && bb.x2 > minX && bb.y1 < maxY && bb.y2 > minY;
    });
  }

  // ─── Mouse handlers ───

  function handleMouseDown(e: MouseEvent, svgEl: SVGSVGElement) {
    const point = getSvgPoint(e, svgEl);

    if (activeTool.value === 'select') {
      // Check resize handles first (only when single selection)
      const handle = findHandleAt(point.x, point.y);
      if (handle && selectedShape.value) {
        const s = selectedShape.value;
        resize.value = {
          isResizing: true,
          shapeId: s.id,
          handle: handle.id,
          startX: point.x,
          startY: point.y,
          origX: s.x,
          origY: s.y,
          origW: s.width,
          origH: s.height,
        };
        return;
      }

      const hit = findShapeAt(point.x, point.y);
      if (hit) {
        if (e.shiftKey) {
          // Toggle shape in/out of selection
          const newSet = new Set(selectedShapeIds.value);
          if (newSet.has(hit.id)) {
            newSet.delete(hit.id);
          } else {
            newSet.add(hit.id);
          }
          selectedShapeIds.value = newSet;
        } else {
          // If clicking a shape that's already in multi-selection, keep the group
          if (!selectedShapeIds.value.has(hit.id)) {
            selectedShapeIds.value = new Set([hit.id]);
          }
        }
        drag.value = {
          isDragging: true,
          shapeId: hit.id,
          startX: point.x,
          startY: point.y,
          offsetX: point.x - hit.x,
          offsetY: point.y - hit.y,
        };
      } else {
        // Start rubber band selection
        if (!e.shiftKey) {
          selectedShapeIds.value = new Set();
        }
        selectionBox.value = {
          isSelecting: true,
          startX: point.x,
          startY: point.y,
          currentX: point.x,
          currentY: point.y,
        };
      }
    } else if (activeTool.value === 'text') {
      const shape: TextShape = {
        id: generateId(),
        type: 'text',
        x: point.x,
        y: point.y,
        width: 200,
        height: 40,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        fontSize: 16,
        text: '',
        createdBy: userId,
        createdByName: userName,
        createdAt: Date.now(),
      };
      pendingTextShape.value = shape;
      editingShapeId.value = shape.id;
      editingText.value = '';
    } else {
      // rectangle, circle, line, arrow
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

    // Rubber band selection
    if (selectionBox.value.isSelecting) {
      selectionBox.value.currentX = point.x;
      selectionBox.value.currentY = point.y;
      return;
    }

    // Resize
    if (resize.value.isResizing && resize.value.shapeId && resize.value.handle) {
      const r = resize.value;
      const dx = point.x - r.startX;
      const dy = point.y - r.startY;
      let newX = r.origX, newY = r.origY, newW = r.origW, newH = r.origH;

      switch (r.handle) {
        case 'se':
          newW = Math.max(10, r.origW + dx);
          newH = Math.max(10, r.origH + dy);
          break;
        case 'sw':
          newX = r.origX + dx;
          newW = Math.max(10, r.origW - dx);
          newH = Math.max(10, r.origH + dy);
          if (r.origW - dx < 10) newX = r.origX + r.origW - 10;
          break;
        case 'ne':
          newW = Math.max(10, r.origW + dx);
          newY = r.origY + dy;
          newH = Math.max(10, r.origH - dy);
          if (r.origH - dy < 10) newY = r.origY + r.origH - 10;
          break;
        case 'nw':
          newX = r.origX + dx;
          newW = Math.max(10, r.origW - dx);
          newY = r.origY + dy;
          newH = Math.max(10, r.origH - dy);
          if (r.origW - dx < 10) newX = r.origX + r.origW - 10;
          if (r.origH - dy < 10) newY = r.origY + r.origH - 10;
          break;
      }

      callbacks.updateShape(r.shapeId, { x: newX, y: newY, width: newW, height: newH });
      return;
    }

    // Drag (move all selected shapes together)
    if (drag.value.isDragging && drag.value.shapeId) {
      const dx = point.x - drag.value.startX;
      const dy = point.y - drag.value.startY;

      for (const id of selectedShapeIds.value) {
        const shape = shapes.value.get(id);
        if (!shape) continue;
        if (shape.type === 'line' || shape.type === 'arrow') {
          const ls = shape as LineShape | ArrowShape;
          callbacks.updateShape(id, {
            x: ls.x + dx,
            y: ls.y + dy,
            x2: ls.x2 + dx,
            y2: ls.y2 + dy,
          } as any);
        } else {
          callbacks.updateShape(id, { x: shape.x + dx, y: shape.y + dy });
        }
      }
      drag.value.startX = point.x;
      drag.value.startY = point.y;
    }

    // Draw preview
    if (draw.value.isDrawing) {
      const tool = activeTool.value;

      if (tool === 'line' || tool === 'arrow') {
        previewShape.value = {
          id: 'preview',
          type: tool,
          x: draw.value.startX,
          y: draw.value.startY,
          x2: point.x,
          y2: point.y,
          width: Math.abs(point.x - draw.value.startX),
          height: Math.abs(point.y - draw.value.startY),
          fill: 'transparent',
          stroke: getColor(),
          strokeWidth: 2,
          curved: false,
          dashed: false,
          createdBy: userId,
          createdByName: userName,
          createdAt: 0,
        } as LineShape | ArrowShape;
      } else {
        const width = Math.abs(point.x - draw.value.startX);
        const height = Math.abs(point.y - draw.value.startY);
        const x = Math.min(point.x, draw.value.startX);
        const y = Math.min(point.y, draw.value.startY);

        previewShape.value = {
          id: 'preview',
          type: tool as 'rectangle' | 'circle',
          x, y, width, height,
          fill: getColor() + '33',
          stroke: getColor(),
          strokeWidth: 2,
          createdBy: userId,
          createdByName: userName,
          createdAt: 0,
        };
      }
    }
  }

  function handleMouseUp(e: MouseEvent, svgEl: SVGSVGElement) {
    // Rubber band selection end
    if (selectionBox.value.isSelecting) {
      const sb = selectionBox.value;
      const found = findShapesInRect(sb.startX, sb.startY, sb.currentX, sb.currentY);
      if (e.shiftKey) {
        const newSet = new Set(selectedShapeIds.value);
        for (const s of found) newSet.add(s.id);
        selectedShapeIds.value = newSet;
      } else {
        selectedShapeIds.value = new Set(found.map((s) => s.id));
      }
      selectionBox.value.isSelecting = false;
      return;
    }

    if (resize.value.isResizing) {
      resize.value.isResizing = false;
      resize.value.shapeId = null;
      resize.value.handle = null;
      return;
    }

    if (drag.value.isDragging) {
      drag.value.isDragging = false;
      drag.value.shapeId = null;
    }

    if (draw.value.isDrawing) {
      draw.value.isDrawing = false;
      const point = getSvgPoint(e, svgEl);
      const tool = activeTool.value;

      if (tool === 'line' || tool === 'arrow') {
        const dist = Math.hypot(point.x - draw.value.startX, point.y - draw.value.startY);
        if (dist > 5) {
          const shape = {
            id: generateId(),
            type: tool,
            x: draw.value.startX,
            y: draw.value.startY,
            x2: point.x,
            y2: point.y,
            width: Math.abs(point.x - draw.value.startX),
            height: Math.abs(point.y - draw.value.startY),
            fill: 'transparent',
            stroke: getColor(),
            strokeWidth: 2,
            curved: false,
            dashed: false,
            createdBy: userId,
            createdByName: userName,
            createdAt: Date.now(),
          } as LineShape | ArrowShape;
          callbacks.addShape(shape);
        }
      } else {
        const width = Math.abs(point.x - draw.value.startX);
        const height = Math.abs(point.y - draw.value.startY);

        if (width > 5 && height > 5) {
          const shape: Shape = {
            id: generateId(),
            type: tool as 'rectangle' | 'circle',
            x: Math.min(point.x, draw.value.startX),
            y: Math.min(point.y, draw.value.startY),
            width, height,
            fill: getColor() + '33',
            stroke: getColor(),
            strokeWidth: 2,
            createdBy: userId,
            createdByName: userName,
            createdAt: Date.now(),
          };
          callbacks.addShape(shape);
        }
      }
      previewShape.value = null;
    }
  }

  function handleDblClick(e: MouseEvent, svgEl: SVGSVGElement) {
    const point = getSvgPoint(e, svgEl);
    const hit = findShapeAt(point.x, point.y);
    if (hit) {
      editingShapeId.value = hit.id;
      editingText.value = hit.text || '';
    }
  }

  function commitTextEdit() {
    if (pendingTextShape.value && editingShapeId.value === pendingTextShape.value.id) {
      const text = editingText.value.trim();
      if (text) {
        callbacks.addShape({ ...pendingTextShape.value, text });
      }
      pendingTextShape.value = null;
    } else if (editingShapeId.value) {
      callbacks.updateShape(editingShapeId.value, { text: editingText.value });
    }
    editingShapeId.value = null;
    editingText.value = '';
  }

  function cancelTextEdit() {
    pendingTextShape.value = null;
    editingShapeId.value = null;
    editingText.value = '';
  }

  function deleteSelected() {
    for (const id of selectedShapeIds.value) {
      callbacks.deleteShape(id);
    }
    selectedShapeIds.value = new Set();
  }

  function duplicateWithArrow(direction: 'up' | 'down' | 'left' | 'right') {
    const shape = selectedShape.value;
    if (!shape || shape.type === 'line' || shape.type === 'arrow') return;

    // Calculate new shape position
    let newX = shape.x;
    let newY = shape.y;
    if (direction === 'right') newX = shape.x + shape.width + DUPLICATE_GAP;
    else if (direction === 'left') newX = shape.x - shape.width - DUPLICATE_GAP;
    else if (direction === 'down') newY = shape.y + shape.height + DUPLICATE_GAP;
    else if (direction === 'up') newY = shape.y - shape.height - DUPLICATE_GAP;

    // Calculate arrow start/end points (edge centers)
    let ax1 = 0, ay1 = 0, ax2 = 0, ay2 = 0;
    if (direction === 'right') {
      ax1 = shape.x + shape.width; ay1 = shape.y + shape.height / 2;
      ax2 = newX; ay2 = newY + shape.height / 2;
    } else if (direction === 'left') {
      ax1 = shape.x; ay1 = shape.y + shape.height / 2;
      ax2 = newX + shape.width; ay2 = newY + shape.height / 2;
    } else if (direction === 'down') {
      ax1 = shape.x + shape.width / 2; ay1 = shape.y + shape.height;
      ax2 = newX + shape.width / 2; ay2 = newY;
    } else if (direction === 'up') {
      ax1 = shape.x + shape.width / 2; ay1 = shape.y;
      ax2 = newX + shape.width / 2; ay2 = newY + shape.height;
    }

    // Create arrow
    const arrowShape: ArrowShape = {
      id: generateId(),
      type: 'arrow',
      x: ax1, y: ay1,
      x2: ax2, y2: ay2,
      width: Math.abs(ax2 - ax1),
      height: Math.abs(ay2 - ay1),
      fill: 'transparent',
      stroke: shape.stroke,
      strokeWidth: 2,
      curved: false,
      dashed: false,
      createdBy: userId,
      createdByName: userName,
      createdAt: Date.now(),
    };

    // Clone shape
    const newShape: Shape = {
      ...shape,
      id: generateId(),
      x: newX,
      y: newY,
      text: '',
      createdAt: Date.now(),
    };

    callbacks.addShape(arrowShape);
    callbacks.addShape(newShape);

    // Select new shape and enter text editing mode
    selectedShapeIds.value = new Set([newShape.id]);
    editingShapeId.value = newShape.id;
    editingText.value = '';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (editingShapeId.value) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIds.value.size > 0) {
      deleteSelected();
      e.preventDefault();
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      callbacks.undo();
      e.preventDefault();
    }

    if ((e.key === 'b' || e.key === 'i') && (e.ctrlKey || e.metaKey) && selectedShapeIds.value.size > 0) {
      const prop = e.key === 'b' ? 'bold' : 'italic';
      for (const id of selectedShapeIds.value) {
        const s = shapes.value.get(id);
        if (s) callbacks.updateShape(id, { [prop]: !s[prop] } as any);
      }
      e.preventDefault();
    }

    if (e.ctrlKey && e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      duplicateWithArrow(dirMap[e.key]);
      e.preventDefault();
    }
  }

  return {
    activeTool,
    selectedShapeIds,
    selectedShapeId,
    selectedShape,
    editingShapeId,
    editingText,
    pendingTextShape,
    previewShape,
    sortedShapes,
    resizeHandles,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDblClick,
    handleKeyDown,
    commitTextEdit,
    cancelTextEdit,
    deleteSelected,
  };
}
