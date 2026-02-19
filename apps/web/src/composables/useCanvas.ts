import { ref, computed } from 'vue';
import type { Shape, TextShape, LineShape, ArrowShape, FreehandShape, AnchorPosition, ShapeConnection } from '@realtime-collab/shared';
import type { Tool, DragState, DrawState, ResizeState, HandleInfo, SelectionBoxState, LaserStroke } from '@/types';
import { THROTTLE_MS, PRESENCE_COLORS } from '@realtime-collab/shared';

const HANDLE_SIZE = 8;
const LINE_HIT_TOLERANCE = 8;
const DUPLICATE_GAP = 80;
const SNAP_DISTANCE = 20;

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

  // Snap-to-shape state
  const snapTarget = ref<{ x: number; y: number; shapeId: string } | null>(null);

  // Freehand drawing state
  const freehandPoints = ref<number[]>([]);

  // Laser pointer state
  const laserStrokes = ref<LaserStroke[]>([]);
  const laserCurrentPoints = ref<number[]>([]);
  const laserIsDrawing = ref(false);
  let laserAnimFrame: number | null = null;

  function startLaserAnimation() {
    if (laserAnimFrame !== null) return;
    const LASER_FADE_MS = 2000;
    function tick() {
      const now = Date.now();
      const strokes = laserStrokes.value;
      let changed = false;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const elapsed = now - strokes[i].createdAt;
        if (elapsed >= LASER_FADE_MS) {
          strokes.splice(i, 1);
          changed = true;
        } else {
          const newOpacity = 1 - elapsed / LASER_FADE_MS;
          if (strokes[i].opacity !== newOpacity) {
            strokes[i].opacity = newOpacity;
            changed = true;
          }
        }
      }
      if (changed) {
        laserStrokes.value = [...strokes];
      }
      if (strokes.length > 0 || laserIsDrawing.value) {
        laserAnimFrame = requestAnimationFrame(tick);
      } else {
        laserAnimFrame = null;
      }
    }
    laserAnimFrame = requestAnimationFrame(tick);
  }

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
    if (!s) return [];
    if (s.type === 'line' || s.type === 'arrow') {
      const ls = s as LineShape | ArrowShape;
      // Calculate midpoint handle position (respects curve offset)
      const mx = (ls.x + ls.x2) / 2 + (ls.curveOffsetX || 0);
      const my = (ls.y + ls.y2) / 2 + (ls.curveOffsetY || 0);
      return [
        { id: 'start', x: ls.x, y: ls.y, cursor: 'crosshair' },
        { id: 'mid', x: mx, y: my, cursor: 'move' },
        { id: 'end', x: ls.x2, y: ls.y2, cursor: 'crosshair' },
      ];
    }
    if (s.type === 'freedraw') return [];
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
      } else if (s.type === 'freedraw') {
        const fs = s as FreehandShape;
        for (let j = 0; j < fs.points.length - 2; j += 2) {
          if (distToSegment(x, y, fs.points[j], fs.points[j + 1], fs.points[j + 2], fs.points[j + 3]) < LINE_HIT_TOLERANCE) {
            return s;
          }
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
    const ENDPOINT_RADIUS = 6;
    for (const h of resizeHandles.value) {
      if (h.id === 'start' || h.id === 'end' || h.id === 'mid') {
        // Circle-based hit test for endpoint/midpoint handles
        if (Math.hypot(x - h.x, y - h.y) <= ENDPOINT_RADIUS) {
          return h;
        }
      } else {
        if (x >= h.x && x <= h.x + HANDLE_SIZE && y >= h.y && y <= h.y + HANDLE_SIZE) {
          return h;
        }
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
    if (s.type === 'freedraw') {
      const fs = s as FreehandShape;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < fs.points.length; i += 2) {
        minX = Math.min(minX, fs.points[i]);
        minY = Math.min(minY, fs.points[i + 1]);
        maxX = Math.max(maxX, fs.points[i]);
        maxY = Math.max(maxY, fs.points[i + 1]);
      }
      return { x1: minX, y1: minY, x2: maxX, y2: maxY };
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

  // ─── Snap-to-shape detection ───

  function getShapeSnapPoints(s: Shape): { x: number; y: number }[] {
    if (s.type === 'line' || s.type === 'arrow' || s.type === 'freedraw') return [];
    if (s.type === 'circle') {
      // Cardinal points on the ellipse perimeter
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      const rx = s.width / 2;
      const ry = s.height / 2;
      return [
        { x: cx, y: cy - ry },  // top
        { x: cx + rx, y: cy },  // right
        { x: cx, y: cy + ry },  // bottom
        { x: cx - rx, y: cy },  // left
      ];
    }
    // Rectangle, text: 4 edge centers
    return [
      { x: s.x + s.width / 2, y: s.y },              // top
      { x: s.x + s.width, y: s.y + s.height / 2 },   // right
      { x: s.x + s.width / 2, y: s.y + s.height },   // bottom
      { x: s.x, y: s.y + s.height / 2 },              // left
    ];
  }

  function findSnapPoint(x: number, y: number, excludeIds?: Set<string>): { x: number; y: number; shapeId: string } | null {
    let best: { x: number; y: number; shapeId: string } | null = null;
    let bestDist = SNAP_DISTANCE;

    for (const s of shapes.value.values()) {
      if (excludeIds && excludeIds.has(s.id)) continue;
      const pts = getShapeSnapPoints(s);
      for (const pt of pts) {
        const d = Math.hypot(x - pt.x, y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          best = { x: pt.x, y: pt.y, shapeId: s.id };
        }
      }
    }
    return best;
  }

  // ─── Connector helpers ───

  const ANCHOR_ORDER: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];

  function getAnchorPoint(shape: Shape, anchor: AnchorPosition): { x: number; y: number } {
    const pts = getShapeSnapPoints(shape);
    const idx = ANCHOR_ORDER.indexOf(anchor);
    if (pts.length > idx && idx >= 0) return pts[idx];
    return { x: shape.x, y: shape.y };
  }

  function getAnchorForSnapPoint(shapeId: string, snapX: number, snapY: number): AnchorPosition | null {
    const shape = shapes.value.get(shapeId);
    if (!shape) return null;
    const pts = getShapeSnapPoints(shape);
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].x - snapX) < 1 && Math.abs(pts[i].y - snapY) < 1) {
        return ANCHOR_ORDER[i];
      }
    }
    return null;
  }

  function buildConnection(snap: { x: number; y: number; shapeId: string } | null): ShapeConnection | null {
    if (!snap) return null;
    const anchor = getAnchorForSnapPoint(snap.shapeId, snap.x, snap.y);
    if (!anchor) return null;
    return { shapeId: snap.shapeId, anchor };
  }

  function updateConnectedArrows(movedShapeIds: Set<string>) {
    for (const [id, shape] of shapes.value) {
      if (shape.type !== 'line' && shape.type !== 'arrow') continue;
      if (movedShapeIds.has(id)) continue; // arrow is already being moved
      const ls = shape as LineShape | ArrowShape;
      const updates: Record<string, any> = {};

      if (ls.connectedStart && movedShapeIds.has(ls.connectedStart.shapeId)) {
        const target = shapes.value.get(ls.connectedStart.shapeId);
        if (target) {
          const pt = getAnchorPoint(target, ls.connectedStart.anchor);
          updates.x = pt.x;
          updates.y = pt.y;
        }
      }
      if (ls.connectedEnd && movedShapeIds.has(ls.connectedEnd.shapeId)) {
        const target = shapes.value.get(ls.connectedEnd.shapeId);
        if (target) {
          const pt = getAnchorPoint(target, ls.connectedEnd.anchor);
          updates.x2 = pt.x;
          updates.y2 = pt.y;
        }
      }
      if (Object.keys(updates).length > 0) {
        if (updates.x !== undefined || updates.x2 !== undefined) {
          const finalX = updates.x ?? ls.x;
          const finalX2 = updates.x2 ?? ls.x2;
          const finalY = updates.y ?? ls.y;
          const finalY2 = updates.y2 ?? ls.y2;
          updates.width = Math.abs(finalX2 - finalX);
          updates.height = Math.abs(finalY2 - finalY);
        }
        callbacks.updateShape(id, updates);
      }
    }
  }

  function cleanupConnectionsForDeletedShapes(deletedIds: Set<string>) {
    for (const [id, shape] of shapes.value) {
      if (shape.type !== 'line' && shape.type !== 'arrow') continue;
      if (deletedIds.has(id)) continue;
      const ls = shape as LineShape | ArrowShape;
      const updates: Record<string, any> = {};
      if (ls.connectedStart && deletedIds.has(ls.connectedStart.shapeId)) {
        updates.connectedStart = null;
      }
      if (ls.connectedEnd && deletedIds.has(ls.connectedEnd.shapeId)) {
        updates.connectedEnd = null;
      }
      if (Object.keys(updates).length > 0) {
        callbacks.updateShape(id, updates);
      }
    }
  }

  // ─── Mouse handlers ───

  function handleMouseDown(e: MouseEvent, svgEl: SVGSVGElement) {
    const point = getSvgPoint(e, svgEl);

    if (activeTool.value === 'select') {
      // Check resize handles first (only when single selection)
      const handle = findHandleAt(point.x, point.y);
      if (handle && selectedShape.value) {
        const s = selectedShape.value;
        if (handle.id === 'start' || handle.id === 'end') {
          const ls = s as LineShape | ArrowShape;
          resize.value = {
            isResizing: true,
            shapeId: s.id,
            handle: handle.id,
            startX: point.x,
            startY: point.y,
            origX: ls.x,
            origY: ls.y,
            origW: ls.x2 as any,  // store x2 in origW for endpoint drag
            origH: ls.y2 as any,  // store y2 in origH for endpoint drag
          };
        } else if (handle.id === 'mid') {
          const ls = s as LineShape | ArrowShape;
          resize.value = {
            isResizing: true,
            shapeId: s.id,
            handle: 'mid',
            startX: point.x,
            startY: point.y,
            origX: ls.curveOffsetX || 0,  // store original offset
            origY: ls.curveOffsetY || 0,
            origW: 0,
            origH: 0,
          };
        } else {
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
        }
        return;
      }

      const hit = findShapeAt(point.x, point.y);
      if (hit) {
        // Alt+click: duplicate the clicked shape(s)
        if (e.altKey) {
          if (!selectedShapeIds.value.has(hit.id)) {
            selectedShapeIds.value = new Set([hit.id]);
          }
          duplicateSelected();
          // Start dragging the new duplicates
          const firstNewId = selectedShapeIds.value.values().next().value;
          const firstNew = firstNewId ? shapes.value.get(firstNewId) : null;
          if (firstNew) {
            drag.value = {
              isDragging: true,
              shapeId: firstNewId!,
              startX: point.x,
              startY: point.y,
              offsetX: point.x - firstNew.x,
              offsetY: point.y - firstNew.y,
            };
          }
          return;
        }

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
    } else if (activeTool.value === 'freedraw') {
      draw.value = { isDrawing: true, startX: point.x, startY: point.y };
      freehandPoints.value = [point.x, point.y];
    } else if (activeTool.value === 'laser') {
      laserIsDrawing.value = true;
      laserCurrentPoints.value = [point.x, point.y];
      startLaserAnimation();
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
      const shapeId = r.shapeId!;
      const dx = point.x - r.startX;
      const dy = point.y - r.startY;

      // Midpoint drag for curve control
      if (r.handle === 'mid') {
        const newOffsetX = r.origX + dx;
        const newOffsetY = r.origY + dy;
        // If offset is near zero, snap to straight
        const dist = Math.hypot(newOffsetX, newOffsetY);
        if (dist < 5) {
          callbacks.updateShape(shapeId, {
            curved: false,
            curveOffsetX: 0,
            curveOffsetY: 0,
          } as any);
        } else {
          callbacks.updateShape(shapeId, {
            curved: true,
            curveOffsetX: newOffsetX,
            curveOffsetY: newOffsetY,
          } as any);
        }
        return;
      }

      // Endpoint drag for lines/arrows (with snap-to-shape + connection tracking)
      if (r.handle === 'start') {
        let newX = r.origX + dx;
        let newY = r.origY + dy;
        const snap = findSnapPoint(newX, newY, new Set([shapeId]));
        if (snap) { newX = snap.x; newY = snap.y; }
        snapTarget.value = snap;
        callbacks.updateShape(shapeId, {
          x: newX,
          y: newY,
          width: Math.abs(r.origW - newX),
          height: Math.abs(r.origH - newY),
          connectedStart: buildConnection(snap),
        } as any);
        return;
      }
      if (r.handle === 'end') {
        let newX2 = r.origW + dx;
        let newY2 = r.origH + dy;
        const snap = findSnapPoint(newX2, newY2, new Set([shapeId]));
        if (snap) { newX2 = snap.x; newY2 = snap.y; }
        snapTarget.value = snap;
        callbacks.updateShape(shapeId, {
          x2: newX2,
          y2: newY2,
          width: Math.abs(newX2 - r.origX),
          height: Math.abs(newY2 - r.origY),
          connectedEnd: buildConnection(snap),
        } as any);
        return;
      }

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

      callbacks.updateShape(shapeId, { x: newX, y: newY, width: newW, height: newH });
      updateConnectedArrows(new Set([shapeId]));
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
        } else if (shape.type === 'freedraw') {
          const fs = shape as FreehandShape;
          const newPoints = [...fs.points];
          for (let i = 0; i < newPoints.length; i += 2) {
            newPoints[i] += dx;
            newPoints[i + 1] += dy;
          }
          callbacks.updateShape(id, { x: fs.x + dx, y: fs.y + dy, points: newPoints } as any);
        } else {
          callbacks.updateShape(id, { x: shape.x + dx, y: shape.y + dy });
        }
      }
      drag.value.startX = point.x;
      drag.value.startY = point.y;

      // Update arrows connected to moved shapes
      updateConnectedArrows(selectedShapeIds.value);
    }

    // Laser drawing (local only)
    if (laserIsDrawing.value) {
      laserCurrentPoints.value.push(point.x, point.y);
      return;
    }

    // Draw preview
    if (draw.value.isDrawing) {
      const tool = activeTool.value;

      if (tool === 'freedraw') {
        freehandPoints.value.push(point.x, point.y);
        // Update preview with current points
        const pts = freehandPoints.value;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < pts.length; i += 2) {
          minX = Math.min(minX, pts[i]);
          minY = Math.min(minY, pts[i + 1]);
          maxX = Math.max(maxX, pts[i]);
          maxY = Math.max(maxY, pts[i + 1]);
        }
        previewShape.value = {
          id: 'preview',
          type: 'freedraw',
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          points: [...pts],
          fill: 'transparent',
          stroke: getColor(),
          strokeWidth: 2,
          createdBy: userId,
          createdByName: userName,
          createdAt: 0,
        } as FreehandShape;
      } else if (tool === 'line' || tool === 'arrow') {
        // Snap endpoints to nearby shapes
        let sx = draw.value.startX, sy = draw.value.startY;
        let ex = point.x, ey = point.y;
        const startSnap = findSnapPoint(sx, sy);
        const endSnap = findSnapPoint(ex, ey);
        if (startSnap) { sx = startSnap.x; sy = startSnap.y; }
        if (endSnap) { ex = endSnap.x; ey = endSnap.y; }
        snapTarget.value = endSnap || startSnap;

        previewShape.value = {
          id: 'preview',
          type: tool,
          x: sx,
          y: sy,
          x2: ex,
          y2: ey,
          width: Math.abs(ex - sx),
          height: Math.abs(ey - sy),
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
    // Laser stroke end
    if (laserIsDrawing.value) {
      laserIsDrawing.value = false;
      if (laserCurrentPoints.value.length >= 4) {
        laserStrokes.value = [...laserStrokes.value, {
          points: [...laserCurrentPoints.value],
          createdAt: Date.now(),
          opacity: 1,
        }];
      }
      laserCurrentPoints.value = [];
      return;
    }

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
      snapTarget.value = null;
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

      let createdId: string | null = null;

      if (tool === 'freedraw') {
        freehandPoints.value.push(point.x, point.y);
        const pts = freehandPoints.value;
        if (pts.length >= 4) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (let i = 0; i < pts.length; i += 2) {
            minX = Math.min(minX, pts[i]);
            minY = Math.min(minY, pts[i + 1]);
            maxX = Math.max(maxX, pts[i]);
            maxY = Math.max(maxY, pts[i + 1]);
          }
          const id = generateId();
          const shape: FreehandShape = {
            id,
            type: 'freedraw',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            points: [...pts],
            fill: 'transparent',
            stroke: getColor(),
            strokeWidth: 2,
            createdBy: userId,
            createdByName: userName,
            createdAt: Date.now(),
          };
          callbacks.addShape(shape);
          createdId = id;
        }
        freehandPoints.value = [];
      } else if (tool === 'line' || tool === 'arrow') {
        // Apply snap-to-shape for final coordinates + save connections
        let sx = draw.value.startX, sy = draw.value.startY;
        let ex = point.x, ey = point.y;
        const startSnap = findSnapPoint(sx, sy);
        const endSnap = findSnapPoint(ex, ey);
        if (startSnap) { sx = startSnap.x; sy = startSnap.y; }
        if (endSnap) { ex = endSnap.x; ey = endSnap.y; }

        const dist = Math.hypot(ex - sx, ey - sy);
        if (dist > 5) {
          const id = generateId();
          const shape = {
            id,
            type: tool,
            x: sx,
            y: sy,
            x2: ex,
            y2: ey,
            width: Math.abs(ex - sx),
            height: Math.abs(ey - sy),
            fill: 'transparent',
            stroke: getColor(),
            strokeWidth: 2,
            curved: false,
            dashed: false,
            connectedStart: buildConnection(startSnap),
            connectedEnd: buildConnection(endSnap),
            createdBy: userId,
            createdByName: userName,
            createdAt: Date.now(),
          } as LineShape | ArrowShape;
          callbacks.addShape(shape);
          createdId = id;
        }
      } else {
        const width = Math.abs(point.x - draw.value.startX);
        const height = Math.abs(point.y - draw.value.startY);

        if (width > 5 && height > 5) {
          const id = generateId();
          const shape: Shape = {
            id,
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
          createdId = id;
        }
      }

      // Auto-select the created shape and switch to select tool (Excalidraw style)
      if (createdId) {
        selectedShapeIds.value = new Set([createdId]);
        activeTool.value = 'select';
      }
      previewShape.value = null;
      snapTarget.value = null;
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
        const shape = { ...pendingTextShape.value, text };
        callbacks.addShape(shape);
        // Auto-select created text and switch to select tool
        selectedShapeIds.value = new Set([shape.id]);
        activeTool.value = 'select';
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

  // ─── Copy / Paste / Duplicate ───

  const clipboard = ref<Shape[]>([]);
  const DUPLICATE_OFFSET = 20;

  function duplicateShapes(shapesToDupe: Shape[], offset = DUPLICATE_OFFSET): string[] {
    const idMap = new Map<string, string>();
    const newIds: string[] = [];

    for (const s of shapesToDupe) {
      const newId = generateId();
      idMap.set(s.id, newId);
      const clone: any = {
        ...s,
        id: newId,
        x: s.x + offset,
        y: s.y + offset,
        createdBy: userId,
        createdByName: userName,
        createdAt: Date.now(),
      };
      if (s.type === 'line' || s.type === 'arrow') {
        const ls = s as LineShape | ArrowShape;
        clone.x2 = ls.x2 + offset;
        clone.y2 = ls.y2 + offset;
        // Clear connections (cloned shapes aren't connected)
        clone.connectedStart = null;
        clone.connectedEnd = null;
      }
      if (s.type === 'freedraw') {
        const fs = s as FreehandShape;
        const newPoints = [...fs.points];
        for (let i = 0; i < newPoints.length; i += 2) {
          newPoints[i] += offset;
          newPoints[i + 1] += offset;
        }
        clone.points = newPoints;
      }
      callbacks.addShape(clone);
      newIds.push(newId);
    }
    return newIds;
  }

  function duplicateSelected() {
    if (selectedShapeIds.value.size === 0) return;
    const shapesToDupe: Shape[] = [];
    for (const id of selectedShapeIds.value) {
      const s = shapes.value.get(id);
      if (s) shapesToDupe.push(s);
    }
    const newIds = duplicateShapes(shapesToDupe);
    selectedShapeIds.value = new Set(newIds);
  }

  function copySelected() {
    clipboard.value = [];
    for (const id of selectedShapeIds.value) {
      const s = shapes.value.get(id);
      if (s) clipboard.value.push({ ...s });
    }
  }

  function pasteClipboard() {
    if (clipboard.value.length === 0) return;
    const newIds = duplicateShapes(clipboard.value);
    selectedShapeIds.value = new Set(newIds);
    // Shift clipboard so next paste offsets again
    clipboard.value = clipboard.value.map((s) => ({
      ...s,
      x: s.x + DUPLICATE_OFFSET,
      y: s.y + DUPLICATE_OFFSET,
      ...(s.type === 'line' || s.type === 'arrow' ? {
        x2: (s as any).x2 + DUPLICATE_OFFSET,
        y2: (s as any).y2 + DUPLICATE_OFFSET,
      } : {}),
      ...(s.type === 'freedraw' ? {
        points: (s as FreehandShape).points.map((v, i) => v + DUPLICATE_OFFSET),
      } : {}),
    }));
  }

  function deleteSelected() {
    const deletedIds = new Set(selectedShapeIds.value);
    cleanupConnectionsForDeletedShapes(deletedIds);
    for (const id of deletedIds) {
      callbacks.deleteShape(id);
    }
    selectedShapeIds.value = new Set();
  }

  function duplicateWithArrow(direction: 'up' | 'down' | 'left' | 'right') {
    const shape = selectedShape.value;
    if (!shape || shape.type === 'line' || shape.type === 'arrow' || shape.type === 'freedraw') return;

    // Calculate new shape position
    let newX = shape.x;
    let newY = shape.y;
    if (direction === 'right') newX = shape.x + shape.width + DUPLICATE_GAP;
    else if (direction === 'left') newX = shape.x - shape.width - DUPLICATE_GAP;
    else if (direction === 'down') newY = shape.y + shape.height + DUPLICATE_GAP;
    else if (direction === 'up') newY = shape.y - shape.height - DUPLICATE_GAP;

    // Calculate arrow start/end points (edge centers) and anchors
    let ax1 = 0, ay1 = 0, ax2 = 0, ay2 = 0;
    let startAnchor: AnchorPosition = 'right', endAnchor: AnchorPosition = 'left';
    if (direction === 'right') {
      ax1 = shape.x + shape.width; ay1 = shape.y + shape.height / 2;
      ax2 = newX; ay2 = newY + shape.height / 2;
      startAnchor = 'right'; endAnchor = 'left';
    } else if (direction === 'left') {
      ax1 = shape.x; ay1 = shape.y + shape.height / 2;
      ax2 = newX + shape.width; ay2 = newY + shape.height / 2;
      startAnchor = 'left'; endAnchor = 'right';
    } else if (direction === 'down') {
      ax1 = shape.x + shape.width / 2; ay1 = shape.y + shape.height;
      ax2 = newX + shape.width / 2; ay2 = newY;
      startAnchor = 'bottom'; endAnchor = 'top';
    } else if (direction === 'up') {
      ax1 = shape.x + shape.width / 2; ay1 = shape.y;
      ax2 = newX + shape.width / 2; ay2 = newY + shape.height;
      startAnchor = 'top'; endAnchor = 'bottom';
    }

    // Clone shape first (need its ID for connection)
    const newShape: Shape = {
      ...shape,
      id: generateId(),
      x: newX,
      y: newY,
      text: '',
      createdAt: Date.now(),
    };

    // Create arrow with connections
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
      connectedStart: { shapeId: shape.id, anchor: startAnchor },
      connectedEnd: { shapeId: newShape.id, anchor: endAnchor },
      createdBy: userId,
      createdByName: userName,
      createdAt: Date.now(),
    };

    callbacks.addShape(arrowShape);
    callbacks.addShape(newShape);

    // Select new shape and enter text editing mode
    selectedShapeIds.value = new Set([newShape.id]);
    editingShapeId.value = newShape.id;
    editingText.value = '';
  }

  // Tool shortcuts: number keys like Excalidraw + V for select, P for pen, etc.
  const toolShortcuts: Record<string, Tool> = {
    '1': 'select',
    '2': 'hand',
    '3': 'rectangle',
    '4': 'circle',
    '5': 'line',
    '6': 'arrow',
    '7': 'freedraw',
    '8': 'text',
    '9': 'laser',
    'v': 'select',
    'h': 'hand',
    'r': 'rectangle',
    'o': 'circle',
    'l': 'line',
    'a': 'arrow',
    'p': 'freedraw',
    't': 'text',
  };

  function handleKeyDown(e: KeyboardEvent) {
    if (editingShapeId.value) return;

    // Tool shortcuts (only without modifiers, except for 'a' which conflicts with Ctrl+A)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const tool = toolShortcuts[e.key];
      if (tool) {
        // 'a' without modifier should switch to arrow tool
        activeTool.value = tool;
        e.preventDefault();
        return;
      }
      // Escape to select tool + deselect
      if (e.key === 'Escape') {
        activeTool.value = 'select';
        selectedShapeIds.value = new Set();
        e.preventDefault();
        return;
      }
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIds.value.size > 0) {
      deleteSelected();
      e.preventDefault();
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      callbacks.undo();
      e.preventDefault();
    }

    if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedShapeIds.value.size > 0) {
      copySelected();
      e.preventDefault();
    }

    if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboard.value.length > 0) {
      pasteClipboard();
      e.preventDefault();
      return; // prevent 'v' from switching to select tool
    }

    if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedShapeIds.value.size > 0) {
      duplicateSelected();
      e.preventDefault();
    }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      selectedShapeIds.value = new Set(shapes.value.keys());
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
    laserStrokes,
    laserCurrentPoints,
    laserIsDrawing,
    snapTarget,
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
