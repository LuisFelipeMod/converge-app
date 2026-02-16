<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Shape } from '@realtime-collab/shared';
import type { Tool } from '@/types';
import { useYjs } from '@/composables/useYjs';
import { useCanvas } from '@/composables/useCanvas';
import { useAwareness } from '@/composables/useAwareness';
import { useCollaborationStore } from '@/stores/collaboration';
import CursorOverlay from './CursorOverlay.vue';
import Toolbar from './Toolbar.vue';
import PresenceBar from './PresenceBar.vue';

const props = defineProps<{
  documentId: string;
}>();

const store = useCollaborationStore();
const svgRef = ref<SVGSVGElement | null>(null);

const {
  shapes,
  peers,
  connected,
  addShape,
  updateShape,
  broadcastPresence,
} = useYjs(props.documentId, {
  userId: store.userId,
  name: store.userName,
  token: store.token,
});

watch(connected, (val) => store.setConnected(val));

const { updateCursor, clearCursor, onlineUsers, cursors } = useAwareness(
  peers,
  broadcastPresence,
  store.userColor,
);

const {
  activeTool,
  selectedShapeId,
  previewShape,
  sortedShapes,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} = useCanvas(shapes, store.userId, {
  addShape,
  updateShape,
  onCursorMove: updateCursor,
});

function onSelectTool(tool: Tool) {
  activeTool.value = tool;
  store.setTool(tool);
}

function onMouseDown(e: MouseEvent) {
  if (svgRef.value) handleMouseDown(e, svgRef.value);
}

function onMouseMove(e: MouseEvent) {
  if (svgRef.value) handleMouseMove(e, svgRef.value);
}

function onMouseUp(e: MouseEvent) {
  if (svgRef.value) handleMouseUp(e, svgRef.value);
}

function renderShape(shape: Shape) {
  return shape;
}
</script>

<template>
  <div class="relative w-screen h-screen bg-gray-900" @mouseleave="clearCursor">
    <Toolbar :active-tool="activeTool" @select-tool="onSelectTool" />

    <PresenceBar
      :users="onlineUsers"
      :current-user-name="store.userName"
      :current-user-color="store.userColor"
      :is-connected="connected"
    />

    <svg
      ref="svgRef"
      class="w-full h-full"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    >
      <!-- Grid pattern -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <!-- Shapes -->
      <template v-for="shape in sortedShapes" :key="shape.id">
        <rect
          v-if="shape.type === 'rectangle'"
          :x="shape.x"
          :y="shape.y"
          :width="shape.width"
          :height="shape.height"
          :fill="shape.fill"
          :stroke="selectedShapeId === shape.id ? '#fff' : shape.stroke"
          :stroke-width="selectedShapeId === shape.id ? 3 : shape.strokeWidth"
          :rx="(shape as any).rx || 0"
          class="cursor-move"
        />
        <ellipse
          v-else-if="shape.type === 'circle'"
          :cx="shape.x + shape.width / 2"
          :cy="shape.y + shape.height / 2"
          :rx="shape.width / 2"
          :ry="shape.height / 2"
          :fill="shape.fill"
          :stroke="selectedShapeId === shape.id ? '#fff' : shape.stroke"
          :stroke-width="selectedShapeId === shape.id ? 3 : shape.strokeWidth"
          class="cursor-move"
        />
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
      </template>

      <!-- Remote cursors -->
      <CursorOverlay :cursors="cursors" />
    </svg>
  </div>
</template>
