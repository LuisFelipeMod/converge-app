<script setup lang="ts">
import type { Tool } from '@/types';

const props = defineProps<{
  activeTool: Tool;
}>();

const emit = defineEmits<{
  (e: 'select-tool', tool: Tool): void;
}>();

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '○' },
];
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
  </div>
</template>
