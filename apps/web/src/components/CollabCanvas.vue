<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import type { Shape, LineShape, ArrowShape } from '@realtime-collab/shared';
import type { Tool } from '@/types';
import { useYjs } from '@/composables/useYjs';
import { useCanvas } from '@/composables/useCanvas';
import { useAwareness } from '@/composables/useAwareness';
import { useExport } from '@/composables/useExport';
import { useViewport } from '@/composables/useViewport';
import { useI18n } from 'vue-i18n';
import { useCollaborationStore } from '@/stores/collaboration';
import CursorOverlay from './CursorOverlay.vue';
import Toolbar from './Toolbar.vue';
import PresenceBar from './PresenceBar.vue';
import ShapeToolbox from './ShapeToolbox.vue';

const props = defineProps<{
  documentId: string;
}>();

const store = useCollaborationStore();
const { t } = useI18n();
const svgRef = ref<SVGSVGElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const textInputRef = ref<HTMLTextAreaElement | null>(null);

const {
  shapes,
  peers,
  connected,
  addShape,
  updateShape,
  deleteShape,
  undo,
  broadcastPresence,
} = useYjs(props.documentId, {
  userId: store.userId,
  name: store.userName,
  avatar: store.userAvatar || undefined,
  token: store.token,
});

watch(connected, (val) => store.setConnected(val));

const { updateCursor, clearCursor, onlineUsers, cursors } = useAwareness(
  peers,
  broadcastPresence,
  store.userColor,
  store.userAvatar || undefined,
);

const { exportPng } = useExport(svgRef);

const {
  viewBox,
  isPanning,
  handleWheel: vpHandleWheel,
  startPan,
  onPan,
  endPan,
  onKeyDown: vpKeyDown,
  onKeyUp: vpKeyUp,
  isSpaceDown,
  zoomIn,
  zoomOut,
  resetView,
  updateSize,
  scale,
} = useViewport();

// Track SVG size
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        updateSize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    resizeObserver.observe(containerRef.value);
    updateSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  }
  window.addEventListener('keydown', vpKeyDown);
  window.addEventListener('keyup', vpKeyUp);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', vpKeyDown);
  window.removeEventListener('keyup', vpKeyUp);
});

const {
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
} = useCanvas(shapes, store.userId, store.userName, {
  addShape,
  updateShape,
  deleteShape,
  undo,
  onCursorMove: updateCursor,
});

const isMultiSelect = computed(() => selectedShapeIds.value.size > 1);

// For the toolbox: when multi-select, use the first selected shape for positioning
const toolboxShape = computed<Shape | null>(() => {
  if (selectedShapeIds.value.size === 0) return null;
  if (selectedShapeIds.value.size === 1) return selectedShape.value;
  // Multi-select: use the first shape for positioning
  const firstId = selectedShapeIds.value.values().next().value;
  return firstId ? shapes.value.get(firstId) || null : null;
});

function isSelected(id: string): boolean {
  return selectedShapeIds.value.has(id);
}

function onSelectTool(tool: Tool) {
  activeTool.value = tool;
  store.setTool(tool);
}

function onWheel(e: WheelEvent) {
  if (svgRef.value) vpHandleWheel(e, svgRef.value);
}

function onMouseDown(e: MouseEvent) {
  if (startPan(e)) return;
  if (isSpaceDown()) return; // Space held but not left click — ignore
  if (svgRef.value) handleMouseDown(e, svgRef.value);
}
function onMouseMove(e: MouseEvent) {
  if (onPan(e)) return;
  if (svgRef.value) handleMouseMove(e, svgRef.value);
}
function onMouseUp(e: MouseEvent) {
  if (endPan()) return;
  if (svgRef.value) handleMouseUp(e, svgRef.value);
}
function onDblClick(e: MouseEvent) {
  if (svgRef.value) handleDblClick(e, svgRef.value);
}

const svgCursor = computed(() => {
  if (isPanning.value) return 'grabbing';
  if (isSpaceDown()) return 'grab';
  return 'default';
});

function onTextKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    commitTextEdit();
  } else if (e.key === 'Escape') {
    cancelTextEdit();
  }
}

function getEditingShape(): Shape | null {
  if (!editingShapeId.value) return null;
  if (pendingTextShape.value && editingShapeId.value === pendingTextShape.value.id) {
    return pendingTextShape.value;
  }
  return shapes.value.get(editingShapeId.value) || null;
}

watch(editingShapeId, async (id) => {
  if (id) {
    await nextTick();
    textInputRef.value?.focus();
  }
});

// ─── Line/Arrow SVG helpers ───

function getLinePath(s: LineShape | ArrowShape): string {
  if (s.curved) {
    const mx = (s.x + s.x2) / 2;
    const my = (s.y + s.y2) / 2;
    const dx = s.x2 - s.x;
    const dy = s.y2 - s.y;
    // Control point perpendicular offset (30% of length)
    const offset = Math.hypot(dx, dy) * 0.3;
    const cx = mx - (dy / Math.hypot(dx, dy)) * offset;
    const cy = my + (dx / Math.hypot(dx, dy)) * offset;
    return `M ${s.x},${s.y} Q ${cx},${cy} ${s.x2},${s.y2}`;
  }
  return `M ${s.x},${s.y} L ${s.x2},${s.y2}`;
}

function onToggleCurved() {
  if (!selectedShapeId.value || !selectedShape.value) return;
  const s = selectedShape.value as LineShape | ArrowShape;
  updateShape(selectedShapeId.value, { curved: !s.curved } as any);
}

function onToggleDashed() {
  if (!selectedShapeId.value || !selectedShape.value) return;
  const s = selectedShape.value as LineShape | ArrowShape;
  updateShape(selectedShapeId.value, { dashed: !s.dashed } as any);
}

function onToggleBold() {
  for (const id of selectedShapeIds.value) {
    const s = shapes.value.get(id);
    if (s) updateShape(id, { bold: !s.bold } as any);
  }
}

function onToggleItalic() {
  for (const id of selectedShapeIds.value) {
    const s = shapes.value.get(id);
    if (s) updateShape(id, { italic: !s.italic } as any);
  }
}

// Rubber band rect coordinates
const selBoxRect = computed(() => {
  const sb = selectionBox.value;
  if (!sb.isSelecting) return null;
  return {
    x: Math.min(sb.startX, sb.currentX),
    y: Math.min(sb.startY, sb.currentY),
    width: Math.abs(sb.currentX - sb.startX),
    height: Math.abs(sb.currentY - sb.startY),
  };
});
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-screen h-screen bg-gray-900 outline-none"
    tabindex="0"
    @keydown="handleKeyDown"
    @mouseleave="clearCursor"
  >
    <Toolbar
      :active-tool="activeTool"
      @select-tool="onSelectTool"
      @export-png="exportPng"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset-view="resetView"
    />

    <PresenceBar
      :users="onlineUsers"
      :current-user-name="store.userName"
      :current-user-color="store.userColor"
      :current-user-avatar="store.userAvatar || undefined"
      :is-connected="connected"
    />

    <svg
      ref="svgRef"
      class="w-full h-full"
      :viewBox="viewBox"
      :style="{ cursor: svgCursor }"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @dblclick="onDblClick"
      @wheel.prevent="onWheel"
    >
      <!-- Defs: grid + arrow marker -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"
          :patternTransform="`translate(0,0)`"
        >
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" :stroke-width="0.5 / scale" />
        </pattern>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
        <marker
          id="arrowhead-white"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#fff" />
        </marker>
        <marker
          id="arrowhead-preview"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>
      <rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="#111827" />
      <rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="url(#grid)" />

      <!-- Shapes -->
      <template v-for="shape in sortedShapes" :key="shape.id">
        <!-- Rectangle -->
        <template v-if="shape.type === 'rectangle'">
          <rect
            :x="shape.x"
            :y="shape.y"
            :width="shape.width"
            :height="shape.height"
            :fill="shape.fill"
            :stroke="isSelected(shape.id) ? '#fff' : shape.stroke"
            :stroke-width="isSelected(shape.id) ? 3 : shape.strokeWidth"
            :rx="(shape as any).rx || 0"
            class="cursor-move"
          />
          <text
            v-if="shape.text && editingShapeId !== shape.id"
            :x="shape.x + shape.width / 2"
            :y="shape.y + shape.height / 2"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#fff"
            font-size="14"
            :font-weight="shape.bold ? 'bold' : 'normal'"
            :font-style="shape.italic ? 'italic' : 'normal'"
            class="pointer-events-none select-none"
          >{{ shape.text }}</text>
          <text
            v-if="shape.createdByName"
            :x="shape.x"
            :y="shape.y - 6"
            fill="#9CA3AF"
            font-size="10"
            class="pointer-events-none select-none"
            data-export-ignore
          >{{ shape.createdByName }}</text>
        </template>

        <!-- Circle / Ellipse -->
        <template v-else-if="shape.type === 'circle'">
          <ellipse
            :cx="shape.x + shape.width / 2"
            :cy="shape.y + shape.height / 2"
            :rx="shape.width / 2"
            :ry="shape.height / 2"
            :fill="shape.fill"
            :stroke="isSelected(shape.id) ? '#fff' : shape.stroke"
            :stroke-width="isSelected(shape.id) ? 3 : shape.strokeWidth"
            class="cursor-move"
          />
          <text
            v-if="shape.text && editingShapeId !== shape.id"
            :x="shape.x + shape.width / 2"
            :y="shape.y + shape.height / 2"
            text-anchor="middle"
            dominant-baseline="central"
            fill="#fff"
            font-size="14"
            :font-weight="shape.bold ? 'bold' : 'normal'"
            :font-style="shape.italic ? 'italic' : 'normal'"
            class="pointer-events-none select-none"
          >{{ shape.text }}</text>
          <text
            v-if="shape.createdByName"
            :x="shape.x"
            :y="shape.y - 6"
            fill="#9CA3AF"
            font-size="10"
            class="pointer-events-none select-none"
            data-export-ignore
          >{{ shape.createdByName }}</text>
        </template>

        <!-- Free Text -->
        <template v-else-if="shape.type === 'text'">
          <text
            v-if="editingShapeId !== shape.id"
            :x="shape.x"
            :y="shape.y + 20"
            fill="#fff"
            :font-size="(shape as any).fontSize || 16"
            :font-weight="shape.bold ? 'bold' : 'normal'"
            :font-style="shape.italic ? 'italic' : 'normal'"
            class="cursor-move select-none"
          >{{ shape.text }}</text>
          <text
            v-if="shape.createdByName"
            :x="shape.x"
            :y="shape.y - 6"
            fill="#9CA3AF"
            font-size="10"
            class="pointer-events-none select-none"
            data-export-ignore
          >{{ shape.createdByName }}</text>
        </template>

        <!-- Line -->
        <template v-else-if="shape.type === 'line'">
          <path
            :d="getLinePath(shape as LineShape)"
            fill="none"
            :stroke="isSelected(shape.id) ? '#fff' : shape.stroke"
            :stroke-width="isSelected(shape.id) ? 3 : shape.strokeWidth"
            :stroke-dasharray="(shape as LineShape).dashed ? '8 4' : 'none'"
            class="cursor-move"
          />
          <!-- Invisible fat hit area -->
          <path
            :d="getLinePath(shape as LineShape)"
            fill="none"
            stroke="transparent"
            stroke-width="12"
            class="cursor-move"
          />
          <text
            v-if="shape.createdByName"
            :x="shape.x"
            :y="shape.y - 6"
            fill="#9CA3AF"
            font-size="10"
            class="pointer-events-none select-none"
            data-export-ignore
          >{{ shape.createdByName }}</text>
        </template>

        <!-- Arrow -->
        <template v-else-if="shape.type === 'arrow'">
          <path
            :d="getLinePath(shape as ArrowShape)"
            fill="none"
            :stroke="isSelected(shape.id) ? '#fff' : shape.stroke"
            :stroke-width="isSelected(shape.id) ? 3 : shape.strokeWidth"
            :stroke-dasharray="(shape as ArrowShape).dashed ? '8 4' : 'none'"
            :marker-end="isSelected(shape.id) ? 'url(#arrowhead-white)' : 'url(#arrowhead)'"
            :style="{ color: shape.stroke }"
            class="cursor-move"
          />
          <!-- Invisible fat hit area -->
          <path
            :d="getLinePath(shape as ArrowShape)"
            fill="none"
            stroke="transparent"
            stroke-width="12"
            class="cursor-move"
          />
          <text
            v-if="shape.createdByName"
            :x="shape.x"
            :y="shape.y - 6"
            fill="#9CA3AF"
            font-size="10"
            class="pointer-events-none select-none"
            data-export-ignore
          >{{ shape.createdByName }}</text>
        </template>
      </template>

      <!-- Preview shape while drawing -->
      <template v-if="previewShape">
        <rect
          v-if="previewShape.type === 'rectangle'"
          :x="previewShape.x"
          :y="previewShape.y"
          :width="previewShape.width"
          :height="previewShape.height"
          :fill="previewShape.fill"
          :stroke="previewShape.stroke"
          :stroke-width="2"
          stroke-dasharray="4"
        />
        <ellipse
          v-else-if="previewShape.type === 'circle'"
          :cx="previewShape.x + previewShape.width / 2"
          :cy="previewShape.y + previewShape.height / 2"
          :rx="previewShape.width / 2"
          :ry="previewShape.height / 2"
          :fill="previewShape.fill"
          :stroke="previewShape.stroke"
          :stroke-width="2"
          stroke-dasharray="4"
        />
        <path
          v-else-if="previewShape.type === 'line'"
          :d="getLinePath(previewShape as LineShape)"
          fill="none"
          :stroke="previewShape.stroke"
          :stroke-width="2"
          stroke-dasharray="4"
        />
        <path
          v-else-if="previewShape.type === 'arrow'"
          :d="getLinePath(previewShape as ArrowShape)"
          fill="none"
          :stroke="previewShape.stroke"
          :stroke-width="2"
          stroke-dasharray="4"
          marker-end="url(#arrowhead-preview)"
          :style="{ color: previewShape.stroke }"
        />
      </template>

      <!-- Rubber band selection box -->
      <rect
        v-if="selBoxRect"
        :x="selBoxRect.x"
        :y="selBoxRect.y"
        :width="selBoxRect.width"
        :height="selBoxRect.height"
        fill="rgba(59, 130, 246, 0.15)"
        stroke="#3B82F6"
        stroke-width="1"
        stroke-dasharray="4 2"
        class="pointer-events-none"
      />

      <!-- Resize handles (only single select) -->
      <template v-if="selectedShapeId && resizeHandles.length > 0">
        <rect
          v-for="h in resizeHandles"
          :key="h.id"
          :x="h.x"
          :y="h.y"
          width="8"
          height="8"
          fill="#fff"
          stroke="#3B82F6"
          stroke-width="1.5"
          :style="{ cursor: h.cursor }"
        />
      </template>

      <!-- Toolbox above selected shape(s) -->
      <ShapeToolbox
        v-if="toolboxShape && !editingShapeId"
        :shape="toolboxShape"
        :multi-select="isMultiSelect"
        @delete="deleteSelected"
        @toggle-curved="onToggleCurved"
        @toggle-dashed="onToggleDashed"
        @toggle-bold="onToggleBold"
        @toggle-italic="onToggleItalic"
      />

      <!-- Text editing overlay -->
      <foreignObject
        v-if="editingShapeId && getEditingShape()"
        :x="getEditingShape()!.x"
        :y="getEditingShape()!.y"
        :width="getEditingShape()!.width"
        :height="getEditingShape()!.height"
      >
        <textarea
          ref="textInputRef"
          :value="editingText"
          @input="editingText = ($event.target as HTMLTextAreaElement).value"
          @keydown="onTextKeyDown"
          @blur="commitTextEdit"
          class="w-full h-full bg-transparent text-white text-sm resize-none outline-none"
          :class="getEditingShape()!.type === 'text' ? 'text-left' : 'text-center'"
          :style="{
            display: 'flex',
            alignItems: getEditingShape()!.type === 'text' ? 'flex-start' : 'center',
            justifyContent: getEditingShape()!.type === 'text' ? 'flex-start' : 'center',
            padding: getEditingShape()!.type === 'text' ? '0px' : '4px',
            fontSize: getEditingShape()!.type === 'text' ? ((getEditingShape() as any).fontSize || 16) + 'px' : '14px',
            fontWeight: getEditingShape()!.bold ? 'bold' : 'normal',
            fontStyle: getEditingShape()!.italic ? 'italic' : 'normal',
          }"
          :placeholder="t('canvas.typeHere')"
        />
      </foreignObject>

      <!-- Remote cursors -->
      <CursorOverlay :cursors="cursors" />
    </svg>
  </div>
</template>
