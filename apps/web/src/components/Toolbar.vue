<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Tool } from '@/types';

const { t } = useI18n();

const props = defineProps<{
  activeTool: Tool;
}>();

const emit = defineEmits<{
  (e: 'select-tool', tool: Tool): void;
  (e: 'export-png'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'reset-view'): void;
}>();

const tools = computed(() => [
  { id: 'select' as Tool, label: t('toolbar.select'), icon: '↖' },
  { id: 'rectangle' as Tool, label: t('toolbar.rectangle'), icon: '▭' },
  { id: 'circle' as Tool, label: t('toolbar.circle'), icon: '○' },
  { id: 'line' as Tool, label: t('toolbar.line'), icon: '╱' },
  { id: 'arrow' as Tool, label: t('toolbar.arrow'), icon: '→' },
  { id: 'text' as Tool, label: t('toolbar.text'), icon: 'T' },
]);
</script>

<template>
  <div class="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1 bg-gray-800 rounded-lg p-1 shadow-lg z-10">
    <button
      v-for="tool in tools"
      :key="tool.id"
      :class="[
        'px-3 py-2 rounded-md text-sm font-medium transition-colors',
        props.activeTool === tool.id
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700',
      ]"
      :title="tool.label"
      @click="emit('select-tool', tool.id)"
    >
      {{ tool.icon }} {{ tool.label }}
    </button>

    <!-- Separator -->
    <div class="w-px bg-gray-600 mx-1" />

    <!-- Export buttons -->
    <button
      class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
      :title="t('toolbar.exportPng')"
      @click="emit('export-png')"
    >
      {{ t('toolbar.png') }}
    </button>

    <!-- Separator -->
    <div class="w-px bg-gray-600 mx-1" />

    <!-- Zoom controls -->
    <button
      class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
      :title="t('toolbar.zoomIn')"
      @click="emit('zoom-in')"
    >
      +
    </button>
    <button
      class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
      :title="t('toolbar.zoomOut')"
      @click="emit('zoom-out')"
    >
      −
    </button>
    <button
      class="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
      :title="t('toolbar.resetView')"
      @click="emit('reset-view')"
    >
      ⟲
    </button>
  </div>
</template>
