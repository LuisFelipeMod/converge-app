<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Shape, LineShape, ArrowShape } from '@realtime-collab/shared';

const { t } = useI18n();

const props = defineProps<{
  shape: Shape | null;
  multiSelect?: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete'): void;
  (e: 'toggle-curved'): void;
  (e: 'toggle-dashed'): void;
  (e: 'toggle-bold'): void;
  (e: 'toggle-italic'): void;
}>();

const isLineOrArrow = computed(() =>
  props.shape && (props.shape.type === 'line' || props.shape.type === 'arrow'),
);

function getToolboxX(): number {
  const s = props.shape;
  if (!s) return 0;
  if (s.type === 'line' || s.type === 'arrow') {
    const ls = s as LineShape | ArrowShape;
    return (ls.x + ls.x2) / 2;
  }
  return s.x + s.width / 2;
}

function getToolboxY(): number {
  const s = props.shape;
  if (!s) return 0;
  if (s.type === 'line' || s.type === 'arrow') {
    const ls = s as LineShape | ArrowShape;
    return Math.min(ls.y, ls.y2) - 44;
  }
  return s.y - 44;
}
</script>

<template>
  <foreignObject
    :x="getToolboxX() - 100"
    :y="getToolboxY()"
    width="200"
    height="36"
    class="overflow-visible"
  >
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      class="flex items-center gap-1 glass rounded-xl p-1 shadow-2xl animate-fade-in-up"
      style="width: fit-content; margin: 0 auto;"
      @mousedown.stop
    >
      <!-- Delete button (always shown) -->
      <button
        class="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-900/40 transition-colors"
        :title="t('shape.delete')"
        @click="emit('delete')"
      >
        🗑
      </button>

      <!-- Bold / Italic (shown when any shape selected) -->
      <template v-if="shape">
        <div class="w-px h-5 bg-gray-600" />

        <button
          :class="[
            'px-2 py-1 rounded text-xs font-bold transition-colors',
            shape.bold
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700',
          ]"
          :title="t('shape.bold')"
          @click="emit('toggle-bold')"
        >
          B
        </button>

        <button
          :class="[
            'px-2 py-1 rounded text-xs transition-colors',
            shape.italic
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700',
          ]"
          :title="t('shape.italic')"
          style="font-style: italic;"
          @click="emit('toggle-italic')"
        >
          I
        </button>
      </template>

      <!-- Line/Arrow specific options (only single select) -->
      <template v-if="isLineOrArrow && !multiSelect">
        <div class="w-px h-5 bg-gray-600" />

        <button
          :class="[
            'px-2 py-1 rounded text-xs transition-colors',
            (shape as LineShape).curved
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700',
          ]"
          :title="t('shape.curvedStraight')"
          @click="emit('toggle-curved')"
        >
          ⌒
        </button>

        <button
          :class="[
            'px-2 py-1 rounded text-xs transition-colors',
            (shape as LineShape).dashed
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-700',
          ]"
          :title="t('shape.dashedNormal')"
          @click="emit('toggle-dashed')"
        >
          ┅
        </button>
      </template>
    </div>
  </foreignObject>
</template>
