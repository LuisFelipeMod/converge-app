<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Tool } from '@/types';

const { t } = useI18n();

const props = defineProps<{
  activeTool: Tool;
  exportState?: 'idle' | 'loading' | 'success';
}>();

const emit = defineEmits<{
  (e: 'select-tool', tool: Tool): void;
  (e: 'export-png'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'reset-view'): void;
}>();

const tools = computed(() => [
  { id: 'select' as Tool, label: t('toolbar.select'), icon: '↖', shortcut: 'V' },
  { id: 'hand' as Tool, label: t('toolbar.hand'), icon: '✋', shortcut: 'H' },
  { id: 'rectangle' as Tool, label: t('toolbar.rectangle'), icon: '▭', shortcut: 'R' },
  { id: 'circle' as Tool, label: t('toolbar.circle'), icon: '○', shortcut: 'O' },
  { id: 'line' as Tool, label: t('toolbar.line'), icon: '╱', shortcut: 'L' },
  { id: 'arrow' as Tool, label: t('toolbar.arrow'), icon: '→', shortcut: 'A' },
  { id: 'freedraw' as Tool, label: t('toolbar.freedraw'), icon: '✏', shortcut: 'P' },
  { id: 'text' as Tool, label: t('toolbar.text'), icon: 'T', shortcut: 'T' },
  { id: 'laser' as Tool, label: t('toolbar.laser'), icon: '◉', shortcut: '9' },
]);

const currentExportState = computed(() => props.exportState ?? 'idle');
</script>

<template>
  <div class="absolute top-4 -translate-x-1/2 flex gap-1 glass rounded-xl p-1 shadow-2xl z-10 animate-slide-down" style="right: 1rem;">
    <button
      v-for="tool in tools"
      :key="tool.id"
      :class="[
        'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 btn-press',
        props.activeTool === tool.id
          ? 'bg-blue-600/90 text-white shadow-md shadow-blue-500/20'
          : 'text-gray-300 hover:bg-white/5 hover:text-white',
      ]"
      :title="`${tool.label} (${tool.shortcut})`"
      @click="emit('select-tool', tool.id)"
    >
      {{ tool.icon }} {{ tool.label }}
    </button>

    <!-- Separator -->
    <div class="w-px bg-white/10 mx-1" />

    <!-- Export button -->
    <button
      class="px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 btn-press flex items-center gap-1.5"
      :title="t('toolbar.exportPng')"
      :disabled="currentExportState !== 'idle'"
      @click="emit('export-png')"
    >
      <!-- Idle state -->
      <template v-if="currentExportState === 'idle'">
        {{ t('toolbar.png') }}
      </template>
      <!-- Loading state -->
      <template v-else-if="currentExportState === 'loading'">
        <svg class="w-4 h-4 animate-spin-subtle" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      </template>
      <!-- Success state -->
      <template v-else>
        <svg class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24">
          <path class="animate-check-draw" d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </template>
    </button>

    <!-- Separator -->
    <div class="w-px bg-white/10 mx-1" />

    <!-- Zoom controls -->
    <button
      class="px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 btn-press"
      :title="t('toolbar.zoomIn')"
      @click="emit('zoom-in')"
    >
      +
    </button>
    <button
      class="px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 btn-press"
      :title="t('toolbar.zoomOut')"
      @click="emit('zoom-out')"
    >
      −
    </button>
    <button
      class="px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 btn-press"
      :title="t('toolbar.resetView')"
      @click="emit('reset-view')"
    >
      ⟲
    </button>
  </div>
</template>
